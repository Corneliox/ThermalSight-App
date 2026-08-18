// src/src/protocol.js
/**
 * Protocol Pengambilan Gambar Thermal Kamera (by Ica)
 */

export const ICA_PROTOCOL = [
  {
    step: 1,
    sessionName: "Session 1 (0m - Rest)",
    shortLabel: "S1 (0m)",
    desc: "Rest 5 min (No pressure)",
    timestampMin: 0,
    insole: "0 mmHg",
    heating: "Off"
  },
  {
    step: 2,
    sessionName: "Session 2 (2m - 80mmHg)",
    shortLabel: "S2 (2m)",
    desc: "Treadmill 2 min, Insole 80 mmHg",
    timestampMin: 2,
    insole: "80 mmHg",
    heating: "Off"
  },
  {
    step: 3,
    sessionName: "Session 3 (4m - 160mmHg)",
    shortLabel: "S3 (4m)",
    desc: "Treadmill 2 min, Insole 160 mmHg",
    timestampMin: 4,
    insole: "160 mmHg",
    heating: "Off"
  },
  {
    step: 4,
    sessionName: "Session 4 (6m - 240mmHg)",
    shortLabel: "S4 (6m)",
    desc: "Treadmill 2 min, Insole 240 mmHg",
    timestampMin: 6,
    insole: "240 mmHg",
    heating: "Off"
  },
  {
    step: 5,
    sessionName: "Session 5 (8m - Heat L1 + 80mmHg)",
    shortLabel: "S5 (8m)",
    desc: "Treadmill 2 min, Insole 80 mmHg + Heat L1 (38-40°C)",
    timestampMin: 8,
    insole: "80 mmHg",
    heating: "Level 1 (38-40°C)"
  },
  {
    step: 6,
    sessionName: "Session 6 (10m - Heat L1 + 160mmHg)",
    shortLabel: "S6 (10m)",
    desc: "Treadmill 2 min, Insole 160 mmHg + Heat L1 (38-40°C)",
    timestampMin: 10,
    insole: "160 mmHg",
    heating: "Level 1 (38-40°C)"
  },
  {
    step: 7,
    sessionName: "Session 7 (12m - Heat L1 + 240mmHg)",
    shortLabel: "S7 (12m)",
    desc: "Treadmill 2 min, Insole 240 mmHg + Heat L1 (38-40°C)",
    timestampMin: 12,
    insole: "240 mmHg",
    heating: "Level 1 (38-40°C)"
  }
];

export const getProtocolStep = (index) => {
  if (index < ICA_PROTOCOL.length) {
    return ICA_PROTOCOL[index];
  }
  const timestampMin = index * 2;
  return {
    step: index + 1,
    sessionName: `Session ${index + 1} (${timestampMin}m)`,
    shortLabel: `S${index + 1} (${timestampMin}m)`,
    desc: `Sequence step ${index + 1} at ${timestampMin} min`,
    timestampMin,
    insole: "N/A",
    heating: "N/A"
  };
};

/**
 * Generates an SVG XML string for a given label series and theme ('dark' | 'white')
 */
export const generateGraphSvg = (labelName, series, chartTheme = 'dark') => {
  if (!series || !series.length) return '';

  let allMin = Infinity;
  let allMax = -Infinity;
  series.forEach(item => {
    if (item.min_temp < allMin) allMin = item.min_temp;
    if (item.max_temp > allMax) allMax = item.max_temp;
  });

  if (allMin === Infinity) allMin = 0;
  if (allMax === -Infinity) allMax = 100;

  const padding = (allMax - allMin) * 0.15 || 5;
  const yMin = Math.floor(allMin - padding);
  const yMax = Math.ceil(allMax + padding);

  const svgWidth  = 760;
  const svgHeight = 380;
  const margin    = { top: 40, right: 40, bottom: 70, left: 70 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const getX = (idx) => {
    if (series.length <= 1) return margin.left + plotWidth / 2;
    return margin.left + (idx / (series.length - 1)) * plotWidth;
  };

  const getY = (val) => {
    if (yMax === yMin) return margin.top + plotHeight / 2;
    return margin.top + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight;
  };

  const maxPts = series.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.max_temp).toFixed(1)}`).join(' ');
  const minPts = series.slice().reverse().map((s, idx) => {
    const origIdx = series.length - 1 - idx;
    return `${getX(origIdx).toFixed(1)},${getY(s.min_temp).toFixed(1)}`;
  }).join(' ');

  const bandPoints = `${maxPts} ${minPts}`;
  const meanPoints = series.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.mean_temp).toFixed(1)}`).join(' ');

  const isDark = chartTheme === 'dark';
  const theme = {
    bg: isDark ? '#0b0c10' : '#ffffff',
    border: isDark ? '#1f2330' : '#e5e7eb',
    grid: isDark ? '#1f2536' : '#f3f4f6',
    textMain: isDark ? '#f0f4fc' : '#111827',
    textSub: isDark ? '#8a94b8' : '#6b7280',
    line: isDark ? '#ff4444' : '#d97706',
    bandFill: isDark ? 'rgba(255, 100, 80, 0.2)' : 'rgba(245, 158, 11, 0.18)',
    bandStroke: isDark ? 'rgba(255, 100, 80, 0.45)' : 'rgba(245, 158, 11, 0.4)',
    nodeMinMax: isDark ? '#ffaa88' : '#fbbf24',
    nodeMean: isDark ? '#ff4444' : '#b45309',
    errorBar: isDark ? '#ff8866' : '#d97706',
  };

  let gridSvg = [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
    const yVal = yMin + (yMax - yMin) * (1 - pct);
    const yPos = margin.top + plotHeight * pct;
    return `
      <line x1="${margin.left}" y1="${yPos.toFixed(1)}" x2="${svgWidth - margin.right}" y2="${yPos.toFixed(1)}" stroke="${theme.grid}" stroke-dasharray="3 3"/>
      <text x="${margin.left - 10}" y="${(yPos + 4).toFixed(1)}" fill="${theme.textSub}" font-size="10" text-anchor="end" font-family="sans-serif">${yVal.toFixed(1)}°C</text>
    `;
  }).join('');

  let xAxisSvg = series.map((s, idx) => {
    const proto = getProtocolStep(idx);
    const xPos = getX(idx).toFixed(1);
    const yPos = (svgHeight - margin.bottom + 20).toFixed(1);
    return `
      <g transform="translate(${xPos}, ${yPos})">
        <text fill="${theme.textSub}" font-size="10" text-anchor="end" transform="rotate(-30)" font-family="sans-serif">${proto.shortLabel} (${s.pictureName})</text>
      </g>
    `;
  }).join('');

  let pointsSvg = series.map((s, idx) => {
    const cx = getX(idx).toFixed(1);
    const cy = getY(s.mean_temp).toFixed(1);
    const cyMin = getY(s.min_temp).toFixed(1);
    const cyMax = getY(s.max_temp).toFixed(1);
    return `
      <line x1="${cx}" y1="${cyMin}" x2="${cx}" y2="${cyMax}" stroke="${theme.errorBar}" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cyMin}" r="3" fill="${theme.nodeMinMax}"/>
      <circle cx="${cx}" cy="${cyMax}" r="3" fill="${theme.nodeMinMax}"/>
      <circle cx="${cx}" cy="${cy}" r="5" fill="${theme.nodeMean}" stroke="${theme.bg}" stroke-width="1.5"/>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:${theme.bg}">
  <rect width="100%" height="100%" fill="${theme.bg}"/>
  <text x="${margin.left}" y="24" fill="${theme.textMain}" font-size="14" font-weight="bold" font-family="sans-serif">Thermal Range Analytics: ${labelName} (${chartTheme.toUpperCase()} Theme)</text>
  ${gridSvg}
  ${xAxisSvg}
  ${series.length > 1 ? `<polygon points="${bandPoints}" fill="${theme.bandFill}" stroke="${theme.bandStroke}" stroke-width="1"/>` : ''}
  ${series.length > 1 ? `<polyline points="${meanPoints}" fill="none" stroke="${theme.line}" stroke-width="2.5"/>` : ''}
  ${pointsSvg}
</svg>`;
};
