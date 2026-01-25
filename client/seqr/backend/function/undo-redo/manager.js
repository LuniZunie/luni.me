import { global } from "../../global.js";
import { CreateNotification } from "../../../../module/notification.js";

const $groups = document.querySelector("#groups");
export class UndoRedo {
    static #size = 100n;
    static get size() {
        return UndoRedo.#size;
    }
    static set size(n) {
        if (typeof n !== "bigint" || n <= 0n) {
            throw new TypeError("client/SeqR/backend/function/undo-redo/manager.js:UndoRedo.size<set>(): <arguments[0]> must be <typeof \"bigint\"> and must be positive");
        }

        UndoRedo.#size = n;
    }

    static #default;
    static #active;
    static get active() {
        return UndoRedo.#active ?? UndoRedo.#default;
    }

    #undo = [];
    #redo = [];

    constructor(isDefault) {
        if (isDefault) {
            UndoRedo.#default = this;
        }
    }

    focus() {
        UndoRedo.#active = this;
    }
    unfocus() {
        if (Object.is(UndoRedo.#active, this)) {
            UndoRedo.#active = undefined;
        }
    }

    execute(action) {
        if (!action || typeof action.execute !== "function" || typeof action.undo !== "function") {
            console.error("UndoRedo:execute(): Invalid action, must have execute and undo functions");
            return false;
        }

        try {
            const opts = action.execute();
            if (opts?.cancel) {
                return true;
            }

            this.#undo.push(action);
            this.#redo = [];

            let len = BigInt(this.#undo.length);
            while (len > UndoRedo.#size) {
                this.#undo.shift();
                len--;
            }

            return true;
        } catch (error) {
            console.error("UndoRedo:execute(): Failed to execute action:", error);
            return false;
        }
    }

    undo() {
        if (this.#undo.length === 0) {
            CreateNotification("Nothing to undo", "var(--notification-red)");
            return false;
        }

        const action = this.#undo.pop();
        try {
            if (typeof action.goto === "function") {
                action.goto();
            }

            action.undo();
            this.#redo.push(action);

            CreateNotification(`Undo: ${action.description}`, "var(--notification-blue)");
            switch (action.where) {
                case "groups": {
                    $groups.classList.remove("collapsed");
                    this.#scrollTo(action.where, action.type, action.data);
                } break;
            }

            return true;
        } catch (error) {
            this.#undo.push(action);

            console.error("UndoRedo:undo(): Failed to undo action:", error);
            return false;
        }
    }

    redo() {
        if (this.#redo.length === 0) {
            CreateNotification("Nothing to redo", "var(--notification-red)");
            return false;
        }

        const action = this.#redo.pop();
        try {
            if (typeof action.goto === "function") {
                action.goto();
            }

            action.execute();
            this.#undo.push(action);

            CreateNotification(`Redo: ${action.description}`, "var(--notification-green)");
            switch (action.where) {
                case "groups": {
                    $groups.classList.remove("collapsed");
                    this.#scrollTo(action.where, action.type, action.data);
                } break;
            }

            return true;
        } catch (error) {
            this.#redo.push(action);

            console.error("UndoRedo:redo(): Failed to undo action:", error);
            return false;
        }
    }

    clear() {
        this.#undo = [];
        this.#redo = [];
    }

    #scrollTo(where, type, data) {
        switch (where) {
            case "groups": {
                let $target;
                switch (type) {
                    case "auto":
                    case "bulk-delete":
                    case "clean": {
                        $target = $groups.querySelector(":scope > .content > .group");
                    } break;
                    default: {
                        if (global.groups.has(data.name)) {
                            $target = global.groups.get(data.name).element;
                        }
                    } break;
                }

                if ($target) {
                    $target.scrollIntoView({ block: "center", inline: "nearest", "behavior": "smooth" });
                } else {
                    $groups.querySelector(":scope > .content").scrollIntoView({ block: "start", inline: "nearest", "behavior": "smooth" });
                }
            } break;
        }
    }
}