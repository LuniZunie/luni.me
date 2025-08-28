import { global } from "../global.js";

export function DeleteFilesEventHandler($button) {
    const $files = document.querySelector("#top > .files"),
          $groups = document.querySelector("#groups > .content");

    $button.addEventListener("click", e => {
        const $selected = $files.querySelectorAll(".file.selected");
        if ($selected.length === 0) {
            global.files = { };
            $files.innerHTML = "";

            global.groups.clear();
            $groups.innerHTML = "";
        } else {
            const names = [ ];
            for (const $el of $selected) {
                const unique = $el.dataset.unique;
                names.push(unique);

                delete global.files[unique];
                $el.remove();
            }

            global.groups.forward((group, key) => {
                group.member = group.members.filter(member => !names.some(name => name === member.selectors[0].value));
                if (group.member.length === 0) {
                    group.element.remove();
                    global.groups.delete(key);
                }
            });
        }
    });
};