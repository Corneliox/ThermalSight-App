import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import AnalyticsView from './AnalyticsView';

// Access secure electronAPI exposed via contextBridge in preload.js
const api = window.electronAPI || {
  runAnalysis: async () => { throw new Error('Electron API unavailable'); },
  measureStar: async () => { throw new Error('Electron API unavailable'); },
  cropLabels: async () => { throw new Error('Electron API unavailable'); },
  openFileDialog: async () => null,
  openFolderDialog: async () => null,
  listFolderImages: async () => [],
  saveDraft: async () => {},
  loadDraft: async () => null,
  clearDraft: async () => {},
  saveMasterJson: async () => {},
  openPath: async () => {},
  showItemInFolder: async () => {},
};

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

const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];
const BASE_ANGLES = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };

const COLOR_PALETTE = ['#ff4444', '#00e5ff', '#44ff44', '#ffbb00', '#e044ff', '#00ffaa', '#ff44aa', '#aaff00'];

export default function App() {
  // Mode & File State
  const [appMode,        setAppMode]        = useState('bulk'); // 'single' | 'bulk'
  const [folderPath,     setFolderPath]     = useState(null);
  const [imageList,      setImageList]      = useState([]); // [path1, path2, ...]
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [filePath,       setFilePath]       = useState(null);
  const [isProcessing,   setIsProcessing]   = useState(null);
  const [resultsMap,     setResultsMap]     = useState({}); // { [path]: results }
  const [activePanel,    setActivePanel]    = useState('original');
  const [imgTs,          setImgTs]          = useState(Date.now());

  // Calibration
  const [calibMode,      setCalibMode]      = useState('idle');
  const [calibPt1,       setCalibPt1]       = useState(null);
  const [calibPt2,       setCalibPt2]       = useState(null);
  const [pxPerCm,        setPxPerCm]        = useState(null);
  const [calibDist,      setCalibDist]      = useState('10');
  const [showDistInput,  setShowDistInput]  = useState(false);

  // Star measurement
  const [starMode,       setStarMode]       = useState(false);
  const [starDist,       setStarDist]       = useState('2.0');
  const [starRotation,   setStarRotation]   = useState(0);
  const [starOverlay,    setStarOverlay]    = useState(null);
  const [starResults,    setStarResults]    = useState(null);

  // Segmentation Labeling System
  const [labels, setLabels] = useState([
    { id: 'l1', name: 'm1', key: 'm', color: '#ff4444' },
    { id: 'l2', name: 'm2', key: 'n', color: '#00e5ff' }
  ]);
  const [activeLabelId, setActiveLabelId]  = useState('l1');
  const [newLabelName,  setNewLabelName]   = useState('');
  const [newLabelKey,   setNewLabelKey]    = useState('');
  const [drawMode,      setDrawMode]       = useState('polygon'); // 'polygon' | 'box'
  const [drawingPts,    setDrawingPts]     = useState([]); // current polygon draft
  const [boxStart,      setBoxStart]       = useState(null);

  // RAM state storing annotations per image: { [imagePath]: [ { id, labelName, color, points: [{x, y}, ...] } ] }
  const [segmentations, setSegmentations] = useState({});

  // Crash Recovery & Analytics State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [draftToRestore,   setDraftToRestore]   = useState(null);
  const [showAnalytics,    setShowAnalytics]    = useState(false);
  const [analyticsData,    setAnalyticsData]    = useState(null);

  const imgRef = useRef(null);

  // ── Startup Crash Recovery Check ─────────────────────────────────────────────
  useEffect(() => {
    async function checkDraft() {
      const draft = await api.loadDraft();
      if (draft && draft.segmentations && Object.keys(draft.segmentations).length > 0) {
        setDraftToRestore(draft);
        setShowRestoreModal(true);
      }
    }
    checkDraft();
  }, []);

  // ── Debounced Draft Auto-Save ────────────────────────────────────────────────
  useEffect(() => {
    if (!segmentations || Object.keys(segmentations).length === 0) return;
    const timer = setTimeout(() => {
      api.saveDraft({
        folderPath,
        imageList,
        labels,
        segmentations,
        timestamp: Date.now(),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [segmentations, labels, folderPath, imageList]);

  // ── Keyboard Shortcuts Listener (a-z for labels, Arrow Left/Right for navigation)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const pressedKey = e.key.toLowerCase();

      if (e.key === 'ArrowLeft')  handlePrevImage();
      if (e.key === 'ArrowRight') handleNextImage();

      if (e.key === 'Enter' && drawingPts.length >= 3) {
        finishPolygon();
        return;
      }

      const matchedLabel = labels.find(l => l.key.toLowerCase() === pressedKey);
      if (matchedLabel) {
        setActiveLabelId(matchedLabel.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [labels, drawingPts, currentIndex, imageList]);

  const activeImagePath = appMode === 'bulk' ? imageList[currentIndex] : filePath;
  const currentResults  = activeImagePath ? resultsMap[activeImagePath] : null;

  // ── Coordinate conversion ───────────────────────────────────────────────────
  const getCoords = (e) => {
    const img = imgRef.current;
    if (!img || !currentResults) return null;
    const rect = img.getBoundingClientRect();
    return {
      px:  (e.clientX - rect.left) * (currentResults.shape[1] / rect.width),
      py:  (e.clientY - rect.top)  * (currentResults.shape[0] / rect.height),
      pct: {
        x: ((e.clientX - rect.left) / rect.width)  * 100,
        y: ((e.clientY - rect.top)  / rect.height) * 100,
      },
    };
  };

  // ── File & Folder Loading ────────────────────────────────────────────────────
  const handleBrowseSingle = async () => {
    const p = await api.openFileDialog();
    if (p) {
      setFilePath(p);
      setAppMode('single');
    }
  };

  const handleBrowseFolder = async () => {
    const folder = await api.openFolderDialog();
    if (folder) {
      setFolderPath(folder);
      const files = await api.listFolderImages(folder);
      setImageList(files);
      setCurrentIndex(0);
      setAppMode('bulk');
    }
  };

  // ── Analysis Trigger ────────────────────────────────────────────────────────
  const runAnalysisForPath = async (targetPath) => {
    if (!targetPath) return;
    setIsProcessing('analysis');
    try {
      const outDir = targetPath + '_analysis';
      const res = await api.runAnalysis(targetPath, outDir);
      setResultsMap(prev => ({ ...prev, [targetPath]: res }));
      setImgTs(Date.now());
      setActivePanel('original');
    } catch (err) {
      alert(`Analysis failed for ${targetPath}:\n${err}`);
    }
    setIsProcessing(null);
  };

  useEffect(() => {
    if (activeImagePath && !resultsMap[activeImagePath]) {
      runAnalysisForPath(activeImagePath);
    }
  }, [activeImagePath]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1) {
      setDrawingPts([]);
      setBoxStart(null);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      setDrawingPts([]);
      setBoxStart(null);
      setCurrentIndex(prev => prev - 1);
    }
  };

  // ── Calibration ─────────────────────────────────────────────────────────────
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

  // ── Segmentation Drawing Handlers ──────────────────────────────────────────
  const activeLabelObj = labels.find(l => l.id === activeLabelId) || labels[0];

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

      const [H, W] = currentResults.shape;
      const pts = {};
      COMPASS.forEach(name => {
        const angle = (BASE_ANGLES[name] + rot) * Math.PI / 180;
        const px = c.px + dist_px * Math.sin(angle);
        const py = c.py - dist_px * Math.cos(angle);
        pts[name] = { pct: { x: (px/W)*100, y: (py/H)*100 }, px, py };
      });
      setStarOverlay({ cx: (c.px/W)*100, cy: (c.py/H)*100, points: pts });
      setStarMode(false);
      setIsProcessing('star');

      try {
        const res = await api.measureStar(
          activeImagePath, c.px, c.py, dist_cm, rot, pxPerCm, currentResults.out_dir
        );
        setStarResults(res);
      } catch (err) { alert(`Star failed:\n${err}`); }
      setIsProcessing(null);
      return;
    }

    if (drawMode === 'polygon') {
      setDrawingPts(prev => [...prev, c]);
    }
  };

  const finishPolygon = () => {
    if (drawingPts.length < 3) {
      alert('A polygon requires at least 3 points.');
      return;
    }
    const newRoi = {
      id: 'roi_' + Date.now(),
      labelName: activeLabelObj.name,
      color: activeLabelObj.color,
      points: drawingPts.map(p => ({ x: p.px, y: p.py })),
    };

    setSegmentations(prev => ({
      ...prev,
      [activeImagePath]: [...(prev[activeImagePath] || []), newRoi]
    }));
    setDrawingPts([]);
  };

  const deleteRoi = (imagePath, roiId) => {
    setSegmentations(prev => ({
      ...prev,
      [imagePath]: (prev[imagePath] || []).filter(r => r.id !== roiId)
    }));
  };

  // ── Label Setup Management ──────────────────────────────────────────────────
  const handleAddLabel = () => {
    if (!newLabelName.trim()) { alert('Label name is required'); return; }
    if (!newLabelKey.trim())  { alert('Shortcut key (a-z) is required'); return; }

    const keyLower = newLabelKey.trim().toLowerCase();
    if (!/^[a-z]$/.test(keyLower)) { alert('Shortcut must be a single letter a-z'); return; }

    if (labels.some(l => l.key.toLowerCase() === keyLower)) {
      alert(`Shortcut key '${keyLower}' is already assigned to another label!`);
      return;
    }

    const nextColor = COLOR_PALETTE[labels.length % COLOR_PALETTE.length];
    const newObj = {
      id: 'l_' + Date.now(),
      name: newLabelName.trim(),
      key: keyLower,
      color: nextColor,
    };
    setLabels(prev => [...prev, newObj]);
    setActiveLabelId(newObj.id);
    setNewLabelName('');
    setNewLabelKey('');
  };

  const removeLabel = (id) => {
    if (labels.length <= 1) { alert('At least 1 label is required'); return; }
    setLabels(prev => prev.filter(l => l.id !== id));
  };

  // ── Save Label & Master Export Action ────────────────────────────────────────
  const handleSaveLabels = async () => {
    const totalSegs = Object.values(segmentations).flat().length;
    if (totalSegs === 0) {
      alert('No segmentations created yet. Draw at least 1 ROI on an image first.');
      return;
    }

    setIsProcessing('saving');
    const aggregatedStats = {};

    const targetPaths = appMode === 'bulk' ? imageList : [filePath];
    const outDir = folderPath ? folderPath + '_isolated_labels' : activeImagePath + '_isolated_labels';

    try {
      for (const imgPath of targetPaths) {
        const rois = segmentations[imgPath] || [];
        if (rois.length === 0) continue;

        const pictureName = imgPath.split(/[\\/]/).pop().split('.')[0];
        
        for (let i = 0; i < rois.length; i++) {
          const roi = rois[i];
          const res = await api.cropLabels(imgPath, roi.points, roi.labelName, i + 1, outDir);

          if (!aggregatedStats[roi.labelName]) aggregatedStats[roi.labelName] = [];
          aggregatedStats[roi.labelName].push({
            pictureName,
            imagePath: imgPath,
            roiIndex: i + 1,
            mean_temp: res.mean_temp,
            min_temp: res.min_temp,
            max_temp: res.max_temp,
            std_temp: res.std_temp,
            pixel_count: res.pixel_count,
            csv_path: res.csv_path,
          });
        }
      }

      const masterData = {
        exportedAt: new Date().toISOString(),
        folderPath,
        labels,
        segmentations,
        aggregatedStats,
      };
      await api.saveMasterJson(outDir, masterData);

      // Clean up temporary draft recovery file upon successful export
      await api.clearDraft();

      setAnalyticsData(aggregatedStats);
      setShowAnalytics(true);
      alert(`Success! Isolated CSVs and master annotations_session.json saved to:\n${outDir}`);
    } catch (err) {
      alert(`Export failed:\n${err}`);
    }
    setIsProcessing(null);
  };

  const restoreDraft = () => {
    if (draftToRestore) {
      setFolderPath(draftToRestore.folderPath);
      setImageList(draftToRestore.imageList || []);
      setLabels(draftToRestore.labels || labels);
      setSegmentations(draftToRestore.segmentations || {});
      if (draftToRestore.imageList && draftToRestore.imageList.length > 0) {
        setAppMode('bulk');
        setCurrentIndex(0);
      }
    }
    setShowRestoreModal(false);
  };

  const discardDraft = async () => {
    await api.clearDraft();
    setShowRestoreModal(false);
  };

  const cursor = (calibMode !== 'idle' || starMode || drawMode) ? 'crosshair' : 'default';
  const imgSrc = currentResults?.images?.[activePanel]
    ? `${toFileUrl(currentResults.images[activePanel])}?v=${imgTs}` : null;

  const currentRois = segmentations[activeImagePath] || [];

  return (
    <div className="app">

      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>⚠️ Unsaved Progress Detected</h3>
            <p>We found unsaved segmentation labels from a previous session.</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={restoreDraft}>Restore Progress</button>
              <button className="btn-ghost"   onClick={discardDraft}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {showAnalytics && (
        <AnalyticsView analyticsData={analyticsData} onClose={() => setShowAnalytics(false)} />
      )}

      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🌡</span>
          <span className="brand-name">ThermalSight</span>
          <span className="brand-badge">v1.1.0</span>
        </div>
        <div className="header-actions">
          {activeImagePath && (
            <button className="btn-primary btn-save" disabled={isProcessing === 'saving'} onClick={handleSaveLabels}>
              {isProcessing === 'saving' ? <><span className="spinner"/>Saving…</> : '💾 Save Label & Export'}
            </button>
          )}
          {activeImagePath && (
            <button className="btn-ghost" onClick={() => { setResultsMap({}); setFilePath(null); setImageList([]); }}>
              ← Reset Image
            </button>
          )}
        </div>
      </header>

      {!activeImagePath && (
        <main className="upload-screen">
          <div className="upload-hero">
            <h2>Thermal Gradient & Segmentation Analysis</h2>
            <p>Load single FLIR images or an entire folder sequence to segment regions and analyze temperature trends.</p>
          </div>

          <div className="upload-options">
            <div className="drop-zone" onClick={handleBrowseFolder}>
              <div className="drop-icon">📁</div>
              <p className="drop-title">Open Image Folder (Bulk Mode)</p>
              <p className="drop-sub">Select folder to analyze & label sequential images (1–N)</p>
            </div>

            <div className="drop-zone" onClick={handleBrowseSingle}>
              <div className="drop-icon">📷</div>
              <p className="drop-title">Open Single Image</p>
              <p className="drop-sub">Browse for individual thermal image file</p>
            </div>
          </div>
        </main>
      )}

      {activeImagePath && (
        <div className="results-layout">

          <aside className="left-sidebar">
            {appMode === 'bulk' && imageList.length > 0 && (
              <div className="bulk-nav-box">
                <p className="sidebar-heading">FOLDER SEQUENCE ({currentIndex + 1}/{imageList.length})</p>
                <div className="nav-btns">
                  <button className="btn-secondary nav-btn" disabled={currentIndex === 0} onClick={handlePrevImage}>◄ Prev</button>
                  <button className="btn-secondary nav-btn" disabled={currentIndex === imageList.length - 1} onClick={handleNextImage}>Next ►</button>
                </div>
                <div className="image-filename-tag">
                  {imageList[currentIndex].split(/[\\/]/).pop()}
                </div>
              </div>
            )}

            <p className="sidebar-heading">PANELS</p>
            {PANELS.map(p => (
              <button key={p.key} className={`panel-btn ${activePanel===p.key?'active':''}`}
                      onClick={() => setActivePanel(p.key)}>
                <span className="panel-icon">{p.icon}</span>
                <span className="panel-label">{p.label}</span>
              </button>
            ))}
          </aside>

          <div className="image-area">
            <div className="image-wrapper">
              {imgSrc && (
                <img ref={imgRef} src={imgSrc} alt={activePanel}
                     className="thermal-img" style={{cursor}} draggable={false}
                     onClick={handleImageClick}/>
              )}

              <svg className="ov-svg">
                {calibPt1 && calibPt2 && (
                  <line x1={`${calibPt1.pct.x}%`} y1={`${calibPt1.pct.y}%`}
                        x2={`${calibPt2.pct.x}%`} y2={`${calibPt2.pct.y}%`}
                        stroke="#00e5ff" strokeWidth="2" strokeDasharray="5 3"/>
                )}

                {starOverlay && COMPASS.map(name => {
                  const pt = starOverlay.points[name];
                  return (
                    <line key={name} x1={`${starOverlay.cx}%`} y1={`${starOverlay.cy}%`}
                          x2={`${pt.pct.x}%`} y2={`${pt.pct.y}%`}
                          stroke="#ff4444" strokeWidth="1.5"/>
                  );
                })}

                {currentResults && currentRois.map(roi => {
                  const [H, W] = currentResults.shape;
                  const ptsStr = roi.points.map(p => `${(p.x/W)*100}%,${(p.y/H)*100}%`).join(' ');
                  return (
                    <polygon key={roi.id} points={ptsStr}
                             fill={roi.color} fillOpacity="0.25"
                             stroke={roi.color} strokeWidth="2"/>
                  );
                })}

                {currentResults && drawingPts.length > 0 && (
                  <g>
                    <polyline points={drawingPts.map(p => `${p.pct.x}%,${p.pct.y}%`).join(' ')}
                              fill="none" stroke={activeLabelObj.color} strokeWidth="2" strokeDasharray="3 3"/>
                    {drawingPts.map((p, idx) => (
                      <circle key={idx} cx={`${p.pct.x}%`} cy={`${p.pct.y}%`} r="4" fill={activeLabelObj.color}/>
                    ))}
                  </g>
                )}
              </svg>

              {drawingPts.length > 0 && (
                <div className="drawing-toolbar">
                  <span>Drawing <strong>{activeLabelObj.name}</strong> ({drawingPts.length} pts)</span>
                  <button className="btn-primary btn-tiny" disabled={drawingPts.length < 3} onClick={finishPolygon}>
                    ✓ Finish (Enter)
                  </button>
                  <button className="btn-ghost btn-tiny" onClick={() => setDrawingPts([])}>Cancel</button>
                </div>
              )}
            </div>
          </div>

          <aside className="right-sidebar">

            <div className="tool-card">
              <h4 className="card-title">🏷 Segmentation Labels</h4>
              
              <div className="label-list">
                {labels.map(l => (
                  <div key={l.id} className={`label-item ${activeLabelId === l.id ? 'active' : ''}`}
                       onClick={() => setActiveLabelId(l.id)}>
                    <span className="label-color-dot" style={{ backgroundColor: l.color }}/>
                    <span className="label-name-text">{l.name}</span>
                    <kbd className="label-key-badge">[{l.key.toUpperCase()}]</kbd>
                    {labels.length > 1 && (
                      <button className="btn-ghost btn-tiny" onClick={(e) => { e.stopPropagation(); removeLabel(l.id); }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="add-label-box">
                <input className="field-input-sm" type="text" placeholder="Label (e.g. m1)"
                       value={newLabelName} onChange={e => setNewLabelName(e.target.value)}/>
                <input className="field-input-sm key-input" type="text" maxLength={1} placeholder="Key (a-z)"
                       value={newLabelKey} onChange={e => setNewLabelKey(e.target.value)}/>
                <button className="btn-secondary btn-tiny" onClick={handleAddLabel}>+ Add</button>
              </div>
            </div>

            <div className="tool-card">
              <h4 className="card-title">📌 Image ROIs ({currentRois.length})</h4>
              {currentRois.length === 0 ? (
                <p className="subtext">Click points on thermal image to draw ROI polygon.</p>
              ) : (
                <div className="roi-list">
                  {currentRois.map((roi, idx) => (
                    <div key={roi.id} className="roi-item">
                      <span className="roi-dot" style={{ backgroundColor: roi.color }}/>
                      <span className="roi-text">{roi.labelName} #{idx + 1} ({roi.points.length} pts)</span>
                      <button className="btn-ghost btn-tiny" onClick={() => deleteRoi(activeImagePath, roi.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tool-card">
              <h4 className="card-title">📏 Calibration</h4>
              <p className={`calib-status ${pxPerCm ? 'ok' : 'none'}`}>
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

            <div className="tool-card">
              <h4 className="card-title">⊙ 8-Point Star</h4>
              <label className="field-label">Distance (cm)</label>
              <input className="field-input" type="number" min="0.1" step="0.5"
                     value={starDist} onChange={e=>setStarDist(e.target.value)}/>
              
              <button className={`btn-secondary w-full ${starMode?'btn-active':''}`}
                      disabled={!pxPerCm || isProcessing==='star'}
                      onClick={()=>setStarMode(v=>!v)} style={{marginTop:'8px'}}>
                {starMode ? '…click centre on image' : 'Place star'}
              </button>
            </div>

          </aside>
        </div>
      )}
    </div>
  );
}
