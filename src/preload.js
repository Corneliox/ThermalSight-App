// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runAnalysis: (imagePath, outputDir) => 
    ipcRenderer.invoke('run-analysis', imagePath, outputDir),

  measureStar: (imagePath, cx, cy, dist_cm, rotation_deg, pxPerCm, outputDir) => 
    ipcRenderer.invoke('measure-star', imagePath, cx, cy, dist_cm, rotation_deg, pxPerCm, outputDir),

  cropLabels: (imagePath, roiPoints, labelName, roiIndex, outputDir) =>
    ipcRenderer.invoke('crop-labels', imagePath, roiPoints, labelName, roiIndex, outputDir),

  gradientScene: (imagePath, rois, pxPerCm, outputDir) =>
    ipcRenderer.invoke('gradient-scene', imagePath, rois, pxPerCm, outputDir),

  generatePlantarFig1: (imagePath, rois, outputDir, gridMode) =>
    ipcRenderer.invoke('generate-plantar-fig1', imagePath, rois, outputDir, gridMode),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  listFolderImages: (folderPath) => ipcRenderer.invoke('list-folder-images', folderPath),

  // Draft Session Recovery APIs
  saveDraft: (draftData) => ipcRenderer.invoke('save-draft', draftData),
  loadDraft: () => ipcRenderer.invoke('load-draft'),
  clearDraft: () => ipcRenderer.invoke('clear-draft'),
  saveMasterJson: (outDir, masterData) => ipcRenderer.invoke('save-master-json', outDir, masterData),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  exportResultPackage: (resultDir, filesMap) => ipcRenderer.invoke('export-result-package', resultDir, filesMap),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showItemInFolder: (p) => ipcRenderer.invoke('show-item-in-folder', p),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Annotation Session Project Loading APIs
  openAnnotationDialog: () => ipcRenderer.invoke('open-annotation-dialog'),
  loadAnnotationFile: (filePath) => ipcRenderer.invoke('load-annotation-file', filePath),
  checkExistingAnnotation: (folderPath) => ipcRenderer.invoke('check-existing-annotation', folderPath),

  // macOS Permission & Diagnostics APIs
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  runMacPermissionFix: () => ipcRenderer.invoke('run-mac-permission-fix'),
  testBackendConnection: () => ipcRenderer.invoke('test-backend-connection'),

  // Windows Focus Recovery & Native Dialog APIs
  showAlertSync: (message) => ipcRenderer.sendSync('show-alert-sync', message),
  refocusWindow: () => ipcRenderer.invoke('refocus-window'),

  // Menu Event Listeners
  onMenuOpenSettings: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-settings', sub);
    return () => ipcRenderer.removeListener('menu-open-settings', sub);
  },
  onMenuOpenAbout: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-about', sub);
    return () => ipcRenderer.removeListener('menu-open-about', sub);
  },
  onMenuOpenMacGuide: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-mac-guide', sub);
    return () => ipcRenderer.removeListener('menu-open-mac-guide', sub);
  },
  onMenuTriggerUndo: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-trigger-undo', sub);
    return () => ipcRenderer.removeListener('menu-trigger-undo', sub);
  },
  onMenuOpenSingle: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-single', sub);
    return () => ipcRenderer.removeListener('menu-open-single', sub);
  },
  onMenuOpenFolder: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-folder', sub);
    return () => ipcRenderer.removeListener('menu-open-folder', sub);
  },
  onMenuOpenAnnotation: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-annotation', sub);
    return () => ipcRenderer.removeListener('menu-open-annotation', sub);
  },
  onMenuOpenProject: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('menu-open-project', sub);
    return () => ipcRenderer.removeListener('menu-open-project', sub);
  },

  // Terminal & Live Diagnostics Log Listener
  onBackendLog: (callback) => {
    const sub = (_event, log) => callback(log);
    ipcRenderer.on('backend-log', sub);
    return () => ipcRenderer.removeListener('backend-log', sub);
  },
});
