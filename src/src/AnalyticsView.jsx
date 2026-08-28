// src/src/AnalyticsView.jsx
import React, { useState, useMemo } from 'react';
import { ICA_PROTOCOL, getProtocolStep } from './protocol';
import { COMPASS, BASE_ANGLES, generateRadarGradientSvg, generateFullSequenceComparisonCanvas } from './thermalEngine';

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
  const [stripTarget, setStripTarget] = useState('overall'); // 'overall' | labelName
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

  const series = analyticsData[activeLabel] || [];
  const baselineCenter = series[0]?.star_center_temp || series[0]?.mean_temp || 0;
  const baselineMean = series[0]?.mean_temp || 0;

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

  // Generate Sequence Montage DataURL on the fly
  const sequenceMontageDataUrl = useMemo(() => {
    if (!imageList || imageList.length === 0) return null;
    return generateFullSequenceComparisonCanvas(imageList, resultsMap, segmentations, calibrationsMap, stripTarget);
  }, [imageList, resultsMap, segmentations, calibrationsMap, stripTarget]);

  // Generate Radar SVG XML
  const radarSvgXml = useMemo(() => {
    return generateRadarGradientSvg(activeLabel, series, chartTheme);
  }, [activeLabel, series, chartTheme]);

  const exportSummaryCsv = () => {
    let csvContent = `step,picture_name,session_name,timestamp_min,label,mean_temp,min_temp,max_temp,std_temp,pixel_count,delta_mean_vs_step1_c,delta_center_vs_step1_c,gradient_max_c_per_cm,gradient_modus,star_center_temp,star_radius_cm\n`;
    series.forEach((s, idx) => {
      const proto = getProtocolStep(idx);
      const deltaM = (s.mean_temp - baselineMean).toFixed(4);
      const deltaC = ((s.star_center_temp || s.mean_temp) - baselineCenter).toFixed(4);
      csvContent += `${idx + 1},${s.pictureName},"${proto.sessionName}",${proto.timestampMin},${activeLabel},${s.mean_temp},${s.min_temp},${s.max_temp},${s.std_temp},${s.pixel_count},${deltaM >= 0 ? '+' : ''}${deltaM},${deltaC >= 0 ? '+' : ''}${deltaC},${s.gradient_max || 0},"${s.gradient_modus || ''}",${s.star_center_temp || 0},${s.star_radius_cm || 0}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeLabel}_summary_with_deltas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  };

  const downloadMontagePng = () => {
    if (!sequenceMontageDataUrl) return;
    const link = document.createElement('a');
    link.href = sequenceMontageDataUrl;
    link.setAttribute('download', `comparison_relative_${stripTarget}_sequence.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadRadarSvg = () => {
    if (!radarSvgXml) return;
    const blob = new Blob([radarSvgXml], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `radar_gradient_${activeLabel}_${chartTheme}.svg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-modal">
      <div className="analytics-card" style={{ maxWidth: '980px', width: '95%' }}>
        <div className="analytics-header">
          <div>
            <h2>📈 Time-Series Thermal Range & Relative Gradient Analytics</h2>
            <p className="subtext">Comparative Analysis across Sequence Steps (Step 1 to {series.length})</p>
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
            🕸 8-Compass Polar Radar Profile
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
                🌐 Overall (All ROIs)
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
          <div style={{ background: 'var(--bg0)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                Full thermal context sequence with relative gradient focus on <strong>{stripTarget.toUpperCase()}</strong>.
              </span>
              <button className="btn-secondary btn-tiny" onClick={downloadMontagePng}>
                📥 Download {stripTarget.toUpperCase()} Sequence PNG
              </button>
            </div>
            {sequenceMontageDataUrl ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-h)', borderRadius: '6px', maxHeight: '420px', background: '#0a0a0d' }}>
                <img src={sequenceMontageDataUrl} alt="Sequence Strip" style={{ height: '390px', width: 'auto', display: 'block' }} />
              </div>
            ) : (
              <p className="subtext">Load full image sequences to generate multi-step montage.</p>
            )}
          </div>
        )}

        {/* ── VIEW 3: 8-COMPASS POLAR RADAR PROFILE ───────────────────────── */}
        {viewMode === 'radar' && (
          <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: theme.textSub }}>
                Overlaid directional gradient profiles ($G_k$ in °C/cm) across all steps for <strong>{activeLabel}</strong>.
              </span>
              <button className="btn-secondary btn-tiny" onClick={downloadRadarSvg}>
                📥 Download {activeLabel} Radar SVG
              </button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: radarSvgXml }} style={{ display: 'flex', justifyContent: 'center' }} />
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
                    <td className="temp-avg">{s.mean_temp.toFixed(2)}</td>
                    <td style={{ color: deltaMean >= 0 ? 'var(--accent)' : 'var(--cyan)', fontWeight: 'bold' }}>
                      {i === 0 ? 'Baseline' : `${deltaMean >= 0 ? '+' : ''}${deltaMean.toFixed(2)}°C`}
                    </td>
                    <td>{centerVal.toFixed(2)}</td>
                    <td style={{ color: deltaCenter >= 0 ? 'var(--accent)' : 'var(--cyan)', fontWeight: 'bold' }}>
                      {i === 0 ? 'Baseline' : `${deltaCenter >= 0 ? '+' : ''}${deltaCenter.toFixed(2)}°C`}
                    </td>
                    <td style={{ color: 'var(--accent2)', fontWeight: '600' }}>{s.gradient_max !== undefined ? s.gradient_max.toFixed(2) : '-'}</td>
                    <td style={{ color: 'var(--cyan)', fontSize: '11px' }}>{s.gradient_modus || '-'}</td>
                    <td style={{ fontSize: '10px' }}>{s.min_temp.toFixed(1)} / {s.max_temp.toFixed(1)}</td>
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
            <button className="btn-secondary" onClick={downloadMontagePng}>
              🖼 Download Sequence Strip PNG
            </button>
          </div>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
