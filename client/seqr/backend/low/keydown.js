import { GetActiveUndoRedoManager } from "../function/undo-redo/instance.js";

document.addEventListener("keydown", e => {
    if (e.target.closest(".override-undo-redo")) {
        return;
    }

    const manager = GetActiveUndoRedoManager();
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