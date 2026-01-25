import { Text } from "../../../../module/text.js";

import { Inventory } from "./inventory.js";

export class User {
    #id;
    #email;
    #name;
    #username;
    #avatar;
    #service;

    inventory = new Inventory();

    constructor({ id, email, name, username, avatar, service }) {
        this.#id = id;
        this.#email = email;
        this.#name = name;
        this.#username = username || name;
        this.#avatar = avatar || "/game/assets/avatar.svg";
        this.#service = new Text(service || "unknown service").plural(false);
    }

    get id() {
        return this.#id;
    }
    get email() {
        return this.#email;
    }
    get name() {
        return this.#name;
    }
    get username() {
        return this.#username;
    }
    get avatar() {
        return this.#avatar;
    }
    get service() {
        return this.#service;
    }
}