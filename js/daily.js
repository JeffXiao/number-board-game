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
  /* The most recent date before fromKey that has not been
     practiced yet — the nearest earlier day that is not
     finished. (Being earlier than fromKey, which in use is a
     completed date and so never in the future, the result is
     never a future date either.) After a Daily round is
     completed, Continue points the calendar at this date so
     the player can tap it next and keep working backwards
     through the days they missed. The walk is bounded by
     CONFIG.DAILY_LOOKBACK_DAYS; when every day in that span is
     finished there is nothing to point at and it returns null,
     as it does for a key that is not a real date. The
     predicate-taking form is the pure core, so unit tests can
     pin the walk against a fixed finished set;
     previousUnfinishedKey judges against the real one. */
  function previousUnfinishedBefore(fromKey, isDoneFn) {
    let from = dateForKey(fromKey);
    if (!from) return null;
    let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (let i = 0; i < CONFIG.DAILY_LOOKBACK_DAYS; i++) {
      cursor.setDate(cursor.getDate() - 1);
      let key = keyForDate(cursor);
      if (!isDoneFn(key)) return key;
    }
    return null;
  }
  function previousUnfinishedKey(fromKey) {
    return previousUnfinishedBefore(fromKey, isDone);
  }
  /* The one date the calendar points at as the next to play:
     today itself, while today has not been finished yet — the
     player plays today's puzzle first — and only once today is
     finished, the nearest earlier unfinished day. So there is
     always exactly one date to point at, never two: the
     calendar never highlights today and another day at once
     (the player's report: two highlighted dates on the
     November 2026 calendar — the 28th framed as today and the
     26th ringed as the previous unpracticed day). The
     predicate-taking form is the pure core, so unit tests can
     pin the choice against a fixed finished set;
     nextDateToPlay judges against the real one. */
  function nextDateToPlayFrom(isDoneFn) {
    let todayK = todayKey();
    if (!isDoneFn(todayK)) return todayK;
    return previousUnfinishedBefore(todayK, isDoneFn);
  }
  function nextDateToPlay() {
    return nextDateToPlayFrom(isDone);
  }

  MC.Daily = Object.freeze({
    keyForDate: keyForDate,
    dateForKey: dateForKey,
    todayKey: todayKey,
    isFutureKey: isFutureKey,
    seedForKey: seedForKey,
    isDone: isDone,
    markDone: markDone,
    isPlayable: isPlayable,
    previousUnfinishedKey: previousUnfinishedKey,
    previousUnfinishedBefore: previousUnfinishedBefore,
    nextDateToPlay: nextDateToPlay,
    nextDateToPlayFrom: nextDateToPlayFrom
  });
})(window);
