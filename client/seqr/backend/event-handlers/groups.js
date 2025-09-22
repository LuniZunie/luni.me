import { global } from "../global.js";
import { MainUndoRedo } from "../function/undo-redo/instance.js";
import { UniqueName } from "../function/unique-name.js";
import { DeleteGroup, NewGroup } from "../function/groups/main.js";
import { AutoGroup } from "../function/groups/auto-group/main.js";
import { Text } from "../../../module/text.js";
import { CleanGroups } from "../function/groups/clean.js";

function remember(groups) {
    const prev = [ ];
    for (const group of Object.values(groups ?? { })) {
        prev[group.index] = { name: group.name, members: [ ...group.members ] };
    }

    return prev;
}

export function NewGroupEventHandler($button) {
    $button.addEventListener("click", e => {
        const name = UniqueName("Unnamed Group", v => global.groups.has(v));
        MainUndoRedo.execute({
            description: `Created group "${name}"`,

            where: "groups",
            type: "new",
            data: { name },

            execute() {
                NewGroup(name);
            },
            undo() {
                DeleteGroup(name);
            }
        });
    });
}

export function AutoGroupEventHandler($button) {
    const $files = document.querySelector("#top > .files"),
          $options = $button.closest(".button-plus").querySelector(":scope > .cycles > .cycle.options");
    $button.addEventListener("click", async e => {
        const options = new Set();
        $options.querySelectorAll(":scope > .button.selected").forEach($el => options.add($el.dataset.value));

        const files = Object.fromEntries([ ...$files.querySelectorAll(":scope > .file.selected") ].map($file => {
            const name = $file.dataset.unique;
            return [ name, global.files?.[name] ];
        })),
              len = Object.values(files).length;

        const old = global.groups.clone(group => ({ name: group.name, members: [ ...group.members ] }));
        MainUndoRedo.execute({
            description: len > 0 ?
                `Auto-group selected ${new Text("file").case().get(len)}` :
                "Auto-group all files",

            where: "groups",
            type: "auto",

            async execute() {
                await AutoGroup(options, len > 0 ? files : null);
            },
            undo() {
                document.querySelector("#groups > .content").innerHTML = "";
                global.groups.clear();

                old.forward(group => {
                    NewGroup(group.name, group.members);
                });
            }
        });
    });
}

export function CleanGroupsEventHandler($button) {
    const $groups = document.querySelector("#groups > .content");

    $button.addEventListener("click", e => {
        const $selected = $groups.querySelectorAll(":scope > .group.selected"),
              len = $selected.length;

        const old = global.groups.clone(group => ({ name: group.name, members: [ ...group.members ] }));
        MainUndoRedo.execute({
            description: len > 0 ?
                `Clean selected ${new Text("group").case().get(len)}` :
                "Clean all groups",

            where: "groups",
            type: "clean",

            execute() {
                CleanGroups($selected);
            },
            undo() {
                $groups.innerHTML = "";
                global.groups.clear();

                old.forward(group => {
                    NewGroup(group.name, group.members);
                });
            }
        })
    });
}

export function DeleteGroupsEventHandler($button) {
    const $groups = document.querySelector("#groups > .content");

    $button.addEventListener("click", e => {
        const $selected = $groups.querySelectorAll(":scope > .group.selected"),
              len = $selected.length;

        let groups = { };
        if ($selected.length === 0) {
            groups = global.groups.toObject();
        } else {
            for (const $group of $selected) {
                const name = $group.dataset.unique;
                groups[name] = global.groups.get(name);
            }
        }

        const old = global.groups.clone(group => ({ name: group.name, members: [ ...group.members ] }));
        MainUndoRedo.execute({
            description: len > 0 ?
                `Delete selected ${new Text("group").case().get(len)}` :
                "Delete all groups",

            where: "groups",
            type: "bulk-delete",

            execute() {
                for (const name of Object.keys(groups)) {
                    DeleteGroup(name);
                }
            },
            undo() {
                $groups.innerHTML = "";
                global.groups.clear();

                old.forward(group => {
                    NewGroup(group.name, group.members);
                });
            }
        })
    });
}