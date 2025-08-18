import cMath from "./cMath.js";

export default class Color {
    static validHEX = /^#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i;

    static Shade(color, light = "#FFF", dark = "#000") {
        if (!(color instanceof Color)) {
            throw new TypeError("Color must be an instance of Color");
        }

        const l = (.299 * color.red + .587 * color.green + .144 * color.blue);
        const c = new Color(l > 127 ? light : dark);
        c.alpha = color.alpha;

        return c.rgba;
    }

    static RGBtoHEX(r, g, b) {
        const toHex = (c) => {
            const hex = c.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    static RGBToHSL(r, g, b) {
        r /= 255, g /= 255, b /= 255;

        const max = Math.max(r, g, b),
                min = Math.min(r, g, b);

        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            if (l > .5) {
                s = d / (2 - d);
            } else {
                s = d / (max + min);
            }

            switch (max) {
                case r: {
                    h = (g - b) / d + (g < b ? 6 : 0);
                } break;
                case g: {
                    h = (b - r) / d + 2;
                } break;
                case b: {
                    h = (r - g) / d + 4;
                } break;
            }

            h /= 6;
        }

        return [ h, s, l ];
    }

    static HSLToRGB(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const fn = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color);
        };

        return [ fn(0), fn(8), fn(4) ];
    }
    static HSLtoHEX(h, s, l) {
        const [ r, g, b ] = this.HSLToRGB(h, s, l);
        return this.RGBtoHEX(r, g, b);
    }

    #rgba = [ 0, 0, 0, 1 ];
    #hsla = [ 0, 0, 0, 1 ];

    constructor(color) {
        if (typeof color === "string") {
            color = color.replace(/\s/g, "");
            if (color.startsWith("#")) { /* Hexadecimal */
                color = color.replace(/^#/, "");

                const len = color.length;
                switch (len) {
                    case 3: {
                        const [ r, g, b ] = color
                            .match(/.{1}/g)
                            .map(ch => parseInt(ch + ch, 16));

                        this.#SetupWithRGBA(r, g, b, 255);
                    } break;
                    case 4: {
                        const [ r, g, b, a ] = color
                            .match(/.{1}/g)
                            .map(ch => parseInt(ch + ch, 16));

                        this.#SetupWithRGBA(r, g, b, a);
                    } break;
                    case 6: {
                        const [ r, g, b ] = color
                            .match(/.{2}/g)
                            .map(ch => parseInt(ch, 16));

                        this.#SetupWithRGBA(r, g, b, 255);
                    } break;
                    case 8: {
                        const [ r, g, b, a ] = color
                            .match(/.{2}/g)
                            .map(ch => parseInt(ch, 16));

                        this.#SetupWithRGBA(r, g, b, a);
                    } break;
                    default: throw new TypeError("Invalid hex color length: " + len);
                }
            } else if (color.startsWith(/rgba?\(/) && color.endsWith(")")) {
                color = color.replace(/(^rgba?\(|\)$)/g, "");
                const [ r, g, b, a = 255 ] = color.split(",").map(Number);

                if (cMath.clamp(r, 0, 255) !== r ||
                    cMath.clamp(g, 0, 255) !== g ||
                    cMath.clamp(b, 0, 255) !== b ||
                    cMath.clamp(a, 0, 255) !== a) {
                    throw new TypeError("Invalid rgba color values: " + color);
                }

                this.#SetupWithRGBA(r, g, b, a);
            } else if (color.startsWith(/hsla?\(/) && color.endsWith(")")) {
                color = color.replace(/(^hsla?\(|\)$)/g, "");
                const [ h, s, l, a = 255 ] = color.split(",").map(Number);

                if (cMath.clamp(h, 0, 360) !== h ||
                    cMath.clamp(s, 0, 100) !== s ||
                    cMath.clamp(l, 0, 100) !== l ||
                    cMath.clamp(a, 0, 255) !== a) {
                    throw new TypeError("Invalid hsla color values: " + color);
                }

                this.#SetupWithHSLA(cMath.hslToRgb(h, s / 100, l / 100), a);
            }
        }
    }

    get hex() {
        const [ r, g, b ] = this.#rgba.map(c => c.toString(16).padStart(2, "0"));
        return `#${r}${g}${b}`;
    }
    get hexa() {
        const [ r, g, b, a ] = this.#rgba.map(c => c.toString(16).padStart(2, "0"));
        return `#${r}${g}${b}${a}`;
    }

    get rgba() {
        const [ r, g, b, a ] = this.#rgba;
        return `rgba(${r},${g},${b},${a / 255})`;
    }
    get rgb() {
        const [ r, g, b ] = this.#rgba;
        return `rgb(${r},${g},${b})`;
    }

    get red() { return this.#rgba[0]; }
    set red(v) { this.#rgba[0] = cMath.clamp(v, 0, 255); }

    get green() { return this.#rgba[1]; }
    set green(v) { this.#rgba[1] = cMath.clamp(v, 0, 255); }

    get blue() { return this.#rgba[2]; }
    set blue(v) { this.#rgba[2] = cMath.clamp(v, 0, 255); }

    get hsla() {
        const [ h, s, l, a ] = this.#hsla;
        return `hsla(${h},${s}%,${l}%,${a / 255})`;
    }
    get hsl() {
        const [ h, s, l ] = this.#hsla;
        return `hsl(${h},${s}%,${l}%)`;
    }

    get hue() { return this.#hsla[0]; }
    set hue(v) { this.#hsla[0] = cMath.clamp(v, 360); }

    get saturation() { return this.#hsla[1]; }
    set saturation(v) { this.#hsla[1] = cMath.clamp(v, 100); }

    get lightness() { return this.#hsla[2]; }
    set lightness(v) { this.#hsla[2] = cMath.clamp(v, 100); }

    get alpha() { return this.#rgba[3]; }
    set alpha(v) {
        v = cMath.clamp(v, 0, 255);
        this.#rgba[3] = v;
        this.#hsla[3] = v;
    }

    #SetupWithHSLA(h, s, l, a) {
        this.#hsla = [ h, s, l, a ];
        this.#rgba = [ ...Color.HSLToRGB(h, s, l), a ];
    }

    #SetupWithRGBA(r, g, b, a) {
        this.#rgba = [ r, g, b, a ];
        this.#hsla = [ ...Color.RGBToHSL(r, g, b), a ]
    }
};