import { ButtonPlusFunctions } from "../DOM/button-plus.js";

function Highlight($el, callback) {
    document.querySelectorAll(".highlight").forEach($el => $el.remove());

    const $highlight = document.createElement("div");
    $highlight.className = "highlight";
    document.body.appendChild($highlight);

    let follow = true;
    function Follow() {
        if (!follow || callback?.($el)) {
            $highlight.remove();
            return;
        }

        const rect = $el.getBoundingClientRect(),
              cs = getComputedStyle($highlight);
        $highlight.style.left = `calc(${(rect.left + rect.right) / 2}px - ${cs.width} / 2)`;
        $highlight.style.top = `calc(${(rect.top + rect.bottom) / 2}px - ${cs.height} / 2)`;

        window.requestAnimationFrame(Follow);
    }
    Follow();

    $el.addEventListener("mouseover", () => {
        follow = false;
    });
}

export function LocatorEventHandler($locator) {
    $locator.addEventListener("click", e => {
        e.stopPropagation();
        switch ($locator.dataset.value) {
            case "file-upload": {
                const $import = document.querySelector("#top > .import");

                ButtonPlusFunctions.get($import)?.open();
                Highlight($import.querySelector(":scope > .cycles > .cycle.type > [data-value='file']"), $el => {
                    return $el.parentElement.classList.contains("hidden");
                });
            } break;
            case "file-editor": {
                const $import = document.querySelector("#top > .import");

                ButtonPlusFunctions.get($import)?.open();
                Highlight($import.querySelector(":scope > .cycles > .cycle.type > [data-value='code']"), $el => {
                    return $el.parentElement.classList.contains("hidden");
                });
            } break;
        }
    });
};