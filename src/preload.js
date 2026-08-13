// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runAnalysis: (imagePath, outputDir) => 
    ipcRenderer.invoke('run-analysis', imagePath, outputDir),

  measureStar: (imagePath, cx, cy, dist_cm, rotation_deg, pxPerCm, outputDir) => 
    ipcRenderer.invoke('measure-star', imagePath, cx, cy, dist_cm, rotation_deg, pxPerCm, outputDir),

  cropLabels: (imagePath, roiPoints, labelName, roiIndex, outputDir) =>
    ipcRenderer.invoke('crop-labels', imagePath, roiPoints, labelName, roiIndex, outputDir),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  listFolderImages: (folderPath) => ipcRenderer.invoke('list-folder-images', folderPath),

  // Draft Session Recovery APIs
  saveDraft: (draftData) => ipcRenderer.invoke('save-draft', draftData),
  loadDraft: () => ipcRenderer.invoke('load-draft'),
  clearDraft: () => ipcRenderer.invoke('clear-draft'),
  saveMasterJson: (outDir, masterData) => ipcRenderer.invoke('save-master-json', outDir, masterData),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showItemInFolder: (p) => ipcRenderer.invoke('show-item-in-folder', p),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Menu Event Listeners
  onMenuOpenSettings: (callback) => ipcRenderer.on('menu-open-settings', () => callback()),
  onMenuOpenAbout: (callback) => ipcRenderer.on('menu-open-about', () => callback()),
  onMenuTriggerUndo: (callback) => ipcRenderer.on('menu-trigger-undo', () => callback()),
  onMenuOpenSingle: (callback) => ipcRenderer.on('menu-open-single', () => callback()),
  onMenuOpenFolder: (callback) => ipcRenderer.on('menu-open-folder', () => callback()),
  onMenuOpenProject: (callback) => ipcRenderer.on('menu-open-project', () => callback()),
});
