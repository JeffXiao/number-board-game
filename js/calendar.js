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
   Rendering is one entry point (renderCalendar) that rebuilds
   the day grid from the state it owns: the month on show plus
   the Daily module's finished set. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const Daily = MC.Daily || null;

  const DAYS_IN_WEEK = 7;

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
      if (done) cell.classList.add("done");
      if (future) cell.classList.add("future");
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
    if (isToday(date)) cell.setAttribute("aria-current", "date");
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

  /* opening the calendar always lands on the current month, and
     re-rendering picks up any date finished since the last visit */
  MC.showCalendar = function () {
    today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    renderCalendar();
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
    if (global.MC.playDaily) global.MC.playDaily(button.dataset.date);
    else global.location.href = "game.html?daily=" + encodeURIComponent(button.dataset.date);
  });

  renderCalendar();
})(window);
