import { GameEvent, __gameEvents__ } from "./class.js";

export class WalletChangeGameEvent extends GameEvent {
    static id = "game-event.wallet-change";
    static type = "wallet-change";
    static {
        __gameEvents__.link(this);
    }
}