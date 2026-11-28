/* 数学十字谜 — state owner.
   Exactly one owner of the game state: a factory whose state lives
   in a closure and changes only through the explicit actions below.
   The view subscribes via setListener and re-renders from the
   read-only accessors; nothing outside this module mutates state.
   Undo snapshots are plain serialisable data — cell key ->
   { value, tileId } plus counts and flags, tiles named by their
   stable id, never live object references. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;
  const Ops = MC.Ops;
  const cellKey = MC.util.cellKey;

  function createGame(dependencies) {
    let Puzzle = dependencies.puzzle;
    let Solver = dependencies.solver;
    let audio = dependencies.audio;
    let translate = dependencies.translate;
    let Daily = MC.Daily || null;
    let onDailyWin = dependencies.onDailyWin || null;

    let state = null;       /* the one private state object */
    let confirmOpen = false;
    let sorted = false;
    let endKind = null;     /* null | "win" | "lose" */
    let roundId = 0;
    let listener = null;

    function notify(effects) {
      if (listener) listener(effects || {});
    }
    function solverContext() {
      return { cellMap: state.cellMap, eqs: state.eqs, tiles: state.tiles };
    }

    /* ================= timer ================= */
    function stopTimer() {
      if (state && state.timerId) { global.clearInterval(state.timerId); state.timerId = null; }
    }
    function startTimer() {
      stopTimer();
      state.timerId = global.setInterval(function () {
        if (!state.paused && !state.over && !confirmOpen) {
          state.seconds++;
          notify({ tick: true });
        }
      }, CONFIG.TIMER_INTERVAL_MS);
    }
    function formatTime(totalSeconds) {
      let minutes = Math.floor(totalSeconds / 60), seconds = totalSeconds % 60;
      return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    /* ================= lifecycle ================= */
    function freshState(difficulty, puzzle, board, dailyKey) {
      return {
        diff: difficulty, dailyKey: dailyKey || null, eqs: puzzle.eqs, cellMap: board.cellMap,
        rows: board.rows, cols: board.cols, maxDigits: board.maxDigits,
        blankKeys: board.blankKeys, tiles: board.tiles,
        selected: null, badKeys: {}, alertedSigs: {}, history: [],
        mistakes: 0, hints: 0, seconds: 0,
        paused: false, over: false, timerId: null
      };
    }
    /* With a dailyKey the puzzle is the date's seeded one — the
       same board every time that date is opened; without one it
       is a fresh random puzzle and any daily round is left behind. */
    function newGame(difficulty, dailyKey) {
      let seed = dailyKey && Daily ? Daily.seedForKey(dailyKey) : null;
      let puzzle = Puzzle.generate(difficulty, seed);
      if (!puzzle) puzzle = Puzzle.generate(difficulty, seed); // generation is randomized; a second pass virtually always succeeds
      if (state) stopTimer();
      state = freshState(difficulty, puzzle, Puzzle.buildBoard(puzzle), dailyKey);
      endKind = null;
      sorted = false;
      confirmOpen = false;
      roundId++;
      startTimer();
      notify({ rebuild: true });
    }
    function clearBoardCells() {
      state.blankKeys.forEach(function (k) {
        state.cellMap[k].filled = false;
        state.cellMap[k].value = null;
        state.cellMap[k].tileIdx = null;
      });
      state.tiles.forEach(function (tile) { tile.used = false; });
      state.tiles.sort(function (a, b) { return a.orig - b.orig; });
    }
    function restartSame() {
      if (!state) return;
      clearBoardCells();
      endKind = null;
      state.selected = null;
      state.badKeys = {};
      state.alertedSigs = {};
      state.history = [];
      state.mistakes = 0;
      state.hints = 0;
      state.seconds = 0;
      state.paused = false;
      state.over = false;
      sorted = false;
      confirmOpen = false;
      startTimer();
      notify({});
    }

    /* ================= judging =================
       A placement is NOT judged the moment it lands. No alert, no red
       mark and no mistake is counted while the equations through the
       cell are still incomplete — a lone number cannot be "wrong" yet.
       The alert fires only when an equation is fully filled and its
       numbers do not match each other (judgeMismatch): then the
       equation's filled cells show red, one mistake is counted, and a
       toast names the failing equation. The same completed equation
       with the same numbers alerts only once (state.alertedSigs);
       fixing it and breaking it again alerts again. A wrong number is
       NOT taken back automatically: it stays in its cell and the
       player fixes it. Once counted, a mistake is never un-counted:
       taking the number back, or undoing the move that caused it,
       keeps the count — it resets only when a round starts (a new
       puzzle, a restart of the same arrangement, or a difficulty
       change). */
    function cellValue(k) {
      let cell = state.cellMap[k];
      if (!cell || cell.type !== "num") return null;
      return cell.blank ? (cell.filled ? cell.value : null) : cell.answer;
    }
    function equationComplete(eq) {
      return cellValue(cellKey(eq.pa.r, eq.pa.c)) != null &&
             cellValue(cellKey(eq.pb.r, eq.pb.c)) != null &&
             cellValue(cellKey(eq.pres.r, eq.pres.c)) != null;
    }
    function equationFails(eq) {
      if (!equationComplete(eq)) return false;
      return !Ops.holds(eq.op,
        cellValue(cellKey(eq.pa.r, eq.pa.c)),
        cellValue(cellKey(eq.pb.r, eq.pb.c)),
        cellValue(cellKey(eq.pres.r, eq.pres.c)));
    }
    function equationText(eq) {
      return cellValue(cellKey(eq.pa.r, eq.pa.c)) + " " + Ops.symbolOf(eq.op) + " " +
             cellValue(cellKey(eq.pb.r, eq.pb.c)) + " = " + cellValue(cellKey(eq.pres.r, eq.pres.c));
    }
    function markFilledWrong(k, wrong) {
      let cell = state.cellMap[k];
      if (cell && cell.blank && cell.filled) wrong[k] = true;
    }
    /* keys of player-filled cells to render red: cells flagged wrong
       the moment they were placed (badKeys), plus filled cells that
       belong to a completed equation which does not hold */
    function computeWrongKeys() {
      let wrong = {};
      if (!state) return wrong;
      Object.keys(state.badKeys || {}).forEach(function (k) { markFilledWrong(k, wrong); });
      state.eqs.forEach(function (eq) {
        if (!equationFails(eq)) return;
        [eq.pa, eq.pb, eq.pres].forEach(function (pos) { markFilledWrong(cellKey(pos.r, pos.c), wrong); });
      });
      return wrong;
    }
    /* Once the board (with every filled number counted) can be
       completed again, no filled number is wrong anymore — drop any
       stale flags, e.g. after the player took back a different number
       that was blocking the flagged one. */
    function clearStaleBadKeys() {
      if (!state || !Object.keys(state.badKeys || {}).length) return;
      if (Solver.findSolution(solverContext())) state.badKeys = {};
    }
    function equationInvolvesAny(eq, keys) {
      return keys.some(function (placedKey) {
        return cellKey(eq.pa.r, eq.pa.c) === placedKey ||
               cellKey(eq.pb.r, eq.pb.c) === placedKey ||
               cellKey(eq.pres.r, eq.pres.c) === placedKey;
      });
    }
    /* Scan the equations through the placed cells: note each newly
       completed equation whose numbers do not match each other. */
    function scanMismatches(placedKeys) {
      let firstFail = null, newly = false;
      state.eqs.forEach(function (eq, eqIndex) {
        if (!equationInvolvesAny(eq, placedKeys)) return;
        if (equationFails(eq)) {
          let signature = equationText(eq);
          if (state.alertedSigs[eqIndex] !== signature) {
            state.alertedSigs[eqIndex] = signature;
            newly = true;
            if (!firstFail) firstFail = eq;
          }
        } else delete state.alertedSigs[eqIndex];
      });
      return { firstFail: firstFail, newly: newly };
    }
    function showMistakeEnd() {
      state.over = true;
      endKind = "lose";
      stopTimer();
    }
    /* Alert only when a completed equation through one of the placed
       cells fails — i.e. when its filled numbers do not match each
       other. Incomplete equations never alert. Returns the effects
       for the view when a new mismatch was alerted (one mistake
       counted per alert), or null. */
    function judgeMismatch(placedKeys) {
      let scan = scanMismatches(placedKeys);
      if (!scan.newly) return null;
      state.mistakes++;
      if (state.mistakes >= CONFIG.MAX_MISTAKES) showMistakeEnd();
      return { shakeKeys: placedKeys.slice(), toast: translate("mismatch")(equationText(scan.firstFail)) };
    }
    function boardFilled() {
      return state.blankKeys.every(function (k) { return state.cellMap[k].filled; });
    }
    function cellSolutionValue(pos) {
      let cell = state.cellMap[cellKey(pos.r, pos.c)];
      return cell.blank ? cell.value : cell.answer;
    }
    function allEquationsHold() {
      return state.eqs.every(function (eq) {
        return Ops.holds(eq.op, cellSolutionValue(eq.pa), cellSolutionValue(eq.pb), cellSolutionValue(eq.pres));
      });
    }
    /* returns win effects when this move completed the puzzle */
    function checkWin() {
      if (!boardFilled() || !allEquationsHold()) return null;
      state.over = true;
      endKind = "win";
      stopTimer();
      /* a finished daily date is recorded at once, so its
         calendar cell turns disabled (gray) from now on */
      if (state.dailyKey && onDailyWin) onDailyWin(state.dailyKey);
      audio.playWin(); /* cheerful music for a full solve */
      return { confetti: true };
    }

    /* ================= undo (one step per tap) =================
       Every player move that changes the board — placing a tile
       (tap or drag, including replacing a filled cell), taking a
       number back, moving / swapping a filled number, and using a
       hint — first pushes a serialisable snapshot onto the history.
       Undo pops exactly one snapshot per tap. Sorting the tiles is
       not a move and is not undone.
       The mistake count is NOT part of a snapshot: mistakes are
       cumulative for the whole round, so going back a step (undo,
       or taking a number back) never lowers the count — a mistake
       stays counted until the round ends. At MAX_MISTAKES the
       round is lost and cannot be undone back into play; it
       restarts with the same arrangement (restartSame) or a new
       puzzle starts. */
    function makeSnapshot() {
      let cells = {};
      state.blankKeys.forEach(function (k) {
        let cell = state.cellMap[k];
        let tile = cell.filled ? tileForCell(cell) : null;
        cells[k] = { value: cell.filled ? cell.value : null, tileId: tile ? tile.id : null };
      });
      return {
        cells: cells,
        selected: state.selected,
        /* no mistakes here on purpose: undo never rewinds the
           round's mistake count (see the undo note above) */
        hints: state.hints,
        badKeys: Object.assign({}, state.badKeys || {}),
        alertedSigs: Object.assign({}, state.alertedSigs || {}),
        over: state.over
      };
    }
    function tileForCell(cell) {
      if (cell.tileIdx != null && state.tiles[cell.tileIdx] && state.tiles[cell.tileIdx].value === cell.value) {
        return state.tiles[cell.tileIdx];
      }
      for (let i = 0; i < state.tiles.length; i++) {
        if (state.tiles[i].used && state.tiles[i].value === cell.value) return state.tiles[i];
      }
      return null;
    }
    function pushHistory() {
      state.history.push(makeSnapshot());
      if (state.history.length > CONFIG.HISTORY_LIMIT) state.history.shift();
    }
    function restoreSnapshot(snapshot) {
      let tileIndexById = {};
      state.tiles.forEach(function (tile, index) {
        tile.used = false;
        tileIndexById[tile.id] = index;
      });
      state.blankKeys.forEach(function (k) {
        let saved = snapshot.cells[k];
        let cell = state.cellMap[k];
        if (!saved || !cell) return;
        cell.filled = saved.value != null;
        cell.value = saved.value;
        cell.tileIdx = null;
        if (cell.filled && saved.tileId != null && tileIndexById[saved.tileId] != null) {
          cell.tileIdx = tileIndexById[saved.tileId];
          state.tiles[cell.tileIdx].used = true;
        }
      });
      state.selected = snapshot.selected;
      /* state.mistakes is deliberately left untouched: the count
         accumulated so far this round is kept, even when the move
         being undone is the one that caused a mistake */
      state.hints = snapshot.hints;
      state.badKeys = Object.assign({}, snapshot.badKeys || {});
      state.alertedSigs = Object.assign({}, snapshot.alertedSigs || {});
    }
    function undoLast() {
      if (!state || state.paused || confirmOpen || !state.history.length) return;
      /* a round lost on mistakes stays lost: with the count kept
         at MAX_MISTAKES there is no stepping back into play — the
         round restarts with the same arrangement instead */
      if (endKind === "lose") return;
      let snapshot = state.history.pop();
      let wasOver = state.over;
      restoreSnapshot(snapshot);
      state.over = !!snapshot.over;
      if (!state.over) endKind = null;
      if (wasOver && !state.over) startTimer();
      notify({});
    }

    /* ================= play actions ================= */
    function isInputBlocked() {
      return !state || state.paused || state.over || confirmOpen;
    }
    function advanceSelection() {
      let next = null;
      for (let i = 0; i < state.blankKeys.length; i++) {
        if (!state.cellMap[state.blankKeys[i]].filled) { next = state.blankKeys[i]; break; }
      }
      state.selected = next;
    }
    function freeTile(cell) {
      if (cell.tileIdx != null && state.tiles[cell.tileIdx]) {
        state.tiles[cell.tileIdx].used = false;
      } else {
        for (let i = 0; i < state.tiles.length; i++) {
          if (state.tiles[i].used && state.tiles[i].value === cell.value) { state.tiles[i].used = false; break; }
        }
      }
      cell.tileIdx = null;
    }
    /* the equations through this cell no longer hold their old
       numbers — let them alert again if they fail again */
    function clearEquationAlertsFor(k) {
      if (!state.alertedSigs) return;
      state.eqs.forEach(function (eq, eqIndex) {
        if (cellKey(eq.pa.r, eq.pa.c) === k || cellKey(eq.pb.r, eq.pb.c) === k || cellKey(eq.pres.r, eq.pres.c) === k) {
          delete state.alertedSigs[eqIndex];
        }
      });
    }
    function takeBack(k) {
      let cell = state.cellMap[k];
      if (!cell || !cell.filled) return;
      pushHistory();
      freeTile(cell);
      cell.filled = false;
      cell.value = null;
      if (state.badKeys) delete state.badKeys[k];
      clearEquationAlertsFor(k);
      state.selected = k;
      clearStaleBadKeys();
      notify({});
    }
    /* numbers stay put when wrong — tapping a filled cell takes its
       number back so the player can fix it; tapping an empty one selects it */
    function tapCell(k) {
      if (isInputBlocked()) return;
      let cell = state.cellMap[k];
      if (!cell || cell.type !== "num" || !cell.blank) return;
      if (cell.filled) { takeBack(k); return; }
      state.selected = k;
      notify({});
    }
    /* placing onto a filled cell replaces it: the old tile returns
       to the bank and the new number takes its place */
    function placeTileOnCell(cell, tileIndex, tile) {
      if (cell.filled) { freeTile(cell); cell.filled = false; cell.value = null; }
      cell.filled = true;
      cell.value = tile.value;
      cell.tileIdx = tileIndex;
      tile.used = true;
    }
    /* no instant verdict: only if this placement completes an
       equation whose numbers do not match each other does the game
       alert and count a mistake (the number stays in its cell) */
    function finishTilePlacement(placedKey) {
      let alert = judgeMismatch([placedKey]);
      if (alert) { notify(alert); return; }
      clearStaleBadKeys();
      advanceSelection();
      let win = checkWin();
      let effects = win || {};
      if (!state.over && boardFilled()) effects.toast = translate("boardFullToast");
      notify(effects);
    }
    function placeTile(tileIndex) {
      if (isInputBlocked()) return;
      let tile = state.tiles[tileIndex];
      if (!tile || tile.used) return;
      if (!state.selected) { advanceSelection(); if (!state.selected) return; }
      let placedKey = state.selected;
      let cell = state.cellMap[placedKey];
      if (cell.filled && cell.tileIdx === tileIndex) return;
      pushHistory();
      if (state.badKeys) delete state.badKeys[placedKey];
      placeTileOnCell(cell, tileIndex, tile);
      audio.playChip(); /* the number just landed in its cell: casino chip sound */
      finishTilePlacement(placedKey);
    }
    function placeTileAt(tileIndex, targetKey) {
      if (isInputBlocked()) return;
      state.selected = targetKey;
      placeTile(tileIndex);
    }
    function swapCellValues(from, to) {
      let swapValue = to.value, swapTileIdx = to.tileIdx;
      to.value = from.value; to.tileIdx = from.tileIdx;
      from.value = swapValue; from.tileIdx = swapTileIdx;
    }
    function moveCellValue(from, to) {
      to.filled = true;
      to.value = from.value;
      to.tileIdx = from.tileIdx;
      from.filled = false;
      from.value = null;
      from.tileIdx = null;
    }
    function finishMoveOrSwap(fromKey, toKey) {
      let alert = judgeMismatch([fromKey, toKey]);
      if (alert) { notify(alert); return; }
      advanceSelection();
      let win = checkWin();
      let effects = win || {};
      if (!state.over && boardFilled() && Object.keys(computeWrongKeys()).length) {
        effects.toast = translate("boardFullToast");
      }
      notify(effects);
    }
    /* Move the number out of a filled cell into another blank cell
       (or swap the two numbers when the target is filled too) — the
       drag-out counterpart of dropping a tile in. Judged the same
       way: only a newly completed, mismatching equation alerts. */
    function moveOrSwap(fromKey, toKey) {
      if (isInputBlocked()) return;
      let from = state.cellMap[fromKey];
      let to = state.cellMap[toKey];
      if (!from || !from.filled || !to || to.type !== "num" || !to.blank) return;
      if (fromKey === toKey) return;
      pushHistory();
      if (to.filled) swapCellValues(from, to); else moveCellValue(from, to);
      state.selected = toKey;
      audio.playChip(); /* the number landed in its new cell */
      finishMoveOrSwap(fromKey, toKey);
    }
    function dropCellOnBank(fromKey) {
      if (isInputBlocked()) return;
      takeBack(fromKey);
    }

    /* ================= hint ================= */
    function hintTargetKey() {
      let target = (state.selected && !state.cellMap[state.selected].filled) ? state.selected : null;
      if (!target) { advanceSelection(); target = state.selected; }
      return target;
    }
    function applyHint(target, hintValue) {
      let cell = state.cellMap[target];
      let hintTileIndex = null;
      for (let i = 0; i < state.tiles.length; i++) {
        if (!state.tiles[i].used && state.tiles[i].value === hintValue) {
          state.tiles[i].used = true;
          hintTileIndex = i;
          break;
        }
      }
      cell.filled = true;
      cell.value = hintValue;
      cell.tileIdx = hintTileIndex;
    }
    function useHint() {
      if (isInputBlocked()) return;
      let target = hintTargetKey();
      if (!target) return;
      let solution = Solver.findSolution(solverContext());
      if (!solution) {
        let hasWrong = Object.keys(computeWrongKeys()).length > 0;
        notify({ toast: hasWrong ? translate("hintWrong") : translate("hintStuck") });
        return;
      }
      pushHistory();
      applyHint(target, solution[target]);
      state.hints++;
      advanceSelection();
      notify(checkWin() || {});
    }

    /* ================= chrome actions ================= */
    function toggleSort() {
      if (!state || state.over || confirmOpen) return;
      if (!sorted) state.tiles.sort(function (a, b) { return a.value - b.value; });
      else state.tiles.sort(function (a, b) { return a.orig - b.orig; });
      sorted = !sorted;
      notify({});
    }
    function togglePause() {
      if (!state || state.over || confirmOpen) return;
      state.paused = !state.paused;
      notify({});
    }
    function resume() {
      if (!state) return;
      state.paused = false;
      notify({});
    }
    function setConfirmOpen(open) {
      confirmOpen = !!open;
      notify({});
    }
    function confirmReset() {
      confirmOpen = false;
      restartSame();
    }

    return Object.freeze({
      /* lifecycle */
      newGame: newGame,
      restartSame: restartSame,
      setListener: function (fn) { listener = fn; },
      /* play actions */
      tapCell: tapCell,
      placeTile: placeTile,
      placeTileAt: placeTileAt,
      takeBack: dropCellOnBank,
      moveOrSwap: moveOrSwap,
      useHint: useHint,
      undo: undoLast,
      /* chrome actions */
      toggleSort: toggleSort,
      togglePause: togglePause,
      resume: resume,
      openConfirm: function () { if (state) setConfirmOpen(true); },
      closeConfirm: function () { setConfirmOpen(false); },
      confirmReset: confirmReset,
      /* read-only accessors for the view */
      hasState: function () { return !!state; },
      state: function () { return state; },
      isPaused: function () { return !!(state && state.paused); },
      isOver: function () { return !!(state && state.over); },
      isConfirmOpen: function () { return confirmOpen; },
      isInputBlocked: isInputBlocked,
      isSorted: function () { return sorted; },
      endKind: function () { return endKind; },
      /* a Daily round that has been won — the day is completed.
         The view keys two things off this one verdict: the end
         overlay offers Continue (back to the calendar) instead of
         New puzzle, and the top-left back arrow is hidden, since
         Continue is the way onward from a finished day. A lost
         Daily round is not completed, and neither is a practice
         win (no daily key). */
      isDailyWin: function () { return endKind === "win" && !!state && !!state.dailyKey; },
      roundId: function () { return roundId; },
      difficulty: function () { return state ? state.diff : null; },
      dailyKey: function () { return state ? state.dailyKey : null; },
      seconds: function () { return state ? state.seconds : 0; },
      formatTime: formatTime,
      canUndo: function () { return !!(state && state.history.length && !state.paused && endKind !== "lose"); },
      wrongKeys: computeWrongKeys,
      filledCount: function () {
        if (!state) return 0;
        return state.blankKeys.filter(function (k) { return state.cellMap[k].filled; }).length;
      }
    });
  }

  MC.createGame = createGame;
})(window);
