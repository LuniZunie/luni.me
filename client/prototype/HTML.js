const $textWidthPaper = document.createElement("canvas");
const textWidthPen = $textWidthPaper.getContext("2d");

const o = {
    qs: { value(selector) { return this.querySelector(selector); } },
    qsa: { value(selector) { return this.querySelectorAll(selector); } },
    select: { value(el) {
        this.qsa("*.selected").forEach(e => e.classList.remove("selected"));
        if (el instanceof HTMLElement) el.classList.add("selected");
        else if (typeof el === "string") this.qs(el)?.classList?.add?.("selected");
        else throw new TypeError("select: argument must be an HTMLElement or a selector string.");
    } },
    textWidth: { value(text, font) {
        if (this instanceof Document) font ??= getComputedStyle(document.body).font;
        else font ??= getComputedStyle(this).font;

        textWidthPen.font = font;
        return textWidthPen.measureText(text).width;
    } },
    duplicate: { value(n) { // n = 1 (returns [ Node ]) is NOT the same as n = null | undefined (returns Node)
        if (this instanceof Document) throw new TypeError("duplicate: Cannot duplicate a Document.");

        let single = false;
        if (n === null || n === undefined) {
            n = 1; // default to 1 if no argument is given
            single = true; // mark as single duplication
        }

        if (typeof n !== "number" || n < 1) throw new TypeError("duplicate: Argument must be a positive integer.");

        let j = 0;
        const res = [];
        for (let i = 0; i < n; i++) {
            const clone = this.cloneNode(true);
            const id = this.id;
            if (id) {
                do j++;
                while (document.getElementById(`${id}_copy-${j}`));
                clone.id = `${id}_copy-${j}`;
            }

            const parent = this.parentNode;
            if (parent) parent.insertBefore(clone, this.nextSibling);
            else document.body.appendChild(clone);

            res.push(clone);
        }

        if (single) return res[0]; // return single element if only one was duplicated
        return res; // return array of duplicated elements
    } },
    create: { value(tagName, attributes = {}, location = {}) {
        if (typeof tagName !== "string") throw new TypeError("create: tagName must be a string.");

        const el = document.createElement(tagName);
        for (const [ k, v ] of Object.entries(attributes)) {
            switch (k) {
                case "id": {
                    if (typeof v !== "string") throw new TypeError("create: id must be a string.");
                    el.id = v;
                } break;
                case "class": {
                    if (typeof v !== "string") throw new TypeError("create: class must be a string.");
                    el.className = v;
                } break;
                case "content": {
                    if (typeof v !== "string") throw new TypeError("create: content must be a string.");
                    el.textContent = v;
                } break;
                case "text": {
                    if (typeof v !== "string") throw new TypeError("create: text must be a string.");
                    el.innerText = v;
                } break;
                case "html": {
                    if (typeof v !== "string") throw new TypeError("create: html must be a string.");
                    el.innerHTML = v;
                } break;
                case "style": {
                    if (typeof v !== "object" || v === null) throw new TypeError("create: style must be an object.");
                    for (const [ prop, value ] of Object.entries(v)) el.style.setProperty(prop.replace(/([A-Z])/g, "-$1").toLowerCase(), value);
                } break;
                case "dataset": {
                    if (typeof v !== "object" || v === null) throw new TypeError("create: dataset must be an object.");
                    for (const [ dataKey, dataValue ] of Object.entries(v)) {
                        if (typeof dataKey !== "string") throw new TypeError("create: dataset keys must be strings.");
                        el.dataset[dataKey] = dataValue;
                    }
                } break;
                default: {
                    el.setAttribute(k, v);
                } break;
            }
        }

        if (location?.start === true) this.insertBefore(el, this.firstChild);
        else if (location?.end === true) this.appendChild(el);
        else if (location?.before instanceof Node) {
            if (location.before.parentNode) location.before.parentNode.insertBefore(el, location.before);
            else throw new Error("create: before location is not part of the document.");
        } else if (location?.after instanceof Node) {
            if (location.after.parentNode) location.after.parentNode.insertBefore(el, location.after.nextSibling);
            else throw new Error("create: after location is not part of the document.");
        }

        return el;
    } },
};

Object.defineProperties(HTMLElement.prototype, o);
Object.defineProperties(Document.prototype, o);

export default true;