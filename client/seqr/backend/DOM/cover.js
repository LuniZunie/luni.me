import { global } from "../global.js";
import { MainUndoRedo } from "../function/undo-redo/instance.js";

export function CoverEventHandler($el) {
    $el.addEventListener("click", e => {
        document.querySelectorAll(".float:not(.hidden)").forEach($float => {
            $float.classList.add("hidden");
            switch ($float.id) {
                case "data-selector": {
                    if (global.undoRedoCache?.has($float)) {
                        global.undoRedoCache.get($float).forEach(manager => {
                            manager.unfocus();
                            manager.clear();
                        });

                        global.undoRedoCache.delete($float);
                    }
                } break;
            }
        });
    });
};