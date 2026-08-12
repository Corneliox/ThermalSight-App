import React, { useState } from 'react';

export default function AnalyticsView({ analyticsData, onClose }) {
  const labels = Object.keys(analyticsData || {});
  const [activeLabel, setActiveLabel] = useState(labels[0] || null);

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

  const padding = (allMax - allMin) * 0.1 || 5;
  const yMin = Math.floor(allMin - padding);
  const yMax = Math.ceil(allMax + padding);

  const svgWidth  = 720;
  const svgHeight = 340;
  const margin    = { top: 30, right: 30, bottom: 50, left: 60 };
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

  const exportSummaryCsv = () => {
    let csvContent = `picture_name,label,mean_temp,min_temp,max_temp,std_temp,pixel_count\n`;
    series.forEach(s => {
      csvContent += `${s.pictureName},${activeLabel},${s.mean_temp},${s.min_temp},${s.max_temp},${s.std_temp},${s.pixel_count}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `summary_${activeLabel}_time_series.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-modal">
      <div className="analytics-card">
        <div className="analytics-header">
          <div>
            <h2>📈 Time-Series Thermal Range Analytics</h2>
            <p className="subtext">Average temperature trend surrounded by Min–Max temperature range band</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕ Close</button>
        </div>

        <div className="analytics-tabs">
          {labels.map(l => (
            <button key={l} 
                    className={`tab-btn ${activeLabel === l ? 'active' : ''}`}
                    onClick={() => setActiveLabel(l)}>
              Label: <strong style={{ marginLeft: 4 }}>{l}</strong> ({analyticsData[l].length} images)
            </button>
          ))}
        </div>

        <div className="chart-container">
          <svg width={svgWidth} height={svgHeight} className="analytics-svg">
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = yMin + (yMax - yMin) * (1 - pct);
              const yPos = margin.top + plotHeight * pct;
              return (
                <g key={i}>
                  <line x1={margin.left} y1={yPos} x2={svgWidth - margin.right} y2={yPos}
                        stroke="#2a2a3a" strokeDasharray="3 3"/>
                  <text x={margin.left - 10} y={yPos + 4} fill="#888" fontSize="10" textAnchor="end">
                    {yVal.toFixed(1)}°C
                  </text>
                </g>
              );
            })}

            {series.map((s, idx) => (
              <g key={idx} transform={`translate(${getX(idx)}, ${svgHeight - margin.bottom + 18})`}>
                <text fill="#aaa" fontSize="10" textAnchor="end" transform="rotate(-30)">
                  {s.pictureName.length > 12 ? s.pictureName.substring(0, 10) + '…' : s.pictureName}
                </text>
              </g>
            ))}

            {series.length > 1 && (
              <polygon points={bandPoints} fill="rgba(255, 100, 80, 0.2)" stroke="rgba(255, 100, 80, 0.4)" strokeWidth="1"/>
            )}

            {series.length > 1 && (
              <polyline points={meanPoints} fill="none" stroke="#ff4444" strokeWidth="2.5"/>
            )}

            {series.map((s, idx) => {
              const cx = getX(idx);
              const cy = getY(s.mean_temp);
              const cyMin = getY(s.min_temp);
              const cyMax = getY(s.max_temp);

              return (
                <g key={idx} className="chart-point-group">
                  <line x1={cx} y1={cyMin} x2={cx} y2={cyMax} stroke="#ff8866" strokeWidth="1.5"/>
                  <circle cx={cx} cy={cyMin} r="3" fill="#ffaa88"/>
                  <circle cx={cx} cy={cyMax} r="3" fill="#ffaa88"/>
                  <circle cx={cx} cy={cy} r="5" fill="#ff4444" stroke="#ffffff" strokeWidth="1.5"/>
                  <title>{`${s.pictureName}\nMean: ${s.mean_temp.toFixed(2)} °C\nMin: ${s.min_temp.toFixed(2)} °C\nMax: ${s.max_temp.toFixed(2)} °C`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Step / Image</th>
                <th>Avg Temp (°C)</th>
                <th>Min Temp (°C)</th>
                <th>Max Temp (°C)</th>
                <th>Std Dev</th>
                <th>Pixels</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, i) => (
                <tr key={i}>
                  <td><strong>{s.pictureName}</strong></td>
                  <td className="temp-avg">{s.mean_temp.toFixed(2)}</td>
                  <td>{s.min_temp.toFixed(2)}</td>
                  <td>{s.max_temp.toFixed(2)}</td>
                  <td>±{s.std_temp.toFixed(2)}</td>
                  <td>{s.pixel_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="analytics-footer">
          <button className="btn-secondary" onClick={exportSummaryCsv}>
            📄 Export {activeLabel} Summary CSV
          </button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
