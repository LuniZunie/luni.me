export default class cMath {
    static bin(n) { return 2 ** n; };

    static clamp(value, min, max) {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        } else {
            return value;
        }
    }
    static uclamp(value, max) {
        if (value > max) {
            return max;
        } else {
            return value;
        }
    }
    static lclamp(value, min) {
        if (value < min) {
            return min;
        } else {
            return value;
        }
    }

    static murmurhash3(seed) {
        const len = seed.length;
        let hash = 0xdeadbeef ^ len;
        for (let i = 0; i < len; i++)
            hash = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b1);
        hash = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        hash = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return hash >>> 0;
    }
    static rotl(x, n) { return (x << n) | (x >>> (32 - n)); }

    static * random(seed = Date.now().toString()) {
        if (typeof seed !== "string") throw new TypeError("cMath.random: seed must be a string");

        let hash = murmurhash3(seed), s = new Uint32Array(4);
        for (let i = 0; i < 4; i++) {
            hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
            hash ^= hash >>> 15;
            s[i] = hash >>> 0;
        }

        while (true) {
            const res = rotl(s[0] + s[3], 7) + s[0], t = s[1] << 9;

            s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t;
            s[3] = rotl(s[3], 11);

            yield (res >>> 0) / 0x100000000; // normalize to [0, 1)
        }
    };

    static #numAbbr = [
        "", "K", "M", "B", "T",
        "Qa", "Qi", "Sx", "Sp", "Oc",
        "No", "Dc",
    ];

    static toString(n, digits = 2) {
        n = Number(n);
        let i = 0;
        const mx = this.#numAbbr.length - 1;
        while (n >= 1000 && i < mx) n /= 1000, i++;
        return n.toFixed(+digits) + this.#numAbbr[i];
    }
    static fromString(s) {
        if (typeof s !== "string") return NaN;

        const suffix = s.match(/[A-z]+$/)?.[0] || "";
        const abbr = this.#numAbbr.indexOf(suffix);
        if (abbr === -1) return NaN;
        if (suffix === "") return parseFloat(s);

        const n = parseFloat(s.slice(0, -suffix.length));
        if (isNaN(n)) return NaN;
        return n * 1000 ** abbr;
    }
};