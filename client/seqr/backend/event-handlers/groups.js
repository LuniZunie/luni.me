import { global } from "../global.js";
import { MainUndoRedo } from "../function/undo-redo/instance.js";
import { UniqueName } from "../function/unique-name.js";
import { NewGroup } from "../function/groups/main.js";
import { AutoGroup } from "../function/groups/auto-group/main.js";

export function NewGroupEventHandler($button) {
    $button.addEventListener("click", e => {
        global.groups ??= { };

        const name = UniqueName("Unnamed Group", v => v in global.groups);
        MainUndoRedo.execute({
            description: `Created group "${name}"`,

            where: "groups",
            type: "new",
            data: { name },

            execute() {
                NewGroup(name);
            },
            undo() {
                const group = global.groups[name];
                if (group) {
                    group?.element.remove();
                    delete global.groups[name];
                }
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

        const files = [ ...$files.querySelectorAll(":scope > .file.selected") ].map($file => global.files?.[$file.dataset.unique]);

        const prev = [ ];
        for (const group of Object.values(global.groups ?? { })) {
            prev[group.index] = { name: group.name, members: [ ...group.members ] };
        }

        MainUndoRedo.execute({
            description: `Auo group files`,

            where: "groups",
            type: "auto",

            async execute() {
                await AutoGroup(options, files.length ? files : null);
            },
            undo() {
                document.querySelector("#groups > .content").innerHTML = "";
                global.groups = { };

                for (const group of prev) {
                    NewGroup(group.name, group.members);
                }
            }
        });
    });
}