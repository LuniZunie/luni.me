import "../../prototype/HTML.js";
import { ColorToHex, HexToColor, InverseShade } from "./color.js";

export default function UpdateDrawSettings(min, max, preserveViewRange = false) {
    const $drawSettings = document.qs("#draw-settings");

    {
        const $viewRange = $drawSettings.qs(".content > .section.view-range");

        if (min !== undefined && max !== undefined) {
            // Always update the bounds (data range)
            $viewRange.dataset.min = min;
            $viewRange.dataset.max = max;

            // Update input min/max attributes
            $viewRange.qs(".inputs > .min").min = min;
            $viewRange.qs(".inputs > .max").max = max;
            $viewRange.qs(".inputs > .min").max = max;
            $viewRange.qs(".inputs > .max").min = min;

            // Get current view range percentages and calculate new view range
            const $range = $viewRange.qs(".range");
            let minPercent = 0;
            let maxPercent = 1;

            if (preserveViewRange) {
                // Try to preserve the current actual view range values
                const currentMinText = $range.qs(".min").textContent;
                const currentMaxText = $range.qs(".max").textContent;

                if (currentMinText && currentMaxText) {
                    const currentMin = parseFloat(currentMinText);
                    const currentMax = parseFloat(currentMaxText);

                    // Only preserve if current values are valid numbers
                    if (!isNaN(currentMin) && !isNaN(currentMax)) {
                        // Clamp current view range to new bounds
                        const clampedMin = Math.max(min, Math.min(currentMin, max));
                        const clampedMax = Math.min(max, Math.max(currentMax, min));

                        // Convert to percentages based on new bounds
                        const boundsDelta = max - min;
                        if (boundsDelta > 0) {
                            minPercent = (clampedMin - min) / boundsDelta;
                            maxPercent = (clampedMax - min) / boundsDelta;
                        }
                    }
                }
            }

            // Set the CSS custom properties for range shading
            $range.style.setProperty("--min", minPercent);
            $range.style.setProperty("--max", maxPercent);

            // Calculate and display the actual view range values
            const boundsDelta = max - min;
            const viewMin = Math.round(min + boundsDelta * minPercent);
            const viewMax = Math.round(min + boundsDelta * maxPercent);

            $range.qs(".min").textContent = viewMin;
            $range.qs(".max").textContent = viewMax;
            $viewRange.qs(".inputs > .min").value = viewMin;
            $viewRange.qs(".inputs > .max").value = viewMax;
        }
    }

    {
        const $content = document.qs("#draw-settings > .content > .section.text-style > .content");
        const $preview = $content.qs(".preview");

        const style = $preview.qs(".text").style;
        $preview.style.textAlign = $content.qs(".align > .content > .button.selected")?.dataset.value || "center";

        {
            const $style = $content.qs(".style > .content");
            if ($style.qs(".button.selected[data-value='bold']")) style.fontWeight = "bold";
            else style.fontWeight = "normal";

            if ($style.qs(".button.selected[data-value='italic']")) style.fontStyle = "italic";
            else style.fontStyle = "normal";

            if ($style.qs(".button.selected[data-value='outline']")) style.outline = ".1vmin solid currentColor";
            else style.outline = "none";

            const decoration = [];
            if ($style.qs(".button.selected[data-value='underline']")) decoration.push("underline");
            if ($style.qs(".button.selected[data-value='strikethrough']")) decoration.push("line-through");
            if ($style.qs(".button.selected[data-value='overline']")) decoration.push("overline");
            style.textDecoration = decoration.join(" ") || "none";
        }

        const color = $content.qs(".font > .content > .color > input")?.value;
        style.color = color;
        $drawSettings.qs(".content > .section.background > .content > .preview").style.color = color;

        $preview.style.backgroundColor = ColorToHex(InverseShade(HexToColor(color), [ 240, 240, 240 ], [ 16, 16, 16 ]));

        style.fontFamily = $content.qs(".font > .content > .family > select")?.value;
    }
}
