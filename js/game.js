/* 数学十字谜 — 游戏逻辑
   从 index.html 拆出的独立脚本，方便单独维护。
   结构：
     1. 谜题生成（难度、模板、算式填充）
     2. 游戏状态与计时
     3. 棋盘与数字牌渲染
     4. 判定（算式凑齐才判错、交换律容许）
     5. 拖放、撤销、提示
     6. 音效（Web Audio 合成，由声音按钮开关）
     7. 控件绑定与启动
   函数长度约定：每个函数不超过 15 行；逻辑较长的函数拆成
   小的辅助函数，由原函数调用，保持行为不变。
*/
"use strict";

/* ================= language (English by default) ================= */
var LANGS = {
  en: {
    title: "Math Crossword", htmlLang: "en", code: "EN",
    mistakes: "Mistakes", time: "Time", hints: "Hints",
    easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", difficulty: "Difficulty",
    pausedTitle: "Paused", pausedText: "Take a break — continue when you’re ready.", resume: "Resume",
    retry: "Try again", again: "New puzzle",
    resetTitle: "Reset this round?", resetText: "Resetting clears the numbers you’ve placed, and mistakes and time start over.", yes: "Yes", no: "No",
    bankTitle: "Number tiles", boardLabel: "Math crossword board", bankLabel: "Number tiles",
    resetLabel: "Reset this round — asks for confirmation first",
    soundOffLabel: "Turn off the placement sound", soundOnLabel: "Turn on the placement sound",
    pauseLabel: "Pause", hintLabel: "Hint: fill in one correct number", hintTitle: "Hint",
    sortLabel: "Sort tiles from smallest to largest", sortRestoreLabel: "Restore the tiles’ original order",
    undoLabel: "Undo last move", langLabel: "Language / 语言",
    emptyCell: "Empty cell", boardFullToast: "The board is full, but some red numbers still don’t match — drag a wrong one back or tap its cell to fix it",
    hintWrong: "Fix the red numbers first, then use a hint", hintStuck: "These placements can’t fit together — change a few numbers and try again",
    mistakeTitle: "So close", mistakeText: "That’s 3 mistakes. Try this puzzle again, or start a new one.",
    winTitle: "All correct!",
    progress: function (d, t) { return "Filled " + d + " / " + t; },
    filledCell: function (v) { return "Filled " + v + " — tap to take it back, or drag it back to the tiles"; },
    tileLabel: function (v) { return "Number tile " + v; },
    mismatch: function (txt) { return "Doesn’t add up: " + txt + " isn’t true — drag it back or tap the cell to fix it"; },
    winText: function (tm, m, h) { return "Time " + tm + ", " + m + " mistake" + (m === 1 ? "" : "s") + (h ? ", " + h + " hint" + (h === 1 ? "" : "s") + " used" : "") + ". Play another?"; }
  },
  zh: {
    title: "数学十字谜", htmlLang: "zh-CN", code: "中文",
    mistakes: "错误", time: "用时", hints: "提示",
    easy: "简单", medium: "中等", hard: "困难", expert: "专家", difficulty: "难度",
    pausedTitle: "已暂停", pausedText: "休息一下，准备好了再继续。", resume: "继续游戏",
    retry: "再试一次", again: "换一题",
    resetTitle: "真的要重置吗？", resetText: "重置会清空这一局已经填好的数字，错误次数和用时也会重新开始。", yes: "是", no: "否",
    bankTitle: "数字牌", boardLabel: "数学十字谜棋盘", bankLabel: "数字牌",
    resetLabel: "重置本局，会先弹出确认",
    soundOffLabel: "关闭放入数字的声音", soundOnLabel: "打开放入数字的声音",
    pauseLabel: "暂停", hintLabel: "提示：填入一个正确数字", hintTitle: "提示",
    sortLabel: "把数字牌从小到大排序", sortRestoreLabel: "恢复数字牌原来的顺序",
    undoLabel: "返回上一步", langLabel: "语言 / Language",
    emptyCell: "空格", boardFullToast: "棋盘填满了，但还有标红的数字对不上，把错的拖回或点格子改一改",
    hintWrong: "先把标红的数字改对，再用提示", hintStuck: "现在的填法凑不到一起，先改几个数字再试",
    mistakeTitle: "差一点点", mistakeText: "错误满 3 次了。可以再试一次这一题，或者换一题新的。",
    winTitle: "全部填对了！",
    progress: function (d, t) { return "已填 " + d + " / " + t; },
    filledCell: function (v) { return "已填 " + v + "，点按取回，或拖回数字牌"; },
    tileLabel: function (v) { return "数字牌 " + v; },
    mismatch: function (txt) { return "数字对不上：" + txt + " 不成立，拖回或点格子改"; },
    winText: function (tm, m, h) { return "用时 " + tm + "，错误 " + m + " 次" + (h ? "，用了 " + h + " 次提示" : "") + "。再来一题？"; }
  }
};
var lang = "en";
var endKind = null;
function T(k) { return LANGS[lang][k]; }
function setTextId(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
function setBtnLabel(el, txt) { if (!el) return; el.setAttribute("aria-label", txt); el.title = txt; }

/* ================= puzzle generation ================= */

var DIFFS = {
  easy:   { ops: ["+", "-"],          max: 30 },
  medium: { ops: ["+", "-", "*"],    max: 99 },
  hard:   { ops: ["+", "-", "*", "/"], max: 99 },
  expert: { ops: ["+", "-", "*", "/"], max: 150 }
};

/* Each equation: [direction, startRow, startCol]; it spans 5 cells:
   number, operator, number, "=", number. The order in each list is a
   valid generation order (shared cells are filled before use). */
var TEMPLATES = {
  easy: [
    ["H", 0, 0], ["V", 0, 4], ["H", 2, 2], ["V", 2, 2],
    ["V", 2, 6], ["H", 4, 2], ["H", 6, 2]
  ],
  medium: [
    ["H", 0, 2], ["V", 0, 6], ["H", 2, 4], ["V", 2, 4],
    ["H", 4, 0], ["V", 4, 0], ["H", 8, 0], ["H", 6, 4], ["V", 2, 8]
  ],
  hard: [
    ["H", 0, 2], ["V", 0, 6], ["H", 2, 4], ["V", 2, 4],
    ["H", 4, 0], ["V", 4, 0], ["H", 8, 0], ["H", 6, 4], ["V", 2, 8],
    ["V", 4, 2], ["V", 4, 6], ["H", 8, 4], ["V", 0, 0]
  ],
  /* 11x11 board, 20 equations. Order matters: no equation is generated
     with all three of its numbers already known from earlier ones. */
  expert: [
    ["H", 0, 2], ["V", 0, 6], ["H", 2, 4], ["V", 2, 4],
    ["H", 4, 0], ["V", 4, 0], ["H", 8, 0], ["H", 6, 4], ["V", 2, 8],
    ["V", 4, 2], ["V", 4, 6], ["H", 8, 4], ["V", 0, 0],
    ["H", 0, 6], ["H", 4, 6], ["V", 0, 10],
    ["V", 6, 4], ["V", 6, 8], ["H", 10, 4], ["H", 10, 0]
  ]
};

var OP_SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function key(r, c) { return r + "," + c; }
function ri(min, max) {
  if (max < min) return null;
  return min + Math.floor(Math.random() * (max - min + 1));
}
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function divisorsIn(n, lo, hi) {
  var out = [];
  for (var d = lo; d <= hi; d++) if (n % d === 0) out.push(d);
  return out;
}
/* A random factor pair of n with both factors in 2..12, or null. */
function factorPairOf(n) {
  var ds = divisorsIn(n, 2, 12).filter(function (d) { var q = n / d; return q >= 2 && q <= 12; });
  if (!ds.length) return null;
  var d = ds[Math.floor(Math.random() * ds.length)];
  return { a: d, b: n / d };
}

/* Try to complete a op b = res given some known values (null = unknown).
   Returns {a,b,res} with all values >= 1 and <= max, or null. */
function fillPlus(k, max) {
  var a = k.a, b = k.b, res = k.res, v;
  /* all three already set by crossing equations: keep them only if they agree */
  if (a != null && b != null && res != null) return a + b === res ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) res = a + b;
  else if (a != null && res != null) b = res - a;
  else if (b != null && res != null) a = res - b;
  else if (res != null) { v = ri(1, res - 1); if (v == null) return null; a = v; b = res - a; }
  else if (a != null) { v = ri(1, max - a); if (v == null) return null; b = v; res = a + b; }
  else if (b != null) { v = ri(1, max - b); if (v == null) return null; a = v; res = a + b; }
  else { a = ri(2, Math.floor(max * 0.6)); b = ri(2, max - a); if (b == null) return null; res = a + b; }
  if (a >= 1 && b >= 1 && res >= 1 && res <= max && a + b === res) return { a: a, b: b, res: res };
  return null;
}
function fillMinus(k, max) {
  var a = k.a, b = k.b, res = k.res, v;
  if (a != null && b != null && res != null) return a - b === res ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) res = a - b;
  else if (a != null && res != null) b = a - res;
  else if (b != null && res != null) a = b + res;
  else if (a != null) { v = ri(1, a - 1); if (v == null) return null; b = v; res = a - b; }
  else if (b != null) { v = ri(1, max - b); if (v == null) return null; res = v; a = b + res; }
  else if (res != null) { v = ri(1, max - res); if (v == null) return null; b = v; a = b + res; }
  else { b = ri(2, Math.min(20, max - 1)); res = ri(1, max - b); if (res == null) return null; a = b + res; }
  if (a >= 1 && b >= 1 && res >= 1 && a <= max && a - b === res) return { a: a, b: b, res: res };
  return null;
}
function fillTimes(k, max) {
  var a = k.a, b = k.b, res = k.res, v, pair;
  if (a != null && b != null && res != null) return a * b === res ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) res = a * b;
  else if (a != null && res != null) { if (res % a !== 0) return null; b = res / a; }
  else if (b != null && res != null) { if (res % b !== 0) return null; a = res / b; }
  else if (a != null) { v = ri(2, 9); if (v == null) return null; b = v; res = a * b; }
  else if (b != null) { v = ri(2, 9); if (v == null) return null; a = v; res = a * b; }
  else if (res != null) { pair = factorPairOf(res); if (!pair) return null; a = pair.a; b = pair.b; }
  else { a = ri(2, 9); b = ri(2, 9); res = a * b; }
  return (a >= 2 && a <= 12 && b >= 2 && b <= 12 && res <= max && a * b === res) ? { a: a, b: b, res: res } : null;
}
function fillDivide(k, max) {
  var a = k.a, b = k.b, res = k.res, v, pair;
  if (a != null && b != null && res != null) return (b !== 0 && a === b * res) ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) { if (b === 0 || a % b !== 0) return null; res = a / b; }
  else if (a != null && res != null) { if (res === 0 || a % res !== 0) return null; b = a / res; }
  else if (b != null && res != null) a = b * res;
  else if (a != null) { pair = factorPairOf(a); if (!pair) return null; b = pair.a; res = pair.b; }
  else if (b != null) { v = ri(2, 12); res = v; a = b * res; }
  else if (res != null) { v = ri(2, 12); b = v; a = b * res; }
  else { b = ri(2, 12); res = ri(2, 12); a = b * res; }
  return (b >= 2 && b <= 12 && res >= 2 && res <= 12 && a <= max && a === b * res) ? { a: a, b: b, res: res } : null;
}
var FILLERS = { "+": fillPlus, "-": fillMinus, "*": fillTimes, "/": fillDivide };

function solveEq(known, cfg) {
  var ops = shuffle(cfg.ops);
  for (var i = 0; i < ops.length; i++) {
    for (var t = 0; t < 30; t++) {
      var got = FILLERS[ops[i]](known, cfg.max);
      if (got) { got.op = ops[i]; return got; }
    }
  }
  return null;
}

function eqCells(dir, r, c) {
  var cells = [];
  for (var i = 0; i < 5; i++) {
    cells.push(dir === "H" ? { r: r, c: c + i } : { r: r + i, c: c });
  }
  return cells; // [num, op, num, eq, num]
}

/* unique number cells -> list of equation indices they belong to */
function buildMembership(eqs) {
  var membership = {};
  eqs.forEach(function (eq, idx) {
    [eq.pa, eq.pb, eq.pres].forEach(function (p) {
      var k = key(p.r, p.c);
      (membership[k] = membership[k] || []).push(idx);
    });
  });
  return membership;
}
/* the result cell of each equation — results are never given:
   the player always has to work out and fill in the answer */
function resultKeysOf(eqs) {
  var out = {};
  eqs.forEach(function (eq) { out[key(eq.pres.r, eq.pres.c)] = true; });
  return out;
}
function blanksFromGivens(keys, givens) {
  var blanks = {};
  keys.forEach(function (k) { if (!givens[k]) blanks[k] = true; });
  return blanks;
}
/* One-given rule: an equation shows at most ONE prefilled number,
   that number is always an operand, the result is never prefilled,
   and no equation's answer may be computable from its own
   prefilled numbers alone. An equation whose operands are all
   results of crossing equations, or whose giveable operand was
   already claimed as another equation's one given, gets no
   prefilled number at all: it is solved through its crossings. */
/* one shuffled pass: a cell becomes a given only when every
   equation it belongs to still has no given of its own, so one
   crossing cell can serve two equations with that single number */
function randomGivens(cands, membership) {
  var givens = {}, covered = {};
  shuffle(cands).forEach(function (k) {
    var free = membership[k].every(function (ei) { return !covered[ei]; });
    if (!free) return;
    givens[k] = true;
    membership[k].forEach(function (ei) { covered[ei] = true; });
  });
  return givens;
}
/* Keep the largest valid set of givens found over many shuffled
   passes, so as many equations as possible keep their one given
   while no equation ever gets two. */
function pickBlanks(eqs, cfg) {
  var membership = buildMembership(eqs);
  var keys = Object.keys(membership), resKeys = resultKeysOf(eqs);
  var cands = keys.filter(function (k) { return !resKeys[k]; });
  var best = null;
  for (var attempt = 0; attempt < 200; attempt++) {
    var givens = randomGivens(cands, membership);
    if (!best || Object.keys(givens).length > Object.keys(best).length) best = givens;
  }
  return best ? blanksFromGivens(keys, best) : null;
}

function valueOrNull(values, p) {
  var v = values[key(p.r, p.c)];
  return v != null ? v : null;
}
function storeSolution(values, pa, pb, pres, sol) {
  values[key(pa.r, pa.c)] = sol.a;
  values[key(pb.r, pb.c)] = sol.b;
  values[key(pres.r, pres.c)] = sol.res;
}
/* Fill every equation of the template in order; null when one fails. */
function buildEquations(diff, cfg) {
  var values = {};
  var eqs = [];
  var list = TEMPLATES[diff];
  for (var i = 0; i < list.length; i++) {
    var cells = eqCells(list[i][0], list[i][1], list[i][2]);
    var pa = cells[0], pb = cells[2], pres = cells[4];
    var known = { a: valueOrNull(values, pa), b: valueOrNull(values, pb), res: valueOrNull(values, pres) };
    var sol = solveEq(known, cfg);
    if (!sol) return null;
    storeSolution(values, pa, pb, pres, sol);
    eqs.push({ dir: list[i][0], r: list[i][1], c: list[i][2], cells: cells, pa: pa, pb: pb, pres: pres, op: sol.op });
  }
  return { values: values, eqs: eqs };
}
function generate(diff) {
  var cfg = DIFFS[diff];
  for (var attempt = 0; attempt < 300; attempt++) {
    var built = buildEquations(diff, cfg);
    if (!built) continue;
    var blanks = pickBlanks(built.eqs, cfg);
    if (blanks) return { values: built.values, eqs: built.eqs, blanks: blanks };
  }
  return null;
}

/* ================= game state ================= */

var boardEl = document.getElementById("board");
var bankEl = document.getElementById("bank");
var mistakesEl = document.getElementById("mistakes");
var timerEl = document.getElementById("timer");
var hintsEl = document.getElementById("hints");
var progressEl = document.getElementById("progress");
var pauseOverlay = document.getElementById("pauseOverlay");
var endOverlay = document.getElementById("endOverlay");
var resetConfirmEl = document.getElementById("resetConfirmOverlay");
var endTitle = document.getElementById("endTitle");
var endText = document.getElementById("endText");
var pauseBtn = document.getElementById("pauseBtn");
var sortBtn = document.getElementById("sortBtn");
var undoBtn = document.getElementById("undoBtn");
function updateUndoBtn() {
  if (!undoBtn) return;
  var can = !!(state && state.history && state.history.length && !state.paused);
  undoBtn.disabled = !can;
}
function updatePauseBtn() {
  if (!pauseBtn) return;
  var paused = !!(state && state.paused);
  pauseBtn.classList.toggle("paused", paused);
  pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
  var label = paused ? T("resume") : T("pauseLabel");
  pauseBtn.setAttribute("aria-label", label);
  pauseBtn.title = label;
}
function updateSortBtn() {
  sortBtn.setAttribute("aria-pressed", sorted ? "true" : "false");
  var tip = sorted ? T("sortRestoreLabel") : T("sortLabel");
  sortBtn.setAttribute("aria-label", tip);
  sortBtn.title = tip;
}
var toastEl = document.getElementById("toast");
var sorted = false;
/* true while the reset confirmation is open: the timer waits
   and every other control ignores input until 是 / 否 is chosen */
var confirmOpen = false;
var toastTimer = null;

var state = null;

function addCellToMap(cellMap, cell, i, eq, puzzle) {
  var k = key(cell.r, cell.c);
  if (i === 1) cellMap[k] = { type: "op", symbol: OP_SYMBOL[eq.op] };
  else if (i === 3) cellMap[k] = { type: "eq", symbol: "=" };
  else if (!cellMap[k]) {
    cellMap[k] = { type: "num", answer: puzzle.values[k], blank: !!puzzle.blanks[k], filled: false, value: null, tileIdx: null };
  }
}
function buildCellMap(puzzle) {
  var cellMap = {};
  var rows = 0, cols = 0;
  puzzle.eqs.forEach(function (eq) {
    eq.cells.forEach(function (cell, i) {
      rows = Math.max(rows, cell.r + 1);
      cols = Math.max(cols, cell.c + 1);
      addCellToMap(cellMap, cell, i, eq, puzzle);
    });
  });
  return { cellMap: cellMap, rows: rows, cols: cols };
}
function maxDigitsOf(cellMap) {
  var maxDigits = 1;
  Object.keys(cellMap).forEach(function (k) {
    if (cellMap[k].type === "num") maxDigits = Math.max(maxDigits, String(cellMap[k].answer).length);
  });
  return maxDigits;
}
function blankKeysOf(cellMap) {
  var blankKeys = Object.keys(cellMap).filter(function (k) { return cellMap[k].type === "num" && cellMap[k].blank; });
  blankKeys.sort(function (x, y) {
    var a = x.split(",").map(Number), b = y.split(",").map(Number);
    return a[0] - b[0] || a[1] - b[1];
  });
  return blankKeys;
}
function makeTiles(cellMap, blankKeys) {
  return shuffle(blankKeys.map(function (k) { return cellMap[k].answer; }))
    .map(function (v, i) { return { value: v, used: false, orig: i }; });
}
function freshState(diff, puzzle, built, blankKeys) {
  return {
    diff: diff, eqs: puzzle.eqs, cellMap: built.cellMap, rows: built.rows, cols: built.cols,
    maxDigits: maxDigitsOf(built.cellMap), blankKeys: blankKeys,
    tiles: makeTiles(built.cellMap, blankKeys),
    selected: null,
    badKeys: {}, alertedSigs: {}, history: [], mistakes: 0, hints: 0,
    seconds: 0, paused: false, over: false, timerId: null
  };
}
function newGame(diff) {
  var puzzle = generate(diff);
  if (!puzzle) puzzle = generate(diff); // generation is randomized; a second pass virtually always succeeds
  var built = buildCellMap(puzzle);
  var blankKeys = blankKeysOf(built.cellMap);
  state = freshState(diff, puzzle, built, blankKeys);
  endKind = null;
  sorted = false;
  confirmOpen = false;
  resetConfirmEl.classList.remove("show");
  updateSortBtn();
  startTimer();
  render();
}

function clearBoardCells() {
  state.blankKeys.forEach(function (k) { state.cellMap[k].filled = false; state.cellMap[k].value = null; state.cellMap[k].tileIdx = null; });
  state.tiles.forEach(function (t) { t.used = false; });
  state.tiles.sort(function (a, b) { return a.orig - b.orig; });
}
function resetRoundState() {
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
}
function restartSame() {
  if (!state) return;
  clearBoardCells();
  resetRoundState();
  sorted = false;
  updateSortBtn();
  endOverlay.classList.remove("show");
  pauseOverlay.classList.remove("show");
  confirmOpen = false;
  resetConfirmEl.classList.remove("show");
  updatePauseBtn();
  startTimer();
  render();
}

/* ================= timer ================= */
function fmtTime(s) {
  var m = Math.floor(s / 60), ss = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss;
}
function startTimer() {
  stopTimer();
  state.timerId = setInterval(function () {
    if (!state.paused && !state.over && !confirmOpen) {
      state.seconds++;
      timerEl.textContent = fmtTime(state.seconds);
    }
  }, 1000);
}
function stopTimer() {
  if (state && state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

/* ================= rendering ================= */
function render() {
  updateUndoBtn();
  updatePauseBtn();
  mistakesEl.textContent = state.mistakes + "/3";
  mistakesEl.classList.toggle("bad", state.mistakes > 0);
  hintsEl.textContent = state.hints;
  timerEl.textContent = fmtTime(state.seconds);
  var done = state.blankKeys.filter(function (k) { return state.cellMap[k].filled; }).length;
  progressEl.textContent = T("progress")(done, state.blankKeys.length);
  renderBoard();
  renderBank();
  fitBoardFont();
}

function makeEmptyCellEl() {
  var el = document.createElement("div");
  el.className = "cell empty";
  return el;
}
function makeStaticCellEl(cell) {
  var el = document.createElement("div");
  el.className = "cell " + (cell.type === "num" ? "given" : cell.type);
  el.textContent = cell.type === "num" ? cell.answer : cell.symbol;
  return el;
}
function blankCellClass(cell, wrong, k) {
  return "cell blank" + (cell.filled ? " filled" : "") +
    (cell.filled && wrong[k] ? " wrong" : "") +
    (state.selected === k && !cell.filled ? " selected" : "");
}
/* numbers stay put when wrong — tapping a filled cell takes its
   number back so the player can fix it; tapping an empty one selects it */
function onBlankCellClick(btn) {
  if (suppressCellClick) { suppressCellClick = false; return; }
  if (state.paused || state.over || confirmOpen) return;
  var kk = btn.dataset.key;
  if (state.cellMap[kk].filled) takeBack(kk);
  else { state.selected = kk; renderBoard(); fitBoardFont(); }
}
function makeBlankCellEl(k, cell, wrong) {
  var el = document.createElement("button");
  el.type = "button";
  el.className = blankCellClass(cell, wrong, k);
  el.textContent = cell.filled ? cell.value : "";
  el.setAttribute("aria-label", cell.filled ? T("filledCell")(cell.value) : T("emptyCell"));
  el.dataset.key = k;
  el.addEventListener("click", function () { onBlankCellClick(el); });
  el.addEventListener("pointerdown", function (e) { onCellPointerDown(e, el.dataset.key, el); });
  return el;
}
function makeCellEl(k, wrong) {
  var cell = state.cellMap[k];
  if (!cell) return makeEmptyCellEl();
  if (cell.type === "num" && cell.blank) return makeBlankCellEl(k, cell, wrong);
  return makeStaticCellEl(cell);
}
function renderBoard() {
  var wrong = computeWrongKeys();
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = "repeat(" + state.cols + ", 1fr)";
  boardEl.style.maxWidth = (state.cols * 58) + "px";
  for (var r = 0; r < state.rows; r++) {
    for (var c = 0; c < state.cols; c++) boardEl.appendChild(makeCellEl(key(r, c), wrong));
  }
}

function onTileClick(idx, b) {
  if (suppressClick) { suppressClick = false; return; }
  onTileTap(idx, b);
}
function makeTileEl(tile, idx) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "tile num" + (tile.used ? " used" : "");
  b.textContent = tile.value;
  b.dataset.idx = idx;
  b.setAttribute("aria-label", T("tileLabel")(tile.value));
  b.addEventListener("click", function () { onTileClick(idx, b); });
  b.addEventListener("pointerdown", function (e) { onTilePointerDown(e, idx, b); });
  return b;
}
function renderBank() {
  bankEl.innerHTML = "";
  state.tiles.forEach(function (tile, idx) { bankEl.appendChild(makeTileEl(tile, idx)); });
}

function fitBoardFont() {
  var w = boardEl.clientWidth;
  if (!w || !state) return;
  var cellW = w / state.cols;
  /* three-digit answers (expert) get a smaller factor so they fit the cell */
  var wide = state.maxDigits >= 3;
  var factor = wide ? 0.44 : 0.56;
  var minPx = wide ? 13 : 15;
  boardEl.style.fontSize = Math.max(minPx, Math.min(34, cellW * factor)) + "px";
}
window.addEventListener("resize", fitBoardFont);

function cellEl(k) {
  return boardEl.querySelector('[data-key="' + k + '"]');
}
function flashWrong(el) {
  if (!el) return;
  el.classList.add("wrong-flash", "shake");
  setTimeout(function () { el.classList.remove("wrong-flash", "shake"); }, 380);
}

/* ================= error toast ================= */
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1700);
}

/* ================= solution search (used by the hint button) =================
   Placement correctness is judged per equation (see the play
   section below); this search only exists so a hint can follow a
   completion that is consistent with what the player has placed. */

function eqHolds(a, op, b, res) {
  if (op === "+") return a + b === res;
  if (op === "-") return a - b === res;
  if (op === "*") return a * b === res;
  if (op === "/") return b !== 0 && a === b * res;
  return false;
}

/* With exactly one of a/b/res unknown, the value it must take
   (a positive integer), or null when no such value exists. */
function neededValue(op, a, b, res) {
  var v = null;
  if (op === "+") v = a == null ? res - b : (b == null ? res - a : a + b);
  else if (op === "-") v = a == null ? b + res : (b == null ? a - res : a - b);
  else if (op === "*") {
    if (a == null) { if (!b || res % b !== 0) return null; v = res / b; }
    else if (b == null) { if (!a || res % a !== 0) return null; v = res / a; }
    else v = a * b;
  } else if (op === "/") {
    if (a == null) v = b * res;
    else if (b == null) { if (!res || a % res !== 0) return null; v = a / res; }
    else { if (!b || a % b !== 0) return null; v = a / b; }
  }
  return (v != null && v >= 1) ? v : null;
}

/* One full assignment of values to every number cell that satisfies
   all equations and uses exactly the unused tiles, or null when the
   current board can no longer be completed. Cells listed in
   ignoreKeys are treated as still empty (their tiles count as
   available again) — used to judge a new placement on its own while
   an earlier wrong number is still sitting on the board.
   findSolution.exhausted is set when the search hit its node cap
   without an answer: the board is then "unknown", not proven wrong. */
function buildAssign(ignoreKeys) {
  var assign = {};
  var ignoredValues = [];
  Object.keys(state.cellMap).forEach(function (k) {
    var cell = state.cellMap[k];
    if (cell.type !== "num") return;
    if (ignoreKeys && ignoreKeys[k] && cell.blank && cell.filled) { assign[k] = null; ignoredValues.push(cell.value); }
    else assign[k] = cell.blank ? (cell.filled ? cell.value : null) : cell.answer;
  });
  return { assign: assign, ignoredValues: ignoredValues };
}
function solutionEqs() {
  return state.eqs.map(function (eq) {
    return { op: eq.op, ka: key(eq.pa.r, eq.pa.c), kb: key(eq.pb.r, eq.pb.c), kr: key(eq.pres.r, eq.pres.c) };
  });
}
/* One propagation step for a single equation inside the solver:
   three known numbers must agree; two known force the third. */
function propagateEq(e, a2, t2) {
  var va = a2[e.ka], vb = a2[e.kb], vr = a2[e.kr];
  var known = (va != null ? 1 : 0) + (vb != null ? 1 : 0) + (vr != null ? 1 : 0);
  if (known === 3) return { ok: eqHolds(va, e.op, vb, vr), changed: false };
  if (known !== 2) return { ok: true, changed: false };
  var need = neededValue(e.op, va, vb, vr);
  if (need == null) return { ok: false, changed: false };
  var ti = t2.indexOf(need);
  if (ti < 0) return { ok: false, changed: false };
  a2[va == null ? e.ka : (vb == null ? e.kb : e.kr)] = need;
  t2.splice(ti, 1);
  return { ok: true, changed: true };
}
function propagatePass(eqs, a2, t2) {
  var changed = false;
  for (var i = 0; i < eqs.length; i++) {
    var step = propagateEq(eqs[i], a2, t2);
    if (!step.ok) return { ok: false, changed: changed };
    if (step.changed) changed = true;
  }
  return { ok: true, changed: changed };
}
function propagateAll(eqs, a2, t2) {
  var changed = true;
  while (changed) {
    var pass = propagatePass(eqs, a2, t2);
    if (!pass.ok) return false;
    changed = pass.changed;
  }
  return true;
}
function copyAssign(a) {
  var out = {};
  for (var k in a) out[k] = a[k];
  return out;
}
function openKeysOf(a2) {
  var open = [];
  Object.keys(a2).forEach(function (kk) { if (a2[kk] == null) open.push(kk); });
  return open;
}
/* the open cell shared by the most equations (best branch point) */
function mostSharedKey(eqs, open) {
  var best = null, bestScore = -1;
  open.forEach(function (kk) {
    var score = 0;
    eqs.forEach(function (e) { if (e.ka === kk || e.kb === kk || e.kr === kk) score++; });
    if (score > bestScore) { bestScore = score; best = kk; }
  });
  return best;
}
function tryBranchValue(S, a2, t2, best, j, v) {
  var a3 = copyAssign(a2);
  a3[best] = v;
  var t3 = t2.slice();
  t3.splice(j, 1);
  return solveRec(S, a3, t3);
}
function branchOnCell(S, a2, t2, best) {
  var tried = {};
  for (var j = 0; j < t2.length; j++) {
    var v = t2[j];
    if (tried[v]) continue;
    tried[v] = true;
    var got = tryBranchValue(S, a2, t2, best, j, v);
    if (got) return got;
  }
  return null;
}
function solveRec(S, assignIn, tilesIn) {
  if (++S.nodes > 60000) { S.aborted = true; return null; }
  var a2 = copyAssign(assignIn);
  var t2 = tilesIn.slice();
  if (!propagateAll(S.eqs, a2, t2)) return null;
  var open = openKeysOf(a2);
  if (!open.length) return a2;
  return branchOnCell(S, a2, t2, mostSharedKey(S.eqs, open));
}
function findSolution(ignoreKeys) {
  var built = buildAssign(ignoreKeys);
  var tilesLeft = built.ignoredValues.slice();
  state.tiles.forEach(function (t) { if (!t.used) tilesLeft.push(t.value); });
  var S = { eqs: solutionEqs(), nodes: 0, aborted: false };
  var result = solveRec(S, built.assign, tilesLeft);
  findSolution.exhausted = !result && S.aborted;
  return result;
}

/* ================= play =================
   A placement is NOT judged the moment it lands. No alert, no red
   mark and no mistake is counted while the equations through the
   cell are still incomplete — a lone number cannot be "wrong" yet.
   The alert fires only when an equation is fully filled and its
   numbers do not match each other (judgeMismatch): then the
   equation's filled cells show red, one mistake is counted, and a
   toast names the failing equation. The same completed equation
   with the same numbers alerts only once (state.alertedSigs);
   fixing it and breaking it again alerts again. eqHolds is
   symmetric wherever the operation is — + and × in the two
   operands, ÷ in the divisor and quotient (18÷9=2 and 18÷2=9
   both hold, since both say 18 = divisor × quotient) — so swapped
   operands are never flagged. A wrong number is NOT taken back
   automatically: it stays in its cell and the player fixes it —
   tap the cell to take the number back, drag the number out of
   its cell back to the tile bank (or onto another blank cell to
   move / swap it), or drop / tap another tile onto it to
   replace it. */

function cellVal(k) {
  var cell = state.cellMap[k];
  if (!cell || cell.type !== "num") return null;
  return cell.blank ? (cell.filled ? cell.value : null) : cell.answer;
}
function eqComplete(eq) {
  return cellVal(key(eq.pa.r, eq.pa.c)) != null &&
         cellVal(key(eq.pb.r, eq.pb.c)) != null &&
         cellVal(key(eq.pres.r, eq.pres.c)) != null;
}
function eqFails(eq) {
  if (!eqComplete(eq)) return false;
  return !eqHolds(cellVal(key(eq.pa.r, eq.pa.c)), eq.op,
                  cellVal(key(eq.pb.r, eq.pb.c)),
                  cellVal(key(eq.pres.r, eq.pres.c)));
}
function eqText(eq) {
  return cellVal(key(eq.pa.r, eq.pa.c)) + " " + OP_SYMBOL[eq.op] + " " +
         cellVal(key(eq.pb.r, eq.pb.c)) + " = " + cellVal(key(eq.pres.r, eq.pres.c));
}
function markFilledWrong(k, wrong) {
  var cell = state.cellMap[k];
  if (cell && cell.blank && cell.filled) wrong[k] = true;
}
/* keys of player-filled cells to render red: cells flagged wrong
   the moment they were placed (badKeys), plus filled cells that
   belong to a completed equation which does not hold */
function computeWrongKeys() {
  var wrong = {};
  if (!state) return wrong;
  Object.keys(state.badKeys || {}).forEach(function (k) { markFilledWrong(k, wrong); });
  state.eqs.forEach(function (eq) {
    if (!eqFails(eq)) return;
    [eq.pa, eq.pb, eq.pres].forEach(function (p) { markFilledWrong(key(p.r, p.c), wrong); });
  });
  return wrong;
}
/* Once the board (with every filled number counted) can be
   completed again, no filled number is wrong anymore — drop any
   stale flags, e.g. after the player took back a different number
   that was blocking the flagged one. */
function clearStaleBadKeys() {
  if (!state || !Object.keys(state.badKeys || {}).length) return;
  if (findSolution()) state.badKeys = {};
}
function freeTile(cell) {
  if (cell.tileIdx != null && state.tiles[cell.tileIdx]) {
    state.tiles[cell.tileIdx].used = false;
  } else {
    for (var i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i].used && state.tiles[i].value === cell.value) { state.tiles[i].used = false; break; }
    }
  }
  cell.tileIdx = null;
}
/* ================= undo (one step per tap) =================
   Every player move that changes the board — placing a tile
   (tap or drag, including replacing a filled cell), taking a
   number back, moving / swapping a filled number, and using a
   hint — first pushes a snapshot of the board onto
   state.history. The undo button (right of the sort button)
   pops exactly one snapshot per tap, so repeated taps walk
   back step by step. Sorting the tiles is not a move and is
   not undone. */
function tileForCell(cell) {
  if (cell.tileIdx != null && state.tiles[cell.tileIdx] && state.tiles[cell.tileIdx].value === cell.value) return state.tiles[cell.tileIdx];
  for (var i = 0; i < state.tiles.length; i++) {
    if (state.tiles[i].used && state.tiles[i].value === cell.value) return state.tiles[i];
  }
  return null;
}
function snapshotCells() {
  var cells = {};
  state.blankKeys.forEach(function (k) {
    var cell = state.cellMap[k];
    cells[k] = { filled: cell.filled, value: cell.value, tile: cell.filled ? tileForCell(cell) : null };
  });
  return cells;
}
function pushHistory() {
  if (!state) return;
  if (!state.history) state.history = [];
  state.history.push({
    cells: snapshotCells(),
    tileStates: state.tiles.map(function (t) { return { tile: t, used: t.used }; }),
    selected: state.selected, mistakes: state.mistakes, hints: state.hints,
    badKeys: Object.assign({}, state.badKeys || {}),
    alertedSigs: Object.assign({}, state.alertedSigs || {}),
    over: state.over
  });
  if (state.history.length > 100) state.history.shift();
  updateUndoBtn();
}
function claimTileIndex(s, claimed) {
  if (s.tile) {
    var ti = state.tiles.indexOf(s.tile);
    if (ti >= 0 && !claimed[ti]) return ti;
  }
  for (var i = 0; i < state.tiles.length; i++) {
    if (state.tiles[i].used && state.tiles[i].value === s.value && !claimed[i]) return i;
  }
  return -1;
}
function restoreCellFromSnap(k, s, claimed) {
  var cell = state.cellMap[k];
  if (!s || !cell) return;
  cell.filled = !!s.filled;
  cell.value = s.filled ? s.value : null;
  cell.tileIdx = null;
  if (!s.filled) return;
  var idx = claimTileIndex(s, claimed);
  if (idx >= 0) { cell.tileIdx = idx; claimed[idx] = true; }
}
function restoreSnapMeta(snap) {
  state.selected = snap.selected;
  state.mistakes = snap.mistakes;
  state.hints = snap.hints;
  state.badKeys = Object.assign({}, snap.badKeys || {});
  state.alertedSigs = Object.assign({}, snap.alertedSigs || {});
}
function undoLast() {
  if (!state || state.paused || confirmOpen || !state.history || !state.history.length) return;
  var snap = state.history.pop();
  snap.tileStates.forEach(function (ts) { ts.tile.used = ts.used; });
  var claimed = {};
  state.blankKeys.forEach(function (k) { restoreCellFromSnap(k, snap.cells[k], claimed); });
  restoreSnapMeta(snap);
  var wasOver = state.over;
  state.over = !!snap.over;
  if (wasOver && !state.over) { endOverlay.classList.remove("show"); startTimer(); }
  render();
}

/* the equations through this cell no longer hold their old
   numbers — let them alert again if they fail again */
function clearEqAlertsFor(k) {
  if (!state.alertedSigs) return;
  state.eqs.forEach(function (eq, ei) {
    if (key(eq.pa.r, eq.pa.c) === k || key(eq.pb.r, eq.pb.c) === k || key(eq.pres.r, eq.pres.c) === k) delete state.alertedSigs[ei];
  });
}
function takeBack(k) {
  var cell = state.cellMap[k];
  if (!cell || !cell.filled) return;
  pushHistory();
  freeTile(cell);
  cell.filled = false;
  cell.value = null;
  if (state.badKeys) delete state.badKeys[k];
  clearEqAlertsFor(k);
  state.selected = k;
  clearStaleBadKeys();
  render();
}

function eqInvolvesAny(eq, keys) {
  return keys.some(function (pk) {
    return key(eq.pa.r, eq.pa.c) === pk || key(eq.pb.r, eq.pb.c) === pk || key(eq.pres.r, eq.pres.c) === pk;
  });
}
/* Scan the equations through the placed cells: note each newly
   completed equation whose numbers do not match each other. */
function scanMismatches(placedKeys) {
  var firstFail = null, newly = false;
  state.eqs.forEach(function (eq, ei) {
    if (!eqInvolvesAny(eq, placedKeys)) return;
    if (eqFails(eq)) {
      var sig = eqText(eq);
      if (state.alertedSigs[ei] !== sig) { state.alertedSigs[ei] = sig; newly = true; if (!firstFail) firstFail = eq; }
    } else delete state.alertedSigs[ei];
  });
  return { firstFail: firstFail, newly: newly };
}
function shakeCells(keys) {
  keys.forEach(function (pk) {
    var el = cellEl(pk);
    if (el) { el.classList.add("shake"); setTimeout(function () { el.classList.remove("shake"); }, 350); }
  });
}
function showMistakeEnd() {
  state.over = true;
  endKind = "lose";
  stopTimer();
  endTitle.textContent = T("mistakeTitle");
  endText.textContent = T("mistakeText");
  document.getElementById("retryBtn").style.display = "";
  endOverlay.classList.add("show");
}
/* Alert only when a completed equation through one of the placed
   cells fails — i.e. when its filled numbers do not match each
   other. Incomplete equations never alert. Returns true when a
   new mismatch was alerted (one mistake counted per alert). */
function judgeMismatch(placedKeys) {
  var scan = scanMismatches(placedKeys);
  if (!scan.newly) return false;
  state.mistakes++;
  render();
  shakeCells(placedKeys);
  showToast(T("mismatch")(eqText(scan.firstFail)));
  if (state.mistakes >= 3) showMistakeEnd();
  return true;
}

function boardFilled() {
  return state.blankKeys.every(function (k) { return state.cellMap[k].filled; });
}
function boardFullWrongToast() {
  if (!state.over && boardFilled()) showToast(T("boardFullToast"));
}
/* placing onto a filled cell replaces it: the old tile returns
   to the bank and the new number takes its place */
function placeTileOnCell(cell, idx, tile) {
  if (cell.filled) { freeTile(cell); cell.filled = false; cell.value = null; }
  cell.filled = true;
  cell.value = tile.value;
  cell.tileIdx = idx;
  tile.used = true;
}
/* no instant verdict: only if this placement completes an
   equation whose numbers do not match each other does the game
   alert and count a mistake (the number stays in its cell) */
function finishTilePlacement(placedKey) {
  var alerted = judgeMismatch([placedKey]);
  if (alerted) { render(); return; }
  clearStaleBadKeys();
  advanceSelection();
  render();
  checkWin();
  boardFullWrongToast();
}
function onTileTap(idx, tileEl) {
  if (!state || state.paused || state.over || confirmOpen) return;
  var tile = state.tiles[idx];
  if (tile.used) return;
  if (!state.selected) { advanceSelection(); if (!state.selected) return; }
  var placedKey = state.selected;
  var cell = state.cellMap[placedKey];
  if (cell.filled && cell.tileIdx === idx) return;
  pushHistory();
  if (state.badKeys) delete state.badKeys[placedKey];
  placeTileOnCell(cell, idx, tile);
  playChipSound(); /* the number just landed in its cell: casino chip sound */
  finishTilePlacement(placedKey);
}

function swapCellValues(from, to) {
  var tv = to.value, ti = to.tileIdx;
  to.value = from.value; to.tileIdx = from.tileIdx;
  from.value = tv; from.tileIdx = ti;
}
function moveCellValue(from, to) {
  to.filled = true;
  to.value = from.value;
  to.tileIdx = from.tileIdx;
  from.filled = false;
  from.value = null;
  from.tileIdx = null;
}
function finishMoveOrSwap(fromK, toK) {
  var alerted = judgeMismatch([fromK, toK]);
  if (!alerted) advanceSelection();
  render();
  if (!alerted) checkWin();
  if (!state.over && boardFilled() && Object.keys(computeWrongKeys()).length) showToast(T("boardFullToast"));
}
/* Move the number out of a filled cell into another blank cell
   (or swap the two numbers when the target is filled too) — the
   drag-out counterpart of dropping a tile in. Judged the same
   way: only a newly completed, mismatching equation alerts. */
function moveOrSwap(fromK, toK) {
  var from = state.cellMap[fromK];
  var to = state.cellMap[toK];
  if (!from || !from.filled || !to || to.type !== "num" || !to.blank) return;
  if (fromK === toK) return;
  pushHistory();
  if (to.filled) swapCellValues(from, to); else moveCellValue(from, to);
  state.selected = toK;
  playChipSound(); /* the number landed in its new cell */
  finishMoveOrSwap(fromK, toK);
}

/* ================= drag & drop =================
   Two drag sources share one pointer flow: a tile in the bank
   (kind "tile", dropped onto a blank cell to place it) and a
   number already sitting in a filled cell (kind "cell", dragged
   out by the player — dropped on the bank to take the number
   back, or onto another blank cell to move / swap it). */
var drag = null;
var suppressClick = false;
var suppressCellClick = false;

function newDragBase(e, kind) {
  return {
    kind: kind, startX: e.clientX, startY: e.clientY,
    active: false, ghost: null, targetKey: null, overBank: false
  };
}
function onTilePointerDown(e, idx, tileEl) {
  if (!state || state.paused || state.over || confirmOpen) return;
  if (state.tiles[idx].used) return;
  if (e.button != null && e.button !== 0) return;
  drag = newDragBase(e, "tile");
  drag.idx = idx;
  drag.value = state.tiles[idx].value;
  drag.tileEl = tileEl;
}

function onCellPointerDown(e, k, btn) {
  if (!state || state.paused || state.over || confirmOpen) return;
  var cell = state.cellMap[k];
  if (!cell || !cell.filled) return;
  if (e.button != null && e.button !== 0) return;
  drag = newDragBase(e, "cell");
  drag.idx = cell.tileIdx;
  drag.value = cell.value;
  drag.fromKey = k;
  drag.tileEl = btn;
}

function dragTargetAt(x, y) {
  var el = document.elementFromPoint(x, y);
  if (!el) return null;
  var cellBtn = el.closest ? el.closest("[data-key]") : null;
  if (!cellBtn) return null;
  var k = cellBtn.dataset.key;
  var cell = state.cellMap[k];
  if (!cell || cell.type !== "num" || !cell.blank) return null;
  return k;
}

function startDragGhost() {
  drag.active = true;
  drag.tileEl.classList.add("dragging");
  var ghost = document.createElement("div");
  ghost.className = "drag-ghost num";
  ghost.textContent = drag.value;
  document.body.appendChild(ghost);
  drag.ghost = ghost;
}
function updateDragTarget(x, y) {
  var k = dragTargetAt(x, y);
  if (drag.kind === "cell" && k === drag.fromKey) k = null;
  if (k === drag.targetKey) return;
  if (drag.targetKey) { var old = cellEl(drag.targetKey); if (old) old.classList.remove("drop-target"); }
  drag.targetKey = k;
  if (k) { var el = cellEl(k); if (el) el.classList.add("drop-target"); }
}
/* dragging a number out of its cell: hovering the tile bank
   marks it as the "take it back" drop zone */
function updateDragBankHover(x, y) {
  if (drag.kind !== "cell") return;
  var elAt = document.elementFromPoint(x, y);
  var overBank = !!(elAt && elAt.closest && elAt.closest("#bank"));
  if (overBank === !!drag.overBank) return;
  drag.overBank = overBank;
  bankEl.classList.toggle("return-target", overBank);
}
function onDragPointerMove(e) {
  if (!drag) return;
  if (!drag.active) {
    var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 7) return;
    startDragGhost();
  }
  drag.ghost.style.left = e.clientX + "px";
  drag.ghost.style.top = e.clientY + "px";
  updateDragTarget(e.clientX, e.clientY);
  updateDragBankHover(e.clientX, e.clientY);
}
window.addEventListener("pointermove", onDragPointerMove);

function clearDragVisuals(d) {
  if (d.ghost) d.ghost.remove();
  d.tileEl.classList.remove("dragging");
  if (d.targetKey) { var old = cellEl(d.targetKey); if (old) old.classList.remove("drop-target"); }
  bankEl.classList.remove("return-target");
}
/* a real drag out of a cell must not also fire the cell's
   tap-to-take-back click */
function finishCellDrag(d) {
  suppressCellClick = true;
  setTimeout(function () { suppressCellClick = false; }, 400);
  if (d.overBank) takeBack(d.fromKey); // dragged back to the bank: number returned
  else if (d.targetKey && d.targetKey !== d.fromKey) moveOrSwap(d.fromKey, d.targetKey);
}
function onDragPointerUp() {
  if (!drag) return;
  var d = drag;
  drag = null;
  if (!d.active) return;
  clearDragVisuals(d);
  if (d.kind === "cell") { finishCellDrag(d); return; }
  suppressClick = true;
  if (d.targetKey) { state.selected = d.targetKey; onTileTap(d.idx, d.tileEl); }
}
window.addEventListener("pointerup", onDragPointerUp);

function onDragPointerCancel() {
  if (!drag) return;
  clearDragVisuals(drag);
  drag = null;
}
window.addEventListener("pointercancel", onDragPointerCancel);

function advanceSelection() {
  var next = null;
  for (var i = 0; i < state.blankKeys.length; i++) {
    if (!state.cellMap[state.blankKeys[i]].filled) { next = state.blankKeys[i]; break; }
  }
  state.selected = next;
}

function cellSolutionVal(p) {
  var cell = state.cellMap[key(p.r, p.c)];
  return cell.blank ? cell.value : cell.answer;
}
function allEquationsHold() {
  return state.eqs.every(function (eq) {
    return eqHolds(cellSolutionVal(eq.pa), eq.op, cellSolutionVal(eq.pb), cellSolutionVal(eq.pres));
  });
}
function showWinEnd() {
  endKind = "win";
  endTitle.textContent = T("winTitle");
  endText.textContent = T("winText")(fmtTime(state.seconds), state.mistakes, state.hints);
  document.getElementById("retryBtn").style.display = "none";
  endOverlay.classList.add("show");
}
function checkWin() {
  if (!boardFilled()) return;
  if (!allEquationsHold()) return;
  state.over = true;
  stopTimer();
  showWinEnd();
  playWinJingle(); /* cheerful music for a full solve */
  confetti();
}

function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var shell = document.getElementById("boardShell");
  var colors = ["#d97706", "#16a34a", "#f1cf7e", "#79b78d", "#e2603f"];
  for (var i = 0; i < 26; i++) {
    var bit = document.createElement("div");
    bit.className = "confetti-bit";
    bit.style.left = (4 + Math.random() * 92) + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animation = "fall " + (0.9 + Math.random() * 0.9) + "s ease-in " + (Math.random() * 0.35) + "s forwards";
    shell.appendChild(bit);
    (function (node) { setTimeout(function () { node.remove(); }, 2400); })(bit);
  }
}

/* ================= sound effects =================
   Synthesized live with Web Audio — no files. There is no
   background music: the speaker button in the top bar is the
   on/off switch for these effects. Sound is on by default;
   when the button is toggled off (disabled), placing a number
   makes no sound and the win jingle stays silent too.
   1. playChipSound — the moment a number lands in a cell: two
      quick casino-chip clacks (short filtered noise bursts)
      plus a bright two-tone coin chime, like a betting machine
      taking a chip.
   2. playWinJingle — when the whole board is solved: a short
      cheerful fanfare, a rising arpeggio into a bright major
      chord. */
var fx = { ctx: null, master: null, noiseBuf: null };
var soundBtn = document.getElementById("soundBtn");
var soundEnabled = true;
function soundOn() { return soundEnabled; }

function makeNoiseBuffer() {
  var len = Math.floor(fx.ctx.sampleRate * 0.1);
  var buf = fx.ctx.createBuffer(1, len, fx.ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
function createFxContext() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  fx.ctx = new AC();
  fx.master = fx.ctx.createGain();
  fx.master.gain.value = 0.9;
  fx.master.connect(fx.ctx.destination);
  fx.noiseBuf = makeNoiseBuffer();
  return true;
}
function ensureFx() {
  if (!fx.ctx && !createFxContext()) return false;
  if (fx.ctx.state === "suspended") fx.ctx.resume();
  return true;
}
/* shared audio-graph wiring: source -> filter -> gain -> out */
function wireNodes(first, filter, gain, dest) {
  first.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
}
/* shared tone envelope: fast attack, exponential decay to silence */
function setToneEnvelope(param, start, dur, vol, attack) {
  param.setValueAtTime(0.0001, start);
  param.exponentialRampToValueAtTime(vol, start + attack);
  param.exponentialRampToValueAtTime(0.0001, start + dur);
}
function chipClack(start) {
  var ctx = fx.ctx;
  var src = ctx.createBufferSource();
  src.buffer = fx.noiseBuf;
  var filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2600;
  filter.Q.value = 1.1;
  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  wireNodes(src, filter, gain, fx.master);
  src.start(start);
  src.stop(start + 0.06);
}
function fxTone(freq, start, dur, type, vol) {
  var ctx = fx.ctx;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 5200;
  osc.type = type;
  osc.frequency.value = freq;
  setToneEnvelope(gain.gain, start, dur, vol, 0.012);
  wireNodes(osc, filter, gain, fx.master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
function playChipSound() {
  if (!soundOn()) return;
  if (!ensureFx()) return;
  var t = fx.ctx.currentTime + 0.01;
  chipClack(t);
  chipClack(t + 0.075);
  /* coin chime on top of the second clack */
  fxTone(1318.51, t + 0.06, 0.1, "square", 0.07);   /* E6 */
  fxTone(1760.00, t + 0.15, 0.3, "square", 0.08);   /* A6 */
}
function playWinChord(chordAt) {
  /* final bright C-major chord, held, with a G6 sparkle on top */
  [523.25, 659.25, 783.99, 1046.50].forEach(function (f) { fxTone(f, chordAt, 1.1, "triangle", 0.13); });
  fxTone(1567.98, chordAt + 0.12, 0.9, "sine", 0.07);
}
function playWinArpeggio(t0, step) {
  /* rising arpeggio: C5 E5 G5 C6, a hop back, then up to E6 */
  var seq = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
  seq.forEach(function (f, i) {
    fxTone(f, t0 + i * step, i === seq.length - 1 ? step * 2.4 : step * 1.5, "triangle", 0.24);
  });
  return seq.length;
}
function playWinSparkle(t0, step) {
  /* sparkle an octave up on the off-beats */
  [659.25, 783.99, 1046.50, 1318.51].forEach(function (f, i) {
    fxTone(f * 2, t0 + (i * 2 + 1) * step * 0.5 + i * step, step * 0.8, "sine", 0.05);
  });
}
function playWinJingle() {
  if (!soundOn()) return;
  if (!ensureFx()) return;
  var t0 = fx.ctx.currentTime + 0.05;
  var step = 0.155;
  var count = playWinArpeggio(t0, step);
  playWinSparkle(t0, step);
  playWinChord(t0 + count * step + 0.05);
}

/* ================= sound toggle =================
   The speaker button does not play music — it switches the
   placement sound (and the win jingle) on and off. On: every
   number placed in a cell clicks like a casino chip. Off
   (disabled): placing numbers is silent. */
function updateSoundBtn() {
  if (!soundBtn) return;
  soundBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  var label = soundEnabled ? T("soundOffLabel") : T("soundOnLabel");
  soundBtn.setAttribute("aria-label", label);
  soundBtn.title = label;
}
function toggleSound() {
  soundEnabled = !soundEnabled;
  updateSoundBtn();
  if (soundEnabled) playChipSound(); /* one click so the player hears it is back on */
}
if (soundBtn) soundBtn.addEventListener("click", toggleSound);
updateSoundBtn();

/* ================= language switching ================= */
function applyLangMeta() {
  document.title = T("title");
  document.documentElement.lang = T("htmlLang");
  setTextId("labelMistakes", T("mistakes"));
  setTextId("labelTime", T("time"));
  setTextId("labelHints", T("hints"));
}
function applyLangDiff() {
  var g = document.getElementById("diffGroup");
  if (g) g.setAttribute("aria-label", T("difficulty"));
  document.querySelectorAll(".difficulties button").forEach(function (b) { b.textContent = T(b.dataset.diff); });
}
function applyLangOverlays() {
  setTextId("pauseTitle", T("pausedTitle"));
  setTextId("pauseText", T("pausedText"));
  setTextId("resumeBtn", T("resume"));
  setTextId("retryBtn", T("retry"));
  setTextId("againBtn", T("again"));
  setTextId("resetConfirmTitle", T("resetTitle"));
  setTextId("resetConfirmText", T("resetText"));
  setTextId("resetYesBtn", T("yes"));
  setTextId("resetNoBtn", T("no"));
  setTextId("bankTitle", T("bankTitle"));
}
function applyLangAria() {
  boardEl.setAttribute("aria-label", T("boardLabel"));
  bankEl.setAttribute("aria-label", T("bankLabel"));
  setBtnLabel(document.getElementById("resetBtn"), T("resetLabel"));
  setBtnLabel(document.getElementById("hintBtn"), T("hintLabel"));
  document.getElementById("hintBtn").title = T("hintTitle");
  setBtnLabel(undoBtn, T("undoLabel"));
  setBtnLabel(document.getElementById("langBtn"), T("langLabel"));
}
function applyLangMenuState() {
  setTextId("langCode", T("code"));
  document.querySelectorAll("#langMenu button").forEach(function (b) {
    b.setAttribute("aria-checked", b.dataset.lang === lang ? "true" : "false");
  });
}
function refreshEndTexts() {
  if (!state || !state.over || !endKind) return;
  if (endKind === "win") { endTitle.textContent = T("winTitle"); endText.textContent = T("winText")(fmtTime(state.seconds), state.mistakes, state.hints); }
  else { endTitle.textContent = T("mistakeTitle"); endText.textContent = T("mistakeText"); }
}
function applyLanguage() {
  applyLangMeta(); applyLangDiff(); applyLangOverlays(); applyLangAria(); applyLangMenuState();
  updateSoundBtn(); updateSortBtn();
  if (state) { refreshEndTexts(); render(); } else updatePauseBtn();
}
function closeLangMenu() {
  var m = document.getElementById("langMenu"); if (m) m.classList.remove("show");
  var b = document.getElementById("langBtn"); if (b) b.setAttribute("aria-expanded", "false");
}
function toggleLangMenu() {
  var m = document.getElementById("langMenu"); if (!m) return;
  var open = m.classList.toggle("show");
  document.getElementById("langBtn").setAttribute("aria-expanded", open ? "true" : "false");
}
function setLanguage(code) {
  if (!LANGS[code]) { closeLangMenu(); return; }
  lang = code; closeLangMenu(); applyLanguage();
}
function bindLangControls() {
  document.getElementById("langBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleLangMenu(); });
  document.querySelectorAll("#langMenu button").forEach(function (b) {
    b.addEventListener("click", function () { setLanguage(b.dataset.lang); });
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".lang-wrap")) closeLangMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLangMenu(); });
}
bindLangControls();

/* ================= controls ================= */
undoBtn.addEventListener("click", function () {
  undoLast();
});
sortBtn.addEventListener("click", function () {
  if (!state || state.over || confirmOpen) return;
  if (!sorted) {
    state.tiles.sort(function (a, b) { return a.value - b.value; });
    sorted = true;
  } else {
    state.tiles.sort(function (a, b) { return a.orig - b.orig; });
    sorted = false;
  }
  updateSortBtn();
  renderBank();
});
pauseBtn.addEventListener("click", function () {
  if (!state || state.over || confirmOpen) return;
  state.paused = !state.paused;
  pauseOverlay.classList.toggle("show", state.paused);
  updatePauseBtn();
  updateUndoBtn();
});
document.getElementById("resumeBtn").addEventListener("click", function () {
  if (!state) return;
  state.paused = false;
  pauseOverlay.classList.remove("show");
  updatePauseBtn();
  updateUndoBtn();
});
document.getElementById("againBtn").addEventListener("click", function () {
  endOverlay.classList.remove("show");
  newGame(state.diff);
});
document.getElementById("retryBtn").addEventListener("click", restartSame);
/* ================= reset confirmation =================
   Tapping the reset icon never restarts the round at once:
   it opens an in-page confirmation first. 是 (yes) hides the
   dialog and resets the round; 否 (no) only hides the dialog
   and leaves the game exactly as it was — board, mistakes,
   hints and timer all untouched. */
function showResetConfirm() {
  if (!state) return;
  confirmOpen = true;
  resetConfirmEl.classList.add("show");
}
function hideResetConfirm() {
  confirmOpen = false;
  resetConfirmEl.classList.remove("show");
}
function onResetYes() {
  hideResetConfirm();
  restartSame();
}
document.getElementById("resetBtn").addEventListener("click", showResetConfirm);
document.getElementById("resetYesBtn").addEventListener("click", onResetYes);
document.getElementById("resetNoBtn").addEventListener("click", hideResetConfirm);
function hintTargetKey() {
  var target = (state.selected && !state.cellMap[state.selected].filled) ? state.selected : null;
  if (!target) { advanceSelection(); target = state.selected; }
  return target;
}
function showHintStuckToast() {
  var hasWrong = Object.keys(computeWrongKeys()).length > 0;
  showToast(hasWrong ? T("hintWrong") : T("hintStuck"));
}
function applyHint(target, hv) {
  var cell = state.cellMap[target];
  var hintTile = null;
  for (var i = 0; i < state.tiles.length; i++) {
    if (!state.tiles[i].used && state.tiles[i].value === hv) { state.tiles[i].used = true; hintTile = i; break; }
  }
  cell.filled = true;
  cell.value = hv;
  cell.tileIdx = hintTile;
}
function onHintTap() {
  if (!state || state.paused || state.over || confirmOpen) return;
  var target = hintTargetKey();
  if (!target) return;
  var sol = findSolution();
  if (!sol) { showHintStuckToast(); return; }
  pushHistory();
  applyHint(target, sol[target]);
  state.hints++;
  advanceSelection();
  render();
  checkWin();
}
document.getElementById("hintBtn").addEventListener("click", onHintTap);
document.querySelectorAll(".difficulties button").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (confirmOpen) return;
    document.querySelectorAll(".difficulties button").forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    endOverlay.classList.remove("show");
    pauseOverlay.classList.remove("show");
    newGame(btn.dataset.diff);
  });
});

newGame("medium");
applyLanguage();
