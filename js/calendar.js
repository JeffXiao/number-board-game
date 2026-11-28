/* 数学十字谜 — calendar module.
   Owns the Daily calendar view: it opens on the current month,
   the left arrow at the top left steps to the previous month
   (and keeps stepping back), and the right arrow at the top
   right steps to the next month (and keeps stepping forward,
   past the current month into future months).
   Every date in the month on show is that date's Daily puzzle:
   tapping one — today (the 25th, say) or any earlier unfinished
   day — opens the game with that date's puzzle. A date the
   player has already finished is disabled and gray, and so is
   every future date, whose puzzle has not arrived yet. Finished
   dates come from MC.Daily, which keeps them across visits.
   Today and every earlier date render bold; future dates keep
   the regular weight.
   The month on show is usually the current one, but an opening
   points the player at the one date to play next whenever
   there is one to point at: today itself while today is not
   finished yet, and only once today is finished the nearest
   earlier unfinished day (MC.Daily.nextDateToPlay) — never
   two highlighted dates at once. After a Daily round is
   completed, its Continue button names the previous
   unpracticed date (MC.setCalendarTarget, fed by
   MC.Daily.previousUnfinishedKey in main.js); a plain opening
   — the menu's Daily card — finds the next date to play on
   its own. Either way the opening lands on that date's month
   with its cell highlighted, ready for the player's next tap.
   The date the player chooses — by tapping a day cell — is
   kept the same way for the whole visit: its cell stays
   highlighted ("chosen") whenever its month is on show.
   Stepping with the previous / next month buttons never drops
   it, and reopening the calendar lands back on the chosen
   date's month with the date highlighted, instead of losing
   the player's place and resetting to the current month.
   Rendering is one entry point (renderCalendar) that rebuilds
   the day grid from the state it owns: the month on show plus
   the Daily module's finished set. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const Daily = MC.Daily || null;

  const DAYS_IN_WEEK = 7;

  /* The day-cell styles are this module's own stylesheet text,
     injected into the page as a <style> element below — one
     source of truth for how a day cell renders. The unit tests
     read the injected sheet through the CSSOM in the browser
     and parse this exact text in the headless run, so either
     way they check the rules the page really renders with,
     .cal-day.past included. */
  const DAY_CELL_CSS = `
.cal-day {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  border-radius: 10px;
  color: var(--ink);
  user-select: none;
  -webkit-user-select: none;
}
.cal-day.outside { color: var(--ink-soft); opacity: 0.45; }
/* today keeps its filled background, but draws no border of
   its own: the frame belongs to the one date the calendar
   points at (the suggested / chosen rule below), so today and
   another date are never framed at the same time */
.cal-day.today {
  background: var(--given-bg);
  color: var(--given-ink);
  font-weight: 500;
}
/* today and every earlier date are bold; future dates keep the
   regular weight (declared after .today so today is bold too) */
.cal-day.past { font-weight: 700; }
/* the one date the calendar points at — named by Continue,
   or found by a plain opening on its own — is framed so the
   player sees which date to tap next: the tile fill, a ring,
   and the accent border today used to carry on its own, all
   on this date alone. The date the player chose is framed the
   same way, and the frame is kept for as long as the date
   stays chosen */
.cal-day.suggested,
.cal-day.chosen {
  background: var(--tile-bg);
  color: var(--tile-ink);
  border: 1.5px solid var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
/* dates of the month on show are buttons: a playable day opens
   its Daily puzzle; a finished day and a future day are disabled
   and gray */
button.cal-day {
  appearance: none;
  background: none;
  border: 1.5px solid transparent;
  font: inherit;
  padding: 0;
  cursor: pointer;
}
button.cal-day.playable:hover { background: var(--tile-bg); color: var(--tile-ink); }
button.cal-day.playable:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
button.cal-day.playable:active { transform: translateY(1px); }
button.cal-day.done,
button.cal-day.future {
  color: var(--ink-soft);
  opacity: 0.45;
  cursor: default;
}
button.cal-day.done { background: var(--line); border-color: transparent; }
@media (prefers-reduced-motion: reduce) {
  button.cal-day.playable:active { transform: none; }
}
`;

  /* inject the day-cell styles into a real document; a headless
     stub document has no head to hold them, and there the tests
     read DAY_CELL_CSS directly instead */
  if (typeof document !== "undefined" && document.head && document.createElement) {
    let dayStyle = document.createElement("style");
    dayStyle.id = "calDayStyles";
    dayStyle.textContent = DAY_CELL_CSS;
    document.head.appendChild(dayStyle);
  }

  /* every visible string on the calendar follows the chosen
     language, through the same i18n table the rest of the game
     uses: the month title and long dates are formatted with the
     language's locale, and the weekday header, the month-step
     buttons and the day cells' labels are translated strings */
  function translate(keyName) {
    return MC.i18n ? MC.i18n.translate(keyName) : undefined;
  }
  function locale() {
    return translate("locale") || "en-US";
  }

  let today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); /* 0-based */

  /* the date Continue points at: main.js names it through
     MC.setCalendarTarget just before routing here, it waits in
     pendingTargetKey, and the next showCalendar consumes it —
     landing on that date's month and marking its cell with the
     "suggested" class (suggestedKey) so the player can tap it
     next. A plain opening (the menu's Daily card) names no
     target: showCalendar then finds the next date to play
     itself — today, or the previous unpracticed date once
     today is finished — by the landing order below. */
  let suggestedKey = null;
  let pendingTargetKey = null;

  /* the date the player chose by tapping a day cell. It is kept
     in this closure for the whole visit and highlighted on
     every render of its month: stepping to the previous or
     next month and back keeps it, and so does leaving the
     calendar and reopening it (showCalendar lands on its
     month). Only choosing another date replaces it. */
  let chosenKey = null;
  function chooseDate(key) {
    if (!Daily || !Daily.dateForKey(key)) return;
    chosenKey = key;
  }
  function clearChosenDate() {
    chosenKey = null;
  }

  /* stepping months only moves the month on show: the chosen
     date (and any Continue suggestion) is kept, so stepping
     back to its month renders it highlighted again */
  function stepMonth(delta) {
    let next = new Date(viewYear, viewMonth + delta, 1);
    viewYear = next.getFullYear();
    viewMonth = next.getMonth();
    renderCalendar();
  }

  function isToday(date) {
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }
  /* today and every earlier date render bold (the "past" class);
     future dates keep the regular weight. The pure form takes the
     reference day explicitly so unit tests can pin "today" to a
     fixed date; isPastOrToday is that same rule judged against
     the calendar's own today. */
  function isPastOrTodayOn(date, reference) {
    let startOfReference = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
    let startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return startOfDate <= startOfReference;
  }
  function isPastOrToday(date) {
    return isPastOrTodayOn(date, today);
  }
  function longDate(date) {
    return date.toLocaleDateString(locale(), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  /* One grid cell for one date. Days of the month on show are
     buttons: playable ones carry their date key for the delegated
     click handler; finished and future ones are disabled and
     gray. The spill-over days of the neighbouring months stay
     plain dimmed text, as before. */
  function makeDayCell(date, inMonth) {
    let key = Daily ? Daily.keyForDate(date) : null;
    let done = !!(inMonth && key && Daily.isDone(key));
    let future = !!(inMonth && key && Daily.isFutureKey(key));
    if (!inMonth || !key || (!done && !future && !Daily.isPlayable(key))) {
      let cell = document.createElement("span");
      cell.className = "cal-day";
      cell.setAttribute("role", "gridcell");
      if (!inMonth) cell.classList.add("outside");
      if (key === suggestedKey) cell.classList.add("suggested");
      if (inMonth && key === chosenKey) cell.classList.add("chosen");
      if (done) cell.classList.add("done");
      if (future) cell.classList.add("future");
      if (isPastOrToday(date)) cell.classList.add("past");
      if (isToday(date)) {
        cell.classList.add("today");
        cell.setAttribute("aria-current", "date");
      }
      cell.textContent = String(date.getDate());
      return cell;
    }
    let cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day playable num";
    cell.setAttribute("role", "gridcell");
    cell.dataset.date = key;
    if (key === suggestedKey) cell.classList.add("suggested");
    if (key === chosenKey) cell.classList.add("chosen");
    if (isPastOrToday(date)) cell.classList.add("past");
    if (isToday(date)) {
      cell.classList.add("today");
      cell.setAttribute("aria-current", "date");
    }
    let playLabel = translate("calPlayDaily");
    cell.setAttribute("aria-label", typeof playLabel === "function" ? playLabel(longDate(date)) : longDate(date));
    cell.title = longDate(date);
    cell.textContent = String(date.getDate());
    return cell;
  }
  function makeDisabledCell(date, done) {
    let cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day num " + (done ? "done" : "future");
    cell.setAttribute("role", "gridcell");
    cell.disabled = true;
    /* a finished date the player chose keeps its highlight too:
       the day stays chosen (and ringed) after it is completed */
    let key = Daily ? Daily.keyForDate(date) : null;
    if (key) {
      cell.dataset.date = key;
      if (key === chosenKey) cell.classList.add("chosen");
    }
    if (isPastOrToday(date)) cell.classList.add("past");
    if (isToday(date)) {
      /* a finished today keeps its filled background, so it
         reads as today under the gray — never framed, so it
         never competes with the date pointed at */
      cell.classList.add("today");
      cell.setAttribute("aria-current", "date");
    }
    cell.setAttribute("aria-label", longDate(date) + (done ? (translate("calCompletedSuffix") || " — completed") : (translate("calFutureSuffix") || " — not available yet")));
    cell.textContent = String(date.getDate());
    return cell;
  }

  /* the calendar's static chrome — weekday header, month-step
     buttons and the back-to-menu link — is re-labelled on every
     render, so a language switch re-renders it in the new
     language without a reload */
  function renderCalendarChrome() {
    let weekdays = translate("calWeekdays");
    if (Array.isArray(weekdays)) {
      document.querySelectorAll(".cal-weekdays span").forEach(function (span, index) {
        if (weekdays[index]) span.textContent = weekdays[index];
      });
    }
    let prevButton = document.getElementById("calPrevBtn");
    if (prevButton) {
      let prevLabel = translate("calPrevMonth");
      if (prevLabel) { prevButton.setAttribute("aria-label", prevLabel); prevButton.title = prevLabel; }
    }
    let nextButton = document.getElementById("calNextBtn");
    if (nextButton) {
      let nextLabel = translate("calNextMonth");
      if (nextLabel) { nextButton.setAttribute("aria-label", nextLabel); nextButton.title = nextLabel; }
    }
    let backLink = document.querySelector("#viewCalendar .back-link");
    if (backLink) {
      let backLabel = translate("calBackToMenu");
      if (backLabel) backLink.setAttribute("aria-label", backLabel);
    }
  }

  function renderCalendar() {
    let title = document.getElementById("calTitle");
    let grid = document.getElementById("calGrid");
    if (!title || !grid) return;

    renderCalendarChrome();

    let monthStart = new Date(viewYear, viewMonth, 1);
    title.textContent = monthStart.toLocaleDateString(locale(), { month: "long", year: "numeric" });
    grid.setAttribute("aria-label", title.textContent);

    /* the grid starts on the Sunday on or before the 1st, so the
       leading cells belong to the previous month and the trailing
       cells to the next one — a full set of week rows, no gaps */
    let cursor = new Date(viewYear, viewMonth, 1 - monthStart.getDay());
    let daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let cellCount = Math.ceil((monthStart.getDay() + daysInViewMonth) / DAYS_IN_WEEK) * DAYS_IN_WEEK;

    grid.textContent = "";
    for (let i = 0; i < cellCount; i++) {
      let date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      let inMonth = cursor.getMonth() === viewMonth;
      let key = Daily ? Daily.keyForDate(date) : null;
      let done = !!(inMonth && key && Daily.isDone(key));
      let future = !!(inMonth && key && Daily.isFutureKey(key));
      let cell;
      if (inMonth && (done || future)) cell = makeDisabledCell(date, done);
      else cell = makeDayCell(date, inMonth);
      grid.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  /* Opening the calendar decides where it lands, in this
     order, and re-rendering picks up any date finished since
     the last visit:
     1. A target Continue named on the way here
        (MC.setCalendarTarget): that date's month, the date
        highlighted ("suggested") for the player's next tap.
     2. A date the player chose that can still be played: its
        month, the date still highlighted ("chosen"), so
        stepping away with the previous-month button (or
        leaving for a game) never loses the player's place —
        and a Daily loss keeps the tapped date for retry.
     3. Otherwise the calendar points at the next date to
        play on its own (MC.Daily.nextDateToPlay): today
        itself while today is unfinished — the player plays
        today's puzzle first — and only once today is
        finished, the nearest earlier unfinished day before
        today. It lands on that date's month and highlights
        it the same "suggested" way. This is what a plain
        opening — tapping the menu's Daily card — does, so
        the next day to play is offered without the player
        hunting for it, and exactly one date is ever
        highlighted: never today and an earlier day at once.
     4. Failing all that — today finished and every earlier
        day finished too, or a chosen date that is finished
        with nothing left to suggest — the chosen date's
        month when there is one, else the current month, with
        nothing highlighted. */
  MC.showCalendar = function () {
    today = new Date();
    if (pendingTargetKey) {
      let target = Daily ? Daily.dateForKey(pendingTargetKey) : null;
      pendingTargetKey = null;
      if (target) {
        viewYear = target.getFullYear();
        viewMonth = target.getMonth();
        suggestedKey = Daily.keyForDate(target);
        renderCalendar();
        return;
      }
    }
    suggestedKey = null;
    let chosen = chosenKey && Daily ? Daily.dateForKey(chosenKey) : null;
    if (chosenKey && !chosen) chosenKey = null; /* the kept key no longer names a real date */
    if (chosen && Daily.isPlayable(chosenKey)) {
      viewYear = chosen.getFullYear();
      viewMonth = chosen.getMonth();
      renderCalendar();
      return;
    }
    /* no Continue target and no playable chosen date: point
       at the next date to play automatically — today while it
       is unfinished, else the previous unpracticed date */
    let suggestion = Daily ? Daily.nextDateToPlay() : null;
    let suggested = suggestion ? Daily.dateForKey(suggestion) : null;
    if (suggested) {
      viewYear = suggested.getFullYear();
      viewMonth = suggested.getMonth();
      suggestedKey = suggestion;
      renderCalendar();
      return;
    }
    if (chosen) {
      viewYear = chosen.getFullYear();
      viewMonth = chosen.getMonth();
      renderCalendar();
      return;
    }
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    renderCalendar();
  };

  /* name the date the next calendar opening should land on —
     the previous unpracticed date a completed Daily round's
     Continue sends the player back to. Anything that is not a
     real date key is ignored. */
  MC.setCalendarTarget = function (key) {
    if (Daily && Daily.dateForKey(key)) pendingTargetKey = key;
  };

  /* name the date the player chose, so it is kept and
     highlighted (see chooseDate above); passing null clears
     the choice, and anything that is not a real date key is
     ignored */
  MC.setCalendarChosen = function (key) {
    if (key === null) { clearChosenDate(); return; }
    chooseDate(key);
  };

  /* a language switch re-renders the month already on show, in
     place — the view module calls this from applyLanguage so the
     calendar follows the language like every other screen */
  MC.refreshCalendar = function () {
    renderCalendar();
  };

  let prevButton = document.getElementById("calPrevBtn");
  if (prevButton) prevButton.addEventListener("click", function () { stepMonth(-1); });
  let nextButton = document.getElementById("calNextBtn");
  if (nextButton) nextButton.addEventListener("click", function () { stepMonth(1); });

  /* one delegated listener for every day button: a playable date
     opens its Daily puzzle — through the shell's MC.playDaily in
     the app, or by following the date link on the standalone
     calendar page. Disabled buttons never fire a click. */
  let grid = document.getElementById("calGrid");
  if (grid) grid.addEventListener("click", function (event) {
    let button = event.target.closest ? event.target.closest("button[data-date]") : null;
    if (!button || button.disabled) return;
    /* the tap chooses this date: it is kept and highlighted
       from now on (see chooseDate above) */
    chooseDate(button.dataset.date);
    if (global.MC.playDaily) global.MC.playDaily(button.dataset.date);
    else global.location.href = "game.html?daily=" + encodeURIComponent(button.dataset.date);
  });

  /* the bold-date rule, exposed for the unit tests (assets/js/
     tests.js) so they exercise the real predicate the renderer
     uses, not a copy of it; dayCssText is the very stylesheet
     text injected above, for the headless stylesheet check */
  MC.Calendar = Object.freeze({
    isPastOrTodayOn: isPastOrTodayOn,
    isPastOrToday: isPastOrToday,
    isToday: isToday,
    dayCssText: DAY_CELL_CSS,
    /* the date the current rendering highlights as the one to
       tap next (null when none): the tests pin that Continue's
       target — and a plain opening's own next date to play —
       really is the suggested date on show */
    suggestedKey: function () { return suggestedKey; },
    /* the date the player chose, kept and highlighted across
       month stepping and calendar openings (null when none):
       the tests pin that it survives the previous-month button */
    chosenKey: function () { return chosenKey; }
  });

  /* standalone calendar.html?focus=YYYY-MM-DD: the target a
     completed Daily round's Continue named on the game page —
     open on that date's month with the date highlighted, the
     same landing MC.setCalendarTarget produces in the shell */
  try {
    let focusParam = new URLSearchParams(global.location.search).get("focus");
    let focusDate = focusParam && Daily ? Daily.dateForKey(focusParam) : null;
    if (focusDate) {
      viewYear = focusDate.getFullYear();
      viewMonth = focusDate.getMonth();
      suggestedKey = focusParam;
    }
  } catch (error) { /* no query string to read: the current month, as usual */ }

  renderCalendar();
})(window);
