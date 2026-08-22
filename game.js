/* ==========================================================================
   GAME.JS - Ludo game engine (rules) - rendering-agnostic
   ========================================================================== */

class LudoGame {
  /**
   * @param {string[]} players - list of colours playing, e.g. ['green','yellow']
   */
  constructor(players) {
    this.players = players;
    this.turnIndex = 0;
    this.sixStreak = 0;
    this.diceValue = null;
    this.diceRolled = false;
    this.winners = [];
    this.gameOver = false;

    // pawns[color] = array of 4 pawns: {pos: -1..61, id}
    this.pawns = {};
    for (const c of players) {
      this.pawns[c] = [0, 1, 2, 3].map(id => ({ id, pos: -1 }));
    }
  }

  get currentPlayer() {
    return this.players[this.turnIndex];
  }

  // ---- geometry helpers -------------------------------------------------
  boardCoordOf(color, pos) {
    if (pos < 0) return null; // in base
    return PATHS[color][pos];
  }

  // ---- dice ---------------------------------------------------------------
  rollDice() {
    if (this.gameOver || this.diceRolled) return null;
    const value = 1 + Math.floor(Math.random() * 6);
    this.diceValue = value;
    this.diceRolled = true;
    if (value === 6) this.sixStreak++; else this.sixStreak = 0;
    return value;
  }

  // list of pawn ids of current player that can legally move with current dice
  movablePawns() {
    if (!this.diceRolled) return [];
    if (this.sixStreak === 3) return []; // three 6's in a row -> forfeit
    const color = this.currentPlayer;
    const d = this.diceValue;
    const result = [];
    for (const p of this.pawns[color]) {
      if (p.pos === FINISH_POS) continue; // already home
      if (p.pos === -1) {
        if (d === 6) result.push(p.id);
      } else if (p.pos + d <= FINISH_POS) {
        result.push(p.id);
      }
    }
    return result;
  }

  // Move a pawn, returns a result descriptor for the UI to animate/react to
  movePawn(pawnId) {
    const color = this.currentPlayer;
    const pawn = this.pawns[color].find(p => p.id === pawnId);
    if (!pawn) return null;
    const d = this.diceValue;
    const result = { color, pawnId, from: pawn.pos, captured: [], finished: false, sentHome: false };

    if (pawn.pos === -1) {
      if (d !== 6) return null;
      pawn.pos = 0;
      result.sentHome = true; // left base
    } else {
      const newPos = pawn.pos + d;
      if (newPos > FINISH_POS) return null;
      pawn.pos = newPos;
    }
    result.to = pawn.pos;

    // capture check - only while on the common ring (pos 0..54)
    if (pawn.pos >= 0 && pawn.pos < HOME_ENTRY_POS) {
      const [col, row] = PATHS[color][pawn.pos];
      if (!isSafeCoord(col, row)) {
        for (const otherColor of this.players) {
          if (otherColor === color) continue;
          for (const op of this.pawns[otherColor]) {
            if (op.pos < 0 || op.pos >= HOME_ENTRY_POS) continue;
            const [ocol, orow] = PATHS[otherColor][op.pos];
            if (ocol === col && orow === row) {
              op.pos = -1;
              result.captured.push({ color: otherColor, pawnId: op.id });
            }
          }
        }
      }
    }

    if (pawn.pos === FINISH_POS) {
      result.finished = true;
    }

    return result;
  }

  hasWon(color) {
    return this.pawns[color].every(p => p.pos === FINISH_POS);
  }

  // Call after a move (or a no-move turn) to figure out whose turn is next.
  // The first player to get all 4 pawns home wins and the game ends there
  // (simple, casual-friendly rule - matches most mobile ludo apps).
  endTurn(forcedPass = false) {
    const color = this.currentPlayer;

    if (this.hasWon(color) && !this.winners.includes(color)) {
      this.winners.push(color);
      this.gameOver = true;
      this.diceRolled = false;
      this.diceValue = null;
      this.sixStreak = 0;
      return;
    }

    const extraTurn = !forcedPass && this.diceValue === 6 && this.sixStreak < 3;
    this.diceRolled = false;
    this.diceValue = null;
    if (this.sixStreak === 3) this.sixStreak = 0;

    if (!extraTurn) {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      this.sixStreak = 0;
    }
  }
}
