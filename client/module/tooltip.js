const tooltips = new Set();
export default class Tooltip {
    static #updating = false; // to prevent multiple updates at the same time
    static #updateAll() {
        Tooltip.#updating = true;

        let one = false;
        for (const tooltip of tooltips)
            if (tooltip.#update()) one = true;

        if (one) requestAnimationFrame(Tooltip.#updateAll);
        else Tooltip.#updating = false;
    }

    #anchor = [ "center", "center" ]; // default anchor
    #offset = [ 0, 0 ]; // default offset

    #parent;
    #element;
    constructor($parent, text, options = {}) {
        if (!$parent || !$parent instanceof HTMLElement)
            throw new TypeError("Parent must be a valid HTMLElement");
        if (typeof text !== "string")
            throw new TypeError("Text must be a string");
        if (typeof options !== "object" || options === null)
            throw new TypeError("Options must be an object");

        this.#parent = $parent;
        this.#element = document.body.create("div", {
            class: "tooltip",
            html: text
        }, { end: true });

        this.#parent.addEventListener("mouseleave", () => {
            this.#element.remove();
            tooltips.delete(this);
        });

        for (const [ k, v ] of Object.entries(options))
            switch (k) {
                case "anchor": { this.anchor = v; } break;
                case "anchorX": { this.anchorX = v; } break;
                case "anchorY": { this.anchorY = v; } break;
                case "offset": { this.offset = v; } break;
                case "offsetX": { this.offsetX = v; } break;
                case "offsetY": { this.offsetY = v; } break;
            }

        tooltips.add(this);
        if (!Tooltip.#updating) Tooltip.#updateAll();
    }

    get element() { return this.#element; }
    get parent() { return this.#parent; }

    set text(text) {
        if (typeof text !== "string") throw new TypeError("Text must be a string");
        this.#element.textContent = text;
        return this;
    }
    get text() { return this.#element.textContent; }

    set anchor(anchor) {
        if (typeof anchor !== "string") throw new TypeError("Anchor must be a string");

        const [ x, y ] = anchor.split(" ");
        if (!(x === "left" || x === "center" || x === "right")) throw new TypeError("Anchor x must be 'left', 'center' or 'right'");
        if (!(y === "top" || y === "center" || y === "bottom")) throw new TypeError("Anchor y must be 'top', 'center' or 'bottom'");

        this.#anchor = [ x, y ];
        return this;
    }
    set anchorX(x) {
        if (!(x === "left" || x === "center" || x === "right")) throw new TypeError("Anchor x must be 'left', 'center' or 'right'");
        this.#anchor[0] = x;
        return this;
    }
    set anchorY(y) {
        if (!(y === "top" || y === "center" || y === "bottom")) throw new TypeError("Anchor y must be 'top', 'center' or 'bottom'");
        this.#anchor[1] = y;
        return this;
    }

    get anchor() { return `${this.#anchor[0]} ${this.#anchor[1]}`; }
    get anchorX() { return this.#anchor[0]; }
    get anchorY() { return this.#anchor[1]; }

    set offset(offset) {
        if (typeof offset !== "string") throw new TypeError("Offset must be a string");

        const [ x, y ] = offset.split(" ");
        if (isNaN(+x) || isNaN(+y)) throw new TypeError("Offset must be a string with two numbers separated by a space");
        this.#offset = [ +x, +y ];
        return this;
    }
    set offsetX(x) {
        if (isNaN(+x)) throw new TypeError("Offset x must be a number");
        this.#offset[0] = +x;
        return this;
    }
    set offsetY(y) {
        if (isNaN(+y)) throw new TypeError("Offset y must be a number");
        this.#offset[1] = +y;
        return this;
    }

    get offset() { return this.#offset; }
    get offsetX() { return this.#offset[0]; }
    get offsetY() { return this.#offset[1]; }

    delete() {
        this.#element.remove();
        tooltips.delete(this);
    }

    #update() {
        if (!this.#element.isConnected || !this.#parent.isConnected) {
            tooltips.delete(this);
            return false;
        }

        const [ anchorX, anchorY ] = this.#anchor;
        const [ offsetX, offsetY ] = this.#offset;

        const elementRect = this.#element.getBoundingClientRect();
        const parentRect = this.#parent.getBoundingClientRect();
        switch (anchorX) {
            case "left": {
                this.#element.style.left = `calc(${parentRect.left - elementRect.width}px + ${offsetX}vmin)`;
            } break;
            case "center": {
                this.#element.style.left = `calc(${parentRect.left + parentRect.width / 2 - elementRect.width / 2}px + ${offsetX}vmin)`;
            } break;
            case "right": {
                this.#element.style.left = `calc(${parentRect.right}px + ${offsetX}vmin)`;
            } break;
        }
        switch (anchorY) {
            case "top": {
                this.#element.style.top = `calc(${parentRect.top - elementRect.height}px + ${offsetY}vmin)`;
            } break;
            case "center": {
                this.#element.style.top = `calc(${parentRect.top + parentRect.height / 2 - elementRect.height / 2}px + ${offsetY}vmin)`;
            } break;
            case "bottom": {
                this.#element.style.top = `calc(${parentRect.bottom}px + ${offsetY}vmin)`;
            } break;
        }

        return true;
    }
}