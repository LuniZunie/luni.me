export default class cString {
    static trimIndent(s) {
        if (typeof s !== "string") throw new TypeError("cString.trimIndent: Argument must be a string.");

        let end = 0, mn = Infinity; // min indent
        const lines = s.split(/\r\n|\n|\r/), len = lines.length;
        for (let i = 0; i < len; i++) {
            const line = lines[i];
            if (line.trim() === "") continue; // skip empty lines
            end = i + 1; // update end index

            const indent = line.match(/^\s*/)[0].length; // get indent length
            if (indent < mn) mn = indent; // update min indent
        }

        if (mn === Infinity) mn = 0; // if no non-empty lines, set min indent to 0

        let foundContent = false; // flag to check if any content is found
        const rtn = []; // return value
        for (let i = 0; i < len; i++) {
            if (i >= end) break; // stop checking after the last non-empty line
            const line = lines[i];
            if (line.trim() === "") {
                if (foundContent) rtn.push(""); // keep empty lines after content
                continue; // skip empty lines
            } else foundContent = true; // set flag if any content is found

            rtn.push(line.slice(mn)); // remove min indent from each line
        }
        return rtn.join("\n");
    }

    static splitOn(s, sep, test = () => true) {
        if (typeof s !== "string") throw new TypeError("cString.splitOn: Argument must be a string.");
        if (typeof sep !== "string") throw new TypeError("cString.splitOn: Separator must be a string.");
        if (typeof test !== "function") throw new TypeError("cString.splitOn: Test must be a function.");

        const a = s.split(sep); // split string by separator
        let cache = [ a[0] ];

        const rtn = [];
        const len = a.length;
        for (let i = 1; i < len; i++) {
            const it = a[i];
            if (test(i - 1, len - 1)) {
                rtn.push(cache.join(sep)); // join cached elements with separator
                cache = [ it ]; // reset cache to current element
            } else cache.push(it);
        }

        rtn.push(cache.join(sep)); // push remaining cached elements
        return rtn;
    }

    static fromNumber(n, options = {}) {
        if (typeof n !== "number") throw new TypeError("cString.fromNumber: Argument must be a number.");
        if (typeof options !== "object") throw new TypeError("cString.fromNumber: Options must be an object.");

        const {
            decimal = 2,
            abbreviations = [ "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" ],
            magnitude = 1000
        } = options;

        if (typeof decimal !== "number" || decimal < 0 || !Number.isInteger(decimal))
            throw new TypeError("cString.fromNumber: Decimal must be a non-negative integer.");
        if (!Array.isArray(abbreviations)) throw new TypeError("cString.fromNumber: Abbreviations must be an array.");
        if (typeof magnitude !== "number" || magnitude <= 1 || !Number.isInteger(magnitude))
            throw new TypeError("cString.fromNumber: Magnitude must be an integer greater than 1.");

        let i = 0;
        const max = abbreviations.length - 1;
        while (n >= magnitude && i < max)
            n /= magnitude, i++;
        return n.toFixed(decimal) + " " + abbreviations[i];
    }
}