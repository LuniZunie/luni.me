import { global } from "../../../global.js";
import { ChunkedProxy } from "../../file/file-storage/proxy.js";

let memory = { };
export function RememberGroupForDataSelector(name) {
    memory = { };

    const members = global.groups.get(name).members,
          filesWithSelection = new Set();
    for (const { selectors: [ a, b, c ] } of members) { /* TODO: make infinitely deep */
        filesWithSelection.add(a);

        let temp = memory[a] ??= { };
        temp = temp[b] ??= new Set();
        temp.add(c);
    }

    return filesWithSelection;
}

export function HasSelectionsDataSelector(name) {
    return Object.keys(memory[name] ?? { }).length > 0;
}

export function UpdateMemoryForDataSelector([ a, b, c ], state) {
    let set = memory[a] ??= { };
    set = set[b] ??= new Set();
    if (state) {
        set.add(c);
    } else {
        set.delete(c);
        if (set.size === 0) {
            delete memory[a][b];
        }
    }
}

export async function LoadDataSelector(fileName) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs"),
          $content = $selector.querySelector(":scope > .content");

    $tabs.querySelectorAll(":scope > .tab.selected").forEach($el => $el.classList.remove("selected"));
    $tabs.querySelector(`:scope > .tab[data-value="${fileName}"]`)?.classList.add("selected");

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

        const selectorCache = typeCache[type] || new Set(),
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

            if (selectorCache.has(selector)) {
                $selector.classList.add("selected");
            }
        }
    }
}

export async function SaveDataSelector(fileName) {
    const $sections = document.querySelectorAll("#data-selector > .content > .section:has(.selectors > .selector.selected)");

    const save = { };
    for (const $section of $sections) {
        const $selectors = $section.querySelectorAll(":scope > .selectors > .selector.selected");

        const set = save[$section.dataset.value] = new Set();
        for (const $selector of $selectors) {
            set.add($selector.dataset.value);
        }
    }

    memory[fileName] = save;
    $tabs.querySelector(`:scope > .tab[data-value="${fileName}"]`)?.classList.toggle("has-selected", $sections.length > 0);
}