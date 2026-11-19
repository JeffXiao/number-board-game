/* 数学十字谜 — operation table + small shared utilities.
   ONE table serves generation (fill), judging (holds) and the
   solver (needed): each operator carries its display symbol and its
   three pure behaviours, so no parallel switch/if dispatch exists
   anywhere else. Judging is symmetric wherever the operation is:
   + and × in the two operands, ÷ in divisor and quotient
   (18÷9=2 and 18÷2=9 both hold, since both say 18 = divisor × quotient). */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  /* ---------- utilities (written once, reused everywhere) ---------- */
  function randomInt(min, max) {
    if (max < min) return null;
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function shuffle(list) {
    let copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
    }
    return copy;
  }
  function divisorsIn(n, lo, hi) {
    let out = [];
    for (let d = lo; d <= hi; d++) if (n % d === 0) out.push(d);
    return out;
  }
  /* A random factor pair of n with both factors in FACTOR_MIN..FACTOR_MAX, or null. */
  function factorPairOf(n) {
    let divisors = divisorsIn(n, CONFIG.FACTOR_MIN, CONFIG.FACTOR_MAX).filter(function (d) {
      let q = n / d;
      return q >= CONFIG.FACTOR_MIN && q <= CONFIG.FACTOR_MAX;
    });
    if (!divisors.length) return null;
    let d = divisors[Math.floor(Math.random() * divisors.length)];
    return { a: d, b: n / d };
  }
  function cellKey(row, col) { return row + "," + col; }

  MC.util = Object.freeze({
    randomInt: randomInt,
    shuffle: shuffle,
    divisorsIn: divisorsIn,
    factorPairOf: factorPairOf,
    cellKey: cellKey
  });

  /* ---------- the operation table ----------
     fill(known, max): complete a op b = res given some known values
       (null = unknown); returns {a,b,res} within bounds, or null.
     holds(a, b, res): does the completed equation hold?
     needed(a, b, res): with exactly one of the three unknown, the
       raw value it must take (validated by neededValue below). */
  const OPERATIONS = {
    "+": {
      symbol: "+",
      holds: function (a, b, res) { return a + b === res; },
      needed: function (a, b, res) { return a == null ? res - b : (b == null ? res - a : a + b); },
      fill: function (known, max) {
        let a = known.a, b = known.b, res = known.res, picked;
        /* all three already set by crossing equations: keep them only if they agree */
        if (a != null && b != null && res != null) return a + b === res ? { a: a, b: b, res: res } : null;
        if (a != null && b != null) res = a + b;
        else if (a != null && res != null) b = res - a;
        else if (b != null && res != null) a = res - b;
        else if (res != null) { picked = randomInt(1, res - 1); if (picked == null) return null; a = picked; b = res - a; }
        else if (a != null) { picked = randomInt(1, max - a); if (picked == null) return null; b = picked; res = a + b; }
        else if (b != null) { picked = randomInt(1, max - b); if (picked == null) return null; a = picked; res = a + b; }
        else { a = randomInt(2, Math.floor(max * CONFIG.PLUS_FIRST_MAX_RATIO)); b = randomInt(2, max - a); if (b == null) return null; res = a + b; }
        if (a >= 1 && b >= 1 && res >= 1 && res <= max && a + b === res) return { a: a, b: b, res: res };
        return null;
      }
    },
    "-": {
      symbol: "−",
      holds: function (a, b, res) { return a - b === res; },
      needed: function (a, b, res) { return a == null ? b + res : (b == null ? a - res : a - b); },
      fill: function (known, max) {
        let a = known.a, b = known.b, res = known.res, picked;
        if (a != null && b != null && res != null) return a - b === res ? { a: a, b: b, res: res } : null;
        if (a != null && b != null) res = a - b;
        else if (a != null && res != null) b = a - res;
        else if (b != null && res != null) a = b + res;
        else if (a != null) { picked = randomInt(1, a - 1); if (picked == null) return null; b = picked; res = a - b; }
        else if (b != null) { picked = randomInt(1, max - b); if (picked == null) return null; res = picked; a = b + res; }
        else if (res != null) { picked = randomInt(1, max - res); if (picked == null) return null; b = picked; a = b + res; }
        else { b = randomInt(2, Math.min(CONFIG.MINUS_B_MAX, max - 1)); res = randomInt(1, max - b); if (res == null) return null; a = b + res; }
        if (a >= 1 && b >= 1 && res >= 1 && a <= max && a - b === res) return { a: a, b: b, res: res };
        return null;
      }
    },
    "*": {
      symbol: "×",
      holds: function (a, b, res) { return a * b === res; },
      needed: function (a, b, res) {
        if (a == null) { if (!b || res % b !== 0) return null; return res / b; }
        if (b == null) { if (!a || res % a !== 0) return null; return res / a; }
        return a * b;
      },
      fill: function (known, max) {
        let a = known.a, b = known.b, res = known.res, picked, pair;
        if (a != null && b != null && res != null) return a * b === res ? { a: a, b: b, res: res } : null;
        if (a != null && b != null) res = a * b;
        else if (a != null && res != null) { if (res % a !== 0) return null; b = res / a; }
        else if (b != null && res != null) { if (res % b !== 0) return null; a = res / b; }
        else if (a != null) { picked = randomInt(CONFIG.TIMES_PICK_MIN, CONFIG.TIMES_PICK_MAX); if (picked == null) return null; b = picked; res = a * b; }
        else if (b != null) { picked = randomInt(CONFIG.TIMES_PICK_MIN, CONFIG.TIMES_PICK_MAX); if (picked == null) return null; a = picked; res = a * b; }
        else if (res != null) { pair = factorPairOf(res); if (!pair) return null; a = pair.a; b = pair.b; }
        else { a = randomInt(CONFIG.TIMES_PICK_MIN, CONFIG.TIMES_PICK_MAX); b = randomInt(CONFIG.TIMES_PICK_MIN, CONFIG.TIMES_PICK_MAX); res = a * b; }
        return (a >= CONFIG.FACTOR_MIN && a <= CONFIG.FACTOR_MAX && b >= CONFIG.FACTOR_MIN && b <= CONFIG.FACTOR_MAX && res <= max && a * b === res)
          ? { a: a, b: b, res: res } : null;
      }
    },
    "/": {
      symbol: "÷",
      holds: function (a, b, res) { return b !== 0 && a === b * res; },
      needed: function (a, b, res) {
        if (a == null) return b * res;
        if (b == null) { if (!res || a % res !== 0) return null; return a / res; }
        if (!b || a % b !== 0) return null;
        return a / b;
      },
      fill: function (known, max) {
        let a = known.a, b = known.b, res = known.res, picked, pair;
        if (a != null && b != null && res != null) return (b !== 0 && a === b * res) ? { a: a, b: b, res: res } : null;
        if (a != null && b != null) { if (b === 0 || a % b !== 0) return null; res = a / b; }
        else if (a != null && res != null) { if (res === 0 || a % res !== 0) return null; b = a / res; }
        else if (b != null && res != null) a = b * res;
        else if (a != null) { pair = factorPairOf(a); if (!pair) return null; b = pair.a; res = pair.b; }
        else if (b != null) { picked = randomInt(CONFIG.FACTOR_MIN, CONFIG.FACTOR_MAX); res = picked; a = b * res; }
        else if (res != null) { picked = randomInt(CONFIG.FACTOR_MIN, CONFIG.FACTOR_MAX); b = picked; a = b * res; }
        else { b = randomInt(CONFIG.FACTOR_MIN, CONFIG.FACTOR_MAX); res = randomInt(CONFIG.FACTOR_MIN, CONFIG.FACTOR_MAX); a = b * res; }
        return (b >= CONFIG.FACTOR_MIN && b <= CONFIG.FACTOR_MAX && res >= CONFIG.FACTOR_MIN && res <= CONFIG.FACTOR_MAX && a <= max && a === b * res)
          ? { a: a, b: b, res: res } : null;
      }
    }
  };

  /* With exactly one of a/b/res unknown, the value it must take
     (a positive integer), or null when no such value exists. */
  function neededValue(op, a, b, res) {
    let value = OPERATIONS[op].needed(a, b, res);
    return (value != null && value >= 1) ? value : null;
  }
  function equationHolds(op, a, b, res) { return OPERATIONS[op].holds(a, b, res); }
  function symbolOf(op) { return OPERATIONS[op].symbol; }

  MC.Ops = Object.freeze({
    table: OPERATIONS,
    neededValue: neededValue,
    holds: equationHolds,
    symbolOf: symbolOf
  });
})(window);
