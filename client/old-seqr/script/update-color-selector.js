import "../../prototype/HTML.js";
import { global } from "./global.js";
import { ColorToHex, HexToColor, InverseShade } from "./color.js";

export default function UpdateColorSelector(r, g, b, a, updateRecent = false) {
    const $colorSelector = document.qs("#color-selector");
    if (!$colorSelector) return;

    r ??= $colorSelector.dataset.red || 0;
    g ??= $colorSelector.dataset.green || 0;
    b ??= $colorSelector.dataset.blue || 0;
    a ??= $colorSelector.dataset.alpha || 0;

    {
        $colorSelector.dataset.red = r;
        $colorSelector.style.setProperty("--red", r);

        const $red = $colorSelector.qs(".content > .colors > .color.red > .input");
        $red.textContent = r;
        $red.dataset.value = r;
    }

    {
        $colorSelector.dataset.green = g;
        $colorSelector.style.setProperty("--green", g);

        const $green = $colorSelector.qs(".content > .colors > .color.green > .input");
        $green.textContent = g;
        $green.dataset.value = g;
    }

    {
        $colorSelector.dataset.blue = b;
        $colorSelector.style.setProperty("--blue", b);

        const $blue = $colorSelector.qs(".content > .colors > .color.blue > .input");
        $blue.textContent = b;
        $blue.dataset.value = b;
    }

    {
        $colorSelector.dataset.alpha = a;
        $colorSelector.style.setProperty("--alpha", a);

        const value = Math.round(a * 100);

        const $alpha = $colorSelector.qs(".content > .slider-container.alpha");
        $alpha.dataset.value = value;
        $alpha.style.setProperty("--value", `${value}%`);

        $alpha.qs(".value > .input").textContent = value;
    }

    if (updateRecent) {
        const $easySelect = $colorSelector.qs(".easy-select");

        const totalRecent = global.maxRecentColors;
        let recentColors = localStorage.getItem("SeqR:recent-colors") || "";

        const unique = new Set(), temp = [];
        recentColors = recentColors.split(",").forEach(color => {
            if (!/^#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(color)) return; // skip invalid colors
            if (unique.has(color)) return; // skip duplicates

            unique.add(color);
            temp.push(color);
        });

        recentColors = temp;
        localStorage.setItem("SeqR:recent-colors", recentColors.join(","));

        const len = recentColors.length;
        if (len > totalRecent) recentColors = recentColors.slice(0, totalRecent);
        else if (len < totalRecent) {
            const missing = totalRecent - len;
            for (let i = 0; i < missing; i++)
                recentColors.push("none"); // fill with empty colors
        }

        const $recent = $easySelect.qs(".recent");
        $recent.innerHTML = ""; // clear previous recent colors
        for (const color of recentColors) {
            if (color === "none")
                $recent.create("div", {
                    class: "color empty",
                    title: "No recent color"
                }, { end: true });
            else {
                const $color = $recent.create("div", {
                    class: "color",
                    style: {
                        "--color": color,
                        "--outline": ColorToHex(InverseShade(HexToColor(color)))
                    },
                    dataset: {
                        color,
                        events: "color-selector>easy-select>color"
                    },
                    title: `Select recent color: ${color}`
                }, { start: true });

                // Add alpha background for semi-transparent colors
                $color.create("div", {
                    class: "alpha-background"
                }, { end: true });
            }
        }
    }
}