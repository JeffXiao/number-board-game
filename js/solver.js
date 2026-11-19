/* 数学十字谜 — solver module (used by the hint button and by the
   stale-flag cleanup). Placement correctness itself is judged per
   equation in the state owner; this search only exists so a hint
   can follow a completion that is consistent with what the player
   has placed. It is a pure function of the board it is handed. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;
  const Ops = MC.Ops;
  const cellKey = MC.util.cellKey;

  /* One full assignment of values to every number cell that satisfies
     all equations and uses exactly the unused tiles, or null when the
     current board can no longer be completed. Cells listed in
     ignoreKeys are treated as still empty (their tiles count as
     available again) — used to judge a new placement on its own while
     an earlier wrong number is still sitting on the board.
     The returned object's `exhausted` flag is set when the search hit
     its node cap without an answer: the board is then "unknown",
     not proven wrong. */
  function buildAssignment(context, ignoreKeys) {
    let assign = {};
    let ignoredValues = [];
    Object.keys(context.cellMap).forEach(function (k) {
      let cell = context.cellMap[k];
      if (cell.type !== "num") return;
      if (ignoreKeys && ignoreKeys[k] && cell.blank && cell.filled) { assign[k] = null; ignoredValues.push(cell.value); }
      else assign[k] = cell.blank ? (cell.filled ? cell.value : null) : cell.answer;
    });
    return { assign: assign, ignoredValues: ignoredValues };
  }
  function solutionEquations(context) {
    return context.eqs.map(function (eq) {
      return { op: eq.op, ka: cellKey(eq.pa.r, eq.pa.c), kb: cellKey(eq.pb.r, eq.pb.c), kr: cellKey(eq.pres.r, eq.pres.c) };
    });
  }
  /* One propagation step for a single equation inside the solver:
     three known numbers must agree; two known force the third. */
  function propagateEquation(eq, assign, tilesLeft) {
    let va = assign[eq.ka], vb = assign[eq.kb], vr = assign[eq.kr];
    let known = (va != null ? 1 : 0) + (vb != null ? 1 : 0) + (vr != null ? 1 : 0);
    if (known === 3) return { ok: Ops.holds(eq.op, va, vb, vr), changed: false };
    if (known !== 2) return { ok: true, changed: false };
    let needed = Ops.neededValue(eq.op, va, vb, vr);
    if (needed == null) return { ok: false, changed: false };
    let tileIndex = tilesLeft.indexOf(needed);
    if (tileIndex < 0) return { ok: false, changed: false };
    assign[va == null ? eq.ka : (vb == null ? eq.kb : eq.kr)] = needed;
    tilesLeft.splice(tileIndex, 1);
    return { ok: true, changed: true };
  }
  function propagatePass(equations, assign, tilesLeft) {
    let changed = false;
    for (let i = 0; i < equations.length; i++) {
      let step = propagateEquation(equations[i], assign, tilesLeft);
      if (!step.ok) return { ok: false, changed: changed };
      if (step.changed) changed = true;
    }
    return { ok: true, changed: changed };
  }
  function propagateAll(equations, assign, tilesLeft) {
    let changed = true;
    while (changed) {
      let pass = propagatePass(equations, assign, tilesLeft);
      if (!pass.ok) return false;
      changed = pass.changed;
    }
    return true;
  }
  function copyAssignment(assign) {
    let out = {};
    for (let k in assign) out[k] = assign[k];
    return out;
  }
  function openKeysOf(assign) {
    let open = [];
    Object.keys(assign).forEach(function (k) { if (assign[k] == null) open.push(k); });
    return open;
  }
  /* the open cell shared by the most equations (best branch point) */
  function mostSharedKey(equations, open) {
    let best = null, bestScore = -1;
    open.forEach(function (k) {
      let score = 0;
      equations.forEach(function (eq) { if (eq.ka === k || eq.kb === k || eq.kr === k) score++; });
      if (score > bestScore) { bestScore = score; best = k; }
    });
    return best;
  }
  function tryBranchValue(search, assign, tilesLeft, bestKey, index, value) {
    let nextAssign = copyAssignment(assign);
    nextAssign[bestKey] = value;
    let nextTiles = tilesLeft.slice();
    nextTiles.splice(index, 1);
    return solveRecursive(search, nextAssign, nextTiles);
  }
  function branchOnCell(search, assign, tilesLeft, bestKey) {
    let tried = {};
    for (let j = 0; j < tilesLeft.length; j++) {
      let value = tilesLeft[j];
      if (tried[value]) continue;
      tried[value] = true;
      let solved = tryBranchValue(search, assign, tilesLeft, bestKey, j, value);
      if (solved) return solved;
    }
    return null;
  }
  function solveRecursive(search, assignIn, tilesIn) {
    if (++search.nodes > CONFIG.SOLVER_NODE_LIMIT) { search.aborted = true; return null; }
    let assign = copyAssignment(assignIn);
    let tilesLeft = tilesIn.slice();
    if (!propagateAll(search.eqs, assign, tilesLeft)) return null;
    let open = openKeysOf(assign);
    if (!open.length) return assign;
    return branchOnCell(search, assign, tilesLeft, mostSharedKey(search.eqs, open));
  }

  function findSolution(context, ignoreKeys) {
    let built = buildAssignment(context, ignoreKeys);
    let tilesLeft = built.ignoredValues.slice();
    context.tiles.forEach(function (tile) { if (!tile.used) tilesLeft.push(tile.value); });
    let search = { eqs: solutionEquations(context), nodes: 0, aborted: false };
    let result = solveRecursive(search, built.assign, tilesLeft);
    findSolution.exhausted = !result && search.aborted;
    return result;
  }
  findSolution.exhausted = false;

  MC.Solver = Object.freeze({ findSolution: findSolution });
})(window);
