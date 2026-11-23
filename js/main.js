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
    translate: i18n.translate
  });
  const view = MC.createView({
    game: game,
    audio: audio,
    i18n: i18n,
    elements: elements
  });
  game.setListener(function (effects) { view.sync(effects); });
  view.attachInteractions();

  /* ---------- top bar & bank controls ---------- */
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
  element("againBtn").addEventListener("click", function () { game.newGame(game.difficulty()); });
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

  /* ---------- difficulty ---------- */
  document.querySelectorAll(".difficulties button").forEach(function (button) {
    button.addEventListener("click", function () {
      if (game.isConfirmOpen()) return;
      document.querySelectorAll(".difficulties button").forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      game.newGame(button.dataset.diff);
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

  /* ---------- start ---------- */
  game.newGame(CONFIG.DEFAULT_DIFFICULTY);
  view.applyLanguage();
})(window);
