// src/src/thermalEngine.js
// 100% Client-Side Pure JavaScript Thermal Analysis Engine

// ── Polygon Point-in-Polygon (Ray Casting Algorithm) ─────────────────────────
function isPointInPoly(px, py, points) {
  if (!points || !Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

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
    if (!imageSource) {
      reject(new Error('No image source provided'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let blobUrl = null;

    img.onload = () => {
      if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch {}
      }
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      if (!W || !H) {
        reject(new Error('Image has zero dimensions'));
        return;
      }
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

    img.onerror = (err) => {
      if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch {}
      }
      reject(new Error(`Failed to decode thermal image: ${err?.message || 'Invalid image file'}`));
    };

    if (imageSource instanceof Blob || imageSource instanceof File) {
      blobUrl = URL.createObjectURL(imageSource);
      img.src = blobUrl;
    } else if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      reject(new Error('Unsupported image source type'));
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
function renderToCanvas(W, H, renderFn) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  renderFn(imgData.data);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
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
  const origCanvas = renderToCanvas(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const idx = Math.min(255, Math.max(0, Math.floor(norm[i])));
      d[i * 4 + 0] = INFERNO_LUT[idx * 3 + 0];
      d[i * 4 + 1] = INFERNO_LUT[idx * 3 + 1];
      d[i * 4 + 2] = INFERNO_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });
  const originalUrl = origCanvas.toDataURL('image/png');

  // ── Panel 2: Gradient Magnitude (Hot) ────────────────────────────────────
  const magCanvas = renderToCanvas(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const idx = Math.min(255, Math.max(0, Math.floor((mag[i] / maxMag) * 255.0)));
      d[i * 4 + 0] = HOT_LUT[idx * 3 + 0];
      d[i * 4 + 1] = HOT_LUT[idx * 3 + 1];
      d[i * 4 + 2] = HOT_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });
  const magnitudeUrl = magCanvas.toDataURL('image/png');

  // ── Panel 3: Strong Edges Thresholded ────────────────────────────────────
  const threshCanvas = renderToCanvas(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const val = mag[i] >= p75 ? (mag[i] / maxMag) * 255.0 : 0;
      const idx = Math.min(255, Math.max(0, Math.floor(val)));
      d[i * 4 + 0] = HOT_LUT[idx * 3 + 0];
      d[i * 4 + 1] = HOT_LUT[idx * 3 + 1];
      d[i * 4 + 2] = HOT_LUT[idx * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  });
  const magThreshUrl = threshCanvas.toDataURL('image/png');

  // ── Panel 4: Flow Angle (HSV Colormap) ───────────────────────────────────
  const angleCanvas = renderToCanvas(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const h = (ang[i] + Math.PI) / (2 * Math.PI); // 0.0 - 1.0
      const rgb = hsvToRgb(h, 1.0, 1.0);
      d[i * 4 + 0] = rgb[0];
      d[i * 4 + 1] = rgb[1];
      d[i * 4 + 2] = rgb[2];
      d[i * 4 + 3] = 255;
    }
  });
  const angleUrl = angleCanvas.toDataURL('image/png');

  // ── Panel 5: Overlay (Inferno + Hot Edges) ────────────────────────────────
  const overlayCanvas = renderToCanvas(W, H, (d) => {
    for (let i = 0; i < W * H; i++) {
      const tIdx = Math.min(255, Math.max(0, Math.floor(norm[i])));
      const eIdx = Math.min(255, Math.max(0, Math.floor((mag[i] / maxMag) * 255.0)));
      d[i * 4 + 0] = Math.min(255, INFERNO_LUT[tIdx * 3 + 0] * 0.6 + HOT_LUT[eIdx * 3 + 0] * 0.4);
      d[i * 4 + 1] = Math.min(255, INFERNO_LUT[tIdx * 3 + 1] * 0.6 + HOT_LUT[eIdx * 3 + 1] * 0.4);
      d[i * 4 + 2] = Math.min(255, INFERNO_LUT[tIdx * 3 + 2] * 0.6 + HOT_LUT[eIdx * 3 + 2] * 0.4);
      d[i * 4 + 3] = 255;
    }
  });
  const overlayUrl = overlayCanvas.toDataURL('image/png');

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

  // ── Panel 7: 2x3 Grid Overview (Synchronously Drawn from Canvases) ─────────
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = W * 3;
  gridCanvas.height = H * 2;
  const gCtx = gridCanvas.getContext('2d');
  gCtx.fillStyle = '#111';
  gCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

  const tilePanels = [
    { title: 'Temperature (°C)', canvas: origCanvas, x: 0, y: 0 },
    { title: 'Gradient Mag', canvas: magCanvas, x: W, y: 0 },
    { title: 'Strong Edges', canvas: threshCanvas, x: W * 2, y: 0 },
    { title: 'Flow Angle', canvas: angleCanvas, x: 0, y: H },
    { title: 'Overlay', canvas: overlayCanvas, x: W, y: H },
    { title: 'Quiver Flow', canvas: quiverCanvas, x: W * 2, y: H },
  ];

  tilePanels.forEach(p => {
    gCtx.drawImage(p.canvas, p.x, p.y, W, H);
    gCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
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
  if (!arr || arr.length === 0) return 0;
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const x1 = Math.max(0, Math.min(W - 1, x0 + 1));
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(H - 1, y0 + 1));
  const fx = x - x0;
  const fy = y - y0;

  const v00 = arr[y0 * W + x0] ?? 0;
  const v10 = arr[y0 * W + x1] ?? 0;
  const v01 = arr[y1 * W + x0] ?? 0;
  const v11 = arr[y1 * W + x1] ?? 0;

  const top = v00 * (1 - fx) + v10 * fx;
  const bot = v01 * (1 - fx) + v11 * fx;
  return top * (1 - fy) + bot * fy;
}

// ── 8-Point Star Measurement ────────────────────────────────────────────────
export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const BASE_ANGLES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function clientMeasureStar(tempMatrix, W, H, cx, cy, dist_cm, rot_deg, pxPerCm) {
  const dist_px = dist_cm * (pxPerCm || 10);
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
      temp: Number(temp.toFixed(4)),
      diff: Number(diff.toFixed(4)),
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
    temp_centre: Number(temp_centre.toFixed(4)),
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
  (points || []).forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  if (minX === Infinity) {
    minX = 0; maxX = W - 1; minY = 0; maxY = H - 1;
  }

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
        const temp = tempMatrix[y * W + x] ?? 0;
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

  // Calculate the 8-Point Star Gradient inside this label
  const starData = computeLabelStarGradient(tempMatrix, W, H, roiObj || { points }, pxPerCm);

  // Draw 8-Point Star Overlay directly onto cropped canvas
  const relCx = starData.cx - minX;
  const relCy = starData.cy - minY;
  const relR = starData.radius_px;

  // Incircle outline
  ctx.save();
  ctx.strokeStyle = roiObj?.color || '#00e5ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.arc(relCx, relCy, relR, 0, 2 * Math.PI);
  ctx.stroke();

  // 8 Compass Radial Spokes
  COMPASS.forEach(name => {
    const p = starData.points[name];
    if (p) {
      const spokeX = p.px - minX;
      const spokeY = p.py - minY;
      ctx.setLineDash([]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = p.diff >= 0 ? 'rgba(255, 90, 70, 0.9)' : 'rgba(80, 160, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(relCx, relCy);
      ctx.lineTo(spokeX, spokeY);
      ctx.stroke();

      // Direction label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      ctx.fillText(name, spokeX - 4, spokeY - 2);
    }
  });

  // Center Point
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(relCx, relCy, 2.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Generate 9-Point Star Gradient Detailed CSV
  let starCsvContent = 'point,direction,angle_deg,px,py,temp_c,diff_centre_c,gradient_c_per_cm\n';
  starCsvContent += `centre,Center,0,${starData.cx.toFixed(1)},${starData.cy.toFixed(1)},${starData.temp_centre.toFixed(4)},0.0000,0.0000\n`;
  COMPASS.forEach(name => {
    const p = starData.points[name];
    if (p) {
      starCsvContent += `${name},${name},${BASE_ANGLES[name]},${p.px.toFixed(1)},${p.py.toFixed(1)},${p.temp.toFixed(4)},${(p.diff >= 0 ? '+' : '') + p.diff.toFixed(4)},${p.grad.toFixed(4)}\n`;
    }
  });

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
    csvContent,
    starCsvContent
  };
}

// ── Sequence Comparison Montage Generator (Overall & Relative Focus) ───────
export function generateFullSequenceComparisonCanvas(imageList, resultsMap, segmentations, calibrationsMap, targetLabel = 'overall') {
  if (!imageList || imageList.length === 0) return null;

  const N = imageList.length;
  const tileW = 340;
  const tileH = 260;
  const headerH = 75;
  const footerH = 115;
  const margin = 20;

  const totalW = margin * 2 + N * tileW + (N - 1) * margin;
  const totalH = margin * 2 + headerH + tileH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(0, 0, totalW, totalH);

  // Title Banner
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  const modeTitle = targetLabel === 'overall' 
    ? '🌐 Sequence Thermal Gradient Comparison — Overall (All ROIs & Labels)' 
    : `🎯 Sequence Thermal Gradient Progression — Relative Focus: ${targetLabel}`;
  ctx.fillText(modeTitle, margin, margin + 22);

  ctx.fillStyle = '#8888a0';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Multi-Step Comparative Analysis (${N} Steps Sequence) — Relative to Baseline Step 1`, margin, margin + 42);

  let baselineCenterTemp = null;
  let baselineMeanTemp = null;

  for (let i = 0; i < N; i++) {
    const imgPath = imageList[i];
    const res = resultsMap[imgPath];
    const rois = segmentations[imgPath] || [];
    const scale = calibrationsMap[imgPath]?.pxPerCm || 10;
    const tileX = margin + i * (tileW + margin);
    const tileY = margin + headerH;

    // Step Header Card
    ctx.fillStyle = '#181820';
    ctx.strokeStyle = '#2d2d3c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tileX, tileY - 24, tileW, 22, 4);
    ctx.fill();
    ctx.stroke();

    const protoName = `Step #${i + 1}`;
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(protoName, tileX + 8, tileY - 9);

    const stemName = imgPath.split(/[\\/]/).pop().split('.')[0];
    ctx.fillStyle = '#b0b0c8';
    ctx.font = '10px sans-serif';
    ctx.fillText(stemName, tileX + 70, tileY - 9);

    // Thermal Canvas Tile
    if (res?.raw?.tempMatrix && res?.shape) {
      const [H, W] = res.shape;
      const offscreen = document.createElement('canvas');
      offscreen.width = W;
      offscreen.height = H;
      const oCtx = offscreen.getContext('2d');
      const oImgData = oCtx.createImageData(W, H);

      const matrix = res.raw.tempMatrix;
      for (let p = 0; p < matrix.length; p++) {
        const t = matrix[p];
        const norm = Math.min(255, Math.max(0, Math.floor((t - 20.0) / 25.0 * 255.0)));
        oImgData.data[p * 4 + 0] = INFERNO_LUT[norm * 3 + 0];
        oImgData.data[p * 4 + 1] = INFERNO_LUT[norm * 3 + 1];
        oImgData.data[p * 4 + 2] = INFERNO_LUT[norm * 3 + 2];
        oImgData.data[p * 4 + 3] = 255;
      }
      oCtx.putImageData(oImgData, 0, 0);

      // Draw thermal image scaled to tile
      ctx.drawImage(offscreen, tileX, tileY, tileW, tileH);
      ctx.strokeStyle = '#3e3e50';
      ctx.strokeRect(tileX, tileY, tileW, tileH);

      // Scale factors from raw image to tile
      const sx = tileW / W;
      const sy = tileH / H;

      let primaryRoi = null;
      let primaryStar = null;

      // Draw ROIs and 8-Star Gradients
      rois.forEach(roi => {
        const isTarget = targetLabel === 'overall' || roi.labelName === targetLabel;
        if (!isTarget) return;

        const star = roi.star || computeLabelStarGradient(matrix, W, H, roi, scale);
        if (!primaryRoi && roi.labelName === targetLabel) {
          primaryRoi = roi;
          primaryStar = star;
        }

        // Polygon outline
        if (roi.points && roi.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(tileX + roi.points[0].x * sx, tileY + roi.points[0].y * sy);
          for (let ptIdx = 1; ptIdx < roi.points.length; ptIdx++) {
            ctx.lineTo(tileX + roi.points[ptIdx].x * sx, tileY + roi.points[ptIdx].y * sy);
          }
          ctx.closePath();
          ctx.fillStyle = `${roi.color}33`;
          ctx.fill();
          ctx.strokeStyle = roi.color || '#ff4444';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // 8-Point Star Overlay
        if (star) {
          const scx = tileX + star.cx * sx;
          const scy = tileY + star.cy * sy;
          const srx = star.radius_px * sx;
          const sry = star.radius_px * sy;

          // Incircle
          ctx.save();
          ctx.strokeStyle = roi.color || '#00e5ff';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.ellipse(scx, scy, srx, sry, 0, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();

          // 8 Spokes
          COMPASS.forEach(name => {
            const p = star.points[name];
            if (p) {
              const spX = tileX + p.px * sx;
              const spY = tileY + p.py * sy;
              ctx.lineWidth = 1.2;
              ctx.strokeStyle = p.diff >= 0 ? '#ff5252' : '#448aff';
              ctx.beginPath();
              ctx.moveTo(scx, scy);
              ctx.lineTo(spX, spY);
              ctx.stroke();
            }
          });

          // Center Dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(scx, scy, 2.5, 0, 2 * Math.PI);
          ctx.fill();

          // Badge
          ctx.fillStyle = '#0f0f13dd';
          ctx.fillRect(scx - 24, scy - sry - 14, 48, 12);
          ctx.fillStyle = '#00e5ff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${roi.labelName} [${star.dominant}]`, scx, scy - sry - 5);
          ctx.textAlign = 'left';
        }
      });

      // Footer Metric Box
      const footY = tileY + tileH + 8;
      ctx.fillStyle = '#14141c';
      ctx.strokeStyle = '#282838';
      ctx.beginPath();
      ctx.roundRect(tileX, footY, tileW, footerH - 12, 6);
      ctx.fill();
      ctx.stroke();

      const activeObj = primaryStar || (rois[0] ? (rois[0].star || computeLabelStarGradient(matrix, W, H, rois[0], scale)) : null);

      if (activeObj) {
        if (i === 0) {
          baselineCenterTemp = activeObj.temp_centre;
          baselineMeanTemp = res.temp_mean;
        }

        const deltaCenter = baselineCenterTemp !== null ? (activeObj.temp_centre - baselineCenterTemp) : 0;
        const deltaMean = baselineMeanTemp !== null ? (res.temp_mean - baselineMeanTemp) : 0;

        ctx.fillStyle = '#e8e8f2';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Center: ${activeObj.temp_centre.toFixed(2)} °C`, tileX + 10, footY + 18);
        ctx.fillText(`Mean: ${res.temp_mean.toFixed(2)} °C`, tileX + 160, footY + 18);

        // Relative delta badge
        ctx.fillStyle = deltaCenter >= 0 ? '#ff5252' : '#448aff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`ΔT vs Step 1: ${deltaCenter >= 0 ? '+' : ''}${deltaCenter.toFixed(2)} °C`, tileX + 10, footY + 38);

        ctx.fillStyle = '#00e5ff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Gradient Max: ${activeObj.gradient_max.toFixed(2)} °C/cm`, tileX + 10, footY + 58);
        ctx.fillStyle = '#ffd54f';
        ctx.fillText(`Modus: ${activeObj.gradient_modus}`, tileX + 10, footY + 76);
        ctx.fillStyle = '#8888a0';
        ctx.font = '9px monospace';
        ctx.fillText(`Radius: ${activeObj.radius_cm.toFixed(2)} cm (${scale.toFixed(1)} px/cm)`, tileX + 10, footY + 92);
      } else {
        ctx.fillStyle = '#666680';
        ctx.font = '10px sans-serif';
        ctx.fillText('No ROI label on this step', tileX + 10, footY + 24);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// ── 8-Direction Polar Radar Chart Generator (SVG) ───────────────────────────
export function generateRadarGradientSvg(labelName, series, theme = 'dark') {
  if (!series || series.length === 0) return '';

  const isDark = theme === 'dark';
  const bg = isDark ? '#0f0f13' : '#ffffff';
  const border = isDark ? '#282838' : '#e0e0e0';
  const textMain = isDark ? '#ffffff' : '#111111';
  const textSub = isDark ? '#8888a0' : '#666666';
  const gridStroke = isDark ? '#2a2a3a' : '#e2e2ec';

  const W = 680;
  const H = 540;
  const cx = 270;
  const cy = 270;
  const maxR = 190;

  // Find max gradient across all steps and compass points
  let maxGrad = 0.5;
  series.forEach(s => {
    COMPASS.forEach(name => {
      const g = s.star?.points?.[name]?.grad || 0;
      if (g > maxGrad) maxGrad = g;
    });
  });
  maxGrad = Math.ceil(maxGrad * 2) / 2; // round up to nice number e.g. 1.0, 1.5, 2.0

  const stepColors = [
    '#00e5ff', '#3d5afe', '#7c4dff', '#e040fb', '#ff4081', '#ff5252', '#ff9100', '#ffd600'
  ];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:${bg};font-family:Segoe UI,sans-serif;">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <text x="24" y="32" fill="${textMain}" font-size="16" font-weight="bold">🕸 8-Direction Polar Thermal Gradient Profile — ${labelName}</text>
  <text x="24" y="50" fill="${textSub}" font-size="11">Comparative Directional Gradient ($G_k$ in °C/cm) across Sequence Steps</text>
  <g transform="translate(0, 20)">
`;

  // Draw concentric radar circles
  const levels = 4;
  for (let l = 1; l <= levels; l++) {
    const r = (maxR / levels) * l;
    const val = ((maxGrad / levels) * l).toFixed(2);
    svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${gridStroke}" stroke-width="1" stroke-dasharray="3 3"/>\n`;
    svg += `  <text x="${cx + 4}" y="${cy - r + 10}" fill="${textSub}" font-size="9">${val} °C/cm</text>\n`;
  }

  // Draw 8 radial spokes & compass labels
  COMPASS.forEach(name => {
    const angRad = (BASE_ANGLES[name] * Math.PI) / 180.0;
    const sx = cx + maxR * Math.sin(angRad);
    const sy = cy - maxR * Math.cos(angRad);
    const lx = cx + (maxR + 18) * Math.sin(angRad);
    const ly = cy - (maxR + 18) * Math.cos(angRad);

    svg += `  <line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="${gridStroke}" stroke-width="1.2"/>\n`;
    svg += `  <text x="${lx}" y="${ly + 4}" fill="${textMain}" font-size="11" font-weight="bold" text-anchor="middle">${name}</text>\n`;
  });

  // Draw each step's polygon profile
  series.forEach((s, idx) => {
    const col = stepColors[idx % stepColors.length];
    const pointsStr = COMPASS.map(name => {
      const g = s.star?.points?.[name]?.grad || 0;
      const r = (g / maxGrad) * maxR;
      const angRad = (BASE_ANGLES[name] * Math.PI) / 180.0;
      const px = cx + r * Math.sin(angRad);
      const py = cy - r * Math.cos(angRad);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');

    svg += `  <!-- Step ${idx + 1} Polygon -->\n`;
    svg += `  <polygon points="${pointsStr}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="2"/>\n`;
    
    // Draw dots at vertices
    COMPASS.forEach(name => {
      const g = s.star?.points?.[name]?.grad || 0;
      const r = (g / maxGrad) * maxR;
      const angRad = (BASE_ANGLES[name] * Math.PI) / 180.0;
      const px = cx + r * Math.sin(angRad);
      const py = cy - r * Math.cos(angRad);
      svg += `  <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${col}"/>\n`;
    });
  });

  // Legend Card on the right
  svg += `  <g transform="translate(500, 70)">
    <rect width="160" height="${series.length * 26 + 32}" rx="6" fill="${isDark ? '#161622' : '#f4f4f8'}" stroke="${border}"/>
    <text x="12" y="20" fill="${textMain}" font-size="11" font-weight="bold">Sequence Steps:</text>
`;
  series.forEach((s, idx) => {
    const col = stepColors[idx % stepColors.length];
    const yPos = 38 + idx * 26;
    svg += `    <circle cx="18" cy="${yPos}" r="5" fill="${col}"/>
    <text x="32" y="${yPos + 4}" fill="${textMain}" font-size="10" font-weight="600">Step #${idx + 1} (${s.pictureName})</text>
`;
  });
  svg += `  </g>\n</g>\n</svg>`;

  return svg;
}

