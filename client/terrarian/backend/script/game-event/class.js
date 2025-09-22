import { Linker } from "../linker/class.js";

import { Game } from "../function/game.js";
import { Prefab } from "../prefab/class.js";

export class GameEvent {
    static id = "game-event";
    static type = "default";

    static #prefabs;
    static {
        this.#prefabs = new Map(); // separate map for each subclass
    }

    static connect(prefab, count) {
        if (!(prefab instanceof Prefab)) {
            throw new TypeError(`${this.id}.connect(): {arguments[0] instanceof Prefab} failed.`);
        } else if (typeof count !== "bigint" || count <= 0n) {
            throw new TypeError(`${this.id}.connect(): {typeof arguments[1] === "bigint" && arguments[1] > 0n} failed.`);
        } else if (this.#prefabs.has(prefab)) {
            throw new TypeError(`${this.id}.connect(): event already connected to prefab.`);
        }

        this.#prefabs.set(prefab, { at: 0n, count });
    }
    static disconnect(prefab) {
        if (!(prefab instanceof Prefab)) {
            throw new TypeError(`${this.id}.disconnect(): {arguments[0] instanceof Prefab} failed.`);
        } else if (!this.#prefabs.has(prefab)) {
            throw new TypeError(`${this.id}.disconnect(): event not connected to prefab.`);
        }

        this.#prefabs.delete(prefab);
    }

    static trigger(game) {
        if (!(game instanceof Game)) {
            throw new TypeError(`${this.id}.trigger(): {arguments[0] instanceof Game} failed.`);
        }

        for (const [ prefab, counter ] of this.#prefabs) {
            if (++counter.at >= counter.count) {
                counter.at = 0n;
                prefab.capture?.(game, this);
            }
        }
    }
}
export const __gameEvents__ = new Linker(GameEvent);