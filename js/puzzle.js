/* 数学十字谜 — puzzle generation module.
   Templates, equation filling (via the one operation table in
   ops.js), the one-given rule for prefilled numbers, and turning a
   generated puzzle into the board model the state owner plays on. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;
  const util = MC.util;
  const Ops = MC.Ops;
  const cellKey = util.cellKey;

  const DIFFICULTIES = Object.freeze({
    easy:   Object.freeze({ ops: Object.freeze(["+", "-"]),           max: 30 }),
    medium: Object.freeze({ ops: Object.freeze(["+", "-", "*"]),     max: 99 }),
    hard:   Object.freeze({ ops: Object.freeze(["+", "-", "*", "/"]), max: 99 }),
    expert: Object.freeze({ ops: Object.freeze(["+", "-", "*", "/"]), max: 150 })
  });

  /* Each equation: [direction, startRow, startCol]; it spans
     EQUATION_SPAN cells: number, operator, number, "=", number.
     The order in each list is a valid generation order (shared
     cells are filled before use). */
  const TEMPLATES = {
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

  function equationCells(dir, row, col) {
    let cells = [];
    for (let i = 0; i < CONFIG.EQUATION_SPAN; i++) {
      cells.push(dir === "H" ? { r: row, c: col + i } : { r: row + i, c: col });
    }
    return cells; // [num, op, num, eq, num]
  }

  function solveEquation(known, difficultyConfig) {
    let ops = util.shuffle(difficultyConfig.ops);
    for (let i = 0; i < ops.length; i++) {
      for (let t = 0; t < CONFIG.EQUATION_TRIES; t++) {
        let filled = Ops.table[ops[i]].fill(known, difficultyConfig.max);
        if (filled) { filled.op = ops[i]; return filled; }
      }
    }
    return null;
  }

  function valueOrNull(values, pos) {
    let value = values[cellKey(pos.r, pos.c)];
    return value != null ? value : null;
  }
  function storeSolution(values, pa, pb, pres, solution) {
    values[cellKey(pa.r, pa.c)] = solution.a;
    values[cellKey(pb.r, pb.c)] = solution.b;
    values[cellKey(pres.r, pres.c)] = solution.res;
  }
  /* Fill every equation of the template in order; null when one fails. */
  function buildEquations(difficulty, difficultyConfig) {
    let values = {};
    let equations = [];
    let list = TEMPLATES[difficulty];
    for (let i = 0; i < list.length; i++) {
      let cells = equationCells(list[i][0], list[i][1], list[i][2]);
      let pa = cells[0], pb = cells[2], pres = cells[4];
      let known = { a: valueOrNull(values, pa), b: valueOrNull(values, pb), res: valueOrNull(values, pres) };
      let solution = solveEquation(known, difficultyConfig);
      if (!solution) return null;
      storeSolution(values, pa, pb, pres, solution);
      equations.push({ dir: list[i][0], r: list[i][1], c: list[i][2], cells: cells, pa: pa, pb: pb, pres: pres, op: solution.op });
    }
    return { values: values, eqs: equations };
  }

  /* unique number cells -> list of equation indices they belong to */
  function buildMembership(equations) {
    let membership = {};
    equations.forEach(function (eq, idx) {
      [eq.pa, eq.pb, eq.pres].forEach(function (pos) {
        let k = cellKey(pos.r, pos.c);
        (membership[k] = membership[k] || []).push(idx);
      });
    });
    return membership;
  }
  /* the result cell of each equation — results are never given:
     the player always has to work out and fill in the answer */
  function resultKeysOf(equations) {
    let out = {};
    equations.forEach(function (eq) { out[cellKey(eq.pres.r, eq.pres.c)] = true; });
    return out;
  }
  function blanksFromGivens(allKeys, givens) {
    let blanks = {};
    allKeys.forEach(function (k) { if (!givens[k]) blanks[k] = true; });
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
  function randomGivens(candidates, membership) {
    let givens = {}, covered = {};
    util.shuffle(candidates).forEach(function (k) {
      let free = membership[k].every(function (ei) { return !covered[ei]; });
      if (!free) return;
      givens[k] = true;
      membership[k].forEach(function (ei) { covered[ei] = true; });
    });
    return givens;
  }
  /* Keep the largest valid set of givens found over many shuffled
     passes, so as many equations as possible keep their one given
     while no equation ever gets two. */
  function pickBlanks(equations) {
    let membership = buildMembership(equations);
    let allKeys = Object.keys(membership);
    let resultKeys = resultKeysOf(equations);
    let candidates = allKeys.filter(function (k) { return !resultKeys[k]; });
    let best = null;
    for (let attempt = 0; attempt < CONFIG.GIVENS_ATTEMPTS; attempt++) {
      let givens = randomGivens(candidates, membership);
      if (!best || Object.keys(givens).length > Object.keys(best).length) best = givens;
    }
    return best ? blanksFromGivens(allKeys, best) : null;
  }

  function generate(difficulty) {
    let difficultyConfig = DIFFICULTIES[difficulty];
    for (let attempt = 0; attempt < CONFIG.GENERATION_ATTEMPTS; attempt++) {
      let built = buildEquations(difficulty, difficultyConfig);
      if (!built) continue;
      let blanks = pickBlanks(built.eqs);
      if (blanks) return { values: built.values, eqs: built.eqs, blanks: blanks };
    }
    return null;
  }

  /* ---------- board model ---------- */
  function addCellToMap(cellMap, cell, index, eq, puzzle) {
    let k = cellKey(cell.r, cell.c);
    if (index === 1) cellMap[k] = { type: "op", symbol: Ops.symbolOf(eq.op) };
    else if (index === 3) cellMap[k] = { type: "eq", symbol: "=" };
    else if (!cellMap[k]) {
      cellMap[k] = { type: "num", answer: puzzle.values[k], blank: !!puzzle.blanks[k], filled: false, value: null, tileIdx: null };
    }
  }
  function buildCellMap(puzzle) {
    let cellMap = {};
    let rows = 0, cols = 0;
    puzzle.eqs.forEach(function (eq) {
      eq.cells.forEach(function (cell, index) {
        rows = Math.max(rows, cell.r + 1);
        cols = Math.max(cols, cell.c + 1);
        addCellToMap(cellMap, cell, index, eq, puzzle);
      });
    });
    return { cellMap: cellMap, rows: rows, cols: cols };
  }
  function maxDigitsOf(cellMap) {
    let maxDigits = 1;
    Object.keys(cellMap).forEach(function (k) {
      if (cellMap[k].type === "num") maxDigits = Math.max(maxDigits, String(cellMap[k].answer).length);
    });
    return maxDigits;
  }
  function blankKeysOf(cellMap) {
    let blankKeys = Object.keys(cellMap).filter(function (k) { return cellMap[k].type === "num" && cellMap[k].blank; });
    blankKeys.sort(function (x, y) {
      let a = x.split(",").map(Number), b = y.split(",").map(Number);
      return a[0] - b[0] || a[1] - b[1];
    });
    return blankKeys;
  }
  /* Tiles carry a stable id (their original bank position) so undo
     snapshots can name them in plain serialisable data. */
  function makeTiles(cellMap, blankKeys) {
    return util.shuffle(blankKeys.map(function (k) { return cellMap[k].answer; }))
      .map(function (value, index) { return { id: index, value: value, used: false, orig: index }; });
  }
  function buildBoard(puzzle) {
    let built = buildCellMap(puzzle);
    let blankKeys = blankKeysOf(built.cellMap);
    return {
      cellMap: built.cellMap,
      rows: built.rows,
      cols: built.cols,
      maxDigits: maxDigitsOf(built.cellMap),
      blankKeys: blankKeys,
      tiles: makeTiles(built.cellMap, blankKeys)
    };
  }

  MC.Puzzle = Object.freeze({
    difficulties: DIFFICULTIES,
    generate: generate,
    buildBoard: buildBoard
  });
})(window);
