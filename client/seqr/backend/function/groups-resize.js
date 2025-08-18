import cMath from "../../../module/cMath.js";

const cache = {
    dragging: false,
    x: 0, w: 0,
    update: null,
};

const config = {
    width: {
        get min() {
            return window.innerWidth * .2;
        },
        get max() {
            return window.innerWidth * .7;
        }
    }
};

export function GroupsResize() {
    const $groups = document.body.querySelector("#groups"),
          $resizeHandle = document.body.querySelector("#groups-resize-handle");

    const rect = $groups.querySelector(":scope > .content").getBoundingClientRect(),
          style = $resizeHandle.style;

    style.top = `${rect.top}px`;
    style.left = `${rect.left}px`;
};

function MouseMove(e) {
    if (!cache.dragging) {
        return;
    }

    if (cache.update) {
        window.cancelAnimationFrame(cache.update);
        cache.update = null;
    }

    cache.update = window.requestAnimationFrame(() => {
        const dx = cache.x - e.clientX;
        const w = cMath.clamp(cache.w + dx, config.width.min, config.width.max),
              vw = (w / window.innerWidth) * 100;

        document.documentElement.style.setProperty("--groups-width", `${vw}vw`);
    });

    window.requestAnimationFrame(GroupsResize);
    e?.preventDefault();
}
function MouseUp(e) {
    if (!cache.dragging) {
        return;
    }
    cache.dragging = false;

    if (cache.update) {
        window.cancelAnimationFrame(cache.update);
        cache.update = null;
    }

    window.requestAnimationFrame(() => document.body.classList.remove("no-transition"));

    const w = document.documentElement.style.getPropertyValue("--groups-width");
    if (w) {
        localStorage.setItem("SeqR:groups-width", w);
    }

    document.removeEventListener("mousemove", MouseMove);
    document.removeEventListener("mouseup", MouseUp);

    e?.preventDefault();
}

export function GroupsResizeEventHandler($el) {
    $el.addEventListener("mousedown", e => {
        if (e.button !== 0) return;

        cache.dragging = true;
        cache.x = e.clientX;

        document.body.classList.add("no-transition");

        const cs = window.getComputedStyle(document.body),
              size = cs.getPropertyValue("--groups-width");

        let vw = 30;
        if (size.includes("vw")) {
            vw = parseFloat(size);
        } else if (size.includes("px")) {
            vw = (parseFloat(size) / window.innerWidth) * 100;
        }

        cache.w = (vw / 100) * window.innerWidth;

        document.addEventListener("mousemove", MouseMove);
        document.addEventListener("mouseup", MouseUp);

        e?.preventDefault();
    });
};