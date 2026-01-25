export class Linker {
    static Terminus = Symbol("Terminus");
    static Junction = Symbol("Junction");
    static Node = Symbol("Node");

    #path = [ ];
    #names = [ ];

    #tree = new Map();

    constructor(root) {
        this.#path.push(root);
        this.#tree.set(root, Linker.Terminus);
    }

    #get(path) {
        let cur = this.#tree;
        for (const p of path) {
            if (!cur.has(p)) {
                return undefined;
            }

            cur = cur.get(p);
        }

        return cur;
    }

    goto(...constructs) {
        const path = this.#path.slice(),
              names = this.#names.slice();
        for (const construct of constructs) {
            const name = construct?.name ?? construct?.toString(),
                  cur = this.#get(path);
            if (cur === Linker.Terminus) {
                throw new TypeError(`Linker>${names.join(".")}[${name}]: Reached terminus, cannot go deeper.`);
            } else if (!cur.has(construct)) {
                throw new TypeError(`Linker>${names.join(".")}[${name}]: Path does not exist.`);
            }

            path.push(construct);
            names.push(name);
        }

        const temp = new Linker(path[0]);
        temp.#path = path;
        temp.#names = names;
        temp.#tree = this.#tree;
        return temp;
    }

    back(steps = Infinity) {
        if ((!Number.isInteger(steps) && steps !== Infinity) || steps < 0) {
            throw new TypeError(`Linker>${this.#names.join(".")}: Invalid steps, must be a positive integer or Infinity.`);
        }

        if (steps === 0) {
            return this;
        }
        steps = Math.min(steps, this.#path.length - 1);

        const path = this.#path.slice(0, -steps),
              names = this.#names.slice(0, -steps);

        const temp = new Linker(path[0]);
        temp.#path = path;
        temp.#names = names;
        temp.#tree = this.#tree;
        return temp;
    }

    link(...constructs) {
        for (const construct of constructs) {
            if (typeof construct !== "object" && typeof construct !== "function") {
                throw new TypeError(`Linker>${this.#names.join(".")}: Invalid construct, must be an object or function.`);
            }

            const name = construct?.name ?? construct?.toString(),
                  cur = this.#get(this.#path);
            if (cur === Linker.Terminus) {
                this.#get(this.#path.slice(0, -1)).set(this.#path.at(-1), new Map([ [ construct, Linker.Terminus ] ]));
            } else if (cur instanceof Map) {
                if (cur.has(construct)) {
                    throw new TypeError(`Linker>${this.#names.join(".")}[${name}]: Path already exists.`);
                }
                cur.set(construct, Linker.Terminus);
            }
        }
        return this;
    }

    list(nodeType = Linker.Node, depth = 0) { /* depth = 0 => search recursively */
        if (nodeType !== Linker.Node && nodeType !== Linker.Junction && nodeType !== Linker.Terminus) {
            throw new TypeError(`Linker>${this.#names.join(".")}: Invalid node type, must be Linker.Node, Linker.Junction, or Linker.Terminus.`);
        }
        if (!Number.isInteger(depth) || depth < 0) {
            throw new TypeError(`Linker>${this.#names.join(".")}: Invalid depth, must be a positive integer or zero.`);
        }

        const map = this.#get(this.#path);
        if (map === Linker.Terminus) {
            return [ ];
        }

        const q = [ { map, d: 0 } ],
              termini = [ ],
              junctions = [ ];

        while (q.length > 0) {
            const { map, d } = q.shift();
            if (depth === 0 || d < depth) {
                for (const [ k, v ] of map.entries()) {
                    if (v === Linker.Terminus) {
                        termini.push(k);
                    } else if (v instanceof Map) {
                        junctions.push(k);
                        q.push({ map: v, d: d + 1 });
                    }
                }
            }
        }

        switch (nodeType) {
            case Linker.Node: return termini.concat(junctions);
            case Linker.Junction: return junctions;
            case Linker.Terminus: return termini;
        }
    }
}