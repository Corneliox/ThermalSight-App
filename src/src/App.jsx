import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import AnalyticsView from './AnalyticsView';
import { getProtocolStep, generateGraphSvg } from './protocol';
import JSZip from 'jszip';
import {
  loadThermalImageData,
  runClientThermalAnalysis,
  clientMeasureStar,
  clientCropPolygonROI,
  computeLabelStarGradient
} from './thermalEngine';

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
  openAnnotationDialog: async () => null,
  loadAnnotationFile: async () => null,
  checkExistingAnnotation: async () => null,
  exportResultPackage: async () => {},
  getPlatformInfo: async () => ({ platform: 'web', isMac: false, isPackaged: false, arch: 'web' }),
  runMacPermissionFix: async () => ({ status: 'skipped' }),
  testBackendConnection: async () => ({ success: true }),
};

const toFileUrl = (p) => {
  if (!p) return '';
  if (p.startsWith('data:') || p.startsWith('blob:') || p.startsWith('http')) return p;
  const s = p.replace(/\\/g, '/');
  const encodedParts = s.split('/').map(part => encodeURIComponent(part));
  const encodedPath = encodedParts.join('/');
  return s.startsWith('/') ? `file://${encodedPath}` : `file:///${encodedPath}`;
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
  const [fileObjMap,     setFileObjMap]     = useState({}); // { [path]: File | Blob }
  const [isProcessing,   setIsProcessing]   = useState(null);
  const [resultsMap,     setResultsMap]     = useState({}); // { [path]: results }
  const [activePanel,    setActivePanel]    = useState('original');
  const [imgTs,          setImgTs]          = useState(Date.now());

  // Input file refs for Web mode
  const singleFileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const annotationFileInputRef = useRef(null);
  const isWeb = typeof window !== 'undefined' && (!window.electronAPI || !window.electronAPI.openFileDialog);

  // Active image path & results
  const activeImagePath = appMode === 'bulk' ? imageList[currentIndex] : filePath;
  const currentResults  = activeImagePath ? resultsMap[activeImagePath] : null;

  // Calibration State (Per-Image Mapping for Bulk 1-by-1 Calibration)
  const [calibrationsMap, setCalibrationsMap] = useState({}); // { [imagePath]: { pxPerCm, dist_cm, pt1, pt2 } }
  const [calibMode,       setCalibMode]       = useState('idle');
  const [calibPt1,        setCalibPt1]        = useState(null);
  const [calibPt2,        setCalibPt2]        = useState(null);
  const [calibPreviewPt,  setCalibPreviewPt]  = useState(null);
  const [calibDist,       setCalibDist]       = useState('10');
  const [showDistInput,   setShowDistInput]   = useState(false);

  // Active image pixel-to-cm scale
  const activePxPerCm = (activeImagePath && calibrationsMap[activeImagePath]?.pxPerCm) || null;

  // Straight line snap helper (when Shift key is held)
  const snapStraightPoint = (pt1, currentCoords) => {
    if (!pt1 || !currentCoords) return currentCoords;
    const dx = Math.abs(currentCoords.px - pt1.px);
    const dy = Math.abs(currentCoords.py - pt1.py);
    if (dx >= dy) {
      // Snap to horizontal line
      return {
        px: currentCoords.px,
        py: pt1.py,
        pct: {
          x: currentCoords.pct.x,
          y: pt1.pct.y,
        }
      };
    } else {
      // Snap to vertical line
      return {
        px: pt1.px,
        py: currentCoords.py,
        pct: {
          x: pt1.pct.x,
          y: currentCoords.pct.y,
        }
      };
    }
  };

  // Manual 8-Point Star Measurement Tool (Optional standalone 3-step tool)
  const [starStep,       setStarStep]       = useState(null); // null | 'place' | 'align' | 'saving' | 'done'
  const [starCentre,     setStarCentre]     = useState(null); // { px, py, pct: {x,y} }
  const [starDist,       setStarDist]       = useState('2.0');
  const [starRot,        setStarRot]        = useState(0);
  const [starOverlay,    setStarOverlay]    = useState(null);
  const [starResults,    setStarResults]    = useState(null);

  // Segmentation Labeling System (Defaults to 1:1 Strict Circle Mode)
  const [labels, setLabels] = useState([
    { id: 'l1', name: 'm1', key: 'm', color: '#ff4444' },
    { id: 'l2', name: 'm2', key: 'n', color: '#00e5ff' }
  ]);
  const [activeLabelId,  setActiveLabelId]  = useState('l1');
  const [newLabelName,   setNewLabelName]   = useState('');
  const [newLabelKey,    setNewLabelKey]    = useState('');
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editName,       setEditName]       = useState('');
  const [editKey,        setEditKey]        = useState('');
  const [editColor,      setEditColor]      = useState('#00e5ff');
  
  // Drawing Tool State: 'circle' (1:1 strict circle default) | 'polygon' (pen tool)
  const [drawMode,       setDrawMode]       = useState('circle');
  const [circleCenter,   setCircleCenter]   = useState(null); // { px, py, pct }
  const [circleRadius,   setCircleRadius]   = useState(null); // radius in px
  const [drawingPts,     setDrawingPts]     = useState([]);   // for polygon mode

  // RAM state storing annotations per image: { [imagePath]: [ { id, type, cx, cy, radius, labelName, color, points: [{x, y}], star } ] }
  const [segmentations,  setSegmentations]  = useState({});

  // Crash Recovery, Settings & About State
  const [showRestoreModal,   setShowRestoreModal]   = useState(false);
  const [draftToRestore,     setDraftToRestore]     = useState(null);
  const [showAnalytics,      setShowAnalytics]      = useState(false);
  const [analyticsData,      setAnalyticsData]      = useState(null);
  const [showSettingsModal,  setShowSettingsModal]  = useState(false);
  const [showAboutModal,     setShowAboutModal]     = useState(false);
  const [isMacPlatform,      setIsMacPlatform]      = useState(false);
  const [showMacGuideModal,  setShowMacGuideModal]  = useState(false);
  const [backendDiagnostics, setBackendDiagnostics] = useState(null);
  const [pendingSession,     setPendingSession]     = useState(null);
  const [showNeedImagesModal,setShowNeedImagesModal] = useState(false);

  // Live Terminal Logs State
  const [terminalLogs, setTerminalLogs] = useState([
    { id: 1, type: 'info', text: 'ThermalSight Web & Client Engine v1.4.0 Initialized (100% Client-Side JS)', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const terminalEndRef = useRef(null);

  const imgRef = useRef(null);

  // ── macOS Platform & Backend Health Check on Startup ────────────────────────
  useEffect(() => {
    async function initPlatformAndDiagnostics() {
      if (window.electronAPI && api.getPlatformInfo) {
        try {
          const info = await api.getPlatformInfo();
          if (info && info.isMac) {
            setIsMacPlatform(true);
            if (api.testBackendConnection) {
              const diag = await api.testBackendConnection();
              if (!diag.success) {
                setShowMacGuideModal(true);
                setBackendDiagnostics({ status: 'error', error: diag.error });
              } else {
                setBackendDiagnostics({ status: 'ok', msg: 'Backend verified' });
              }
            }
          }
        } catch (err) {
          console.error('Platform check error:', err);
        }
      }
    }
    initPlatformAndDiagnostics();
  }, []);

  // ── Live Backend Terminal Listener ───────────────────────────────────────────
  useEffect(() => {
    if (window.electronAPI && api.onBackendLog) {
      api.onBackendLog((log) => {
        setTerminalLogs(prev => [...prev.slice(-200), { ...log, id: Date.now() + Math.random() }]);
      });
    }
  }, []);

  useEffect(() => {
    if (isTerminalOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, isTerminalOpen]);

  // ── Menu Bar Event IPC Listeners (Electron) ──────────────────────────────────
  useEffect(() => {
    if (window.electronAPI) {
      if (api.onMenuOpenSettings)   api.onMenuOpenSettings(() => setShowSettingsModal(true));
      if (api.onMenuOpenAbout)      api.onMenuOpenAbout(() => setShowAboutModal(true));
      if (api.onMenuOpenMacGuide)   api.onMenuOpenMacGuide(() => setShowMacGuideModal(true));
      if (api.onMenuTriggerUndo)    api.onMenuTriggerUndo(() => undoLastRoi());
      if (api.onMenuOpenSingle)     api.onMenuOpenSingle(() => handleBrowseSingle());
      if (api.onMenuOpenFolder)     api.onMenuOpenFolder(() => handleBrowseFolder());
      if (api.onMenuOpenAnnotation) api.onMenuOpenAnnotation(() => handleOpenAnnotationSession());
      if (api.onMenuOpenProject)    api.onMenuOpenProject(() => openFolder());
    }
  }, [segmentations, activeImagePath, imageList, currentIndex, filePath]);

  // ── Startup Crash Recovery Check ─────────────────────────────────────────────
  useEffect(() => {
    async function checkDraft() {
      let draft = null;
      if (window.electronAPI && api.loadDraft) {
        draft = await api.loadDraft();
      } else {
        try {
          const saved = localStorage.getItem('thermalsight_draft');
          if (saved) draft = JSON.parse(saved);
        } catch {}
      }
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
      const draftData = {
        folderPath,
        imageList,
        labels,
        segmentations,
        calibrationsMap,
        timestamp: Date.now(),
      };
      if (window.electronAPI && api.saveDraft) {
        api.saveDraft(draftData);
      } else {
        try {
          localStorage.setItem('thermalsight_draft', JSON.stringify(draftData));
        } catch {}
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [segmentations, labels, folderPath, imageList, calibrationsMap]);

  const undoLastRoi = () => {
    if (!activeImagePath) return;
    setSegmentations(prev => {
      const currentList = prev[activeImagePath] || [];
      if (currentList.length === 0) return prev;
      return {
        ...prev,
        [activeImagePath]: currentList.slice(0, -1)
      };
    });
  };

  // ── Keyboard Shortcuts Listener ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const pressedKey = e.key.toLowerCase();

      if (e.key === 'ArrowLeft' || e.key === '[' || (pressedKey === 'b' && !labels.some(l => l.key.toLowerCase() === 'b'))) {
        handlePrevImage();
      }
      if (e.key === 'ArrowRight' || e.key === ']' || (pressedKey === 'n' && !labels.some(l => l.key.toLowerCase() === 'n'))) {
        handleNextImage();
      }

      if (e.key === 'Enter' && drawMode === 'polygon' && drawingPts.length >= 3) {
        finishPolygon();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (drawMode === 'polygon' && drawingPts.length > 0) {
          setDrawingPts(prev => prev.slice(0, -1));
        } else if (drawMode === 'circle' && circleCenter) {
          setCircleCenter(null);
          setCircleRadius(null);
        } else {
          undoLastRoi();
        }
        return;
      }

      const matchedLabel = labels.find(l => l.key.toLowerCase() === pressedKey);
      if (matchedLabel) {
        setActiveLabelId(matchedLabel.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [labels, drawingPts, circleCenter, drawMode, currentIndex, imageList, segmentations, activeImagePath]);

  // ── Coordinate conversion ───────────────────────────────────────────────────
  const getCoords = (e) => {
    const img = imgRef.current;
    if (!img || !currentResults?.shape || !Array.isArray(currentResults.shape)) return null;
    const rect = img.getBoundingClientRect();
    const w = currentResults.shape[1] || 320;
    const h = currentResults.shape[0] || 240;
    return {
      px:  (e.clientX - rect.left) * (w / rect.width),
      py:  (e.clientY - rect.top)  * (h / rect.height),
      pct: {
        x: ((e.clientX - rect.left) / rect.width)  * 100,
        y: ((e.clientY - rect.top)  / rect.height) * 100,
      },
    };
  };

  // ── File and Folder Input Handlers (Dual-Mode: Desktop + Web) ───────────────
  const handleBrowseSingle = async () => {
    if (window.electronAPI && window.electronAPI.openFileDialog) {
      const p = await api.openFileDialog();
      if (p) {
        setFilePath(p);
        setAppMode('single');
      }
    } else {
      if (singleFileInputRef.current) singleFileInputRef.current.click();
    }
  };

  const handleBrowseFolder = async () => {
    if (window.electronAPI && window.electronAPI.openFolderDialog) {
      const folder = await api.openFolderDialog();
      if (folder) {
        setFolderPath(folder);
        const files = await api.listFolderImages(folder);
        setImageList(files);
        setCurrentIndex(0);
        setAppMode('bulk');

        try {
          const existing = await api.checkExistingAnnotation(folder);
          if (existing && existing.segmentations && Object.keys(existing.segmentations).length > 0) {
            setDraftToRestore(existing);
            setShowRestoreModal(true);
          }
        } catch (e) {
          console.error('Annotation check error:', e);
        }
      }
    } else {
      if (folderInputRef.current) folderInputRef.current.click();
    }
  };

  const handleSingleFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const name = file.name;
    setFileObjMap(prev => ({ ...prev, [name]: file }));
    setFilePath(name);
    setAppMode('single');
  };

  const handleFolderInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
    const imgFiles = files.filter(f => validExts.some(ext => f.name.toLowerCase().endsWith(ext)));

    if (imgFiles.length === 0) {
      alert('No thermal images (.jpg, .png, .tiff) found in the selected folder.');
      return;
    }

    imgFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const folderName = imgFiles[0].webkitRelativePath ? imgFiles[0].webkitRelativePath.split('/')[0] : 'Thermal_Sequence';
    setFolderPath(folderName);

    const fMap = {};
    const names = [];
    imgFiles.forEach(f => {
      const key = f.webkitRelativePath || f.name;
      fMap[key] = f;
      names.push(key);
    });

    setFileObjMap(prev => ({ ...prev, ...fMap }));
    setImageList(names);
    setCurrentIndex(0);
    setAppMode('bulk');

    // If an annotation session was waiting for images to be selected
    if (pendingSession) {
      applyLoadedSession(pendingSession, names);
      setPendingSession(null);
      setShowNeedImagesModal(false);
      alert(`✓ Successfully linked loaded annotations with ${names.length} images in "${folderName}"!`);
      return;
    }

    // Check if annotations_session.json exists in the uploaded folder
    const jsonFile = files.find(f => f.name === 'annotations_session.json');
    if (jsonFile) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const sessionData = JSON.parse(ev.target.result);
          setDraftToRestore(sessionData);
          setShowRestoreModal(true);
        } catch {}
      };
      reader.readAsText(jsonFile);
    }
  };

  const handleAnnotationFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const sessionData = JSON.parse(ev.target.result);
        if (imageList && imageList.length > 0) {
          applyLoadedSession(sessionData, imageList);
          alert(`✓ Loaded annotations from "${file.name}" and matched with ${imageList.length} active images!`);
        } else {
          // Store pending session and prompt user to upload the image folder
          setPendingSession(sessionData);
          if (sessionData.labels && Array.isArray(sessionData.labels)) {
            setLabels(sessionData.labels);
            if (sessionData.labels.length > 0) setActiveLabelId(sessionData.labels[0].id);
          }
          setShowNeedImagesModal(true);
        }
      } catch (err) {
        alert(`Failed to load annotation session: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // Check if user dropped a ZIP package (e.g. {ParentFolder}_Result.zip)
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const imgExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
        const fMap = {};
        const names = [];
        let sessionJson = null;

        const entries = Object.keys(zip.files);
        for (const filename of entries) {
          const entry = zip.files[filename];
          if (entry.dir) continue;
          const baseName = filename.split('/').pop();
          if (baseName.toLowerCase() === 'annotations_session.json') {
            const jsonStr = await entry.async('string');
            sessionJson = JSON.parse(jsonStr);
          } else if (imgExts.some(ext => baseName.toLowerCase().endsWith(ext)) && !filename.includes('_isolated_labels')) {
            const blob = await entry.async('blob');
            fMap[baseName] = blob;
            names.push(baseName);
          }
        }

        if (names.length > 0) {
          names.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
          setFileObjMap(prev => ({ ...prev, ...fMap }));
          setImageList(names);
          setFolderPath(zipFile.name.replace(/\.[^/.]+$/, ''));
          setCurrentIndex(0);
          setAppMode('bulk');
          if (sessionJson) {
            applyLoadedSession(sessionJson, names);
          }
          alert(`✓ Unpacked ${names.length} images ${sessionJson ? 'and restored annotations session' : ''} from ${zipFile.name}!`);
          return;
        }
      } catch (zipErr) {
        console.error('ZIP unpack error:', zipErr);
      }
    }

    if (files.length > 1) {
      const validExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
      const imgFiles = files.filter(f => validExts.some(ext => f.name.toLowerCase().endsWith(ext)));
      if (imgFiles.length > 0) {
        imgFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        const fMap = {};
        const names = [];
        imgFiles.forEach(f => {
          fMap[f.name] = f;
          names.push(f.name);
        });
        setFileObjMap(prev => ({ ...prev, ...fMap }));
        setImageList(names);
        setFolderPath('Thermal_Sequence');
        setCurrentIndex(0);
        setAppMode('bulk');

        if (pendingSession) {
          applyLoadedSession(pendingSession, names);
          setPendingSession(null);
          setShowNeedImagesModal(false);
        }
        return;
      }
    }

    const f = files[0];
    if (f.name.toLowerCase().endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (imageList && imageList.length > 0) {
            applyLoadedSession(data, imageList);
            alert(`✓ Matched annotations from "${f.name}" to ${imageList.length} active images!`);
          } else {
            setPendingSession(data);
            if (data.labels && Array.isArray(data.labels)) {
              setLabels(data.labels);
              if (data.labels.length > 0) setActiveLabelId(data.labels[0].id);
            }
            setShowNeedImagesModal(true);
          }
        } catch (err) {
          alert('Invalid JSON annotation session.');
        }
      };
      reader.readAsText(f);
    } else {
      setFileObjMap(prev => ({ ...prev, [f.name]: f }));
      setFilePath(f.name);
      setAppMode('single');
    }
  };

  const inFlightRef = useRef(new Set());

  // ── Background Image Analysis & Pre-fetch Queue (Dual-Mode) ───────────────────
  useEffect(() => {
    let isSubscribed = true;

    async function processAnalysisQueue() {
      if (!activeImagePath) return;

      // 1. Prioritize currently active image if not analyzed yet
      if (!resultsMap[activeImagePath] && !inFlightRef.current.has(activeImagePath)) {
        inFlightRef.current.add(activeImagePath);
        setIsProcessing('analysis');
        try {
          const fileObj = fileObjMap[activeImagePath] || activeImagePath;
          let res;
          if (!window.electronAPI) {
            // 100% Client-Side Pure JavaScript Engine
            const imgData = await loadThermalImageData(fileObj);
            const stem = activeImagePath.split(/[\\/]/).pop().split('.')[0];
            res = runClientThermalAnalysis(imgData.tempMatrix, imgData.width, imgData.height, stem);
            setTerminalLogs(prev => [...prev.slice(-200), {
              id: Date.now() + Math.random(),
              type: 'info',
              text: `[CLIENT ENGINE] Analyzed ${stem} (${imgData.width}x${imgData.height}) in Browser (Zero Python)`,
              timestamp: new Date().toLocaleTimeString()
            }]);
          } else {
            const outDir = activeImagePath + '_analysis';
            res = await api.runAnalysis(activeImagePath, outDir);
          }
          if (isSubscribed) {
            setResultsMap(prev => ({ ...prev, [activeImagePath]: res }));
            setImgTs(Date.now());
            setActivePanel('original');
          }
        } catch (err) {
          console.error(`Analysis error for ${activeImagePath}:`, err);
        } finally {
          inFlightRef.current.delete(activeImagePath);
          if (isSubscribed) setIsProcessing(null);
        }
      }

      // 2. In bulk mode, pre-analyze all remaining images in background queue
      if (appMode === 'bulk' && imageList.length > 0) {
        const queue = [
          ...imageList.slice(currentIndex + 1),
          ...imageList.slice(0, currentIndex)
        ];

        for (const targetPath of queue) {
          if (!isSubscribed) break;
          if (resultsMap[targetPath] || inFlightRef.current.has(targetPath)) continue;

          inFlightRef.current.add(targetPath);
          try {
            const fileObj = fileObjMap[targetPath] || targetPath;
            let res;
            if (!window.electronAPI) {
              const imgData = await loadThermalImageData(fileObj);
              const stem = targetPath.split(/[\\/]/).pop().split('.')[0];
              res = runClientThermalAnalysis(imgData.tempMatrix, imgData.width, imgData.height, stem);
            } else {
              const outDir = targetPath + '_analysis';
              res = await api.runAnalysis(targetPath, outDir);
            }
            if (isSubscribed) {
              setResultsMap(prev => ({ ...prev, [targetPath]: res }));
            }
          } catch (err) {
            console.error(`Background pre-fetch error for ${targetPath}:`, err);
          } finally {
            inFlightRef.current.delete(targetPath);
          }
        }
      }
    }

    processAnalysisQueue();

    return () => { isSubscribed = false; };
  }, [activeImagePath, appMode, imageList, currentIndex, fileObjMap]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1) {
      setDrawingPts([]);
      setCircleCenter(null);
      setCircleRadius(null);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      setDrawingPts([]);
      setCircleCenter(null);
      setCircleRadius(null);
      setCurrentIndex(prev => prev - 1);
    }
  };

  // ── Calibration Handlers (Per-Image Mapping) ─────────────────────────────────
  const resetCalib = () => {
    setCalibMode('idle');
    setCalibPt1(null);
    setCalibPt2(null);
    setShowDistInput(false);
  };

  const startCalib = () => {
    resetCalib();
    setCalibMode('pt1');
  };

  const confirmCalib = () => {
    if (!calibPt1 || !calibPt2) return;
    const d = Math.hypot(calibPt2.px - calibPt1.px, calibPt2.py - calibPt1.py);
    const cm = parseFloat(calibDist);
    if (!cm || cm <= 0) { alert('Enter a valid real distance > 0 cm'); return; }
    
    const scale = d / cm;
    if (activeImagePath) {
      setCalibrationsMap(prev => ({
        ...prev,
        [activeImagePath]: { pxPerCm: scale, dist_cm: cm, pt1: calibPt1, pt2: calibPt2 }
      }));
    }
    setShowDistInput(false);
    setCalibMode('idle');
    setCalibPt1(null);
    setCalibPt2(null);
  };

  // ── Standalone 8-Point Star Measurement Tool ────────────────────────────────
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
    if (!activePxPerCm) { alert('Please calibrate pixel scale for this image first!'); return; }
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
    if (starCentre && currentResults?.shape) {
      const dist_cm = parseFloat(starDist) || 2.0;
      const dist_px = dist_cm * (activePxPerCm || 10);
      const ov = buildStarOverlay(starCentre.px, starCentre.py, dist_px, newRot, currentResults.shape);
      setStarOverlay(ov);
    }
  };

  const saveStar = async () => {
    if (!starCentre || !currentResults) return;
    setStarStep('saving');
    const dist_cm = parseFloat(starDist) || 2.0;
    try {
      let res;
      if (!window.electronAPI && currentResults.raw?.tempMatrix) {
        res = clientMeasureStar(
          currentResults.raw.tempMatrix,
          currentResults.raw.width,
          currentResults.raw.height,
          starCentre.px,
          starCentre.py,
          dist_cm,
          starRot,
          activePxPerCm || 10
        );
      } else {
        res = await api.measureStar(
          activeImagePath, starCentre.px, starCentre.py,
          dist_cm, starRot, activePxPerCm || 10, currentResults.out_dir
        );
      }
      setStarResults(res);
      setStarStep('done');
    } catch (err) {
      alert(`Star calculation failed:\n${err}`);
      setStarStep('align');
    }
  };

  // ── Segmentation Drawing Handlers (1:1 Strict Circle Default + Pen) ─────────
  const activeLabelObj = labels.find(l => l.id === activeLabelId) || labels[0];

  const handleImageClick = async (e) => {
    const c = getCoords(e);
    if (!c) return;

    // Calibration Clicks (Shift key snaps straight horizontal/vertical)
    if (calibMode === 'pt1') {
      setCalibPt1(c);
      setCalibMode('pt2');
      setCalibPreviewPt(c);
      return;
    }
    if (calibMode === 'pt2') {
      const finalPt2 = (e.shiftKey && calibPt1) ? snapStraightPoint(calibPt1, c) : c;
      setCalibPt2(finalPt2);
      setCalibPreviewPt(null);
      setCalibMode('idle');
      setShowDistInput(true);
      return;
    }

    // Standalone Star Tool Placement
    if (starStep === 'place') {
      const dist_cm = parseFloat(starDist) || 2.0;
      const dist_px = dist_cm * (activePxPerCm || 10);
      setStarCentre(c);
      if (currentResults?.shape) {
        const ov = buildStarOverlay(c.px, c.py, dist_px, starRot, currentResults.shape);
        setStarOverlay(ov);
      }
      setStarStep('align');
      return;
    }

    // 1:1 Strict Circle Segmentation Mode (Default)
    if (drawMode === 'circle' && !starStep) {
      if (!circleCenter) {
        // Step 1: Place Center
        setCircleCenter(c);
        setCircleRadius(15);
      } else {
        // Step 2: Confirm Circle Radius
        const dist_px = Math.max(4, Math.hypot(c.px - circleCenter.px, c.py - circleCenter.py));
        
        // Generate 36 circular polygon vertices for universal rasterizer/masking compatibility
        const polyPoints = [];
        for (let i = 0; i < 36; i++) {
          const a = (i * 10 * Math.PI) / 180.0;
          polyPoints.push({
            x: circleCenter.px + dist_px * Math.cos(a),
            y: circleCenter.py + dist_px * Math.sin(a),
          });
        }

        const newRoi = {
          id: 'roi_' + Date.now(),
          type: 'circle',
          cx: circleCenter.px,
          cy: circleCenter.py,
          radius: dist_px,
          labelName: activeLabelObj.name,
          color: activeLabelObj.color,
          points: polyPoints,
        };

        // Compute the 8-Point Star Gradient inside this label
        if (currentResults?.raw?.tempMatrix && currentResults?.shape) {
          const [H, W] = currentResults.shape;
          newRoi.star = computeLabelStarGradient(currentResults.raw.tempMatrix, W, H, newRoi, activePxPerCm);
        }

        setSegmentations(prev => ({
          ...prev,
          [activeImagePath]: [...(prev[activeImagePath] || []), newRoi]
        }));

        setCircleCenter(null);
        setCircleRadius(null);
      }
      return;
    }

    // Polygon Pen Tool Drawing Mode
    if (drawMode === 'polygon' && !starStep) {
      setDrawingPts(prev => [...prev, c]);
    }
  };

  const handleImageMouseMove = (e) => {
    const c = getCoords(e);
    if (!c) return;

    if (calibMode === 'pt2' && calibPt1) {
      const effective = e.shiftKey ? snapStraightPoint(calibPt1, c) : c;
      setCalibPreviewPt(effective);
    }

    if (drawMode === 'circle' && circleCenter) {
      const r = Math.max(4, Math.hypot(c.px - circleCenter.px, c.py - circleCenter.py));
      setCircleRadius(r);
    }
  };

  const finishPolygon = () => {
    if (drawingPts.length < 3) {
      alert('A polygon requires at least 3 points.');
      return;
    }
    const newRoi = {
      id: 'roi_' + Date.now(),
      type: 'polygon',
      labelName: activeLabelObj.name,
      color: activeLabelObj.color,
      points: drawingPts.map(p => ({ x: p.px, y: p.py })),
    };

    if (currentResults?.raw?.tempMatrix && currentResults?.shape) {
      const [H, W] = currentResults.shape;
      newRoi.star = computeLabelStarGradient(currentResults.raw.tempMatrix, W, H, newRoi, activePxPerCm);
    }

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

  const startEditLabel = (labelObj) => {
    setEditingLabelId(labelObj.id);
    setEditName(labelObj.name);
    setEditKey(labelObj.key);
    setEditColor(labelObj.color);
  };

  const cancelLabelEdit = () => {
    setEditingLabelId(null);
  };

  const saveLabelEdit = () => {
    if (!editName.trim()) { alert('Label name cannot be empty'); return; }
    if (!editKey.trim())  { alert('Shortcut key is required'); return; }

    const keyLower = editKey.trim().toLowerCase();
    if (!/^[a-z]$/.test(keyLower)) { alert('Shortcut key must be a single letter a-z'); return; }

    const duplicate = labels.find(l => l.id !== editingLabelId && l.key.toLowerCase() === keyLower);
    if (duplicate) {
      alert(`Shortcut key '${keyLower}' is already assigned to '${duplicate.name}'!`);
      return;
    }

    const targetLabel = labels.find(l => l.id === editingLabelId);
    if (!targetLabel) return;
    const oldName = targetLabel.name;
    const newName = editName.trim();

    setLabels(prev => prev.map(l => l.id === editingLabelId ? {
      ...l,
      name: newName,
      key: keyLower,
      color: editColor
    } : l));

    if (oldName !== newName || targetLabel.color !== editColor) {
      setSegmentations(prev => {
        const updated = {};
        Object.keys(prev).forEach(img => {
          updated[img] = (prev[img] || []).map(roi => {
            if (roi.labelName === oldName) {
              return { ...roi, labelName: newName, color: editColor };
            }
            return roi;
          });
        });
        return updated;
      });
    }

    setEditingLabelId(null);
  };

  // ── Save Label & Master Export Action (Calibration Gated) ───────────────────
  const handleSaveLabels = async () => {
    const totalSegs = Object.values(segmentations).flat().length;
    if (totalSegs === 0) {
      alert('No segmentations created yet. Draw at least 1 ROI on an image first.');
      return;
    }

    const targetPaths = appMode === 'bulk' ? imageList : [filePath];

    // ── Strict Calibration Verification: Every image must be calibrated 1-by-1 ──
    for (let i = 0; i < targetPaths.length; i++) {
      const p = targetPaths[i];
      const calib = calibrationsMap[p]?.pxPerCm;
      if (!calib || calib <= 0) {
        const imgName = p.split(/[\\/]/).pop();
        alert(`⚠️ Calibration Required:\nImage #${i + 1} (${imgName}) is not calibrated yet.\n\nIn Bulk Mode, each image must be calibrated 1-by-1 before exporting the Result package.\n\nNavigating to Image #${i + 1} now so you can calibrate it.`);
        setCurrentIndex(i);
        startCalib();
        setIsProcessing(null);
        return;
      }
    }

    setIsProcessing('saving');
    const aggregatedStats = {};

    // Build {Parentfoldername}_Result master folder
    const basePath = folderPath || activeImagePath;
    const parentFolderName = basePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '');
    const resultDir = basePath + '_Result';
    const isolatedDir = `${resultDir}/${parentFolderName}_isolated_labels`;

    try {
      for (let imgIdx = 0; imgIdx < targetPaths.length; imgIdx++) {
        const imgPath = targetPaths[imgIdx];
        const rois = segmentations[imgPath] || [];
        if (rois.length === 0) continue;

        const pictureName = imgPath.split(/[\\/]/).pop().split('.')[0];
        const proto = getProtocolStep(imgIdx);
        const imgResult = resultsMap[imgPath];
        const imgScale = calibrationsMap[imgPath]?.pxPerCm || 10;
        
        for (let i = 0; i < rois.length; i++) {
          const roi = rois[i];
          let res;
          if (!window.electronAPI && imgResult?.raw?.tempMatrix) {
            res = clientCropPolygonROI(
              imgResult.raw.tempMatrix,
              imgResult.raw.width,
              imgResult.raw.height,
              roi.points,
              roi.labelName,
              i + 1,
              imgScale,
              roi
            );
          } else {
            res = await api.cropLabels(imgPath, roi.points, roi.labelName, i + 1, isolatedDir);
          }

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
            gradient_max: res.gradient_max || res.star?.gradient_max || 0,
            gradient_modus: res.gradient_modus || res.star?.gradient_modus || '',
            star_center_temp: res.star_center_temp || res.star?.temp_centre || 0,
            star_radius_cm: res.star_radius_cm || res.star?.radius_cm || 0,
            star: res.star,
            csv_path: res.csv_path || `${pictureName}_roi_${i+1}_${roi.labelName}.csv`,
            protocol: proto,
            croppedPngDataUrl: res.croppedPngDataUrl,
            csvContent: res.csvContent,
            starCsvContent: res.starCsvContent,
          });
        }
      }

      // Assemble Summary CSVs and SVG Graphs for {Parentfoldername}_Result
      const exportFilesMap = {};
      const compassHeaders = COMPASS.map(c => `grad_${c}_c_per_cm`).join(',');

      let masterCsv = `step,picture_name,session_name,timestamp_min,label,mean_temp,min_temp,max_temp,std_temp,pixel_count,gradient_max_c_per_cm,gradient_modus,star_center_temp,star_radius_cm,${compassHeaders}\n`;

      Object.keys(aggregatedStats).forEach(labelName => {
        const series = aggregatedStats[labelName];
        let labelCsv = `step,picture_name,session_name,timestamp_min,label,mean_temp,min_temp,max_temp,std_temp,pixel_count,gradient_max_c_per_cm,gradient_modus,star_center_temp,star_radius_cm,${compassHeaders}\n`;

        series.forEach((s, idx) => {
          const proto = getProtocolStep(idx);
          const starPts = s.star?.points || {};
          const compassGrads = COMPASS.map(c => (starPts[c]?.grad ?? 0).toFixed(4)).join(',');
          const row = `${idx + 1},${s.pictureName},"${proto.sessionName}",${proto.timestampMin},${labelName},${s.mean_temp},${s.min_temp},${s.max_temp},${s.std_temp},${s.pixel_count},${s.gradient_max},"${s.gradient_modus}",${s.star_center_temp},${s.star_radius_cm},${compassGrads}\n`;
          labelCsv += row;
          masterCsv += row;
        });

        // Write label summary CSV e.g. m1_summary.csv, m2_summary.csv
        exportFilesMap[`${labelName}_summary.csv`] = labelCsv;

        // Generate Dark and White SVG Graphs per label
        exportFilesMap[`graph_${labelName}_dark.svg`] = generateGraphSvg(labelName, series, 'dark');
        exportFilesMap[`graph_${labelName}_white.svg`] = generateGraphSvg(labelName, series, 'white');
      });

      exportFilesMap[`master_summary_all_labels.csv`] = masterCsv;

      // If first label exists, also save default analytics_graph_dark.svg and analytics_graph_white.svg
      const firstLabel = Object.keys(aggregatedStats)[0];
      if (firstLabel) {
        exportFilesMap[`analytics_graph_dark.svg`] = generateGraphSvg(firstLabel, aggregatedStats[firstLabel], 'dark');
        exportFilesMap[`analytics_graph_white.svg`] = generateGraphSvg(firstLabel, aggregatedStats[firstLabel], 'white');
      }

      const masterData = {
        exportedAt: new Date().toISOString(),
        folderPath,
        labels,
        segmentations,
        calibrationsMap,
        aggregatedStats,
      };

      if (window.electronAPI && api.exportResultPackage) {
        await api.exportResultPackage(resultDir, exportFilesMap);
        await api.saveMasterJson(resultDir, masterData);
        await api.clearDraft();
      } else {
        // Pure Client-Side ZIP Generation for Web
        const zip = new JSZip();
        const rootFolder = zip.folder(`${parentFolderName}_Result`);
        const isolatedFolder = rootFolder.folder(`${parentFolderName}_isolated_labels`);

        Object.keys(aggregatedStats).forEach(labelName => {
          const series = aggregatedStats[labelName];
          series.forEach(s => {
            if (s.croppedPngDataUrl) {
              const base64Data = s.croppedPngDataUrl.split(',')[1];
              isolatedFolder.file(`${s.pictureName}_roi_${s.roiIndex}_${labelName}.png`, base64Data, { base64: true });
            }
            if (s.csvContent) {
              isolatedFolder.file(`${s.pictureName}_roi_${s.roiIndex}_${labelName}.csv`, s.csvContent);
            }
            if (s.starCsvContent) {
              isolatedFolder.file(`${s.pictureName}_roi_${s.roiIndex}_${labelName}_gradient_star.csv`, s.starCsvContent);
            }
          });
        });

        for (const [fname, content] of Object.entries(exportFilesMap)) {
          rootFolder.file(fname, content);
        }
        rootFolder.file('annotations_session.json', JSON.stringify(masterData, null, 2));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${parentFolderName}_Result.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        localStorage.removeItem('thermalsight_draft');
      }

      setAnalyticsData(aggregatedStats);
      setShowAnalytics(true);
      alert(`Success! Complete Time-Series Result Package (${parentFolderName}_Result.zip) generated successfully!\n\nIncludes:\n- ${parentFolderName}_isolated_labels/\n  * Cropped PNGs with 8-Point Star Gradients\n  * Thermal Pixel CSVs\n  * Detailed 8-Point Gradient CSVs\n- Summary CSVs with all 8 directional gradients (m1, m2, m3...)\n- Dark & White SVG Analytics Graphs\n- annotations_session.json`);
    } catch (err) {
      alert(`Export failed:\n${err.message || err}`);
    }
    setIsProcessing(null);
  };

  // ── Restore / Apply Loaded Annotation Session ─────────────────────────────────
  const applyLoadedSession = async (sessionData, currentFiles = null) => {
    if (!sessionData) return;

    if (sessionData.labels && Array.isArray(sessionData.labels)) {
      setLabels(sessionData.labels);
      if (sessionData.labels.length > 0) setActiveLabelId(sessionData.labels[0].id);
    }

    if (sessionData.aggregatedStats) {
      setAnalyticsData(sessionData.aggregatedStats);
    }

    let activeFiles = currentFiles || imageList;
    if ((!activeFiles || activeFiles.length === 0) && sessionData.segmentations) {
      const segKeys = Object.keys(sessionData.segmentations);
      if (segKeys.length > 0) {
        setImageList(segKeys);
        setCurrentIndex(0);
        setAppMode(segKeys.length > 1 ? 'bulk' : 'single');
        activeFiles = segKeys;
      }
    }

    if (sessionData.folderPath && (!activeFiles || activeFiles.length === 0)) {
      if (window.electronAPI && api.listFolderImages) {
        const files = await api.listFolderImages(sessionData.folderPath);
        if (files && files.length > 0) {
          setFolderPath(sessionData.folderPath);
          setImageList(files);
          setCurrentIndex(0);
          setAppMode('bulk');
          activeFiles = files;
        }
      }
    }

    // Remap calibrationsMap with basename tolerance
    if (sessionData.calibrationsMap) {
      const incomingCalib = sessionData.calibrationsMap;
      const baseCalibMap = {};
      Object.keys(incomingCalib).forEach(key => {
        const base = key.split(/[\\/]/).pop();
        baseCalibMap[base] = incomingCalib[key];
      });

      if (activeFiles && activeFiles.length > 0) {
        const remappedCalib = {};
        activeFiles.forEach(fPath => {
          const base = fPath.split(/[\\/]/).pop();
          if (incomingCalib[fPath]) {
            remappedCalib[fPath] = incomingCalib[fPath];
          } else if (baseCalibMap[base]) {
            remappedCalib[fPath] = baseCalibMap[base];
          }
        });
        setCalibrationsMap(remappedCalib);
      } else {
        setCalibrationsMap(incomingCalib);
      }
    }

    // Remap segmentations with basename tolerance
    if (sessionData.segmentations) {
      const incomingSegs = sessionData.segmentations;
      const basenameMap = {};
      Object.keys(incomingSegs).forEach(key => {
        const base = key.split(/[\\/]/).pop();
        basenameMap[base] = incomingSegs[key];
      });

      if (activeFiles && activeFiles.length > 0) {
        const remapped = {};
        activeFiles.forEach(fPath => {
          const base = fPath.split(/[\\/]/).pop();
          if (incomingSegs[fPath]) {
            remapped[fPath] = incomingSegs[fPath];
          } else if (basenameMap[base]) {
            remapped[fPath] = basenameMap[base];
          } else {
            remapped[fPath] = [];
          }
        });
        setSegmentations(remapped);
      } else {
        setSegmentations(incomingSegs);
      }
    }
  };

  const handleOpenAnnotationSession = async () => {
    if (window.electronAPI && window.electronAPI.openAnnotationDialog) {
      try {
        const filePath = await api.openAnnotationDialog();
        if (!filePath) return;

        const sessionData = await api.loadAnnotationFile(filePath);
        if (!sessionData) {
          alert('Could not read annotation session file.');
          return;
        }

        await applyLoadedSession(sessionData);
        alert(`Loaded annotation session successfully from:\n${filePath}`);
      } catch (err) {
        alert(`Failed to load annotation session:\n${err.message || err}`);
      }
    } else {
      if (annotationFileInputRef.current) annotationFileInputRef.current.click();
    }
  };

  // ── macOS Gatekeeper & Permission Handlers ────────────────────────────────────
  const handleRunMacFix = async () => {
    if (!api.runMacPermissionFix) return;
    try {
      setBackendDiagnostics({ status: 'testing' });
      const res = await api.runMacPermissionFix();
      if (res.status === 'ok') {
        const diag = await api.testBackendConnection();
        if (diag.success) {
          setBackendDiagnostics({ status: 'ok', msg: 'Backend verified' });
          alert('✓ Auto-fix applied and Python backend successfully verified!');
        } else {
          setBackendDiagnostics({ status: 'error', error: diag.error });
          alert(`Auto-fix executed, but Gatekeeper might still block terminal execution.\n\nPlease copy and run this command in Terminal:\n${res.command}`);
        }
      } else {
        alert(`Could not clear quarantine automatically:\n${res.error || res.message}\n\nPlease run the command in Terminal.`);
      }
    } catch (e) {
      alert(`Error running permission fix: ${e.message}`);
    }
  };

  const handleCopyMacCommand = (cmd = 'xattr -cr /Applications/thermalsight.app') => {
    navigator.clipboard.writeText(cmd);
    alert(`✓ Copied command to clipboard:\n\n${cmd}\n\n1. Open Terminal.app on your Mac\n2. Paste (Cmd+V) and press Return ↵\n3. Relaunch ThermalSight`);
  };

  const handleTestBackend = async () => {
    if (!api.testBackendConnection) return;
    setBackendDiagnostics({ status: 'testing' });
    const diag = await api.testBackendConnection();
    if (diag.success) {
      setBackendDiagnostics({ status: 'ok', msg: 'Backend verified' });
      alert('✓ Success! Python analyzer backend is active and functioning properly.');
    } else {
      setBackendDiagnostics({ status: 'error', error: diag.error });
      alert(`Backend test failed:\n${diag.error}\n\nPlease run the Terminal fix command.`);
    }
  };

  const restoreDraft = async () => {
    if (draftToRestore) {
      await applyLoadedSession(draftToRestore);
    }
    setShowRestoreModal(false);
  };

  const discardDraft = async () => {
    if (window.electronAPI && api.clearDraft) {
      await api.clearDraft();
    } else {
      localStorage.removeItem('thermalsight_draft');
    }
    setShowRestoreModal(false);
  };

  const openFolder = () => { if (currentResults?.out_dir && window.electronAPI) api.openPath(currentResults.out_dir); };
  const showCsv = (p) => { if (p && window.electronAPI) api.showItemInFolder(p); };

  const cursor = (calibMode !== 'idle' || starStep === 'place' || drawMode) ? 'crosshair' : 'default';
  const imgSrc = currentResults?.images?.[activePanel]
    ? toFileUrl(currentResults.images[activePanel]) : null;

  const currentRois = segmentations[activeImagePath] || [];

  return (
    <div className="app">

      {/* HIDDEN FILE INPUTS FOR BROWSER / WEB COMPATIBILITY */}
      <input type="file" ref={singleFileInputRef} accept="image/*" style={{ display: 'none' }}
             onChange={handleSingleFileInputChange} />
      <input type="file" ref={folderInputRef} webkitdirectory="true" directory="" multiple style={{ display: 'none' }}
             onChange={handleFolderInputChange} />
      <input type="file" ref={annotationFileInputRef} accept=".json" style={{ display: 'none' }}
             onChange={handleAnnotationFileInputChange} />

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

      {/* NEED IMAGES MODAL FOR LOADED JSON IN WEB */}
      {showNeedImagesModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '38px', marginBottom: '8px' }}>📂</div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text0)', marginBottom: '6px' }}>
              Annotation Session File Loaded!
            </h3>
            <p style={{ color: 'var(--text1)', fontSize: '12px', margin: '0 0 16px', lineHeight: '1.6' }}>
              Your ROI polygons and label definitions were read successfully. Because web browsers require you to select local files, please select or drop the folder of original thermal images to link them.
            </p>
            {pendingSession?.folderPath && (
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', fontSize: '11px', color: 'var(--cyan)' }}>
                Target Folder: <strong>{pendingSession.folderPath.split(/[\\/]/).pop()}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => { if (folderInputRef.current) folderInputRef.current.click(); }}>
                📁 Select Image Folder
              </button>
              <button className="btn-ghost" onClick={() => setShowNeedImagesModal(false)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS MODAL */}
      {showAnalytics && (
        <AnalyticsView analyticsData={analyticsData} onClose={() => setShowAnalytics(false)} />
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="analytics-card" style={{ maxWidth: '640px' }}>
            <div className="analytics-header">
              <div>
                <h2>⚙ ThermalSight Settings & Configurations</h2>
                <p className="subtext">Configure segmentation label variables, assigned shortcuts (a-z), and project output directories</p>
              </div>
              <button className="btn-ghost btn-tiny" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Label Management Section */}
              <div className="tool-card">
                <h4 className="card-title">🏷 Label & Single-Key Shortcut Assignments</h4>
                <div className="label-list">
                  {labels.map(l => (
                    editingLabelId === l.id ? (
                      <div key={l.id} className="label-edit-box">
                        <div className="label-edit-inputs">
                          <input className="field-input-sm" type="text" value={editName}
                                 onChange={e => setEditName(e.target.value)} placeholder="Label Name"/>
                          <input className="field-input-sm key-input" type="text" maxLength={1} value={editKey}
                                 onChange={e => setEditKey(e.target.value)} placeholder="a-z"/>
                          <input type="color" className="color-picker-input" value={editColor}
                                 onChange={e => setEditColor(e.target.value)} title="Pick Color"/>
                        </div>
                        <div className="label-edit-actions">
                          <button className="btn-primary btn-tiny" onClick={saveLabelEdit}>✓ Save</button>
                          <button className="btn-ghost btn-tiny" onClick={cancelLabelEdit}>✕ Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div key={l.id} className="label-item">
                        <span className="label-color-dot" style={{ backgroundColor: l.color }}/>
                        <span className="label-name-text">{l.name}</span>
                        <kbd className="label-key-badge">[{l.key.toUpperCase()}]</kbd>
                        <button className="btn-ghost btn-tiny" title="Edit Label" onClick={() => startEditLabel(l)}>✎ Edit</button>
                        {labels.length > 1 && (
                          <button className="btn-ghost btn-tiny" title="Delete Label" onClick={() => removeLabel(l.id)}>✕</button>
                        )}
                      </div>
                    )
                  ))}
                </div>

                <div className="add-label-box" style={{ marginTop: '8px' }}>
                  <input className="field-input-sm" type="text" placeholder="New Label (e.g. Component A)"
                         value={newLabelName} onChange={e => setNewLabelName(e.target.value)}/>
                  <input className="field-input-sm key-input" type="text" maxLength={1} placeholder="Key (a-z)"
                         value={newLabelKey} onChange={e => setNewLabelKey(e.target.value)}/>
                  <button className="btn-secondary btn-tiny" onClick={handleAddLabel}>+ Add Label</button>
                </div>
              </div>

              {/* Active Project & Output Path */}
              <div className="tool-card">
                <h4 className="card-title">📁 Currently Active Project & Outputs</h4>
                <div className="kv"><span>App Mode</span><span>{appMode === 'bulk' ? `Bulk Folder (${imageList.length} images)` : 'Single Image'}</span></div>
                <div className="kv"><span>Active Folder</span><span style={{ fontSize: '10px', wordBreak: 'break-all' }}>{folderPath || (filePath ? filePath.split(/[\\/]/).slice(0, -1).join('/') : 'None')}</span></div>
                {currentResults?.out_dir && (
                  <div className="kv"><span>Output Directory</span><span style={{ fontSize: '10px', wordBreak: 'break-all' }}>{currentResults.out_dir}</span></div>
                )}
                {window.electronAPI && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary btn-tiny" disabled={!currentResults?.out_dir} onClick={openFolder}>
                      📁 Open Output Directory in File Explorer
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="analytics-footer" style={{ marginTop: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setShowSettingsModal(false)}>Close Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT POPUP MODAL */}
      {showAboutModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', textAlign: 'center', padding: '28px' }}>
            <div style={{ fontSize: '42px', marginBottom: '8px' }}>🌡</div>
            <h3 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text0)', marginBottom: '4px' }}>ThermalSight</h3>
            <span className="brand-badge" style={{ fontSize: '12px', padding: '3px 10px' }}>v1.4.0 (Web & Desktop)</span>
            
            <p style={{ color: 'var(--text1)', fontSize: '13px', margin: '14px 0 20px', lineHeight: '1.6' }}>
              Thermal Gradient Analysis, 8-Point Star Measurement & Multi-Label Region Segmentation Tool.
            </p>

            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', textAlign: 'left', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                👨‍💻 Development Team & Github Links
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '600', color: 'var(--text0)' }}>Corneliox</span>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)', marginLeft: '8px' }}>(Lead Developer)</span>
                  </div>
                  <a className="btn-secondary btn-tiny" href="https://github.com/Corneliox" target="_blank" rel="noreferrer">
                    🌐 github.com/Corneliox
                  </a>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '600', color: 'var(--text0)' }}>Aditya42069</span>
                    <span style={{ fontSize: '11px', color: 'var(--accent2)', marginLeft: '8px' }}>(Co-Developer)</span>
                  </div>
                  <a className="btn-secondary btn-tiny" href="https://github.com/Aditya42069" target="_blank" rel="noreferrer">
                    🌐 github.com/Aditya42069
                  </a>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {window.electronAPI && (
                <button className="btn-secondary btn-tiny" onClick={() => { setShowAboutModal(false); setShowMacGuideModal(true); }}>
                  🍎 macOS Permission Guide
                </button>
              )}
              <a className="btn-primary" href="https://github.com/Corneliox/ThermalSight-App/releases" target="_blank" rel="noreferrer">
                📦 Check Releases & Downloads
              </a>
              <button className="btn-ghost" onClick={() => setShowAboutModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* macOS FIRST-LAUNCH & PERMISSIONS MODAL (Electron Only) */}
      {showMacGuideModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px', padding: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px' }}>🍎</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text0)', margin: 0 }}>
                    macOS First-Launch & Permissions Guide
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>Gatekeeper & Quarantine Setup for MacBook (Intel & Apple Silicon)</span>
                </div>
              </div>
              <button className="btn-ghost btn-tiny" onClick={() => setShowMacGuideModal(false)}>✕</button>
            </div>

            {/* Backend Status Banner */}
            {backendDiagnostics && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '16px',
                background: backendDiagnostics.status === 'ok' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 68, 68, 0.12)',
                border: `1px solid ${backendDiagnostics.status === 'ok' ? 'var(--green)' : 'var(--accent)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: backendDiagnostics.status === 'ok' ? 'var(--green)' : 'var(--accent)' }}>
                    {backendDiagnostics.status === 'ok' ? '✓ Python Analyzer Status: Connected & Verified' : '⚠️ Python Analyzer Status: Blocked by Gatekeeper'}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text1)' }}>
                    {backendDiagnostics.status === 'ok' ? 'Your Mac has granted execution access. All thermal panels are ready.' : 'macOS quarantined the backend binary. Run the 1-click terminal command below.'}
                  </p>
                </div>
                <button className="btn-secondary btn-tiny" onClick={handleTestBackend}>
                  {backendDiagnostics.status === 'testing' ? <span className="spinner"/> : '🧪 Test Again'}
                </button>
              </div>
            )}

            {/* Section 1: 1-Click Terminal Command */}
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--text0)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚡ Method 1: Instant 1-Click Terminal Fix (Recommended)</span>
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px', lineHeight: '1.5' }}>
                Open <strong>Terminal.app</strong>, paste this command, and press Enter to instantly remove Apple quarantine from the entire app bundle:
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg0)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-h)' }}>
                <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }}>
                  xattr -cr /Applications/thermalsight.app
                </code>
                <button className="btn-primary btn-tiny" onClick={() => handleCopyMacCommand('xattr -cr /Applications/thermalsight.app')}>
                  📋 Copy
                </button>
              </div>
            </div>

            {/* Section 2: In-App Auto Fix */}
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--text0)', marginBottom: '6px' }}>
                ⚡ Method 2: In-App Automatic Permission Fix
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '10px' }}>
                Attempts to grant chmod execution permissions and strip quarantine attributes internally.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary btn-tiny" onClick={handleRunMacFix}>
                  ⚡ Run Auto-Fix Permissions
                </button>
                <button className="btn-secondary btn-tiny" onClick={handleTestBackend}>
                  🧪 Run Backend Diagnostics
                </button>
              </div>
            </div>

            {/* Section 3: Manual Gatekeeper Override */}
            <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: '1.6', marginBottom: '16px' }}>
              <strong>If the app fails to open initially on macOS:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Right-click (Control-click) <code>thermalsight.app</code> in <code>/Applications</code> and select <strong>Open</strong>.</li>
                <li>Click <strong>Open Anyway</strong> in the dialog.</li>
                <li>Or open <strong>System Settings ➔ Privacy & Security</strong> and click <strong>Open Anyway</strong> at the bottom.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn-primary" onClick={() => setShowMacGuideModal(false)}>Got It / Close</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🌡</span>
          <span className="brand-name">ThermalSight</span>
          <span className="brand-badge">{isWeb ? '🌐 Online Web v1.4.0' : 'v1.4.0'}</span>
        </div>
        <div className="header-actions">
          {appMode === 'bulk' && imageList.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'var(--bg1)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button className="btn-ghost btn-tiny" disabled={currentIndex === 0} onClick={handlePrevImage} title="Previous Image (ArrowLeft / [ / b)">
                ◄ Prev
              </button>
              <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: '600', padding: '0 4px' }}>
                {currentIndex + 1} / {imageList.length}
              </span>
              <button className="btn-ghost btn-tiny" disabled={currentIndex === imageList.length - 1} onClick={handleNextImage} title="Next Image (ArrowRight / ] / n)">
                Next ►
              </button>
            </div>
          )}
          <button className="btn-ghost" title="Open Saved Annotation Session (annotations_session.json)" onClick={handleOpenAnnotationSession}>
            📂 Load Session
          </button>
          <button className="btn-ghost" title="Settings / Variable Configurations" onClick={() => setShowSettingsModal(true)}>
            ⚙ Settings
          </button>
          <button className="btn-ghost" title="About ThermalSight & Developer Credits" onClick={() => setShowAboutModal(true)}>
            ❓ About
          </button>
          {window.electronAPI && isMacPlatform && (
            <button
              className={`btn-ghost ${backendDiagnostics?.status === 'error' ? 'btn-danger' : ''}`}
              title="macOS Gatekeeper Permissions & Backend Setup Guide"
              onClick={() => setShowMacGuideModal(true)}
              style={{
                borderColor: backendDiagnostics?.status === 'error' ? 'var(--accent)' : undefined,
                color: backendDiagnostics?.status === 'error' ? 'var(--accent)' : undefined
              }}
            >
              🍎 Mac Setup
            </button>
          )}
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

            <div className="drop-zone" onClick={handleOpenAnnotationSession}>
              <div className="drop-icon">📂</div>
              <p className="drop-title">Open Saved Annotations</p>
              <p className="drop-sub">Load annotations_session.json or project session</p>
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
                <div style={{ fontSize: '10px', marginTop: '6px', textAlign: 'center' }}>
                  {calibrationsMap[activeImagePath]?.pxPerCm ? (
                    <span style={{ color: 'var(--green)', fontWeight: '600' }}>✓ Image Calibrated</span>
                  ) : (
                    <span style={{ color: 'var(--accent)', fontWeight: '600' }}>⚠️ Calibration Needed</span>
                  )}
                </div>
                <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'center' }}>
                  {Object.keys(resultsMap).length >= imageList.length ? (
                    <span style={{ color: 'var(--green)' }}>✓ All {imageList.length} Ready</span>
                  ) : (
                    <span style={{ color: 'var(--cyan)' }}>⚡ Background: {Object.keys(resultsMap).length}/{imageList.length} ready</span>
                  )}
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
            {window.electronAPI && (
              <button className="panel-btn" onClick={openFolder}>
                <span className="panel-icon">📁</span>
                <span className="panel-label">Output Folder</span>
              </button>
            )}

            {/* LIVE PROCESS TERMINAL CARD */}
            <div className="tool-card terminal-card">
              <div className="terminal-header" onClick={() => setIsTerminalOpen(!isTerminalOpen)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💻 Live Terminal
                  <span className="terminal-badge">{terminalLogs.length}</span>
                </h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-ghost btn-tiny" title="Clear Console" onClick={(e) => { e.stopPropagation(); setTerminalLogs([]); }}>🗑</button>
                  <button className="btn-ghost btn-tiny">{isTerminalOpen ? '▲' : '▼'}</button>
                </div>
              </div>

              {isTerminalOpen && (
                <div className="terminal-body">
                  <div className="terminal-logs">
                    {terminalLogs.length === 0 ? (
                      <div className="terminal-log-line info">Waiting for processing logs...</div>
                    ) : (
                      terminalLogs.map((log) => (
                        <div key={log.id} className={`terminal-log-line ${log.type}`}>
                          <span className="log-time">[{log.timestamp}]</span>
                          <span className="log-text">{log.text}</span>
                        </div>
                      ))
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                  <div className="terminal-footer">
                    <button className="btn-ghost btn-tiny" onClick={() => {
                      const text = terminalLogs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
                      navigator.clipboard.writeText(text);
                      alert('Terminal logs copied to clipboard!');
                    }}>📋 Copy Logs</button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* CENTRE AREA: THERMAL IMAGE CANVAS & OVERLAYS */}
          <div className="image-area">
            {!currentResults && activeImagePath && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px',
                background: 'var(--bg1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                textAlign: 'center',
                maxWidth: '460px',
                boxShadow: 'var(--shadow)'
              }}>
                <div className="spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }} />
                <h4 style={{ color: 'var(--text0)', fontSize: '15px', marginBottom: '6px' }}>
                  ⚡ Analyzing Thermal Matrix...
                </h4>
                <p style={{ color: 'var(--text2)', fontSize: '12px', wordBreak: 'break-all', marginBottom: '16px' }}>
                  {activeImagePath.split(/[\\/]/).pop()}
                </p>
                {!fileObjMap[activeImagePath] && isWeb && (
                  <div style={{ background: 'var(--bg0)', border: '1px solid var(--border-h)', padding: '10px 14px', borderRadius: '6px', fontSize: '11px', color: 'var(--accent2)' }}>
                    Image data not loaded in browser yet.<br/>
                    <button className="btn-secondary btn-tiny" style={{ marginTop: '8px' }} onClick={handleBrowseFolder}>
                      📁 Select Image Folder to Link
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentResults && (
              <div className="image-wrapper">
                {imgSrc && (
                  <img ref={imgRef} src={imgSrc} alt={activePanel}
                       className="thermal-img" style={{cursor}} draggable={false}
                       onClick={handleImageClick}
                       onMouseMove={handleImageMouseMove}/>
                )}

                {/* SVG OVERLAYS */}
                <svg className="ov-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Calibration Line */}
                  {calibPt1?.pct && calibPt2?.pct && (
                    <line x1={calibPt1.pct.x} y1={calibPt1.pct.y}
                          x2={calibPt2.pct.x} y2={calibPt2.pct.y}
                          stroke="#00e5ff" strokeWidth="0.5" strokeDasharray="1 0.6"/>
                  )}

                  {/* Live Calibration Line Preview (while setting Point 2) */}
                  {calibPt1?.pct && calibMode === 'pt2' && calibPreviewPt?.pct && (
                    <g>
                      <line x1={calibPt1.pct.x} y1={calibPt1.pct.y}
                            x2={calibPreviewPt.pct.x} y2={calibPreviewPt.pct.y}
                            stroke="#00e5ff" strokeWidth="0.6" strokeDasharray="1.2 0.8"/>
                      <circle cx={calibPreviewPt.pct.x} cy={calibPreviewPt.pct.y} r="0.8" fill="#00e5ff"/>
                    </g>
                  )}

                  {/* Standalone Star Spokes Tool */}
                  {starOverlay?.points && COMPASS.map(name => {
                    const pt = starOverlay.points[name];
                    if (!pt?.pct) return null;
                    const diff = starResults?.points?.[name]?.diff;
                    const col  = diffColor(diff);
                    return (
                      <line key={name} x1={starOverlay.cx} y1={starOverlay.cy}
                            x2={pt.pct.x} y2={pt.pct.y}
                            stroke={col} strokeWidth="0.4" opacity="0.85"/>
                    );
                  })}

                  {/* Saved ROI Polygons/Circles in RAM State */}
                  {currentResults?.shape && currentRois.map(roi => {
                    const [H, W] = currentResults.shape;
                    if (!roi?.points || !Array.isArray(roi.points) || roi.points.length === 0) return null;
                    const ptsStr = roi.points.map(p => `${(p.x/W)*100},${(p.y/H)*100}`).join(' ');
                    return (
                      <polygon key={roi.id} points={ptsStr}
                               fill={roi.color || '#ff4444'} fillOpacity="0.25"
                               stroke={roi.color || '#ff4444'} strokeWidth="0.6"/>
                    );
                  })}

                  {/* ── AUTOMATIC CENTERED 8-POINT STAR INSIDE EVERY ROI LABEL ── */}
                  {currentResults?.shape && currentRois.map(roi => {
                    const [H, W] = currentResults.shape;
                    const star = roi.star || (currentResults.raw?.tempMatrix ? computeLabelStarGradient(currentResults.raw.tempMatrix, W, H, roi, activePxPerCm) : null);
                    if (!star || !star.points) return null;

                    const cxPct = (star.cx / W) * 100;
                    const cyPct = (star.cy / H) * 100;
                    const rPctX = (star.radius_px / W) * 100;
                    const rPctY = (star.radius_px / H) * 100;

                    return (
                      <g key={`star-grp-${roi.id}`}>
                        {/* Bounding Radius Incircle Outline */}
                        <ellipse cx={cxPct} cy={cyPct} rx={rPctX} ry={rPctY}
                                 fill="none" stroke={roi.color || '#ff4444'} strokeWidth="0.35" strokeDasharray="1 1" opacity="0.75"/>

                        {/* 8 Radial Compass Spokes */}
                        {COMPASS.map(name => {
                          const p = star.points[name];
                          if (!p?.pct) return null;
                          const col = diffColor(p.diff);
                          return (
                            <line key={`spoke-${roi.id}-${name}`}
                                  x1={cxPct} y1={cyPct} x2={p.pct.x} y2={p.pct.y}
                                  stroke={col} strokeWidth="0.4" opacity="0.9"/>
                          );
                        })}

                        {/* Center 9th Point */}
                        <circle cx={cxPct} cy={cyPct} r="0.7" fill="#ffffff" stroke={roi.color || '#ff4444'} strokeWidth="0.3"/>
                      </g>
                    );
                  })}

                  {/* Live 1:1 Circle Drawing Preview */}
                  {currentResults?.shape && drawMode === 'circle' && circleCenter?.pct && circleRadius && (
                    <g>
                      <ellipse cx={circleCenter.pct.x} cy={circleCenter.pct.y}
                               rx={(circleRadius / currentResults.shape[1]) * 100}
                               ry={(circleRadius / currentResults.shape[0]) * 100}
                               fill={activeLabelObj.color} fillOpacity="0.2"
                               stroke={activeLabelObj.color} strokeWidth="0.7" strokeDasharray="1.5 1"/>
                      <circle cx={circleCenter.pct.x} cy={circleCenter.pct.y} r="0.8" fill={activeLabelObj.color}/>
                      <line x1={circleCenter.pct.x} y1={circleCenter.pct.y}
                            x2={circleCenter.pct.x + (circleRadius / currentResults.shape[1]) * 100}
                            y2={circleCenter.pct.y}
                            stroke={activeLabelObj.color} strokeWidth="0.4" strokeDasharray="0.5 0.5"/>
                    </g>
                  )}

                  {/* Current Drawing Polygon Draft */}
                  {currentResults && drawMode === 'polygon' && drawingPts.length > 0 && (
                    <g>
                      <polyline points={drawingPts.map(p => `${p.pct.x},${p.pct.y}`).join(' ')}
                                fill="none" stroke={activeLabelObj.color} strokeWidth="0.6" strokeDasharray="1 1"/>
                      {drawingPts.map((p, idx) => (
                        <circle key={idx} cx={p.pct.x} cy={p.pct.y} r="0.8" fill={activeLabelObj.color}/>
                      ))}
                    </g>
                  )}
                </svg>

                {/* Saved ROI Polygon Text Label Badges */}
                {currentResults?.shape && currentRois.map(roi => {
                  const [H, W] = currentResults.shape;
                  const star = roi.star || (currentResults.raw?.tempMatrix ? computeLabelStarGradient(currentResults.raw.tempMatrix, W, H, roi, activePxPerCm) : null);
                  let cxPct = 50, cyPct = 50;
                  if (star) {
                    cxPct = (star.cx / W) * 100;
                    cyPct = (star.cy / H) * 100;
                  } else if (roi?.points && roi.points.length > 0) {
                    cxPct = (roi.points.reduce((sum, p) => sum + p.x, 0) / roi.points.length / W) * 100;
                    cyPct = (roi.points.reduce((sum, p) => sum + p.y, 0) / roi.points.length / H) * 100;
                  }

                  return (
                    <div key={`lbl-${roi.id}`} className="polygon-label-tag"
                         style={{
                           left: `${cxPct}%`,
                           top: `${cyPct}%`,
                           borderColor: roi.color,
                           boxShadow: `0 0 8px ${roi.color}88`
                         }}>
                      <span className="polygon-label-dot" style={{ backgroundColor: roi.color }}/>
                      <span>{roi.labelName}</span>
                      {star?.dominant && <span style={{ fontSize: '9px', color: 'var(--cyan)', marginLeft: '4px' }}>[{star.dominant}]</span>}
                    </div>
                  );
                })}

                {/* Calibration Dots */}
                {calibPt1?.pct && <div className="ov-dot calib-dot" style={{left:`${calibPt1.pct.x}%`,top:`${calibPt1.pct.y}%`}}>1</div>}
                {calibPt2?.pct && <div className="ov-dot calib-dot" style={{left:`${calibPt2.pct.x}%`,top:`${calibPt2.pct.y}%`}}>2</div>}

                {/* Standalone Star Tool Dots */}
                {starOverlay && (
                  <div className="ov-dot centre-dot" style={{left:`${starOverlay.cx}%`,top:`${starOverlay.cy}%`}}>+</div>
                )}
                {starOverlay?.points && COMPASS.map(name => {
                  const pt   = starOverlay.points[name];
                  if (!pt?.pct) return null;
                  const diff = starResults?.points?.[name]?.diff;
                  const col  = diffColor(diff);
                  return (
                    <div key={name} className="ov-dot star-dot"
                         style={{left:`${pt.pct.x}%`, top:`${pt.pct.y}%`, borderColor: col}}>
                      <span className="star-dot-label">{name}</span>
                    </div>
                  );
                })}

                {/* Current Drawing Action Bar for 1:1 Circle & Pen */}
                {drawMode === 'circle' && circleCenter && (
                  <div className="drawing-toolbar">
                    <span>Placing 1:1 Circle <strong>{activeLabelObj.name}</strong> — Click again to set radius</span>
                    <button className="btn-ghost btn-tiny" onClick={() => { setCircleCenter(null); setCircleRadius(null); }}>Cancel</button>
                  </div>
                )}

                {drawMode === 'polygon' && drawingPts.length > 0 && (
                  <div className="drawing-toolbar">
                    <span>Drawing Pen <strong>{activeLabelObj.name}</strong> ({drawingPts.length} pts)</span>
                    <button className="btn-primary btn-tiny" disabled={drawingPts.length < 3} onClick={finishPolygon}>
                      ✓ Finish (Enter)
                    </button>
                    <button className="btn-ghost btn-tiny" onClick={() => setDrawingPts([])}>Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: TOOLS & CARDS */}
          <aside className="right-sidebar">

            {/* IMAGE INFO CARD */}
            {currentResults && (
              <div className="tool-card">
                <h4 className="card-title">Image Info</h4>
                <div className="kv"><span>File</span><span>{currentResults.stem}</span></div>
                <div className="kv"><span>Size</span><span>{currentResults.shape[1]}×{currentResults.shape[0]}</span></div>
                <div className="kv"><span>Scale</span><span>{activePxPerCm ? `✓ ${activePxPerCm.toFixed(2)} px/cm` : '⚠️ Uncalibrated'}</span></div>
                <div className="kv"><span>Min</span><span>{currentResults.temp_min?.toFixed(1)} °C</span></div>
                <div className="kv"><span>Max</span><span>{currentResults.temp_max?.toFixed(1)} °C</span></div>
                <div className="kv"><span>Mean</span><span>{currentResults.temp_mean?.toFixed(1)} °C</span></div>
              </div>
            )}

            {/* SEGMENTATION LABELING PANEL */}
            <div className="tool-card">
              <h4 className="card-title">🏷 Segmentation Labels</h4>
              
              {/* SEGMENTED TOOL SWITCHER: 1:1 CIRCLE (DEFAULT) VS PEN */}
              <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '10px' }}>
                <button
                  className={`btn-ghost btn-tiny ${drawMode === 'circle' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: drawMode === 'circle' ? 'var(--bg3)' : 'transparent',
                    color: drawMode === 'circle' ? 'var(--cyan)' : 'var(--text2)',
                    fontWeight: drawMode === 'circle' ? '700' : 'normal'
                  }}
                  onClick={() => { setDrawMode('circle'); setDrawingPts([]); }}
                >
                  ⭕ 1:1 Circle (Default)
                </button>
                <button
                  className={`btn-ghost btn-tiny ${drawMode === 'polygon' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: drawMode === 'polygon' ? 'var(--bg3)' : 'transparent',
                    color: drawMode === 'polygon' ? 'var(--accent2)' : 'var(--text2)',
                    fontWeight: drawMode === 'polygon' ? '700' : 'normal'
                  }}
                  onClick={() => { setDrawMode('polygon'); setCircleCenter(null); setCircleRadius(null); }}
                >
                  ✏️ Pen Polygon
                </button>
              </div>

              <div className="label-list">
                {labels.map(l => (
                  editingLabelId === l.id ? (
                    <div key={l.id} className="label-edit-box">
                      <div className="label-edit-inputs">
                        <input className="field-input-sm" type="text" value={editName}
                               onChange={e => setEditName(e.target.value)} placeholder="Label Name"/>
                        <input className="field-input-sm key-input" type="text" maxLength={1} value={editKey}
                               onChange={e => setEditKey(e.target.value)} placeholder="a-z"/>
                        <input type="color" className="color-picker-input" value={editColor}
                               onChange={e => setEditColor(e.target.value)} title="Pick Color"/>
                      </div>
                      <div className="label-edit-actions">
                        <button className="btn-primary btn-tiny" onClick={saveLabelEdit}>✓ Save</button>
                        <button className="btn-ghost btn-tiny" onClick={cancelLabelEdit}>✕ Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={l.id} className={`label-item ${activeLabelId === l.id ? 'active' : ''}`}
                         onClick={() => setActiveLabelId(l.id)}>
                      <span className="label-color-dot" style={{ backgroundColor: l.color }}/>
                      <span className="label-name-text">{l.name}</span>
                      <kbd className="label-key-badge">[{l.key.toUpperCase()}]</kbd>
                      <button className="btn-ghost btn-tiny" title="Edit Label" onClick={(e) => { e.stopPropagation(); startEditLabel(l); }}>✎ Edit</button>
                      {labels.length > 1 && (
                        <button className="btn-ghost btn-tiny" title="Delete Label" onClick={(e) => { e.stopPropagation(); removeLabel(l.id); }}>✕</button>
                      )}
                    </div>
                  )
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

              <div style={{ marginTop: '8px' }}>
                <button className="btn-secondary btn-tiny w-full" onClick={handleOpenAnnotationSession} title="Load existing annotations_session.json">
                  📂 Load Saved Annotations (.json)
                </button>
              </div>
            </div>

            {/* DRAWN ROIs LIST FOR ACTIVE IMAGE WITH 8-POINT STAR METRICS */}
            <div className="tool-card">
              <h4 className="card-title">📌 Image ROIs & 8-Star Gradients ({currentRois.length})</h4>
              {currentRois.length === 0 ? (
                <p className="subtext">
                  {drawMode === 'circle' ? 'Click center point, then click radius to place 1:1 circle.' : 'Click points on thermal image to draw ROI polygon.'}
                </p>
              ) : (
                <div className="roi-list">
                  {currentRois.map((roi, idx) => {
                    const [H, W] = currentResults?.shape || [240, 320];
                    const star = roi.star || (currentResults?.raw?.tempMatrix ? computeLabelStarGradient(currentResults.raw.tempMatrix, W, H, roi, activePxPerCm) : null);

                    return (
                      <div key={roi.id} className="roi-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="roi-dot" style={{ backgroundColor: roi.color }}/>
                            <span className="roi-text">{roi.labelName} #{idx + 1} ({roi.type || '1:1 circle'})</span>
                          </div>
                          <button className="btn-ghost btn-tiny" onClick={() => deleteRoi(activeImagePath, roi.id)}>🗑</button>
                        </div>
                        {star && (
                          <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '4px', background: 'var(--bg0)', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <div>Gradient Max: <strong style={{ color: 'var(--accent2)' }}>{star.gradient_max.toFixed(2)} °C/cm</strong></div>
                            <div>Gradient Modus: <strong style={{ color: 'var(--cyan)' }}>{star.gradient_modus}</strong></div>
                            <div>Center Temp: <strong>{star.temp_centre.toFixed(2)} °C</strong></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CALIBRATION TOOL CARD (PER-IMAGE 1-BY-1 REQUIREMENT) */}
            <div className="tool-card">
              <h4 className="card-title">📏 Scale Calibration</h4>
              <p className={`calib-status ${activePxPerCm ? 'ok' : 'none'}`}>
                {activePxPerCm ? `✓ ${activePxPerCm.toFixed(2)} px/cm (Calibrated)` : '⚠️ This Image Not Calibrated'}
              </p>
              {appMode === 'bulk' && (
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: '6px' }}>
                  Progress: <strong>{Object.keys(calibrationsMap).length} / {imageList.length}</strong> images calibrated
                </div>
              )}
              {calibMode === 'pt1' && (
                <div style={{ fontSize: '11px', color: 'var(--accent2)', background: 'var(--bg0)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                  📍 <strong>Step 1:</strong> Click 1st point on thermal image.
                </div>
              )}
              {calibMode === 'pt2' && (
                <div style={{ fontSize: '11px', color: 'var(--cyan)', background: 'var(--bg0)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                  📍 <strong>Step 2:</strong> Click 2nd point on image.<br/>
                  ⌨️ <strong>Hold Shift</strong> to snap a perfectly straight horizontal or vertical line.
                </div>
              )}
              <button className="btn-secondary w-full" onClick={startCalib}>
                {activePxPerCm ? '↺ Re-calibrate This Image' : 'Click 2 points on image'}
              </button>
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

            {/* STANDALONE 8-POINT STAR TOOL (OPTIONAL WORKFLOW) */}
            <div className="tool-card">
              <h4 className="card-title">⊙ Standalone 8-Point Star</h4>

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
                        disabled={!activePxPerCm}
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

                {window.electronAPI && (
                  <button className="btn-secondary w-full" style={{marginTop:'8px'}}
                          onClick={()=>showCsv(starResults.csv_path)}>
                    📄 Show CSV
                  </button>
                )}
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
