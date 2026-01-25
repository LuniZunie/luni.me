/*
    ID FORMAT

    class ids must be:
        - unique
        - in snake_case format

    if class is given a name (ex. class Name extends Parent {})
        - use class name as id
        - use "." to separate
        - example: Parent.Name
    if class is not given a name (ex. const name = class extends Parent {})
        - use variable name as id
        - use "#" to separate
        - example: Parent#name
    if class is enclosed by another class (ex. class Enclosing extends Parent { static Enclosed = class extends OtherParent {} })
        - use enclosing class id as prefix
        - use ">" to separate
        - example: Parent.Enclosing>OtherParent#enclosed
*/

import cString from "../../../../module/cString.js";

import { __prefabs__ } from "../prefab/class.js"
import { Linker } from "../linker/class.js";

const createInfo = node => {
    return cString.trimIndent(`
        [CONSTRUCTOR_NAME]: ${node.constructor.name}
        id: ${node.id}
        name: ${node.name}
        description: ${node.description}
    `);
};

export const IDTable = {
    build() {
        const table = new Map();
        __prefabs__.list(Linker.Node, 0).forEach(node => {
            if (!node.id || typeof node.id !== "string" || node.id.length === 0) {
                throw new TypeError(`ID Table: Prefab missing valid id.\n${createInfo(node)}`);
            } else if (table.has(node.id)) {
                throw new TypeError(`ID Table: Duplicate prefab id: ${node.id}\n${createInfo(node)}`);
            }

            table.set(node.id, node);
        });
        return table;
    }
}