import { global } from "../global.js";
import { GetMemoryForDataSelector, HasSelectionsDataSelector, LoadDataSelector, UpdateMemoryForDataSelector } from "../function/groups/data-selector/main.js";
import { UndoRedo } from "../function/undo-redo/manager.js";
import { MainUndoRedo } from "../function/undo-redo/instance.js";
import { AddMemberToGroup, UpdateGroupUUID } from "../function/groups/main.js";

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

        let cache;
        global.undoRedoCache ??= new Map();
        if (global.undoRedoCache.has($selector)) {
            cache = global.undoRedoCache.get($selector);
        } else {
            cache = new Map();
            global.undoRedoCache.set($selector, cache);
        }

        if (!cache.has($tab)) {
            const manager = new UndoRedo();
            manager.focus();
            cache.set($tab, manager);
        }

        cache.get($tab).execute({
            description: `${state ? "Deselect" : "Select"} selector "${file} ${type} ${selector}"`,

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

export function DataSelectorSaveEventHandler($button) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs"),
          $content = $selector.querySelector(":scope > .content");

    $button.addEventListener("click", e => {
        const memory = GetMemoryForDataSelector();
        function Flatten(obj, path = [ ], rtn = [ ]) {
            for (const [ key, value ] of Object.entries(obj)) {
                const thisPath = path.concat(key);
                if (typeof value === "object") {
                    Flatten(value, thisPath, rtn);
                } else {
                    rtn.push(thisPath);
                }
            }

            return rtn;
        }

        const flatMemory = Flatten(memory);
        if (global.groups.has($selector.dataset.group)) {
            const group = global.groups.get($selector.dataset.group);

            const flatOldMemory = [ ];
            group.members.forEach(member => {
                flatOldMemory.push({
                    selectors: member.selectors.slice(),
                    settings: { ...member.settings }
                });
            });

            const $group = group.element,
                  $members = $group.querySelector(":scope > .members");
            MainUndoRedo.execute({
                description: `Updated members in group "${group.name}"`,

                where: "groups",
                type: "edit",
                data: { name: group.name },

                execute() {
                    group.members = [ ];
                    $members.innerHTML = "";

                    for (const selectors of flatMemory) {
                        AddMemberToGroup(group, selectors);
                    }
                    UpdateGroupUUID(group);
                },
                undo() {
                    group.members = [ ];
                    $members.innerHTML = "";

                    for (const member of flatOldMemory) {
                        AddMemberToGroup(group, member.selectors, member.settings);
                    }
                    UpdateGroupUUID(group);
                }
            })
        }

        $tabs.innerHTML = "";
        $content.innerHTML = "";
    });
}