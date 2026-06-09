# 旅行证 Photo Cropper

Crop photos to Chinese consulate passport / travel document (旅行证) specifications.

**Output:** 390×567 px JPG (33×48 mm at 300 DPI)

## Requirements

- Python 3.10+
- Linux: `sudo apt install libegl1` (needed by MediaPipe)

## Setup

```bash
cd travel-document-photo-cropper
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

## Shooting tips

- Plain **white wall** background, even lighting
- **Dark shirt** (not white or light colors)
- Face the camera, eyes open, neutral expression
- Leave space **above the head** and below the shoulders
- Taken within the last 6 months

## Photo spec (enforced by tool)

| Parameter | Value |
|-----------|-------|
| Photo size | 33 mm × 48 mm |
| Head width | 15–22 mm |
| Head height (chin → crown) | 28–33 mm |
| Crown to top edge | 3–5 mm |
| Below chin to bottom | ≥ 7 mm |

## Usage

1. Upload your photo
2. Drag the crop box to adjust position; use the zoom slider to resize
3. Check that all four metrics show green
4. Download JPG and upload to 中国领事 APP
5. Print 2–3 identical copies for mailing (旅行证 requires paper photos)

## References

- [LA Consulate photo standard](https://losangeles.china-consulate.gov.cn/lbqw/lszj/hzlxz/202401/t20240103_11216138.htm)
- [LA Consulate travel document checklist](https://losangeles.china-consulate.gov.cn/lbqw/lszj/hzlxz/202506/t20250625_11658204.htm)
