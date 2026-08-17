// src/main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;

function sendLogToRenderer(type, text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const timestamp = new Date().toLocaleTimeString();
    mainWindow.webContents.send('backend-log', { type, text, timestamp });
  }
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Single Thermal Image...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-single');
          }
        },
        {
          label: 'Open Image Folder (Bulk Mode)...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-folder');
          }
        },
        {
          label: 'Open Active Project Output Folder',
          accelerator: 'CmdOrCtrl+Alt+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-project');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo Last ROI',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-trigger-undo');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings / Variable Configurations...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-settings');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ThermalSight...',
          accelerator: 'F1',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-about');
          }
        },
        { type: 'separator' },
        {
          label: 'Lead Developer GitHub (Corneliox)',
          click: async () => {
            await shell.openExternal('https://github.com/Corneliox');
          }
        },
        {
          label: 'Co-Developer GitHub (Aditya42069)',
          click: async () => {
            await shell.openExternal('https://github.com/Aditya42069');
          }
        },
        {
          label: 'Download Releases',
          click: async () => {
            await shell.openExternal('https://github.com/Corneliox/ThermalSight-App/releases');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    title: 'ThermalSight',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setTitle('ThermalSight');
  createApplicationMenu();

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(createWindow);

// ── helper: resolve the Python executable / script path ──────────────────────
function getBackendArgs(command, extraArgs) {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const dirExe  = path.join(process.resourcesPath, 'backend', 'analyzer', `analyzer${ext}`);
    const fileExe = path.join(process.resourcesPath, 'backend', `analyzer${ext}`);
    const exePath = fs.existsSync(dirExe) ? dirExe : fileExe;

    // Grant executable permissions on macOS / Linux
    if (process.platform !== 'win32' && fs.existsSync(exePath)) {
      try {
        fs.chmodSync(exePath, 0o755);
      } catch (e) {
        console.error('chmod error:', e);
      }
    }

    return { executable: exePath, args: [command, ...extraArgs] };
  } else {
    // Development: run the Python script directly
    return {
      executable: 'python',
      args: [path.join(__dirname, '..', 'backend', 'analyzer.py'), command, ...extraArgs],
    };
  }
}

// ── helper: spawn + collect stdout → parse JSON ───────────────────────────────
function runPython(command, extraArgs) {
  return new Promise((resolve, reject) => {
    const { executable, args } = getBackendArgs(command, extraArgs);

    const cmdLine = `${executable} ${args.join(' ')}`;
    console.log(`[backend] ${cmdLine}`);
    sendLogToRenderer('info', `[EXEC] ${cmdLine}`);

    const proc = spawn(executable, args);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      const str = d.toString();
      stdout += str;
      sendLogToRenderer('stdout', str.trim());
    });

    proc.stderr.on('data', (d) => {
      const str = d.toString();
      stderr += str;
      console.error(`[python] ${str.trim()}`);
      sendLogToRenderer('stderr', str.trim());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout.trim());
          sendLogToRenderer('info', `[SUCCESS] Command '${command}' returned code 0`);
          resolve(parsed);
        } catch (e) {
          const errStr = `JSON parse error: ${e.message}\nRaw output: ${stdout}`;
          sendLogToRenderer('error', `[ERROR] ${errStr}`);
          reject(errStr);
        }
      } else {
        let errStr = `Process exited with code ${code}`;
        try {
          const errObj = JSON.parse(stdout.trim());
          errStr = errObj.error || errStr;
        } catch {
          errStr = `Process exited with code ${code}.\nStderr: ${stderr}`;
        }
        sendLogToRenderer('error', `[CRASH] ${errStr}`);
        reject(errStr);
      }
    });

    proc.on('error', (err) => {
      const errStr = `Failed to start backend executable (${executable}): ${err.message}`;
      sendLogToRenderer('error', `[SPAWN ERROR] ${errStr}`);
      reject(errStr);
    });
  });
}

// ── IPC: run-analysis ─────────────────────────────────────────────────────────
ipcMain.handle('run-analysis', async (_event, imagePath, outputDir) => {
  return runPython('analyze', [imagePath, outputDir]);
});

// ── IPC: measure-star ─────────────────────────────────────────────────────────
ipcMain.handle('measure-star', async (_event, imagePath, cx, cy, dist_cm, rotation_deg, pxPerCm, outputDir) => {
  return runPython('star', [
    imagePath,
    String(cx),
    String(cy),
    String(dist_cm),
    String(rotation_deg),
    String(pxPerCm),
    outputDir,
  ]);
});

// ── IPC: crop-labels ──────────────────────────────────────────────────────────
ipcMain.handle('crop-labels', async (_event, imagePath, roiPoints, labelName, roiIndex, outputDir) => {
  const pointsJson = JSON.stringify(roiPoints);
  return runPython('crop', [
    imagePath,
    pointsJson,
    labelName,
    String(roiIndex),
    outputDir,
  ]);
});

// ── IPC: open-file-dialog ─────────────────────────────────────────────────────
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select FLIR / thermal image',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: open-folder-dialog ───────────────────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select folder containing thermal images',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: list-folder-images ───────────────────────────────────────────────────
ipcMain.handle('list-folder-images', async (_event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath);
  const exts  = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
  
  const validFiles = files.filter(f => exts.includes(path.extname(f).toLowerCase()));
  
  // Natural sorting (e.g. img_1, img_2, ..., img_10)
  validFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return validFiles.map(f => path.join(folderPath, f));
});

// ── IPC: Draft recovery session file operations ────────────────────────────────
const getDraftPath = () => path.join(app.getPath('userData'), 'draft_session.json');

ipcMain.handle('save-draft', async (_event, draftData) => {
  try {
    fs.writeFileSync(getDraftPath(), JSON.stringify(draftData, null, 2), 'utf-8');
    return { status: 'ok' };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('load-draft', async () => {
  const p = getDraftPath();
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data;
    } catch {
      return null;
    }
  }
  return null;
});

ipcMain.handle('clear-draft', async () => {
  const p = getDraftPath();
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      return { status: 'ok' };
    } catch (e) {
      return { error: e.message };
    }
  }
  return { status: 'ok' };
});

ipcMain.handle('save-master-json', async (_event, outDir, masterData) => {
  try {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const targetFile = path.join(outDir, 'annotations_session.json');
    fs.writeFileSync(targetFile, JSON.stringify(masterData, null, 2), 'utf-8');
    return { status: 'ok', path: targetFile };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('open-path', async (_event, p) => {
  if (p) shell.openPath(p);
});

ipcMain.handle('show-item-in-folder', async (_event, p) => {
  if (p) shell.showItemInFolder(p);
});

ipcMain.handle('open-external', async (_event, url) => {
  if (url && url.startsWith('http')) {
    shell.openExternal(url);
  }
});
