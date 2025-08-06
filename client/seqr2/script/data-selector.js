import "../../prototype/HTML.js";
import { global } from "./global.js";

export async function LoadDataSelection($) {
    const $dataSelector = document.qs("#data-selector");
    if (!$dataSelector) return;

    const $content = $dataSelector.qs(".content");
    $content.innerHTML = ""; // clear previous content

    const file = global.files[$.dataset.unique];
    if (!file) return;

    // Load file data if not already loaded
    if (!file.isDataLoaded()) {
        await file.loadFileData();
    }

    const save = global.dataSelectorTabs.get($);
    for (const [ type, vs ] of Object.entries(file.types)) {
        const $section = $content.create("div", {
            class: "section",
            dataset: { type }
        }, { end: true });
        $section.create("h3", { content: type }, { end: true });

        const types = save[type] || new Set();
        const $types = $section.create("div", { class: "types" }, { end: true });
        for (const v of vs) {
                const $type = $types.create("div", {
                    class: "type",
                    content: v,
                    dataset: {
                        events: "data-selector>type",
                        type: v,
                    },
                    title: `Select ${type}: ${v}`
                }, { end: true });

                if (types.has(v)) $type.classList.add("selected");
            }
    }
}

export function SaveDataSelection($) {
    const $sections = document.qsa("#data-selector > .content > .section:has(.types > .type.selected)"), save = {};
    for (const $section of $sections) {
        const $types = $section.qsa(".types > .type.selected");
        const set = save[$section.dataset.type] = new Set();
        for (const $type of $types) set.add($type.dataset.type);
    }

    global.dataSelectorTabs.set($, save);
    $.classList.toggle("has-selected", $sections.length > 0);
}