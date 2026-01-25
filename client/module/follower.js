export class Follower {
    #follow() {
        if (!this.#active) {
            return;
        }

        const $follower = this.#element,
              $target = this.#targetElement;

        const targetRect = $target.getBoundingClientRect();
        let targetX, targetY;
        switch (this.#target.x) {
            case "left": {
                targetX = targetRect.left;
            } break;
            default: {
                console.warn("module/follower.js:Follower.#follow()", "Invalid target.x", this.#target.x, $follower);
            } /* Fallthrough */
            case "center": {
                targetX = targetRect.left + targetRect.width / 2;
            } break;
            case "right": {
                targetX = targetRect.right;
            } break;
        }
        switch (this.#target.y) {
            case "top": {
                targetY = targetRect.top;
            } break;
            default: {
                console.warn("module/follower.js:Follower.#follow()", "Invalid target.y", this.#target.y, $follower);
            } /* Fallthrough */
            case "center": {
                targetY = targetRect.top + targetRect.height / 2;
            } break;
            case "bottom": {
                targetY = targetRect.bottom;
            } break;
        }

        const followerRect = $follower.getBoundingClientRect();
        let followerX, followerY;
        switch (this.#anchor.x) {
            case "left": {
                followerX = targetX;
            } break;
            default: {
                console.warn("module/follower.js:Follower.#follow()", "Invalid anchor.x", this.#anchor.x, $follower);
            } /* Fallthrough */
            case "center": {
                followerX = targetX - followerRect.width / 2;
            } break;
            case "right": {
                followerX = window.innerWidth - targetX;
            } break;
        }
        switch (this.#anchor.y) {
            case "top": {
                followerY = targetY;
            } break;
            default: {
                console.warn("module/follower.js:Follower.#follow()", "Invalid anchor.y", this.#anchor.y, $follower);
            } /* Fallthrough */
            case "center": {
                followerY = targetY - followerRect.height / 2;
            } break;
            case "bottom": {
                followerY = window.innerHeight - targetY;
            } break;
        }

        let offsetX = this.#offset.x;
        if (parseFloat(offsetX) == offsetX) {
            offsetX += "vmin";
        }

        let offsetY = this.#offset.y;
        if (parseFloat(offsetY) == offsetY) {
            offsetY += "vmin";
        }

        if (this.#anchor.x === "right") {
            $follower.style.right = `calc(${followerX}px - ${offsetX})`;
            $follower.style.left = "";
        } else {
            $follower.style.left = `calc(${followerX}px + ${offsetX})`;
            $follower.style.right = "";
        }

        if (this.#anchor.y === "bottom") {
            $follower.style.bottom = `calc(${followerY}px - ${offsetY})`;
            $follower.style.top = "";
        } else {
            $follower.style.top = `calc(${followerY}px + ${offsetY})`;
            $follower.style.bottom = "";
        }

        window.requestAnimationFrame(() => this.#follow());
    }

    #active = true;

    #element;
    #targetElement;

    #anchor = { x: "center", y: "center" };
    #target = { x: "center", y: "center" };

    #offset = { x: 0, y: 0 };

    constructor(element, targetElement, anchor = { }, target = { }, offset = { }) {
        if (!(element instanceof HTMLElement)) {
            throw new TypeError("module/follower.js:Follower(): <arguments[0]> must be <instanceof HTMLElement>");
        }

        if (!(targetElement instanceof HTMLElement)) {
            throw new TypeError("module/follower.js:Follower(): <arguments[1]> must be <instanceof HTMLElement>");
        }

        anchor ??= { };
        anchor.x ??= "center";
        anchor.y ??= "center";

        if (anchor === null || typeof anchor !== "object") {
            throw new TypeError("module/follower.js:Follower(): <arguments[2]> must be <typeof \"object\"> but not <null>");
        } else if (!(anchor.x === "left" || anchor.x === "center" || anchor.x === "right")) {
            throw new TypeError("module/follower.js:Follower(): <arguments[2].x> must be (<\"left\"> or <\"center\"> or <\"right\">)");
        } else if (!(anchor.y === "top" || anchor.y === "center" || anchor.y === "bottom")) {
            throw new TypeError("module/follower.js:Follower(): <arguments[2].y> must be (<\"top\"> or <\"center\"> or <\"bottom\">)");
        }

        target ??= { };
        target.x ??= "center";
        target.y ??= "center";

        if (target === null || typeof target !== "object") {
            throw new TypeError("module/follower.js:Follower(): <arguments[3]> must be <typeof \"object\"> but not <null>");
        } else if (!(target.x === "left" || target.x === "center" || target.x === "right")) {
            throw new TypeError("module/follower.js:Follower(): <arguments[3].x> must be (<\"left\"> or <\"center\"> or <\"right\">)");
        } else if (!(anchor.y === "top" || target.y === "center" || target.y === "bottom")) {
            throw new TypeError("module/follower.js:Follower(): <arguments[3].y> must be (<\"top\"> or <\"center\"> or <\"bottom\">)");
        }

        offset ??= { };
        offset.x ??= 0;
        offset.y ??= 0;

        if (offset === null || typeof offset !== "object") {
            throw new TypeError("module/follower.js:Follower(): <arguments[4]> must be <typeof \"object\"> but not <null>");
        }

        this.#element = element;
        this.#targetElement = targetElement;

        this.#anchor = anchor;
        this.#target = target;
        this.#offset = offset;

        this.#follow();
    }

    destroy() {
        this.#active = false;
    }
}