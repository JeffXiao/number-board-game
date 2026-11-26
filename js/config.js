/* 数学十字谜 — frozen configuration.
   Every magic number in the game lives here, named once. Modules read
   these values; nothing else in the codebase hard-codes a tunable. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});

  MC.CONFIG = Object.freeze({
    /* play */
    MAX_MISTAKES: 3,
    HISTORY_LIMIT: 100,
    DEFAULT_DIFFICULTY: "medium",
    LANG_STORAGE_KEY: "math-crossword-lang",
    DEFAULT_LANG: "en",

    /* daily puzzles: one seeded puzzle per calendar date; the
       finished dates persist alongside the language choice */
    DAILY_STORAGE_KEY: "math-crossword-daily-done",
    DAILY_DIFFICULTY: "medium",

    /* the last difficulty chosen in each mode — Daily and Main
       practice — persists in localStorage under this key (a JSON
       object { daily, practice }); DEFAULT_DIFFICULTY and
       DAILY_DIFFICULTY above are the first-visit fallbacks */
    DIFFICULTY_STORAGE_KEY: "math-crossword-difficulty",

    /* timing / feedback */
    TIMER_INTERVAL_MS: 1000,
    TOAST_MS: 1700,
    SHAKE_MS: 350,
    FLASH_MS: 380,

    /* generation */
    GENERATION_ATTEMPTS: 300,
    GIVENS_ATTEMPTS: 200,
    EQUATION_TRIES: 30,
    EQUATION_SPAN: 5,
    OPERAND_MIN: 1,
    FACTOR_MIN: 2,
    FACTOR_MAX: 12,
    TIMES_PICK_MIN: 2,
    TIMES_PICK_MAX: 9,
    MINUS_B_MAX: 20,
    PLUS_FIRST_MAX_RATIO: 0.6,

    /* solver */
    SOLVER_NODE_LIMIT: 60000,

    /* board sizing / typography */
    CELL_MAX_PX: 58,
    FONT_FACTOR: 0.56,
    FONT_FACTOR_WIDE: 0.44,
    FONT_MIN_PX: 15,
    FONT_MIN_WIDE_PX: 13,
    FONT_MAX_PX: 34,
    WIDE_DIGIT_COUNT: 3,

    /* drag */
    DRAG_THRESHOLD_PX: 7,

    /* confetti */
    CONFETTI_COUNT: 26,
    CONFETTI_REMOVE_MS: 2400,
    CONFETTI_LEFT_MIN_PCT: 4,
    CONFETTI_LEFT_SPAN_PCT: 92,
    CONFETTI_DURATION_BASE_S: 0.9,
    CONFETTI_DURATION_SPAN_S: 0.9,
    CONFETTI_DELAY_SPAN_S: 0.35,
    CONFETTI_COLORS: Object.freeze(["#d97706", "#16a34a", "#f1cf7e", "#79b78d", "#e2603f"]),

    /* audio (Web Audio synthesis; see audio.js) */
    AUDIO: Object.freeze({
      MASTER_GAIN: 0.9,
      NOISE_SECONDS: 0.1,
      START_OFFSET_S: 0.01,
      WIN_START_OFFSET_S: 0.05,
      CHIP_FILTER_FREQ: 2600,
      CHIP_FILTER_Q: 1.1,
      CHIP_GAIN: 0.5,
      CHIP_DECAY_S: 0.045,
      CHIP_STOP_S: 0.06,
      SECOND_CLACK_DELAY_S: 0.075,
      TONE_FILTER_FREQ: 5200,
      TONE_ATTACK_S: 0.012,
      TONE_TAIL_S: 0.05,
      COIN_FIRST_FREQ: 1318.51, /* E6 */
      COIN_FIRST_AT_S: 0.06,
      COIN_FIRST_DUR_S: 0.1,
      COIN_FIRST_VOL: 0.07,
      COIN_SECOND_FREQ: 1760.0, /* A6 */
      COIN_SECOND_AT_S: 0.15,
      COIN_SECOND_DUR_S: 0.3,
      COIN_SECOND_VOL: 0.08,
      WIN_STEP_S: 0.155,
      WIN_ARPEGGIO: Object.freeze([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]),
      WIN_ARPEGGIO_VOL: 0.24,
      WIN_LAST_NOTE_FACTOR: 2.4,
      WIN_NOTE_FACTOR: 1.5,
      WIN_SPARKLE: Object.freeze([659.25, 783.99, 1046.5, 1318.51]),
      WIN_SPARKLE_VOL: 0.05,
      WIN_SPARKLE_DUR_FACTOR: 0.8,
      WIN_CHORD: Object.freeze([523.25, 659.25, 783.99, 1046.5]),
      WIN_CHORD_DUR_S: 1.1,
      WIN_CHORD_VOL: 0.13,
      WIN_CHORD_SPARKLE_FREQ: 1567.98,
      WIN_CHORD_SPARKLE_AT_S: 0.12,
      WIN_CHORD_SPARKLE_DUR_S: 0.9,
      WIN_CHORD_SPARKLE_VOL: 0.07,
      WIN_CHORD_GAP_S: 0.05
    })
  });
})(window);
