import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.crop_engine import detect_face, export_photo, prepare_image, suggest_crop, validate_crop

app = FastAPI(title="旅行证 Photo Cropper")

STATIC_DIR = Path(__file__).parent.parent / "static"
uploads: dict[str, bytes] = {}


class ExportRequest(BaseModel):
    image_id: str
    crop: dict


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    image_bytes = await file.read()
    try:
        face = detect_face(image_bytes)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})

    crop = suggest_crop(face)
    metrics = validate_crop(face, crop)

    image_id = str(uuid.uuid4())
    uploads[image_id] = prepare_image(image_bytes)

    return {
        "image_id": image_id,
        "image_width": face["image_width"],
        "image_height": face["image_height"],
        "face": face,
        "crop": crop,
        "metrics": metrics,
    }


@app.get("/api/image/{image_id}")
def get_image(image_id: str):
    return Response(content=uploads[image_id], media_type="image/jpeg")


@app.post("/api/validate")
def validate(req: ExportRequest):
    image_bytes = uploads[req.image_id]
    face = detect_face(image_bytes)
    metrics = validate_crop(face, req.crop)
    return {"metrics": metrics}


@app.post("/api/export")
def export(req: ExportRequest):
    image_bytes = uploads[req.image_id]
    jpg = export_photo(image_bytes, req.crop)
    return Response(
        content=jpg,
        media_type="image/jpeg",
        headers={"Content-Disposition": "attachment; filename=travel_document_photo.jpg"},
    )


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
