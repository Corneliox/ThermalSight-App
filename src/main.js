// src/main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync, execFileSync } = require('child_process');

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
          label: 'Open Saved Annotation Session...',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-annotation');
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
        {
          label: 'macOS First-Launch & Permission Guide...',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-mac-guide');
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

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    try {
      const backendDir = path.join(process.resourcesPath, 'backend');
      if (fs.existsSync(backendDir)) {
        execSync(`xattr -dr com.apple.quarantine "${backendDir}" 2>/dev/null || true`);
        execSync(`chmod -R 755 "${backendDir}" 2>/dev/null || true`);
      }
    } catch (e) {
      console.error('macOS startup self-healing warning:', e);
    }
  }
  createWindow();
});

// ── helper: resolve the Python executable / script path ──────────────────────
function getBackendArgs(command, extraArgs) {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const dirExe  = path.join(process.resourcesPath, 'backend', 'analyzer', `analyzer${ext}`);
    const fileExe = path.join(process.resourcesPath, 'backend', `analyzer${ext}`);
    const exePath = fs.existsSync(dirExe) ? dirExe : fileExe;

    // Grant executable permissions and remove quarantine on macOS / Linux
    if (process.platform === 'darwin' && fs.existsSync(exePath)) {
      try {
        execSync(`xattr -d com.apple.quarantine "${exePath}" 2>/dev/null || true`);
        execSync(`chmod -R +x "${path.dirname(exePath)}" 2>/dev/null || true`);
      } catch (e) {
        console.error('macOS quarantine/chmod error:', e);
      }
    } else if (process.platform !== 'win32' && fs.existsSync(exePath)) {
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
      if (str.trim()) sendLogToRenderer('stdout', str.trim());
    });

    proc.stderr.on('data', (d) => {
      const str = d.toString();
      stderr += str;
      if (str.trim()) {
        console.error(`[python] ${str.trim()}`);
        sendLogToRenderer('stderr', str.trim());
      }
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
        // macOS Fallback: if packaged standalone binary was suspended/failed, try system python3 with analyzer.py
        if (app.isPackaged && process.platform === 'darwin' && executable.includes('analyzer')) {
          const scriptPath = path.join(process.resourcesPath, 'backend', 'analyzer.py');
          if (fs.existsSync(scriptPath)) {
            sendLogToRenderer('stderr', `[FALLBACK] Standalone executable returned code ${code}. Trying python3 fallback on ${scriptPath}...`);
            const pyProc = spawn('python3', [scriptPath, command, ...extraArgs]);
            let pyStdout = '', pyStderr = '';
            pyProc.stdout.on('data', d => { pyStdout += d.toString(); if (d.toString().trim()) sendLogToRenderer('stdout', d.toString().trim()); });
            pyProc.stderr.on('data', d => { pyStderr += d.toString(); if (d.toString().trim()) sendLogToRenderer('stderr', d.toString().trim()); });
            pyProc.on('close', pyCode => {
              if (pyCode === 0) {
                try {
                  const parsed = JSON.parse(pyStdout.trim());
                  sendLogToRenderer('info', `[SUCCESS via python3] Command '${command}' returned code 0`);
                  return resolve(parsed);
                } catch {}
              }
              const errStr = pyStderr || `python3 fallback exited with code ${pyCode}`;
              sendLogToRenderer('error', `[CRASH] ${errStr}`);
              reject(errStr);
            });
            return;
          }
        }

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
  const res = await runPython('crop', [
    imagePath,
    pointsJson,
    labelName,
    String(roiIndex),
    outputDir,
  ]);

  if (res && res.status === 'ok') {
    try {
      if (res.png_path && fs.existsSync(res.png_path)) {
        res.croppedPngDataUrl = `data:image/png;base64,${fs.readFileSync(res.png_path).toString('base64')}`;
      }
      if (res.png_2d_quiver_path && fs.existsSync(res.png_2d_quiver_path)) {
        res.png2dQuiverDataUrl = `data:image/png;base64,${fs.readFileSync(res.png_2d_quiver_path).toString('base64')}`;
      }
      if (res.png_3d_surface_path && fs.existsSync(res.png_3d_surface_path)) {
        res.png3dSurfaceDataUrl = `data:image/png;base64,${fs.readFileSync(res.png_3d_surface_path).toString('base64')}`;
      }
      if (res.png_2x_2d_path && fs.existsSync(res.png_2x_2d_path)) {
        res.png2x2dDataUrl = `data:image/png;base64,${fs.readFileSync(res.png_2x_2d_path).toString('base64')}`;
      }
      if (res.png_2x_3d_path && fs.existsSync(res.png_2x_3d_path)) {
        res.png2x3dDataUrl = `data:image/png;base64,${fs.readFileSync(res.png_2x_3d_path).toString('base64')}`;
      }
    } catch (err) {
      sendLogToRenderer('warning', `Failed to encode cropped PNGs to base64: ${err.message}`);
    }
  }

  return res;
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

// ── IPC: Annotation Session Project Loading ──────────────────────────────────
ipcMain.handle('open-annotation-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select saved annotations_session.json or project session',
    filters: [
      { name: 'JSON Session File', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('load-annotation-file', async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { ...data, loadedFilePath: filePath };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('check-existing-annotation', async (_event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) return null;
  
  const candidates = [
    path.join(folderPath + '_Result', 'annotations_session.json'),
    path.join(folderPath + '_isolated_labels', 'annotations_session.json'),
    path.join(folderPath, 'annotations_session.json'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      try {
        const data = JSON.parse(fs.readFileSync(cand, 'utf-8'));
        return { ...data, loadedFilePath: cand };
      } catch {}
    }
  }
  return null;
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

ipcMain.handle('save-file', async (_event, filePath, content) => {
  try {
    // Security: reject path traversal attempts
    const resolved = path.resolve(filePath);
    if (resolved.includes('..')) {
      return { error: 'Path traversal detected — operation rejected.' };
    }
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    return { status: 'ok', path: resolved };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('export-result-package', async (_event, resultDir, filesMap) => {
  try {
    if (!fs.existsSync(resultDir)) fs.mkdirSync(resultDir, { recursive: true });

    for (const [relPath, content] of Object.entries(filesMap)) {
      // Security: validate relPath does not escape resultDir
      const fullPath = path.resolve(resultDir, relPath);
      if (!fullPath.startsWith(path.resolve(resultDir))) {
        sendLogToRenderer('error', `[SECURITY] Path traversal blocked: ${relPath}`);
        continue;
      }
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (relPath.endsWith('.png')) {
        fs.writeFileSync(fullPath, Buffer.from(content, 'base64'));
      } else {
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
    }

    return { status: 'ok', path: resultDir };
  } catch (e) {
    return { error: e.message };
  }
});

// ── IPC: macOS Diagnostics & Permission Management ────────────────────────────
ipcMain.handle('get-platform-info', async () => {
  return {
    platform: process.platform,
    isMac: process.platform === 'darwin',
    isPackaged: app.isPackaged,
    arch: process.arch,
  };
});

ipcMain.handle('run-mac-permission-fix', async () => {
  if (process.platform !== 'darwin') {
    return { status: 'skipped', message: 'Not running on macOS.' };
  }
  const logs = [];
  try {
    if (app.isPackaged) {
      const backendDir = path.join(process.resourcesPath, 'backend');
      if (fs.existsSync(backendDir)) {
        execSync(`xattr -dr com.apple.quarantine "${backendDir}" 2>/dev/null || true`);
        execSync(`chmod -R 755 "${backendDir}" 2>/dev/null || true`);
        logs.push(`✓ Cleared quarantine & set chmod 755 on ${backendDir}`);
      }
    }
    const defaultAppPath = '/Applications/thermalsight.app';
    if (fs.existsSync(defaultAppPath)) {
      execSync(`xattr -dr com.apple.quarantine "${defaultAppPath}" 2>/dev/null || true`);
      logs.push(`✓ Cleared quarantine on ${defaultAppPath}`);
    }
    sendLogToRenderer('info', '[MAC PERMISSIONS] Auto-fix applied successfully.');
    return { status: 'ok', logs, command: 'xattr -cr /Applications/thermalsight.app' };
  } catch (err) {
    sendLogToRenderer('error', `[MAC PERMISSIONS ERROR] ${err.message}`);
    return { status: 'error', error: err.message, logs, command: 'xattr -cr /Applications/thermalsight.app' };
  }
});

ipcMain.handle('test-backend-connection', async () => {
  sendLogToRenderer('info', '[DIAGNOSTICS] Testing Python backend connectivity...');
  const { executable } = getBackendArgs('analyze', ['--help']);
  try {
    const out = execFileSync(executable, ['--help'], { timeout: 8000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    sendLogToRenderer('info', `[DIAGNOSTICS SUCCESS] Backend binary responded:\n${out.slice(0, 200)}`);
    return { success: true, output: out, executable };
  } catch (err) {
    if (process.platform === 'darwin' && app.isPackaged) {
      const scriptPath = path.join(process.resourcesPath, 'backend', 'analyzer.py');
      if (fs.existsSync(scriptPath)) {
        try {
          const pyOut = execFileSync('python3', [scriptPath, '--help'], { timeout: 8000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
          sendLogToRenderer('info', `[DIAGNOSTICS SUCCESS via python3] Fallback script responded:\n${pyOut.slice(0, 200)}`);
          return { success: true, output: pyOut, executable: `python3 ${scriptPath}`, mode: 'python3-fallback' };
        } catch (pyErr) {
          sendLogToRenderer('error', `[DIAGNOSTICS ERROR] python3 fallback test failed: ${pyErr.message}`);
        }
      }
    }
    const errMsg = err.stderr ? err.stderr.toString() : err.message;
    sendLogToRenderer('error', `[DIAGNOSTICS FAILED] ${errMsg}`);
    return { success: false, error: errMsg, executable };
  }
});
