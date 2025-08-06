import cMath from "../../module/cMath.js";

export function RgbToHsl([ r, g, b ]) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [ Math.round(h * 360), Math.round(s * 100), Math.round(l * 100) ];
}

export function HslToRgb(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color);
    };
    return [ f(0), f(8), f(4) ];
}

export function HexToColor(hex) {
    hex = hex.replace(/^#/, "");

    // Expand short hex (#RGB or #RGBA) to full form
    if (hex.length === 3 || hex.length === 4)
        hex = hex.split("").map(ch => ch + ch).join("");

    if (hex.length !== 6 && hex.length !== 8)
        throw new Error("Invalid hex format");

    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    ];
}

export function ColorToHex([ r, g, b, a = 1 ]) {
    r = cMath.clamp(r, 0, 255), g = cMath.clamp(g, 0, 255), b = cMath.clamp(b, 0, 255);
    a = cMath.clamp(a, 0, 1);

    const hex = (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
    return a < 1 ? `#${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `#${hex}`;
}

export function Shade([ r, g, b, a ], light = [ 255, 255, 255 ], dark = [ 0, 0, 0 ]) {
    r = cMath.clamp(r, 0, 255), g = cMath.clamp(g, 0, 255), b = cMath.clamp(b, 0, 255);
    a = cMath.clamp(a, 0, 1);

    const l = (0.299 * r + 0.587 * g + 0.114 * b); // luminance calculation
    return [ ...(l > 127 ? light : dark), a ];
}

export function InverseColor([ r, g, b, a ]) {
    r = cMath.clamp(r, 0, 255), g = cMath.clamp(g, 0, 255), b = cMath.clamp(b, 0, 255);
    a = cMath.clamp(a, 0, 1);

    return [ 255 - r, 255 - g, 255 - b, a ];
}

export function InverseShade([ r, g, b, a ], light = [ 255, 255, 255 ], dark = [ 0, 0, 0 ]) {
    return Shade(InverseColor([ r, g, b, a ]), light, dark);
}