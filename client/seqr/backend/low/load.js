import { LoadColorSelector } from "../function/color-selector.js";
import { Resize } from "./resize.js";

window.addEventListener("load", () => {
    window.requestAnimationFrame(() => document.documentElement.querySelector("#load").classList.add("hidden"));

    {
        const narrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;
        if (narrow) {
            const $groups = document.body.querySelector("#groups");

            $groups.classList.add("collapsed");
            $groups.querySelectorAll(".button-plus > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click());
        }
    }

    LoadColorSelector();

    Resize();
});