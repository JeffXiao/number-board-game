/* 数学十字谜 — entry point.
   Builds the modules, wires the top-bar / bank / overlay controls to
   the state owner's actions, and starts the first puzzle. All game
   logic lives in the modules; this file only connects them. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;
  const i18n = MC.i18n;
  const audio = MC.audio;

  function element(id) { return document.getElementById(id); }

  const elements = {
    board: element("board"),
    bank: element("bank"),
    boardShell: element("boardShell"),
    toast: element("toast"),
    mistakes: element("mistakes"),
    timer: element("timer"),
    hints: element("hints"),
    progress: element("progress"),
    pauseOverlay: element("pauseOverlay"),
    endOverlay: element("endOverlay"),
    resetConfirm: element("resetConfirmOverlay"),
    endTitle: element("endTitle"),
    endText: element("endText"),
    endSolutionWrap: element("endSolutionWrap"),
    endSolution: element("endSolution"),
    retry: element("retryBtn"),
    again: element("againBtn"),
    gameBack: element("gameBackLink"),
    pause: element("pauseBtn"),
    sort: element("sortBtn"),
    undo: element("undoBtn"),
    sound: element("soundBtn"),
    hint: element("hintBtn"),
    reset: element("resetBtn"),
    fullscreen: element("fullscreenBtn"),
    langButton: element("langBtn")
  };

  const game = MC.createGame({
    puzzle: MC.Puzzle,
    solver: MC.Solver,
    audio: audio,
    translate: i18n.translate,
    onDailyWin: function (key) { if (MC.Daily) MC.Daily.markDone(key); }
  });
  const view = MC.createView({
    game: game,
    audio: audio,
    i18n: i18n,
    elements: elements
  });
  game.setListener(function (effects) { view.sync(effects); });
  view.attachInteractions();

  /* ---------- controls: the game's top bar and bank, plus the
     sound switch, which lives on the landing page ---------- */
  elements.sound.addEventListener("click", function () {
    audio.toggle(); /* toggling on plays a chip click as confirmation (in audio.js) */
    view.updateSoundButton();
  });
  elements.undo.addEventListener("click", function () { game.undo(); });
  elements.sort.addEventListener("click", function () { game.toggleSort(); });
  elements.pause.addEventListener("click", function () { game.togglePause(); });
  elements.hint.addEventListener("click", function () { game.useHint(); });
  elements.fullscreen.addEventListener("click", function () { view.toggleFullscreen(); });
  element("resumeBtn").addEventListener("click", function () { game.resume(); });

  /* ---------- end overlay ---------- */
  element("againBtn").addEventListener("click", function () {
    /* "New puzzle" always starts a practice round (no daily key),
       at the round's difficulty — that becomes the remembered
       practice difficulty too */
    let difficulty = game.difficulty();
    saveDifficultyChoice("practice", difficulty);
    game.newGame(difficulty);
  });
  elements.retry.addEventListener("click", function () { game.restartSame(); });

  /* ---------- reset confirmation ----------
     Tapping the reset icon never restarts the round at once: it
     opens the in-page confirmation. Yes resets; No closes the
     dialog and leaves the game completely untouched. While it is
     open the timer waits and all other controls ignore input
     (the state owner tracks that). */
  elements.reset.addEventListener("click", function () { game.openConfirm(); });
  element("resetYesBtn").addEventListener("click", function () { game.confirmReset(); });
  element("resetNoBtn").addEventListener("click", function () { game.closeConfirm(); });

  /* ---------- remembered difficulty ----------
     The last difficulty chosen in each mode persists in
     localStorage — the same storage the language choice and the
     finished Daily dates already use — so the next visit opens
     each mode where the player left it: Daily deals its puzzle
     at the remembered Daily difficulty, and Main starts at the
     remembered practice difficulty. A first visit (or a stored
     value that is no longer a difficulty) falls back to the
     configured defaults. */
  function readDifficultyChoices() {
    let choices = { daily: CONFIG.DAILY_DIFFICULTY, practice: CONFIG.DEFAULT_DIFFICULTY };
    try {
      let saved = JSON.parse(global.localStorage.getItem(CONFIG.DIFFICULTY_STORAGE_KEY) || "{}");
      if (saved && MC.Puzzle.difficulties[saved.daily]) choices.daily = saved.daily;
      if (saved && MC.Puzzle.difficulties[saved.practice]) choices.practice = saved.practice;
    } catch (error) { /* storage unavailable: play at the defaults */ }
    return choices;
  }
  let difficultyChoices = readDifficultyChoices();
  function difficultyChoice(mode) { return difficultyChoices[mode]; }
  function saveDifficultyChoice(mode, difficulty) {
    if (!MC.Puzzle.difficulties[difficulty]) return;
    difficultyChoices[mode] = difficulty;
    try {
      global.localStorage.setItem(CONFIG.DIFFICULTY_STORAGE_KEY, JSON.stringify(difficultyChoices));
    } catch (error) { /* storage unavailable: the choice lasts for this visit only */ }
  }

  /* ---------- difficulty ---------- */
  document.querySelectorAll(".difficulties button").forEach(function (button) {
    button.addEventListener("click", function () {
      if (game.isConfirmOpen()) return;
      let difficulty = button.dataset.diff;
      document.querySelectorAll(".difficulties button").forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      /* the tap is a choice for the mode of the round on screen:
         in a Daily round it re-deals that date's puzzle at the
         new difficulty and is remembered as the Daily difficulty;
         in Main it starts a fresh practice puzzle and is
         remembered as the practice difficulty */
      let dailyKey = game.dailyKey();
      if (dailyKey) {
        saveDifficultyChoice("daily", difficulty);
        game.newGame(difficulty, dailyKey);
      } else {
        saveDifficultyChoice("practice", difficulty);
        game.newGame(difficulty);
      }
    });
  });

  /* ---------- language menu ---------- */
  const langMenu = element("langMenu");
  function closeLangMenu() {
    langMenu.classList.remove("show");
    elements.langButton.setAttribute("aria-expanded", "false");
  }
  function toggleLangMenu() {
    let open = langMenu.classList.toggle("show");
    elements.langButton.setAttribute("aria-expanded", open ? "true" : "false");
  }
  elements.langButton.addEventListener("click", function (event) {
    event.stopPropagation();
    toggleLangMenu();
  });
  document.querySelectorAll("#langMenu button").forEach(function (button) {
    button.addEventListener("click", function () {
      if (i18n.setLanguage(button.dataset.lang)) view.applyLanguage();
      closeLangMenu();
    });
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".lang-wrap")) closeLangMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeLangMenu();
  });
  /* the language button sits on the landing page now, on screen
     before the game ever boots (bootGame's applyLanguage only runs
     when the game view first opens): reflect the stored choice on
     the button and the menu right away. Switching later still goes
     through view.applyLanguage, which re-syncs both. */
  element("langCode").textContent = i18n.translate("code");
  /* the landing-page heading likewise shows the game's name in
     the stored language right away, not both languages */
  let homeTitleEl = element("homeTitle");
  if (homeTitleEl) homeTitleEl.textContent = i18n.translate("title");
  /* the menu cards follow the stored language too, from the
     first paint — no mixed languages on the landing page */
  let menuDailyLabelEl = element("menuDailyLabel");
  if (menuDailyLabelEl) menuDailyLabelEl.textContent = i18n.translate("menuDaily");
  let menuDailyDescEl = element("menuDailyDesc");
  if (menuDailyDescEl) menuDailyDescEl.textContent = i18n.translate("menuDailyDesc");
  let menuMainLabelEl = element("menuMainLabel");
  if (menuMainLabelEl) menuMainLabelEl.textContent = i18n.translate("menuMain");
  let menuMainDescEl = element("menuMainDesc");
  if (menuMainDescEl) menuMainDescEl.textContent = i18n.translate("menuMainDesc");
  let menuListEl = element("menuList");
  if (menuListEl) menuListEl.setAttribute("aria-label", i18n.translate("menuChoose"));
  document.querySelectorAll("#langMenu button").forEach(function (button) {
    button.setAttribute("aria-checked", button.dataset.lang === i18n.language() ? "true" : "false");
  });

  /* ---------- register: a player name on this device ----------
     The Register button at the bottom of the landing page opens
     a popup where the player enters their name. MC.Player keeps
     the registered names in localStorage — the same storage the
     language, difficulties and finished Daily dates use; a web
     page cannot write a file to the device directly. No
     duplicate name is allowed: before saving, the entered name
     is checked against the names already registered, and a name
     that is taken shows an error inside the popup (and is not
     saved) so the player can try a different one. Every string
     follows the chosen language, like the rest of the page.
     Once a name is registered on this device the user is
     recognized, so the Register button is no longer shown —
     renderRegister hides it and only the names list remains. */
  const registerOverlay = element("registerOverlay");
  const registerForm = element("registerForm");
  const playerNameInput = element("playerNameInput");
  const registerError = element("registerError");
  function showRegisterError(message) {
    if (!registerError) return;
    registerError.textContent = message;
    registerError.classList.remove("hidden");
    if (playerNameInput) playerNameInput.setAttribute("aria-invalid", "true");
  }
  function clearRegisterError() {
    if (registerError) { registerError.textContent = ""; registerError.classList.add("hidden"); }
    if (playerNameInput) playerNameInput.removeAttribute("aria-invalid");
  }
  function renderRegister() {
    let registered = MC.Player ? MC.Player.list() : [];
    /* a recognized registered user needs no Register button:
       once a name is saved on this device, the button stays
       hidden and only the names list below shows. With no name
       registered yet, the button is there to tap. */
    let registerBtnEl = element("registerBtn");
    if (registerBtnEl) registerBtnEl.classList.toggle("hidden", registered.length > 0);
    let btnLabel = element("registerBtnLabel");
    if (btnLabel) btnLabel.textContent = i18n.translate("register");
    let title = element("registerTitle");
    if (title) title.textContent = i18n.translate("registerTitle");
    let nameLabel = element("registerNameLabel");
    if (nameLabel) nameLabel.textContent = i18n.translate("registerLabel");
    if (playerNameInput) playerNameInput.placeholder = i18n.translate("registerPlaceholder");
    let hint = element("registerHint");
    if (hint) hint.textContent = i18n.translate("registerHint");
    let saveBtn = element("registerSaveBtn");
    if (saveBtn) saveBtn.textContent = i18n.translate("registerSave");
    let cancelBtn = element("registerCancelBtn");
    if (cancelBtn) cancelBtn.textContent = i18n.translate("registerCancel");
    let list = element("playerList");
    if (list && MC.Player) {
      if (registered.length) {
        list.textContent = i18n.translate("registeredPlayers") + ": " + registered.join(", ");
        list.classList.remove("hidden");
      } else {
        list.textContent = "";
        list.classList.add("hidden");
      }
    }
  }
  function openRegister() {
    if (!registerOverlay) return;
    clearRegisterError();
    if (playerNameInput) playerNameInput.value = "";
    registerOverlay.classList.add("show");
    if (playerNameInput) playerNameInput.focus();
  }
  function closeRegister() {
    if (!registerOverlay) return;
    registerOverlay.classList.remove("show");
    let btn = element("registerBtn");
    if (btn) btn.focus();
  }
  let registerBtn = element("registerBtn");
  if (registerBtn) registerBtn.addEventListener("click", openRegister);
  let registerCancelBtn = element("registerCancelBtn");
  if (registerCancelBtn) registerCancelBtn.addEventListener("click", closeRegister);
  if (registerOverlay) registerOverlay.addEventListener("click", function (event) {
    /* a tap on the dimmed backdrop (not the dialog itself) closes */
    if (event.target === registerOverlay) closeRegister();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && registerOverlay && registerOverlay.classList.contains("show")) closeRegister();
  });
  if (playerNameInput) playerNameInput.addEventListener("input", clearRegisterError);
  if (registerForm) registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!MC.Player || !playerNameInput) return;
    let name = playerNameInput.value.trim();
    if (!name) {
      showRegisterError(i18n.translate("registerEmpty"));
      playerNameInput.focus();
      return;
    }
    if (MC.Player.isTaken(name)) {
      /* already registered: error inside the popup, nothing
         saved, the popup stays open for a different name */
      showRegisterError(i18n.translate("registerTaken"));
      playerNameInput.focus();
      playerNameInput.select();
      return;
    }
    if (!MC.Player.add(name)) {
      showRegisterError(i18n.translate("registerTaken"));
      return;
    }
    closeRegister();
    renderRegister();
  });
  /* a language switch re-labels the button, the popup and the
     registered-names list in place — view.applyLanguage calls
     this, the same way it refreshes the calendar */
  MC.refreshRegister = renderRegister;
  renderRegister();

  /* ---------- daily puzzles & Main practice ----------
     The calendar hands a date key to MC.playDaily; the key waits
     here until the game view is on screen (nav.js calls
     MC.enterGameView when it opens), then deals that date's
     seeded puzzle at the daily difficulty. A date that is already
     finished, or still in the future, is never dealt.
     The menu's Main card likewise hands over a practice request
     (MC.playPractice): entering through Main ALWAYS deals a
     fresh random puzzle at the remembered practice difficulty,
     whatever round was on the board before — a finished Daily,
     an abandoned Daily, or an earlier practice round. */
  let pendingDailyKey = null;
  let pendingPractice = false;
  function markDifficultyPressed(difficulty) {
    document.querySelectorAll(".difficulties button").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.diff === difficulty ? "true" : "false");
    });
  }
  function startPendingDaily() {
    if (!pendingDailyKey) return;
    let key = pendingDailyKey;
    pendingDailyKey = null;
    pendingPractice = false; /* the Daily tap is the latest intent */
    /* the date's puzzle is dealt at the remembered Daily
       difficulty (the configured daily default on a first visit) */
    let difficulty = difficultyChoice("daily");
    markDifficultyPressed(difficulty);
    game.newGame(difficulty, key);
  }
  MC.playDaily = function (key) {
    if (!MC.Daily || !MC.Daily.isPlayable(key)) return;
    pendingDailyKey = key;
    if (global.location.hash === "#/game") startPendingDaily();
    else global.location.hash = "#/game";
  };
  MC.enterGameView = function () {
    if (pendingDailyKey) { startPendingDaily(); return; }
    if (!pendingPractice) return;
    /* The player clicked Main: always start a brand-new practice
       game, at the remembered practice difficulty — never reopen
       whatever round was last on the board. */
    pendingPractice = false;
    let difficulty = difficultyChoice("practice");
    markDifficultyPressed(difficulty);
    game.newGame(difficulty);
  };
  MC.playPractice = function () {
    pendingDailyKey = null; /* the Main tap is the latest intent */
    pendingPractice = true;
    if (global.location.hash === "#/game") MC.enterGameView();
  };
  /* the menu's Main card is the one practice entry point: wire
     its tap to MC.playPractice (its "#/game" href then opens the
     game view, and nav.js hands over to MC.enterGameView) */
  let mainCard = document.querySelector('.menu-card[href="#/game"]');
  if (mainCard) mainCard.addEventListener("click", function () { MC.playPractice(); });

  /* ---------- start ----------
     In the app shell (index.html) the game sits behind the main
     menu, so the first puzzle is dealt lazily: nav.js calls
     MC.bootGame() the first time the game view opens, and the
     timer only starts then. The standalone game.html has no menu
     view, so it boots immediately, exactly as before. */
  let booted = false;
  MC.bootGame = function () {
    if (booted) return;
    booted = true;
    if (pendingDailyKey) startPendingDaily();
    else if (pendingPractice) {
      /* a Main tap brought us here: MC.enterGameView, which
         nav.js calls immediately after boot, deals the fresh
         practice puzzle — dealing one here too would waste it */
    }
    else {
      /* Main opens at the remembered practice difficulty (the
         configured default on a first visit) */
      let difficulty = difficultyChoice("practice");
      markDifficultyPressed(difficulty);
      game.newGame(difficulty);
    }
    view.applyLanguage();
  };
  if (!element("viewMain")) {
    /* standalone game.html: a ?daily=YYYY-MM-DD link from the
       standalone calendar page deals that date's puzzle instead
       of a random one */
    let dailyParam = null;
    try { dailyParam = new URLSearchParams(global.location.search).get("daily"); } catch (error) { dailyParam = null; }
    if (dailyParam && MC.Daily && MC.Daily.isPlayable(dailyParam)) pendingDailyKey = dailyParam;
    MC.bootGame();
  }
})(window);
