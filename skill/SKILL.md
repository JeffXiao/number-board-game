# Math Crossword Game

## Play the game

- Open the game and fill the grid so every horizontal and vertical equation holds, such as 3 + 5 = 8 and 12 + 23 = 35.

- Tap a blank cell and then tap a number tile from the bank below, or drag a tile into a cell.

- Treat multiplication and addition as commutative, so 5 × 7 and 7 × 5 both count.

- Treat division as interchangeable between divisor and quotient, so 18 ÷ 9 = 2 and 18 ÷ 2 = 9 both count.

- Never prefill the result cell of an equation on any difficulty: the answer after = is always a blank the player must work out (Nov 17, 2026, at the user's request — □ + 96 = 104 gave the answer away; verified that 60 fresh puzzles per difficulty all generate with zero results given and the hint solver still solves them all). Give each equation at most ONE prefilled number, and it must be an operand: with two numbers on the left side the answer is given away, so no equation's answer may be computable from its own prefilled numbers alone (Nov 17, 2026, at the user's request — the 92 − 57 = □ case). Keep the total as low as the difficulty allows, preferring cross cells as prefilled numbers because one cross number serves two equations. An equation may stay fully blank and be solved through its crossings. This rule is also stated as a comment in game.js above the givens-selection code, so any coder reading the source sees it.

- Offer four difficulties named easy, medium, hard and expert.

- Let easy use addition and subtraction only, medium add multiplication, hard use all four operations, and expert use an 11 by 11 board with 20 equations, 32 number cells and numbers up to 150.

- Generate a fresh random puzzle on every open and on every difficulty change.

- Remember the language choice across visits: store it in localStorage when the toggle is used and read it on load before rendering, defaulting to English when nothing is stored (Nov 18, 2026, at the user's request — "make it stick").

## Judge errors and let the player fix them

- Keep a wrong number in its cell and mark it red instead of bouncing it back to the bank.

- Flag an equation as wrong only after it is filled and its numbers do not match, and never judge a placement the moment it lands.

- Count one mistake per mismatched equation. Mistakes are cumulative within a round: undoing or taking a wrong number back never erases them (Nov 28, 2026, at the user's request — a 1/3 mistake must stay 1/3 after going back a step). After 5 mistakes the round ends, and Try again restarts the same puzzle arrangement (limit raised from 3 to 5 on Nov 28, 2026, at the user's request).

- Let the player tap a filled cell to take its number back, drag a tile onto a filled cell to replace it, drag a filled number back to the bank to take it back, and drag a filled number to another blank cell to move it or swap the two numbers.

- Record every placement, take back, move, swap and hint as one undo step, and let the undo button step back one action at a time.

- Restore the tile use, hint count and red marks when undoing, but never the mistake count — mistakes stay counted (Nov 28, 2026, at the user's request). Clear the history on a new puzzle, a reset or a difficulty change.

- Disable the undo button when no step is left to undo.

- Ask before resetting: tapping the reset icon never restarts the round at once — it opens an in-page confirmation asking whether the player really wants to reset, with a 是 (yes) button and a 否 (no) button. Reset the round only when the player taps 是; when they tap 否, close the dialog and leave the game completely untouched — board, mistakes, hints and elapsed time all stay as they were. Use the in-page dialog in the game's own overlay style, never the browser `confirm()`. While the confirmation is open, the timer waits and all other controls ignore input.

## Keep the buttons icon only

- Show every button as an icon alone, with no text beside any icon.

- Give no icon button a highlight background or a dimmed state, and show a state change only through the icon graphic itself, such as a muted speaker or a play icon.

- Use a circular arrow for reset, a speaker for sound, a pause icon that turns into a play icon while paused, a lightbulb for hints, a sort icon for sorting, a curved arrow for undo, and expand arrows for fullscreen that turn into collapse arrows while fullscreen.

- Keep the top bar as reset, sound, pause and hint icons, and keep the sort, undo and fullscreen icons beside the number bank (fullscreen sits next to undo, Nov 19, 2026, at the user's request — moved down from the top bar).

- Remove the new puzzle button from the top bar and keep it only in the completion popup and the 3 mistake popup.

- Use no bold type anywhere, except on the Daily calendar, where today and all past dates are bold and future dates are not (Nov 28, 2026, at the user's request). Load the Baloo 2 font in weights 400 and 500 only.

- Size numbers placed in cells to match the number tiles, and size the operator and equals symbols near 1.4 times the cell text.

- The number bank spans the same width as the board, its tiles stretching to fill it edge to edge — all on one row when the tile count allows (Easy 8, Medium 11); larger banks use two balanced full-width rows (Nov 19, 2026, at the user's request — the bank was wrapping with tiles spilling onto a second row).

## Play sounds

- Play a casino style placement sound on every placement, made of two chip clacks and one coin ding.

- Play a cheerful win jingle of an ascending arpeggio and a bright major chord when the puzzle is complete.

- Use a speaker button as the sound switch, on by default, and keep it controlling the placement sound and the win jingle together.

- Play no sound at all when the sound switch is off, and keep no background music in the game.

## Daily

- Show a calendar of the current month; tapping a date opens that date's Daily puzzle, fixed per date (date-seeded, the same date always deals the same board). Winning a day's puzzle marks that date finished, shown gray and disabled; losing does not, so it can be retried; future dates are gray and disabled.

- After a Daily win the settlement shows a 'Continue' button instead of 'New puzzle', and the top-left back arrow is hidden in that completed state (Nov 28, 2026, at the user's request). Tapping Continue returns to the calendar on the nearest earlier unfinished date, highlighted and ready to tap (looking back up to a year, across month and year boundaries); if none is left unfinished, the calendar opens on the current month. Tapping Daily opens the calendar the same way, highlighting exactly one date: today while it is unfinished, otherwise the nearest earlier unfinished date (Nov 28, 2026, at the user's request — two dates must never be highlighted at once).

## Register a player name

- Show a Register button at the bottom of the landing page; tapping it opens a popup to enter a player name, saved only on this device in local storage (Nov 26, 2026, at the user's request — no host saving, no IP or device info recorded).

- Allow no duplicate names: check case-insensitively with spaces trimmed, and show the error inside the popup without saving anything.

- List the registered names under the button, and hide the Register button once a name is registered on the device (Nov 26, 2026, at the user's request — the game recognizes the registered user).

- Gate Daily and Practice behind registration (Nov 28, 2026, at the user's request): if no name is registered, tapping Daily or Practice opens the Register popup first — no name, no play. Saving a name in that popup carries the player straight into the mode they tapped; cancelling leaves them on the menu, still gated. Once a name is registered, the gate never interferes.

## Build and maintain the game

- Keep the game as a static web artifact named 数学十字谜 with slug `shu-xue-shi-zi-mi`.

- Show no description or instructions text in the game: no how-to paragraph and no footer paragraph (Nov 17, 2026, at the user's request — a good game should be intuitive to the user). Keep only the board, the number bank with its short labels, the status bar, and the icon buttons.

- Keep `index.html` for structure only, with styles in an external stylesheet, and keep JavaScript as ES modules split by concern — follow the `web-development` skill for all code structure. The old "one classic script, no modules" rule is superseded (Nov 19, 2026, at the user's request — a code review found the single 60KB classic script looked like a high-school project). The artifact serves modules from `assets/js/`; the GitHub layout mirrors them under `js/`, and `index.html` points at the module entry.

- Keep functions small and single-purpose per the `web-development` skill; when one grows, split it by extracting a helper and calling it — never change game behavior, wording, sounds or layout while splitting. (The old "15 lines or fewer" rule is superseded — it was aspirational, never enforced, and the file still grew to ~1,500 lines.)

- Add unit tests whenever a new change is made (Nov 28, 2026, at the user's request): cover the new behavior with tests in the game's test suite (the Unit tests view, #/tests), and keep the whole suite green — a change is not done while any test fails. Do not put a Unit tests link on the landing page (Nov 28, 2026, at the user's request) — the suite runs via the #/tests route, not from a visible link.

- Change the game only through `artifact.edit` on that slug, passing the user request as `verbatim_request`.

- Publish the public link again with `artifact.share` after a change, because the link keeps serving the last shared version until then.

- Keep the GitHub copy in sync at `JeffXiao/number-board-game` on the `main` branch, with `index.html`, `js/game.js` and `README.md`, and keep GitHub Pages on so the game plays at `https://jeffxiao.github.io/number-board-game/`.

- Push local files only through the GitHub connector snapshot procedure in `/opt/hatch/connectors/github/references/snapshot-push.md`, using `/opt/hatch/bin/github push-files` with a NUL delimited manifest and the sync record beside the source directory. NOTE (Nov 18, 2026): do not get the new build into the local mirror by reading the artifact's files directly with shell/file tools — artifact files are off-limits to those tools. A GitHub push needs a sanctioned sync path for the built files; if none exists, leave the push undone and tell the user plainly instead of extracting the export by hand.

## Available connectors

- [GitHub](/opt/hatch/connectors/github/CONNECTOR.md) for pushing the game files to the repository and reading them back.

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.

## Alternatives for better results

- Offer a new difficulty or a smaller givens count when the user says the game feels too easy, and confirm the choice before building it.

- Offer to re-share the public link and re-push to GitHub after a change, so the shared copies match the newest version.
