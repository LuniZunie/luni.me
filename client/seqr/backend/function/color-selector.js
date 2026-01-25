import Color from "../../../module/color.js";

let pen, totalRecentColors;

export function LoadColorSelector() {
    CreateColorSpectrum(document.querySelector("#color-selector > .content > .palette > .paper"));
    LoadEasySelect();
    UpdateRecentColors();
}
export function CreateColorSpectrum($paper) {
    if (!($paper instanceof HTMLCanvasElement)) {
        throw new TypeError("Canvas must be a valid HTMLCanvasElement");
    }

    const [ h, s, l ] = [ 360, 100, 100 ];

    $paper.width = h, $paper.height = l;

    pen = $paper.getContext("2d", { willReadFrequently: true });
    if (!pen) {
        throw new Error("Failed to get 2d context");
    }

    const imgData = pen.createImageData($paper.width, $paper.height);
    for (let x = 0; x < h; x++) {
        for (let y = 0; y < l; y++) {
            const [ r, g, b ] = Color.HSLToRGB(x, s, y);

            const i = (x + y * h) * 4;
            imgData.data[i] = r;
            imgData.data[i + 1] = g;
            imgData.data[i + 2] = b;
            imgData.data[i + 3] = 255;
        }
    }

    pen.putImageData(imgData, 0, 0);
}
export function LoadEasySelect() {
    const $colorSelector = document.querySelector("#color-selector"),
          $easySelect = $colorSelector.querySelector(":scope > .content > .easy-select");

    const rows = 15;

    let otherRows = 0;
    $easySelect.querySelectorAll("div:not(.recent)").forEach($div => {
        const colors = $div.textContent.replace(/\s/g, "").split(",");
        $div.innerHTML = "";

        for (const color of colors) {
            otherRows += .25;

            const $color = document.createElement("div");
            $color.className = "color";
            $color.title = `Select color: ${color}`;

            $color.style.setProperty("--color", color);
            $color.style.setProperty("--outline", Color.Shade(new Color(color), "#000", "#FFF"));

            $color.dataset.color = color;
            $color.dataset.event = "color-selector:easy-select:color";

            $div.appendChild($color);

            const $alpha = document.createElement("div");
            $alpha.className = "alpha";

            $color.appendChild($alpha);
        }
    });

    const recentRows = rows - Math.ceil(otherRows);
    totalRecentColors = recentRows * 4;
}

export function UpdateRecentColors() {
    const $colorSelector = document.querySelector("#color-selector"),
          $easySelect = $colorSelector.querySelector(":scope > .content > .easy-select");

    let recentColors = localStorage.getItem("SeqR:recent-colors") || "";

    const unique = new Set(), temp = [];
    recentColors = recentColors.split(",").forEach(color => {
        if (!Color.validHEX.test(Color) || unique.has(color)) {
            return;
        }

        unique.add(color);
        temp.push(color);
    });

    recentColors = temp;
    localStorage.setItem("SeqR:recent-colors", recentColors.join(","));

    const len = recentColors.length;
    if (len > totalRecentColors) {
        recentColors = recentColors.slice(0, totalRecentColors);
    } else if (len < totalRecentColors) {
        const missing = totalRecentColors - len;
        for (let i = 0; i < missing; i++) {
            recentColors.push("none");
        }
    }

    const $recent = $easySelect.querySelector(":scope > .recent");
    $recent.innerHTML = "";

    for (const color of recentColors) {
        const $color = document.createElement("div");
        $color.className = "color";

        if (color === "none") {
            $color.classList.add("empty");
            $recent.appendChild($color);
        } else {
            $color.title = `Select color: ${color}`;

            $color.style.setProperty("--color", color);
            $color.style.setProperty("--outline", Color.Shade(new Color(color), "#000", "#FFF"));

            $color.dataset.color = color;
            $color.dataset.event = "color-selector:easy-select:color";

            $div.insertBefore($color, $div.firstChild);

            const $alpha = document.createElement("div");
            $alpha.className = "alpha";

            $color.appendChild($alpha);
        }
    }
}

export function UpdateColorSelector(r, g, b, a) {
    const $colorSelector = document.querySelector("#color-selector"),
          $colors = $colorSelector.querySelector(":scope > .content > .colors");

    r ??= $colorSelector.dataset.red || 0;
    g ??= $colorSelector.dataset.green || 0;
    b ??= $colorSelector.dataset.blue || 0;
    a ??= $colorSelector.dataset.alpha || 0;

    { /* red */
        $colorSelector.dataset.red = r;
        $colorSelector.style.setProperty("--red", r);

        const $red = $colors.querySelector(":scope > .color.red > .number-plus");
        $red.dataset.value = r;
        $red.querySelector(":scope > .input").textContent = r;
    }

    { /* green */
        $colorSelector.dataset.green = g;
        $colorSelector.style.setProperty("--green", g);

        const $green = $colors.querySelector(":scope > .color.green > .number-plus");
        $green.dataset.value = g;
        $green.querySelector(":scope > .input").textContent = g;
    }

    { /* blue */
        $colorSelector.dataset.blue = b;
        $colorSelector.style.setProperty("--blue", g);

        const $blue = $colors.querySelector(":scope > .color.blue > .number-plus");
        $blue.dataset.value = b;
        $blue.querySelector(":scope > .input").textContent = b;
    }

    { /* alpha */
        const v = Math.round(a * 100);

        $colorSelector.dataset.alpha = a;
        $colorSelector.style.setProperty("--alpha", a);

        const $alpha = $colorSelector.querySelector(":scope > .content > .transparency");
        $alpha.dataset.value = v;
        $alpha.style.setProperty("--value", `${v}%`);

        $alpha.querySelector(":scope > .value > .input").textContent = v;
    }
}