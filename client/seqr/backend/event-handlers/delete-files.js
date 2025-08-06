import { global } from "../global.js";

export function DeleteFilesEventHandler($button) {
    const $files = document.querySelector("#top > .files"),
          $groups = document.querySelector("#groups > .content");

    $button.addEventListener("click", e => {
        const $selected = $files.querySelectorAll(".file.selected");
        if ($selected.length === 0) {
            global.files = { };
            $files.innerHTML = "";

            global.groups = { };
            $groups.innerHTML = "";
        } else {
            const names = [ ];
            for (const $el of $selected) {
                const unique = $el.dataset.unique;
                names.push(unique);

                delete global.files[unique];
                $el.remove();
            }

            for (const [ key, group ] of Object.entries(global.group ?? { })) {
                group.member = group.members.filter(member => !names.some(name => name === member.member[0]));
                if (group.member.length === 0) {
                    group.element.remove();
                    delete global.group[key];
                }
            }
        }
    });
};