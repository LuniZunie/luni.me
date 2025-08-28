import { global } from "../../global.js";
import { CreateNotification } from "../../../../module/notification.js";

const $groups = document.querySelector("#groups");
export class UndoRedoManager {
    #undo = [];
    #redo = [];
    #size = 100;

    constructor(size = this.#size) {
        this.#size = size;
    }

    execute(action) {
        if (!action || typeof action.execute !== "function" || typeof action.undo !== "function") {
            console.error("UndoRedoManager:execute(): Invalid action, must have execute and undo functions");
            return false;
        }

        try {
            action.execute();

            this.#undo.push(action);
            this.#redo = [];

            while (this.#undo.length > this.#size) {
                this.#undo.shift();
            }

            return true;
        } catch (error) {
            console.error("UndoRedoManager:execute(): Failed to execute action:", error);
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

            console.error("UndoRedoManager:undo(): Failed to undo action:", error);
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

            console.error("UndoRedoManager:redo(): Failed to undo action:", error);
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
                        $target = global.groups[data.name]?.element;
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

export class FloatUndoRedoManager extends UndoRedoManager {
    #active = false;

    activate() {
        this.#active = true;
        this.clear();
    }
    deactivate() {
        this.#active = false;
        this.clear();
    }

    get active() {
        return this.#active;
    }
}