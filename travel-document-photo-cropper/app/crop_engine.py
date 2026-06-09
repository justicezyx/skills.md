import io
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from PIL import Image

from app.specs import (
    ASPECT_RATIO,
    CHIN_MARGIN_MIN_MM,
    CROWN_MARGIN_MAX_MM,
    CROWN_MARGIN_MIN_MM,
    HEAD_HEIGHT_MAX_MM,
    HEAD_HEIGHT_MIN_MM,
    HEAD_WIDTH_MAX_MM,
    HEAD_WIDTH_MIN_MM,
    OUTPUT_HEIGHT_PX,
    OUTPUT_WIDTH_PX,
    PHOTO_HEIGHT_MM,
    TARGET_CROWN_MARGIN_MM,
    TARGET_HEAD_HEIGHT_MM,
)

MODEL_PATH = Path(__file__).parent.parent / "models" / "face_landmarker.task"
SEGMENTER_MODEL_PATH = Path(__file__).parent.parent / "models" / "selfie_segmenter.tflite"

CHIN = 152
LEFT_EAR = 234
RIGHT_EAR = 454

_landmarker = None
_segmenter = None


def _get_landmarker():
    global _landmarker
    if _landmarker is None:
        options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
        )
        _landmarker = vision.FaceLandmarker.create_from_options(options)
    return _landmarker


def _get_segmenter():
    global _segmenter
    if _segmenter is None:
        options = vision.ImageSegmenterOptions(
            base_options=python.BaseOptions(model_asset_path=str(SEGMENTER_MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            output_confidence_masks=True,
        )
        _segmenter = vision.ImageSegmenter.create_from_options(options)
    return _segmenter


def whiten_background(bgr: np.ndarray) -> np.ndarray:
    """Replace the background with white using selfie segmentation."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = _get_segmenter().segment(mp_image)

    mask = result.confidence_masks[0].numpy_view().squeeze().astype(np.float32)
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=2)
    mask = np.clip(mask, 0, 1)[..., np.newaxis]

    white = np.full_like(rgb, 255, dtype=np.float32)
    out = (rgb.astype(np.float32) * mask + white * (1 - mask)).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_RGB2BGR)


def prepare_image(image_bytes: bytes) -> bytes:
    """Return a whitened JPEG for preview/export."""
    bgr = whiten_background(_load_bgr(image_bytes))
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _load_bgr(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_face(image_bytes: bytes) -> dict:
    """Detect face landmarks. Raises ValueError if no face found."""
    bgr = _load_bgr(image_bytes)
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    results = _get_landmarker().detect(mp_image)

    if not results.face_landmarks:
        raise ValueError("Detection failed, please retry with another photo")

    lm = results.face_landmarks[0]

    chin_x, chin_y = lm[CHIN].x * w, lm[CHIN].y * h
    left_ear_x, _ = lm[LEFT_EAR].x * w, lm[LEFT_EAR].y * h
    right_ear_x, _ = lm[RIGHT_EAR].x * w, lm[RIGHT_EAR].y * h

    all_y = [l.y * h for l in lm]
    mesh_top_y = min(all_y)
    head_height_px = chin_y - mesh_top_y
    hair_pad = head_height_px * 0.12
    crown_y = mesh_top_y - hair_pad

    face_center_x = (left_ear_x + right_ear_x) / 2
    head_width_px = right_ear_x - left_ear_x

    return {
        "image_width": w,
        "image_height": h,
        "crown": {"x": face_center_x, "y": crown_y},
        "chin": {"x": chin_x, "y": chin_y},
        "left_ear": {"x": left_ear_x, "y": chin_y},
        "right_ear": {"x": right_ear_x, "y": chin_y},
        "head_width_px": head_width_px,
        "head_height_px": chin_y - crown_y,
    }


def suggest_crop(face: dict) -> dict:
    """Compute initial crop box (x, y, width, height) in source image pixels."""
    head_h = face["head_height_px"]
    crop_h = head_h * (PHOTO_HEIGHT_MM / TARGET_HEAD_HEIGHT_MM)
    crop_w = crop_h * ASPECT_RATIO

    crown_margin_px = TARGET_CROWN_MARGIN_MM / PHOTO_HEIGHT_MM * crop_h
    crop_x = face["crown"]["x"] - crop_w / 2
    crop_y = face["crown"]["y"] - crown_margin_px

    return _clamp_crop(crop_x, crop_y, crop_w, crop_h, face["image_width"], face["image_height"])


def _clamp_crop(x, y, w, h, img_w, img_h) -> dict:
    w = max(w, 1)
    h = max(h, 1)
    if w > img_w:
        scale = img_w / w
        w = img_w
        h = h * scale
    if h > img_h:
        scale = img_h / h
        h = img_h
        w = w * scale
    x = max(0, min(x, img_w - w))
    y = max(0, min(y, img_h - h))
    return {"x": x, "y": y, "width": w, "height": h}


def validate_crop(face: dict, crop: dict) -> dict:
    """Check head margins against consulate spec."""
    scale = PHOTO_HEIGHT_MM / crop["height"]

    crown_y = face["crown"]["y"]
    chin_y = face["chin"]["y"]
    left_ear = face["left_ear"]["x"]
    right_ear = face["right_ear"]["x"]

    crown_margin_mm = (crown_y - crop["y"]) * scale
    chin_margin_mm = (crop["y"] + crop["height"] - chin_y) * scale
    head_height_mm = (chin_y - crown_y) * scale
    head_width_mm = (right_ear - left_ear) * scale

    def ok(val, lo, hi=None):
        if hi is None:
            return val >= lo
        return lo <= val <= hi

    metrics = {
        "crown_margin_mm": round(crown_margin_mm, 1),
        "chin_margin_mm": round(chin_margin_mm, 1),
        "head_height_mm": round(head_height_mm, 1),
        "head_width_mm": round(head_width_mm, 1),
        "crown_ok": ok(crown_margin_mm, CROWN_MARGIN_MIN_MM, CROWN_MARGIN_MAX_MM),
        "chin_ok": ok(chin_margin_mm, CHIN_MARGIN_MIN_MM),
        "head_height_ok": ok(head_height_mm, HEAD_HEIGHT_MIN_MM, HEAD_HEIGHT_MAX_MM),
        "head_width_ok": ok(head_width_mm, HEAD_WIDTH_MIN_MM, HEAD_WIDTH_MAX_MM),
    }
    metrics["all_ok"] = (
        metrics["crown_ok"]
        and metrics["chin_ok"]
        and metrics["head_height_ok"]
        and metrics["head_width_ok"]
    )
    return metrics


def export_photo(image_bytes: bytes, crop: dict) -> bytes:
    """Crop, resize to spec, return JPEG bytes."""
    bgr = _load_bgr(image_bytes)
    x, y, w, h = int(crop["x"]), int(crop["y"]), int(crop["width"]), int(crop["height"])
    cropped = bgr[y : y + h, x : x + w]
    rgb = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    pil = pil.resize((OUTPUT_WIDTH_PX, OUTPUT_HEIGHT_PX), Image.LANCZOS)

    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=95, dpi=(300, 300))
    return buf.getvalue()
