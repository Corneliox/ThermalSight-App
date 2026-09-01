// src/src/AnalyticsView.jsx
import React, { useState, useMemo } from 'react';
import { ICA_PROTOCOL, getProtocolStep } from './protocol';
import { COMPASS, BASE_ANGLES, generateThermalDirectionSvg, generateFullSequenceComparisonCanvas } from './thermalEngine';

export default function AnalyticsView({ 
  analyticsData, 
  onClose, 
  folderPath, 
  imageList = [], 
  resultsMap = {}, 
  segmentations = {}, 
  calibrationsMap = {} 
}) {
  const labels = Object.keys(analyticsData || {});
  const [activeLabel, setActiveLabel] = useState(labels[0] || null);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'strip' | 'radar'
  const [stripTarget, setStripTarget] = useState(labels[0] || 'overall'); // 'overall' | labelName
  const [xAxisMode, setXAxisMode] = useState('raw'); // 'raw' | 'protocol'
  const [chartTheme, setChartTheme] = useState('dark'); // 'dark' | 'white'

  if (!labels.length || !activeLabel) {
    return (
      <div className="analytics-modal">
        <div className="analytics-content">
          <h3>No Labeled Data Available</h3>
          <p>Complete segmentation labeling on images first, then click "Save Label" to generate analytics.</p>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const currentStripLabel = stripTarget === 'overall' ? activeLabel : stripTarget;
  const series = analyticsData[activeLabel] || [];
  const stripSeries = analyticsData[currentStripLabel] || series;

  const baselineCenter = stripSeries[0]?.star_center_temp || stripSeries[0]?.mean_temp || 0;
  const baselineMean = stripSeries[0]?.mean_temp || 0;

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
  const svgHeight = 360;
  const margin    = { top: 35, right: 35, bottom: 65, left: 65 };
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

  const maxPts = series.map((s, idx) => `${getX(idx)},${getY(s.max_temp)}`).join(' ');
  const minPts = series.slice().reverse().map((s, idx) => {
    const origIdx = series.length - 1 - idx;
    return `${getX(origIdx)},${getY(s.min_temp)}`;
  }).join(' ');

  const bandPoints = `${maxPts} ${minPts}`;
  const meanPoints = series.map((s, idx) => `${getX(idx)},${getY(s.mean_temp)}`).join(' ');

  // Theme Styling Palette
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

  const stepColors = [
    '#00e5ff', '#3d5afe', '#7c4dff', '#e040fb', '#ff4081', '#ff5252', '#ff9100', '#ffd600'
  ];

  // Compute Max Absolute Signed Diff for 0-1 Normalized Directional Profile
  let maxAbsDiff = 0.1;
  series.forEach(s => {
    COMPASS.forEach(name => {
      const diff = s.star?.points?.[name]?.diff ?? 0;
      if (Math.abs(diff) > maxAbsDiff) maxAbsDiff = Math.abs(diff);
    });
  });
  maxAbsDiff = Math.max(0.1, maxAbsDiff);

  // Directional geometry constants
  const rCx = 260;
  const rCy = 240;
  const rMax = 160;
  const nSteps = series.length;
  const spreadDeg = nSteps > 1 ? Math.min(14, 36 / nSteps) : 0;
  const barW = Math.max(3, Math.min(10, 36 / nSteps));

  // Security: CSV escape to prevent formula injection in Excel
  const csvEsc = (val) => { const s = String(val ?? '').replace(/"/g, '""'); return /[,"\n\r=+\-@\t]/.test(s) ? `"${s}"` : s; };

  const exportSummaryCsv = () => {
    let csvContent = `step,picture_name,session_name,timestamp_min,label,mean_temp,min_temp,max_temp,std_temp,pixel_count,delta_mean_vs_step1_c,delta_center_vs_step1_c,gradient_max_c_per_cm,gradient_modus,star_center_temp,star_radius_cm\n`;
    series.forEach((s, idx) => {
      const proto = getProtocolStep(idx);
      const deltaM = (s.mean_temp - baselineMean).toFixed(4);
      const deltaC = ((s.star_center_temp || s.mean_temp) - baselineCenter).toFixed(4);
      csvContent += `${idx + 1},${csvEsc(s.pictureName)},${csvEsc(proto.sessionName)},${proto.timestampMin},${csvEsc(activeLabel)},${s.mean_temp},${s.min_temp},${s.max_temp},${s.std_temp},${s.pixel_count},${deltaM >= 0 ? '+' : ''}${deltaM},${deltaC >= 0 ? '+' : ''}${deltaC},${s.gradient_max || 0},${csvEsc(s.gradient_modus || '')},${s.star_center_temp || 0},${s.star_radius_cm || 0}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeLabel}_summary_with_deltas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSvgGraph = () => {
    const svgEl = document.getElementById('analytics-svg-element');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `graph_${activeLabel}_${chartTheme}.svg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadRadarSvg = () => {
    const svgEl = document.getElementById('radar-svg-element');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `radar_gradient_${activeLabel}_${chartTheme}.svg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="analytics-modal">
      <div className="analytics-card" style={{ maxWidth: '1080px', width: '96%' }}>
        <div className="analytics-header">
          <div>
            <h2>📈 Time-Series Thermal Range & Relative Gradient Analytics</h2>
            <p className="subtext">Comparative Progression across Sequence Steps (Step 1 to {series.length})</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕ Close</button>
        </div>

        {/* PRIMARY VIEW MODE SWITCHER */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg0)', padding: '6px', borderRadius: '8px', border: '1px solid var(--border)', margin: '10px 0 14px', flexWrap: 'wrap' }}>
          <button className={`tab-btn ${viewMode === 'graph' ? 'active' : ''}`} onClick={() => setViewMode('graph')}>
            📊 Min–Max Temperature Range Graph
          </button>
          <button className={`tab-btn ${viewMode === 'strip' ? 'active' : ''}`} onClick={() => setViewMode('strip')}>
            🖼 Multi-Step Sequence Strip (Relative Focus)
          </button>
          <button className={`tab-btn ${viewMode === 'radar' ? 'active' : ''}`} onClick={() => setViewMode('radar')}>
            🧭 8-Direction Thermal Distribution (Signed & Normalized)
          </button>
        </div>

        {/* SUB-TOOLBAR: LABELS, THEMES & TARGETS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', margin: '4px 0 12px' }}>
          {viewMode !== 'strip' ? (
            <div className="analytics-tabs" style={{ margin: 0 }}>
              {labels.map(l => (
                <button key={l} 
                        className={`tab-btn ${activeLabel === l ? 'active' : ''}`}
                        onClick={() => setActiveLabel(l)}>
                  Label: <strong style={{ marginLeft: 4 }}>{l}</strong> ({analyticsData[l].length})
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--cyan)' }}>Relative Focus:</span>
              <button className={`btn-ghost btn-tiny ${stripTarget === 'overall' ? 'active' : ''}`}
                      style={{ background: stripTarget === 'overall' ? 'var(--cyan)' : 'var(--bg1)', color: stripTarget === 'overall' ? '#000' : 'var(--text0)', fontWeight: '600' }}
                      onClick={() => setStripTarget('overall')}>
                🌐 Overall (All Labels)
              </button>
              {labels.map(l => (
                <button key={l}
                        className={`btn-ghost btn-tiny ${stripTarget === l ? 'active' : ''}`}
                        style={{ background: stripTarget === l ? 'var(--accent2)' : 'var(--bg1)', color: stripTarget === l ? '#000' : 'var(--text0)', fontWeight: '600' }}
                        onClick={() => setStripTarget(l)}>
                  🎯 Relative: {l}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {viewMode === 'graph' && (
              <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <button className={`btn-ghost btn-tiny ${xAxisMode==='raw'?'active':''}`}
                        style={{ background: xAxisMode==='raw'?'var(--bg3)':'transparent', color: xAxisMode==='raw'?'var(--cyan)':'var(--text2)' }}
                        onClick={() => setXAxisMode('raw')}>
                  📷 Raw Names
                </button>
                <button className={`btn-ghost btn-tiny ${xAxisMode==='protocol'?'active':''}`}
                        style={{ background: xAxisMode==='protocol'?'var(--bg3)':'transparent', color: xAxisMode==='protocol'?'var(--accent2)':'var(--text2)' }}
                        onClick={() => setXAxisMode('protocol')}>
                  ⏱ Protocol Steps
                </button>
              </div>
            )}

            {/* THEME SWITCHER */}
            <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button className={`btn-ghost btn-tiny ${chartTheme==='dark'?'active':''}`}
                      style={{ background: chartTheme==='dark'?'var(--bg3)':'transparent', color: chartTheme==='dark'?'#00e5ff':'var(--text2)' }}
                      onClick={() => setChartTheme('dark')}>
                🌙 Dark
              </button>
              <button className={`btn-ghost btn-tiny ${chartTheme==='white'?'active':''}`}
                      style={{ background: chartTheme==='white'?'#fff':'transparent', color: chartTheme==='white'?'#111':'var(--text2)' }}
                      onClick={() => setChartTheme('white')}>
                ☀️ White
              </button>
            </div>
          </div>
        </div>

        {/* ── VIEW 1: RANGE GRAPH ────────────────────────────────────────── */}
        {viewMode === 'graph' && (
          <div>
            <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '10px 16px', margin: '4px 0 10px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px', color: theme.textMain }}>
              <div style={{ fontWeight: '700', color: theme.textSub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Legend:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 14, height: 3, background: theme.line, display: 'inline-block', borderRadius: 2 }} />
                <span>Mean Temp (°C)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 14, height: 10, background: theme.bandFill, border: `1px solid ${theme.bandStroke}`, display: 'inline-block', borderRadius: 2 }} />
                <span>Min–Max Temp Range Band</span>
              </div>
            </div>

            <div className="analytics-plot-container" style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '12px' }}>
              <svg id="analytics-svg-element" viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%">
                <rect width={svgWidth} height={svgHeight} fill={theme.bg} />
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const val = yMin + pct * (yMax - yMin);
                  const y = getY(val);
                  return (
                    <g key={i}>
                      <line x1={margin.left} y1={y} x2={svgWidth - margin.right} y2={y} stroke={theme.grid} strokeWidth="1" strokeDasharray="3 3"/>
                      <text x={margin.left - 10} y={y + 4} fill={theme.textSub} fontSize="11" textAnchor="end">{val.toFixed(1)}°C</text>
                    </g>
                  );
                })}
                <polygon points={bandPoints} fill={theme.bandFill} stroke={theme.bandStroke} strokeWidth="1" />
                <polyline points={meanPoints} fill="none" stroke={theme.line} strokeWidth="2.5" />
                {series.map((s, idx) => {
                  const x = getX(idx);
                  const y = getY(s.mean_temp);
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r="4" fill={theme.nodeMean} stroke="#ffffff" strokeWidth="1.5" />
                      <text x={x} y={y - 8} fill={theme.textMain} fontSize="10" fontWeight="bold" textAnchor="middle">{s.mean_temp.toFixed(1)}°</text>
                    </g>
                  );
                })}
                {series.map((s, idx) => {
                  const x = getX(idx);
                  const proto = getProtocolStep(idx);
                  const label1 = xAxisMode === 'raw' ? s.pictureName : proto.sessionName;
                  const label2 = xAxisMode === 'raw' ? (proto.timestampMin !== undefined ? `${proto.timestampMin}m` : '') : `${s.pictureName}`;
                  return (
                    <g key={idx}>
                      <line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 5} stroke={theme.textSub} strokeWidth="1" />
                      <text x={x} y={margin.top + plotHeight + 20} fill={theme.textMain} fontSize="10" fontWeight="bold" textAnchor="middle">{label1}</text>
                      <text x={x} y={margin.top + plotHeight + 34} fill={theme.textSub} fontSize="9" textAnchor="middle">{label2}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* ── VIEW 2: MULTI-STEP SEQUENCE STRIP (RELATIVE FOCUS) ─────────── */}
        {viewMode === 'strip' && (
          <div style={{ background: 'var(--bg0)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text0)' }}>
                  Multi-Step Thermal Progression — Focus: {stripTarget.toUpperCase()}
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text2)' }}>
                  Side-by-side progression showing 8-point star gradient and relative ΔT vs Step 1 Baseline.
                </p>
              </div>
            </div>

            {/* REACT NATIVE SEQUENCE STRIP CARDS */}
            <div style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              paddingBottom: '12px',
              scrollbarWidth: 'thin'
            }}>
              {stripSeries.map((s, idx) => {
                const proto = getProtocolStep(idx);
                const centerVal = s.star_center_temp || s.mean_temp || 0;
                const deltaCenter = centerVal - baselineCenter;
                const deltaMean = s.mean_temp - baselineMean;

                return (
                  <div key={idx} style={{
                    minWidth: '240px',
                    maxWidth: '240px',
                    background: 'var(--bg1)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    {/* Header */}
                    <div style={{ background: 'var(--bg2)', padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--cyan)', fontWeight: 'bold', fontSize: '12px' }}>Step #{idx + 1}</span>
                      <span style={{ color: 'var(--text2)', fontSize: '10px' }}>{s.pictureName}</span>
                    </div>

                    {/* Image Area */}
                    <div style={{ height: '160px', background: '#0a0a0d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                      {s.croppedPngDataUrl ? (
                        <img src={s.croppedPngDataUrl} alt={`Step ${idx+1}`} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text2)', textAlign: 'center' }}>
                          ⚡ Thermal Matrix #{idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Protocol Tag */}
                    <div style={{ background: 'var(--bg0)', padding: '4px 8px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text1)', fontWeight: '600' }}>
                      {proto.sessionName}
                    </div>

                    {/* Footer Metrics */}
                    <div style={{ padding: '8px 10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text2)' }}>Center:</span>
                        <strong>{centerVal.toFixed(2)} °C</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text2)' }}>Mean:</span>
                        <span>{s.mean_temp.toFixed(2)} °C</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg0)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-h)' }}>
                        <span style={{ color: 'var(--cyan)', fontWeight: '600' }}>ΔT vs Step 1:</span>
                        <strong style={{ color: deltaCenter >= 0 ? '#ff5252' : '#448aff' }}>
                          {idx === 0 ? 'Baseline' : `${deltaCenter >= 0 ? '+' : ''}${deltaCenter.toFixed(2)} °C`}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ color: 'var(--accent2)' }}>G_max:</span>
                        <strong>{s.gradient_max !== undefined ? `${s.gradient_max.toFixed(2)} °C/cm` : '-'}</strong>
                      </div>
                      {s.gradient_modus && (
                        <div style={{ fontSize: '10px', color: 'var(--cyan)' }}>
                          Modus: <strong>{s.gradient_modus}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VIEW 3: 8-COMPASS SIGNED DIRECTIONAL THERMAL DISTRIBUTION ───── */}
        {viewMode === 'radar' && (
          <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: theme.textMain }}>
                  🧭 8-Direction Thermal Distribution (Signed & 0–1 Normalized) — {activeLabel.toUpperCase()}
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: theme.textSub }}>
                  Directional ΔT (edge − center) normalized 0–1 across steps · Scale max: ±{maxAbsDiff.toFixed(2)} °C
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '10px' }}>
                  <span style={{ color: '#ff5252', fontWeight: '600' }}>🔴 Red: Edge hotter than center (+ΔT)</span>
                  <span style={{ color: '#448aff', fontWeight: '600' }}>🔵 Blue: Edge cooler than center (−ΔT)</span>
                </div>
              </div>
              <button className="btn-secondary btn-tiny" onClick={downloadRadarSvg}>
                📥 Download Chart SVG
              </button>
            </div>

            {/* PURE REACT SVG SIGNED DIRECTION COMPONENT */}
            <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
              <svg id="radar-svg-element" viewBox="0 0 700 520" width="700" height="520" style={{ background: theme.bg }}>
                <g transform="translate(0, 20)">
                  {/* Concentric normalized grid circles */}
                  {[1, 2, 3, 4].map(l => {
                    const r = (rMax / 4) * l;
                    const normLabel = (l / 4).toFixed(2);
                    const absVal = ((l / 4) * maxAbsDiff).toFixed(2);
                    return (
                      <g key={l}>
                        <circle cx={rCx} cy={rCy} r={r} fill="none" stroke={theme.grid} strokeWidth="1" strokeDasharray="3 3"/>
                        <text x={rCx + 5} y={rCy - r + 10} fill={theme.textSub} fontSize="8">{normLabel} (±{absVal}°C)</text>
                      </g>
                    );
                  })}

                  {/* Center Origin Dot */}
                  <circle cx={rCx} cy={rCy} r={5} fill={isDark ? '#2a2a3a' : '#e0e0e0'} stroke={theme.textSub} strokeWidth={1}/>
                  <text x={rCx + 8} y={rCy + 3} fill={theme.textSub} fontSize="8">center</text>

                  {/* 8 Radial Spokes & Compass Labels */}
                  {COMPASS.map(name => {
                    const angRad = (BASE_ANGLES[name] * Math.PI) / 180.0;
                    const sx = rCx + (rMax + 6) * Math.sin(angRad);
                    const sy = rCy - (rMax + 6) * Math.cos(angRad);
                    const lx = rCx + (rMax + 22) * Math.sin(angRad);
                    const ly = rCy - (rMax + 22) * Math.cos(angRad);
                    return (
                      <g key={name}>
                        <line x1={rCx} y1={rCy} x2={sx} y2={sy} stroke={theme.grid} strokeWidth="0.8"/>
                        <text x={lx} y={ly + 4} fill={theme.textMain} fontSize="11" fontWeight="bold" textAnchor="middle">{name}</text>
                      </g>
                    );
                  })}

                  {/* Directional Signed Bars for Each Step */}
                  {series.map((s, idx) => {
                    const col = stepColors[idx % stepColors.length];
                    return (
                      <g key={idx}>
                        {COMPASS.map(name => {
                          const diff = s.star?.points?.[name]?.diff ?? 0;
                          const normVal = Math.abs(diff) / maxAbsDiff;
                          const barLen = Math.max(3, normVal * rMax);
                          const stepOffset = nSteps > 1 ? -spreadDeg / 2 + (spreadDeg * idx / (nSteps - 1)) : 0;
                          const angRad = ((BASE_ANGLES[name] + stepOffset) * Math.PI) / 180.0;
                          const endX = rCx + barLen * Math.sin(angRad);
                          const endY = rCy - barLen * Math.cos(angRad);
                          const barColor = diff >= 0 ? '#ff5252' : '#448aff';

                          return (
                            <g key={name}>
                              <line x1={rCx} y1={rCy} x2={endX} y2={endY} stroke={barColor} strokeWidth={barW} strokeOpacity={0.65} strokeLinecap="round"/>
                              <circle cx={endX} cy={endY} r={Math.max(3, barW / 2 + 1)} fill={col} stroke={barColor} strokeWidth={1.5}/>
                              {nSteps <= 3 && (
                                <text x={endX + 6 * Math.sin(angRad)} y={endY - 6 * Math.cos(angRad) + 3} fill={barColor} fontSize="8" fontWeight="bold" textAnchor="middle">
                                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Legend Box */}
                  <g transform="translate(480, 30)">
                    <rect width="190" height={series.length * 26 + 84} rx="8" fill={isDark ? '#14141e' : '#f8f8fc'} stroke={theme.border} strokeWidth="1"/>
                    <text x="14" y="20" fill={theme.textMain} fontSize="11" fontWeight="bold">Sequence Steps:</text>
                    {series.map((s, idx) => {
                      const col = stepColors[idx % stepColors.length];
                      const yPos = 38 + idx * 26;
                      return (
                        <g key={idx}>
                          <circle cx="20" cy={yPos} r="5" fill={col}/>
                          <text x="34" y={yPos + 4} fill={theme.textMain} fontSize="10" fontWeight="600">
                            Step #{idx + 1} ({s.pictureName})
                          </text>
                        </g>
                      );
                    })}

                    {/* Diverging Bar Key */}
                    <rect x="10" y={44 + series.length * 26} width="170" height="1" fill={theme.grid}/>
                    <line x1="14" y1={58 + series.length * 26} x2="32" y2={58 + series.length * 26} stroke="#ff5252" strokeWidth="4" strokeLinecap="round"/>
                    <text x="38" y={62 + series.length * 26} fill={theme.textSub} fontSize="9">Edge hotter (+ΔT)</text>
                    <line x1="14" y1={74 + series.length * 26} x2="32" y2={74 + series.length * 26} stroke="#448aff" strokeWidth="4" strokeLinecap="round"/>
                    <text x="38" y={78 + series.length * 26} fill={theme.textSub} fontSize="9">Edge cooler (−ΔT)</text>
                  </g>
                </g>
              </svg>
            </div>
          </div>
        )}

        {/* FULL DATA SUMMARY TABLE WITH RELATIVE DELTAS */}
        <div className="analytics-table-wrap" style={{ marginTop: '14px' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Image Name</th>
                <th>Protocol Session</th>
                <th>Avg Temp (°C)</th>
                <th>ΔT Mean (vs Step 1)</th>
                <th>Center (°C)</th>
                <th>ΔT Center (vs Step 1)</th>
                <th>Gradient Max (°C/cm)</th>
                <th>Gradient Modus</th>
                <th>Min / Max</th>
                <th>Pixels</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, i) => {
                const proto = getProtocolStep(i);
                const deltaMean = s.mean_temp - baselineMean;
                const centerVal = s.star_center_temp || s.mean_temp;
                const deltaCenter = centerVal - baselineCenter;
                return (
                  <tr key={i}>
                    <td><strong style={{ color: 'var(--cyan)' }}>#{i + 1}</strong></td>
                    <td><strong>{s.pictureName}</strong></td>
                    <td>
                      <div style={{ fontSize: '11px', color: 'var(--text0)', fontWeight: '600' }}>{proto.sessionName}</div>
                    </td>
                    <td className="temp-avg">{(s.mean_temp ?? 0).toFixed(2)}</td>
                    <td style={{ color: deltaMean >= 0 ? 'var(--accent)' : 'var(--cyan)', fontWeight: 'bold' }}>
                      {i === 0 ? 'Baseline' : `${deltaMean >= 0 ? '+' : ''}${deltaMean.toFixed(2)}°C`}
                    </td>
                    <td>{centerVal.toFixed(2)}</td>
                    <td style={{ color: deltaCenter >= 0 ? 'var(--accent)' : 'var(--cyan)', fontWeight: 'bold' }}>
                      {i === 0 ? 'Baseline' : `${deltaCenter >= 0 ? '+' : ''}${deltaCenter.toFixed(2)}°C`}
                    </td>
                    <td style={{ color: 'var(--accent2)', fontWeight: '600' }}>{s.gradient_max !== undefined ? s.gradient_max.toFixed(2) : '-'}</td>
                    <td style={{ color: 'var(--cyan)', fontSize: '11px' }}>{s.gradient_modus || '-'}</td>
                    <td style={{ fontSize: '10px' }}>{(s.min_temp ?? 0).toFixed(1)} / {(s.max_temp ?? 0).toFixed(1)}</td>
                    <td>{s.pixel_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ACTION BUTTONS */}
        <div className="analytics-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={exportSummaryCsv}>
              📄 Export {activeLabel} Summary + Deltas (CSV)
            </button>
            <button className="btn-secondary" onClick={downloadSvgGraph}>
              🎨 Download {chartTheme.toUpperCase()} Range SVG
            </button>
            <button className="btn-secondary" onClick={downloadRadarSvg}>
              🕸 Download Radar SVG
            </button>
          </div>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
