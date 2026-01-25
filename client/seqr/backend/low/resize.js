import { GroupsResize } from "../function/groups-resize.js";

export function Resize(e) {
    document.body.classList.add("no-transition");

    GroupsResize();

    window.requestAnimationFrame(() => document.body.classList.remove("no-transition"));
};

window.addEventListener("resize", Resize);