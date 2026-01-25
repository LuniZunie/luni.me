import { global } from "../global.js";
import { DeleteGroup, MoveGroup, NewGroup } from "../function/groups/main.js";
import { MainUndoRedo } from "../function/undo-redo/instance.js";
import { LoadDataSelector, RememberGroupForDataSelector } from "../function/groups/data-selector/main.js";

export function EditGroupEventHandler($button) {
    const $selector = document.querySelector("#data-selector"),
          $tabs = $selector.querySelector(":scope > .tabs");

    $button.addEventListener("click", e => {
        const $group = $button.closest(".group"),
              name = $group.dataset.unique;

        $tabs.innerHTML = "";

        const filesWithSelection = RememberGroupForDataSelector(name);

        let found = false, select;
        for (const fileName of Object.keys(global.files ?? { })) {
            const $tab = document.createElement("div");
            {
                $tab.className = "tab";
                $tab.textContent = fileName;

                $tab.dataset.value = fileName;
                $tab.dataset.event = "data-selector:tab";

                $tabs.appendChild($tab);
            }

            if (filesWithSelection.has(fileName)) {
                $tab.classList.add("has-selected");

                if (found === false) {
                    found = true;
                    select = fileName;
                }
            }

            if (found === false && select === undefined) {
                select = fileName;
            }
        }

        if (select === undefined) {
            return; // TODO error
        } else {
            LoadDataSelector(select);
        }

        $selector.classList.remove("hidden");
    });
}

export function DeleteGroupEventHandler($button) {
    $button.addEventListener("click", e => {
        const $group = $button.closest(".group"),
              name = $group.dataset.unique;

        const old = global.groups.clone(group => ({ name: group.name, members: [ ...group.members ] }));
        MainUndoRedo.execute({
            description: "Deleted group",

            where: "groups",
            type: "delete",
            data: { name },

            execute() {
                DeleteGroup(name);
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

export function MoveGroupEventHandler($button, move) {
    $button.addEventListener("click", e => {
        const $group = $button.closest(".group"),
              name = $group.dataset.unique;

        const index = global.groups.indexOf(name);
        MainUndoRedo.execute({
            description: "Moved group",

            where: "groups",
            type: "move",
            data: { name },

            execute() {
                const movedTo = MoveGroup(name, move);
                if (movedTo === false || movedTo === index) {
                    return { cancel: true };
                }
            },
            undo() {
                MoveGroup(name, BigInt(index));
            }
        });
    });
}