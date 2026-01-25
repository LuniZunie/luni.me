import { global } from "../../../global.js";
import { ChunkedProxy } from "../../file/file-storage/proxy.js";
import { UndoRedo } from "../../undo-redo/manager.js";

let memory = { };
export function RememberGroupForDataSelector(name) {
    memory = { };

    const members = global.groups.get(name).members,
          filesWithSelection = new Set();
    for (const { selectors } of members) { /* TODO: make infinitely deep */
        filesWithSelection.add(selectors[0]);

        let temp = memory,
            len = selectors.length;
        for (let i = 0; i < len; i++) {
            if (i === len - 1) {
                temp[selectors[i]] = true;
            } else {
                temp = temp[selectors[i]] ??= { };
            }
        }
    }

    document.querySelector("#data-selector").dataset.group = name;

    return filesWithSelection;
}

export function HasSelectionsDataSelector(name) {
    return Object.keys(memory[name] ?? { }).length > 0;
}

export function UpdateMemoryForDataSelector(selectors, state) {
    let temp = memory;

    const stack = [ ],
          len = selectors.length;
    for (let i = 0; i < len; i++) {
        if (i === len - 1) {
            if (state === false) {
                delete temp[selectors[i]];
                for (const [ s, key ] of stack) {
                    if (Object.keys(s[key]).length === 0) {
                        delete s[key];
                    } else {
                        break;
                    }
                }
            } else {
                temp[selectors[i]] = true;
            }
        } else {
            stack.unshift([ temp, selectors[i] ]);
            temp = temp[selectors[i]] ??= { };
        }
    }
}

export function GetMemoryForDataSelector() {
    return memory;
}

export async function LoadDataSelector(fileName) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs"),
          $content = $selector.querySelector(":scope > .content");

    $tabs.querySelectorAll(":scope > .tab.selected").forEach($el => $el.classList.remove("selected"));

    const $tab = $tabs.querySelector(`:scope > .tab[data-value="${fileName}"]`);
    if (!$tab) {
        return;
    }

    $tab.classList.add("selected");

    $content.innerHTML = "";

    const file = global.files?.[fileName];
    if (!file) {
        throw new TypeError("@app/SeqR/backend/function/data-selector/main.js:LoadDataSelector(): <arguments[0]> must point to a file.");
    } else if (!file.isMetadataLoaded()) {
        await file.load(ChunkedProxy.Type.Metadata);
    }

    const typeCache = memory[fileName] || { };
    for (const [ type, selectors ] of Object.entries(file.types)) {
        const $section = document.createElement("div");
        {
            $section.className = "section";

            $section.dataset.value = type;

            $content.appendChild($section);
        }

        const $title = document.createElement("h3");
        {
            $title.textContent = type;

            $section.appendChild($title);
        }

        const selectorCache = typeCache[type] || { },
              $selectors = document.createElement("div");
        {
            $selectors.className = "selectors";

            $section.appendChild($selectors);
        }

        for (const selector of Object.keys(selectors)) {
            const $selector = document.createElement("div");
            {
                $selector.className = "selector";
                $selector.title = `${fileName} ${type} ${selector}`;
                $selector.textContent = selector;

                $selector.dataset.value = selector;
                $selector.dataset.event = "toggle,data-selector:toggle";

                $selectors.appendChild($selector);
            }

            if (selectorCache[selector]) {
                $selector.classList.add("selected");
            }
        }
    }

    let cache;
    global.undoRedoCache ??= new Map();
    if (global.undoRedoCache.has($selector)) {
        cache = global.undoRedoCache.get($selector);
    } else {
        cache = new Map();
        global.undoRedoCache.set($selector, cache);
    }

    if (cache.has($tab)) {
        cache.get($tab).focus();
    } else {
        const manager = new UndoRedo();
        manager.focus();
        cache.set($tab, manager);
    }
}

export async function SaveDataSelector(fileName) {
    const $sections = document.querySelectorAll("#data-selector > .content > .section:has(.selectors > .selector.selected)");

    const save = { };
    for (const $section of $sections) {
        const $selectors = $section.querySelectorAll(":scope > .selectors > .selector.selected");

        const temp = save[$section.dataset.value] = { };
        for (const $selector of $selectors) {
            temp[$selector.dataset.value] = true;
        }
    }

    memory[fileName] = save;
    $tabs.querySelector(`:scope > .tab[data-value="${fileName}"]`)?.classList.toggle("has-selected", $sections.length > 0);
}