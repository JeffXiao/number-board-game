/* 数学十字谜 — shell navigation.
   The app entry (index.html) hosts three views in one page — the
   main menu, the game, and the calendar — mirroring the standalone
   files main.html / game.html / calendar.html used when the game
   is hosted as separate pages. Hash routes pick the view:
   #/ -> menu, #/game -> game, #/calendar -> calendar, so the
   browser back button walks the same path the menu buttons take.
   The game itself is booted lazily (MC.bootGame, defined in
   main.js) the first time its view opens, so its timer and board
   sizing only start once the board is actually visible. */
(function (global) {
  "use strict";

  const VIEWS = { main: "viewMain", game: "viewGame", calendar: "viewCalendar" };
  const ROUTES = { "": "main", "/": "main", "/game": "game", "/calendar": "calendar" };

  let currentView = null;
  let gameBooted = false;

  function routeFromHash() {
    let path = global.location.hash.replace(/^#/, "");
    return ROUTES[path] || "main";
  }

  function pauseGameIfRunning() {
    /* leaving the game mid-round: tap the game's own pause button
       so the timer waits while the player is in the menu */
    let pauseButton = document.getElementById("pauseBtn");
    if (pauseButton && !pauseButton.classList.contains("paused")) pauseButton.click();
  }

  function showView(name) {
    if (currentView === "game" && name !== "game" && gameBooted) pauseGameIfRunning();
    currentView = name;
    Object.keys(VIEWS).forEach(function (key) {
      let section = document.getElementById(VIEWS[key]);
      if (section) section.classList.toggle("hidden", key !== name);
    });
    if (name === "calendar" && global.MC && global.MC.showCalendar) global.MC.showCalendar();
    if (name === "game") {
      if (!gameBooted) {
        gameBooted = true;
        if (global.MC && global.MC.bootGame) global.MC.bootGame();
      }
      /* a calendar tap may be carrying a Daily date with it:
         hand it to the game now that its view is open */
      if (global.MC && global.MC.enterGameView) global.MC.enterGameView();
      /* the board was sized while hidden or not at all: refit its
         type now that it has a real width (the view listens for
         window resize) */
      global.requestAnimationFrame(function () {
        global.dispatchEvent(new Event("resize"));
      });
    }
    global.scrollTo(0, 0);
  }

  global.addEventListener("hashchange", function () { showView(routeFromHash()); });
  showView(routeFromHash());
})(window);
