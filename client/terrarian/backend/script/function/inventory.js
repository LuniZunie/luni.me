import cObject from "../../../../module/cObject.js";

import { IDTable } from "./id-table.js";
import { Prefab } from "../prefab/class.js";

export class Inventory {
    #inventory = { };
    #map;
    #lookup;
    #table;

    #added = new Set();
    #changed = new Map();
    #removed = new Set();

    #original = new Map();

    #__build = IDTable.build();

    constructor() {
        this.#map = new Map();
        this.#lookup = new Map();
        this.#table = IDTable.build(); // TEST: maybe use this.#__build instead?
    }

    #addToLookup(constructor, id) {
        if (this.#lookup.has(constructor)) {
            this.#lookup.get(constructor).add(id);
        } else {
            this.#lookup.set(constructor, new Set([ id ]));
        }
    }

    #add(prefab) {
        if (!(prefab instanceof Prefab)) {
            throw new TypeError(`inventory.#add(): {arguments[0] instanceof Prefab} failed.`);
        }

        const id = prefab.id;
        if (!this.#table.has(prefab.constructor.id)) {
            throw new TypeError(`inventory.#add(): unknown prefab id: ${prefab.constructor.id}`);
        } else if (this.#map.has(id)) {
            throw new TypeError(`inventory.#add(): duplicate prefab id: ${id}`);
        }

        this.#inventory[id] = {
            construct: prefab.constructor.id,
            data: prefab.export(),
        };
        this.#map.set(id, prefab);

        // id's formatted with "#" and "." as separators
        // separate the id so that an item with id "item#abc.123#type" can be found by "item#abc.123#type" or "item#abc.123" or "item#abc" or "item"
        const parts = prefab.constructor.id.split(/(?=[.#])/),
              length = parts.length;
        let prefix = "";
        for (let i = 0; i < length; i++) {
            prefix += parts[i];
            this.#addToLookup(prefix, id);
        }
    }

    add(prefab) {
        this.#add(prefab);

        const id = prefab.id;
        this.#added.add(id);
        if (this.#removed.has(id)) {
            this.#removed.delete(id);
        }
    }
    change(prefab, func) {
        if (!(prefab instanceof Prefab)) {
            throw new TypeError(`inventory.change(): {arguments[0] instanceof Prefab} failed.`);
        } else if (typeof func !== "function") {
            throw new TypeError(`inventory.change(): {typeof arguments[1] === "function"} failed.`);
        }

        const id = prefab.id;
        if (!this.#map.has(prefab.constructor.id)) {
            throw new TypeError(`inventory.change(): unknown prefab id: ${prefab.constructor.id}`);
        } else if (!this.#map.has(id)) {
            throw new TypeError(`inventory.change(): unknown prefab instance id: ${id}`);
        }

        let before;
        if (this.#original.has(id)) {
            before = this.#original.get(id);
        } else {
            before = prefab.export();
            this.#original.set(id, before);
        }

        func(prefab);

        const after = prefab.export();
        this.#inventory[id] = {
            construct: prefab.constructor.id,
            data: after,
        };
        this.#map.set(id, prefab);

        if (!this.#added.has(id)) {
            this.#changed.set(id, cObject.createDifference(before, after));
        }
        return;
    }
    remove(prefab) {
        if (!(prefab instanceof Prefab)) {
            throw new TypeError(`inventory.remove(): {arguments[0] instanceof Prefab} failed.`);
        }

        const id = prefab.id;
        if (!this.#map.has(id)) {
            throw new TypeError(`inventory.remove(): unknown prefab instance id: ${id}`);
        } else if (!this.#map.has(prefab.constructor.id)) {
            throw new TypeError(`inventory.remove(): unknown prefab id: ${prefab.constructor.id}`);
        }

        delete this.#inventory[id];
        this.#map.delete(id);
        if (this.#lookup.has(prefab.constructor.id)) {
            const set = this.#lookup.get(prefab.constructor.id);
            set.delete(id);
            if (set.size === 0) {
                this.#lookup.delete(prefab.constructor.id);
            }
        }

        this.#removed.add(id);
        if (this.#added.has(id)) {
            this.#added.delete(id);
        }
        if (this.#changed.has(id)) {
            this.#changed.delete(id);
        }

        return;
    }

    findById(id = "") {
        if (typeof id !== "string") {
            throw new TypeError(`inventory.findById(): {typeof arguments[0] === "string"} failed.`);
        }
        return this.#map.get(id) || null;
    }
    findByType(type) {
        if (!this.#table.has(type.id)) {
            throw new TypeError(`inventory.findByType(): unknown prefab id: ${type.id}`);
        }
        return this.#lookup.get(type.id) || new Set();
    }

    import(data) {
        try {
            Object.values(data || { }).forEach(datum => {
                if (typeof datum !== "object" || datum === null || !datum.construct || !this.#table.has(datum.construct)) {
                    console.error("inventory.import(): invalid datum", datum);
                    return;
                }

                const prefabClass = this.#table.get(datum.construct),
                      prefab = new prefabClass();
                try {
                    prefab.import(this.#__build, datum.data);
                    this.#add(prefab);
                } catch (error) {
                    console.error("inventory.import(): failed to import prefab", error);
                }
            });
            return true;
        } catch (error) {
            console.error("inventory.import(): failed to import data", error);

            this.#map.clear();
            this.#lookup.clear();
            this.#added.clear();
            this.#changed.clear();
            this.#removed.clear();

            return false;
        }
    }
    export() {
        const out = {
            added: [ ],
            changed: [ ],
            removed: [ ],
        };

        for (const id of this.#added) {
            const prefab = this.#map.get(id);
            if (prefab) {
                out.added.push({
                    construct: prefab.constructor.id,
                    id: prefab.id,
                    data: prefab.export(),
                });
            } else {
                console.warn(`inventory.export(): added id not found in map: ${id}`);
            }
        }
        this.#added.clear();

        for (const [ id, diff ] of this.#changed) {
            const prefab = this.#map.get(id);
            if (prefab) {
                out.changed.push({
                    id: prefab.id,
                    data: diff,
                });
            } else {
                console.warn(`inventory.export(): changed id not found in map: ${id}`);
            }
        }
        this.#changed.clear();
        this.#original.clear();

        for (const id of this.#removed) {
            const prefab = this.#map.get(id);
            if (prefab) {
                out.removed.push({ id: prefab.id });
            } else {
                console.warn(`inventory.export(): removed id not found in map: ${id}`);
            }
        }
        this.#removed.clear();

        return out;
    }

    async indexeddb(hash) {
        const db = window.indexedDB.open("Terrarian", 1);

        return new Promise((res, rej) => {
            db.onerror = () => rej(db.error);
            db.onupgradeneeded = () => {
                const database = db.result;
                if (!database.objectStoreNames.contains("inventory")) {
                    database.createObjectStore("inventory");
                }
            }
            db.onsuccess = () => {
                const database = db.result,
                      transaction = database.transaction("inventory", "readwrite"),
                      store = transaction.objectStore("inventory");

                const clear = store.clear();
                clear.onsuccess = () => {
                    const put = store.put(this.#inventory, hash);
                    put.onsuccess = () => res(true);
                    put.onerror = () => rej(put.error);
                };
                clear.onerror = () => rej(clear.error);

                transaction.oncomplete = () => database.close();
                transaction.onerror = () => rej(transaction.error);
            };
        });
    }
}