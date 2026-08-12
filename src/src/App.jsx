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

const diffColor = (diff) => {
  if (diff === undefined) return '#888';
  const abs = Math.min(Math.abs(diff), 5);
  const t   = abs / 5;
  if (diff < 0) return `rgba(100,160,255,${0.4 + t*0.6})`;
  if (diff > 0) return `rgba(255,100,80,${0.4 + t*0.6})`;
  return '#888';
};

const COLOR_PALETTE = ['#ff4444', '#00e5ff', '#44ff44', '#ffbb00', '#e044ff', '#00ffaa', '#ff44aa', '#aaff00'];

export default function App() {
  // Mode & File State
  const [appMode,        setAppMode]        = useState('bulk'); // 'single' | 'bulk'
  const [folderPath,     setFolderPath]     = useState(null);
  const [imageList,      setImageList]      = useState([]);
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

  // 8-Point Star measurement (Full 3-Step Interactive Workflow)
  const [starStep,       setStarStep]       = useState(null); // null | 'place' | 'align' | 'saving' | 'done'
  const [starCentre,     setStarCentre]     = useState(null); // { px, py, pct: {x,y} }
  const [starDist,       setStarDist]       = useState('2.0');
  const [starRot,        setStarRot]        = useState(0);
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
  const [drawingPts,    setDrawingPts]     = useState([]);

  // RAM state storing annotations per image: { [imagePath]: [ { id, labelName, color, points: [{x, y}, ...] } ] }
  const [segmentations, setSegmentations] = useState({});

  // Crash Recovery & Analytics State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [draftToRestore,   setDraftToRestore]   = useState(null);
  const [showAnalytics,    setShowAnalytics]    = useState(false);
  const [analyticsData,    setAnalyticsData]    = useState(null);

  const imgRef = useRef(null);

  // Active image path & results
  const activeImagePath = appMode === 'bulk' ? imageList[currentIndex] : filePath;
  const currentResults  = activeImagePath ? resultsMap[activeImagePath] : null;

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

  // ── Drag & Drop + File Explorer Handlers ─────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFilePath(f.path);
      setAppMode('single');
    }
  };

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
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      setDrawingPts([]);
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

  // ── Star Measurement 3-Step Interactive Workflow ────────────────────────────
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

  const startStar = () => {
    if (!pxPerCm) { alert('Please calibrate pixel scale first!'); return; }
    setStarStep('place');
    setStarCentre(null);
    setStarOverlay(null);
    setStarResults(null);
    setStarRot(0);
  };

  const resetStar = () => {
    setStarStep(null);
    setStarCentre(null);
    setStarOverlay(null);
    setStarResults(null);
    setStarRot(0);
  };

  const handleRotChange = (newRot) => {
    setStarRot(newRot);
    if (starCentre && currentResults) {
      const dist_cm = parseFloat(starDist) || 2.0;
      const dist_px = dist_cm * pxPerCm;
      const ov = buildStarOverlay(starCentre.px, starCentre.py, dist_px, newRot, currentResults.shape);
      setStarOverlay(ov);
    }
  };

  const saveStar = async () => {
    if (!starCentre || !currentResults) return;
    setStarStep('saving');
    const dist_cm = parseFloat(starDist) || 2.0;
    try {
      const res = await api.measureStar(
        activeImagePath, starCentre.px, starCentre.py,
        dist_cm, starRot, pxPerCm, currentResults.out_dir
      );
      setStarResults(res);
      setStarStep('done');
    } catch (err) {
      alert(`Star calculation failed:\n${err}`);
      setStarStep('align');
    }
  };

  // ── Segmentation Drawing Handlers ──────────────────────────────────────────
  const activeLabelObj = labels.find(l => l.id === activeLabelId) || labels[0];

  const handleImageClick = async (e) => {
    const c = getCoords(e);
    if (!c) return;

    if (calibMode === 'pt1') { setCalibPt1(c); setCalibMode('pt2'); return; }
    if (calibMode === 'pt2') { setCalibPt2(c); setCalibMode('idle'); setShowDistInput(true); return; }

    // Star Placement Step 1
    if (starStep === 'place') {
      const dist_cm = parseFloat(starDist) || 2.0;
      const dist_px = dist_cm * pxPerCm;
      setStarCentre(c);
      const ov = buildStarOverlay(c.px, c.py, dist_px, starRot, currentResults.shape);
      setStarOverlay(ov);
      setStarStep('align');
      return;
    }

    // Polygon ROI Drawing Mode
    if (drawMode === 'polygon' && !starStep) {
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

  const openFolder = () => { if (currentResults?.out_dir) api.openPath(currentResults.out_dir); };
  const showCsv = (p) => { if (p) api.showItemInFolder(p); };

  const cursor = (calibMode !== 'idle' || starStep === 'place' || drawMode) ? 'crosshair' : 'default';
  const imgSrc = currentResults?.images?.[activePanel]
    ? `${toFileUrl(currentResults.images[activePanel])}?v=${imgTs}` : null;

  const currentRois = segmentations[activeImagePath] || [];

  return (
    <div className="app">

      {/* RESTORE DRAFT MODAL */}
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

      {/* ANALYTICS MODAL */}
      {showAnalytics && (
        <AnalyticsView analyticsData={analyticsData} onClose={() => setShowAnalytics(false)} />
      )}

      {/* HEADER */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🌡</span>
          <span className="brand-name">ThermalSight</span>
          <span className="brand-badge">v1.2.0</span>
        </div>
        <div className="header-actions">
          {activeImagePath && (
            <button className="btn-primary btn-save" disabled={isProcessing === 'saving'} onClick={handleSaveLabels}>
              {isProcessing === 'saving' ? <><span className="spinner"/>Saving…</> : '💾 Save Label & Export'}
            </button>
          )}
          {activeImagePath && (
            <button className="btn-ghost" onClick={() => { setResultsMap({}); setFilePath(null); setImageList([]); }}>
              ← New Image
            </button>
          )}
        </div>
      </header>

      {/* UPLOAD SCREEN */}
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

            <div className="drop-zone" onDragOver={e=>e.preventDefault()} onDrop={handleDrop} onClick={handleBrowseSingle}>
              <div className="drop-icon">📷</div>
              <p className="drop-title">Open Single Thermal Image</p>
              <p className="drop-sub">Drop or click to browse · .jpg .png .tiff</p>
            </div>
          </div>
        </main>
      )}

      {/* WORKSPACE RESULTS */}
      {activeImagePath && (
        <div className="results-layout">

          {/* LEFT SIDEBAR: PANELS & FOLDER NAVIGATION */}
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

            <div className="sidebar-sep"/>
            <button className="panel-btn" onClick={openFolder}>
              <span className="panel-icon">📁</span>
              <span className="panel-label">Output Folder</span>
            </button>
          </aside>

          {/* CENTRE AREA: THERMAL IMAGE CANVAS & OVERLAYS */}
          <div className="image-area">
            <div className="image-wrapper">
              {imgSrc && (
                <img ref={imgRef} src={imgSrc} alt={activePanel}
                     className="thermal-img" style={{cursor}} draggable={false}
                     onClick={handleImageClick}/>
              )}

              {/* SVG OVERLAYS */}
              <svg className="ov-svg">
                {/* Calibration Line */}
                {calibPt1 && calibPt2 && (
                  <line x1={`${calibPt1.pct.x}%`} y1={`${calibPt1.pct.y}%`}
                        x2={`${calibPt2.pct.x}%`} y2={`${calibPt2.pct.y}%`}
                        stroke="#00e5ff" strokeWidth="2" strokeDasharray="5 3"/>
                )}

                {/* Star Spokes */}
                {starOverlay && COMPASS.map(name => {
                  const pt = starOverlay.points[name];
                  const diff = starResults?.points?.[name]?.diff;
                  const col  = diffColor(diff);
                  return (
                    <line key={name} x1={`${starOverlay.cx}%`} y1={`${starOverlay.cy}%`}
                          x2={`${pt.pct.x}%`} y2={`${pt.pct.y}%`}
                          stroke={col} strokeWidth="1.5" opacity="0.85"/>
                  );
                })}

                {/* Saved ROI Polygons in RAM State */}
                {currentResults && currentRois.map(roi => {
                  const [H, W] = currentResults.shape;
                  const ptsStr = roi.points.map(p => `${(p.x/W)*100}%,${(p.y/H)*100}%`).join(' ');
                  return (
                    <polygon key={roi.id} points={ptsStr}
                             fill={roi.color} fillOpacity="0.25"
                             stroke={roi.color} strokeWidth="2"/>
                  );
                })}

                {/* Current Drawing Polygon Draft */}
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

              {/* Calibration Dots */}
              {calibPt1 && <div className="ov-dot calib-dot" style={{left:`${calibPt1.pct.x}%`,top:`${calibPt1.pct.y}%`}}>1</div>}
              {calibPt2 && <div className="ov-dot calib-dot" style={{left:`${calibPt2.pct.x}%`,top:`${calibPt2.pct.y}%`}}>2</div>}

              {/* Star Dots */}
              {starOverlay && (
                <div className="ov-dot centre-dot" style={{left:`${starOverlay.cx}%`,top:`${starOverlay.cy}%`}}>+</div>
              )}
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

              {/* Current Drawing Action Bar */}
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

          {/* RIGHT SIDEBAR: TOOLS & CARDS */}
          <aside className="right-sidebar">

            {/* IMAGE INFO CARD */}
            {currentResults && (
              <div className="tool-card">
                <h4 className="card-title">Image Info</h4>
                <div className="kv"><span>File</span><span>{currentResults.stem}</span></div>
                <div className="kv"><span>Size</span><span>{currentResults.shape[1]}×{currentResults.shape[0]}</span></div>
                <div className="kv"><span>Min</span><span>{currentResults.temp_min?.toFixed(1)} °C</span></div>
                <div className="kv"><span>Max</span><span>{currentResults.temp_max?.toFixed(1)} °C</span></div>
                <div className="kv"><span>Mean</span><span>{currentResults.temp_mean?.toFixed(1)} °C</span></div>
              </div>
            )}

            {/* SEGMENTATION LABELING PANEL */}
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

              {/* Add Label Form */}
              <div className="add-label-box">
                <input className="field-input-sm" type="text" placeholder="Label (e.g. m1)"
                       value={newLabelName} onChange={e => setNewLabelName(e.target.value)}/>
                <input className="field-input-sm key-input" type="text" maxLength={1} placeholder="Key (a-z)"
                       value={newLabelKey} onChange={e => setNewLabelKey(e.target.value)}/>
                <button className="btn-secondary btn-tiny" onClick={handleAddLabel}>+ Add</button>
              </div>
            </div>

            {/* DRAWN ROIs LIST FOR ACTIVE IMAGE */}
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

            {/* CALIBRATION TOOL CARD */}
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

            {/* STAR MEASUREMENT — 3-STEP INTERACTIVE CARD */}
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

            {/* Star Results Table */}
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

// Mini live compass rose preview showing current rotation
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
