export class List {
    #start = undefined;
    #end = undefined;
    #data = { };

    prepend(key, obj) {
        if (key in this.#data) {
            throw new Error("client/module/follower.js:List.prepend(): <arguments[0]> already exists in List");
        }

        this.#data[key] = {
            prev: undefined,
            next: this.#start,

            data: obj
        };

        if (this.#start) {
            this.#data[this.#start].prev = key;
        }
        this.#start = key;

        if (this.#end === undefined) {
            this.#end = key;
        }
    }
    append(key, obj) {
        if (key in this.#data) {
            throw new Error("client/module/follower.js:List.append(): <arguments[0]> already exists in List");
        }

        this.#data[key] = {
            prev: this.#end,
            next: undefined,

            data: obj
        };

        if (this.#end) {
            this.#data[this.#end].next = key;
        }
        this.#end = key;

        if (this.#start === undefined) {
            this.#start = key;
        }
    }

    insertBefore(key, obj, ref) {
        ref ??= this.#end;

        if (key in this.#data) {
            throw new Error("client/module/follower.js:List.insertBefore(): <arguments[0]> already exists in List");
        } else if (!(ref in this.#data)) {
            throw new Error("client/module/follower.js:List.insertBefore(): <arguments[2]> does not exist in List");
        }

        if (ref === this.#start) {
            this.#start = key;
        }

        this.#data[key] = {
            prev: this.#data[ref].prev,
            next: ref,

            data: obj
        };

        this.#data[ref].prev = key;
    }
    insertAfter(key, obj, ref) {
        ref ??= this.#start;

        if (key in this.#data) {
            throw new Error("client/module/follower.js:List.insertAfter(): <arguments[0]> already exists in List");
        } else if (!(ref in this.#data)) {
            throw new Error("client/module/follower.js:List.insertAfter(): <arguments[2]> does not exist in List");
        }

        if (ref === this.#end) {
            this.#end = key;
        }

        this.#data[key] = {
            prev: ref,
            next: this.#data[ref].next,

            data: obj
        };

        this.#data[ref].next = key;
    }

    after(key) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.after(): <arguments[0]> does not exist in List");
        }

        return this.#data[key].next;
    }
    before(key) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.before(): <arguments[0]> does not exist in List");
        }

        return this.#data[key].prev;
    }
    get(key) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.get(): <arguments[0]> does not exist in List");
        }

        return this.#data[key].data;
    }

    has(key) {
        return key in this.#data;
    }
    indexOf(key) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.indexOf(): <arguments[0]> does not exist in List");
        }

        let index = 0,
            it = this.#start;
        while (it !== undefined) {
            if (it === key) {
                return index;
            }
            it = this.#data[it].next;
            index++;
        }

        return -1;
    }

    forward(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("client/module/follower.js:List.forward(): <arguments[0]> must be <typeof \"function\">");
        }

        let it = this.#start;
        if (it === undefined) {
            return;
        }

        do {
            callback(this.get(it), it, this);

            it = this.#data[it].next;
        } while (it !== undefined);
    }
    backward(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("client/module/follower.js:List.backward(): <arguments[0]> must be <typeof \"function\">");
        }

        let it = this.#end;
        if (it === undefined) {
            return;
        }

        do {
            callback(this.get(it), it, this);

            it = this.#data[it].prev;
        } while (it !== undefined);
    }

    swap(a, b) {
        if (!(a in this.#data)) {
            throw new Error("client/module/follower.js:List.swap(): <arguments[0]> does not exist in List");
        } else if (!(b in this.#data)) {
            throw new Error("client/module/follower.js:List.swap(): <arguments[1]> does not exist in List");
        }

        if (this.#start === a) {
            this.#start = b;
        } else if (this.#start === b) {
            this.#start = a;
        }

        if (this.#end === a) {
            this.#end = b;
        } else if (this.#end === b) {
            this.#end = a;
        }

        const A = this.#data[a],
              B = this.#data[b];

        [ A.next, B.next ] = [ B.next, A.next ];
        [ A.prev, B.prev ] = [ B.prev, A.prev ];
    }
    moveBefore(key, ref) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.moveBefore(): <arguments[0]> does not exist in List");
        }

        if (ref === undefined) {
            return this.moveAfter(key, this.#end);
        } else if (!(ref in this.#data)) {
            throw new Error("client/module/follower.js:List.moveBefore(): <arguments[1]> does not exist in List");
        }

        if (key === ref) {
            return;
        }

        const current = this.#data[key],
              target = this.#data[ref];

        if (current.next === ref) {
            return;
        }

        this.#unlink(key);

        current.prev = target.prev;
        current.next = ref;

        if (target.prev) {
            this.#data[target.prev].next = key;
        } else {
            this.#start = key;
        }

        target.prev = key;
    }
    moveAfter(key, ref) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.moveAfter(): <arguments[0]> does not exist in List");
        }

        if (ref === undefined) {
            return this.moveBefore(key, this.#start);
        } else if (!(ref in this.#data)) {
            throw new Error("client/module/follower.js:List.moveAfter(): <arguments[1]> does not exist in List");
        }

        if (key === ref) {
            return;
        }

        const current = this.#data[key],
              target = this.#data[ref];

        if (current.prev === ref) {
            return;
        }

        this.#unlink(key);

        current.prev = ref;
        current.next = target.key;

        if (target.next) {
            this.#data[target.next].prev = key;
        } else {
            this.#end = key;
        }

        target.next = key;
    }

    delete(key) {
        if (!(key in this.#data)) {
            throw new Error("client/module/follower.js:List.delete(): <arguments[0]> does not exist in List");
        }

        const next = this.#data[key].next,
              prev = this.#data[key].prev;

        if (key === this.#start) {
            this.#start = next;
        }
        if (key === this.#end) {
            this.#end = prev;
        }

        if (prev in this.#data) {
            this.#data[prev].next = next;
        }
        if (next in this.#data) {
            this.#data[next].prev = prev;
        }

        delete this.#data[key];
    }
    clear() {
        this.#start = undefined;
        this.#end = undefined;

        this.#data = { };
    }

    get length() {
        return Object.keys(this.#data).length;
    }
    get empty() {
        return this.#start === undefined && this.#end === undefined;
    }

    clone(handler) {
        if (typeof handler !== "function") {
            throw new TypeError("client/module/follower.js:List.clone(): <arguments[0]> must be <typeof \"function\">");
        }

        const clone = new List();
        this.forward((value, key) => {
            clone.append(key, handler(value));
        });

        return clone;
    }
    toObject() {
        return Object.fromEntries(Object.entries(this.#data).map(([ key, value ]) => {
            return [ key, value.data ];
        }));
    }

    #unlink(key) {
        const node = this.#data[key];
        if (!node) {
            return;
        }

        const { prev, next } = node;

        if (prev) {
            this.#data[prev].next = next;
        } else {
            this.#start = next;
        }

        if (next) {
            this.#data[next].prev = prev;
        } else {
            this.#end = prev;
        }

        node.prev = undefined;
        node.next = undefined;
    }
};