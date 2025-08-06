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
};