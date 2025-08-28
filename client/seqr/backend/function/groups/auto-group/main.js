import { global } from "../../../global.js";
import { ChunkedProxy } from "../../file/file-storage/proxy.js";
import { NewGroup } from "../main.js";
import { GroupColorSystem } from "./color.js";

async function Logic(options, files) {
    files ??= global.files ?? { };

    const promises = [ ];
    for (const file of Object.values(files)) {
        if (!file.isMetadataLoaded()) {
            promises.push(file.load(ChunkedProxy.Type.Metadata));
        }
    }

    if (promises.length) {
        await Promise.all(promises);
    }

    const config = [ options.has("file"), options.has("type"), options.has("strand") ],
          groups = [ ];
    if (config.every(v => v === false)) {
        const group = { name: "AutoGroup w/ no options", members: [ ] };
        for (const [ name, file ] of Object.entries(files)) {
            const fileSeed = `${name} `;
            for (const [ type, strands ] of Object.entries(file.types)) {
                const typeSeed = `${fileSeed}${type} `,
                      root = file.colors[type];

                for (const strand of Object.keys(strands)) {
                    group.members.push({
                        selectors: [ name, type, strand ],
                        color: GroupColorSystem.generateColor(typeSeed + strand),
                        settings: {
                            fileDefined: root?.[strand] || false
                        }
                    });
                }
            }
        }

        groups.push(group);
    } else {
        const NestedStructure = (obj, path) => {
            let root = obj;
            for (const key of path) {
                root = root[key] ??= { };
            }
            return root;
        };

        const temp = { };
        for (const [ name, file ] of Object.entries(files)) {
            const fileSeed = `${name} `;
            for (const [ type, strands ] of Object.entries(file.types)) {
                const typeSeed = `${fileSeed}${type} `,
                      root = file.colors[type];
                for (const strand of Object.keys(strands)) {
                    const path = [ name, type, strand ].filter((v, i) => config[i]);

                    const parent = NestedStructure(temp, path.slice(0, -1)),
                          terminus = path[path.length - 1];

                    if (!parent[terminus]) {
                        parent[terminus] = { name: path.join(" "), members: [ ] };
                        groups.push(parent[terminus]);
                    }

                    parent[terminus].members.push({
                        selectors: [ name, type, strand ],
                        color: GroupColorSystem.generateColor(typeSeed + strand),
                        settings: {
                            fileDefined: root?.[strand] || false
                        }
                    });
                }
            }
        }
    }

    return groups;
}

export async function AutoGroup(options, files) {
    document.querySelector("#groups > .content").innerHTML = "";
    global.groups.clear();

    const groups = await Logic(options, files);
    for (const group of groups) {
        NewGroup(group.name, group.members);
    }
}