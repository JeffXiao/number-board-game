/* 数学十字谜 — player registry module.
   Owns the registered player names: just names kept on this
   device in localStorage, the same way the game already stores
   the language choice, the remembered difficulties and the
   finished Daily dates — no account, nothing leaves the device
   (a web page cannot write a file to the device directly).
   Names are stored as a JSON array under one key. A name may
   only be registered once: add() checks the entered name
   against the names already registered (ignoring surrounding
   spaces and letter case) and refuses a duplicate, so the
   caller can show the error and let the player try another. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  function normalize(name) {
    return String(name == null ? "" : name).trim().toLocaleLowerCase();
  }
  function clean(name) {
    return String(name == null ? "" : name).trim().slice(0, CONFIG.PLAYER_NAME_MAX_LENGTH);
  }

  function readNames() {
    try {
      let raw = global.localStorage.getItem(CONFIG.PLAYER_STORAGE_KEY);
      if (!raw) return [];
      try {
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(function (name) { return typeof name === "string" && clean(name); })
            .map(clean);
        }
      } catch (error) { /* not JSON: fall through to the plain-name case */ }
      /* a lone plain name stored by an earlier build still counts
         as one registered name */
      let single = clean(raw);
      return single ? [single] : [];
    } catch (error) { return []; }
  }
  function persistNames(names) {
    try {
      global.localStorage.setItem(CONFIG.PLAYER_STORAGE_KEY, JSON.stringify(names));
    } catch (error) { /* storage unavailable: the name lasts for this visit only */ }
  }

  let names = readNames();

  MC.Player = Object.freeze({
    /* the registered names, oldest first (a copy — callers
       cannot mutate the registry through it) */
    list: function () { return names.slice(); },
    /* is this name already registered? The comparison ignores
       surrounding spaces and letter case, so "Jeff", "jeff" and
       " Jeff " are the same name */
    isTaken: function (name) {
      let wanted = normalize(name);
      if (!wanted) return false;
      return names.some(function (existing) { return normalize(existing) === wanted; });
    },
    /* register a name: returns the cleaned name on success, or
       null when the name is empty or already taken */
    add: function (name) {
      let cleaned = clean(name);
      if (!cleaned || MC.Player.isTaken(cleaned)) return null;
      names.push(cleaned);
      persistNames(names);
      return cleaned;
    }
  });
})(window);
