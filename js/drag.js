/* 数学十字谜 — drag & drop module.
   An explicit state machine: idle -> pending -> dragging -> dropped
   -> idle. Two drag sources share one pointer flow: a tile in the
   bank (dropped onto a blank cell to place it) and a number already
   sitting in a filled cell (dragged out by the player — dropped on
   the bank to take the number back, or onto another blank cell to
   move / swap it).
   The click that follows a real drag is consumed by the machine
   itself: pointerup moves it to "dropped", and the very next click
   handler asks consumeClick(), which answers true exactly once and
   returns the machine to idle. No boolean flag cleared by a timer. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  const MACHINE = Object.freeze({
    IDLE: "idle",
    PENDING: "pending",
    DRAGGING: "dragging",
    DROPPED: "dropped"
  });

  function createDragMachine(dependencies) {
    let game = dependencies.game;
    let view = dependencies.view;
    let bankEl = dependencies.bankEl;

    let machineState = MACHINE.IDLE;
    let drag = null;

    function newDrag(event, kind) {
      return {
        kind: kind,
        startX: event.clientX,
        startY: event.clientY,
        ghost: null,
        targetKey: null,
        overBank: false,
        tileIndex: null,
        fromKey: null,
        value: null,
        sourceEl: null
      };
    }
    function pointerDownTile(event, tileIndex, tileEl) {
      if (game.isInputBlocked()) return;
      let tile = game.state().tiles[tileIndex];
      if (!tile || tile.used) return;
      if (event.button != null && event.button !== 0) return;
      drag = newDrag(event, "tile");
      drag.tileIndex = tileIndex;
      drag.value = tile.value;
      drag.sourceEl = tileEl;
      machineState = MACHINE.PENDING;
    }
    function pointerDownCell(event, keyName, cellEl) {
      if (game.isInputBlocked()) return;
      let cell = game.state().cellMap[keyName];
      if (!cell || !cell.filled) return;
      if (event.button != null && event.button !== 0) return;
      drag = newDrag(event, "cell");
      drag.tileIndex = cell.tileIdx;
      drag.value = cell.value;
      drag.fromKey = keyName;
      drag.sourceEl = cellEl;
      machineState = MACHINE.PENDING;
    }

    function dragTargetAt(x, y) {
      let el = document.elementFromPoint(x, y);
      if (!el || !el.closest) return null;
      let cellButton = el.closest("[data-key]");
      if (!cellButton) return null;
      let k = cellButton.dataset.key;
      let cell = game.state().cellMap[k];
      if (!cell || cell.type !== "num" || !cell.blank) return null;
      return k;
    }
    function startGhost() {
      drag.sourceEl.classList.add("dragging");
      let ghost = document.createElement("div");
      ghost.className = "drag-ghost num";
      ghost.textContent = drag.value;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    function updateDragTarget(x, y) {
      let k = dragTargetAt(x, y);
      if (drag.kind === "cell" && k === drag.fromKey) k = null;
      if (k === drag.targetKey) return;
      view.setDropTarget(null);
      drag.targetKey = k;
      view.setDropTarget(k);
    }
    /* dragging a number out of its cell: hovering the tile bank
       marks it as the "take it back" drop zone */
    function updateDragBankHover(x, y) {
      if (drag.kind !== "cell") return;
      let elAt = document.elementFromPoint(x, y);
      let overBank = !!(elAt && elAt.closest && elAt.closest("#bank"));
      if (overBank === drag.overBank) return;
      drag.overBank = overBank;
      bankEl.classList.toggle("return-target", overBank);
    }
    function onPointerMove(event) {
      if (machineState !== MACHINE.PENDING && machineState !== MACHINE.DRAGGING) return;
      if (machineState === MACHINE.PENDING) {
        let dx = event.clientX - drag.startX;
        let dy = event.clientY - drag.startY;
        if (Math.sqrt(dx * dx + dy * dy) < CONFIG.DRAG_THRESHOLD_PX) return;
        startGhost();
        machineState = MACHINE.DRAGGING;
      }
      drag.ghost.style.setProperty("left", event.clientX + "px");
      drag.ghost.style.setProperty("top", event.clientY + "px");
      updateDragTarget(event.clientX, event.clientY);
      updateDragBankHover(event.clientX, event.clientY);
    }
    function clearDragVisuals() {
      if (drag.ghost) drag.ghost.remove();
      drag.sourceEl.classList.remove("dragging");
      view.setDropTarget(null);
      bankEl.classList.remove("return-target");
    }
    function performDrop() {
      if (drag.kind === "cell") {
        if (drag.overBank) game.takeBack(drag.fromKey); // dragged back to the bank: number returned
        else if (drag.targetKey && drag.targetKey !== drag.fromKey) game.moveOrSwap(drag.fromKey, drag.targetKey);
      } else if (drag.targetKey) {
        game.placeTileAt(drag.tileIndex, drag.targetKey);
      }
    }
    function onPointerUp() {
      if (machineState === MACHINE.PENDING) {
        drag = null;
        machineState = MACHINE.IDLE;
        return;
      }
      if (machineState !== MACHINE.DRAGGING) return;
      clearDragVisuals();
      performDrop();
      drag = null;
      /* the browser fires a click for this same gesture next; the
         machine stays in "dropped" until that click is consumed */
      machineState = MACHINE.DROPPED;
    }
    function onPointerCancel() {
      if (machineState !== MACHINE.PENDING && machineState !== MACHINE.DRAGGING) return;
      if (machineState === MACHINE.DRAGGING) clearDragVisuals();
      drag = null;
      machineState = MACHINE.IDLE;
    }
    /* Called by the board/bank click handlers: true when this click
       is the tail of a completed drag and must not also act as a tap. */
    function consumeClick() {
      if (machineState !== MACHINE.DROPPED) return false;
      machineState = MACHINE.IDLE;
      return true;
    }
    function attach() {
      global.addEventListener("pointermove", onPointerMove);
      global.addEventListener("pointerup", onPointerUp);
      global.addEventListener("pointercancel", onPointerCancel);
    }

    return Object.freeze({
      pointerDownTile: pointerDownTile,
      pointerDownCell: pointerDownCell,
      consumeClick: consumeClick,
      attach: attach,
      stateName: function () { return machineState; }
    });
  }

  MC.createDragMachine = createDragMachine;
})(window);
