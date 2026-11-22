/* 数学十字谜 — view module.
   Renders the game and owns every DOM interaction pattern the
   web-development skill requires:
   - event delegation: one click/pointerdown listener on #board and
     one on #bank, dispatching on data-key / data-idx — never a
     listener per cell or tile;
   - targeted updates: a sync diffs each cell/tile against what it
     last rendered and touches only the nodes that changed. Full
     builds happen only on a new puzzle, a difficulty change, or a
     language change;
   - presentation through CSS classes and custom properties only
     (--cols, --board-font, confetti variables) — no layout styles
     written from JS. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  function createView(dependencies) {
    const game = dependencies.game;
    const audio = dependencies.audio;
    const i18n = dependencies.i18n;
    const els = dependencies.elements;
    const translate = i18n.translate;

    let cellElements = {};      /* key -> element (blank cells only change) */
    let lastCellRender = {};    /* key -> "class|text|aria" last applied */
    let tileElements = [];      /* aligned with state.tiles order */
    let boardSignature = null;
    let bankSignature = null;
    let lastFontPx = null;
    let toastTimer = null;
    let dropTargetKey = null;

    /* ---------- small DOM helpers ---------- */
    function setTextById(id, text) {
      let el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    function setButtonLabel(el, text) {
      if (!el) return;
      el.setAttribute("aria-label", text);
      el.title = text;
    }

    /* ---------- board building (full build: new puzzle / language) ---------- */
    function makeEmptyCellEl() {
      let el = document.createElement("div");
      el.className = "cell empty";
      return el;
    }
    function makeStaticCellEl(cell) {
      let el = document.createElement("div");
      el.className = "cell " + (cell.type === "num" ? "given" : cell.type);
      el.textContent = cell.type === "num" ? cell.answer : cell.symbol;
      return el;
    }
    function blankCellClass(cell, wrong, k, selectedKey) {
      return "cell blank" + (cell.filled ? " filled" : "") +
        (cell.filled && wrong[k] ? " wrong" : "") +
        (selectedKey === k && !cell.filled ? " selected" : "");
    }
    function blankCellAria(cell) {
      return cell.filled ? translate("filledCell")(cell.value) : translate("emptyCell");
    }
    function makeBlankCellEl(k) {
      let el = document.createElement("button");
      el.type = "button";
      el.dataset.key = k;
      return el;
    }
    function buildBoard() {
      let s = game.state();
      boardSignature = game.roundId() + ":" + s.rows + "x" + s.cols + ":" + i18n.language();
      els.board.innerHTML = "";
      cellElements = {};
      lastCellRender = {};
      els.board.style.setProperty("--cols", String(s.cols));
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
          let k = MC.util.cellKey(r, c);
          let cell = s.cellMap[k];
          let el;
          if (!cell) el = makeEmptyCellEl();
          else if (cell.type === "num" && cell.blank) { el = makeBlankCellEl(k); cellElements[k] = el; }
          else el = makeStaticCellEl(cell);
          els.board.appendChild(el);
        }
      }
      updateCells();
      fitBoardFont();
    }
    /* ---------- targeted cell updates ---------- */
    function updateCells() {
      let s = game.state();
      let wrong = game.wrongKeys();
      Object.keys(cellElements).forEach(function (k) {
        let cell = s.cellMap[k];
        let el = cellElements[k];
        let className = blankCellClass(cell, wrong, k, s.selected);
        let text = cell.filled ? String(cell.value) : "";
        let aria = blankCellAria(cell);
        let signature = className + "|" + text + "|" + aria;
        if (lastCellRender[k] === signature) return;
        lastCellRender[k] = signature;
        el.className = className;
        el.textContent = text;
        el.setAttribute("aria-label", aria);
      });
    }
    function cellElement(k) { return cellElements[k] || null; }
    function setDropTarget(k) {
      if (dropTargetKey === k) return;
      if (dropTargetKey && cellElements[dropTargetKey]) cellElements[dropTargetKey].classList.remove("drop-target");
      dropTargetKey = k;
      if (k && cellElements[k]) cellElements[k].classList.add("drop-target");
    }

    /* ---------- tile bank ---------- */
    function currentBankSignature(s) {
      return s.tiles.map(function (tile) { return tile.id + "=" + tile.value; }).join(",") + ":" + i18n.language();
    }
    function buildBank() {
      let s = game.state();
      bankSignature = currentBankSignature(s);
      /* bank layout via custom properties, like the board's --cols:
         one row of tiles spanning the full board width when the
         count stays tappable (<= 11), otherwise two balanced rows;
         --bank-cols-sm caps a row at six tiles on narrow screens */
      let count = s.tiles.length;
      let cols = count > 11 ? Math.ceil(count / 2) : count;
      let smallRows = Math.ceil(count / 6);
      els.bank.style.setProperty("--bank-cols", String(cols));
      els.bank.style.setProperty("--bank-cols-sm", String(Math.ceil(count / smallRows)));
      els.bank.innerHTML = "";
      tileElements = s.tiles.map(function (tile, index) {
        let el = document.createElement("button");
        el.type = "button";
        el.className = "tile num" + (tile.used ? " used" : "");
        el.textContent = tile.value;
        el.dataset.idx = index;
        el.setAttribute("aria-label", translate("tileLabel")(tile.value));
        els.bank.appendChild(el);
        return el;
      });
    }
    function updateTiles() {
      let s = game.state();
      s.tiles.forEach(function (tile, index) {
        let el = tileElements[index];
        if (el) el.classList.toggle("used", tile.used);
      });
    }

    /* ---------- status bar, buttons, overlays ---------- */
    function updateStatus() {
      let s = game.state();
      els.mistakes.textContent = s.mistakes + "/" + CONFIG.MAX_MISTAKES;
      els.mistakes.classList.toggle("bad", s.mistakes > 0);
      els.hints.textContent = s.hints;
      els.timer.textContent = game.formatTime(s.seconds);
      els.progress.textContent = translate("progress")(game.filledCount(), s.blankKeys.length);
      els.undo.disabled = !game.canUndo();
      let paused = game.isPaused();
      els.pause.classList.toggle("paused", paused);
      els.pause.setAttribute("aria-pressed", paused ? "true" : "false");
      setButtonLabel(els.pause, paused ? translate("resume") : translate("pauseLabel"));
      let sortedNow = game.isSorted();
      els.sort.setAttribute("aria-pressed", sortedNow ? "true" : "false");
      setButtonLabel(els.sort, sortedNow ? translate("sortRestoreLabel") : translate("sortLabel"));
    }
    function updateOverlays() {
      els.pauseOverlay.classList.toggle("show", game.isPaused());
      els.resetConfirm.classList.toggle("show", game.isConfirmOpen());
      let over = game.isOver();
      els.endOverlay.classList.toggle("show", over);
      if (!over) return;
      if (game.endKind() === "win") {
        els.endTitle.textContent = translate("winTitle");
        let s = game.state();
        els.endText.textContent = translate("winText")(game.formatTime(s.seconds), s.mistakes, s.hints);
        els.retry.classList.add("hidden");
      } else {
        els.endTitle.textContent = translate("mistakeTitle");
        els.endText.textContent = translate("mistakeText");
        els.retry.classList.remove("hidden");
      }
    }
    function updateSoundButton() {
      let enabled = audio.isEnabled();
      els.sound.setAttribute("aria-pressed", enabled ? "true" : "false");
      setButtonLabel(els.sound, enabled ? translate("soundOffLabel") : translate("soundOnLabel"));
    }

    /* ---------- fullscreen ----------
       The button is always shown. An earlier version hid it when
       document.fullscreenEnabled was false — but that is exactly
       what the sandboxed app frame reports, so the icon vanished
       where the game is actually played. Tapping tries the real
       Fullscreen API first; the state is read back from
       document.fullscreenElement (on fullscreenchange), so leaving
       with Esc or the browser UI restores the expand glyph too.
       Where the API is missing or the request is denied — a frame
       without fullscreen permission — the tap falls back to an
       expanded in-page mode: the game fills the whole frame, and
       the same button (or Esc) collapses it back. */
    let expandedFallback = false;
    function isFullscreen() { return !!document.fullscreenElement; }
    function fullscreenActive() { return isFullscreen() || expandedFallback; }
    function updateFullscreenButton() {
      if (!els.fullscreen) return;
      let active = fullscreenActive();
      els.fullscreen.setAttribute("aria-pressed", active ? "true" : "false");
      document.body.classList.toggle("is-fullscreen", active);
      document.body.classList.toggle("is-expanded", expandedFallback);
      setButtonLabel(els.fullscreen, active ? translate("fullscreenExitLabel") : translate("fullscreenLabel"));
    }
    function syncFullscreenButton() {
      /* never hidden — see the note above */
      updateFullscreenButton();
    }
    function setExpandedFallback(on) {
      expandedFallback = on;
      updateFullscreenButton();
      /* the layout just changed size: refit the board type once
         the browser has settled the new layout */
      global.setTimeout(fitBoardFont, 0);
    }
    function toggleFullscreen() {
      if (isFullscreen()) {
        if (!document.exitFullscreen) return;
        try {
          let exiting = document.exitFullscreen();
          if (exiting && exiting.catch) exiting.catch(function () { /* denied: stay as we are */ });
        } catch (error) { /* denied: stay as we are */ }
        return;
      }
      if (expandedFallback) { setExpandedFallback(false); return; }
      let request = document.documentElement && document.documentElement.requestFullscreen;
      if (!request) { setExpandedFallback(true); return; }
      try {
        let entering = request.call(document.documentElement);
        if (entering && entering.catch) {
          entering.catch(function () { setExpandedFallback(true); });
        }
      } catch (error) { setExpandedFallback(true); }
    }
    function onFullscreenChange() {
      updateFullscreenButton();
      /* the viewport just changed size: refit the board type once
         the browser has settled the new layout */
      global.setTimeout(fitBoardFont, 0);
    }
    function onFullscreenKeydown(event) {
      /* Esc leaves the expanded fallback, mirroring native fullscreen */
      if (expandedFallback && (event.key === "Escape" || event.key === "Esc")) {
        setExpandedFallback(false);
      }
    }

    /* ---------- board font sizing (dynamic value via custom property) ---------- */
    function fitBoardFont() {
      if (!game.hasState()) return;
      let width = els.board.clientWidth;
      if (!width) return;
      let s = game.state();
      let cellWidth = width / s.cols;
      /* three-digit answers (expert) get a smaller factor so they fit the cell */
      let wide = s.maxDigits >= CONFIG.WIDE_DIGIT_COUNT;
      let factor = wide ? CONFIG.FONT_FACTOR_WIDE : CONFIG.FONT_FACTOR;
      let minPx = wide ? CONFIG.FONT_MIN_WIDE_PX : CONFIG.FONT_MIN_PX;
      let px = Math.max(minPx, Math.min(CONFIG.FONT_MAX_PX, cellWidth * factor));
      if (px === lastFontPx) return;
      lastFontPx = px;
      els.board.style.setProperty("--board-font", px + "px");
    }

    /* ---------- effects: toast, shake, confetti ---------- */
    function showToast(message) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      if (toastTimer) global.clearTimeout(toastTimer);
      toastTimer = global.setTimeout(function () { els.toast.classList.remove("show"); }, CONFIG.TOAST_MS);
    }
    function shakeCells(keys) {
      keys.forEach(function (k) {
        let el = cellElements[k];
        if (!el) return;
        el.classList.add("shake");
        global.setTimeout(function () { el.classList.remove("shake"); }, CONFIG.SHAKE_MS);
      });
    }
    function spawnConfetti() {
      if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let colors = CONFIG.CONFETTI_COLORS;
      for (let i = 0; i < CONFIG.CONFETTI_COUNT; i++) {
        let bit = document.createElement("div");
        bit.className = "confetti-bit";
        bit.style.setProperty("--x", (CONFIG.CONFETTI_LEFT_MIN_PCT + Math.random() * CONFIG.CONFETTI_LEFT_SPAN_PCT) + "%");
        bit.style.setProperty("--color", colors[i % colors.length]);
        bit.style.setProperty("--dur", (CONFIG.CONFETTI_DURATION_BASE_S + Math.random() * CONFIG.CONFETTI_DURATION_SPAN_S) + "s");
        bit.style.setProperty("--delay", (Math.random() * CONFIG.CONFETTI_DELAY_SPAN_S) + "s");
        els.boardShell.appendChild(bit);
        (function (node) {
          global.setTimeout(function () { node.remove(); }, CONFIG.CONFETTI_REMOVE_MS);
        })(bit);
      }
    }
    function applyEffects(effects) {
      if (effects.shakeKeys) shakeCells(effects.shakeKeys);
      if (effects.toast) showToast(effects.toast);
      if (effects.confetti) spawnConfetti();
    }

    /* ---------- the one render entry point ---------- */
    function sync(effects) {
      effects = effects || {};
      if (!game.hasState()) return;
      let s = game.state();
      let signature = game.roundId() + ":" + s.rows + "x" + s.cols + ":" + i18n.language();
      if (effects.rebuild || signature !== boardSignature) buildBoard();
      else { updateCells(); fitBoardFont(); }
      if (currentBankSignature(s) !== bankSignature) buildBank();
      else updateTiles();
      updateStatus();
      updateOverlays();
      applyEffects(effects);
    }

    /* ---------- language ---------- */
    function applyLanguage() {
      document.title = translate("title");
      document.documentElement.lang = translate("htmlLang");
      setTextById("labelMistakes", translate("mistakes"));
      setTextById("labelTime", translate("time"));
      setTextById("labelHints", translate("hints"));
      let diffGroup = document.getElementById("diffGroup");
      if (diffGroup) diffGroup.setAttribute("aria-label", translate("difficulty"));
      document.querySelectorAll(".difficulties button").forEach(function (button) {
        button.textContent = translate(button.dataset.diff);
      });
      setTextById("pauseTitle", translate("pausedTitle"));
      setTextById("pauseText", translate("pausedText"));
      setTextById("resumeBtn", translate("resume"));
      setTextById("retryBtn", translate("retry"));
      setTextById("againBtn", translate("again"));
      setTextById("resetConfirmTitle", translate("resetTitle"));
      setTextById("resetConfirmText", translate("resetText"));
      setTextById("resetYesBtn", translate("yes"));
      setTextById("resetNoBtn", translate("no"));
      setTextById("bankTitle", translate("bankTitle"));
      els.board.setAttribute("aria-label", translate("boardLabel"));
      els.bank.setAttribute("aria-label", translate("bankLabel"));
      setButtonLabel(els.reset, translate("resetLabel"));
      setButtonLabel(els.hint, translate("hintLabel"));
      els.hint.title = translate("hintTitle");
      setButtonLabel(els.undo, translate("undoLabel"));
      setButtonLabel(els.langButton, translate("langLabel"));
      setTextById("langCode", translate("code"));
      document.querySelectorAll("#langMenu button").forEach(function (button) {
        button.setAttribute("aria-checked", button.dataset.lang === i18n.language() ? "true" : "false");
      });
      updateSoundButton();
      syncFullscreenButton();
      boardSignature = null; /* aria labels live on cells/tiles: force one full build */
      bankSignature = null;
      sync({});
    }

    /* ---------- delegated interaction ---------- */
    /* the drag machine calls back into the view for drop-target highlighting */
    const drag = MC.createDragMachine({
      game: game,
      view: { setDropTarget: setDropTarget, cellElement: cellElement },
      bankEl: els.bank
    });
    function attachInteractions() {
      els.board.addEventListener("click", function (event) {
        let cellButton = event.target.closest ? event.target.closest("[data-key]") : null;
        if (!cellButton) return;
        if (drag.consumeClick()) return;
        game.tapCell(cellButton.dataset.key);
      });
      els.board.addEventListener("pointerdown", function (event) {
        let cellButton = event.target.closest ? event.target.closest("[data-key]") : null;
        if (!cellButton) return;
        drag.pointerDownCell(event, cellButton.dataset.key, cellButton);
      });
      els.bank.addEventListener("click", function (event) {
        let tileEl = event.target.closest ? event.target.closest("[data-idx]") : null;
        if (!tileEl) return;
        if (drag.consumeClick()) return;
        game.placeTile(Number(tileEl.dataset.idx));
      });
      els.bank.addEventListener("pointerdown", function (event) {
        let tileEl = event.target.closest ? event.target.closest("[data-idx]") : null;
        if (!tileEl) return;
        drag.pointerDownTile(event, Number(tileEl.dataset.idx), tileEl);
      });
      drag.attach();
      global.addEventListener("resize", fitBoardFont);
      document.addEventListener("fullscreenchange", onFullscreenChange);
      document.addEventListener("keydown", onFullscreenKeydown);
      syncFullscreenButton();
    }

    return Object.freeze({
      sync: sync,
      applyLanguage: applyLanguage,
      attachInteractions: attachInteractions,
      updateSoundButton: updateSoundButton,
      toggleFullscreen: toggleFullscreen,
      updateFullscreenButton: updateFullscreenButton,
      fitBoardFont: fitBoardFont,
      cellElement: cellElement,
      setDropTarget: setDropTarget
    });
  }

  MC.createView = createView;
})(window);
