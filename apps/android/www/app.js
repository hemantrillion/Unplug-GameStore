// UNPLUG Mobile Arcade Engine
(() => {
  'use strict';

  // Catalog of approved games (updated by UNPLUG build pipeline)
  const CATALOG = window.UNPLUG_CATALOG || [
    {
      id: 'snake',
      title: 'Neon Trail (Snake)',
      description: 'Collect glowing sparks and steer your neon trail across the cyber grid.',
      category: 'Retro Arcade',
      icon: '🐍',
      version: '1.0.0',
      color: '#9271cf',
      isNew: true
    }
  ];

  // Game icons fallback map
  const GAME_ICONS = {
    snake: '🐍',
    bounce: '🏓',
    memory: '🌸',
    space_dodge: '🚀'
  };

  let activeGameId = null;
  let adCountdown = 5;
  let adInterval = null;

  function getBestScore(gameId) {
    return parseInt(localStorage.getItem('unplug_best_' + gameId) || '0', 10);
  }

  function setBestScore(gameId, score) {
    const current = getBestScore(gameId);
    if (score > current) {
      localStorage.setItem('unplug_best_' + gameId, score);
      return true;
    }
    return false;
  }

  function renderCatalog() {
    const container = document.getElementById('games-container');
    const statusPill = document.getElementById('catalog-status');

    if (!container) return;

    if (!CATALOG || CATALOG.length === 0) {
      container.innerHTML = `
        <div class="empty-shelf">
          <div style="font-size:40px;">🕹️</div>
          <h3>No Games Available</h3>
          <p>Approve and activate a game in the UNPLUG Workspace to add it to your mobile console.</p>
        </div>
      `;
      if (statusPill) statusPill.textContent = '● 0 Games Ready';
      return;
    }

    if (statusPill) {
      statusPill.textContent = `● ${CATALOG.length} ${CATALOG.length === 1 ? 'Game' : 'Games'} Ready`;
    }

    container.innerHTML = CATALOG.map((game, index) => {
      const best = getBestScore(game.id);
      const icon = game.icon || GAME_ICONS[game.id] || '🎮';
      const isFeatured = index === 0;

      return `
        <article class="game-card ${isFeatured ? 'featured' : ''}" data-game="${escapeHtml(game.id)}">
          <div class="card-topbar">
            <div class="badge-row">
              <span class="badge badge-verified">● Verified & Approved</span>
              ${game.isNew ? '<span class="badge badge-new">✨ LIVE RELEASE</span>' : ''}
            </div>
            <span class="card-score-pill" id="best-${escapeHtml(game.id)}">🏆 Best: ${best}</span>
          </div>

          <div class="card-body">
            <div class="card-icon-box" style="background: ${escapeHtml(game.color || '#6366f1')}22; border-color: ${escapeHtml(game.color || '#6366f1')}55;">
              <span>${icon}</span>
            </div>
            <div class="card-details">
              <h2 class="card-title">${escapeHtml(game.title)}</h2>
              <p class="card-desc">${escapeHtml(game.description)}</p>
            </div>
          </div>

          <div class="card-footer">
            <button class="play-btn" onclick="window.UNPLUG.play('${escapeHtml(game.id)}')">
              <span>▶</span> PLAY NOW
            </button>
            <div class="card-meta">
              <span>v${escapeHtml(game.version || '1.0.0')} · Offline First</span>
              <span>Touch & Swipe Ready</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function launchGame(gameId) {
    const game = CATALOG.find(g => g.id === gameId);
    if (!game) return;

    activeGameId = gameId;
    const modal = document.getElementById('player-modal');
    const titleEl = document.getElementById('active-game-title');
    const bestEl = document.getElementById('player-best-score');
    const frame = document.getElementById('game-frame');

    if (titleEl) titleEl.textContent = game.title;
    if (bestEl) bestEl.textContent = 'Best: ' + getBestScore(gameId);

    frame.src = 'games/' + encodeURIComponent(gameId) + '.html';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function exitGame() {
    const modal = document.getElementById('player-modal');
    const frame = document.getElementById('game-frame');

    frame.src = 'about:blank';
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    activeGameId = null;

    closeAdModal();
    renderCatalog();
  }

  function restartGame() {
    if (activeGameId) {
      const frame = document.getElementById('game-frame');
      frame.src = 'games/' + encodeURIComponent(activeGameId) + '.html';
      closeAdModal();
    }
  }

  // Rewarded Ad Simulation
  function showAdModal(score) {
    const overlay = document.getElementById('ad-overlay');
    const claimBtn = document.getElementById('claim-reward-btn');
    const timerEl = document.getElementById('ad-countdown');
    const bar = document.getElementById('ad-progress-bar');

    adCountdown = 5;
    timerEl.textContent = adCountdown;
    bar.style.width = '0%';
    claimBtn.disabled = true;
    claimBtn.textContent = 'Watching Sponsor (5s)...';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');

    clearInterval(adInterval);
    adInterval = setInterval(() => {
      adCountdown--;
      const progress = ((5 - adCountdown) / 5) * 100;
      bar.style.width = progress + '%';

      if (adCountdown > 0) {
        timerEl.textContent = adCountdown;
        claimBtn.textContent = `Watching Sponsor (${adCountdown}s)...`;
      } else {
        clearInterval(adInterval);
        timerEl.textContent = '✓';
        bar.style.width = '100%';
        claimBtn.disabled = false;
        claimBtn.textContent = '🎉 Claim Extra Life & Revive!';
      }
    }, 1000);
  }

  function closeAdModal() {
    clearInterval(adInterval);
    const overlay = document.getElementById('ad-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function claimReward() {
    const frame = document.getElementById('game-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'unplug:revive' }, '*');
    }
    closeAdModal();
  }

  // Listen for iframe messages
  window.addEventListener('message', e => {
    if (!e.data || typeof e.data !== 'object') return;

    if (e.data.type === 'unplug:score' && typeof e.data.score === 'number' && activeGameId) {
      setBestScore(activeGameId, e.data.score);
      const bestEl = document.getElementById('player-best-score');
      if (bestEl) bestEl.textContent = 'Best: ' + getBestScore(activeGameId);
    }

    if (e.data.type === 'unplug:gameover') {
      const score = typeof e.data.score === 'number' ? e.data.score : 0;
      if (activeGameId) {
        setBestScore(activeGameId, score);
        const bestEl = document.getElementById('player-best-score');
        if (bestEl) bestEl.textContent = 'Best: ' + getBestScore(activeGameId);
      }
      setTimeout(() => {
        showAdModal(score);
      }, 300);
    }
  });

  // UI Event bindings
  document.getElementById('btn-exit-game')?.addEventListener('click', exitGame);
  document.getElementById('btn-restart-game')?.addEventListener('click', restartGame);
  document.getElementById('claim-reward-btn')?.addEventListener('click', claimReward);
  document.getElementById('skip-ad-btn')?.addEventListener('click', closeAdModal);

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Global interface
  window.UNPLUG = {
    play: launchGame,
    exit: exitGame,
    restart: restartGame,
    setCatalog: function(games) {
      if (Array.isArray(games)) {
        window.UNPLUG_CATALOG = games;
        renderCatalog();
      }
    }
  };

  // Initial render
  renderCatalog();
})();
