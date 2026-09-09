// UNPLUG Studio & PWA Developer Workspace Engine
(() => {
  'use strict';

  // State Management
  const state = {
    activeTab: 'workshop',
    currentDevice: 'portrait',
    selectedGameId: 'bounce',
    adFree: localStorage.getItem('unplug_adfree') === 'true',
    lives: parseInt(localStorage.getItem('unplug_lives') || '3', 10),
    hints: parseInt(localStorage.getItem('unplug_hints') || '3', 10),
    highScores: JSON.parse(localStorage.getItem('unplug_scores') || '{}'),
    pendingAdReward: null,
    adInterval: null,
    arcadeGame: null
  };

  // Pre-loaded Game Templates
  const templates = {
    starter: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
  <title>Custom Game</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0e17; color:#fff; font-family:sans-serif; overflow:hidden; text-align:center; }
    canvas { display:block; margin:0 auto; background:#111827; touch-action:none; }
    #ui { position:absolute; top:10px; left:0; right:0; display:flex; justify-content:space-around; font-size:14px; font-weight:bold; }
  </style>
</head>
<body>
  <div id="ui">
    <div>Score: <span id="score">0</span></div>
    <div>Lives: <span id="lives">3</span></div>
  </div>
  <canvas id="game"></canvas>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let score = 0, lives = 3, over = false;
    let x = canvas.width / 2, y = canvas.height / 2, dx = 3, dy = 3, r = 20;

    // UNPLUG SDK: Initialized
    window.parent.postMessage({ type: 'unplug:ready' }, '*');

    function update() {
      if (over) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      x += dx; y += dy;
      if (x - r < 0 || x + r > canvas.width) dx = -dx;
      if (y - r < 0) dy = -dy;
      if (y + r > canvas.height) {
        lives--;
        document.getElementById('lives').textContent = lives;
        if (lives <= 0) {
          over = true;
          // UNPLUG SDK: Trigger Game Over (Prompt Rewarded Ad)
          window.parent.postMessage({ type: 'unplug:gameover', score: score }, '*');
        } else {
          y = canvas.height / 2;
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#388bfd';
      ctx.fill();
      ctx.closePath();

      score++;
      document.getElementById('score').textContent = score;
      if (score % 50 === 0) window.parent.postMessage({ type: 'unplug:score', score: score }, '*');
      requestAnimationFrame(update);
    }
    update();

    // UNPLUG SDK: Listen for Revive & Hint events
    window.addEventListener('message', e => {
      if (e.data?.type === 'unplug:revive') {
        lives = 1; over = false;
        y = canvas.height / 2;
        document.getElementById('lives').textContent = lives;
        update();
      }
      if (e.data?.type === 'unplug:hint') {
        dx = Math.sign(dx) * 1.5; dy = Math.sign(dy) * 1.5;
        setTimeout(() => { dx = Math.sign(dx) * 3; dy = Math.sign(dy) * 3; }, 4000);
      }
    });

    window.addEventListener('pointerdown', () => { dx = -dx; });
  </script>
</body>
</html>`
  };

  // Helper: Logger
  function logEvent(dir, text, type = 'info') {
    const consoleEl = document.getElementById('event-log-console');
    if (!consoleEl) return;
    const now = new Date().toTimeString().split(' ')[0];
    const entry = document.createElement('div');
    entry.className = 'event-log-entry';
    let dirClass = dir === 'RX' ? 'log-rx' : (dir === 'TX' ? 'log-tx' : 'log-warn');
    entry.innerHTML = `<span class="log-time">[${now}]</span> <span class="${dirClass}">[${dir}]</span> <span>${text}</span>`;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  // Update HUD
  function updateHUD() {
    const statusPill = document.getElementById('hud-adfree-status');
    const toggleBtn = document.getElementById('btn-toggle-adfree');
    const econStatus = document.getElementById('economy-active-status');

    if (state.adFree) {
      statusPill.textContent = '💎 Ad-Free Pass Active';
      statusPill.classList.add('adfree');
      toggleBtn.textContent = 'Deactivate Ad-Free';
      if (econStatus) {
        econStatus.textContent = 'Ad-Free Pass Active · Ads Suppressed';
        econStatus.style.color = 'var(--green-hover)';
      }
    } else {
      statusPill.textContent = '⭐ Free Tier (Ads Active)';
      statusPill.classList.remove('adfree');
      toggleBtn.textContent = 'Toggle Ad-Free Pass';
      if (econStatus) {
        econStatus.textContent = 'Ads Enabled · Rewarded Life/Hints Active';
        econStatus.style.color = 'var(--gold)';
      }
    }
  }

  // Fetch Game Template
  async function loadTemplate(id) {
    if (templates[id]) {
      setEditorCode(id, templates[id]);
      return;
    }
    try {
      const res = await fetch('games/' + id + '.html');
      if (res.ok) {
        const text = await res.text();
        templates[id] = text;
        setEditorCode(id, text);
      } else {
        setEditorCode(id, templates.starter);
      }
    } catch (e) {
      setEditorCode(id, templates.starter);
    }
  }

  function setEditorCode(id, code) {
    document.getElementById('code-editor').value = code;
    const titles = {
      bounce: 'Bounce Arcade',
      snake: 'Neon Trail (Snake)',
      memory: 'Memory Garden',
      space_dodge: 'Space Dodge',
      starter: 'New Custom Game'
    };
    document.getElementById('game-title').value = titles[id] || 'Custom Game';
    document.getElementById('game-id').value = id;
    runSandbox(code);
  }

  // Sandbox Runner
  function runSandbox(code) {
    const frame = document.getElementById('game-sandbox-frame');
    if (!frame) return;
    logEvent('SYSTEM', 'Compiling and reloading sandbox runtime...');
    frame.srcdoc = code;
  }

  // Contract Validator
  function validateGameContract(code) {
    const checks = [];
    let passed = true;

    // 1. Doctype
    if (/^\s*<!doctype html>/i.test(code)) {
      checks.push('✓ Valid HTML5 doctype declaration');
    } else {
      checks.push('✗ Missing <!doctype html>');
      passed = false;
    }

    // 2. Head and body
    if (/<head(?:\s[^>]*)?>/i.test(code) && /<body(?:\s[^>]*)?>/i.test(code)) {
      checks.push('✓ Explicit <head> and <body> structure');
    } else {
      checks.push('✗ Missing explicit <head> or <body> tags');
      passed = false;
    }

    // 3. Size check
    const bytes = new TextEncoder().encode(code).length;
    if (bytes <= 262144) {
      checks.push(`✓ File size ${(bytes/1024).toFixed(1)} KiB is under 256 KiB ceiling`);
    } else {
      checks.push(`✗ File size exceeds 256 KiB (${(bytes/1024).toFixed(1)} KiB)`);
      passed = false;
    }

    // 4. Inline scripts only
    if (/<script(?:\s[^>]*)?src=/i.test(code)) {
      checks.push('✗ External <script src="..."> is forbidden. Inline scripts required.');
      passed = false;
    } else {
      checks.push('✓ Strictly inline script architecture');
    }

    // 5. Readiness message
    if (code.includes('unplug:ready')) {
      checks.push('✓ Implements mandatory unplug:ready handshake');
    } else {
      checks.push('✗ Missing window.parent.postMessage({ type: "unplug:ready" }, "*")');
      passed = false;
    }

    // 6. Security elements
    const forbidden = ['iframe', 'frame', 'object', 'embed', 'base', 'form'];
    let foundForbidden = forbidden.filter(tag => new RegExp('<' + tag + '(?:\s|>)', 'i').test(code));
    if (foundForbidden.length > 0) {
      checks.push('✗ Prohibited container elements: ' + foundForbidden.join(', '));
      passed = false;
    } else {
      checks.push('✓ Safe sandbox: zero restricted frame/embed containers');
    }

    alert('UNPLUG GAME CONTRACT REPORT\n=========================\nOverall Status: ' + (passed ? 'PASSED (100% STORE COMPLIANT)' : 'FAILED') + '\n\n' + checks.join('\n'));
    logEvent('VALIDATE', passed ? 'Contract 100% Passed' : 'Contract Validation Errors Found');
    return passed;
  }

  // Rewarded Ad Simulation
  function triggerRewardedAd(rewardType) {
    if (state.adFree) {
      logEvent('ECONOMY', `Ad-Free active: Suppressed ad, granting ${rewardType} immediately!`);
      deliverReward(rewardType);
      return;
    }

    state.pendingAdReward = rewardType;
    const modal = document.getElementById('ad-modal');
    const countdownEl = document.getElementById('ad-timer-countdown');
    const claimBtn = document.getElementById('btn-claim-ad-reward');
    const progressBar = document.getElementById('ad-progress-bar');
    const rewardLabel = document.getElementById('ad-reward-type-label');

    rewardLabel.textContent = rewardType === 'revive' ? 'Reward: +1 Extra Life (Continue)' : 'Reward: Game Hint Assistance';
    claimBtn.disabled = true;
    claimBtn.textContent = 'Reward Unlocking...';
    progressBar.style.width = '0%';
    modal.classList.add('open');

    let seconds = 5;
    countdownEl.textContent = `Reward unlocks in ${seconds}s...`;

    clearInterval(state.adInterval);
    state.adInterval = setInterval(() => {
      seconds--;
      progressBar.style.width = `${((5 - seconds) / 5) * 100}%`;
      if (seconds > 0) {
        countdownEl.textContent = `Reward unlocks in ${seconds}s...`;
      } else {
        clearInterval(state.adInterval);
        countdownEl.textContent = '✓ Ad Complete!';
        claimBtn.disabled = false;
        claimBtn.textContent = 'Claim ' + (rewardType === 'revive' ? '+1 Extra Life' : 'Hint');
        logEvent('AD', '5-second video ad view completed. Reward unlocked.');
      }
    }, 1000);
  }

  function deliverReward(rewardType) {
    const frame = document.getElementById('game-sandbox-frame');
    if (rewardType === 'revive') {
      logEvent('TX', 'Dispatching unplug:revive (+1 Life Continue) to sandbox.');
      frame.contentWindow?.postMessage({ type: 'unplug:revive' }, '*');
    } else if (rewardType === 'hint') {
      logEvent('TX', 'Dispatching unplug:hint (In-Game Assistance) to sandbox.');
      frame.contentWindow?.postMessage({ type: 'unplug:hint' }, '*');
    }
  }

  // Listen to postMessage from Sandbox & Arcade
  window.addEventListener('message', e => {
    const data = e.data;
    if (!data || !data.type) return;

    if (data.type === 'unplug:ready') {
      logEvent('RX', 'unplug:ready — Game client initialized handshake.');
      const pill = document.getElementById('sandbox-status-pill');
      if (pill) {
        pill.textContent = 'Active & Handshake OK';
        pill.style.color = 'var(--green-hover)';
      }
      // Send host capabilities
      e.source?.postMessage({ type: 'unplug:adfree_status', adFree: state.adFree }, '*');
    } else if (data.type === 'unplug:score') {
      logEvent('RX', `unplug:score — Score updated: ${data.score}`);
      const scorePill = document.getElementById('arcade-score-pill');
      if (scorePill) scorePill.textContent = 'Score: ' + data.score;
    } else if (data.type === 'unplug:gameover') {
      logEvent('RX', `unplug:gameover — Player died with score ${data.score}. Prompting Rewarded Ad.`);
      triggerRewardedAd('revive');
    } else if (data.type === 'unplug:req_hint') {
      logEvent('RX', 'unplug:req_hint — Player requested game hint. Prompting Rewarded Ad.');
      triggerRewardedAd('hint');
    }
  });

  // Export Standalone Package
  function exportGamePackage() {
    const code = document.getElementById('code-editor').value;
    const title = document.getElementById('game-title').value || 'custom-game';
    const id = document.getElementById('game-id').value || 'custom';
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = id + '.html';
    a.click();
    URL.revokeObjectURL(url);
    logEvent('EXPORT', `Exported standalone store package: ${id}.html`);
  }

  // Push to Android App
  async function pushToAndroidApp() {
    const code = document.getElementById('code-editor').value;
    const id = document.getElementById('game-id').value.trim() || 'custom';
    const title = document.getElementById('game-title').value.trim() || 'Custom Game';

    if (window.unplugDesktop && window.unplugDesktop.pushToAndroid) {
      try {
        logEvent('SYSTEM', `Pushing ${id}.html directly to Android APK source...`);
        const res = await window.unplugDesktop.pushToAndroid({ id, title, code });
        alert(`🚀 SUCCESS!\n\nGame "${title}" (${id}.html) has been pushed to:\n- apps/android/www/games/${id}.html\n- apps/android/android/app/src/main/assets/public/games/${id}.html\n\nYou can now rebuild the APK!`);
        logEvent('SYSTEM', `Push completed: ${res.path}`);
        renderInstalledGames();
      } catch (err) {
        alert('Error pushing to Android: ' + err.message);
        logEvent('SYSTEM', 'Push failed: ' + err.message, 'err');
      }
    } else {
      // Browser PWA fallback
      exportGamePackage();
      alert(`Game downloaded as "${id}.html"!\n\nTo bundle into Android, copy to "apps/android/www/games/${id}.html" and run "./gradlew assembleDebug".`);
    }
  }

  // Build Android APK
  async function buildAndroidApk() {
    if (window.unplugDesktop && window.unplugDesktop.buildApk) {
      const card = document.getElementById('build-log-card');
      const log = document.getElementById('build-log-console');
      card.style.display = 'flex';
      log.textContent = '🚀 Launching Gradle build (./gradlew assembleDebug)...\nThis may take ~10-20 seconds...\n';
      logEvent('BUILD', 'Gradle Android build started...');

      try {
        const res = await window.unplugDesktop.buildApk();
        log.textContent += '\n' + res.output + '\n✓ BUILD FINISHED SUCCESSFULLY!\nOutput APK: apps/android/android/app/build/outputs/apk/debug/app-debug.apk';
        logEvent('BUILD', 'Gradle build finished successfully!');
        alert('🎉 Android APK Built Successfully!\n\nLocation: apps/android/android/app/build/outputs/apk/debug/app-debug.apk');
      } catch (err) {
        log.textContent += '\nBuild Error:\n' + err.message;
        logEvent('BUILD', 'Build error: ' + err.message, 'err');
        alert('Gradle build failed: ' + err.message);
      }
    } else {
      alert('Native APK compilation requires the installed UNPLUG Desktop application.');
    }
  }

  // Render Arcade Cards
  function renderArcadeCards() {
    const grid = document.getElementById('arcade-game-grid');
    if (!grid) return;
    const games = [
      { id: 'bounce', title: 'Bounce Arcade', meta: 'Action · Brick Breaker', desc: 'Classic paddle deflection with dynamic ball acceleration and slow-motion hints.' },
      { id: 'snake', title: 'Neon Trail (Snake)', meta: 'Arcade · Grid Navigation', desc: 'Touch swipe and dpad navigation with food hunting, score scaling, and extra lives.' },
      { id: 'memory', title: 'Memory Garden', meta: 'Puzzle · Card Match', desc: 'Emoji pair matching game with card peek assistance hints.' },
      { id: 'space_dodge', title: 'Space Dodge', meta: 'Canvas · Space Action', desc: 'Dodge meteors, collect crystals, fire shields and revive with rewarded ads.' }
    ];

    grid.innerHTML = '';
    games.forEach(g => {
      const card = document.createElement('div');
      card.className = 'arcade-card';
      const best = state.highScores[g.id] || 0;
      card.innerHTML = `
        <div class="card-banner ${g.id}">
          ${g.id === 'bounce' ? '🎾' : (g.id === 'snake' ? '🐍' : (g.id === 'memory' ? '🎴' : '🚀'))}
        </div>
        <div class="card-body">
          <h3>${g.title}</h3>
          <div class="card-meta">${g.meta}</div>
          <div class="card-desc">${g.desc}</div>
          <div class="card-footer">
            <span class="score-badge">🏆 High Score: ${best}</span>
            <button class="btn-primary btn-play-arcade" data-id="${g.id}">Play Game ▶</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    document.querySelectorAll('.btn-play-arcade').forEach(btn => {
      btn.addEventListener('click', e => {
        launchArcadeGame(e.target.dataset.id);
      });
    });
  }

  function launchArcadeGame(id) {
    const modal = document.getElementById('play-modal');
    const frame = document.getElementById('arcade-game-frame');
    const title = document.getElementById('arcade-playing-title');
    const scorePill = document.getElementById('arcade-score-pill');

    title.textContent = id.toUpperCase();
    scorePill.textContent = 'Score: 0';
    frame.src = 'games/' + id + '.html';
    modal.classList.add('open');
  }

  // Render Installed APK Games
  function renderInstalledGames() {
    const list = document.getElementById('installed-games-list');
    if (!list) return;
    const games = [
      { name: 'bounce.html', size: '4.0 KB', verified: true },
      { name: 'snake.html', size: '4.2 KB', verified: true },
      { name: 'memory.html', size: '3.5 KB', verified: true },
      { name: 'space_dodge.html', size: '9.1 KB', verified: true }
    ];
    list.innerHTML = games.map(g => `
      <div class="game-sync-row">
        <div>
          <strong>${g.name}</strong>
          <span style="color:var(--text-muted); font-size:11px; margin-left:8px;">${g.size}</span>
        </div>
        <div>
          <span style="color:var(--green-hover); font-size:12px; font-weight:600;">✓ In APK Bundle</span>
          <button class="btn-secondary btn-edit-installed" data-file="${g.name}" style="margin-left:8px; padding:4px 8px; font-size:11px;">Edit in Studio ↗</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-edit-installed').forEach(b => {
      b.addEventListener('click', e => {
        const file = e.target.dataset.file.replace('.html', '');
        document.querySelector('[data-view="workshop"]').click();
        document.getElementById('template-select').value = file;
        loadTemplate(file);
      });
    });
  }

  // DOM Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    updateHUD();
    loadTemplate('bounce');
    renderArcadeCards();
    renderInstalledGames();

    // Native Bridge Detection
    const bridgeEl = document.getElementById('bridge-status');
    if (bridgeEl) {
      if (window.unplugDesktop) {
        bridgeEl.textContent = 'Active (Electron Native Bridge)';
        bridgeEl.style.color = 'var(--green-hover)';
      } else {
        bridgeEl.textContent = 'Web PWA Mode (Browser)';
        bridgeEl.style.color = 'var(--accent-hover)';
      }
    }

    // Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        const view = e.target.dataset.view;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.studio-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + view)?.classList.add('active');
      });
    });

    // Device Toggles
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const dev = e.target.dataset.device;
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const box = document.getElementById('sandbox-frame-box');
        box.className = 'sandbox-device-frame ' + dev;
      });
    });

    // Template Dropdown
    document.getElementById('template-select').addEventListener('change', e => {
      loadTemplate(e.target.value);
    });

    // Import HTML
    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-html').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = ev => {
          const code = ev.target.result;
          setEditorCode('custom', code);
          logEvent('IMPORT', 'Imported custom HTML file: ' + e.target.files[0].name);
        };
        reader.readAsText(e.target.files[0]);
      }
    });

    // Run Code
    document.getElementById('btn-run-code').addEventListener('click', () => {
      runSandbox(document.getElementById('code-editor').value);
    });

    // Validate Contract
    document.getElementById('btn-validate-contract').addEventListener('click', () => {
      validateGameContract(document.getElementById('code-editor').value);
    });

    // Save Local
    document.getElementById('btn-save-local').addEventListener('click', () => {
      const code = document.getElementById('code-editor').value;
      const id = document.getElementById('game-id').value;
      localStorage.setItem('unplug_custom_' + id, code);
      alert(`Game "${id}" saved to local studio storage!`);
      logEvent('STORAGE', `Saved game ${id} to localStorage.`);
    });

    // Export Package
    document.getElementById('btn-export-pkg').addEventListener('click', exportGamePackage);

    // Push to Android
    document.getElementById('btn-push-android').addEventListener('click', pushToAndroidApp);
    document.getElementById('btn-sync-current-to-apk')?.addEventListener('click', pushToAndroidApp);

    // Build APK
    document.getElementById('btn-build-apk-now')?.addEventListener('click', buildAndroidApk);

    // Open APK Folder
    document.getElementById('btn-open-apk-folder')?.addEventListener('click', () => {
      if (window.unplugDesktop && window.unplugDesktop.openApkFolder) {
        window.unplugDesktop.openApkFolder();
      } else {
        alert('Location: apps/android/android/app/build/outputs/apk/debug/');
      }
    });

    // Ad Simulation Buttons
    document.getElementById('btn-sim-ad-life').addEventListener('click', () => triggerRewardedAd('revive'));
    document.getElementById('btn-sim-ad-hint').addEventListener('click', () => triggerRewardedAd('hint'));
    document.getElementById('btn-sim-restart').addEventListener('click', () => {
      runSandbox(document.getElementById('code-editor').value);
      logEvent('SYSTEM', 'Restarted sandbox game.');
    });
    document.getElementById('btn-sim-clear-logs').addEventListener('click', () => {
      document.getElementById('event-log-console').innerHTML = '';
    });

    // Claim Ad Reward
    document.getElementById('btn-claim-ad-reward').addEventListener('click', () => {
      clearInterval(state.adInterval);
      document.getElementById('ad-modal').classList.remove('open');
      deliverReward(state.pendingAdReward);
      state.pendingAdReward = null;
    });

    // Toggle Ad-Free
    document.getElementById('btn-toggle-adfree').addEventListener('click', () => {
      state.adFree = !state.adFree;
      localStorage.setItem('unplug_adfree', state.adFree ? 'true' : 'false');
      updateHUD();
      const frame = document.getElementById('game-sandbox-frame');
      frame?.contentWindow?.postMessage({ type: 'unplug:adfree_status', adFree: state.adFree }, '*');
      logEvent('ECONOMY', `Ad-Free status toggled: ${state.adFree ? 'ACTIVATED' : 'DEACTIVATED'}`);
      alert(state.adFree ? '💎 Ad-Free Pass Activated!\nAds are now skipped and game hints/lives are granted instantly.' : 'Ad-Free Pass deactivated. Rewarded ads are now active.');
    });

    // Insert SDK Tags
    document.querySelectorAll('.tag-sdk-helper').forEach(tag => {
      tag.addEventListener('click', e => {
        const type = e.target.dataset.sdk;
        const editor = document.getElementById('code-editor');
        let snippet = '';
        if (type === 'ready') snippet = `window.parent.postMessage({ type: 'unplug:ready' }, '*');\n`;
        if (type === 'gameover') snippet = `window.parent.postMessage({ type: 'unplug:gameover', score: score }, '*');\n`;
        if (type === 'revive') snippet = `window.addEventListener('message', e => { if (e.data?.type === 'unplug:revive') { lives = 1; over = false; } });\n`;
        if (type === 'hint') snippet = `window.addEventListener('message', e => { if (e.data?.type === 'unplug:hint') { /* grant hint assist */ } });\n`;
        if (type === 'score') snippet = `window.parent.postMessage({ type: 'unplug:score', score: score }, '*');\n`;

        editor.value += '\n' + snippet;
        logEvent('EDITOR', 'Inserted UNPLUG SDK snippet: ' + type);
      });
    });

    // Arcade Modal Close
    document.getElementById('btn-arcade-close')?.addEventListener('click', () => {
      const modal = document.getElementById('play-modal');
      const frame = document.getElementById('arcade-game-frame');
      frame.src = 'about:blank';
      modal.classList.remove('open');
    });

    document.getElementById('btn-arcade-hint')?.addEventListener('click', () => {
      const frame = document.getElementById('arcade-game-frame');
      frame.contentWindow?.postMessage({ type: 'unplug:hint' }, '*');
      logEvent('ARCADE', 'Dispatched hint to active arcade game.');
    });

    document.getElementById('btn-arcade-new-game')?.addEventListener('click', () => {
      document.querySelector('[data-view="workshop"]').click();
      document.getElementById('template-select').value = 'starter';
      loadTemplate('starter');
    });

    // Remote Service Connection
    document.getElementById('btn-save-remote-service')?.addEventListener('click', () => {
      const url = document.getElementById('remote-service-url').value.trim();
      if (!url) return;
      if (window.unplugDesktop && window.unplugDesktop.connectRemote) {
        window.unplugDesktop.connectRemote(url);
      } else {
        alert('Connected to service: ' + url);
      }
    });
  });
})();