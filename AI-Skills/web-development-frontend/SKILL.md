# Web Development Standards

Read this skill before starting or editing any web artifact (games, tools, pages, GridBook). It is the code-quality bar for all web work. The app-creation skill decides *what* to build and *where* it lives; this skill decides *how the code is written*.

## Why this exists

The math crossword game (Nov 2026) was built feature by feature with no code standard, and a code review found it looked like a high-school project: a single 60KB classic script, `var` everywhere, ~30 window globals, duplicated logic, magic numbers, inline styles from JS, and click suppression by flag plus a 400ms timeout. The game logic was sound; the code was not. These rules exist so that never happens again.

## Architecture: modules split by concern

- Any non-trivial artifact is built as ES modules (`type="module"`), never as one classic script. A trivial static page with a handful of lines may stay a single script; anything with state, generation, or interaction may not.
- Split by concern, one module per job: e.g. `i18n.js` (strings + translation), `puzzle.js` (generation), `solver.js` (solving/validation), `state.js` (the game/app state and its actions), `view.js` (rendering), `audio.js` (sound), `drag.js` (pointer gestures).
- `index.html` holds structure only. All styling lives in an external stylesheet (e.g. `assets/css/game.css`), linked from the page — never a `<style>` block in the HTML.
- No build tooling is assumed. Modules are plain ES modules loaded by the browser; keep them dependency-free unless a library is genuinely needed.

## State: one owner, explicit actions

- State has exactly one owner: a class or a factory function (e.g. `class MathCrossword` / `createGame()`), holding private state (`#state` or a closure). Nothing else mutates it.
- No top-level mutable globals. `const`/`let` only — never `var`. A top-level declaration must be a module-level constant, an exported class/factory, or an import.
- All changes go through explicit actions on the owner (`placeTile()`, `takeBack()`, `useHint()`, `undo()`), never by reaching into the state object from a handler.
- Undo/history stores plain serialisable snapshots (cell key → `{ value, tileId }`, plus counts and flags) with stable ids — never live object references restored by `indexOf`.
- One render entry point. The owner notifies the view (`subscribe` / a single `render()` call); handlers never re-render piecemeal from scattered places.

## Constants: name every number

- No magic numbers. Every literal that is not 0 or 1 lives in one frozen config object, e.g. `const CONFIG = Object.freeze({ MAX_MISTAKES: 3, HISTORY_LIMIT: 100, SOLVER_NODE_LIMIT: 60000, DRAG_THRESHOLD_PX: 7, TOAST_MS: 1700 })`.
- That includes generation attempts, solver caps, drag thresholds, toast/flash durations, board sizing, font factors, factor ranges, and audio frequencies/gains. If a number appears in more than one place, it is a constant. If it appears once, it is still a constant unless it is 0 or 1.

## No duplication

- One operation table instead of near-identical functions. Four fillers (`fillPlus`/`fillMinus`/`fillTimes`/`fillDivide`) repeating the same skeleton become one table-driven `fillEquation(op, known, max)` with small per-op pure functions. One op table serves both `eqHolds` and `neededValue` — never two parallel dispatches.
- One lookup helper for one concept. Tile lookup by value/used is written once and reused, not re-implemented in four places.
- One guard helper for one recurring check. A `paused || over || confirmOpen` guard used by six handlers becomes a single `isInputBlocked()` the handlers call.

## DOM: delegate, update surgically

- Event delegation, not per-element listeners. One `click`/`pointerdown` listener on `#board` and one on `#bank`, dispatching on `data-key`/`data-idx` — never a fresh listener per cell or tile.
- Never destroy and rebuild the whole board/bank with `innerHTML = ""` on every placement. Update only the changed cell/tile (classes and text). Full re-renders happen only on a new puzzle, a difficulty change, or a language change.
- Drag and gestures are an explicit state machine (`idle → dragging → dropped/cancelled`), owned by the drag module. Never suppress clicks with a boolean flag cleared by a `setTimeout` — that is a timing hack, and it breaks.

## Styling: CSS classes, not `el.style.*`

- Presentation changes go through CSS classes and CSS custom properties, never `element.style.*` assignments from JS. Board sizing is a variable (`--cols`) with `grid-template-columns: repeat(var(--cols), 1fr)`; visibility is a `.hidden` class; a drag ghost is a `.drag-ghost` class.
- The only exception is a genuinely dynamic value that has no class equivalent (e.g. a drag ghost's x/y), set via `style.setProperty`. Everything else is a class.

## Naming and functions

- Names say what the thing is. `T()` becomes `translate()`, `ri()` becomes `randomInt()`, `S` becomes `solverState`, `sorted` becomes `sortedTiles`. Short names are allowed only for a loop index or a genuinely local throwaway.
- Functions are small and single-purpose. When one grows, split it by extracting a helper and calling it — never by changing behaviour, wording, sounds, or layout while splitting. A stated line limit is a rule, not an aspiration: if it cannot be enforced, it is not a rule.
- Keep the good naming that already exists (`computeWrongKeys`, `clearStaleBadKeys`, `mostSharedKey`, `findSolution`) and raise the rest to that level.

## Accessibility and theming (keep, don't regress)

- Preserve what the review found worth keeping: `aria-label`/`aria-pressed`, `role="menu"`/`menuitemradio` where used, focus-visible outlines, dark-mode CSS variables, and `prefers-reduced-motion` guards for shake/confetti.
- Any refactor must preserve all of these, plus the game's existing behaviour (see Verification).

## Verification: nothing is done until the served build is checked

- A build finishing is not proof it works. Confirm the result from the running artifact or the live deployment — never from the build log alone.
- For a game: fresh puzzles on every difficulty, hint solves, undo, drag/take-back/move/swap, pause/reset, language switch, and the win/lose paths — on the served build, before calling it done.
- For any artifact: test the main flow the way its user will, then the empty, loading, and error states, the relevant screen sizes, and basic accessibility.
- When the user reports that an artifact misbehaves or asks how it behaves, use `artifact.inspect` rather than reading its source yourself.

## Applying this to existing work

- The math crossword game's old rule — "keep all JavaScript in js/game.js as one classic script with no modules, imports or exports" — is superseded by this skill. The refactor shape is: extract CSS to `assets/css/game.css`; split `game.js` into the modules above; a frozen `CONFIG`; one op table; delegation + targeted updates; a drag state machine; serialisable undo snapshots. Preserve every gameplay rule in the math crossword skill (difficulties, the one-given rule, 3-mistake limit, hint, undo, sounds, EN/ZH persistence) and re-verify on the served build before shipping.
- Apply the same bar to Sudoku and GridBook on their next change, and to any new web artifact from the start.

## Available connectors

- [GitHub](/opt/hatch/connectors/github/CONNECTOR.md) for pushing code to a repository and reading it back.
- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.
