export class Prandom {
    static #rotl(x, n) {
        return (x << n) | (x >>> (32 - n));
    }

    static MurmurHash3(seed) {
        if (typeof seed !== "string") {
            throw new TypeError("Prandom.MurmurHash3(): seed must be a string");
        }

        const len = seed.length;

        let h = 0xdeadbeef ^ len;
        for (let i = 0; i < len; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b1);
        }

        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);

        return h >>> 0;
    }

    static * Xoshiro128PlusPlus(seed = Date.now().toString()) {
        if (typeof seed !== "string") {
            throw new TypeError("Prandom.Xoshiro128PlusPlus(): seed must be a string");
        }

        let hash = this.MurmurHash3(seed),
            s = new Uint32Array(4);

        for (let i = 0; i < 4; i++) {
            hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
            hash ^= hash >>> 15;
            s[i] = hash >>> 0;
        }

        while (true) {
            const result = this.#rotl(s[0] + s[3], 7) + s[0],
                  t = s[1] << 9;

            s[2] ^= s[0];
            s[3] ^= s[1];
            s[1] ^= s[2];
            s[0] ^= s[3];
            s[2] ^= t;
            s[3] = this.#rotl(s[3], 11);

            yield (result >>> 0) / 0x100000000; // normalize to [0, 1)
        }
    }
}