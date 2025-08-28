import { DataSelectorUndoRedo } from "../function/undo-redo/instance.js";

export function CoverEventHandler($el) {
    $el.addEventListener("click", e => {
        document.querySelectorAll(".float:not(.hidden)").forEach($float => {
            $float.classList.add("hidden");
            switch ($float.id) {
                case "data-selector": {
                    DataSelectorUndoRedo.deactivate();
                } break;
            }
        });
    });
};