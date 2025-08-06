import { MainUndoRedo, DataSelectorUndoRedo, ColorSelectorUndoRed } from "../function/undo-redo/instance.js";

document.addEventListener("keydown", e => {
    if (e.target.closest(".override-undo-redo")) {
        return;
    }

    let manager;
    if (DataSelectorUndoRedo.active) {
        manager = DataSelectorUndoRedo;
    } else if (ColorSelectorUndoRed.active) {
        manager = ColorSelectorUndoRed;
    } else {
        manager = MainUndoRedo;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
            if (e.shiftKey) {
                manager.redo();
            } else {
                manager.undo();
            }
        } else if (e.key.toLowerCase() === "y") {
            manager.redo();
        }
    }
});