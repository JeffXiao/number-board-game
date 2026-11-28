/* 数学十字谜 — unit tests.
   A tiny dependency-free harness plus the suites for the most
   recent rule changes:

   1. Calendar bold dates — today and every earlier date render
      bold (the "past" class); future dates keep regular weight.
      The tests call the real predicate the renderer uses
      (MC.Calendar.isPastOrTodayOn, exposed by calendar.js) and
      also check the rendered month grid cell by cell — the grid
      the real renderCalendar produces: in the page that is the
      live #calGrid; in a headless run with no DOM to render
      into, a minimal element fixture (below) stands in for the
      document so renderCalendar still renders for real and the
      test inspects its actual output. The stylesheet check
      reads the .cal-day.past rule through the CSSOM in the
      page, and headlessly parses the very stylesheet text
      calendar.js injects into the page (MC.Calendar.dayCssText)
      — the same source either way, never a copy.

   2. Cumulative mistakes — a counted mistake is never un-counted
      by taking a tile back or by undo; mistakes add up to 5/5,
      the round is then lost and cannot be undone back into play,
      and "Try again" (restartSame) restarts the SAME arrangement
      at 0/5. The tests drive the real state owner (MC.createGame)
      on a fixed one-equation board — 7 × □ = □ with tiles 8, 50
      and 56 — replaying the reported scenario: 7 × 8 = 50 counts
      1/5, and taking the 50 back must leave the counter at 1/5.

   3. Daily completion — once a Daily round is won, the end
      overlay offers a Continue button (back to the calendar)
      and the top-left back arrow is removed. Both are driven by
      the one verdict the view reads, game.isDailyWin(), so the
      tests pin that verdict on the real state owner: true only
      for a won round that carries a daily key — never for a
      practice win, a daily loss, or a round still in play — and
      check the Continue button itself in the page's markup.

   4. Landing page — no Unit tests link — the landing page
      (viewMain) carries no link or button to the tests and no
      "Unit tests" text at all, while the suite itself still
      exists: the #/tests view (viewTests) stays in the page,
      outside the landing view, and MC.runUnitTests /
      MC.showTests still run it via the #/tests route.

   5. Registration gate — playing requires a registered name:
      while MC.Player has no name, the gate main.js exposes
      (MC.RegistrationGate) blocks entry, a tap on the Daily or
      Practice card opens the register popup instead of
      navigating and leaves the tapped mode waiting as the
      pending destination, and cancelling the popup drops that
      destination. Once a name is registered the gate lets
      every tap straight through. The tests branch on the
      device's actual registry state and pin the correct
      behaviour for that state, so they pass whether or not a
      name is already saved on the device running them — and
      they never register a name themselves.

   6. Continue to the previous unpracticed date — after a
      Daily round is completed, Continue sends the player back
      to the calendar landed on the previous date that has not
      been practiced yet: the nearest earlier unfinished day,
      computed by the Daily module's walk
      (MC.Daily.previousUnfinishedBefore, the pure core the
      real previousUnfinishedKey judges with) and shown by the
      calendar when main.js names it through
      MC.setCalendarTarget — that date's month on show, the
      date itself highlighted ("suggested") and tappable. The
      walk tests pin the day arithmetic against fixed finished
      sets; the calendar test drives the real target plumbing
      and hands the calendar back to a plain opening afterwards
      (whose own landing suite 8 pins).

   7. Chosen date kept and highlighted — the date the player
      chooses on the calendar (a tap on a day cell, which calls
      the same chooseDate MC.setCalendarChosen wraps) is kept
      by calendar.js (MC.Calendar.chosenKey) and highlighted
      ("chosen") whenever its month is on show: stepping to the
      previous month and back with the calendar's own buttons
      never drops it, and reopening the calendar lands back on
      the chosen date's month instead of resetting to the
      current month. The tests drive the real plumbing through
      MC.setCalendarChosen / MC.showCalendar and the real
      prev/next buttons, and clear the choice afterwards so the
      plain opening the other suites rely on is restored.

   8. Daily button highlights the next date to play — tapping
      Daily (a plain calendar opening: no Continue target
      named, no chosen date kept) must itself point at the one
      next date to play: today itself while today is not done,
      and only once today is done the nearest earlier
      unfinished day (MC.Daily.nextDateToPlay). showCalendar
      lands on its month and rings its cell ("suggested"),
      tappable. The tests derive the expectation from the real
      finished set, so they pin the wiring for whatever state
      the device is in; they also pin the landing order around
      it — a still-playable chosen date keeps its landing, and
      a Continue target still wins over the automatic
      suggestion.

   9. One highlighted date — the calendar never highlights two
      dates at once (the player's report: on the November 2026
      calendar the 28th showed framed as today and the 26th was
      ringed as the previous unpracticed day, both at once).
      The pure choice (MC.Daily.nextDateToPlayFrom) is pinned
      against fixed finished sets: today unfinished names
      today; today finished names the nearest earlier
      unfinished day; everything finished leaves nothing. And
      on a plain opening the rendered month carries exactly
      one highlighted cell — the suggested one — while today
      carries no frame of its own: its "today" style no longer
      draws a border, and the frame (ring and accent border)
      lives on the suggested/chosen rule alone.

   The suites run in the page: open #/tests directly — there
   is no link to it on the landing page. MC.runUnitTests is
   also exposed so the same suites can be driven headlessly;
   pass a suite name to run only that suite. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});

  /* ================= tiny harness ================= */
  const tests = [];
  function test(suite, name, fn) { tests.push({ suite: suite, name: name, fn: fn }); }
  function fail(message) { throw new Error(message); }
  function assertTrue(value, message) { if (value !== true) fail(message || ("expected true, got " + value)); }
  function assertFalse(value, message) { if (value !== false) fail(message || ("expected false, got " + value)); }
  function assertEqual(actual, expected, message) {
    if (actual !== expected) fail((message || "values differ") + " — expected " + expected + ", got " + actual);
  }
  function assertDeepEqual(actual, expected, message) {
    let a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) fail((message || "values differ") + " — expected " + e + ", got " + a);
  }

  function runUnitTests(onlySuite) {
    let results = [];
    tests.forEach(function (entry) {
      if (onlySuite && entry.suite !== onlySuite) return;
      try {
        entry.fn();
        results.push({ suite: entry.suite, name: entry.name, pass: true, error: null });
      } catch (error) {
        results.push({ suite: entry.suite, name: entry.name, pass: false, error: String(error && error.message ? error.message : error) });
      }
    });
    return results;
  }

  /* ================= headless DOM fixture =================
     In the page, the calendar tests use the real document. In a
     headless run whose document stub has no calendar elements
     at all, there is nothing for the real renderCalendar to
     render into — so the tests install this minimal element
     fixture as the document's element factory and id registry,
     and renderCalendar builds its grid out of these elements
     exactly as it builds it out of real ones. The fixture only
     models the DOM surface calendar.js touches (children,
     className/classList, dataset, attributes, textContent);
     every rendering decision stays in calendar.js, and the
     grid test below inspects the fixture grid the same way it
     inspects the live one. In the page the fixture never
     installs: #calGrid already exists there. */
  function FakeElement(tag) {
    let self = this;
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.disabled = false;
    this.type = "";
    this._classes = new Set();
    this._text = "";
    this.classList = {
      add: function () { for (let i = 0; i < arguments.length; i++) self._classes.add(arguments[i]); },
      remove: function (name) { self._classes.delete(name); },
      contains: function (name) { return self._classes.has(name); },
      toggle: function (name, force) {
        let want = force === undefined ? !self._classes.has(name) : !!force;
        if (want) self._classes.add(name); else self._classes.delete(name);
        return want;
      }
    };
    Object.defineProperty(this, "className", {
      get: function () { return Array.from(self._classes).join(" "); },
      set: function (value) {
        self._classes = new Set(String(value || "").split(/\s+/).filter(Boolean));
      }
    });
    Object.defineProperty(this, "textContent", {
      get: function () { return self._text; },
      set: function (value) {
        self._text = value == null ? "" : String(value);
        if (self._text === "") self.children.length = 0;
      }
    });
  }
  FakeElement.prototype.appendChild = function (child) { this.children.push(child); return child; };
  FakeElement.prototype.setAttribute = function (name, value) { this.attributes[name] = String(value); };
  FakeElement.prototype.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  };
  FakeElement.prototype.addEventListener = function () {};

  let domFixtureInstalled = false;
  function installDomFixture() {
    if (domFixtureInstalled) return;
    domFixtureInstalled = true;
    let byId = {
      calTitle: new FakeElement("h2"),
      calGrid: new FakeElement("div")
    };
    let originalGetElementById = document.getElementById;
    document.getElementById = function (id) {
      if (Object.prototype.hasOwnProperty.call(byId, id)) return byId[id];
      return originalGetElementById ? originalGetElementById.call(document, id) : null;
    };
    document.createElement = function (tag) { return new FakeElement(tag); };
  }
  if (typeof document !== "undefined" && document.getElementById && !document.getElementById("calGrid")) {
    installDomFixture();
  }

  /* a tiny brace-aware CSS rule reader, for the headless
     stylesheet check: it parses the actual stylesheet text
     (MC.Calendar.dayCssText — the text calendar.js injects
     into the page) into selector/body pairs, recursing into
     @media blocks */
  function parseCssRules(cssText) {
    let text = String(cssText).replace(/\/\*[\s\S]*?\*\//g, "");
    let rules = [];
    let i = 0;
    while (i < text.length) {
      let open = text.indexOf("{", i);
      if (open === -1) break;
      let selector = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      let body = text.slice(open + 1, j - 1);
      if (selector.charAt(0) === "@") rules = rules.concat(parseCssRules(body));
      else if (selector) rules.push({ selector: selector.replace(/\s+/g, " "), body: body });
      i = j;
    }
    return rules;
  }
  function cssFontWeight(body) {
    let match = /font-weight\s*:\s*([^;]+)/.exec(body);
    return match ? match[1].trim() : "";
  }

  /* ================= suite 1: calendar bold dates ================= */
  const CAL = "Calendar bold dates";
  /* a pinned "today": Saturday 28 November 2026, mid-afternoon —
     the time of day must not change any verdict */
  const PINNED_TODAY = new Date(2026, 10, 28, 15, 30);

  test(CAL, "yesterday counts as past (bold)", function () {
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2026, 10, 27), PINNED_TODAY));
  });
  test(CAL, "today counts as past at both ends of the day (bold)", function () {
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2026, 10, 28, 0, 0), PINNED_TODAY), "start of today");
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2026, 10, 28, 23, 59), PINNED_TODAY), "end of today");
  });
  test(CAL, "tomorrow is future (not bold)", function () {
    assertFalse(MC.Calendar.isPastOrTodayOn(new Date(2026, 10, 29, 0, 1), PINNED_TODAY));
  });
  test(CAL, "an earlier month is past and a later month is future", function () {
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2026, 9, 31), PINNED_TODAY), "Oct 31");
    assertFalse(MC.Calendar.isPastOrTodayOn(new Date(2026, 11, 1), PINNED_TODAY), "Dec 1");
  });
  test(CAL, "the rule holds across a year boundary", function () {
    let newYear = new Date(2027, 0, 1, 9, 0);
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2026, 11, 31), newYear), "Dec 31 2026 vs Jan 1 2027");
    assertTrue(MC.Calendar.isPastOrTodayOn(new Date(2027, 0, 1), newYear), "Jan 1 itself");
    assertFalse(MC.Calendar.isPastOrTodayOn(new Date(2027, 0, 2), newYear), "Jan 2 2027");
  });
  test(CAL, "every cell of the rendered month carries 'past' exactly when its date is today or earlier", function () {
    MC.showCalendar(); /* freshly rendered, on whatever month the opening lands */
    let grid = document.getElementById("calGrid");
    let title = document.getElementById("calTitle");
    assertTrue(!!grid && !!title, "calendar grid and title exist");
    let now = new Date();
    /* the month on show, read back from the rendered title:
       an opening may land on the previous unpracticed date's
       month rather than the current one */
    let shown = null;
    for (let offset = -14; offset <= 2 && !shown; offset++) {
      let candidate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      if (title.textContent === candidate.toLocaleDateString(MC.i18n.translate("locale") || "en-US",
        { month: "long", year: "numeric" })) shown = candidate;
    }
    assertTrue(!!shown, "the title names a month near today (" + title.textContent + ")");
    let first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    let cursor = new Date(shown.getFullYear(), shown.getMonth(), 1 - first.getDay());
    assertTrue(grid.children.length > 0, "grid has cells");
    for (let i = 0; i < grid.children.length; i++) {
      let date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      let expected = MC.Calendar.isPastOrTodayOn(date, now);
      assertEqual(grid.children[i].classList.contains("past"), expected,
        "cell " + i + " (" + date.toDateString() + ") past class");
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  test(CAL, "the stylesheet bolds .cal-day.past and does not bold future days", function () {
    let pastWeight = null, futureWeight = null;
    /* in the page: read the live stylesheets through the CSSOM —
       the day-cell rules are the <style> calendar.js injected */
    for (let s = 0; s < document.styleSheets.length; s++) {
      let rules;
      try { rules = document.styleSheets[s].cssRules; } catch (error) { continue; }
      if (!rules) continue;
      for (let r = 0; r < rules.length; r++) {
        if (rules[r].selectorText === ".cal-day.past") pastWeight = rules[r].style.fontWeight;
        if (rules[r].selectorText === "button.cal-day.done, button.cal-day.future" ||
            rules[r].selectorText === ".cal-day.future") futureWeight = rules[r].style.fontWeight;
      }
    }
    if (pastWeight === null && MC.Calendar && typeof MC.Calendar.dayCssText === "string") {
      /* headless: no CSSOM exists to read, so parse the very
         stylesheet text calendar.js injects into the page —
         the same source, checked the same way */
      let rules = parseCssRules(MC.Calendar.dayCssText);
      for (let r = 0; r < rules.length; r++) {
        if (rules[r].selector === ".cal-day.past") pastWeight = cssFontWeight(rules[r].body);
        if (rules[r].selector === "button.cal-day.done, button.cal-day.future" ||
            rules[r].selector === ".cal-day.future") futureWeight = cssFontWeight(rules[r].body);
      }
    }
    assertTrue(pastWeight === "700" || pastWeight === "bold", ".cal-day.past is bold (found: " + pastWeight + ")");
    assertTrue(futureWeight !== "700" && futureWeight !== "bold", "future days are not bolded (found: " + futureWeight + ")");
  });

  /* ================= suite 2: cumulative mistakes ================= */
  const MIS = "Cumulative mistakes";
  const KEY_A = "0,2";   /* the □ in 7 × □ */
  const KEY_RES = "0,4"; /* the □ after = */

  /* one fixed equation, 7 × □ = □, with the screenshot's tiles:
     8 (correct operand), 50 (the wrong result), 56 (the correct
     result). buildBoard returns a fresh board on every call, the
     way the real Puzzle module does. */
  function makeTestGame(onDailyWin) {
    let eq = {
      dir: "H", r: 0, c: 0, op: "*",
      cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }],
      pa: { r: 0, c: 0 }, pb: { r: 0, c: 2 }, pres: { r: 0, c: 4 }
    };
    let puzzleStub = {
      generate: function () { return { values: { "0,0": 7, "0,2": 8, "0,4": 56 }, eqs: [eq], blanks: { "0,2": true, "0,4": true } }; },
      buildBoard: function () {
        return {
          cellMap: {
            "0,0": { type: "num", answer: 7, blank: false, filled: false, value: null, tileIdx: null },
            "0,1": { type: "op", symbol: "×" },
            "0,2": { type: "num", answer: 8, blank: true, filled: false, value: null, tileIdx: null },
            "0,3": { type: "eq", symbol: "=" },
            "0,4": { type: "num", answer: 56, blank: true, filled: false, value: null, tileIdx: null }
          },
          rows: 1, cols: 5, maxDigits: 2,
          blankKeys: [KEY_A, KEY_RES],
          tiles: [
            { id: 0, value: 8, used: false, orig: 0 },
            { id: 1, value: 50, used: false, orig: 1 },
            { id: 2, value: 56, used: false, orig: 2 }
          ]
        };
      }
    };
    let game = MC.createGame({
      puzzle: puzzleStub,
      solver: MC.Solver,
      audio: { playChip: function () {}, playWin: function () {} },
      translate: MC.i18n.translate,
      onDailyWin: onDailyWin || null
    });
    game.setListener(function () {});
    game.newGame("medium");
    return game;
  }
  function place(game, value, key) {
    let tiles = game.state().tiles;
    for (let i = 0; i < tiles.length; i++) {
      if (!tiles[i].used && tiles[i].value === value) { game.placeTileAt(i, key); return; }
    }
    fail("no unused tile with value " + value);
  }
  function mistakesOf(game) { return game.state().mistakes; }
  /* the reported scenario: 7 × 8 = 50 — one completed, wrong equation */
  function makeOneMistake(game) {
    place(game, 8, KEY_A);
    place(game, 50, KEY_RES);
  }

  test(MIS, "an incomplete equation counts no mistake", function () {
    let game = makeTestGame();
    place(game, 50, KEY_RES); /* a lone result: nothing to judge yet */
    assertEqual(mistakesOf(game), 0);
    assertFalse(game.isOver(), "round still running");
  });
  test(MIS, "completing 7 × 8 = 50 counts exactly one mistake", function () {
    let game = makeTestGame();
    place(game, 8, KEY_A);
    assertEqual(mistakesOf(game), 0, "still incomplete before the result lands");
    place(game, 50, KEY_RES);
    assertEqual(mistakesOf(game), 1);
    assertFalse(game.isOver(), "round continues at 1/5");
  });
  test(MIS, "taking the wrong tile back keeps the count at 1/5", function () {
    let game = makeTestGame();
    makeOneMistake(game);
    game.takeBack(KEY_RES);
    assertEqual(game.state().cellMap[KEY_RES].filled, false, "the 50 is back in the bank");
    assertEqual(mistakesOf(game), 1, "the mistake stays counted");
  });
  test(MIS, "undoing the wrong placement keeps the count at 1/5", function () {
    let game = makeTestGame();
    makeOneMistake(game);
    game.undo();
    assertEqual(game.state().cellMap[KEY_RES].filled, false, "undo removed the 50");
    assertEqual(mistakesOf(game), 1, "undo never rewinds the mistake count");
  });
  test(MIS, "mistakes accumulate across take-backs: 1/5, 2/5, 3/5, 4/5, 5/5", function () {
    let game = makeTestGame();
    makeOneMistake(game);
    assertEqual(mistakesOf(game), 1);
    game.takeBack(KEY_RES);
    place(game, 50, KEY_RES);
    assertEqual(mistakesOf(game), 2, "breaking the same equation again counts again");
    game.takeBack(KEY_RES);
    assertEqual(mistakesOf(game), 2, "the second take-back keeps 2/5 too");
    place(game, 50, KEY_RES);
    assertEqual(mistakesOf(game), 3);
    assertFalse(game.isOver(), "the round survives 3/5 — the old limit no longer ends it");
    game.takeBack(KEY_RES);
    place(game, 50, KEY_RES);
    assertEqual(mistakesOf(game), 4);
    assertFalse(game.isOver(), "the round is still alive at 4/5");
    game.takeBack(KEY_RES);
    assertEqual(mistakesOf(game), 4, "the fourth take-back keeps 4/5 too");
    place(game, 50, KEY_RES);
    assertEqual(mistakesOf(game), 5);
  });
  test(MIS, "at 5/5 the round is lost and undo cannot step back into play", function () {
    let game = makeTestGame();
    makeOneMistake(game);
    for (let i = 0; i < 4; i++) { game.takeBack(KEY_RES); place(game, 50, KEY_RES); }
    assertEqual(mistakesOf(game), 5);
    assertTrue(game.isOver(), "round is over");
    assertEqual(game.endKind(), "lose");
    assertFalse(game.canUndo(), "undo is disabled on a lost round");
    game.undo();
    assertTrue(game.isOver(), "undo leaves the lost round lost");
    assertEqual(mistakesOf(game), 5, "count stays at 5/5");
  });
  test(MIS, "Try again restarts the same arrangement at 0/5", function () {
    let game = makeTestGame();
    let answersBefore = {};
    Object.keys(game.state().cellMap).forEach(function (k) {
      let cell = game.state().cellMap[k];
      if (cell.type === "num") answersBefore[k] = cell.answer;
    });
    let tilesBefore = game.state().tiles.map(function (t) { return t.value; }).sort(function (a, b) { return a - b; });
    makeOneMistake(game);
    for (let i = 0; i < 4; i++) { game.takeBack(KEY_RES); place(game, 50, KEY_RES); }
    assertEqual(mistakesOf(game), 5, "round lost at 5/5 before restarting");
    assertEqual(game.endKind(), "lose", "round lost before restarting");
    game.restartSame();
    assertEqual(mistakesOf(game), 0, "counter back to 0/5");
    assertFalse(game.isOver(), "round running again");
    assertEqual(game.endKind(), null);
    assertEqual(game.filledCount(), 0, "board cleared");
    assertTrue(game.state().tiles.every(function (t) { return !t.used; }), "every tile back in the bank");
    let answersAfter = {};
    Object.keys(game.state().cellMap).forEach(function (k) {
      let cell = game.state().cellMap[k];
      if (cell.type === "num") answersAfter[k] = cell.answer;
    });
    assertDeepEqual(answersAfter, answersBefore, "same board arrangement");
    assertDeepEqual(game.state().tiles.map(function (t) { return t.value; }).sort(function (a, b) { return a - b; }),
      tilesBefore, "same tiles");
    assertDeepEqual(game.state().blankKeys, [KEY_A, KEY_RES], "same blanks");
  });
  test(MIS, "after a mistake, solving correctly still wins and the mistake stays on the score", function () {
    let game = makeTestGame();
    makeOneMistake(game);
    game.takeBack(KEY_RES);
    place(game, 56, KEY_RES); /* 7 × 8 = 56 */
    assertTrue(game.isOver(), "round finished");
    assertEqual(game.endKind(), "win");
    assertEqual(mistakesOf(game), 1, "the earlier mistake is still counted");
  });
  test(MIS, "a fully correct board counts no mistake and wins", function () {
    let game = makeTestGame();
    place(game, 8, KEY_A);
    place(game, 56, KEY_RES);
    assertEqual(mistakesOf(game), 0);
    assertEqual(game.endKind(), "win");
  });

  /* ================= suite 3: daily completion =================
     Once a Daily round is won, the end overlay offers a Continue
     button (back to the calendar) and the top-left back arrow is
     removed. view.js drives both off the state owner's one
     verdict, game.isDailyWin(), so these tests pin that verdict
     on the real state owner — the same fixed 7 × □ = □ board,
     dealt as a Daily round for a pinned date — plus the button
     in the page's own markup. */
  const DAY = "Daily completion";
  const DAILY_KEY = "2026-11-28"; /* the pinned date, a Saturday */

  /* makeTestGame's fixed board, re-dealt as the pinned date's
     Daily round (the stub deals the same board for any seed),
     with a recording onDailyWin so the tests can see the date
     being marked done */
  function makeDailyTestGame() {
    let wonKeys = [];
    let game = makeTestGame(function (key) { wonKeys.push(key); });
    game.newGame("medium", DAILY_KEY);
    return { game: game, wonKeys: wonKeys };
  }
  function solveBoard(game) {
    place(game, 8, KEY_A);
    place(game, 56, KEY_RES); /* 7 × 8 = 56 */
  }

  test(DAY, "a daily round still in play is not a completed daily", function () {
    let daily = makeDailyTestGame();
    assertEqual(daily.game.dailyKey(), DAILY_KEY, "the round carries the date's key");
    assertFalse(daily.game.isDailyWin(), "nothing played yet");
    place(daily.game, 8, KEY_A);
    assertFalse(daily.game.isDailyWin(), "half solved is not completed");
    assertFalse(daily.game.isOver(), "round still running");
  });
  test(DAY, "winning the daily round completes the day: isDailyWin, and the date is marked done", function () {
    let daily = makeDailyTestGame();
    solveBoard(daily.game);
    assertTrue(daily.game.isOver(), "round finished");
    assertEqual(daily.game.endKind(), "win");
    assertTrue(daily.game.isDailyWin(), "a won daily round is a completed daily");
    assertDeepEqual(daily.wonKeys, [DAILY_KEY], "the win was reported for the date");
  });
  test(DAY, "winning a practice round is not a completed daily (no Continue, arrow stays)", function () {
    let game = makeTestGame(); /* no daily key: a Main practice round */
    solveBoard(game);
    assertEqual(game.endKind(), "win");
    assertFalse(game.isDailyWin(), "a practice win carries no daily key");
  });
  test(DAY, "losing the daily round at 5/5 is not a completion (no Continue)", function () {
    let daily = makeDailyTestGame();
    makeOneMistake(daily.game);
    for (let i = 0; i < 4; i++) { daily.game.takeBack(KEY_RES); place(daily.game, 50, KEY_RES); }
    assertEqual(mistakesOf(daily.game), 5, "round lost at 5/5");
    assertEqual(daily.game.endKind(), "lose");
    assertFalse(daily.game.isDailyWin(), "a lost daily is not completed — Try again, not Continue");
    assertDeepEqual(daily.wonKeys, [], "the date was not marked done");
  });
  test(DAY, "the end overlay carries a Continue button, labelled in the current language", function () {
    let expected = { en: "Continue", zh: "继续" }[MC.i18n.language()];
    assertEqual(MC.i18n.translate("continueBtn"), expected, "the Continue label is translated");
    let btn = document.getElementById("continueBtn");
    if (!btn) return; /* headless stub without the game markup: the label check above still ran */
    assertTrue(!!btn.closest("#endOverlay"), "the button sits in the end overlay");
    /* its visibility follows isDailyWin (pinned by the tests
       above): shown on a completed daily, hidden otherwise —
       including in the delivered markup, where no round has
       been won yet */
    assertEqual(btn.classList.contains("hidden"), !liveGameIsDailyWin(),
      "the button is visible exactly when a completed daily is on screen");
  });
  /* whether the page's own live game currently shows a completed
     daily — the tests cannot ask main.js's game instance, so
     this reads the same outward signs the player sees: the end
     overlay on show with the win title up. In a fresh page (and
     in the headless stub) it is simply false. */
  function liveGameIsDailyWin() {
    let overlay = document.getElementById("endOverlay");
    let title = document.getElementById("endTitle");
    if (!overlay || !title || !overlay.classList || !overlay.classList.contains("show")) return false;
    return title.textContent === MC.i18n.translate("winTitle") &&
      !!document.getElementById("gameBackLink") &&
      document.getElementById("gameBackLink").classList.contains("hidden");
  }

  /* ================= suite 4: landing page — no Unit tests link =================
     The landing page must not offer the tests: no link, no
     button, no "Unit tests" wording inside viewMain. The suite
     itself is not removed — viewTests stays in the page outside
     the landing view, and the #/tests route still runs it via
     MC.showTests / MC.runUnitTests. In a headless stub with no
     landing markup the DOM checks skip (as the other suites'
     markup checks do); the existence checks still run. */
  const LAND = "Landing page — no Unit tests link";

  test(LAND, "the landing page has no Unit tests link or button", function () {
    assertTrue(document.getElementById("testsLink") === null, "no #testsLink element anywhere");
    let main = document.getElementById("viewMain");
    if (!main || typeof main.querySelectorAll !== "function") return; /* headless stub: no landing markup to inspect */
    let controls = main.querySelectorAll("a, button");
    for (let i = 0; i < controls.length; i++) {
      let href = controls[i].getAttribute ? (controls[i].getAttribute("href") || "") : "";
      assertTrue(href.indexOf("/tests") === -1 && href !== "#/tests",
        "landing control " + i + " does not link to the tests (href: " + href + ")");
      let text = (controls[i].textContent || "").trim().toLowerCase();
      assertTrue(text.indexOf("unit tests") === -1 && text.indexOf("unit test") === -1,
        "landing control " + i + " is not labelled as unit tests");
    }
    assertTrue(main.querySelectorAll(".tests-link").length === 0, "no .tests-link element on the landing page");
  });
  test(LAND, "the landing page shows no 'Unit tests' text at all", function () {
    let main = document.getElementById("viewMain");
    if (!main || typeof main.textContent !== "string") return; /* headless stub */
    assertTrue(main.textContent.toLowerCase().indexOf("unit tests") === -1,
      "the landing view's text contains no 'Unit tests'");
  });
  test(LAND, "the test suite itself still exists outside the landing page", function () {
    let view = document.getElementById("viewTests");
    if (!view) return; /* headless stub without the tests markup: the runner checks below still ran */
    let main = document.getElementById("viewMain");
    assertTrue(!!document.getElementById("testsList"), "the tests view still has its results list");
    assertTrue(!!document.getElementById("testsRunBtn"), "the tests view still has its Run again button");
    if (main && typeof main.contains === "function") {
      assertFalse(main.contains(view), "the tests view is not inside the landing view");
    }
  });
  test(LAND, "the suite still runs via the #/tests route helpers", function () {
    assertEqual(typeof MC.runUnitTests, "function", "MC.runUnitTests still exists");
    assertEqual(typeof MC.showTests, "function", "MC.showTests (called by nav.js for #/tests) still exists");
    /* run a different suite by name: filtered out of this suite,
       so this cannot recurse, and it proves the runner still works */
    let sample = MC.runUnitTests(CAL);
    assertTrue(Array.isArray(sample) && sample.length > 0, "the runner still returns results for another suite");
  });

  /* ================= suite 5: registration gate =================
     Playing requires a name registered on this device: while
     none is saved, tapping Daily or Practice pops up Register
     instead of entering the mode, and the tapped mode waits as
     the pending destination until a name is saved (cancel
     drops it). The gate is MC.RegistrationGate in main.js; the
     cards' click handlers and nav.js both go through it. */
  const REG = "Registration gate";

  function gate() { return MC.RegistrationGate; }
  function registerOverlayEl() { return document.getElementById("registerOverlay"); }
  function menuCard(href) {
    return typeof document.querySelector === "function" ? document.querySelector('.menu-card[href="' + href + '"]') : null;
  }
  function cancelPopup() {
    let cancel = document.getElementById("registerCancelBtn");
    if (cancel && typeof cancel.click === "function") cancel.click();
  }

  test(REG, "the gate exists and its verdict matches the registry", function () {
    assertTrue(!!gate(), "MC.RegistrationGate is exposed by main.js");
    assertEqual(typeof gate().requireRegistration, "function", "the gate can be asked");
    assertEqual(gate().isRegistered(), MC.Player.list().length > 0,
      "isRegistered is true exactly when a name is registered on this device");
  });
  test(REG, "a registered player is never blocked and no popup opens", function () {
    if (!gate().isRegistered()) return; /* the unregistered branch is pinned by the tests below */
    assertFalse(gate().requireRegistration({ type: "calendar" }), "Daily is not blocked");
    assertFalse(gate().requireRegistration({ type: "practice" }), "Practice is not blocked");
    let overlay = registerOverlayEl();
    if (overlay) assertFalse(overlay.classList.contains("show"), "the register popup stayed closed");
    assertEqual(gate().pendingDestination(), null, "no destination is left waiting");
  });
  test(REG, "an unregistered tap on Daily opens Register instead of the calendar", function () {
    if (gate().isRegistered()) return; /* registered devices take the branch above */
    let card = menuCard("#/calendar");
    let overlay = registerOverlayEl();
    if (!card || !overlay || typeof card.click !== "function") return; /* headless stub: no menu markup */
    card.click();
    assertTrue(overlay.classList.contains("show"), "the register popup opened");
    assertTrue(global.location.hash !== "#/calendar", "the tap did not navigate to the calendar");
    let pending = gate().pendingDestination();
    assertTrue(!!pending && pending.type === "calendar", "Daily waits as the pending destination");
    cancelPopup();
    assertFalse(overlay.classList.contains("show"), "cancel closes the popup");
    assertEqual(gate().pendingDestination(), null, "cancel drops the waiting destination");
  });
  test(REG, "an unregistered tap on Practice opens Register instead of the game", function () {
    if (gate().isRegistered()) return;
    let card = menuCard("#/game");
    let overlay = registerOverlayEl();
    if (!card || !overlay || typeof card.click !== "function") return; /* headless stub */
    card.click();
    assertTrue(overlay.classList.contains("show"), "the register popup opened");
    assertTrue(global.location.hash !== "#/game", "the tap did not navigate to the game");
    let pending = gate().pendingDestination();
    assertTrue(!!pending && pending.type === "practice", "Practice waits as the pending destination");
    cancelPopup();
    assertFalse(overlay.classList.contains("show"), "cancel closes the popup");
    assertEqual(gate().pendingDestination(), null, "cancel drops the waiting destination");
  });
  test(REG, "an empty name cannot pass the gate: the popup stays open on the error", function () {
    if (gate().isRegistered()) return;
    let card = menuCard("#/game");
    let overlay = registerOverlayEl();
    let form = document.getElementById("registerForm");
    let input = document.getElementById("playerNameInput");
    let error = document.getElementById("registerError");
    if (!card || !overlay || !form || !input || !error || typeof card.click !== "function") return; /* headless stub */
    card.click();
    assertTrue(overlay.classList.contains("show"), "the register popup opened");
    input.value = "";
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else if (typeof form.dispatchEvent === "function") form.dispatchEvent(new Event("submit", { cancelable: true }));
    else { cancelPopup(); return; }
    assertTrue(overlay.classList.contains("show"), "the popup stays open — no name, no game");
    assertFalse(error.classList.contains("hidden"), "the empty-name error shows inside the popup");
    assertEqual(error.textContent, MC.i18n.translate("registerEmpty"), "the error is the empty-name message");
    let pending = gate().pendingDestination();
    assertTrue(!!pending && pending.type === "practice", "the destination still waits behind the popup");
    cancelPopup();
  });
  test(REG, "the gate call behind a Daily date tap blocks and holds the date", function () {
    if (gate().isRegistered()) return;
    /* MC.playDaily and nav.js enter a mode through exactly
       this call; the test drives the call itself rather than
       MC.playDaily, whose trip back to the menu would navigate
       the tests view away mid-run */
    let overlay = registerOverlayEl();
    if (!overlay) return; /* headless stub: no register markup */
    assertTrue(gate().requireRegistration({ type: "daily", key: "2026-11-28" }),
      "the gate blocked the entry");
    assertTrue(overlay.classList.contains("show"), "the register popup opened");
    let pending = gate().pendingDestination();
    assertTrue(!!pending && pending.type === "daily" && pending.key === "2026-11-28",
      "the tapped date waits as the pending destination");
    cancelPopup();
    assertEqual(gate().pendingDestination(), null, "cancel drops the waiting date");
  });

  /* ================= suite 6: Continue to previous unpracticed date =================
     After a Daily round is completed, Continue takes the
     player back to the calendar landed on the previous date
     that has not been practiced yet — the nearest earlier
     unfinished day — so they can tap it next. The walk is
     MC.Daily.previousUnfinishedBefore (the pure core of
     previousUnfinishedKey, which the Continue handler in
     main.js calls with the completed date's key); the landing
     is calendar.js consuming the target main.js names through
     MC.setCalendarTarget. */
  const CONT = "Continue to previous unpracticed date";

  /* a finished-set predicate over a fixed list of date keys,
     so the walk is pinned without touching the device's real
     finished dates */
  function doneSetPredicate(keys) {
    let set = {};
    keys.forEach(function (k) { set[k] = true; });
    return function (key) { return !!set[key]; };
  }
  function previousUnfinished(fromKey, doneKeys) {
    return MC.Daily.previousUnfinishedBefore(fromKey, doneSetPredicate(doneKeys));
  }

  test(CONT, "the day before a completed date is next when it is unpracticed", function () {
    assertEqual(previousUnfinished("2026-11-28", ["2026-11-28"]), "2026-11-27");
    assertEqual(previousUnfinished("2026-11-28", []), "2026-11-27",
      "the finished set is not even consulted for the first step back");
  });
  test(CONT, "finished days are skipped over, however many there are", function () {
    assertEqual(previousUnfinished("2026-11-28", ["2026-11-27"]), "2026-11-26");
    assertEqual(previousUnfinished("2026-11-28", ["2026-11-27", "2026-11-26", "2026-11-25"]), "2026-11-24");
  });
  test(CONT, "the walk crosses a month boundary", function () {
    assertEqual(previousUnfinished("2026-11-01", []), "2026-10-31");
    assertEqual(previousUnfinished("2026-11-01", ["2026-10-31", "2026-10-30"]), "2026-10-29");
    assertEqual(previousUnfinished("2026-03-01", []), "2026-02-28", "into a non-leap February");
    assertEqual(previousUnfinished("2028-03-01", []), "2028-02-29", "into a leap February");
  });
  test(CONT, "the walk crosses a year boundary", function () {
    assertEqual(previousUnfinished("2027-01-01", []), "2026-12-31");
    assertEqual(previousUnfinished("2027-01-01", ["2026-12-31"]), "2026-12-30");
  });
  test(CONT, "the result is always a real date earlier than the completed one", function () {
    let cases = [
      { from: "2026-11-28", done: [] },
      { from: "2026-11-28", done: ["2026-11-27", "2026-11-26"] },
      { from: "2026-01-01", done: ["2025-12-31"] },
      { from: "2026-06-15", done: ["2026-06-14", "2026-06-13", "2026-06-12", "2026-06-11"] }
    ];
    cases.forEach(function (c) {
      let result = previousUnfinished(c.from, c.done);
      assertTrue(typeof result === "string" && result < c.from,
        "result " + result + " is an earlier key than " + c.from);
      assertTrue(!!MC.Daily.dateForKey(result), "result " + result + " is a real date");
      assertTrue(c.done.indexOf(result) === -1, "result " + result + " is not a finished date");
    });
  });
  test(CONT, "when every earlier day in range is finished there is nothing to point at", function () {
    let allDone = function () { return true; };
    assertEqual(MC.Daily.previousUnfinishedBefore("2026-11-28", allDone), null,
      "a fully practiced look-back span yields no target (Continue then opens the current month)");
  });
  test(CONT, "a key that is not a real date has no previous unpracticed date", function () {
    assertEqual(previousUnfinished("not-a-date", []), null);
    assertEqual(previousUnfinished("2026-02-30", []), null, "February 30th does not exist");
    assertEqual(previousUnfinished("", []), null);
  });
  test(CONT, "the real previousUnfinishedKey never names the completed date or a finished one", function () {
    /* judged against the device's real finished set, whatever
       it holds: the verdicts that must hold for any state */
    let key = MC.Daily.previousUnfinishedKey(MC.Daily.todayKey());
    if (key === null) return; /* a full year of finished days: nothing to check */
    assertTrue(key < MC.Daily.todayKey(), "the target is earlier than today");
    assertFalse(MC.Daily.isDone(key), "the target is not a finished date");
    assertTrue(MC.Daily.isPlayable(key), "the target can actually be played");
  });
  test(CONT, "the calendar opens on the target's month with the target date highlighted", function () {
    assertEqual(typeof MC.setCalendarTarget, "function", "the calendar accepts a target date");
    /* a fixed target in the month before the current one, so
       the landing month provably differs from a plain opening */
    let now = new Date();
    let targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    let targetKey = MC.Daily.keyForDate(targetDate);
    MC.setCalendarTarget(targetKey);
    MC.showCalendar();
    assertEqual(MC.Calendar.suggestedKey(), targetKey, "the target date is the suggested one");
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    assertTrue(!!title && !!grid, "calendar title and grid exist");
    let expectedTitle = targetDate.toLocaleDateString(MC.i18n.translate("locale") || "en-US",
      { month: "long", year: "numeric" });
    assertEqual(title.textContent, expectedTitle, "the calendar landed on the target's month");
    /* the target's own cell: a playable button carries the
       suggested highlight; if this device has that date
       finished already, its cell is a disabled one instead and
       only the month landing above applies */
    let targetCell = null;
    for (let i = 0; i < grid.children.length; i++) {
      if (grid.children[i].dataset && grid.children[i].dataset.date === targetKey) targetCell = grid.children[i];
    }
    if (targetCell) {
      assertTrue(targetCell.classList.contains("suggested"), "the target cell is highlighted for the next tap");
      assertTrue(targetCell.classList.contains("playable"), "the target cell is tappable");
    }
    /* a plain opening afterwards replaces the Continue target
       with its own suggestion: the next date to play, which
       the Daily button relies on (suite 8 pins that behaviour
       in full) */
    MC.setCalendarChosen(null);
    MC.showCalendar();
    let plainSuggestion = MC.Daily.nextDateToPlay();
    assertEqual(MC.Calendar.suggestedKey(), plainSuggestion,
      "a plain opening suggests the next date to play itself");
    if (plainSuggestion) {
      assertEqual(title.textContent, monthTitleOf(MC.Daily.dateForKey(plainSuggestion)),
        "the plain opening lands on its suggestion's month");
    } else {
      let currentTitle = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(
        MC.i18n.translate("locale") || "en-US", { month: "long", year: "numeric" });
      assertEqual(title.textContent, currentTitle,
        "with nothing left unpracticed, a plain opening lands on the current month");
    }
  });

  /* ================= suite 7: chosen date kept and highlighted =================
     After the player clicks the calendar's previous button (or
     steps around the months at all), the date he chose must be
     kept and highlighted: calendar.js remembers the tapped date
     (chooseDate, also exposed as MC.setCalendarChosen), rings
     its cell with the "chosen" class on every render of its
     month, and lands reopenings on that month. */
  const KEEP = "Chosen date kept and highlighted";

  /* a fixed chosen date in the month before the current one, so
     its landing month provably differs from a plain opening —
     the same device suite 6 uses for its Continue target */
  function chosenFixture() {
    let now = new Date();
    let date = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    return { now: now, date: date, key: MC.Daily.keyForDate(date) };
  }
  function monthTitleOf(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString(
      MC.i18n.translate("locale") || "en-US", { month: "long", year: "numeric" });
  }
  function cellForKey(grid, key) {
    for (let i = 0; i < grid.children.length; i++) {
      if (grid.children[i].dataset && grid.children[i].dataset.date === key) return grid.children[i];
    }
    return null;
  }
  /* leave the calendar as the other suites expect it: no chosen
     date, current month on show */
  function restorePlainCalendar() {
    MC.setCalendarChosen(null);
    MC.showCalendar();
  }

  test(KEEP, "choosing a date keeps it; a non-date is ignored and null clears it", function () {
    let f = chosenFixture();
    assertEqual(typeof MC.setCalendarChosen, "function", "the calendar accepts a chosen date");
    MC.setCalendarChosen(f.key);
    assertEqual(MC.Calendar.chosenKey(), f.key, "the chosen date is kept");
    MC.setCalendarChosen("not-a-date");
    assertEqual(MC.Calendar.chosenKey(), f.key, "a key that is not a real date changes nothing");
    MC.setCalendarChosen("2026-02-30");
    assertEqual(MC.Calendar.chosenKey(), f.key, "February 30th changes nothing either");
    MC.setCalendarChosen(null);
    assertEqual(MC.Calendar.chosenKey(), null, "null clears the choice");
    restorePlainCalendar();
  });
  test(KEEP, "the calendar opens on the chosen date's month with the date highlighted", function () {
    let f = chosenFixture();
    MC.setCalendarChosen(f.key);
    MC.showCalendar();
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    assertTrue(!!title && !!grid, "calendar title and grid exist");
    assertEqual(title.textContent, monthTitleOf(f.date), "the opening landed on the chosen date's month");
    let cell = cellForKey(grid, f.key);
    assertTrue(!!cell, "the chosen date's cell is on show");
    if (cell) assertTrue(cell.classList.contains("chosen"), "the chosen date is highlighted");
    restorePlainCalendar();
    /* with the choice cleared, the landing is the plain
       opening's again: the automatic suggestion's month when
       one exists (suite 8), else the current month */
    let suggestion = MC.Daily.nextDateToPlay();
    let expectedTitle = suggestion ? monthTitleOf(MC.Daily.dateForKey(suggestion)) : monthTitleOf(f.now);
    assertEqual(title.textContent, expectedTitle, "clearing the choice ends the chosen landing");
  });
  test(KEEP, "clicking the previous button and coming back keeps the chosen date highlighted", function () {
    let f = chosenFixture();
    MC.setCalendarChosen(f.key);
    MC.showCalendar(); /* lands on the chosen date's month (the month before the current one) */
    let prev = document.getElementById("calPrevBtn");
    let next = document.getElementById("calNextBtn");
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    if (!prev || !next || typeof prev.click !== "function" || typeof next.click !== "function") {
      /* headless stub without the real nav buttons: the kept
         state itself is still pinned, the stepping is not */
      assertEqual(MC.Calendar.chosenKey(), f.key, "the chosen date is kept");
      restorePlainCalendar();
      return;
    }
    prev.click(); /* the previous button: one month further back */
    let furtherBack = new Date(f.date.getFullYear(), f.date.getMonth() - 1, 1);
    assertEqual(title.textContent, monthTitleOf(furtherBack), "the previous button stepped the month back");
    assertEqual(MC.Calendar.chosenKey(), f.key, "the chosen date survives the previous button");
    next.click(); /* and back to the chosen date's month */
    assertEqual(title.textContent, monthTitleOf(f.date), "stepping back lands on the chosen month again");
    let cell = cellForKey(grid, f.key);
    assertTrue(!!cell && cell.classList.contains("chosen"),
      "the chosen date is still highlighted after the round trip");
    restorePlainCalendar();
  });
  test(KEEP, "reopening the calendar keeps the chosen date instead of resetting to the current month", function () {
    let f = chosenFixture();
    MC.setCalendarChosen(f.key);
    MC.showCalendar();
    MC.showCalendar(); /* a second, plain opening — no new choice, no Continue target */
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    assertTrue(!!title && !!grid, "calendar title and grid exist");
    assertEqual(title.textContent, monthTitleOf(f.date), "the reopening still lands on the chosen month");
    let cell = cellForKey(grid, f.key);
    assertTrue(!!cell && cell.classList.contains("chosen"), "the chosen date is still highlighted");
    restorePlainCalendar();
  });
  test(KEEP, "the stylesheet rings .cal-day.chosen like the suggested date", function () {
    let chosenBody = null;
    let rules = parseCssRules(MC.Calendar.dayCssText);
    for (let r = 0; r < rules.length; r++) {
      if (rules[r].selector.indexOf(".cal-day.chosen") !== -1) chosenBody = rules[r].body;
    }
    assertTrue(chosenBody !== null, "a .cal-day.chosen rule exists in the calendar's own stylesheet");
    assertTrue(chosenBody !== null && /outline\s*:/.test(chosenBody), "the chosen date is ringed with an outline");
  });

  /* ================= suite 8: Daily button highlights the next date to play =================
     Tapping the menu's Daily card is a plain calendar opening
     (nav.js calls MC.showCalendar, nothing names a target):
     the calendar must itself highlight the one next date to
     play — today itself while today is not done, and only
     once today is done the nearest earlier unfinished day —
     on that date's month, ringed and tappable. The expectation
     is derived from the device's real finished set through the
     same choice the calendar uses (MC.Daily.nextDateToPlay),
     so the tests pin the wiring in whatever state the device
     is in. */
  const AUTO = "Daily button highlights the next date to play";

  function plainSuggestion() {
    return MC.Daily.nextDateToPlay();
  }

  test(AUTO, "a plain opening highlights the next date to play", function () {
    MC.setCalendarChosen(null); /* a plain Daily-card opening: no choice kept */
    MC.showCalendar();
    let expected = plainSuggestion();
    assertEqual(MC.Calendar.suggestedKey(), expected,
      "the opening suggests the next date to play");
    if (expected === null) return; /* today and every earlier day in range are done on this device */
    assertFalse(MC.Daily.isDone(expected), "the suggested date is not done");
    assertTrue(MC.Daily.isPlayable(expected), "the suggested date can actually be played");
    if (MC.Daily.isDone(MC.Daily.todayKey())) {
      assertTrue(expected < MC.Daily.todayKey(),
        "today is done, so the suggested date is an earlier one");
    } else {
      assertEqual(expected, MC.Daily.todayKey(),
        "today is not done, so today itself is the suggested date");
    }
  });
  test(AUTO, "the opening lands on that date's month with its cell ringed and tappable", function () {
    MC.setCalendarChosen(null);
    MC.showCalendar();
    let expected = plainSuggestion();
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    assertTrue(!!title && !!grid, "calendar title and grid exist");
    if (expected === null) {
      assertEqual(title.textContent, monthTitleOf(new Date()),
        "with nothing to suggest, the current month opens");
      return;
    }
    assertEqual(title.textContent, monthTitleOf(MC.Daily.dateForKey(expected)),
      "the calendar landed on the suggested date's month");
    let cell = cellForKey(grid, expected);
    assertTrue(!!cell, "the suggested date's cell is on show");
    if (cell) {
      assertTrue(cell.classList.contains("suggested"), "the cell is highlighted for the next tap");
      assertTrue(cell.classList.contains("playable"), "the cell is tappable");
    }
  });
  test(AUTO, "when the suggestion is an earlier day, every day between it and today is done", function () {
    let expected = plainSuggestion();
    if (expected === null || expected === MC.Daily.todayKey()) return;
    /* today is done and the suggestion is the nearest earlier
       unfinished day: every day in between must be finished,
       or the choice would have stopped there instead */
    let day = MC.Daily.dateForKey(expected);
    day.setDate(day.getDate() + 1);
    while (MC.Daily.keyForDate(day) < MC.Daily.todayKey()) {
      let key = MC.Daily.keyForDate(day);
      assertTrue(MC.Daily.isDone(key), "the nearer day " + key + " is finished, so it is skipped");
      day.setDate(day.getDate() + 1);
    }
  });
  test(AUTO, "a chosen date that can still be played keeps the landing (the suggestion steps aside)", function () {
    let f = chosenFixture(); /* the 15th of last month */
    if (!MC.Daily.isPlayable(f.key)) { restorePlainCalendar(); return; } /* finished here: suite 7 covers the kept choice */
    MC.setCalendarChosen(f.key);
    MC.showCalendar();
    assertEqual(MC.Calendar.chosenKey(), f.key, "the choice is kept");
    let title = document.getElementById("calTitle");
    assertTrue(!!title, "calendar title exists");
    assertEqual(title.textContent, monthTitleOf(f.date), "the opening lands on the chosen date's month");
    assertEqual(MC.Calendar.suggestedKey(), null, "no automatic suggestion overrides the kept choice");
    restorePlainCalendar();
  });
  test(AUTO, "a Continue target still wins over the automatic suggestion", function () {
    MC.setCalendarChosen(null);
    /* a fixed target in the month before the current one, so
       it provably differs from the automatic suggestion
       whenever that suggestion sits in the current month */
    let now = new Date();
    let targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    let targetKey = MC.Daily.keyForDate(targetDate);
    MC.setCalendarTarget(targetKey);
    MC.showCalendar();
    assertEqual(MC.Calendar.suggestedKey(), targetKey, "Continue's target is the suggested date on show");
    let title = document.getElementById("calTitle");
    assertTrue(!!title, "calendar title exists");
    assertEqual(title.textContent, monthTitleOf(targetDate), "the opening lands on the target's month");
    MC.setCalendarChosen(null);
    MC.showCalendar(); /* leave the calendar on its plain opening */
  });

  /* ================= suite 9: one highlighted date =================
     The calendar never highlights two dates at once (the
     player's report: on the November 2026 calendar the 28th
     showed framed as today while the 26th was ringed as the
     previous unpracticed day). Exactly one date is pointed
     at — today while today is unfinished, otherwise the
     nearest earlier unfinished day — and the frame (ring and
     accent border) belongs to that date alone: today's own
     style no longer draws a border, so a pointed-at earlier
     day never competes with a framed today. */
  const ONE = "One highlighted date";

  /* the next-date-to-play choice over a fixed finished set
     (its pure core reads today itself, so the expectations
     are stated against the real today) */
  function nextToPlay(doneKeys) {
    return MC.Daily.nextDateToPlayFrom(doneSetPredicate(doneKeys));
  }

  test(ONE, "while today is not finished, today itself is the date to play", function () {
    let todayK = MC.Daily.todayKey();
    assertEqual(nextToPlay([]), todayK, "nothing finished: today is next");
    assertEqual(nextToPlay(["2020-01-01"]), todayK,
      "an old finished day does not move the pointer off today");
  });
  test(ONE, "once today is finished, the nearest earlier unfinished day is next", function () {
    let todayK = MC.Daily.todayKey();
    let yesterday = MC.Daily.dateForKey(todayK);
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayK = MC.Daily.keyForDate(yesterday);
    assertEqual(nextToPlay([todayK]), yesterdayK,
      "today finished: yesterday is next when it is unpracticed");
    let result = nextToPlay([todayK, yesterdayK]);
    assertTrue(typeof result === "string" && result < yesterdayK,
      "a finished yesterday is skipped for an earlier day");
    assertTrue(!!MC.Daily.dateForKey(result), "the skipped-to date is a real date");
  });
  test(ONE, "when today and every earlier day in range are finished there is no date to play", function () {
    let allDone = function () { return true; };
    assertEqual(MC.Daily.nextDateToPlayFrom(allDone), null,
      "nothing left to point at");
  });
  test(ONE, "a plain opening highlights exactly one cell: the next date to play", function () {
    MC.setCalendarChosen(null);
    MC.showCalendar();
    let grid = document.getElementById("calGrid");
    assertTrue(!!grid, "calendar grid exists");
    let highlighted = [];
    for (let i = 0; i < grid.children.length; i++) {
      let cell = grid.children[i];
      if (cell.classList.contains("suggested") || cell.classList.contains("chosen")) {
        highlighted.push(cell.dataset ? cell.dataset.date : null);
      }
    }
    let expected = MC.Daily.nextDateToPlay();
    if (expected === null) {
      assertEqual(highlighted.length, 0, "nothing is highlighted when no date is left to play");
      return;
    }
    /* the pointed-at date's month is on show, so its cell is
       in this grid — the one framed cell, and no other */
    assertEqual(highlighted.length, 1, "exactly one date is highlighted, not two");
    assertEqual(highlighted[0], expected, "the highlighted date is the next date to play");
  });
  test(ONE, "today carries no frame of its own: the accent border lives on the pointed-at date", function () {
    let todayBody = null, pointedBody = null;
    let rules = parseCssRules(MC.Calendar.dayCssText);
    for (let r = 0; r < rules.length; r++) {
      if (rules[r].selector === ".cal-day.today") todayBody = rules[r].body;
      if (rules[r].selector.indexOf(".cal-day.suggested") !== -1) pointedBody = rules[r].body;
    }
    assertTrue(todayBody !== null, "a .cal-day.today rule exists in the calendar's own stylesheet");
    assertFalse(/border\s*:/.test(todayBody || ""), "today's own style draws no border");
    assertTrue(pointedBody !== null && /border\s*:/.test(pointedBody),
      "the suggested date's rule draws the accent border");
    assertTrue(pointedBody !== null && /outline\s*:/.test(pointedBody),
      "the suggested date keeps its ring");
  });

  /* ================= rendering the results ================= */
  function translate(keyName) { return MC.i18n ? MC.i18n.translate(keyName) : undefined; }

  function renderResults(results) {
    let list = document.getElementById("testsList");
    let summary = document.getElementById("testsSummary");
    if (!list || !summary) return;
    let passed = results.filter(function (r) { return r.pass; }).length;
    let summaryFn = translate("testsSummary");
    summary.textContent = typeof summaryFn === "function" ? summaryFn(passed, results.length) : (passed + " / " + results.length);
    summary.classList.toggle("all-pass", passed === results.length);
    summary.classList.toggle("has-fail", passed !== results.length);
    list.textContent = "";
    let currentSuite = null;
    results.forEach(function (result) {
      if (result.suite !== currentSuite) {
        currentSuite = result.suite;
        let head = document.createElement("li");
        head.className = "tests-suite";
        head.textContent = currentSuite;
        list.appendChild(head);
      }
      let item = document.createElement("li");
      item.className = "tests-item " + (result.pass ? "pass" : "fail");
      let badge = document.createElement("span");
      badge.className = "tests-badge";
      badge.textContent = result.pass ? "PASS" : "FAIL";
      let label = document.createElement("span");
      label.className = "tests-name";
      label.textContent = result.name + (result.pass ? "" : " — " + result.error);
      item.appendChild(badge);
      item.appendChild(label);
      list.appendChild(item);
    });
  }

  MC.runUnitTests = runUnitTests;
  MC.showTests = function () { renderResults(runUnitTests()); };

  let runButton = document.getElementById("testsRunBtn");
  if (runButton) runButton.addEventListener("click", function () { MC.showTests(); });
})(window);
