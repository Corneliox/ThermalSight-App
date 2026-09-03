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

  generatePlantarFig1: (imagePath, rois, outputDir) =>
    ipcRenderer.invoke('generate-plantar-fig1', imagePath, rois, outputDir),

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

  // Menu Event Listeners
  onMenuOpenSettings: (callback) => ipcRenderer.on('menu-open-settings', () => callback()),
  onMenuOpenAbout: (callback) => ipcRenderer.on('menu-open-about', () => callback()),
  onMenuOpenMacGuide: (callback) => ipcRenderer.on('menu-open-mac-guide', () => callback()),
  onMenuTriggerUndo: (callback) => ipcRenderer.on('menu-trigger-undo', () => callback()),
  onMenuOpenSingle: (callback) => ipcRenderer.on('menu-open-single', () => callback()),
  onMenuOpenFolder: (callback) => ipcRenderer.on('menu-open-folder', () => callback()),
  onMenuOpenAnnotation: (callback) => ipcRenderer.on('menu-open-annotation', () => callback()),
  onMenuOpenProject: (callback) => ipcRenderer.on('menu-open-project', () => callback()),

  // Terminal & Live Diagnostics Log Listener
  onBackendLog: (callback) => ipcRenderer.on('backend-log', (_event, log) => callback(log)),
});
