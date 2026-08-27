// src/src/AnalyticsView.jsx
import React, { useState } from 'react';
import { ICA_PROTOCOL, getProtocolStep } from './protocol';

export default function AnalyticsView({ analyticsData, onClose, folderPath }) {
  const labels = Object.keys(analyticsData || {});
  const [activeLabel, setActiveLabel] = useState(labels[0] || null);
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

  const exportSummaryCsv = () => {
    let csvContent = `step,picture_name,session_name,timestamp_min,label,mean_temp,min_temp,max_temp,std_temp,pixel_count,gradient_max_c_per_cm,gradient_modus,star_center_temp,star_radius_cm\n`;
    series.forEach((s, idx) => {
      const proto = getProtocolStep(idx);
      csvContent += `${idx + 1},${s.pictureName},"${proto.sessionName}",${proto.timestampMin},${activeLabel},${s.mean_temp},${s.min_temp},${s.max_temp},${s.std_temp},${s.pixel_count},${s.gradient_max || 0},"${s.gradient_modus || ''}",${s.star_center_temp || 0},${s.star_radius_cm || 0}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeLabel}_summary.csv`);
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

  return (
    <div className="analytics-modal">
      <div className="analytics-card" style={{ maxWidth: '920px' }}>
        <div className="analytics-header">
          <div>
            <h2>📈 Time-Series Thermal Range Analytics</h2>
            <p className="subtext">Min-Max Temperature Band & Mean Thermal Gradient Analysis</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕ Close</button>
        </div>

        {/* CONTROLS TOOLBAR: LABELS, X-AXIS MODES & THEMES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', margin: '12px 0' }}>
          <div className="analytics-tabs" style={{ margin: 0 }}>
            {labels.map(l => (
              <button key={l} 
                      className={`tab-btn ${activeLabel === l ? 'active' : ''}`}
                      onClick={() => setActiveLabel(l)}>
                Label: <strong style={{ marginLeft: 4 }}>{l}</strong> ({analyticsData[l].length})
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* X-AXIS MODE SELECTOR */}
            <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button className={`btn-ghost btn-tiny ${xAxisMode==='raw'?'active':''}`}
                      style={{ background: xAxisMode==='raw'?'var(--bg3)':'transparent', color: xAxisMode==='raw'?'var(--cyan)':'var(--text2)' }}
                      onClick={() => setXAxisMode('raw')}>
                📷 Raw Image Names
              </button>
              <button className={`btn-ghost btn-tiny ${xAxisMode==='protocol'?'active':''}`}
                      style={{ background: xAxisMode==='protocol'?'var(--bg3)':'transparent', color: xAxisMode==='protocol'?'var(--accent2)':'var(--text2)' }}
                      onClick={() => setXAxisMode('protocol')}>
                ⏱ Protocol Sessions (Ica 2m)
              </button>
            </div>

            {/* THEME SWITCHER */}
            <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button className={`btn-ghost btn-tiny ${chartTheme==='dark'?'active':''}`}
                      style={{ background: chartTheme==='dark'?'var(--bg3)':'transparent', color: chartTheme==='dark'?'#00e5ff':'var(--text2)' }}
                      onClick={() => setChartTheme('dark')}>
                🌙 Dark Theme
              </button>
              <button className={`btn-ghost btn-tiny ${chartTheme==='white'?'active':''}`}
                      style={{ background: chartTheme==='white'?'#fff':'transparent', color: chartTheme==='white'?'#111':'var(--text2)' }}
                      onClick={() => setChartTheme('white')}>
                ☀️ White Theme
              </button>
            </div>
          </div>
        </div>

        {/* VISUAL LEGEND CARD */}
        <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '10px 16px', margin: '8px 0 14px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px', color: theme.textMain }}>
          <div style={{ fontWeight: '700', color: theme.textSub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Legend:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 3, background: theme.line, display: 'inline-block', borderRadius: 2 }} />
            <span>Mean Temp (°C)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 10, background: theme.bandFill, border: `1px solid ${theme.bandStroke}`, display: 'inline-block', borderRadius: 2 }} />
            <span>Min–Max Temp Range Band</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.nodeMinMax, display: 'inline-block' }} />
            <span>Min/Max Extreme Nodes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: theme.textSub, fontFamily: 'var(--font-mono)' }}>Mode:</span>
            <span style={{ fontWeight: '600', color: xAxisMode==='protocol'?'#ffbb00':'#00e5ff' }}>
              {xAxisMode === 'protocol' ? '⏱ Ica 7-Step Treadmill Protocol' : '📷 File Image Names'}
            </span>
          </div>
        </div>

        {/* SVG TIME-SERIES GRAPH */}
        <div className="chart-container" style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '12px' }}>
          <svg id="analytics-svg-element" width={svgWidth} height={svgHeight} className="analytics-svg" style={{ background: theme.bg }}>
            {/* Y-Axis Grid Lines & Temperature Scale */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = yMin + (yMax - yMin) * (1 - pct);
              const yPos = margin.top + plotHeight * pct;
              return (
                <g key={i}>
                  <line x1={margin.left} y1={yPos} x2={svgWidth - margin.right} y2={yPos}
                        stroke={theme.grid} strokeDasharray="3 3"/>
                  <text x={margin.left - 10} y={yPos + 4} fill={theme.textSub} fontSize="10" textAnchor="end" fontFamily="sans-serif">
                    {yVal.toFixed(1)}°C
                  </text>
                </g>
              );
            })}

            {/* X-Axis Labels (Raw Image Names vs Protocol Sessions) */}
            {series.map((s, idx) => {
              const proto = getProtocolStep(idx);
              const labelText = xAxisMode === 'protocol' ? proto.shortLabel : (s.pictureName.length > 12 ? s.pictureName.substring(0, 10) + '…' : s.pictureName);

              return (
                <g key={idx} transform={`translate(${getX(idx)}, ${svgHeight - margin.bottom + 18})`}>
                  <text fill={theme.textSub} fontSize="10" textAnchor="end" transform="rotate(-30)" fontFamily="sans-serif">
                    {labelText}
                  </text>
                </g>
              );
            })}

            {/* Min-Max Temperature Range Band */}
            {series.length > 1 && (
              <polygon points={bandPoints} fill={theme.bandFill} stroke={theme.bandStroke} strokeWidth="1"/>
            )}

            {/* Mean Temperature Line */}
            {series.length > 1 && (
              <polyline points={meanPoints} fill="none" stroke={theme.line} strokeWidth="2.5"/>
            )}

            {/* Data Point Group: Min/Max Whisker Error Bars & Mean Circle */}
            {series.map((s, idx) => {
              const cx = getX(idx);
              const cy = getY(s.mean_temp);
              const cyMin = getY(s.min_temp);
              const cyMax = getY(s.max_temp);
              const proto = getProtocolStep(idx);

              return (
                <g key={idx} className="chart-point-group">
                  <line x1={cx} y1={cyMin} x2={cx} y2={cyMax} stroke={theme.errorBar} strokeWidth="1.5"/>
                  <circle cx={cx} cy={cyMin} r="3" fill={theme.nodeMinMax}/>
                  <circle cx={cx} cy={cyMax} r="3" fill={theme.nodeMinMax}/>
                  <circle cx={cx} cy={cy} r="5" fill={theme.nodeMean} stroke={theme.bg} strokeWidth="1.5"/>
                  <title>{`Step ${idx + 1}: ${proto.sessionName}\nFile: ${s.pictureName}\nMean: ${s.mean_temp.toFixed(2)} °C\nMin: ${s.min_temp.toFixed(2)} °C\nMax: ${s.max_temp.toFixed(2)} °C\nInsole: ${proto.insole} | Heating: ${proto.heating}`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* FULL DATA SUMMARY TABLE */}
        <div className="analytics-table-wrap" style={{ marginTop: '14px' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Image Name</th>
                <th>Protocol Session & Condition</th>
                <th>Avg Temp (°C)</th>
                <th>Min Temp (°C)</th>
                <th>Max Temp (°C)</th>
                <th>Gradient Max (°C/cm)</th>
                <th>Gradient Modus</th>
                <th>Center (°C)</th>
                <th>Std Dev</th>
                <th>Pixels</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, i) => {
                const proto = getProtocolStep(i);
                return (
                  <tr key={i}>
                    <td><strong style={{ color: 'var(--cyan)' }}>#{i + 1}</strong></td>
                    <td><strong>{s.pictureName}</strong></td>
                    <td>
                      <div style={{ fontSize: '11px', color: 'var(--text0)', fontWeight: '600' }}>{proto.sessionName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text2)' }}>{proto.desc}</div>
                    </td>
                    <td className="temp-avg">{s.mean_temp.toFixed(2)}</td>
                    <td>{s.min_temp.toFixed(2)}</td>
                    <td>{s.max_temp.toFixed(2)}</td>
                    <td style={{ color: 'var(--accent2)', fontWeight: '600' }}>{s.gradient_max !== undefined ? s.gradient_max.toFixed(2) : '-'}</td>
                    <td style={{ color: 'var(--cyan)', fontSize: '11px' }}>{s.gradient_modus || '-'}</td>
                    <td>{s.star_center_temp !== undefined ? s.star_center_temp.toFixed(2) : '-'}</td>
                    <td>±{s.std_temp.toFixed(2)}</td>
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
              📄 Export {activeLabel} CSV
            </button>
            <button className="btn-secondary" onClick={downloadSvgGraph}>
              🎨 Download {chartTheme.toUpperCase()} SVG Graph
            </button>
          </div>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
