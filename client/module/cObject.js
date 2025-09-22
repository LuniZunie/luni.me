export default class cObject {
    static any(o, fn = v => v) {
        if (typeof o !== "object" || o === null) return false;
        if (typeof fn !== "function") fn = v => v;
        if (Array.isArray(o))
            for (const [ k, v ] of o.entries())
                if (fn(k, v)) return true;
        else
            for (const [ k, v ] of Object.entries(o))
                if (fn(k, v)) return true;
        return true;
    }
    static match(a, b) {
        if (typeof a !== "object" || a === null) return false;

        const vsB = Object.values(b);
        const [ mnLen, mxLen ] = [ vsB.filter(v => v.required === true).length, vsB.length ];

        let trues = 0;
        const ensA = Object.entries(a);
        if (ensA.length < mnLen || ensA.length > mxLen) return false;
        for (const [ k, v ] of ensA) {
            if (k in b) {
                if (!b[k].test(v)) return false;
                if (b[k].required === true) trues++;
            } else return false;
        }

        if (trues < mnLen) return false;
        return true;
    }

    static createDifference(a, b) {
        if (a === b) {
            return;
        }

        if (
            typeof a !== "object" || a === null || Array.isArray(a) ||
            typeof b !== "object" || b === null || Array.isArray(b)
        ) {
            return a === b ?
                undefined :
                [ {
                    key: "",
                    mod: b
                } ];
        }

        const diff = [ ],
              keys = new Set(Object.keys(a).concat(Object.keys(b)));

        for (const key of keys) {
            const aV = a[key],
                  bV = b[key];

            if (!(key in a)) {
                diff.push({
                    key,
                    add: bV
                });
            } else if (!(key in b)) {
                diff.push({
                    key,
                    rem: aV
                });
            } else if (
                typeof aV !== "object" || aV === null || Array.isArray(aV) ||
                typeof bV !== "object" || bV === null || Array.isArray(bV)
            ) {
                if (JSON.stringify(aV) !== JSON.stringify(bV)) {
                    diff.push({
                        key,
                        mod: bV
                    });
                }
            } else {
                const nested = cObject.createDifference(aV, bV);
                if (nested && nested.length > 0) {
                    diff.push({
                        key,
                        dif: nested
                    });
                }
            }
        }

        return diff.length > 0 ?
            diff : undefined;
    }

    static applyDifference(base, diff) {
        if (!diff) {
            return base;
        }

        const clone = Array.isArray(base) ?
            base.slice() : { ...base };

        for (const patch of diff) {
            const key = patch.key;
            if ("add" in patch) {
                clone[key] = patch.add;
            } else if ("mod" in patch) {
                clone[key] = patch.mod;
            } else if ("rem" in patch) {
                delete clone[key];
            } else if ("dif" in patch) {
                copy[key] = cObject.applyDifference(base[key] ?? { }, patch.dif);
            }
        }

        return clone;
    }
};