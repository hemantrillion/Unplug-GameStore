const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { exec } = require('node:child_process');

let mainWindow;

function getPaths() {
  const root = path.resolve(app.getAppPath(), '../..');
  return {
    root,
    androidWwwGames: path.join(root, 'apps', 'android', 'www', 'games'),
    androidNativeGames: path.join(root, 'apps', 'android', 'android', 'app', 'src', 'main', 'assets', 'public', 'games'),
    androidGradleDir: path.join(root, 'apps', 'android', 'android'),
    apkFile: path.join(root, 'apps', 'android', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: 'UNPLUG Studio — Developer Workspace & Arcade',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await mainWindow.loadFile(path.join(__dirname, 'studio.html'));
}

app.whenReady().then(async () => {
  // IPC: Push Game to Android
  ipcMain.handle('unplug:push-to-android', async (_event, { id, title, code }) => {
    const paths = getPaths();
    await mkdir(paths.androidWwwGames, { recursive: true });
    await mkdir(paths.androidNativeGames, { recursive: true });

    const filename = `${id}.html`;
    const targetWww = path.join(paths.androidWwwGames, filename);
    const targetNative = path.join(paths.androidNativeGames, filename);

    await writeFile(targetWww, code, 'utf8');
    try { await writeFile(targetNative, code, 'utf8'); } catch {}

    return { success: true, path: targetWww };
  });

  // IPC: Build APK
  ipcMain.handle('unplug:build-apk', async () => {
    const paths = getPaths();
    return new Promise((resolve, reject) => {
      exec('gradlew.bat assembleDebug', { cwd: paths.androidGradleDir }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  });

  // IPC: Open APK folder
  ipcMain.handle('unplug:open-apk-folder', async () => {
    const paths = getPaths();
    shell.showItemInFolder(paths.apkFile);
    return true;
  });

  // IPC: Connect Remote
  ipcMain.handle('unplug:connect-remote', async (_event, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(url);
    }
    return true;
  });

  await createWindow();
});

app.on('window-all-closed', () => app.quit());