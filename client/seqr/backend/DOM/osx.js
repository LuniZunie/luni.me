import cMath from "../../../module/cMath.js";

export function SetupOSX() {
    document.querySelectorAll(".osx-window:not([data-initiated='true'])").forEach($osx => {
        {
            const $titlebar = $osx.querySelector(":scope > .titlebar");

            {
                const $buttons = $titlebar.querySelector(":scope > .buttons");

                $buttons.querySelector(":scope > .button.close").addEventListener("click", e => {
                    $osx.classList.add("minimize", "closing");
                    window.setTimeout(() => $osx.remove(), 250);
                });
                $buttons.querySelector(":scope > .button.minimize").addEventListener("click", e => {
                    $osx.classList.add("minimize");
                });
                $buttons.querySelector(":scope > .button.zoom").addEventListener("click", e => {
                    $osx.classList.toggle("zoom");
                });
            }

            // allow window to be dragged around while confided to bounds of parent
            const cache = {
                x: undefined,
                y: undefined,
                left: undefined,
                top: undefined
            };
            function MouseMove(e) {
                if (!$osx.classList.contains("dragging")) {
                    return;
                }

                const dx = e.clientX - cache.x,
                      dy = e.clientY - cache.y;

                cache.x = e.clientX;
                cache.y = e.clientY;

                $osx.style.left = `${cache.left += dx}px`;
                $osx.style.top = `${cache.top += dy}px`;
            }

            $titlebar.addEventListener("mousedown", e => {
                cache.x = e.clientX;
                cache.y = e.clientY;
                cache.left = $osx.offsetLeft;
                cache.top = $osx.offsetTop;

                window.addEventListener("mousemove", MouseMove);
                window.addEventListener("mouseup", e => {
                    window.removeEventListener("mousemove", MouseMove);

                    const rect = $osx.getBoundingClientRect(),
                          parentRect = $osx.parentElement.getBoundingClientRect();

                    $osx.style.left = `${cMath.clamp(cache.left, 0, parentRect.width - rect.width)}px`;
                    $osx.style.top = `${cMath.clamp(cache.top, 0, parentRect.height - rect.height)}px`;

                    $osx.classList.remove("dragging");
                });

                $osx.classList.add("dragging");
            });
        }

        $osx.dataset.initiated = true;
    });
}