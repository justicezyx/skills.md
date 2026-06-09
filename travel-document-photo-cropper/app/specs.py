"""Chinese consulate passport / travel document (旅行证) photo specifications."""

# Physical dimensions (mm)
PHOTO_WIDTH_MM = 33
PHOTO_HEIGHT_MM = 48

HEAD_WIDTH_MIN_MM = 15
HEAD_WIDTH_MAX_MM = 22
HEAD_HEIGHT_MIN_MM = 28
HEAD_HEIGHT_MAX_MM = 33
CROWN_MARGIN_MIN_MM = 3
CROWN_MARGIN_MAX_MM = 5
CHIN_MARGIN_MIN_MM = 7

# Target values for auto-crop (mid-range)
TARGET_HEAD_HEIGHT_MM = 30.5
TARGET_CROWN_MARGIN_MM = 4.0

# Output pixels at 300 DPI
DPI = 300
OUTPUT_WIDTH_PX = round(PHOTO_WIDTH_MM / 25.4 * DPI)   # 390
OUTPUT_HEIGHT_PX = round(PHOTO_HEIGHT_MM / 25.4 * DPI)  # 567

ASPECT_RATIO = PHOTO_WIDTH_MM / PHOTO_HEIGHT_MM  # 33/48

# mm per pixel in the output image
MM_PER_PX = PHOTO_WIDTH_MM / OUTPUT_WIDTH_PX
