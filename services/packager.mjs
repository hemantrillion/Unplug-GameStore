import { openDatabase } from './database.mjs';
import { readFile, writeFile, readdir, unlink, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execAsync = promisify(exec);
const root = fileURLToPath(new URL('../', import.meta.url));

const GAME_ICONS = {
  snake: '🐍',
  bounce: '🏓',
  memory: '🌸',
  space_dodge: '🚀'
};

let isBuilding = false;
let pendingRebuild = false;
let lastStatus = {
  success: true,
  lastBuild: null,
  games: [],
  apkSha256: null,
  apkBytes: 0,
  error: null
};

export function getPackagerStatus() {
  return { ...lastStatus, isBuilding };
}

/**
 * Sync approved games, recompile Android APK, update hekugo.online, and push to Git.
 */
export async function rebuildAndDeploy(options = {}) {
  if (isBuilding) {
    pendingRebuild = true;
    console.log('[Packager] Build already in progress. Queued subsequent rebuild.');
    return { queued: true };
  }

  isBuilding = true;
  console.log('[Packager] Starting automated APK rebuild and deployment pipeline...');

  try {
    const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || '.local-data');
    const db = options.db || openDatabase(path.join(dataDir, 'unplug.sqlite'));

    // 1. Fetch active or newly approved games
    const games = db.prepare(`
      SELECT g.id, g.title, g.description, g.category, g.color,
             r.id AS release_id, r.version, r.html, r.sha256, r.bytes, r.created
      FROM games g
      JOIN releases r ON r.id = COALESCE(g.active_release, (
        SELECT id FROM releases WHERE game_id = g.id AND state = 'approved' ORDER BY created DESC LIMIT 1
      ))
      WHERE g.disabled = 0 AND r.state = 'approved'
      ORDER BY r.created DESC
    `).all();

    console.log(`[Packager] Found ${games.length} active approved game(s): ${games.map(g => g.title).join(', ')}`);

    const approvedGameIds = new Set(games.map(g => g.id));

    // Target game directories
    const gameDirs = [
      path.join(root, 'apps', 'android', 'www', 'games'),
      path.join(root, 'apps', 'android', 'android', 'app', 'src', 'main', 'assets', 'public', 'games'),
      path.join(root, 'hekugo.online', 'unplug-desktop', 'games')
    ];

    for (const dir of gameDirs) {
      await mkdir(dir, { recursive: true });
    }

    // 2. Write approved game HTML files and remove unapproved ones
    for (const game of games) {
      for (const dir of gameDirs) {
        const dest = path.join(dir, `${game.id}.html`);
        await writeFile(dest, game.html, 'utf8');
      }
    }

    // Clean up any unapproved game files
    for (const dir of gameDirs) {
      if (existsSync(dir)) {
        const files = await readdir(dir);
        for (const file of files) {
          if (file.endsWith('.html')) {
            const id = file.replace(/\.html$/, '');
            if (!approvedGameIds.has(id)) {
              console.log(`[Packager] Removing unapproved game asset: ${path.join(dir, file)}`);
              await unlink(path.join(dir, file));
            }
          }
        }
      }
    }

    // 3. Write catalog.js for Android www
    const catalogData = games.map((g, idx) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      category: g.category === 'first-party' ? 'Arcade Classic' : 'Community',
      icon: GAME_ICONS[g.id] || '🎮',
      version: g.version,
      color: g.color || '#6366f1',
      sha256: g.sha256,
      isNew: idx === 0
    }));

    const catalogJs = `window.UNPLUG_CATALOG = ${JSON.stringify(catalogData, null, 2)};\n`;
    await writeFile(path.join(root, 'apps', 'android', 'www', 'catalog.js'), catalogJs, 'utf8');

    // 4. Sync apps/android/www into native android assets folder
    const wwwDir = path.join(root, 'apps', 'android', 'www');
    const nativePublicDir = path.join(root, 'apps', 'android', 'android', 'app', 'src', 'main', 'assets', 'public');
    await mkdir(nativePublicDir, { recursive: true });

    for (const file of ['index.html', 'styles.css', 'app.js', 'catalog.js']) {
      const src = path.join(wwwDir, file);
      if (existsSync(src)) {
        await copyFile(src, path.join(nativePublicDir, file));
      }
    }

    // 5. Compile Android APK using Gradle
    console.log('[Packager] Compiling Android APK with gradlew.bat assembleDebug...');
    const androidDir = path.join(root, 'apps', 'android', 'android');
    const gradlewCmd = process.platform === 'win32' ? 'cmd.exe /c gradlew.bat assembleDebug --quiet' : './gradlew assembleDebug --quiet';

    await execAsync(gradlewCmd, {
      cwd: androidDir,
      windowsHide: true
    });

    const compiledApkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    if (!existsSync(compiledApkPath)) {
      throw new Error(`Compiled APK not found at: ${compiledApkPath}`);
    }

    // 6. Copy APK to hekugo.online/unplug-android/
    const hekugoApkDest = path.join(root, 'hekugo.online', 'unplug-android', 'UNPLUG-Player-v0.1.0-debug.apk');
    await copyFile(compiledApkPath, hekugoApkDest);

    // Compute hash and size
    const apkBuf = await readFile(hekugoApkDest);
    const apkSha256 = crypto.createHash('sha256').update(apkBuf).digest('hex');
    const apkBytes = apkBuf.length;
    const apkMb = (apkBytes / (1024 * 1024)).toFixed(2);

    console.log(`[Packager] Rebuilt APK: ${apkBytes} bytes, SHA-256: ${apkSha256}`);

    // 7. Update hekugo.online/unplug-android/index.html
    const hekugoIndexPath = path.join(root, 'hekugo.online', 'unplug-android', 'index.html');
    if (existsSync(hekugoIndexPath)) {
      let html = await readFile(hekugoIndexPath, 'utf8');

      // Update SHA-256
      html = html.replace(/<div><strong>SHA-256:<\/strong>\s*[a-f0-9]{64}<\/div>/,
        `<div><strong>SHA-256:</strong> ${apkSha256}</div>`);

      // Update Package bytes
      html = html.replace(/<div><strong>Package:<\/strong>\s*Android Application Package \([0-9,]+ bytes\)<\/div>/,
        `<div><strong>Package:</strong> Android Application Package (${apkBytes.toLocaleString('en-US')} bytes)</div>`);

      // Update Included Games
      const titles = games.map(g => g.title).join(', ') || 'None';
      html = html.replace(/<div><strong>Included Games:<\/strong>[^<]*<\/div>/,
        `<div><strong>Included Games:</strong> ${titles}</div>`);

      // Update Download Button
      html = html.replace(/Download Android APK \(\.apk · [0-9.]+ MB\)/,
        `Download Android APK (.apk · ${apkMb} MB)`);

      await writeFile(hekugoIndexPath, html, 'utf8');
      console.log('[Packager] Updated hekugo.online/unplug-android/index.html');
    }

    // 8. Commit and Push to hekugo.online git repo
    const hekugoDir = path.join(root, 'hekugo.online');
    try {
      console.log('[Packager] Committing and pushing to hekugo.online git repo...');
      await execAsync('git add .', { cwd: hekugoDir });
      const titles = games.map(g => g.title).join(', ') || 'No games';
      await execAsync(`git commit -m "Auto-deploy APK: updated with approved games [${titles}]"`, { cwd: hekugoDir });
      await execAsync('git push origin main', { cwd: hekugoDir });
      console.log('[Packager] Successfully pushed updated APK to hekugo.online repository!');
    } catch (gitErr) {
      console.warn('[Packager] Git push notice:', gitErr.message || gitErr);
    }

    lastStatus = {
      success: true,
      lastBuild: new Date().toISOString(),
      games: games.map(g => ({ id: g.id, title: g.title, version: g.version })),
      apkSha256,
      apkBytes,
      error: null
    };

    console.log('[Packager] Pipeline finished successfully.');
  } catch (err) {
    console.error('[Packager] Error during pipeline execution:', err);
    lastStatus = {
      success: false,
      lastBuild: new Date().toISOString(),
      games: [],
      apkSha256: null,
      apkBytes: 0,
      error: err.message
    };
  } finally {
    isBuilding = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      console.log('[Packager] Executing queued rebuild...');
      setTimeout(() => rebuildAndDeploy(options), 500);
    }
  }

  return lastStatus;
}
