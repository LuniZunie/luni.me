export class List {
    #start = undefined;
    #end = undefined;
    #data = new Map();

    #size = 0;

    prepend(key, obj) {
        if (this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.prepend(): <arguments[0]> already exists in List");
        }

        this.#data.set(key, { prev: undefined, next: this.#start, data: obj });

        if (this.#start) {
            this.#data.get(this.#start).prev = key;
        }
        this.#start = key;

        if (this.#end === undefined) {
            this.#end = key;
        }

        this.#size++;
    }
    append(key, obj) {
        if (this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.append(): <arguments[0]> already exists in List");
        }

        this.#data.set(key, { prev: this.#end, next: undefined, data: obj });

        if (this.#end) {
            this.#data.get(this.#end).next = key;
        }
        this.#end = key;

        if (this.#start === undefined) {
            this.#start = key;
        }

        this.#size++;
    }

    insertBefore(key, obj, ref) {
        ref ??= this.#end;

        if (this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.insertBefore(): <arguments[0]> already exists in List");
        } else if (!this.#data.has(ref)) {
            throw new Error("client/module/follower.js:List.prototype.insertBefore(): <arguments[2]> does not exist in List");
        }

        const prev = this.#data.get(ref).prev;
        if (ref === this.#start) {
            this.#start = key;
        } else {
            this.#data.get(prev).next = key;
        }

        this.#data.set(key, { prev, next: ref, data: obj });
        this.#data.get(ref).prev = key;

        this.#size++;
    }
    insertAfter(key, obj, ref) {
        ref ??= this.#start;

        if (this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.insertAfter(): <arguments[0]> already exists in List");
        } else if (!this.#data.has(ref)) {
            throw new Error("client/module/follower.js:List.prototype.insertAfter(): <arguments[2]> does not exist in List");
        }

        const next = this.#data.get(ref).next;
        if (ref === this.#end) {
            this.#end = key;
        } else {
            this.#data.get(next).prev = key;
        }

        this.#data.set(key, { prev: ref, next, data: obj });
        this.#data.get(ref).next = key;

        this.#size++;
    }

    after(key) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.after(): <arguments[0]> does not exist in List");
        }

        return this.#data.get(key).next;
    }
    before(key) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.before(): <arguments[0]> does not exist in List");
        }

        return this.#data.get(key).prev;
    }
    get(key) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.get(): <arguments[0]> does not exist in List");
        }

        return this.#data.get(key).data;
    }

    has(key) {
        return this.#data.has(key);
    }
    indexOf(key) {
        let index = 0,
            it = this.#start;
        while (it !== undefined) {
            if (it === key) {
                return index;
            }
            it = this.#data.get(it).next;
            index++;
        }

        return -1;
    }

    forward(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("client/module/follower.js:List.prototype.forward(): <arguments[0]> must be <typeof \"function\">");
        }

        let it = this.#start;
        while (it !== undefined) {
            callback(this.get(it), it, this);

            it = this.#data.get(it).next;
        }
    }
    backward(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("client/module/follower.js:List.prototype.backward(): <arguments[0]> must be <typeof \"function\">");
        }

        let it = this.#end;
        while (it !== undefined) {
            callback(this.get(it), it, this);

            it = this.#data.get(it).prev;
        }
    }

    swap(a, b) {
        if (!this.#data.has(a)) {
            throw new Error("client/module/follower.js:List.prototype.swap(): <arguments[0]> does not exist in List");
        } else if (!this.#data.has(b)) {
            throw new Error("client/module/follower.js:List.prototype.swap(): <arguments[1]> does not exist in List");
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

        const A = this.#data.get(a),
              B = this.#data.get(b);

        [ A.next, B.next ] = [ B.next, A.next ];
        [ A.prev, B.prev ] = [ B.prev, A.prev ];
    }
    moveBefore(key, ref) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.moveBefore(): <arguments[0]> does not exist in List");
        }

        if (ref === undefined) {
            return this.moveAfter(key, this.#end);
        } else if (!this.#data.has(ref)) {
            throw new Error("client/module/follower.js:List.prototype.moveBefore(): <arguments[1]> does not exist in List");
        }

        if (key === ref) {
            return;
        }

        const current = this.#data.get(key),
              target = this.#data.get(ref);

        if (current.next === ref) {
            return;
        }

        this.#unlink(key);

        current.prev = target.prev;
        current.next = ref;

        if (target.prev) {
            this.#data.get(target.prev).next = key;
        } else {
            this.#start = key;
        }

        target.prev = key;
    }
    moveAfter(key, ref) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.moveAfter(): <arguments[0]> does not exist in List");
        }

        if (ref === undefined) {
            return this.moveBefore(key, this.#start);
        } else if (!this.#data.has(ref)) {
            throw new Error("client/module/follower.js:List.prototype.moveAfter(): <arguments[1]> does not exist in List");
        }

        if (key === ref) {
            return;
        }

        const current = this.#data.get(key),
              target = this.#data.get(ref);

        if (current.prev === ref) {
            return;
        }

        this.#unlink(key);

        current.prev = ref;
        current.next = target.key;

        if (target.next) {
            this.#data.get(target.next).prev = key;
        } else {
            this.#end = key;
        }

        target.next = key;
    }

    delete(key) {
        if (!this.#data.has(key)) {
            throw new Error("client/module/follower.js:List.prototype.delete(): <arguments[0]> does not exist in List");
        }

        const next = this.#data.get(key).next,
              prev = this.#data.get(key).prev;

        if (key === this.#start) {
            this.#start = next;
        }
        if (key === this.#end) {
            this.#end = prev;
        }

        if (prev in this.#data) {
            this.#data.get(prev).next = next;
        }
        if (next in this.#data) {
            this.#data.get(next).prev = prev;
        }

        this.#data.delete(key);

        this.#size--;
    }
    clear() {
        this.#start = undefined;
        this.#end = undefined;

        this.#data = new Map();

        this.#size = 0;
    }

    get size() {
        return this.#size;
    }
    get empty() {
        return this.#size === 0;
    }

    get first() {
        return this.#start;
    }
    get last() {
        return this.#end;
    }

    clone(handler) {
        if (typeof handler !== "function") {
            throw new TypeError("client/module/follower.js:List.prototype.clone(): <arguments[0]> must be <typeof \"function\">");
        }

        const clone = new List();
        this.forward((value, key) => {
            clone.append(key, handler(value));
        });

        return clone;
    }
    toObject() {
        return Object.fromEntries(Array.from(this.#data.entries(), ([ key, value ]) => [ key, value.data ]));
    }
    toMap() {
        return new Map(Array.from(this.#data.entries(), ([ key, value ]) => [ key, value.data ]));
    }

    *keys() {
        let it = this.#start;
        while (it !== undefined) {
            yield it;
            it = this.#data.get(it)?.next;
        }
    }

    *values() {
        let it = this.#start;
        while (it !== undefined) {
            yield this.#data.get(it)?.data;
            it = this.#data.get(it)?.next;
        }
    }

    *entries() {
        let it = this.#start;
        while (it !== undefined) {
            const node = this.#data.get(it);
            yield [ it, node.data ];
            it = node.next;
        }
    }

    [Symbol.iterator]() {
        return this.values();
    }

    #unlink(key) {
        const node = this.#data.get(key);
        if (!node) {
            return;
        }

        const { prev, next } = node;

        if (prev) {
            this.#data.get(prev).next = next;
        } else {
            this.#start = next;
        }

        if (next) {
            this.#data.get(next).prev = prev;
        } else {
            this.#end = prev;
        }

        node.prev = undefined;
        node.next = undefined;
    }
};