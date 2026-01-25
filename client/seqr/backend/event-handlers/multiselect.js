import { global } from "../global.js";

export function MultiselectEventHandler($el) {
    $el.addEventListener("click", e => {
        if (e.target.dataset.stopSelectPropagation === "true") {
            return;
        }
        for (const selector of [ ".button", ".button-plus" ]) {
            const $selector = e.target.closest(selector);
            if ($selector && $el.contains($selector)) {
                return;
            }
        }

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            $el.classList.toggle("selected");
        } else if (e.shiftKey && global.lastSelected) {
            $el.parentElement?.querySelectorAll(".selected").forEach($selected => $selected.classList.remove("selected"));

            let $start, $end;
            const following = global.lastSelected.compareDocumentPosition($el) & Node.DOCUMENT_POSITION_FOLLOWING;
            if (following) {
                $start = global.lastSelected;
                $end = $el;
            } else {
                $start = $el;
                $end = global.lastSelected;
            }

            let $current = $start;
            while ($current && $current !== $end) {
                $current.classList.add("selected");
                $current = $current.nextElementSibling;
            }
            $end.classList.add("selected");

            return;
        } else {
            $el.parentElement?.querySelectorAll(".selected").forEach($selected => $selected.classList.remove("selected"));
            $el.classList.add("selected");
        }

        global.lastSelected = $el;
    });
};

export function CancelMultiselect(e) {
    let $closest = e.target.closest("[data-multiselect]");
    if ($closest) {
        document.querySelectorAll(`[data-multiselect]:not([data-multiselect="${$closest.dataset.multiselect}"]).selected`)
            .forEach($el => $el.classList.remove("selected"));
    } else {
        $closest = e.target.closest("[data-pseudo-multiselect]");
        if ($closest) {
            const pseudo = $closest.dataset.pseudoMultiselect;
            if (pseudo !== "*") {
                document.querySelectorAll(`[data-multiselect]:not([data-multiselect="${pseudo}"]).selected`)
                    .forEach($el => $el.classList.remove("selected"));
            }
        } else {
            document.querySelectorAll("[data-multiselect].selected").forEach($el => $el.classList.remove("selected"));
            global.lastSelected = null;
        }
    }
};