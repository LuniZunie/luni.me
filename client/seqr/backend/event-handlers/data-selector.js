import { HasSelectionsDataSelector, LoadDataSelector, UpdateMemoryForDataSelector } from "../function/groups/data-selector/main.js";
import { DataSelectorUndoRedo } from "../function/undo-redo/instance.js";

export function DataSelectorTabEventHandler($tab) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs");

    $tab.addEventListener("click", e => {
        $tabs.querySelectorAll(":scope > .tab.selected").forEach($el => $el.classList.remove("selected"));
        $tab.classList.add("selected");

        LoadDataSelector($tab.dataset.value);
    });
}

export function DataSelectorToggleEventHandler($toggle) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs"),
          $content = $selector.querySelector(":scope > .content");

    $toggle.addEventListener("click", e => {
        const state = $toggle.classList.contains("selected");

        const $tab = $tabs.querySelector(":scope > .tab.selected");

        const file = $tab.dataset.value,
              type = $toggle.closest(".section").dataset.value,
              selector = $toggle.dataset.value;

        DataSelectorUndoRedo.execute({
            description: `${state ? "Deselect" : "Select"} selector "${file} ${type} ${selector}"`,

            goto() {
                $tab.click();
            },

            execute() {
                $content.querySelector(`.section[data-value="${type}"] > .selectors > .selector[data-value="${selector}"]`).classList.toggle("selected", state);

                UpdateMemoryForDataSelector([ file, type, selector ], state);
                $tab.classList.toggle("has-selected", HasSelectionsDataSelector(file));
            },
            undo() {
                $content.querySelector(`.section[data-value="${type}"] > .selectors > .selector[data-value="${selector}"]`).classList.toggle("selected", !state);

                UpdateMemoryForDataSelector([ file, type, selector ], !state);
                $tab.classList.toggle("has-selected", HasSelectionsDataSelector(file));
            }
        })
    });
}