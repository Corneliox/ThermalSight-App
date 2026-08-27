// src/src/thermalEngine.js
// 100% Client-Side Pure JavaScript Thermal Analysis Engine

// ── Color Palette Definitions ────────────────────────────────────────────────
function interpolateColor(color1, color2, factor) {
  const result = color1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
  }
  return result;
}

// Scientific Inferno Color LUT (256 entries)
const INFERNO_STOPS = [
  { p: 0.00, c: [0, 0, 4] },
  { p: 0.14, c: [40, 11, 84] },
  { p: 0.28, c: [101, 21, 110] },
  { p: 0.42, c: [159, 42, 99] },
  { p: 0.57, c: [212, 72, 66] },
  { p: 0.71, c: [245, 125, 21] },
  { p: 0.85, c: [250, 193, 39] },
  { p: 1.00, c: [252, 255, 164] }
];

// Hot Color LUT (black -> red -> yellow -> white)
const HOT_STOPS = [
  { p: 0.00, c: [0, 0, 0] },
  { p: 0.33, c: [230, 0, 0] },
  { p: 0.67, c: [255, 210, 0] },
  { p: 1.00, c: [255, 255, 255] }
];

function buildLUT(stops) {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let idx = 0;
    while (idx < stops.length - 1 && stops[idx + 1].p < t) {
      idx++;
    }
    const s1 = stops[idx];
    const s2 = stops[Math.min(idx + 1, stops.length - 1)];
    const range = (s2.p - s1.p) || 1e-5;
    const factor = Math.max(0, Math.min(1, (t - s1.p) / range));
    const c = interpolateColor(s1.c, s2.c, factor);
    lut[i * 3 + 0] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
  return lut;
}

const INFERNO_LUT = buildLUT(INFERNO_STOPS);
const HOT_LUT = buildLUT(HOT_STOPS);

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = 0; g = 0; b = 0;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ── Image Loader & Matrix Extractor ──────────────────────────────────────────
export function loadThermalImageData(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;

      const tempMatrix = new Float32Array(W * H);
      let minVal = Infinity;
      let maxVal = -Infinity;
      let sumVal = 0;

      for (let i = 0; i < W * H; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const temp = 20.0 + (lum / 255.0) * 25.0; // Scaled to ~20.0 - 45.0 °C
        tempMatrix[i] = temp;
        if (temp < minVal) minVal = temp;
        if (temp > maxVal) maxVal = temp;
        sumVal += temp;
      }

      resolve({
        width: W,
        height: H,
        tempMatrix,
        temp_min: minVal,
        temp_max: maxVal,
        temp_mean: sumVal / (W * H),
        shape: [H, W],
      });
    };
    img.onerror = (err) => reject(err);
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

// ── 5x5 Gaussian Blur Convolution ───────────────────────────────────────────
function gaussianBlur5x5(src, W, H) {
  const dst = new Float32Array(W * H);
  const K = [
    1,  4,  7,  4, 1,
    4, 16, 26, 16, 4,
    7, 26, 41, 26, 7,
    4, 16, 26, 16, 4,
    1,  4,  7,  4, 1
  ];
  const K_SUM = 273.0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let ky = -2; ky <= 2; ky++) {
        const py = Math.min(H - 1, Math.max(0, y + ky));
        for (let kx = -2; kx <= 2; kx++) {
          const px = Math.min(W - 1, Math.max(0, x + kx));
          const w = K[(ky + 2) * 5 + (kx + 2)];
          sum += src[py * W + px] * w;
        }
      }
      dst[y * W + x] = sum / K_SUM;
    }
  }
  return dst;
}

// ── 3x3 Sobel Convolutions ──────────────────────────────────────────────────
function computeSobel(src, W, H) {
  const sx = new Float32Array(W * H);
  const sy = new Float32Array(W * H);
  const mag = new Float32Array(W * H);
  const ang = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ym1 = Math.max(0, y - 1);
      const yp1 = Math.min(H - 1, y + 1);
      const xm1 = Math.max(0, x - 1);
      const xp1 = Math.min(W - 1, x + 1);

      const p00 = src[ym1 * W + xm1], p01 = src[ym1 * W + x], p02 = src[ym1 * W + xp1];
      const p10 = src[y   * W + xm1],                         p12 = src[y   * W + xp1];
      const p20 = src[yp1 * W + xm1], p21 = src[yp1 * W + x], p22 = src[yp1 * W + xp1];

      const dx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
      const dy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);

      sx[y * W + x] = dx;
      sy[y * W + x] = dy;
      const m = Math.hypot(dx, dy);
      mag[y * W + x] = m;
      ang[y * W + x] = Math.atan2(dy, dx);
    }
  }
  return { sx, sy, mag, ang };
}

// ── Render Arrays to Canvas & DataURL ───────────────────────────────────────
function renderToDataUrl(W, H, renderFn) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  renderFn(imgData.data);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// ── Complete Thermal Analysis Pipeline ──────────────────────────────────────
export function runClientThermalAnalysis(tempMatrix, W, H, stem = 'image') {
  // 1. Normalization
  let minT = Infinity, maxT = -Infinity;
  for (let i = 0; i < W * H; i++) {
    const v = tempMatrix[i];
    if (v < minT) minT = v;
    if (v > maxT) maxT = v;
  }
  const rangeT = (maxT - minT) || 1.0;

  const norm = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    norm[i] = 255.0 * (tempMatrix[i] - minT) / rangeT;
  }

  // 2. Blur & Sobel
  const blurred = gaussianBlur5x5(norm, W, H);
  const { sx, sy, mag, ang } = computeSobel(blurred, W, H);

  // 3. Percentile threshold for strong edges
  const sortedMag = new Float32Array(mag).sort();
  const p75 = sortedMag[Math.floor(sortedMag.length * 0.75)] || 0;
  const maxMag = sortedMag[sortedMag.length - 1] || 1.0;

  // ── Panel 1: Original Temperature (Inferno) ───────────────────────────────
  const originalUrl = renderToDataUrl(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const idx = Math.min(255, Math.max(0, Math.floor(norm[i])));
      d[i * 4 + 0] = INFERNO_LUT[idx * 3 + 0];
      d[i * 4 + 1] = INFERNO_LUT[idx * 3 + 1];
      d[i * 4 + 2] = INFERNO_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });

  // ── Panel 2: Gradient Magnitude (Hot) ────────────────────────────────────
  const magnitudeUrl = renderToDataUrl(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const idx = Math.min(255, Math.max(0, Math.floor((mag[i] / maxMag) * 255.0)));
      d[i * 4 + 0] = HOT_LUT[idx * 3 + 0];
      d[i * 4 + 1] = HOT_LUT[idx * 3 + 1];
      d[i * 4 + 2] = HOT_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });

  // ── Panel 3: Strong Edges Thresholded ────────────────────────────────────
  const magThreshUrl = renderToDataUrl(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const val = mag[i] >= p75 ? (mag[i] / maxMag) * 255.0 : 0;
      const idx = Math.min(255, Math.max(0, Math.floor(val)));
      d[i * 4 + 0] = HOT_LUT[idx * 3 + 0];
      d[i * 4 + 1] = HOT_LUT[idx * 3 + 1];
      d[i * 4 + 2] = HOT_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });

  // ── Panel 4: Flow Angle (HSV Colormap) ───────────────────────────────────
  const angleUrl = renderToDataUrl(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const h = (ang[i] + Math.PI) / (2 * Math.PI); // 0.0 - 1.0
      const rgb = hsvToRgb(h, 1.0, 1.0);
      d[i * 4 + 0] = rgb[0];
      d[i * 4 + 1] = rgb[1];
      d[i * 4 + 2] = rgb[2];
      d[i * 4 + 3] = 255;
    }
  });

  // ── Panel 5: Overlay (Inferno + Hot Edges) ────────────────────────────────
  const overlayUrl = renderToDataUrl(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const tIdx = Math.min(255, Math.max(0, Math.floor(norm[i])));
      const eIdx = Math.min(255, Math.max(0, Math.floor((mag[i] / maxMag) * 255.0)));
      d[i * 4 + 0] = Math.min(255, INFERNO_LUT[tIdx * 3 + 0] * 0.6 + HOT_LUT[eIdx * 3 + 0] * 0.4);
      d[i * 4 + 1] = Math.min(255, INFERNO_LUT[tIdx * 3 + 1] * 0.6 + HOT_LUT[eIdx * 3 + 1] * 0.4);
      d[i * 4 + 2] = Math.min(255, INFERNO_LUT[tIdx * 3 + 2] * 0.6 + HOT_LUT[eIdx * 3 + 2] * 0.4);
      d[i * 4 + 3] = 255;
    }
  });

  // ── Panel 6: Quiver Flow Vector Overlay ───────────────────────────────────
  const quiverCanvas = document.createElement('canvas');
  quiverCanvas.width = W;
  quiverCanvas.height = H;
  const qCtx = quiverCanvas.getContext('2d');

  // Direct vector render
  const qImgData = qCtx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const idx = Math.min(255, Math.max(0, Math.floor(norm[i])));
    qImgData.data[i * 4 + 0] = INFERNO_LUT[idx * 3 + 0];
    qImgData.data[i * 4 + 1] = INFERNO_LUT[idx * 3 + 1];
    qImgData.data[i * 4 + 2] = INFERNO_LUT[idx * 3 + 2];
    qImgData.data[i * 4 + 3] = 255;
  }
  qCtx.putImageData(qImgData, 0, 0);

  // Draw vector arrows
  const sub = 14;
  for (let y = sub / 2; y < H; y += sub) {
    for (let x = sub / 2; x < W; x += sub) {
      const idx = Math.floor(y) * W + Math.floor(x);
      if (mag[idx] >= p75) {
        const u = sx[idx];
        const v = sy[idx];
        const len = Math.hypot(u, v) + 1e-6;
        const un = u / len;
        const vn = v / len;
        const arrowLen = 6;
        const x2 = x + un * arrowLen;
        const y2 = y + vn * arrowLen;

        const h = (ang[idx] + Math.PI) / (2 * Math.PI);
        const rgb = hsvToRgb(h, 1.0, 1.0);
        qCtx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        qCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        qCtx.lineWidth = 1.2;

        qCtx.beginPath();
        qCtx.moveTo(x, y);
        qCtx.lineTo(x2, y2);
        qCtx.stroke();

        // Arrow head
        const headAngle = Math.atan2(vn, un);
        qCtx.beginPath();
        qCtx.moveTo(x2, y2);
        qCtx.lineTo(x2 - 3 * Math.cos(headAngle - Math.PI / 6), y2 - 3 * Math.sin(headAngle - Math.PI / 6));
        qCtx.lineTo(x2 - 3 * Math.cos(headAngle + Math.PI / 6), y2 - 3 * Math.sin(headAngle + Math.PI / 6));
        qCtx.fill();
      }
    }
  }
  const quiverUrl = quiverCanvas.toDataURL('image/png');

  // ── Panel 7: 2x3 Grid Overview ────────────────────────────────────────────
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = W * 3;
  gridCanvas.height = H * 2;
  const gCtx = gridCanvas.getContext('2d');
  gCtx.fillStyle = '#111';
  gCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

  const panels = [
    { title: 'Temperature (°C)', url: originalUrl, x: 0, y: 0 },
    { title: 'Gradient Mag', url: magnitudeUrl, x: W, y: 0 },
    { title: 'Strong Edges', url: magThreshUrl, x: W * 2, y: 0 },
    { title: 'Flow Angle', url: angleUrl, x: 0, y: H },
    { title: 'Overlay', url: overlayUrl, x: W, y: H },
    { title: 'Quiver Flow', url: quiverUrl, x: W * 2, y: H },
  ];

  panels.forEach(p => {
    const tileImg = new Image();
    tileImg.src = p.url;
    gCtx.drawImage(tileImg, p.x, p.y, W, H);
    gCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    gCtx.fillRect(p.x + 8, p.y + 8, 120, 22);
    gCtx.fillStyle = '#ffffff';
    gCtx.font = '11px sans-serif';
    gCtx.fillText(p.title, p.x + 14, p.y + 23);
  });
  const gridUrl = gridCanvas.toDataURL('image/png');

  return {
    stem,
    shape: [H, W],
    temp_min: minT,
    temp_max: maxT,
    temp_mean: sortedMag.reduce((a, b) => a + b, 0) / (W * H),
    images: {
      original: originalUrl,
      magnitude: magnitudeUrl,
      mag_thresh: magThreshUrl,
      angle: angleUrl,
      overlay: overlayUrl,
      quiver: quiverUrl,
      grid: gridUrl,
    },
    raw: { tempMatrix, sx, sy, mag, ang, width: W, height: H }
  };
}

// ── Bilinear Interpolation Helper ───────────────────────────────────────────
function sampleBilinear(arr, W, H, x, y) {
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const x1 = Math.max(0, Math.min(W - 1, x0 + 1));
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(H - 1, y0 + 1));
  const fx = x - x0;
  const fy = y - y0;

  const v00 = arr[y0 * W + x0];
  const v10 = arr[y0 * W + x1];
  const v01 = arr[y1 * W + x0];
  const v11 = arr[y1 * W + x1];

  const top = v00 * (1 - fx) + v10 * fx;
  const bot = v01 * (1 - fx) + v11 * fx;
  return top * (1 - fy) + bot * fy;
}

// ── 8-Point Star Measurement ────────────────────────────────────────────────
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const BASE_ANGLES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function clientMeasureStar(tempMatrix, W, H, cx, cy, dist_cm, rot_deg, pxPerCm) {
  const dist_px = dist_cm * pxPerCm;
  const temp_centre = sampleBilinear(tempMatrix, W, H, cx, cy);

  const points = {};
  let maxAbsDiff = -1;
  let dominant = 'N';

  COMPASS.forEach(name => {
    const angle = ((BASE_ANGLES[name] + rot_deg) * Math.PI) / 180.0;
    const px = cx + dist_px * Math.sin(angle);
    const py = cy - dist_px * Math.cos(angle);
    const temp = sampleBilinear(tempMatrix, W, H, px, py);
    const diff = temp - temp_centre;

    points[name] = {
      px,
      py,
      temp,
      diff,
      pct: { x: (px / W) * 100, y: (py / H) * 100 }
    };

    if (Math.abs(diff) > maxAbsDiff) {
      maxAbsDiff = Math.abs(diff);
      dominant = name;
    }
  });

  return {
    cx,
    cy,
    temp_centre,
    rotation_deg: rot_deg,
    dist_cm,
    dominant,
    points
  };
}

// ── Centered 8-Point Star Gradient inside Segmentation Label ────────────────
export function computeLabelStarGradient(tempMatrix, W, H, roi, pxPerCm = null) {
  let cx, cy, radius_px;

  if (roi.type === 'circle' && roi.cx !== undefined && roi.radius !== undefined) {
    cx = roi.cx;
    cy = roi.cy;
    radius_px = Math.max(2, roi.radius);
  } else {
    // For polygon/pen tool: calculate bounding box and expand until hitting closest side (min of width or height)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    (roi.points || []).forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
      cx = W / 2;
      cy = H / 2;
      radius_px = 10;
    } else {
      cx = (minX + maxX) / 2;
      cy = (minY + maxY) / 2;
      const boxW = Math.max(1, maxX - minX);
      const boxH = Math.max(1, maxY - minY);
      radius_px = Math.max(2, Math.min(boxW, boxH) / 2);
    }
  }

  const temp_centre = sampleBilinear(tempMatrix, W, H, cx, cy);
  const isCalibrated = pxPerCm && pxPerCm > 0;
  const radius_cm = isCalibrated ? radius_px / pxPerCm : radius_px;

  const points = {};
  let maxAbsDiff = -1;
  let maxGradVal = 0;
  let dominant = 'N';

  COMPASS.forEach(name => {
    const angle = (BASE_ANGLES[name] * Math.PI) / 180.0;
    const px = cx + radius_px * Math.sin(angle);
    const py = cy - radius_px * Math.cos(angle);
    const temp = sampleBilinear(tempMatrix, W, H, px, py);
    const diff = temp - temp_centre;
    const grad = Math.abs(diff) / Math.max(0.0001, radius_cm);

    points[name] = {
      px,
      py,
      temp: Number(temp.toFixed(4)),
      diff: Number(diff.toFixed(4)),
      grad: Number(grad.toFixed(4)),
      pct: { x: (px / W) * 100, y: (py / H) * 100 }
    };

    if (Math.abs(diff) > maxAbsDiff) {
      maxAbsDiff = Math.abs(diff);
      maxGradVal = grad;
      dominant = name;
    }
  });

  const domObj = points[dominant] || { diff: 0, grad: 0 };
  const gradient_modus = `${dominant} (${domObj.diff >= 0 ? '+' : ''}${domObj.diff.toFixed(2)}°C)`;
  const gradient_max = Number(maxGradVal.toFixed(4));

  return {
    cx,
    cy,
    radius_px,
    radius_cm: Number(radius_cm.toFixed(4)),
    temp_centre: Number(temp_centre.toFixed(4)),
    dominant,
    gradient_max,
    gradient_modus,
    points
  };
}

// ── Crop & Mask Polygon ROI ─────────────────────────────────────────────────
export function clientCropPolygonROI(tempMatrix, W, H, points, labelName, roiIndex, pxPerCm = null, roiObj = null) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(W - 1, Math.ceil(maxX));
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(H - 1, Math.ceil(maxY));

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const ctx = croppedCanvas.getContext('2d');
  const imgData = ctx.createImageData(cropW, cropH);

  let count = 0;
  let sum = 0;
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  const collectedTemps = [];

  let csvContent = 'row,col,x,y,temp_c\n';

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x - minX;
      const cy = y - minY;
      const pixelIdx = (cy * cropW + cx) * 4;

      if (isPointInPoly(x, y, points)) {
        const temp = tempMatrix[y * W + x];
        count++;
        sum += temp;
        if (temp < minTemp) minTemp = temp;
        if (temp > maxTemp) maxTemp = temp;
        collectedTemps.push(temp);

        csvContent += `${cy},${cx},${x},${y},${temp.toFixed(4)}\n`;

        // Render masked pixel in inferno colormap
        const normVal = Math.min(255, Math.max(0, Math.floor((temp - 20.0) / 25.0 * 255.0)));
        imgData.data[pixelIdx + 0] = INFERNO_LUT[normVal * 3 + 0];
        imgData.data[pixelIdx + 1] = INFERNO_LUT[normVal * 3 + 1];
        imgData.data[pixelIdx + 2] = INFERNO_LUT[normVal * 3 + 2];
        imgData.data[pixelIdx + 3] = 255;
      } else {
        // Transparent outside polygon
        imgData.data[pixelIdx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const meanTemp = count > 0 ? sum / count : 0;
  let varianceSum = 0;
  for (let i = 0; i < collectedTemps.length; i++) {
    varianceSum += Math.pow(collectedTemps[i] - meanTemp, 2);
  }
  const stdTemp = count > 0 ? Math.sqrt(varianceSum / count) : 0;

  // Calculate the 8-Point Star Gradient inside this label
  const starData = computeLabelStarGradient(tempMatrix, W, H, roiObj || { points }, pxPerCm);

  return {
    labelName,
    roiIndex,
    pixel_count: count,
    mean_temp: Number(meanTemp.toFixed(4)),
    min_temp: Number((minTemp === Infinity ? 0 : minTemp).toFixed(4)),
    max_temp: Number((maxTemp === -Infinity ? 0 : maxTemp).toFixed(4)),
    std_temp: Number(stdTemp.toFixed(4)),
    star: starData,
    gradient_max: starData.gradient_max,
    gradient_modus: starData.gradient_modus,
    star_center_temp: starData.temp_centre,
    star_radius_cm: starData.radius_cm,
    croppedPngDataUrl: croppedCanvas.toDataURL('image/png'),
    csvContent
  };
}
