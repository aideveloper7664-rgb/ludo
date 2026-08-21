/* ==========================================================================
   ui.js  –  Ludo UI controller
   Depends on: board-data.js (PATHS, BASE_SLOTS, COLORS)
               game.js      (LudoGame)
   ========================================================================== */

'use strict';

/* ---- Sound helpers ---- */
let musicOn = true;
const SFX = {
  tap:     document.getElementById('sndTap'),
  roll:    document.getElementById('sndRoll'),
  open:    document.getElementById('sndOpen'),
  walkCW:  document.getElementById('sndWalkCW'),
  walkCCW: document.getElementById('sndWalkCCW'),
  capture: document.getElementById('sndCapture'),
  win:     document.getElementById('sndWin'),
};
const bgMusic = document.getElementById('bgMusic');

function playSound(sfxKey) {
  if (!musicOn) return;
  const el = SFX[sfxKey];
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}
function toggleMusic() {
  musicOn = !musicOn;
  const imgs = document.querySelectorAll('.music-btn img');
  imgs.forEach(img => {
    img.src = musicOn
      ? 'assets/object/ak_music_on.png'
      : 'assets/object/ak_music_off.png';
  });
  if (musicOn) bgMusic.play().catch(() => {});
  else bgMusic.pause();
}
document.getElementById('musicToggleHome').addEventListener('click', () => { playSound('tap'); toggleMusic(); });
document.getElementById('musicToggleGame').addEventListener('click', () => { playSound('tap'); toggleMusic(); });

/* ---- Screen helpers ---- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function showOverlay(id) { document.getElementById(id).classList.remove('hidden'); }
function hideOverlay(id) { document.getElementById(id).classList.add('hidden'); }

/* ---- Loading screen ---- */
(function startLoading() {
  const frames = 24;
  let f = 1;
  const spinner = document.getElementById('loadingSpinner');
  const iv = setInterval(() => {
    f = (f % frames) + 1;
    spinner.src = `assets/loading/${f}.png`;
  }, 80);
  setTimeout(() => {
    clearInterval(iv);
    showScreen('homeScreen');
  }, 2000);
})();

/* ---- Home screen ---- */
let selectedPlayerCount = 2;
let selectedColors = new Set();

// Player count buttons
document.querySelectorAll('.pcount-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playSound('tap');
    selectedPlayerCount = +btn.dataset.n;
    document.querySelectorAll('.pcount-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // reset colours
    selectedColors.clear();
    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    updateHint();
    updateStartBtn();
  });
});
// Default 2p highlighted
document.querySelector('.pcount-btn[data-n="2"]').classList.add('active');

// Color chips
document.querySelectorAll('.color-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    playSound('tap');
    const color = chip.dataset.color;
    if (selectedColors.has(color)) {
      selectedColors.delete(color);
      chip.classList.remove('active');
    } else if (selectedColors.size < selectedPlayerCount) {
      selectedColors.add(color);
      chip.classList.add('active');
    }
    updateHint();
    updateStartBtn();
  });
});

function updateHint() {
  const hint = document.getElementById('colorHint');
  const need = selectedPlayerCount - selectedColors.size;
  if (need <= 0) hint.textContent = '✓ Colours ready!';
  else hint.textContent = `${need} colour${need > 1 ? 's' : ''} aur chuno`;
}

function updateStartBtn() {
  const btn = document.getElementById('startBtn');
  btn.disabled = selectedColors.size !== selectedPlayerCount;
}
updateHint();

document.getElementById('startBtn').addEventListener('click', () => {
  playSound('tap');
  const players = COLORS.filter(c => selectedColors.has(c)); // enforce board order
  startGame(players);
});

/* ================================================================
   GAME LOGIC & RENDERING
   ================================================================ */
let game = null;
let rolling = false;

const pawnLayer  = document.getElementById('pawnLayer');
const boardWrap  = document.getElementById('boardWrap');
const diceImg    = document.getElementById('diceImg');
const turnBanner = document.getElementById('turnBanner');
const statusText = document.getElementById('statusText');

/* Convert grid coordinates (0..14) to percentage positions */
function gridToPct(col, row) {
  // The board has 15 cells; each cell is 1/15 of the board width.
  // Centre of cell [c,r] is at ((c + 0.5) / 15) * 100 %
  return {
    left: ((col + 0.5) / 15) * 100,
    top:  ((row + 0.5) / 15) * 100,
  };
}

/* ---- Pawn DOM management ---- */
const pawnEls = {}; // pawnEls[color][id] = <img>

function createPawnElements(players) {
  pawnLayer.innerHTML = '';
  for (const color of players) {
    pawnEls[color] = {};
    for (let id = 0; id < 4; id++) {
      const img = document.createElement('img');
      img.src = `assets/object/ak_pawn_${color}.png`;
      img.alt = `${color} pawn ${id}`;
      img.className = 'pawn in-base';
      img.dataset.color = color;
      img.dataset.id = id;
      img.addEventListener('click', () => onPawnClick(color, id));
      pawnLayer.appendChild(img);
      pawnEls[color][id] = img;
    }
  }
}

function placePawn(color, id, pos) {
  const el = pawnEls[color][id];
  if (!el) return;

  if (pos === -1) {
    // In base
    const [sc, sr] = BASE_SLOTS[color][id];
    const p = gridToPct(sc, sr);
    el.style.left = p.left + '%';
    el.style.top  = p.top  + '%';
    el.classList.add('in-base');
  } else if (pos === FINISH_POS) {
    // At centre
    const [cc, cr] = CENTER;
    const p = gridToPct(cc + (id < 2 ? -0.35 : 0.35), cr + (id % 2 === 0 ? -0.35 : 0.35));
    el.style.left = p.left + '%';
    el.style.top  = p.top  + '%';
    el.classList.remove('in-base');
  } else {
    const [gc, gr] = PATHS[color][pos];
    // Stack offset if multiple pawns share same cell
    const offset = getStackOffset(color, id, pos);
    const p = gridToPct(gc + offset.dc, gr + offset.dr);
    el.style.left = p.left + '%';
    el.style.top  = p.top  + '%';
    el.classList.remove('in-base');
  }
}

function getStackOffset(color, id, pos) {
  // tiny spread if multiple pawns of same colour on same square
  const count = game.pawns[color].filter(p => p.pos === pos).length;
  if (count <= 1) return { dc: 0, dr: 0 };
  const slots = [[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]];
  const myIndex = game.pawns[color].filter(p => p.pos === pos).findIndex(p => p.id === id);
  return myIndex >= 0 ? { dc: slots[myIndex][0], dr: slots[myIndex][1] } : { dc: 0, dr: 0 };
}

function renderAllPawns() {
  if (!game) return;
  for (const color of game.players) {
    for (const pawn of game.pawns[color]) {
      placePawn(color, pawn.id, pawn.pos);
    }
  }
}

function highlightMovable(ids) {
  // Remove all highlights first
  Object.values(pawnEls).forEach(byId => {
    Object.values(byId).forEach(el => el.classList.remove('movable'));
  });
  const color = game.currentPlayer;
  for (const id of ids) {
    if (pawnEls[color] && pawnEls[color][id]) {
      pawnEls[color][id].classList.add('movable');
    }
  }
}

/* ---- Dice animation ---- */
function animateDice(finalValue, cb) {
  rolling = true;
  let count = 0;
  const total = 10;
  const iv = setInterval(() => {
    const face = 1 + Math.floor(Math.random() * 6);
    diceImg.src = `assets/rotateobject/diceroll${1 + (count % 4)}.png`;
    count++;
    if (count >= total) {
      clearInterval(iv);
      diceImg.src = `assets/rotateobject/${finalValue}.png`;
      rolling = false;
      cb();
    }
  }, 80);
}

/* ---- UI state updates ---- */
function updateBanner() {
  const color = game.currentPlayer;
  const colorNames = { green: 'Hara', red: 'Lal', blue: 'Neela', yellow: 'Peela' };
  turnBanner.textContent = `${colorNames[color] || color} ki bari`;
  turnBanner.style.color = `var(--${color})`;
}

/* ---- Game flow ---- */
function startGame(players) {
  game = new LudoGame(players);
  createPawnElements(players);
  renderAllPawns();
  updateBanner();
  statusText.textContent = 'Dice roll karo';
  diceImg.src = 'assets/rotateobject/1.png';
  showScreen('gameScreen');
  bgMusic.play().catch(() => {});
}

// Dice click
document.getElementById('diceArea').addEventListener('click', () => {
  if (!game || game.gameOver || game.diceRolled || rolling) return;
  playSound('roll');
  const val = game.rollDice();
  animateDice(val, () => {
    if (game.sixStreak === 3) {
      statusText.textContent = 'Teen 6! Turn gaya';
      setTimeout(() => {
        game.endTurn(true);
        updateBanner();
        statusText.textContent = 'Dice roll karo';
        renderAllPawns();
      }, 900);
      return;
    }
    const movable = game.movablePawns();
    if (movable.length === 0) {
      statusText.textContent = `${val} aaya – koi move nahi`;
      setTimeout(() => {
        game.endTurn(true);
        updateBanner();
        statusText.textContent = 'Dice roll karo';
        renderAllPawns();
      }, 900);
    } else {
      statusText.textContent = `${val} aaya – pawn chuno`;
      highlightMovable(movable);
    }
  });
});

function onPawnClick(color, id) {
  if (!game || game.gameOver) return;
  if (color !== game.currentPlayer) return;
  if (!game.diceRolled) return;
  const movable = game.movablePawns();
  if (!movable.includes(id)) return;

  playSound('tap');
  const result = game.movePawn(id);
  if (!result) return;

  highlightMovable([]); // clear highlights

  // Sound selection
  if (result.sentHome) playSound('open');
  else if (result.captured.length) playSound('capture');
  else if (result.to >= HOME_ENTRY_POS) playSound('walkCCW');
  else playSound('walkCW');

  renderAllPawns();

  if (result.finished) {
    if (game.hasWon(color)) {
      game.endTurn();
      if (game.gameOver) {
        setTimeout(() => showResult(), 500);
        return;
      }
    }
  }

  if (result.captured.length) {
    statusText.textContent = `Capture! 🎯`;
  } else if (result.finished) {
    statusText.textContent = `Pawn ghar pahuncha! 🏠`;
  } else {
    statusText.textContent = '';
  }

  game.endTurn();
  if (game.gameOver) {
    setTimeout(() => showResult(), 500);
    return;
  }

  updateBanner();
  statusText.textContent = game.diceValue === 6
    ? 'Dobara chance milega – dice roll karo'
    : 'Dice roll karo';
}

function showResult() {
  playSound('win');
  const colorNames = { green: 'Hare', red: 'Lal', blue: 'Neele', yellow: 'Peele' };
  const winner = game.winners[0];
  document.getElementById('resultText').textContent =
    `🏆 ${colorNames[winner] || winner} ne jeeta!`;
  showOverlay('resultScreen');
}

/* ---- Quit panel ---- */
document.getElementById('quitBtn').addEventListener('click', () => {
  playSound('tap');
  showOverlay('quitPanel');
});
document.getElementById('quitNo').addEventListener('click', () => {
  playSound('tap');
  hideOverlay('quitPanel');
});
document.getElementById('quitYes').addEventListener('click', () => {
  playSound('tap');
  hideOverlay('quitPanel');
  bgMusic.pause();
  game = null;
  showScreen('homeScreen');
});

/* ---- Replay ---- */
document.getElementById('replayBtn').addEventListener('click', () => {
  playSound('tap');
  hideOverlay('resultScreen');
  if (game) {
    const players = game.players.slice();
    startGame(players);
  } else {
    showScreen('homeScreen');
  }
});
