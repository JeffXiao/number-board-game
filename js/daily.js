/* 数学十字谜 — daily puzzle module.
   Owns everything about the Daily mode: the calendar date keys
   ("YYYY-MM-DD" in local time), the deterministic seed each date
   maps to (so a date always deals the same puzzle), and the set
   of finished dates. Finished dates persist in localStorage —
   the same storage the game already uses for the language choice,
   at the player's request that the choice sticks — so a day the
   player completed stays completed, and its calendar cell stays
   disabled and gray, on the next visit too. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function keyForDate(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }
  function dateForKey(key) {
    let parts = String(key).split("-").map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !isFinite(n); })) return null;
    let date = new Date(parts[0], parts[1] - 1, parts[2]);
    return keyForDate(date) === key ? date : null;
  }
  function todayKey() { return keyForDate(new Date()); }
  /* zero-padded keys compare correctly as plain strings */
  function isFutureKey(key) { return key > todayKey(); }
  function seedForKey(key) {
    let date = dateForKey(key);
    if (!date) return 0;
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

  function readDone() {
    try {
      let saved = JSON.parse(global.localStorage.getItem(CONFIG.DAILY_STORAGE_KEY) || "[]");
      let done = {};
      if (Array.isArray(saved)) saved.forEach(function (k) { if (dateForKey(k)) done[k] = true; });
      return done;
    } catch (error) { return {}; }
  }
  let doneDates = readDone();
  function isDone(key) { return !!doneDates[key]; }
  function markDone(key) {
    if (!dateForKey(key) || doneDates[key]) return;
    doneDates[key] = true;
    try {
      global.localStorage.setItem(CONFIG.DAILY_STORAGE_KEY, JSON.stringify(Object.keys(doneDates).sort()));
    } catch (error) { /* storage unavailable: the day stays done for this visit */ }
  }
  /* a date can be played when it is a real date, not in the
     future, and not already finished */
  function isPlayable(key) {
    return !!dateForKey(key) && !isFutureKey(key) && !isDone(key);
  }

  MC.Daily = Object.freeze({
    keyForDate: keyForDate,
    dateForKey: dateForKey,
    todayKey: todayKey,
    isFutureKey: isFutureKey,
    seedForKey: seedForKey,
    isDone: isDone,
    markDone: markDone,
    isPlayable: isPlayable
  });
})(window);
