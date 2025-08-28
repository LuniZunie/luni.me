import { global } from "../global.js";
import { DeleteGroup, NewGroup } from "../function/groups/main.js";
import { DataSelectorUndoRedo, MainUndoRedo } from "../function/undo-redo/instance.js";
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

        DataSelectorUndoRedo.activate();
        $selector.classList.remove("hidden");
    });
}

export function DeleteGroupEventHandler($button) {
    $button.addEventListener("click", e => {
        const $group = $button.closest(".group");

        const old = global.groups.clone(group => ({ name: group.name, members: [ ...group.members ] }));
        MainUndoRedo.execute({
            description: "Deleted group",

            where: "groups",
            type: "bulk-delete",

            execute() {
                DeleteGroup($group.dataset.unique);
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