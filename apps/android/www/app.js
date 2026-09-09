// UNPLUG Mobile Game App Engine & Store
(() => {
  'use strict';

  // State
  let state = {
    lives: parseInt(localStorage.getItem('unplug_lives') || '3', 10),
    hints: parseInt(localStorage.getItem('unplug_hints') || '3', 10),
    highScore: parseInt(localStorage.getItem('unplug_highscore') || '0', 10),
    adFree: localStorage.getItem('unplug_adfree') === 'true',
    activeGame: null,
    pendingReward: null,
    adTimerInterval: null
  };

  const gameTitles = {
    bounce: 'Bounce Arcade',
    snake: 'Neon Trail (Snake)',
    memory: 'Memory Garden',
    space_dodge: 'Space Dodge'
  };

  function updateHUD() {
    document.getElementById('hud-lives').textContent = state.lives;
    document.getElementById('hud-hints').textContent = state.hints;
    document.getElementById('hud-score').textContent = state.highScore;

    const adFreeBtn = document.getElementById('adfree-btn');
    const passStatus = document.getElementById('pass-toggle-status');

    if (state.adFree) {
      adFreeBtn.textContent = '💎 Ad-Free: ON';
      adFreeBtn.classList.add('active');
      if (passStatus) {
        passStatus.textContent = 'ACTIVE (Unlimited Free Perks)';
        passStatus.style.color = 'var(--green)';
      }
    } else {
      adFreeBtn.textContent = '⭐ Go Ad-Free';
      adFreeBtn.classList.remove('active');
      if (passStatus) {
        passStatus.textContent = 'INACTIVE (Ads Enabled)';
        passStatus.style.color = 'var(--red)';
      }
    }

    // High scores per game
    for (const key of ['bounce', 'snake', 'memory', 'space_dodge']) {
      const best = localStorage.getItem('unplug_best_' + key) || '0';
      const el = document.getElementById('score-' + (key === 'space_dodge' ? 'space' : key));
      if (el) el.textContent = 'Best: ' + best;
    }
  }

  // Launch Game
  window.launchGame = function(gameId, customSrc = null) {
    state.activeGame = gameId;
    const title = gameTitles[gameId] || 'Custom Game';
    document.getElementById('active-game-title').textContent = title;
    
    const frame = document.getElementById('game-frame');
    if (customSrc) {
      frame.src = customSrc;
    } else {
      frame.src = 'games/' + gameId + '.html';
    }

    document.getElementById('player-modal').classList.add('open');
  };

  window.closeGame = function() {
    const frame = document.getElementById('game-frame');
    frame.src = 'about:blank';
    document.getElementById('player-modal').classList.remove('open');
    state.activeGame = null;
    updateHUD();
  };

  window.restartActiveGame = function() {
    if (state.activeGame) {
      launchGame(state.activeGame);
    }
  };

  // In-Game Hint
  window.requestInGameHint = function() {
    if (state.adFree || state.hints > 0) {
      if (!state.adFree) {
        state.hints--;
        localStorage.setItem('unplug_hints', state.hints);
        updateHUD();
      }
      sendToGame({ type: 'unplug:hint' });
    } else {
      // Prompt ad for hints
      state.pendingReward = 'hint_refill';
      openAdOverlay();
    }
  };

  // Send message to active game iframe
  function sendToGame(msg) {
    const frame = document.getElementById('game-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(msg, '*');
    }
  }

  // Handle Game Messages
  window.addEventListener('message', e => {
    if (!e.data) return;
    const data = e.data;

    // Score update
    if (data.type === 'unplug:score' && typeof data.score === 'number') {
      if (data.score > state.highScore) {
        state.highScore = data.score;
        localStorage.setItem('unplug_highscore', state.highScore);
      }
      if (data.game) {
        const key = 'unplug_best_' + data.game;
        const currentBest = parseInt(localStorage.getItem(key) || '0', 10);
        if (data.score > currentBest) {
          localStorage.setItem(key, data.score);
        }
      }
      updateHUD();
    }

    // Game Over Encounter
    if (data.type === 'unplug:gameover') {
      if (data.score > state.highScore) {
        state.highScore = data.score;
        localStorage.setItem('unplug_highscore', state.highScore);
        updateHUD();
      }

      if (state.adFree) {
        // Free instant revive!
        setTimeout(() => {
          if (confirm('💎 Ad-Free Pass Active!\nWould you like an instant free revive to continue playing?')) {
            sendToGame({ type: 'unplug:revive' });
          }
        }, 300);
      } else {
        // Offer Rewarded Ad for Extra Life
        setTimeout(() => {
          if (confirm('💔 Game Over! (Score: ' + data.score + ')\n\nWatch a quick 5-second sponsor ad to get +1 Extra Life and continue playing?')) {
            state.pendingReward = 'revive';
            openAdOverlay();
          }
        }, 300);
      }
    }

    if (data.type === 'unplug:req_hint') {
      requestInGameHint();
    }
  });

  // Rewarded Ad Simulation
  function openAdOverlay() {
    const overlay = document.getElementById('ad-overlay');
    const timerEl = document.getElementById('ad-timer');
    const claimBtn = document.getElementById('claim-ad-btn');

    let seconds = 5;
    timerEl.textContent = seconds;
    claimBtn.disabled = true;
    claimBtn.textContent = 'Reward Locking (' + seconds + 's)...';
    overlay.classList.add('open');

    clearInterval(state.adTimerInterval);
    state.adTimerInterval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        timerEl.textContent = seconds;
        claimBtn.textContent = 'Reward Locking (' + seconds + 's)...';
      } else {
        clearInterval(state.adTimerInterval);
        timerEl.textContent = '✓ Ready';
        claimBtn.disabled = false;
        claimBtn.textContent = '🎉 Claim ' + (state.pendingReward === 'revive' ? '+1 Extra Life' : '+3 Hints');
      }
    }, 1000);
  }

  window.closeAdOverlay = function() {
    clearInterval(state.adTimerInterval);
    document.getElementById('ad-overlay').classList.remove('open');
    state.pendingReward = null;
  };

  window.claimAdReward = function() {
    if (state.pendingReward === 'revive') {
      state.lives++;
      localStorage.setItem('unplug_lives', state.lives);
      sendToGame({ type: 'unplug:revive' });
      alert('🎉 Reward Claimed: +1 Extra Life granted! Resuming game...');
    } else if (state.pendingReward === 'hint_refill') {
      state.hints += 3;
      localStorage.setItem('unplug_hints', state.hints);
      sendToGame({ type: 'unplug:hint' });
      alert('🎉 Reward Claimed: +3 Hints added to your account!');
    }
    updateHUD();
    closeAdOverlay();
  };

  // Ad-Free Pass Dialog
  document.getElementById('adfree-btn').addEventListener('click', () => {
    document.getElementById('adfree-modal').classList.add('open');
  });

  window.closeAdFreeModal = function() {
    document.getElementById('adfree-modal').classList.remove('open');
  };

  window.toggleAdFreePass = function() {
    state.adFree = !state.adFree;
    localStorage.setItem('unplug_adfree', state.adFree ? 'true' : 'false');
    updateHUD();
    alert(state.adFree ? '💎 Ad-Free Pass Activated! Unlimited free revives and hints unlocked.' : 'Ad-Free Pass deactivated.');
    closeAdFreeModal();
  };

  // Developer Game Import
  document.getElementById('dev-btn').addEventListener('click', () => {
    document.getElementById('dev-modal').classList.add('open');
  });

  window.openDevModal = function() {
    document.getElementById('dev-modal').classList.add('open');
  };

  window.closeDevModal = function() {
    document.getElementById('dev-modal').classList.remove('open');
  };

  window.importCustomGame = function() {
    const fileInput = document.getElementById('game-file-input');
    const codeInput = document.getElementById('game-code-input').value.trim();

    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = e => {
        const blob = new Blob([e.target.result], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        closeDevModal();
        launchGame('custom', url);
      };
      reader.readAsText(file);
    } else if (codeInput) {
      const blob = new Blob([codeInput], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      closeDevModal();
      launchGame('custom', url);
    } else {
      alert('Please select an HTML file or enter HTML5 game code.');
    }
  };

  // Initial Load
  updateHUD();
})();
