import { EncodeMemberSelectors } from "../function/groups/member-encoding.js";
import { global } from "../global.js";

export function DeleteFilesEventHandler($button) {
    const $files = document.querySelector("#top > .files");

    $button.addEventListener("click", e => {
        const $selected = $files.querySelectorAll(".file.selected");
        if ($selected.length === 0) {
            global.files = { };
            $files.innerHTML = "";

            global.groups.forward((group, key) => {
                group.members = [ ];
                group.element.querySelector(":scope > .members").innerHTML = "";
            });
        } else {
            const names = [ ];
            for (const $el of $selected) {
                const unique = $el.dataset.unique;
                names.push(unique);

                delete global.files[unique];
                $el.remove();
            }

            global.groups.forward((group, key) => {
                group.members = group.members.filter(member => {
                    const filter = !names.some(name => name === member.selectors[0]);
                    if (!filter) {
                        group.element.querySelector(`:scope > .members > .member[data-selectors="${EncodeMemberSelectors(member.selectors)}"]`)?.remove?.();
                    }
                    return filter;
                });
            });
        }
    });
};