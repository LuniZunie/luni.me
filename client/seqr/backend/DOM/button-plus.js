function Follow($cycle) {
    if ($cycle.classList.contains("hidden")) {
        return;
    }

    let [
        anchorX = "center:center",
        anchorY = "center:center",
        offsetX = "0",
        offsetY = "0"
    ] = ($cycle.dataset.position ?? "center:center center:center 0 0").split(/\s+/);

    const [ iconAnchorX = "center", cycleAnchorX = "center" ] = anchorX.split(":");
    const [ iconAnchorY = "center", cycleAnchorY = "center" ] = anchorY.split(":");

    const $icon = $cycle.closest(".button-plus").querySelector(":scope > .icon");

    const iconRect = $icon.getBoundingClientRect();
    let iconX, iconY;
    switch (iconAnchorX) {
        case "left": {
            iconX = iconRect.left;
        } break;
        default: {
            console.warn("DOM/button-plus:Follow()", "Invalid anchorX", anchorX, $cycle);
        } /* Fallthrough */
        case "center": {
            iconX = iconRect.left + iconRect.width / 2;
        } break;
        case "right": {
            iconX = iconRect.right;
        } break;
    }
    switch (iconAnchorY) {
        case "top": {
            iconY = iconRect.top;
        } break;
        default: {
            console.warn("DOM/button-plus:Follow()", "Invalid anchorY", anchorY, $cycle);
        } /* Fallthrough */
        case "center": {
            iconY = iconRect.top + iconRect.height / 2;
        } break;
        case "bottom": {
            iconY = iconRect.bottom;
        } break;
    }

    if (parseFloat(offsetX) == offsetX) {
        offsetX += "px";
    }
    if (parseFloat(offsetY) == offsetY) {
        offsetY += "px";
    }

    const cycleRect = $cycle.getBoundingClientRect();
    let cycleX, cycleY;
    switch (cycleAnchorX) {
        case "left": {
            cycleX = iconX;
        } break;
        default: {
            console.warn("DOM/button-plus:Follow()", "Invalid anchorX", anchorX, $cycle);
        } /* Fallthrough */
        case "center": {
            cycleX = iconX - cycleRect.width / 2;
        } break;
        case "right": {
            cycleX = window.innerWidth - iconX;
        } break;
    }
    switch (cycleAnchorY) {
        case "top": {
            cycleY = iconY;
        } break;
        default: {
            console.warn("DOM/button-plus:Follow()", "Invalid anchorY", anchorY, $cycle);
        } /* Fallthrough */
        case "center": {
            cycleY = iconY - cycleRect.height / 2;
        } break;
        case "bottom": {
            cycleY = window.innerHeight - iconY;
        } break;
    }

    if (cycleAnchorX === "right") {
        $cycle.style.right = `calc(${cycleX}px - ${offsetX})`;
        $cycle.style.left = "";
    } else {
        $cycle.style.left = `calc(${cycleX}px + ${offsetX})`;
        $cycle.style.right = "";
    }

    if (cycleAnchorY === "bottom") {
        $cycle.style.bottom = `calc(${cycleY}px - ${offsetY})`;
        $cycle.style.top = "";
    } else {
        $cycle.style.top = `calc(${cycleY}px + ${offsetY})`;
        $cycle.style.bottom = "";
    }

    window.requestAnimationFrame(() => Follow($cycle));
}

function Close($button) {
    const $icon = $button.querySelector(":scope > .icon");
    const $normal = $icon?.querySelector("svg:not(.cancel)"),
          $cancel = $icon?.querySelector(":scope > .cancel");

    $button.querySelectorAll(".cycles > .cycle:not(.hidden").forEach($cycle => $cycle.classList.add("hidden"));
    if ($cancel) {
        $cancel.classList.add("hidden");
        $normal.classList.remove("hidden");
    }
}

export function CloseAllButtonPlus() {
    document.querySelectorAll(".button-plus").forEach($button => Close($button));
}

const $cache = new Map();
export { $cache as ButtonPlusFunctions };

export function SetupButtonPlus() {
    document.querySelectorAll(".button-plus:not([data-initiated='true'])").forEach($button => {
        const $terminus = $button.querySelector(":scope > .terminus");

        const $icon = $button.querySelector(":scope > .icon");
        if (!$icon) return;

        const $normal = $icon.querySelector("svg:not(.cancel)"),
              $cancel = $icon.querySelector("svg.cancel");

        function Cycle(i = null) {
            const $cycles = $button.querySelector(":scope > .cycles");
            if (!$cycles) {
                $terminus.click();
                return;
            }

            const $cycle = $cycles.querySelector(":scope > .cycle:not(.hidden)");

            let $next;
            if ($cycle && i === null) {
                $next = $cycle.nextElementSibling;
            } else {
                $next = $cycles.querySelector(`:scope > .cycle:nth-child(${i ?? 1})`);
            }

            if ($next) {
                $cycle?.classList.add("hidden");
                $next.classList.remove("hidden");

                Follow($next);
            } else {
                $terminus.click();
                Close($button);
            }
        }

        function Open(i = 1) {
            document.querySelectorAll(".button-plus").forEach($other => {
                if ($button !== $other) {
                    Close($other);
                }
            });

            if ($cancel) {
                $normal.classList.add("hidden");
                $cancel.classList.remove("hidden");
            }

            Cycle(i);
        }

        function Toggle(e) {
            if ($normal.classList.contains("hidden")) {
                Close($button);
            } else {
                Open(null);
            }
        }

        $button.querySelector(":scope > .icon").addEventListener("click", Toggle);
        $cache.set($button, {
            open: Open,
            close: () => Close($button),

            toggle: Toggle,
            cycle: Cycle
        });

        $button.querySelectorAll("[data-button-plus-event]").forEach($el => {
            const events = $el.dataset.buttonPlusEvent.split(",");
            for (const event of events) {
                switch (event) {
                    case "click": {
                        $el.addEventListener("click", () => Cycle());
                    } break;
                    case "enter": {
                        $el.addEventListener("keydown", e => {
                            if (e.key === "Enter") {
                                Cycle();
                            }
                        });
                    } break;
                }
            }

            delete $el.dataset.buttonPlusEvent;
        });

        $button.dataset.initiated = true;
    });
}