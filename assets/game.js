/* 数学十字谜 — 游戏逻辑
   从 index.html 拆出的独立脚本，方便单独维护。
   结构：
     1. 谜题生成（难度、模板、算式填充）
     2. 游戏状态与计时
     3. 棋盘与数字牌渲染
     4. 判定（算式凑齐才判错、交换律容许）
     5. 拖放、撤销、提示
     6. 音效与背景音乐（Web Audio 合成）
     7. 控件绑定与启动
*/
"use strict";

/* ================= puzzle generation ================= */

var DIFFS = {
  easy:   { ops: ["+", "-"],          max: 30,  maxGiven: 4 },
  medium: { ops: ["+", "-", "*"],    max: 99,  maxGiven: 5 },
  hard:   { ops: ["+", "-", "*", "/"], max: 99,  maxGiven: 7 },
  expert: { ops: ["+", "-", "*", "/"], max: 150, maxGiven: 10 }
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
  var a = k.a, b = k.b, res = k.res, ds, v;
  if (a != null && b != null && res != null) return a * b === res ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) res = a * b;
  else if (a != null && res != null) { if (res % a !== 0) return null; b = res / a; }
  else if (b != null && res != null) { if (res % b !== 0) return null; a = res / b; }
  else if (a != null) { v = ri(2, 9); if (v == null) return null; b = v; res = a * b; }
  else if (b != null) { v = ri(2, 9); if (v == null) return null; a = v; res = a * b; }
  else if (res != null) {
    ds = divisorsIn(res, 2, 12).filter(function (d) { var q = res / d; return q >= 2 && q <= 12; });
    if (!ds.length) return null;
    a = ds[Math.floor(Math.random() * ds.length)]; b = res / a;
  } else { a = ri(2, 9); b = ri(2, 9); res = a * b; }
  if (a >= 2 && a <= 12 && b >= 2 && b <= 12 && res <= max && a * b === res) return { a: a, b: b, res: res };
  return null;
}
function fillDivide(k, max) {
  var a = k.a, b = k.b, res = k.res, ds, v;
  if (a != null && b != null && res != null) return (b !== 0 && a === b * res) ? { a: a, b: b, res: res } : null;
  if (a != null && b != null) { if (b === 0 || a % b !== 0) return null; res = a / b; }
  else if (a != null && res != null) { if (res === 0 || a % res !== 0) return null; b = a / res; }
  else if (b != null && res != null) a = b * res;
  else if (a != null) {
    ds = divisorsIn(a, 2, 12).filter(function (d) { var q = a / d; return q >= 2 && q <= 12; });
    if (!ds.length) return null;
    b = ds[Math.floor(Math.random() * ds.length)]; res = a / b;
  }
  else if (b != null) { v = ri(2, 12); res = v; a = b * res; }
  else if (res != null) { v = ri(2, 12); b = v; a = b * res; }
  else { b = ri(2, 12); res = ri(2, 12); a = b * res; }
  if (b >= 2 && b <= 12 && res >= 2 && res <= 12 && a <= max && a === b * res) return { a: a, b: b, res: res };
  return null;
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

function pickBlanks(eqs, cfg) {
  /* unique number cells -> list of equation indices they belong to */
  var membership = {};
  eqs.forEach(function (eq, idx) {
    [eq.pa, eq.pb, eq.pres].forEach(function (p) {
      var k = key(p.r, p.c);
      (membership[k] = membership[k] || []).push(idx);
    });
  });
  var keys = Object.keys(membership);
  /* Keep the given (pre-filled) numbers as few as possible: choose a
     small set of givens that still leaves every equation with at least
     one given to work from. Greedy set cover — repeatedly keep the
     cell that anchors the most still-unanchored equations (crossing
     cells anchor two at once) — then keep the smallest valid set
     found. Every equation ends with 1–2 givens and 1–2 blanks. */
  var best = null;
  for (var attempt = 0; attempt < 200; attempt++) {
    var uncovered = {};
    eqs.forEach(function (eq, idx) { uncovered[idx] = true; });
    var givens = {};
    while (Object.keys(uncovered).length) {
      var bestScore = -1, cands = [];
      keys.forEach(function (k) {
        if (givens[k]) return;
        var s = 0;
        membership[k].forEach(function (ei) { if (uncovered[ei]) s++; });
        if (s > bestScore) { bestScore = s; cands = [k]; }
        else if (s === bestScore) cands.push(k);
      });
      var pick = cands[Math.floor(Math.random() * cands.length)];
      givens[pick] = true;
      membership[pick].forEach(function (ei) { delete uncovered[ei]; });
    }
    var blanks = {};
    keys.forEach(function (k) { if (!givens[k]) blanks[k] = true; });
    var ok = true;
    for (var i = 0; i < eqs.length; i++) {
      var eq = eqs[i];
      var nb = [eq.pa, eq.pb, eq.pres].filter(function (p) { return blanks[key(p.r, p.c)]; }).length;
      if (nb < 1 || nb > 2) { ok = false; break; } // every equation: >=1 given and >=1 blank
    }
    if (!ok) continue;
    if (!best || Object.keys(givens).length < Object.keys(best.givens).length) {
      best = { givens: givens, blanks: blanks };
      if (Object.keys(givens).length <= cfg.maxGiven) break;
    }
  }
  return best ? best.blanks : null;
}

function generate(diff) {
  var cfg = DIFFS[diff];
  for (var attempt = 0; attempt < 300; attempt++) {
    var values = {};
    var eqs = [];
    var ok = true;
    var list = TEMPLATES[diff];
    for (var i = 0; i < list.length; i++) {
      var dir = list[i][0], r = list[i][1], c = list[i][2];
      var cells = eqCells(dir, r, c);
      var pa = cells[0], pb = cells[2], pres = cells[4];
      var known = {
        a: values[key(pa.r, pa.c)] != null ? values[key(pa.r, pa.c)] : null,
        b: values[key(pb.r, pb.c)] != null ? values[key(pb.r, pb.c)] : null,
        res: values[key(pres.r, pres.c)] != null ? values[key(pres.r, pres.c)] : null
      };
      var sol = solveEq(known, cfg);
      if (!sol) { ok = false; break; }
      values[key(pa.r, pa.c)] = sol.a;
      values[key(pb.r, pb.c)] = sol.b;
      values[key(pres.r, pres.c)] = sol.res;
      eqs.push({ dir: dir, r: r, c: c, cells: cells, pa: pa, pb: pb, pres: pres, op: sol.op });
    }
    if (!ok) continue;
    var blanks = pickBlanks(eqs, cfg);
    if (!blanks) continue;
    return { values: values, eqs: eqs, blanks: blanks };
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
  var label = paused ? "继续游戏" : "暂停";
  pauseBtn.setAttribute("aria-label", label);
  pauseBtn.title = label;
}
function updateSortBtn() {
  sortBtn.setAttribute("aria-pressed", sorted ? "true" : "false");
  var tip = sorted ? "恢复数字牌原来的顺序" : "把数字牌从小到大排序";
  sortBtn.setAttribute("aria-label", tip);
  sortBtn.title = tip;
}
var toastEl = document.getElementById("toast");
var sorted = false;
var toastTimer = null;

var state = null;

function newGame(diff) {
  var puzzle = generate(diff);
  if (!puzzle) puzzle = generate(diff); // generation is randomized; a second pass virtually always succeeds
  var cellMap = {}; // key -> cell descriptor
  var rows = 0, cols = 0;
  puzzle.eqs.forEach(function (eq) {
    eq.cells.forEach(function (cell, i) {
      rows = Math.max(rows, cell.r + 1);
      cols = Math.max(cols, cell.c + 1);
      var k = key(cell.r, cell.c);
      if (i === 1) cellMap[k] = { type: "op", symbol: OP_SYMBOL[eq.op] };
      else if (i === 3) cellMap[k] = { type: "eq", symbol: "=" };
      else if (!cellMap[k]) {
        cellMap[k] = {
          type: "num",
          answer: puzzle.values[k],
          blank: !!puzzle.blanks[k],
          filled: false,
          value: null,
          tileIdx: null
        };
      }
    });
  });
  var maxDigits = 1;
  Object.keys(cellMap).forEach(function (k) {
    if (cellMap[k].type === "num") maxDigits = Math.max(maxDigits, String(cellMap[k].answer).length);
  });
  var blankKeys = Object.keys(cellMap).filter(function (k) { return cellMap[k].type === "num" && cellMap[k].blank; });
  blankKeys.sort(function (x, y) {
    var a = x.split(",").map(Number), b = y.split(",").map(Number);
    return a[0] - b[0] || a[1] - b[1];
  });
  var tiles = shuffle(blankKeys.map(function (k) { return cellMap[k].answer; }))
    .map(function (v, i) { return { value: v, used: false, orig: i }; });

  state = {
    diff: diff,
    eqs: puzzle.eqs,
    cellMap: cellMap,
    rows: rows,
    cols: cols,
    maxDigits: maxDigits,
    blankKeys: blankKeys,
    tiles: tiles,
    selected: blankKeys.length ? blankKeys[0] : null,
    badKeys: {},
    alertedSigs: {},
    history: [],
    mistakes: 0,
    hints: 0,
    seconds: 0,
    paused: false,
    over: false,
    timerId: null
  };
  sorted = false;
  updateSortBtn();
  startTimer();
  render();
}

function restartSame() {
  if (!state) return;
  state.blankKeys.forEach(function (k) { state.cellMap[k].filled = false; state.cellMap[k].value = null; state.cellMap[k].tileIdx = null; });
  state.tiles.forEach(function (t) { t.used = false; });
  state.tiles.sort(function (a, b) { return a.orig - b.orig; });
  sorted = false;
  updateSortBtn();
  state.selected = state.blankKeys.length ? state.blankKeys[0] : null;
  state.badKeys = {};
  state.alertedSigs = {};
  state.history = [];
  state.mistakes = 0;
  state.hints = 0;
  state.seconds = 0;
  state.paused = false;
  state.over = false;
  endOverlay.classList.remove("show");
  pauseOverlay.classList.remove("show");
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
    if (!state.paused && !state.over) {
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
  progressEl.textContent = "已填 " + done + " / " + state.blankKeys.length;
  renderBoard();
  renderBank();
  fitBoardFont();
}

function renderBoard() {
  var wrong = computeWrongKeys();
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = "repeat(" + state.cols + ", 1fr)";
  boardEl.style.maxWidth = (state.cols * 58) + "px";
  for (var r = 0; r < state.rows; r++) {
    for (var c = 0; c < state.cols; c++) {
      var k = key(r, c);
      var cell = state.cellMap[k];
      var el;
      if (!cell) {
        el = document.createElement("div");
        el.className = "cell empty";
      } else if (cell.type === "num" && cell.blank) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "cell blank" + (cell.filled ? " filled" : "") + (cell.filled && wrong[k] ? " wrong" : "") + (state.selected === k && !cell.filled ? " selected" : "");
        el.textContent = cell.filled ? cell.value : "";
        el.setAttribute("aria-label", cell.filled ? "已填 " + cell.value + "，点按取回，或拖回数字牌" : "空格");
        el.dataset.key = k;
        el.addEventListener("click", function () {
          if (suppressCellClick) { suppressCellClick = false; return; }
          if (state.paused || state.over) return;
          var kk = this.dataset.key;
          if (state.cellMap[kk].filled) {
            /* numbers stay put when wrong — tapping a filled cell
               takes its number back so the player can fix it */
            takeBack(kk);
          } else {
            state.selected = kk;
            renderBoard();
            fitBoardFont();
          }
        });
        el.addEventListener("pointerdown", function (e) {
          onCellPointerDown(e, this.dataset.key, this);
        });
      } else {
        el = document.createElement("div");
        el.className = "cell " + (cell.type === "num" ? "given" : cell.type);
        el.textContent = cell.type === "num" ? cell.answer : cell.symbol;
      }
      boardEl.appendChild(el);
    }
  }
}

function renderBank() {
  bankEl.innerHTML = "";
  state.tiles.forEach(function (tile, idx) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tile num" + (tile.used ? " used" : "");
    b.textContent = tile.value;
    b.dataset.idx = idx;
    b.setAttribute("aria-label", "数字牌 " + tile.value);
    b.addEventListener("click", function () {
      if (suppressClick) { suppressClick = false; return; }
      onTileTap(idx, b);
    });
    b.addEventListener("pointerdown", function (e) { onTilePointerDown(e, idx, b); });
    bankEl.appendChild(b);
  });
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
function findSolution(ignoreKeys) {
  var assign = {};
  var ignoredValues = [];
  Object.keys(state.cellMap).forEach(function (k) {
    var cell = state.cellMap[k];
    if (cell.type !== "num") return;
    if (ignoreKeys && ignoreKeys[k] && cell.blank && cell.filled) {
      assign[k] = null;
      ignoredValues.push(cell.value);
    } else {
      assign[k] = cell.blank ? (cell.filled ? cell.value : null) : cell.answer;
    }
  });
  var tilesLeft = ignoredValues.slice();
  state.tiles.forEach(function (t) { if (!t.used) tilesLeft.push(t.value); });
  var eqs = state.eqs.map(function (eq) {
    return { op: eq.op, ka: key(eq.pa.r, eq.pa.c), kb: key(eq.pb.r, eq.pb.c), kr: key(eq.pres.r, eq.pres.c) };
  });
  var nodes = 0;
  var aborted = false;

  function solve(assignIn, tilesIn) {
    if (++nodes > 60000) { aborted = true; return null; }
    var a2 = {}, k;
    for (k in assignIn) a2[k] = assignIn[k];
    var t2 = tilesIn.slice();
    /* propagate: an equation with two known numbers forces the third */
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < eqs.length; i++) {
        var e = eqs[i];
        var va = a2[e.ka], vb = a2[e.kb], vr = a2[e.kr];
        var known = (va != null ? 1 : 0) + (vb != null ? 1 : 0) + (vr != null ? 1 : 0);
        if (known === 3) {
          if (!eqHolds(va, e.op, vb, vr)) return null;
        } else if (known === 2) {
          var need = neededValue(e.op, va, vb, vr);
          if (need == null) return null;
          var ti = t2.indexOf(need);
          if (ti < 0) return null;
          a2[va == null ? e.ka : (vb == null ? e.kb : e.kr)] = need;
          t2.splice(ti, 1);
          changed = true;
        }
      }
    }
    var open = [];
    Object.keys(a2).forEach(function (kk) { if (a2[kk] == null) open.push(kk); });
    if (!open.length) return a2;
    /* branch on the open cell shared by the most equations */
    var best = null, bestScore = -1;
    open.forEach(function (kk) {
      var score = 0;
      eqs.forEach(function (e) { if (e.ka === kk || e.kb === kk || e.kr === kk) score++; });
      if (score > bestScore) { bestScore = score; best = kk; }
    });
    var tried = {};
    for (var j = 0; j < t2.length; j++) {
      var v = t2[j];
      if (tried[v]) continue;
      tried[v] = true;
      var a3 = {};
      for (var k3 in a2) a3[k3] = a2[k3];
      a3[best] = v;
      var t3 = t2.slice();
      t3.splice(j, 1);
      var got = solve(a3, t3);
      if (got) return got;
    }
    return null;
  }
  var result = solve(assign, tilesLeft);
  findSolution.exhausted = !result && aborted;
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
/* keys of player-filled cells to render red: cells flagged wrong
   the moment they were placed (badKeys), plus filled cells that
   belong to a completed equation which does not hold */
function computeWrongKeys() {
  var wrong = {};
  if (!state) return wrong;
  Object.keys(state.badKeys || {}).forEach(function (k) {
    var cell = state.cellMap[k];
    if (cell && cell.blank && cell.filled) wrong[k] = true;
  });
  state.eqs.forEach(function (eq) {
    if (!eqFails(eq)) return;
    [eq.pa, eq.pb, eq.pres].forEach(function (p) {
      var k = key(p.r, p.c);
      var cell = state.cellMap[k];
      if (cell && cell.blank && cell.filled) wrong[k] = true;
    });
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
function pushHistory() {
  if (!state) return;
  if (!state.history) state.history = [];
  var cells = {};
  state.blankKeys.forEach(function (k) {
    var cell = state.cellMap[k];
    var tileObj = null;
    if (cell.filled) {
      if (cell.tileIdx != null && state.tiles[cell.tileIdx] &&
          state.tiles[cell.tileIdx].value === cell.value) {
        tileObj = state.tiles[cell.tileIdx];
      } else {
        for (var i = 0; i < state.tiles.length; i++) {
          if (state.tiles[i].used && state.tiles[i].value === cell.value) { tileObj = state.tiles[i]; break; }
        }
      }
    }
    cells[k] = { filled: cell.filled, value: cell.value, tile: tileObj };
  });
  state.history.push({
    cells: cells,
    tileStates: state.tiles.map(function (t) { return { tile: t, used: t.used }; }),
    selected: state.selected,
    mistakes: state.mistakes,
    hints: state.hints,
    badKeys: Object.assign({}, state.badKeys || {}),
    alertedSigs: Object.assign({}, state.alertedSigs || {}),
    over: state.over
  });
  if (state.history.length > 100) state.history.shift();
  updateUndoBtn();
}
function undoLast() {
  if (!state || state.paused || !state.history || !state.history.length) return;
  var snap = state.history.pop();
  snap.tileStates.forEach(function (ts) { ts.tile.used = ts.used; });
  var claimed = {};
  state.blankKeys.forEach(function (k) {
    var s = snap.cells[k];
    var cell = state.cellMap[k];
    if (!s || !cell) return;
    cell.filled = !!s.filled;
    cell.value = s.filled ? s.value : null;
    cell.tileIdx = null;
    if (s.filled) {
      var idx = -1;
      if (s.tile) {
        var ti = state.tiles.indexOf(s.tile);
        if (ti >= 0 && !claimed[ti]) idx = ti;
      }
      if (idx < 0) {
        for (var i = 0; i < state.tiles.length; i++) {
          if (state.tiles[i].used && state.tiles[i].value === s.value && !claimed[i]) { idx = i; break; }
        }
      }
      if (idx >= 0) { cell.tileIdx = idx; claimed[idx] = true; }
    }
  });
  state.selected = snap.selected;
  state.mistakes = snap.mistakes;
  state.hints = snap.hints;
  state.badKeys = Object.assign({}, snap.badKeys || {});
  state.alertedSigs = Object.assign({}, snap.alertedSigs || {});
  var wasOver = state.over;
  state.over = !!snap.over;
  if (wasOver && !state.over) {
    endOverlay.classList.remove("show");
    startTimer();
  }
  render();
}

function takeBack(k) {
  var cell = state.cellMap[k];
  if (!cell || !cell.filled) return;
  pushHistory();
  freeTile(cell);
  cell.filled = false;
  cell.value = null;
  if (state.badKeys) delete state.badKeys[k];
  /* the equations through this cell no longer hold their old
     numbers — let them alert again if they fail again */
  if (state.alertedSigs) {
    state.eqs.forEach(function (eq, ei) {
      if (key(eq.pa.r, eq.pa.c) === k || key(eq.pb.r, eq.pb.c) === k ||
          key(eq.pres.r, eq.pres.c) === k) delete state.alertedSigs[ei];
    });
  }
  state.selected = k;
  clearStaleBadKeys();
  render();
}

/* Alert only when a completed equation through one of the placed
   cells fails — i.e. when its filled numbers do not match each
   other. Incomplete equations never alert. Returns true when a
   new mismatch was alerted (one mistake counted per alert). */
function judgeMismatch(placedKeys) {
  var firstFail = null;
  var newly = false;
  state.eqs.forEach(function (eq, ei) {
    var involves = placedKeys.some(function (pk) {
      return key(eq.pa.r, eq.pa.c) === pk ||
             key(eq.pb.r, eq.pb.c) === pk ||
             key(eq.pres.r, eq.pres.c) === pk;
    });
    if (!involves) return;
    if (eqFails(eq)) {
      var sig = eqText(eq);
      if (state.alertedSigs[ei] !== sig) {
        state.alertedSigs[ei] = sig;
        newly = true;
        if (!firstFail) firstFail = eq;
      }
    } else {
      delete state.alertedSigs[ei];
    }
  });
  if (!newly) return false;
  state.mistakes++;
  render();
  placedKeys.forEach(function (pk) {
    var el = cellEl(pk);
    if (el) { el.classList.add("shake"); setTimeout(function () { el.classList.remove("shake"); }, 350); }
  });
  showToast("数字对不上：" + eqText(firstFail) + " 不成立，拖回或点格子改");
  if (state.mistakes >= 3) {
    state.over = true;
    stopTimer();
    endTitle.textContent = "差一点点";
    endText.textContent = "错误满 3 次了。可以再试一次这一题，或者换一题新的。";
    document.getElementById("retryBtn").style.display = "";
    endOverlay.classList.add("show");
  }
  return true;
}

function onTileTap(idx, tileEl) {
  if (!state || state.paused || state.over) return;
  var tile = state.tiles[idx];
  if (tile.used) return;
  if (!state.selected) { advanceSelection(); if (!state.selected) return; }
  var placedKey = state.selected;
  var cell = state.cellMap[placedKey];
  if (cell.filled && cell.tileIdx === idx) return;
  /* placing onto a filled cell replaces it: the old tile returns
     to the bank and the new number takes its place */
  pushHistory();
  if (cell.filled) {
    freeTile(cell);
    cell.filled = false;
    cell.value = null;
  }
  if (state.badKeys) delete state.badKeys[placedKey];
  cell.filled = true;
  cell.value = tile.value;
  cell.tileIdx = idx;
  tile.used = true;
  /* the number just landed in its cell: casino chip sound */
  playChipSound();
  /* no instant verdict: only if this placement completes an
     equation whose numbers do not match each other does the game
     alert and count a mistake (the number stays in its cell) */
  var alerted = judgeMismatch([placedKey]);
  if (alerted) { render(); return; }
  clearStaleBadKeys();
  advanceSelection();
  render();
  checkWin();
  if (!state.over && state.blankKeys.every(function (k) { return state.cellMap[k].filled; })) {
    showToast("棋盘填满了，但还有标红的数字对不上，把错的拖回或点格子改一改");
  }
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
  if (to.filled) {
    var tv = to.value, ti = to.tileIdx;
    to.value = from.value; to.tileIdx = from.tileIdx;
    from.value = tv; from.tileIdx = ti;
  } else {
    to.filled = true;
    to.value = from.value;
    to.tileIdx = from.tileIdx;
    from.filled = false;
    from.value = null;
    from.tileIdx = null;
  }
  state.selected = toK;
  playChipSound(); /* the number landed in its new cell */
  var alerted = judgeMismatch([fromK, toK]);
  if (!alerted) advanceSelection();
  render();
  if (!alerted) checkWin();
  if (!state.over && state.blankKeys.every(function (k) { return state.cellMap[k].filled; }) &&
      Object.keys(computeWrongKeys()).length) {
    showToast("棋盘填满了，但还有标红的数字对不上，把错的拖回或点格子改一改");
  }
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

function onTilePointerDown(e, idx, tileEl) {
  if (!state || state.paused || state.over) return;
  if (state.tiles[idx].used) return;
  if (e.button != null && e.button !== 0) return;
  drag = {
    kind: "tile",
    idx: idx,
    value: state.tiles[idx].value,
    tileEl: tileEl,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    ghost: null,
    targetKey: null,
    overBank: false
  };
}

function onCellPointerDown(e, k, btn) {
  if (!state || state.paused || state.over) return;
  var cell = state.cellMap[k];
  if (!cell || !cell.filled) return;
  if (e.button != null && e.button !== 0) return;
  drag = {
    kind: "cell",
    idx: cell.tileIdx,
    value: cell.value,
    fromKey: k,
    tileEl: btn,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    ghost: null,
    targetKey: null,
    overBank: false
  };
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

window.addEventListener("pointermove", function (e) {
  if (!drag) return;
  if (!drag.active) {
    var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 7) return;
    drag.active = true;
    drag.tileEl.classList.add("dragging");
    var ghost = document.createElement("div");
    ghost.className = "drag-ghost num";
    ghost.textContent = drag.value;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }
  drag.ghost.style.left = e.clientX + "px";
  drag.ghost.style.top = e.clientY + "px";
  var k = dragTargetAt(e.clientX, e.clientY);
  if (drag.kind === "cell" && k === drag.fromKey) k = null;
  if (k !== drag.targetKey) {
    if (drag.targetKey) { var old = cellEl(drag.targetKey); if (old) old.classList.remove("drop-target"); }
    drag.targetKey = k;
    if (k) { var el = cellEl(k); if (el) el.classList.add("drop-target"); }
  }
  /* dragging a number out of its cell: hovering the tile bank
     marks it as the "take it back" drop zone */
  if (drag.kind === "cell") {
    var elAt = document.elementFromPoint(e.clientX, e.clientY);
    var overBank = !!(elAt && elAt.closest && elAt.closest("#bank"));
    if (overBank !== !!drag.overBank) {
      drag.overBank = overBank;
      bankEl.classList.toggle("return-target", overBank);
    }
  }
});

window.addEventListener("pointerup", function () {
  if (!drag) return;
  var d = drag;
  drag = null;
  if (!d.active) return;
  if (d.ghost) d.ghost.remove();
  d.tileEl.classList.remove("dragging");
  if (d.targetKey) {
    var old = cellEl(d.targetKey);
    if (old) old.classList.remove("drop-target");
  }
  bankEl.classList.remove("return-target");
  if (d.kind === "cell") {
    /* a real drag out of a cell must not also fire the cell's
       tap-to-take-back click */
    suppressCellClick = true;
    setTimeout(function () { suppressCellClick = false; }, 400);
    if (d.overBank) {
      takeBack(d.fromKey); // dragged back to the bank: number returned
    } else if (d.targetKey && d.targetKey !== d.fromKey) {
      moveOrSwap(d.fromKey, d.targetKey);
    }
    return;
  }
  suppressClick = true;
  if (d.targetKey) {
    state.selected = d.targetKey;
    onTileTap(d.idx, d.tileEl);
  }
});

window.addEventListener("pointercancel", function () {
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  if (drag.targetKey) { var el = cellEl(drag.targetKey); if (el) el.classList.remove("drop-target"); }
  bankEl.classList.remove("return-target");
  drag.tileEl.classList.remove("dragging");
  drag = null;
});

function advanceSelection() {
  var next = null;
  for (var i = 0; i < state.blankKeys.length; i++) {
    if (!state.cellMap[state.blankKeys[i]].filled) { next = state.blankKeys[i]; break; }
  }
  state.selected = next;
}

function checkWin() {
  var all = state.blankKeys.every(function (k) { return state.cellMap[k].filled; });
  if (!all) return;
  var holds = state.eqs.every(function (eq) {
    function val(p) {
      var cell = state.cellMap[key(p.r, p.c)];
      return cell.blank ? cell.value : cell.answer;
    }
    return eqHolds(val(eq.pa), eq.op, val(eq.pb), val(eq.pres));
  });
  if (!holds) return;
  state.over = true;
  stopTimer();
  endTitle.textContent = "全部填对了！";
  endText.textContent = "用时 " + fmtTime(state.seconds) + "，错误 " + state.mistakes + " 次" +
    (state.hints ? "，用了 " + state.hints + " 次提示" : "") + "。再来一题？";
  document.getElementById("retryBtn").style.display = "none";
  endOverlay.classList.add("show");
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
   Synthesized live with Web Audio, like the music — no files.
   Two effects share one small context of their own (separate
   from the music's, so they work whether or not the background
   music is on):
   1. playChipSound — the moment a number lands in a cell: two
      quick casino-chip clacks (short filtered noise bursts)
      plus a bright two-tone coin chime, like a betting machine
      taking a chip.
   2. playWinJingle — when the whole board is solved: a short
      cheerful fanfare, a rising arpeggio into a bright major
      chord. */
var fx = { ctx: null, master: null, noiseBuf: null };

function ensureFx() {
  if (!fx.ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    fx.ctx = new AC();
    fx.master = fx.ctx.createGain();
    fx.master.gain.value = 0.9;
    fx.master.connect(fx.ctx.destination);
    var len = Math.floor(fx.ctx.sampleRate * 0.1);
    fx.noiseBuf = fx.ctx.createBuffer(1, len, fx.ctx.sampleRate);
    var data = fx.noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (fx.ctx.state === "suspended") fx.ctx.resume();
  return true;
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
  src.connect(filter);
  filter.connect(gain);
  gain.connect(fx.master);
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
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(fx.master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
function playChipSound() {
  if (!ensureFx()) return;
  var t = fx.ctx.currentTime + 0.01;
  chipClack(t);
  chipClack(t + 0.075);
  /* coin chime on top of the second clack */
  fxTone(1318.51, t + 0.06, 0.1, "square", 0.07);   /* E6 */
  fxTone(1760.00, t + 0.15, 0.3, "square", 0.08);   /* A6 */
}
function playWinJingle() {
  if (!ensureFx()) return;
  var t0 = fx.ctx.currentTime + 0.05;
  var step = 0.155;
  /* rising arpeggio: C5 E5 G5 C6, a hop back, then up to E6 */
  var seq = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
  seq.forEach(function (f, i) {
    fxTone(f, t0 + i * step, i === seq.length - 1 ? step * 2.4 : step * 1.5, "triangle", 0.24);
  });
  /* sparkle an octave up on the off-beats */
  [659.25, 783.99, 1046.50, 1318.51].forEach(function (f, i) {
    fxTone(f * 2, t0 + (i * 2 + 1) * step * 0.5 + i * step, step * 0.8, "sine", 0.05);
  });
  /* final bright C-major chord, held */
  var chordAt = t0 + seq.length * step + 0.05;
  [523.25, 659.25, 783.99, 1046.50].forEach(function (f) {
    fxTone(f, chordAt, 1.1, "triangle", 0.13);
  });
  fxTone(1567.98, chordAt + 0.12, 0.9, "sine", 0.07); /* G6 sparkle on top */
}

/* ================= background music =================
   A gentle loop synthesized live with Web Audio — no audio file
   to load. A slow C – Am – F – G progression: a soft pad chord and
   a low root note per bar, with the chord tones arpeggiated an
   octave up as the melody, so it can never clash. Volume is kept
   low on purpose. Browsers block audio before a tap, so the music
   only ever starts from the music button itself. */
var musicBtn = document.getElementById("musicBtn");
var BAR_SECONDS = 3.6;
var PROGRESSION = [
  { bass: 130.81, chord: [261.63, 329.63, 392.00] }, /* C  */
  { bass: 110.00, chord: [220.00, 261.63, 329.63] }, /* Am */
  { bass: 87.31,  chord: [220.00, 261.63, 349.23] }, /* F  */
  { bass: 98.00,  chord: [246.94, 293.66, 392.00] }  /* G  */
];
/* which chord tone (then one octave up) sounds on each beat */
var ARP_PATTERNS = [
  [2, 1, 0, 1],
  [0, 1, 2, 1],
  [1, 2, 1, 0],
  [2, 0, 1, 2]
];
var music = { ctx: null, master: null, playing: false, timerId: null, nextTime: 0, bar: 0 };

function ensureAudio() {
  if (!music.ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    music.ctx = new AC();
    music.master = music.ctx.createGain();
    music.master.gain.value = 0;
    music.master.connect(music.ctx.destination);
  }
  if (music.ctx.state === "suspended") music.ctx.resume();
  return true;
}
function playTone(freq, start, dur, type, vol) {
  var ctx = music.ctx;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  osc.type = type;
  osc.frequency.value = freq;
  var attack = Math.min(0.35, dur * 0.3);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(music.master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
function scheduleBar(barIdx, start) {
  var step = PROGRESSION[barIdx % PROGRESSION.length];
  /* pad: the whole chord, sustained across the bar */
  step.chord.forEach(function (f) { playTone(f, start, BAR_SECONDS * 1.05, "triangle", 0.045); });
  /* low root note */
  playTone(step.bass, start, BAR_SECONDS * 0.92, "sine", 0.09);
  playTone(step.bass * 2, start, BAR_SECONDS * 0.5, "sine", 0.02);
  /* melody: chord tones an octave up, one per beat */
  var pattern = ARP_PATTERNS[barIdx % ARP_PATTERNS.length];
  var beat = BAR_SECONDS / 4;
  pattern.forEach(function (toneIdx, i) {
    playTone(step.chord[toneIdx] * 2, start + i * beat + 0.04, beat * 0.92, "sine", 0.055);
  });
}
function musicTick() {
  if (!music.playing || !music.ctx) return;
  while (music.nextTime < music.ctx.currentTime + 0.7) {
    scheduleBar(music.bar, Math.max(music.nextTime, music.ctx.currentTime + 0.03));
    music.nextTime += BAR_SECONDS;
    music.bar++;
  }
}
function updateMusicBtn() {
  musicBtn.setAttribute("aria-pressed", music.playing ? "true" : "false");
  var label = music.playing ? "关音乐" : "播放背景音乐";
  musicBtn.setAttribute("aria-label", label);
  musicBtn.title = label;
}
function startMusic() {
  if (!ensureAudio()) {
    showToast("这个浏览器不支持播放音乐");
    return;
  }
  music.playing = true;
  music.bar = 0;
  music.nextTime = music.ctx.currentTime + 0.06;
  /* fade in gently instead of starting at full volume */
  music.master.gain.cancelScheduledValues(music.ctx.currentTime);
  music.master.gain.setValueAtTime(music.master.gain.value, music.ctx.currentTime);
  music.master.gain.linearRampToValueAtTime(0.85, music.ctx.currentTime + 1.2);
  musicTick();
  music.timerId = setInterval(musicTick, 250);
  updateMusicBtn();
}
function stopMusic() {
  music.playing = false;
  if (music.timerId) { clearInterval(music.timerId); music.timerId = null; }
  if (music.ctx && music.master) {
    music.master.gain.cancelScheduledValues(music.ctx.currentTime);
    music.master.gain.setValueAtTime(music.master.gain.value, music.ctx.currentTime);
    music.master.gain.linearRampToValueAtTime(0, music.ctx.currentTime + 0.4);
  }
  updateMusicBtn();
}
musicBtn.addEventListener("click", function () {
  if (music.playing) stopMusic(); else startMusic();
});

/* ================= controls ================= */
undoBtn.addEventListener("click", function () {
  undoLast();
});
sortBtn.addEventListener("click", function () {
  if (!state || state.over) return;
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
  if (!state || state.over) return;
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
document.getElementById("resetBtn").addEventListener("click", restartSame);
document.getElementById("hintBtn").addEventListener("click", function () {
  if (!state || state.paused || state.over) return;
  var target = (state.selected && !state.cellMap[state.selected].filled) ? state.selected : null;
  if (!target) { advanceSelection(); target = state.selected; }
  if (!target) return;
  var sol = findSolution();
  if (!sol) {
    var hasWrong = Object.keys(computeWrongKeys()).length > 0;
    showToast(hasWrong ? "先把标红的数字改对，再用提示" : "现在的填法凑不到一起，先改几个数字再试");
    return;
  }
  var cell = state.cellMap[target];
  var hv = sol[target];
  pushHistory();
  var hintTile = null;
  for (var i = 0; i < state.tiles.length; i++) {
    if (!state.tiles[i].used && state.tiles[i].value === hv) { state.tiles[i].used = true; hintTile = i; break; }
  }
  cell.filled = true;
  cell.value = hv;
  cell.tileIdx = hintTile;
  state.hints++;
  advanceSelection();
  render();
  checkWin();
});
document.querySelectorAll(".difficulties button").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".difficulties button").forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    endOverlay.classList.remove("show");
    pauseOverlay.classList.remove("show");
    newGame(btn.dataset.diff);
  });
});

newGame("medium");
