import cMath from "../../../module/cMath.js";
import Color from "../../../module/color.js";

export function UpdateRenderSettings(min, max, preserve = false) {
    const $settings = document.querySelector("#render-settings");

    if (min !== undefined && max !== undefined) {
        const $view = $settings.querySelector(".content > .section.view-range");

        $view.dataset.min = min;
        $view.dataset.max = max;

        const $min = $range.querySelector(".min"),
              $max = $view.querySelector(".max"),
              $minInput = $view.querySelector(".inputs > .min"),
              $maxInput = $view.querySelector(".inputs > .max");

        $minInput.dataset.min = min;
        $minInput.dataset.max = max;

        $maxInput.dataset.min = min;
        $maxInput.dataset.max = max;

        const $range = $view.querySelector(".range");

        let left = 0,
            right = 1;

        if (preserve) {
            const minText = $min.textContent,
                  maxText = $max.textContent;

            if (minText && maxText) {
                const currentMin = parseFloat(minText),
                      currentMax = parseFloat(maxText);

                if (!isNaN(currentMin) && !isNaN(currentMax)) {
                    const clampedMin = cMath.clamp(currentMin, min, max),
                          clampedMax = cMath.clamp(currentMax, min, max);

                    const delta = max - min;
                    if (delta > 0) {
                        left = (clampedMin - min) / delta;
                        right = (clampedMax - min) / delta; /* TEST is it supposed to be clampedMax - max? */
                    }
                }
            }
        }

        $range.style.setProperty("--left", left);
        $range.style.setProperty("--right", right);

        const delta = max - min,
              viewMin = Math.round(min + delta * left),
              viewMax = Math.round(min + delta * right);

        $min.textContent = viewMin;
        $max.textContent = viewMax;

        $minInput.dataset.value = viewMin;
        $minInput.querySelector(".input").textContent = viewMin;

        $maxInput.dataset.value = viewMax;
        $maxInput.querySelector(".input").textContent = viewMax;
    }

    {
        const $content = document.querySelector("#render-settings > .content > .section.text-style > .content"),
              $preview = $content.querySelector(".preview");

        $preview.style.textAlign = $content.querySelector(".align > .content > .button.selected")?.dataset.value || "center";

        const $style = $content.querySelector(".style > .content"),
              style = $preview.querySelector("span").style;

        {
            if ($style.querySelector(".button.selected[data-value='bold']")) {
                style.fontWeight = "bold";
            } else {
                style.fontWeight = "normal";
            }

            if ($style.querySelector(".button.selected[data-value='italic']")) {
                style.fontStyle = "italic";
            } else {
                style.fontStyle = "normal";
            }

            if ($style.querySelector(".button.selected[data-value='outline']")) {
                style.outline = ".1vmin solid currentcolor";
            } else {
                style.outline = "none";
            }

            const decoration = [];
            if ($style.querySelector(".button.selected[data-value='underline']")) {
                decoration.push("underline");
            }
            if ($style.querySelector(".button.selected[data-value='strikethrough']")) {
                decoration.push("line-through");
            }
            if ($style.querySelector(".button.selected[data-value='overline']")) {
                decoration.push("overline");
            }

            style.textDecoration = decoration.join(" ") || "none";
        }

        const color = $content.querySelector(".font > .content > .color > input")?.value;
        style.color = color;

        $settings.querySelector(".content > .section.background > .content > .preview").style.color = color;
        $preview.style.background = Color.Shade(new Color(color), "#101010", "#F0F0F0");

        style.fontFamily = $content.querySelector(".font > .content > .family > select")?.value;
    }
};