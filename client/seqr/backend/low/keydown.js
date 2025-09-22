import { UndoRedo } from "../function/undo-redo/manager.js";

document.addEventListener("keydown", e => {
    if (e.target.closest(".override-undo-redo")) {
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
            if (e.shiftKey) {
                UndoRedo.active.redo();
            } else {
                UndoRedo.active.undo();
            }
        } else if (e.key.toLowerCase() === "y") {
            UndoRedo.active.redo();
        }
    }
});