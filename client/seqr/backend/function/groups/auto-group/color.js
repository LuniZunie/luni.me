import Color from "../../../../../module/color.js";
import { Prandom } from "../../../../../module/prandom.js";

export class GroupColorSystem {
    static #golden = 1 / Math.pow((1 + Math.sqrt(5)) / 2, 2);
    static uniqueColors(c, h) {
        const colors = [ ];
        for (let i = 0; i < c; i++) {
            const s = 60 + (i % 3) * 15,
                  l = 45 + (Math.floor(i / 3) % 3) * 10;

            h ??= (i * GroupColorSystem.#golden) % 360;
            colors.push(Color.HSLtoHEX(h, s, l));
        }

        return colors;
    }
    static uniqueColor(i, h) {
        const s = 60 + (i % 3) * 15,
              l = 45 + (Math.floor(i / 3) % 3) * 10;

        h ??= (i * GroupColorSystem.#golden) % 360;
        return Color.HSLtoHEX(h, s, l);
    }

    static generateColor(seed) {
        const prng = Prandom.Xoshiro128PlusPlus(seed);
        return Color.HSLtoHEX(
            prng.next().value * 360, /* hue */
            prng.next().value * 50 + 50, /* saturation */
            prng.next().value * 25 * (prng.next().value < 0.5 ? -1 : 1) + 50 /* lightness */
        )
    }
};