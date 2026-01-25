import cObject from "../../../../module/cObject.js";

import { Linker } from "../linker/class.js";

import { Text } from "../../../../module/text.js";
import { UUID } from "../../../../module/uuid.js";

export class Prefab {
    static id = "prefab";
    static name = new Text("<none>").plural(false);
    static description = new Text("<none>").plural(false);

    static sprite = "/game/assets/null.svg";

    id;
    q = 1;

    import(BUILD, data) {
        if (!cObject.match(data, this.constructor.format)) {
            throw new TypeError("Invalid import.");
        }
        for (const [ k, v ] of Object.entries(data)) {
            if (v.prefab) {
                const prefab = new (BUILD.get(v.id))();
                prefab.import(BUILD, v.data);
                this[k] = prefab;
            } else if (Array.isArray(v)) {
                this[k] = v
                    .filter(x => x !== null && x !== undefined)
                    .map(x => {
                        if (x.prefab) {
                            const prefab = new (BUILD.get(x.id))();
                            prefab.import(BUILD, x.data);
                            return prefab;
                        }
                        return x;
                    });
            } else this[k] = v;
        }
    }
    export() {
        const data = {};
        for (const [ k, v ] of Object.entries(this.constructor.format)) {
            if (this[k] === undefined || this[k] === null) continue;
            if (!v.test(this[k])) throw new TypeError(`Invalid export: ${k}=${this[k]}`);

            const val = this[k];
            if (val instanceof Prefab) {
                data[k] = { prefab: true, id: val.constructor.id, data: val.export() };
            } else if (Array.isArray(val)) {
                data[k] = val.map(v => v instanceof Prefab ? { prefab: true, id: v.constructor.id, data: v.export() } : v);
            } else {
                data[k] = this[k];
            }
        }
        return data;
    }

    capture() { }

    static format = {
        id: { required: true, test: v => typeof v === "string" && v.length > 0 },
        q: { required: true, test: v => Number.isInteger(v) && v > 0 },
    };

    constructor() {
        this.id = `${this.constructor.id}@${UUID()}`;
    }
};
export const __prefabs__ = new Linker(Prefab);