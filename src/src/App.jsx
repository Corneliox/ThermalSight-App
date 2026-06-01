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
  { key: 'original',   label: 'Temperature',  icon: '🌡' },
  { key: 'magnitude',  label: 'Gradient Mag', icon: '〰' },
  { key: 'mag_thresh', label: 'Strong Edges', icon: '⚡' },
  { key: 'angle',      label: 'Flow Angle',   icon: '🧭' },
  { key: 'overlay',    label: 'Overlay',      icon: '🔲' },
  { key: 'quiver',     label: 'Quiver',       icon: '↗'  },
  { key: 'grid',       label: 'Full Grid',    icon: '⊞'  },
];

const COMPASS      = ['N','NE','E','SE','S','SW','W','NW'];
const BASE_ANGLES  = {N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};

const diffColor = (diff) => {
  if (diff === undefined || diff === null) return '#888';
  const abs = Math.min(Math.abs(diff), 5);
  const t   = abs / 5;
  if (diff < 0) return `rgba(100,160,255,${0.4 + t * 0.6})`;
  if (diff > 0) return `rgba(255,100,80,${0.4 + t * 0.6})`;
  return '#888';
};

// Pure function — builds star overlay from pixel coords + params
function buildOverlay(cx_px, cy_px, dist_px, rot_deg, shape) {
  const [H, W] = shape;
  const pts = {};
  COMPASS.forEach(name => {
    const rad = (BASE_ANGLES[name] + rot_deg) * Math.PI / 180;
    const px  = cx_px + dist_px * Math.sin(rad);
    const py  = cy_px - dist_px * Math.cos(rad);
    pts[name] = { pct: { x: (px / W) * 100, y: (py / H) * 100 }, px, py };
  });
  return {
    cx: (cx_px / W) * 100, cy: (cy_px / H) * 100,
    cx_px, cy_px, points: pts,
  };
}

// ── STAR STEPS ────────────────────────────────────────────────────────────────
// null     → idle (no star active)
// 'place'  → waiting for user click on image
// 'align'  → star placed, user adjusting rotation
// 'saving' → backend call in flight
// 'done'   → results shown

export default function App() {
  const [filePath,     setFilePath]     = useState(null);
  const [isAnalysing,  setIsAnalysing]  = useState(false);
  const [results,      setResults]      = useState(null);
  const [activePanel,  setActivePanel]  = useState('original');
  const [imgTs,        setImgTs]        = useState(0);

  // calibration
  const [calibMode,    setCalibMode]    = useState('idle'); // idle|pt1|pt2
  const [calibPt1,     setCalibPt1]     = useState(null);
  const [calibPt2,     setCalibPt2]     = useState(null);
  const [pxPerCm,      setPxPerCm]      = useState(null);
  const [calibDist,    setCalibDist]    = useState('10');
  const [showDistInput,setShowDistInput]= useState(false);

  // star
  const [starStep,     setStarStep]     = useState(null);
  const [starDist,     setStarDist]     = useState('2.0');
  const [starRot,      setStarRot]      = useState(0);
  const [starOverlay,  setStarOverlay]  = useState(null);
  const [starResults,  setStarResults]  = useState(null);

  const imgRef = useRef(null);

  // Direct rotation handler — updates both starRot and overlay in one event
  const handleRotChange = (val) => {
    setStarRot(val);
    if (starOverlay) {
      const dist_px = (parseFloat(starDist) || 2.0) * (pxPerCm || 1);
      setStarOverlay(buildOverlay(
        starOverlay.cx_px, starOverlay.cy_px,
        dist_px, val, results.shape
      ));
    }
  };

  // ── coords ──────────────────────────────────────────────────────────────────
  const getCoords = (e) => {
    const img = imgRef.current;
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
    setIsAnalysing(true);
    try {
      const res = await ipcRenderer.invoke('run-analysis', filePath, filePath + '_analysis');
      setResults(res); setImgTs(Date.now()); setActivePanel('original');
      resetCalib(); resetStar();
    } catch (err) { alert(`Analysis failed:\n${err}`); }
    setIsAnalysing(false);
  };

  // ── calibration ─────────────────────────────────────────────────────────────
  const resetCalib = () => { setCalibMode('idle'); setCalibPt1(null); setCalibPt2(null); setShowDistInput(false); };
  const startCalib = () => { resetCalib(); setPxPerCm(null); setCalibMode('pt1'); };
  const confirmCalib = () => {
    if (!calibPt1 || !calibPt2) return;
    const d  = Math.hypot(calibPt2.px - calibPt1.px, calibPt2.py - calibPt1.py);
    const cm = parseFloat(calibDist);
    if (!cm || cm <= 0) { alert('Enter a valid distance > 0'); return; }
    setPxPerCm(d / cm); setShowDistInput(false); setCalibMode('idle');
  };

  // ── star ────────────────────────────────────────────────────────────────────
  const resetStar  = () => { setStarStep(null); setStarOverlay(null); setStarResults(null); };
  const startStar  = () => { if (!pxPerCm) { alert('Calibrate first!'); return; } resetStar(); setStarStep('place'); };

  const saveStar = async () => {
    if (!starOverlay) return;
    setStarStep('saving');
    const dist_cm = parseFloat(starDist) || 2.0;
    try {
      const res = await ipcRenderer.invoke(
        'measure-star', filePath,
        starOverlay.cx_px, starOverlay.cy_px,
        dist_cm, starRot, pxPerCm, results.out_dir
      );
      setStarResults(res);
      setStarStep('done');
    } catch (err) {
      alert(`Star failed:\n${err}`);
      setStarStep('align');
    }
  };

  // ── image click ─────────────────────────────────────────────────────────────
  const handleImageClick = (e) => {
    const c = getCoords(e);
    if (!c) return;

    if (calibMode === 'pt1') { setCalibPt1(c); setCalibMode('pt2'); return; }
    if (calibMode === 'pt2') { setCalibPt2(c); setCalibMode('idle'); setShowDistInput(true); return; }

    if (starStep === 'place') {
      const dist_px = (parseFloat(starDist) || 2.0) * pxPerCm;
      setStarOverlay(buildOverlay(c.px, c.py, dist_px, starRot, results.shape));
      setStarStep('align');
    }
  };

  // ── status bar ──────────────────────────────────────────────────────────────
  const statusText = () => {
    if (calibMode === 'pt1')  return '📍 Click point 1 on image';
    if (calibMode === 'pt2')  return '📍 Click point 2 on image';
    if (starStep === 'place') return `⊙ Click centre point  (dist=${starDist}cm)`;
    if (starStep === 'align') return '↻ Adjust rotation then press Save Star';
    if (starStep === 'saving')return '⏳ Computing…';
    if (starStep === 'done')  return `✓ Saved — dominant: ${starResults?.dominant}`;
    if (pxPerCm)              return `✓ ${pxPerCm.toFixed(2)} px/cm`;
    return 'Not calibrated';
  };

  const activeCursor = (calibMode !== 'idle' || starStep === 'place') ? 'crosshair' : 'default';
  const imgSrc = results?.images?.[activePanel]
    ? `${toFileUrl(results.images[activePanel])}?v=${imgTs}` : null;

  const openFolder = () => { try { window.require('electron').shell.openPath(results.out_dir); } catch(e){alert(results.out_dir);} };
  const showCsv    = (p) => { try { window.require('electron').shell.showItemInFolder(p); } catch(e){alert(p);} };

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

      {/* UPLOAD SCREEN */}
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
          <button className="btn-primary btn-xl" disabled={!filePath || isAnalysing} onClick={runAnalysis}>
            {isAnalysing ? <><span className="spinner"/>Analysing…</> : 'Analyse Image'}
          </button>
        </main>
      )}

      {/* RESULTS SCREEN */}
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
                     className="thermal-img" style={{cursor: activeCursor}}
                     draggable={false} onClick={handleImageClick}/>
              )}

              {/* SVG layer */}
              <svg className="ov-svg">
                {/* calibration line */}
                {calibPt1 && calibPt2 && (
                  <line x1={`${calibPt1.pct.x}%`} y1={`${calibPt1.pct.y}%`}
                        x2={`${calibPt2.pct.x}%`} y2={`${calibPt2.pct.y}%`}
                        stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="5 3"/>
                )}
                {/* star spokes */}
                {starOverlay && COMPASS.map(name => {
                  const pt   = starOverlay.points[name];
                  const diff = starResults?.points?.[name]?.diff;
                  return (
                    <line key={name}
                          x1={`${starOverlay.cx}%`} y1={`${starOverlay.cy}%`}
                          x2={`${pt.pct.x}%`}       y2={`${pt.pct.y}%`}
                          stroke={diffColor(diff)} strokeWidth="1.5" opacity="0.85"/>
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
                return (
                  <div key={name} className="ov-dot star-dot"
                       style={{left:`${pt.pct.x}%`, top:`${pt.pct.y}%`, borderColor: diffColor(diff)}}>
                    <span className="star-dot-label">{name}</span>
                  </div>
                );
              })}

              {/* status bar */}
              <div className={`img-statusbar ${(calibMode!=='idle'||starStep)?'active':''}`}>
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

            {/* star — 3-step card */}
            <div className="tool-card">
              <h4 className="card-title">⊙ 8-Point Star</h4>

              {/* Step indicators */}
              <div className="step-row">
                {['Place','Align','Save'].map((label, i) => {
                  const stepKeys = [['place'], ['align'], ['saving','done']];
                  const active   = starStep && stepKeys[i].includes(starStep);
                  const done     = (i === 0 && ['align','saving','done'].includes(starStep)) ||
                                   (i === 1 && ['saving','done'].includes(starStep)) ||
                                   (i === 2 && starStep === 'done');
                  return (
                    <div key={label} className={`step-chip ${active?'active':''} ${done?'done':''}`}>
                      <span className="step-num">{done ? '✓' : i+1}</span>
                      <span className="step-lbl">{label}</span>
                    </div>
                  );
                })}
              </div>

              <label className="field-label">Distance (cm)</label>
              <input className="field-input" type="number" min="0.1" step="0.5"
                     value={starDist}
                     disabled={starStep === 'align' || starStep === 'saving' || starStep === 'done'}
                     onChange={e=>setStarDist(e.target.value)}/>

              {/* Step 1: Place button */}
              {(!starStep || starStep === 'done') && (
                <button className={`btn-secondary w-full ${starStep==='place'?'btn-active':''}`}
                        disabled={!pxPerCm}
                        onClick={startStar}
                        style={{marginTop:'8px'}}>
                  {starStep === 'done' ? '↺ Place new star' : '① Place star on image'}
                </button>
              )}

              {starStep === 'place' && (
                <div className="step-hint">Click anywhere on the image to place the centre</div>
              )}

              {/* Step 2: Align — rotation slider + live preview */}
              {(starStep === 'align' || starStep === 'saving') && (
                <>
                  <div className="rotation-header">
                    <label className="field-label">② Rotate: {starRot}°</label>
                    <button className="btn-ghost btn-tiny" onClick={() => handleRotChange(0)}>↺ Reset</button>
                  </div>
                  <input type="range" min="-180" max="180" step="1"
                         value={starRot}
                         onChange={e => handleRotChange(Number(e.target.value))}
                         className="rotation-slider w-full"/>
                  <StarPreview rotation={starRot}/>

                  <div className="align-btn-row">
                    <button className="btn-ghost" onClick={resetStar}>✕ Cancel</button>
                    <button className="btn-primary"
                            disabled={starStep === 'saving'}
                            onClick={saveStar}>
                      {starStep === 'saving'
                        ? <><span className="spinner"/>Saving…</>
                        : '③ Save Star'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* star results */}
            {starResults && starStep === 'done' && (
              <div className="tool-card">
                <h4 className="card-title">Star Results</h4>
                <div className="kv"><span>Centre temp</span>
                  <span>{starResults.temp_centre?.toFixed(4)} °C</span></div>
                <div className="kv"><span>Rotation</span>
                  <span>{starResults.rotation_deg?.toFixed(1)}°</span></div>
                <div className="kv"><span>Dominant</span>
                  <span style={{color:diffColor(starResults.points?.[starResults.dominant]?.diff)}}>
                    {starResults.dominant}
                  </span>
                </div>

                <div className="star-table">
                  <div className="star-table-head">
                    <span>Dir</span><span>Temp °C</span><span>Δ centre</span>
                  </div>
                  {COMPASS.map(name => {
                    const p = starResults.points?.[name];
                    if (!p) return null;
                    const isDom = name === starResults.dominant;
                    return (
                      <div key={name} className={`star-row ${isDom?'dominant':''}`}>
                        <span className="star-dir" style={{color:diffColor(p.diff)}}>{name}</span>
                        <span className="star-val">{p.temp?.toFixed(4)}</span>
                        <span className="star-diff" style={{color:diffColor(p.diff)}}>
                          {p.diff >= 0 ? '+' : ''}{p.diff?.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button className="btn-secondary w-full" style={{marginTop:'8px'}}
                        onClick={()=>showCsv(starResults.csv_path)}>
                  📄 Show CSV
                </button>
              </div>
            )}

          </aside>
        </div>
      )}
    </div>
  );
}

// Mini live compass preview
function StarPreview({ rotation }) {
  const size = 72, cx = 36, cy = 36, r = 26;
  return (
    <svg width={size} height={size} style={{display:'block',margin:'4px auto'}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2e2e3a" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={2} fill="#888"/>
      {COMPASS.map(name => {
        const ang = (BASE_ANGLES[name] + rotation) * Math.PI / 180;
        const px  = cx + r * Math.sin(ang);
        const py  = cy - r * Math.cos(ang);
        const isCard = ['N','S','E','W'].includes(name);
        return (
          <g key={name}>
            <line x1={cx} y1={cy} x2={px} y2={py}
                  stroke={isCard?'#ff6b35':'#555'} strokeWidth={isCard?1.2:0.8}/>
            <circle cx={px} cy={py} r={3}
                    fill={isCard?'#ff6b35':'#3a3a50'} stroke={isCard?'#ff6b35':'#555'} strokeWidth="0.5"/>
            <text x={px+(px-cx)*0.35} y={py+(py-cy)*0.35+1}
                  fontSize="6" fill={isCard?'#ff6b35':'#666'}
                  textAnchor="middle" dominantBaseline="middle">{name}</text>
          </g>
        );
      })}
    </svg>
  );
}
