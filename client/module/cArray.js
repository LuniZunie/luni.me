export class cArray {
    static localeCompare(a, b, locales, options) {
        if (!Array.isArray(a)) {
            throw new TypeError("@module/cArray.js:cArray.localeCompare(): <Array.isArray(<arguments[0]>)> failed.");
        } else if (!Array.isArray(b)) {
            throw new TypeError("@module/cArray.js:cArray.localeCompare(): <Array.isArray(<arguments[1]>)> failed.");
        }

        if (a.length < b.length) {
            return a.find((v, i) => v?.localeCompare?.(b[i], locales, options)) || -1;
        } else {
            return b.find((v, i) => a[i]?.localeCompare?.(v, locales, options)) || 1;
        }
    }
}