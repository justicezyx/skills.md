const fileInput = document.getElementById("file-input");
const uploadSection = document.getElementById("upload-section");
const editorSection = document.getElementById("editor-section");
const errorMsg = document.getElementById("error-msg");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoomSlider = document.getElementById("zoom-slider");
const metricsEl = document.getElementById("metrics");
const exportBtn = document.getElementById("export-btn");
const whitenBtn = document.getElementById("whiten-btn");
const revertBtn = document.getElementById("revert-btn");
const canvasTooltip = document.getElementById("canvas-tooltip");

const GUIDE_TEXT = {
  crown: {
    title: "Crown margin zone",
    body: "Leave 3–5 mm of space between the top of the photo and the top of your head (hairline/crown). Drag the crop box until your crown sits between the dashed lines.",
  },
  chin: {
    title: "Chin margin zone",
    body: "Keep at least 7 mm of space below your chin to the bottom edge of the photo. This area should show your upper chest/shoulders.",
  },
  head: {
    title: "Head size guides",
    body: "Blue dashed lines mark the allowed head height (28–33 mm, crown to chin) and width (15–22 mm, ear to ear). Drag corners or use the crop-size slider to resize.",
  },
};

let state = null;
let img = new Image();
let interaction = null;
let dragStart = { x: 0, y: 0 };
let cropStart = { x: 0, y: 0 };
let baseCrop = null;

const HANDLE_SIZE = 10;
const MIN_CROP_WIDTH_RATIO = 0.12;

const SPEC = {
  photoW: 33, photoH: 48,
  headW: [15, 22], headH: [28, 33],
  crown: [3, 5], chinMin: 7,
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  upload(file);
});

zoomSlider.addEventListener("input", () => {
  if (!state) return;
  applyCropScale(baseCrop.width / (zoomSlider.value / 100));
  draw();
  validate();
});

canvas.addEventListener("mousedown", (e) => {
  if (!state) return;
  const handle = hitHandle(e);
  if (handle) {
    interaction = { type: "resize", handle };
    cropStart = { ...state.crop };
    dragStart = imgCoords(e);
    hideCanvasTooltip();
    return;
  }
  interaction = { type: "pan" };
  dragStart = { x: e.clientX, y: e.clientY };
  cropStart = { x: state.crop.x, y: state.crop.y };
  hideCanvasTooltip();
});

window.addEventListener("mousemove", (e) => {
  if (!state) return;
  if (!interaction) {
    updateCanvasCursor(e);
    return;
  }
  if (interaction.type === "pan") {
    const canvasScale = canvas.width / canvas.clientWidth;
    const dxScreen = (e.clientX - dragStart.x) * canvasScale;
    const dyScreen = (e.clientY - dragStart.y) * canvasScale;
    const imgScale = canvas.width / state.imgW;
    state.crop.x = cropStart.x + dxScreen / imgScale;
    state.crop.y = cropStart.y + dyScreen / imgScale;
    clampCrop();
    draw();
    return;
  }
  if (interaction.type === "resize") {
    resizeCropFromPointer(e);
    draw();
  }
});

window.addEventListener("mouseup", () => {
  if (!interaction) return;
  interaction = null;
  canvas.style.cursor = "";
  validate();
});

canvas.addEventListener("wheel", (e) => {
  if (!state) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.04 : 1 / 1.04;
  applyCropScale(state.crop.width * factor);
  syncSliderFromCrop();
  draw();
  validate();
}, { passive: false });

canvas.addEventListener("mousemove", (e) => {
  if (!state || interaction) {
    hideCanvasTooltip();
    return;
  }
  updateCanvasCursor(e);
  const zone = hitGuideZone(e);
  if (zone) {
    showCanvasTooltip(e, zone);
  } else {
    hideCanvasTooltip();
  }
});

canvas.addEventListener("mouseleave", hideCanvasTooltip);

document.querySelectorAll(".guide-item").forEach((el) => {
  el.title = formatGuideText(GUIDE_TEXT[el.dataset.guide]);
});

whitenBtn.addEventListener("click", () => applyImageEdit("/api/whiten", "Whitening…", "Background whitening failed"));
revertBtn.addEventListener("click", () => applyImageEdit("/api/revert", "Reverting…", "Revert failed"));

exportBtn.addEventListener("click", async () => {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: state.imageId, crop: state.crop }),
  });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "travel_document_photo.jpg";
  a.click();
});

async function upload(file) {
  hideError();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();

  if (!res.ok) {
    showError(data.detail || "Detection failed, please retry with another photo");
    return;
  }

  state = {
    imageId: data.image_id,
    face: data.face,
    crop: { ...data.crop },
    imgW: data.image_width,
    imgH: data.image_height,
    whitened: false,
  };
  baseCrop = { ...data.crop };
  zoomSlider.value = 100;
  updateEditButtons();

  img = new Image();
  img.onload = () => {
    editorSection.classList.remove("hidden");
    renderMetrics(data.metrics);
    draw();
  };
  img.src = `/api/image/${data.image_id}`;
}

function updateEditButtons() {
  if (!state) return;
  whitenBtn.classList.toggle("hidden", state.whitened);
  revertBtn.classList.toggle("hidden", !state.whitened);
}

async function applyImageEdit(endpoint, loadingLabel, errorLabel) {
  if (!state) return;
  whitenBtn.disabled = true;
  revertBtn.disabled = true;
  const activeBtn = state.whitened ? revertBtn : whitenBtn;
  const defaultLabel = activeBtn.textContent;
  activeBtn.textContent = loadingLabel;
  hideError();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_id: state.imageId, crop: state.crop }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.detail || errorLabel);
      return;
    }

    state.face = data.face;
    state.imgW = data.image_width;
    state.imgH = data.image_height;
    state.whitened = data.whitened;
    renderMetrics(data.metrics);
    updateEditButtons();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = `/api/image/${state.imageId}?t=${Date.now()}`;
    });
    draw();
  } catch {
    showError(errorLabel);
  } finally {
    whitenBtn.disabled = false;
    revertBtn.disabled = false;
    whitenBtn.textContent = "Whiten Background";
    revertBtn.textContent = "Revert to Original";
  }
}

async function validate() {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: state.imageId, crop: state.crop }),
  });
  const data = await res.json();
  renderMetrics(data.metrics);
}

function renderMetrics(m) {
  const items = [
    { label: "Crown margin", value: `${m.crown_margin_mm} mm (3–5)`, ok: m.crown_ok },
    { label: "Chin margin", value: `${m.chin_margin_mm} mm (≥7)`, ok: m.chin_ok },
    { label: "Head height", value: `${m.head_height_mm} mm (28–33)`, ok: m.head_height_ok },
    { label: "Head width", value: `${m.head_width_mm} mm (15–22)`, ok: m.head_width_ok },
  ];
  metricsEl.innerHTML = items.map((i) =>
    `<div class="metric ${i.ok ? "ok" : "fail"}">
      <div class="label">${i.label}</div>
      <div class="value">${i.value}</div>
    </div>`
  ).join("");
}

function formatGuideText({ title, body }) {
  return `${title}: ${body}`;
}

function displayScale() {
  const maxW = 680;
  return Math.min(1, maxW / state.imgW);
}

function getCropScreenRect() {
  const s = displayScale();
  return {
    x: state.crop.x * s,
    y: state.crop.y * s,
    w: state.crop.width * s,
    h: state.crop.height * s,
  };
}

function getHandleRects() {
  const r = getCropScreenRect();
  const hs = HANDLE_SIZE;
  const corners = {
    tl: { x: r.x - hs / 2, y: r.y - hs / 2 },
    tr: { x: r.x + r.w - hs / 2, y: r.y - hs / 2 },
    bl: { x: r.x - hs / 2, y: r.y + r.h - hs / 2 },
    br: { x: r.x + r.w - hs / 2, y: r.y + r.h - hs / 2 },
  };
  return Object.fromEntries(
    Object.entries(corners).map(([k, c]) => [k, { x: c.x, y: c.y, w: hs, h: hs }])
  );
}

function imgCoords(e) {
  const s = displayScale();
  const { x, y } = canvasCoords(e);
  return { x: x / s, y: y / s };
}

function hitHandle(e) {
  const { x, y } = canvasCoords(e);
  for (const [name, h] of Object.entries(getHandleRects())) {
    if (inRect(x, y, h)) return name;
  }
  return null;
}

function handleCursor(name) {
  return { tl: "nwse-resize", br: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize" }[name];
}

function updateCanvasCursor(e) {
  const handle = hitHandle(e);
  if (handle) {
    canvas.style.cursor = handleCursor(handle);
    return;
  }
  const { x, y } = canvasCoords(e);
  const crop = getCropScreenRect();
  canvas.style.cursor = inRect(x, y, crop) ? "grab" : "default";
}

function minCropWidth() {
  return Math.max(40, baseCrop.width * MIN_CROP_WIDTH_RATIO);
}

function maxCropWidth() {
  const aspect = SPEC.photoW / SPEC.photoH;
  let w = state.imgW;
  let h = w / aspect;
  if (h > state.imgH) {
    h = state.imgH;
    w = h * aspect;
  }
  return w;
}

function applyCropScale(newWidth) {
  const aspect = SPEC.photoW / SPEC.photoH;
  const c = state.crop;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  c.width = Math.max(minCropWidth(), Math.min(maxCropWidth(), newWidth));
  c.height = c.width / aspect;
  c.x = cx - c.width / 2;
  c.y = cy - c.height / 2;
  clampCrop();
}

function resizeCropFromPointer(e) {
  const { x, y } = imgCoords(e);
  const cx = cropStart.x + cropStart.width / 2;
  const cy = cropStart.y + cropStart.height / 2;
  const aspect = SPEC.photoW / SPEC.photoH;
  const halfW = Math.abs(x - cx);
  const halfH = Math.abs(y - cy);
  let newW = halfW * 2;
  let newH = halfH * 2;
  if (newW / aspect > newH) newW = newH * aspect;
  else newH = newW / aspect;
  applyCropScale(newW);
  syncSliderFromCrop();
}

function syncSliderFromCrop() {
  if (!baseCrop) return;
  const zoom = Math.round((baseCrop.width / state.crop.width) * 100);
  zoomSlider.value = Math.max(+zoomSlider.min, Math.min(+zoomSlider.max, zoom));
}

function getOverlayZones() {
  const s = displayScale();
  const cx = state.crop.x * s;
  const cy = state.crop.y * s;
  const cw = state.crop.width * s;
  const ch = state.crop.height * s;
  const mmH = (mm) => (mm / SPEC.photoH) * ch;

  return {
    crop: { x: cx, y: cy, w: cw, h: ch },
    crown: { x: cx, y: cy, w: cw, h: mmH(SPEC.crown[1]) },
    chin: { x: cx, y: cy + ch - mmH(SPEC.chinMin), w: cw, h: mmH(SPEC.chinMin) },
  };
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function hitGuideZone(e) {
  const { x, y } = canvasCoords(e);
  const zones = getOverlayZones();
  if (inRect(x, y, zones.crown)) return "crown";
  if (inRect(x, y, zones.chin)) return "chin";
  return null;
}

function showCanvasTooltip(e, zone) {
  const { title, body } = GUIDE_TEXT[zone];
  canvasTooltip.innerHTML = `<strong>${title}</strong><br>${body}`;
  canvasTooltip.classList.remove("hidden");

  const wrap = canvas.parentElement;
  const wrapRect = wrap.getBoundingClientRect();
  const tipRect = canvasTooltip.getBoundingClientRect();
  let left = e.clientX - wrapRect.left + 12;
  let top = e.clientY - wrapRect.top + 12;

  if (left + tipRect.width > wrapRect.width - 8) {
    left = e.clientX - wrapRect.left - tipRect.width - 12;
  }
  if (top + tipRect.height > wrapRect.height - 8) {
    top = e.clientY - wrapRect.top - tipRect.height - 12;
  }

  canvasTooltip.style.left = `${Math.max(4, left)}px`;
  canvasTooltip.style.top = `${Math.max(4, top)}px`;
}

function hideCanvasTooltip() {
  canvasTooltip.classList.add("hidden");
}

function clampCrop() {
  const c = state.crop;
  const aspect = SPEC.photoW / SPEC.photoH;
  c.height = c.width / aspect;

  if (c.width > state.imgW) {
    c.width = state.imgW;
    c.height = c.width / aspect;
  }
  if (c.height > state.imgH) {
    c.height = state.imgH;
    c.width = c.height * aspect;
  }
  c.x = Math.max(0, Math.min(c.x, state.imgW - c.width));
  c.y = Math.max(0, Math.min(c.y, state.imgH - c.height));
}

function drawHandles(cx, cy, cw, ch) {
  const hs = HANDLE_SIZE;
  const corners = [
    [cx, cy],
    [cx + cw, cy],
    [cx, cy + ch],
    [cx + cw, cy + ch],
  ];
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1.5;
  for (const [hx, hy] of corners) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
}

function draw() {
  const s = displayScale();
  canvas.width = state.imgW * s;
  canvas.height = state.imgH * s;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const cx = state.crop.x * s;
  const cy = state.crop.y * s;
  const cw = state.crop.width * s;
  const ch = state.crop.height * s;

  // darken outside crop
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, cy);
  ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
  ctx.fillRect(0, cy, cx, ch);
  ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);

  // crop border
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, cw, ch);

  // guide lines (mm → fraction of crop)
  const mmY = (mm) => cy + (mm / SPEC.photoH) * ch;
  const mmH = (mm) => (mm / SPEC.photoH) * ch;

  // crown zone (3–5mm from top)
  ctx.fillStyle = "rgba(0, 200, 100, 0.15)";
  ctx.fillRect(cx, cy, cw, mmH(SPEC.crown[1]));
  ctx.strokeStyle = "rgba(0, 200, 100, 0.6)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, mmY(SPEC.crown[0]));
  ctx.lineTo(cx + cw, mmY(SPEC.crown[0]));
  ctx.moveTo(cx, mmY(SPEC.crown[1]));
  ctx.lineTo(cx + cw, mmY(SPEC.crown[1]));
  ctx.stroke();

  // chin zone (≥7mm from bottom)
  const chinTop = cy + ch - mmH(SPEC.chinMin);
  ctx.fillStyle = "rgba(0, 200, 100, 0.15)";
  ctx.fillRect(cx, chinTop, cw, mmH(SPEC.chinMin));
  ctx.beginPath();
  ctx.moveTo(cx, chinTop);
  ctx.lineTo(cx + cw, chinTop);
  ctx.stroke();

  // head height band (28–33mm from crown reference)
  ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
  const face = state.face;
  const crownInCrop = (face.crown.y - state.crop.y) * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + crownInCrop + mmH(SPEC.headH[0]));
  ctx.lineTo(cx + cw, cy + crownInCrop + mmH(SPEC.headH[0]));
  ctx.moveTo(cx, cy + crownInCrop + mmH(SPEC.headH[1]));
  ctx.lineTo(cx + cw, cy + crownInCrop + mmH(SPEC.headH[1]));
  ctx.stroke();
  ctx.setLineDash([]);

  // head width band (centered on face)
  const headCenterX = ((face.left_ear.x + face.right_ear.x) / 2 - state.crop.x) * s;
  const headWMm = SPEC.headW;
  const mmX = (mm) => (mm / SPEC.photoW) * cw;
  ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx + headCenterX - mmX(headWMm[1] / 2), cy);
  ctx.lineTo(cx + headCenterX - mmX(headWMm[1] / 2), cy + ch);
  ctx.moveTo(cx + headCenterX - mmX(headWMm[0] / 2), cy);
  ctx.lineTo(cx + headCenterX - mmX(headWMm[0] / 2), cy + ch);
  ctx.moveTo(cx + headCenterX + mmX(headWMm[0] / 2), cy);
  ctx.lineTo(cx + headCenterX + mmX(headWMm[0] / 2), cy + ch);
  ctx.moveTo(cx + headCenterX + mmX(headWMm[1] / 2), cy);
  ctx.lineTo(cx + headCenterX + mmX(headWMm[1] / 2), cy + ch);
  ctx.stroke();
  ctx.setLineDash([]);

  // horizontal center alignment guide
  const centerX = cx + cw / 2;
  ctx.strokeStyle = "rgba(0, 200, 100, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, cy);
  ctx.lineTo(centerX, cy + ch);
  ctx.stroke();

  drawHandles(cx, cy, cw, ch);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.classList.add("hidden");
}
