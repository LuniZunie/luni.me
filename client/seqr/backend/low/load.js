import { LoadColorSelector } from "../function/color-selector.js";
import { IsViewNarrow } from "../function/is-view-narrow.js";
import { Resize } from "./resize.js";

window.addEventListener("load", () => {
    window.requestAnimationFrame(() => document.documentElement.querySelector("#load").classList.add("hidden"));

    {
        if (IsViewNarrow()) {
            const $groups = document.body.querySelector("#groups");

            $groups.classList.add("collapsed");
            $groups.querySelectorAll(".button-plus > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click());
        }
    }

    LoadColorSelector();

    Resize();
});