import React, { useState, useRef } from 'react';
import './App.css';

let ipcRenderer;
try {
  ipcRenderer = window.require('electron').ipcRenderer;
} catch (e) {
  ipcRenderer = { invoke: async () => { throw new Error('Electron IPC unavailable'); } };
}

const toFileUrl = (p) => {
  if (!p) return '';
  const s = p.replace(/\\/g, '/');
  return s.startsWith('/') ? `file://${s}` : `file:///${s}`;
};

const PANELS = [
  { key: 'original',   label: 'Temperature',   icon: '🌡' },
  { key: 'magnitude',  label: 'Gradient Mag',  icon: '〰' },
  { key: 'mag_thresh', label: 'Strong Edges',  icon: '⚡' },
  { key: 'angle',      label: 'Flow Angle',    icon: '🧭' },
  { key: 'overlay',    label: 'Overlay',       icon: '🔲' },
  { key: 'quiver',     label: 'Quiver',        icon: '↗'  },
  { key: 'grid',       label: 'Full Grid',     icon: '⊞'  },
];

// 8 compass directions matching Python COMPASS list order
const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];
const BASE_ANGLES = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };

// diff colour: blue = negative (cooler), red = positive (warmer)
const diffColor = (diff) => {
  if (diff === undefined) return '#888';
  const abs = Math.min(Math.abs(diff), 5);
  const t   = abs / 5;
  if (diff < 0) return `rgba(100,160,255,${0.4 + t*0.6})`;
  if (diff > 0) return `rgba(255,100,80,${0.4 + t*0.6})`;
  return '#888';
};

export default function App() {
  const [filePath,      setFilePath]      = useState(null);
  const [isProcessing,  setIsProcessing]  = useState(null);
  const [results,       setResults]       = useState(null);
  const [activePanel,   setActivePanel]   = useState('original');
  const [imgTs,         setImgTs]         = useState(0);

  // calibration
  const [calibMode,     setCalibMode]     = useState('idle');
  const [calibPt1,      setCalibPt1]      = useState(null);
  const [calibPt2,      setCalibPt2]      = useState(null);
  const [pxPerCm,       setPxPerCm]       = useState(null);
  const [calibDist,     setCalibDist]     = useState('10');
  const [showDistInput, setShowDistInput] = useState(false);

  // star measurement
  const [starMode,      setStarMode]      = useState(false);
  const [starDist,      setStarDist]      = useState('2.0');
  const [starRotation,  setStarRotation]  = useState(0);
  const [starOverlay,   setStarOverlay]   = useState(null); // { cx%, cy%, points[] }
  const [starResults,   setStarResults]   = useState(null);

  const imgRef = useRef(null);

  // ── pixel + % coords from mouse event ──────────────────────────────────────
  const getCoords = (e) => {
    const img  = imgRef.current;
    if (!img || !results) return null;
    const rect = img.getBoundingClientRect();
    return {
      px:  (e.clientX - rect.left) * (results.shape[1] / rect.width),
      py:  (e.clientY - rect.top)  * (results.shape[0] / rect.height),
      pct: {
        x: ((e.clientX - rect.left) / rect.width)  * 100,
        y: ((e.clientY - rect.top)  / rect.height) * 100,
      },
    };
  };

  // ── file ────────────────────────────────────────────────────────────────────
  const handleDrop   = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFilePath(f.path); };
  const handleBrowse = async () => { const p = await ipcRenderer.invoke('open-file-dialog'); if (p) setFilePath(p); };

  // ── analysis ────────────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!filePath) return;
    setIsProcessing('analysis');
    try {
      const res = await ipcRenderer.invoke('run-analysis', filePath, filePath + '_analysis');
      setResults(res);
      setImgTs(Date.now());
      setActivePanel('original');
      resetCalib(); setStarOverlay(null); setStarResults(null);
    } catch (err) { alert(`Analysis failed:\n${err}`); }
    setIsProcessing(null);
  };

  // ── calibration ─────────────────────────────────────────────────────────────
  const resetCalib = () => { setCalibMode('idle'); setCalibPt1(null); setCalibPt2(null); setShowDistInput(false); };
  const startCalib = () => { resetCalib(); setPxPerCm(null); setCalibMode('pt1'); };
  const confirmCalib = () => {
    if (!calibPt1 || !calibPt2) return;
    const d = Math.hypot(calibPt2.px - calibPt1.px, calibPt2.py - calibPt1.py);
    const cm = parseFloat(calibDist);
    if (!cm || cm <= 0) { alert('Enter a valid distance > 0'); return; }
    setPxPerCm(d / cm);
    setShowDistInput(false); setCalibMode('idle');
  };

  // ── compute star overlay positions in % for SVG ─────────────────────────────
  const buildStarOverlay = (cx_px, cy_px, dist_px, rot_deg, shape) => {
    const [H, W] = shape;
    const pts = {};
    COMPASS.forEach(name => {
      const angle = (BASE_ANGLES[name] + rot_deg) * Math.PI / 180;
      const px = cx_px + dist_px * Math.sin(angle);
      const py = cy_px - dist_px * Math.cos(angle);
      pts[name] = { pct: { x: (px/W)*100, y: (py/H)*100 }, px, py };
    });
    return {
      cx: (cx_px / W) * 100,
      cy: (cy_px / H) * 100,
      points: pts,
    };
  };

  // ── image click ─────────────────────────────────────────────────────────────
  const handleImageClick = async (e) => {
    const c = getCoords(e);
    if (!c) return;

    if (calibMode === 'pt1') { setCalibPt1(c); setCalibMode('pt2'); return; }
    if (calibMode === 'pt2') { setCalibPt2(c); setCalibMode('idle'); setShowDistInput(true); return; }

    if (starMode) {
      if (!pxPerCm) { alert('Calibrate first!'); setStarMode(false); return; }
      const dist_cm = parseFloat(starDist) || 2.0;
      const dist_px = dist_cm * pxPerCm;
      const rot     = parseFloat(starRotation) || 0;

      // draw overlay immediately
      const ov = buildStarOverlay(c.px, c.py, dist_px, rot, results.shape);
      setStarOverlay({ ...ov, cx_px: c.px, cy_px: c.py });
      setStarMode(false);
      setIsProcessing('star');

      try {
        const res = await ipcRenderer.invoke(
          'measure-star', filePath, c.px, c.py,
          dist_cm, rot, pxPerCm, results.out_dir
        );
        setStarResults(res);
      } catch (err) { alert(`Star failed:\n${err}`); }
      setIsProcessing(null);
    }
  };

  const openFolder = () => { try { window.require('electron').shell.openPath(results.out_dir); } catch(e) { alert(results.out_dir); } };
  const showCsv = (p) => { try { window.require('electron').shell.showItemInFolder(p); } catch(e) { alert(p); } };

  const statusText = () => {
    if (calibMode === 'pt1') return '📍 Click point 1 on image';
    if (calibMode === 'pt2') return '📍 Click point 2 on image';
    if (starMode)            return `⊙ Click the centre point  (dist = ${starDist} cm, rot = ${starRotation}°)`;
    if (isProcessing==='star') return '⏳ Computing star gradients…';
    if (pxPerCm)             return `✓ Calibrated — ${pxPerCm.toFixed(2)} px/cm`;
    return 'Not calibrated';
  };

  const cursor = (calibMode !== 'idle' || starMode) ? 'crosshair' : 'default';
  const imgSrc = results?.images?.[activePanel]
    ? `${toFileUrl(results.images[activePanel])}?v=${imgTs}` : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* HEADER */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🌡</span>
          <span className="brand-name">ThermalSight</span>
        </div>
        {results && (
          <button className="btn-ghost" onClick={() => { setResults(null); setFilePath(null); }}>
            ← New Image
          </button>
        )}
      </header>

      {/* UPLOAD */}
      {!results && (
        <main className="upload-screen">
          <div className="upload-hero">
            <h2>Thermal Gradient Analysis</h2>
            <p>Load a FLIR or thermal image to visualise gradients and measure 8-point heat flow.</p>
          </div>
          <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop} onClick={handleBrowse}>
            <div className="drop-icon">📷</div>
            {filePath
              ? <p className="drop-selected">{filePath.split(/[\\/]/).pop()}<br/><span className="drop-path">{filePath}</span></p>
              : <><p className="drop-title">Drop a thermal image here</p><p className="drop-sub">or click to browse · .jpg .png .tiff</p></>
            }
          </div>
          <button className="btn-primary btn-xl" disabled={!filePath || isProcessing==='analysis'} onClick={runAnalysis}>
            {isProcessing==='analysis' ? <><span className="spinner"/>Analysing…</> : 'Analyse Image'}
          </button>
        </main>
      )}

      {/* RESULTS */}
      {results && (
        <div className="results-layout">

          {/* LEFT: panel list */}
          <aside className="left-sidebar">
            <p className="sidebar-heading">PANELS</p>
            {PANELS.map(p => (
              <button key={p.key} className={`panel-btn ${activePanel===p.key?'active':''}`}
                      onClick={() => setActivePanel(p.key)}>
                <span className="panel-icon">{p.icon}</span>
                <span className="panel-label">{p.label}</span>
              </button>
            ))}
            <div className="sidebar-sep"/>
            <button className="panel-btn" onClick={openFolder}>
              <span className="panel-icon">📁</span>
              <span className="panel-label">Output folder</span>
            </button>
          </aside>

          {/* CENTRE: image */}
          <div className="image-area">
            <div className="image-wrapper">
              {imgSrc && (
                <img ref={imgRef} src={imgSrc} alt={activePanel}
                     className="thermal-img" style={{cursor}} draggable={false}
                     onClick={handleImageClick}/>
              )}

              {/* SVG overlays */}
              <svg className="ov-svg">
                {/* calibration line */}
                {calibPt1 && calibPt2 && (
                  <line x1={`${calibPt1.pct.x}%`} y1={`${calibPt1.pct.y}%`}
                        x2={`${calibPt2.pct.x}%`} y2={`${calibPt2.pct.y}%`}
                        stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="5 3"/>
                )}

                {/* star spokes */}
                {starOverlay && COMPASS.map(name => {
                  const pt = starOverlay.points[name];
                  const diff = starResults?.points?.[name]?.diff;
                  const col  = diffColor(diff);
                  return (
                    <line key={name}
                          x1={`${starOverlay.cx}%`} y1={`${starOverlay.cy}%`}
                          x2={`${pt.pct.x}%`}       y2={`${pt.pct.y}%`}
                          stroke={col} strokeWidth="1.5" opacity="0.85"/>
                  );
                })}
              </svg>

              {/* calibration dots */}
              {calibPt1 && <div className="ov-dot calib-dot" style={{left:`${calibPt1.pct.x}%`,top:`${calibPt1.pct.y}%`}}>1</div>}
              {calibPt2 && <div className="ov-dot calib-dot" style={{left:`${calibPt2.pct.x}%`,top:`${calibPt2.pct.y}%`}}>2</div>}

              {/* star centre */}
              {starOverlay && (
                <div className="ov-dot centre-dot" style={{left:`${starOverlay.cx}%`,top:`${starOverlay.cy}%`}}>+</div>
              )}

              {/* star compass points */}
              {starOverlay && COMPASS.map(name => {
                const pt   = starOverlay.points[name];
                const diff = starResults?.points?.[name]?.diff;
                const col  = diffColor(diff);
                return (
                  <div key={name} className="ov-dot star-dot"
                       style={{left:`${pt.pct.x}%`, top:`${pt.pct.y}%`, borderColor: col}}>
                    <span className="star-dot-label">{name}</span>
                  </div>
                );
              })}

              {/* status bar */}
              <div className={`img-statusbar ${calibMode!=='idle'||starMode?'active':''}`}>
                {statusText()}
              </div>
            </div>
          </div>

          {/* RIGHT: tools */}
          <aside className="right-sidebar">

            {/* image info */}
            <div className="tool-card">
              <h4 className="card-title">Image Info</h4>
              <div className="kv"><span>File</span><span>{results.stem}</span></div>
              <div className="kv"><span>Size</span><span>{results.shape[1]}×{results.shape[0]}</span></div>
              <div className="kv"><span>Min</span><span>{results.temp_min?.toFixed(1)} °C</span></div>
              <div className="kv"><span>Max</span><span>{results.temp_max?.toFixed(1)} °C</span></div>
              <div className="kv"><span>Mean</span><span>{results.temp_mean?.toFixed(1)} °C</span></div>
            </div>

            {/* calibration */}
            <div className="tool-card">
              <h4 className="card-title">📏 Calibration</h4>
              <p className={`calib-status ${pxPerCm?'ok':'none'}`}>
                {pxPerCm ? `✓ ${pxPerCm.toFixed(2)} px/cm` : 'Not calibrated'}
              </p>
              <button className="btn-secondary w-full" onClick={startCalib}>Click 2 points on image</button>
              {showDistInput && (
                <div className="inline-form">
                  <label>Real distance (cm):</label>
                  <input type="number" min="0.1" step="0.1" value={calibDist} autoFocus
                         onChange={e=>setCalibDist(e.target.value)}
                         onKeyDown={e=>{if(e.key==='Enter')confirmCalib();if(e.key==='Escape')resetCalib();}}/>
                  <div className="inline-form-btns">
                    <button className="btn-primary" onClick={confirmCalib}>Confirm</button>
                    <button className="btn-ghost"   onClick={resetCalib}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* star measurement */}
            <div className="tool-card">
              <h4 className="card-title">⊙ 8-Point Star</h4>

              <label className="field-label">Distance (cm)</label>
              <input className="field-input" type="number" min="0.1" step="0.5"
                     value={starDist} onChange={e=>setStarDist(e.target.value)}/>

              <label className="field-label" style={{marginTop:'6px'}}>Rotation: {starRotation}°</label>
              <div className="rotation-wrap">
                <input type="range" min="-180" max="180" step="1"
                       value={starRotation}
                       onChange={e=>setStarRotation(Number(e.target.value))}
                       className="rotation-slider"/>
                <button className="btn-ghost btn-tiny" onClick={()=>setStarRotation(0)}>↺</button>
              </div>

              {/* live mini compass preview */}
              <StarPreview rotation={starRotation}/>

              <button className={`btn-secondary w-full ${starMode?'btn-active':''}`}
                      disabled={!pxPerCm || isProcessing==='star'}
                      onClick={()=>setStarMode(v=>!v)} style={{marginTop:'8px'}}>
                {isProcessing==='star' ? <><span className="spinner"/>Computing…</>
                  : starMode ? '…click centre on image' : 'Place star'}
              </button>
            </div>

            {/* star results */}
            {starResults && (
              <div className="tool-card">
                <h4 className="card-title">Star Results</h4>
                <div className="kv"><span>Centre temp</span>
                  <span>{starResults.temp_centre?.toFixed(4)} °C</span></div>
                <div className="kv"><span>Dominant</span>
                  <span style={{color: diffColor(starResults.points?.[starResults.dominant]?.diff)}}>
                    {starResults.dominant}
                  </span>
                </div>

                <div className="star-table">
                  <div className="star-table-head">
                    <span>Dir</span><span>Temp (°C)</span><span>Δ from centre</span>
                  </div>
                  {COMPASS.map(name => {
                    const p = starResults.points?.[name];
                    if (!p) return null;
                    const isDom = name === starResults.dominant;
                    return (
                      <div key={name} className={`star-row ${isDom?'dominant':''}`}>
                        <span className="star-dir" style={{color: diffColor(p.diff)}}>{name}</span>
                        <span className="star-val">{p.temp?.toFixed(4)}</span>
                        <span className="star-diff" style={{color: diffColor(p.diff)}}>
                          {p.diff >= 0 ? '+' : ''}{p.diff?.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button className="btn-secondary w-full" style={{marginTop:'8px'}}
                        onClick={()=>showCsv(starResults.csv_path)}>
                  📄 Show CSV in folder
                </button>
              </div>
            )}

          </aside>
        </div>
      )}
    </div>
  );
}

// Mini compass rose preview showing current rotation
function StarPreview({ rotation }) {
  const size = 72;
  const cx = size / 2, cy = size / 2, r = 26, rdot = 3;
  return (
    <svg width={size} height={size} style={{display:'block',margin:'6px auto'}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2e2e3a" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={2} fill="#888"/>
      {COMPASS.map(name => {
        const angle = (BASE_ANGLES[name] + rotation) * Math.PI / 180;
        const px = cx + r * Math.sin(angle);
        const py = cy - r * Math.cos(angle);
        const isCard = ['N','S','E','W'].includes(name);
        return (
          <g key={name}>
            <line x1={cx} y1={cy} x2={px} y2={py}
                  stroke={isCard?"#ff6b35":"#555"} strokeWidth={isCard?1.2:0.8}/>
            <circle cx={px} cy={py} r={rdot}
                    fill={isCard?"#ff6b35":"#3a3a50"} stroke={isCard?"#ff6b35":"#555"} strokeWidth="0.5"/>
            <text x={px + (px-cx)*0.35} y={py + (py-cy)*0.35 + 1}
                  fontSize="6" fill={isCard?"#ff6b35":"#666"}
                  textAnchor="middle" dominantBaseline="middle">{name}</text>
          </g>
        );
      })}
    </svg>
  );
}
