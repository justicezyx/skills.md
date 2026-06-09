const fileInput = document.getElementById("file-input");
const uploadSection = document.getElementById("upload-section");
const editorSection = document.getElementById("editor-section");
const errorMsg = document.getElementById("error-msg");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoomSlider = document.getElementById("zoom-slider");
const metricsEl = document.getElementById("metrics");
const exportBtn = document.getElementById("export-btn");

let state = null;
let img = new Image();
let dragging = false;
let dragStart = { x: 0, y: 0 };
let cropStart = { x: 0, y: 0 };
let baseCrop = null;

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
  const factor = zoomSlider.value / 100;
  const bc = baseCrop;
  const cx = bc.x + bc.width / 2;
  const cy = bc.y + bc.height / 2;
  state.crop.width = bc.width / factor;
  state.crop.height = bc.height / factor;
  state.crop.x = cx - state.crop.width / 2;
  state.crop.y = cy - state.crop.height / 2;
  clampCrop();
  draw();
  validate();
});

canvas.addEventListener("mousedown", (e) => {
  if (!state) return;
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  cropStart = { x: state.crop.x, y: state.crop.y };
});

window.addEventListener("mousemove", (e) => {
  if (!dragging || !state) return;
  const canvasScale = canvas.width / canvas.clientWidth;
  const dxScreen = (e.clientX - dragStart.x) * canvasScale;
  const dyScreen = (e.clientY - dragStart.y) * canvasScale;
  const imgScale = canvas.width / state.imgW;
  state.crop.x = cropStart.x - dxScreen / imgScale;
  state.crop.y = cropStart.y - dyScreen / imgScale;
  clampCrop();
  draw();
});

window.addEventListener("mouseup", () => {
  if (dragging) {
    dragging = false;
    validate();
  }
});

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
  };
  baseCrop = { ...data.crop };
  zoomSlider.value = 100;

  img = new Image();
  img.onload = () => {
    editorSection.classList.remove("hidden");
    renderMetrics(data.metrics);
    draw();
  };
  img.src = `/api/image/${data.image_id}`;
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

function draw() {
  const maxW = 680;
  const scale = Math.min(1, maxW / state.imgW);
  canvas.width = state.imgW * scale;
  canvas.height = state.imgH * scale;
  const s = scale;

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
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.classList.add("hidden");
}
