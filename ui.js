/* ==========================================================================
   UI.JS - wires the LudoGame engine to the DOM
   ========================================================================== */

const COLOR_LABEL = { green: 'Green', red: 'Red', yellow: 'Yellow', blue: 'Blue' };
const COLOR_HEX = { green: '#1fa059', red: '#e53935', yellow: '#f5c518', blue: '#2196f3' };

let game = null;
let selectedPlayerCount = 2;
let selectedColors = [];
let musicOn = true;
let rollLock = false;

// ---------------------------------------------------------------------
// Boot / loading screen
// ---------------------------------------------------------------------
window.addEventListener('load', () => {
  setTimeout(() => {
    show('homeScreen');
    hide('loadingScreen');
  }, 600);
});

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch (e) {}
}

// ---------------------------------------------------------------------
// HOME SCREEN - player count + colour selection
// ---------------------------------------------------------------------
const DEFAULT_COLORS_BY_COUNT = {
  2: ['green', 'blue'],
  3: ['green', 'red', 'blue'],
  4: ['green', 'red', 'blue', 'yellow']
};

function initHomeScreen() {
  const pcountBtns = document.querySelectorAll('.pcount-btn');
  pcountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pcountBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlayerCount = parseInt(btn.dataset.n, 10);
      selectedColors = DEFAULT_COLORS_BY_COUNT[selectedPlayerCount].slice();
      syncColorChips();
      playSound('sndTap');
    });
  });
  // default select 2p
  pcountBtns[0].classList.add('selected');
  selectedColors = DEFAULT_COLORS_BY_COUNT[2].slice();

  const colorChips = document.querySelectorAll('.color-chip');
  colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const c = chip.dataset.color;
      playSound('sndTap');
      if (selectedColors.includes(c)) {
        selectedColors = selectedColors.filter(x => x !== c);
      } else {
        if (selectedColors.length >= selectedPlayerCount) {
          // replace the earliest chosen colour
          selectedColors.shift();
        }
        selectedColors.push(c);
      }
      syncColorChips();
    });
  });

  syncColorChips();

  document.getElementById('startBtn').addEventListener('click', () => {
    if (selectedColors.length !== selectedPlayerCount) return;
    playSound('sndTap');
    startGame(selectedColors.slice());
  });

  document.getElementById('musicToggleHome').addEventListener('click', toggleMusic);
  document.getElementById('musicToggleGame').addEventListener('click', toggleMusic);
}

function syncColorChips() {
  const chips = document.querySelectorAll('.color-chip');
  chips.forEach(chip => {
    const c = chip.dataset.color;
    chip.classList.toggle('selected', selectedColors.includes(c));
  });
  const hint = document.getElementById('colorHint');
  const remaining = selectedPlayerCount - selectedColors.length;
  hint.textContent = remaining > 0
    ? `${remaining} colour${remaining > 1 ? 's' : ''} aur chuno`
    : `${selectedPlayerCount} colours chuni gayi \u2713`;
  document.getElementById('startBtn').disabled = selectedColors.length !== selectedPlayerCount;
}

function toggleMusic() {
  musicOn = !musicOn;
  const bg = document.getElementById('bgMusic');
  const icons = ['musicToggleHome', 'musicToggleGame'];
  icons.forEach(id => {
    document.querySelector(`#${id} img`).src = musicOn
      ? 'assets/object/ak_music_on.png'
      : 'assets/object/ak_music_off.png';
  });
  if (musicOn) {
    bg.volume = 0.35;
    bg.play().catch(() => {});
  } else {
    bg.pause();
  }
}

// ---------------------------------------------------------------------
// GAME SCREEN
// ---------------------------------------------------------------------
function startGame(players) {
  game = new LudoGame(players);
  hide('homeScreen');
  show('gameScreen');
  buildPawnLayer();
  renderAll();
  updateStatus('Dice roll karo');
  if (musicOn) {
    const bg = document.getElementById('bgMusic');
    bg.volume = 0.35;
    bg.play().catch(() => {});
  }
}

function buildPawnLayer() {
  const layer = document.getElementById('pawnLayer');
  layer.innerHTML = '';
  for (const color of game.players) {
    for (const pawn of game.pawns[color]) {
      const img = document.createElement('img');
      img.className = 'pawn';
      img.dataset.color = color;
      img.dataset.id = pawn.id;
      img.src = `assets/object/ak_pawn_${color}.png`;
      img.addEventListener('click', onPawnClick);
      layer.appendChild(img);
    }
  }
}

// Convert a fractional grid coordinate (0..15) to % position within board
function gridToPercent(gx, gy) {
  return { left: (gx / 15) * 100, top: (gy / 15) * 100 };
}

function pawnGridPos(color, pawn, stackIndex, stackSize) {
  if (pawn.pos === -1) {
    const slotIdx = pawn.id % 4;
    const [sx, sy] = BASE_SLOTS[color][slotIdx];
    return [sx, sy];
  }
  const [col, row] = PATHS[color][pawn.pos];
  // nudge stacked pawns apart slightly so they don't fully overlap
  if (stackSize > 1) {
    const offsets = [[-0.16,-0.16],[0.16,-0.16],[-0.16,0.16],[0.16,0.16]];
    const [ox, oy] = offsets[stackIndex % 4];
    return [col + 0.5 + ox, row + 0.5 + oy];
  }
  return [col + 0.5, row + 0.5];
}

function renderAll() {
  renderPawns();
  renderTurnBanner();
  renderDice();
}

function renderPawns() {
  // group pawns by exact board cell to know stack sizes (only when pos !== -1)
  const cellGroups = {};
  for (const color of game.players) {
    for (const pawn of game.pawns[color]) {
      if (pawn.pos === -1) continue;
      const [col, row] = PATHS[color][pawn.pos];
      const key = col + ',' + row;
      cellGroups[key] = cellGroups[key] || [];
      cellGroups[key].push({ color, pawn });
    }
  }

  const movable = game.diceRolled ? new Set(game.movablePawns()) : new Set();
  const canInteract = game.diceRolled && !game.gameOver;

  const layer = document.getElementById('pawnLayer');
  for (const color of game.players) {
    for (const pawn of game.pawns[color]) {
      const el = layer.querySelector(`.pawn[data-color="${color}"][data-id="${pawn.id}"]`);
      if (!el) continue;

      let stackIndex = 0, stackSize = 1;
      if (pawn.pos !== -1) {
        const [col, row] = PATHS[color][pawn.pos];
        const key = col + ',' + row;
        const group = cellGroups[key];
        stackSize = group.length;
        stackIndex = group.findIndex(g => g.color === color && g.pawn.id === pawn.id);
      }

      const [gx, gy] = pawnGridPos(color, pawn, stackIndex, stackSize);
      const { left, top } = gridToPercent(gx, gy);
      el.style.left = left + '%';
      el.style.top = top + '%';

      const isMovable = color === game.currentPlayer && canInteract && movable.has(pawn.id);
      el.classList.toggle('movable', isMovable);
      el.style.pointerEvents = isMovable ? 'auto' : 'none';
      el.style.zIndex = pawn.pos === -1 ? 3 : (5 + stackIndex);
    }
  }
}

function renderTurnBanner() {
  const banner = document.getElementById('turnBanner');
  if (game.gameOver) {
    banner.textContent = 'Game khatam!';
    return;
  }
  const color = game.currentPlayer;
  banner.textContent = `${COLOR_LABEL[color]} ki baari`;
  banner.style.color = '#333';
  banner.style.borderLeft = `8px solid ${COLOR_HEX[color]}`;
}

function renderDice() {
  const img = document.getElementById('diceImg');
  const val = game.diceValue || 1;
  img.src = `assets/rotateobject/${val}.png`;
}

function updateStatus(text) {
  document.getElementById('statusText').textContent = text;
}

// ---------------------------------------------------------------------
// Dice roll interaction
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initHomeScreen();
  document.getElementById('diceArea').addEventListener('click', onDiceClick);
  document.getElementById('quitBtn').addEventListener('click', () => show('quitPanel'));
  document.getElementById('quitYes').addEventListener('click', () => {
    hide('quitPanel');
    hide('gameScreen');
    document.getElementById('bgMusic').pause();
    show('homeScreen');
  });
  document.getElementById('quitNo').addEventListener('click', () => hide('quitPanel'));
  document.getElementById('replayBtn').addEventListener('click', () => {
    hide('resultScreen');
    hide('gameScreen');
    show('homeScreen');
  });
});

function onDiceClick() {
  if (!game || game.gameOver || rollLock || game.diceRolled) return;
  rollLock = true;
  const diceArea = document.getElementById('diceArea');
  diceArea.classList.add('rolling');
  playSound('sndRoll');

  let frame = 0;
  const spin = setInterval(() => {
    frame = (frame % 6) + 1;
    document.getElementById('diceImg').src = `assets/rotateobject/${frame}.png`;
  }, 80);

  setTimeout(() => {
    clearInterval(spin);
    diceArea.classList.remove('rolling');
    const value = game.rollDice();
    renderDice();
    rollLock = false;
    handlePostRoll(value);
  }, 650);
}

function handlePostRoll(value) {
  if (game.sixStreak === 3) {
    updateStatus(`3 chhakke laga diye! Baari khatam.`);
    setTimeout(() => {
      game.endTurn(true);
      renderAll();
      updateStatus('Dice roll karo');
    }, 900);
    return;
  }

  const movable = game.movablePawns();
  renderPawns();

  if (movable.length === 0) {
    updateStatus(`${value} aaya, lekin koi chaal nahi. Agli baari.`);
    setTimeout(() => {
      game.endTurn(true);
      renderAll();
      updateStatus('Dice roll karo');
    }, 900);
  } else {
    updateStatus(`${value} aaya \u2014 ek pawn chuno`);
  }
}

// ---------------------------------------------------------------------
// Pawn interaction
// ---------------------------------------------------------------------
function onPawnClick(e) {
  const el = e.currentTarget;
  const color = el.dataset.color;
  const id = parseInt(el.dataset.id, 10);
  if (!game || game.gameOver) return;
  if (color !== game.currentPlayer) return;
  if (!game.diceRolled) return;
  if (!game.movablePawns().includes(id)) return;

  const result = game.movePawn(id);
  if (!result) return;

  playSound(result.sentHome ? 'sndOpen' : 'sndWalkCW');
  renderPawns();

  if (result.captured.length > 0) {
    setTimeout(() => playSound('sndCapture'), 200);
  }

  setTimeout(() => {
    const color2 = game.currentPlayer;
    let msg = '';
    if (result.finished) msg = `${COLOR_LABEL[color2]} ka pawn ghar pahuncha! `;
    if (result.captured.length > 0) msg += `Kaat diya! `;

    if (game.hasWon(color2) && !game.gameOver) {
      // mark winner via endTurn logic below
    }

    const wasSix = game.diceValue === 6 && game.sixStreak < 3;
    game.endTurn(false);

    if (game.gameOver) {
      renderAll();
      showResult();
      return;
    }

    renderAll();
    if (msg) updateStatus(msg + (wasSix ? '(extra chaal)' : ''));
    else updateStatus(wasSix ? 'Chhakka! Ek aur chaal.' : 'Dice roll karo');
  }, 320);
}

function showResult() {
  playSound('sndWin');
  const winner = game.winners[0];
  document.getElementById('resultText').textContent =
    winner ? `${COLOR_LABEL[winner]} JEET GAYA! \uD83C\uDFC6` : 'Game Over';
  show('resultScreen');
}
