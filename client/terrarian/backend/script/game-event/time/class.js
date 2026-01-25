import { __gameEvents__, GameEvent } from "../class.js";

export class TimeGameEvent extends GameEvent {
    static id = "game-event.time";
    static type = "time";
}
export const __timeGameEvents__ = __gameEvents__.link(TimeGameEvent);