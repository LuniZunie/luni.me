import Color from "../../../../module/color.js";
import { global } from "../../global.js";
import { IsViewNarrow } from "../is-view-narrow.js";
import { UniqueName } from "../unique-name.js";
import { GroupColorSystem } from "./auto-group/color.js";
import { GenerateGroupUUID } from "./generate-uuid.js";

export function NewGroup(name, members = [ ]) {
    global.groups ??= { };

    name = UniqueName(name, v => v in global.groups);

    const $group = document.createElement("div");
    $group.className = "group";

    $group.title = `Group: ${name}`;

    $group.dataset.unique = name;
    $group.dataset.event = "multiselect,group";
    $group.dataset.multiselect = "group";
    document.querySelector("#groups > .content").appendChild($group);

    {
        const $name = document.createElement("div");
        $name.className = "name selectable";
        $name.textContent = name;
        $name.title = "Edit group name";

        $name.setAttribute("contenteditable", "plaintext-only");
        $name.setAttribute("spellcheck", false);

        $name.dataset.event = "scroll:horizontal,group:name";
        $name.dataset.stopSelectPropagation = true;
        $group.appendChild($name);
    }

    const $members = document.createElement("div");
    $members.className = "members";
    $group.appendChild($members);

    {
        const $buttons = document.createElement("div");
        $buttons.className = "buttons";
        $group.appendChild($buttons);

        {
            const $edit = document.createElement("div");
            $edit.className = "button edit";
            $edit.innerHTML = "<svg><use href='#symbol_wrench'/></svg>";
            $edit.title = "Edit group members";

            $edit.dataset.event = "group:edit";
            $buttons.appendChild($edit);
        }

        {
            const $movement = document.createElement("div");
            $movement.className = "movement-buttons";
            $buttons.appendChild($movement);

            {
                const $top = document.createElement("div");
                $top.className = "button top";
                $top.innerHTML = "<svg><use href='#symbol_double-arrow-up'/></svg>";
                $top.title = "Move to top";

                $top.dataset.event = "group:move:top";
                $movement.appendChild($top);
            }

            {
                const $up = document.createElement("div");
                $up.className = "button up";
                $up.innerHTML = "<svg><use href='#symbol_arrow-up'/></svg>";
                $up.title = "Move up";

                $up.dataset.event = "group:move:up";
                $movement.appendChild($up);
            }

            {
                const $down = document.createElement("div");
                $down.className = "button down";
                $down.innerHTML = "<svg><use href='#symbol_arrow-down'/></svg>";
                $down.title = "Move down";

                $down.dataset.event = "group:move:down";
                $movement.appendChild($down);
            }

            {
                const $bottom = document.createElement("div");
                $bottom.className = "button bottom";
                $bottom.innerHTML = "<svg><use href='#symbol_double-arrow-down'/></svg>";
                $bottom.title = "Move to bottom";

                $bottom.dataset.event = "group:move:bottom";
                $movement.appendChild($bottom);
            }
        }

        {
            const $delete = document.createElement("div");
            $delete.className = "button edit";
            $delete.innerHTML = "<svg><use href='#symbol_trashcan'/></svg>";
            $delete.title = "Delete group";

            $delete.dataset.event = "group:delete";
            $buttons.appendChild($delete);
        }
    }

    const len = Object.keys(global.groups).length,
          group = global.groups[name] = { index: len, name, element: $group, members: [ ] };
    for (const member of members) {
        AddMemberToGroup(group, member.selectors, member.settings, false);
    }
    group.UUID = GenerateGroupUUID(group);

    $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
};

export function AddMemberToGroup(group, selectors, settings, doGenUUID) {
    if (!settings.color) { /* TODO: generate color */
        settings.color = GroupColorSystem.generateColor(selectors.join(" "));
    }

    const $members = group.element.querySelector(":scope > .members");

    const $member = document.createElement("div");
    $member.className = "member";
    $members.appendChild($member);

    {
        const $selectors = document.createElement("div");
        $selectors.className = "selectors inset";

        $selectors.dataset.event = "scroll:horizontal";
        $member.appendChild($selectors);

        for (const selector of selectors) {
            // const { key, value } = selector; TODO implement
            const key = "???"; // TEMP
            const value = selector;

            const $selector = document.createElement("span");
            $selector.className = "selector outset";
            $selector.textContent = value;
            $selector.title = `${key}: ${value}`;

            $selector.dataset.key = key;
            $selector.dataset.value = value;

            $selectors.appendChild($selector);
        }
    }

    {
        const $buttons = document.createElement("div");
        $buttons.className = "buttons";
        $member.appendChild($buttons);

        {
            const $color = document.createElement("div");

            $color.dataset.event = "group:member:color";
            $color.dataset.color = settings.color;

            $color.style.setProperty("--color", settings.color);
            $color.style.setProperty("--outline", Color.Shade(new Color(settings.color), "#000", "#FFF"));

            if (settings.fileDefined) {
                $color.className = "button color file-defined";

                $color.dataset.title = `As defined in file (with ${settings.color} as fallback)`;
                $color.dataset.fileDefined = true;
            } else {
                $color.className = "button color";

                $color.dataset.title = settings.color;
                $color.dataset.fileDefined = false;
            }

            $buttons.appendChild($color);

            {
                const $fileDefined = document.createElement("div");
                $fileDefined.className = "file-defined";
                $fileDefined.innerHTML = "<svg><use href='#symbol_text-file'/></svg>";
                $color.appendChild($fileDefined);
            }

            {
                const $alpha = document.createElement("div");
                $alpha.className = "alpha";
                $color.appendChild($alpha);
            }
        }

        {
            const $stack = document.create("div");
            $stack.className = "copy-paste-stack";
            $buttons.appendChild($stack);

            {
                const $copy = document.createElement("div");
                $copy.className = "button copy";
                $copy.innerHTML = "<svg><use href='#symbol_copy'/></svg>";
                $copy.title = "Copy color to clipboard";

                $copy.dataset.event = "group:member:copy";
                $stack.appendChild($copy);
            }

            {
                const $paste = document.createElement("div");
                $paste.className = "button paste";
                $paste.innerHTML = "<svg><use href='#symbol_paste'/></svg>";
                $paste.title = "Paste color from clipboard";

                $paste.dataset.paste = "hexadecimal";
                $paste.dataset.event = "group:member:paste";
                $stack.appendChild($paste);
            }
        }

        {
            const $delete = document.createElement("div");
            $delete.className = "button delete";
            $delete.innerHTML = "<svg><use href='#symbol_trashcan'/></svg>";
            $delete.title = "Remove member from group";

            $delete.dataset.event = "group:member:delete";
            $buttons.appendChild($delete);
        }
    }

    group.members.push({ selectors, settings });
    if (doGenUUID) {
        group.UUID = GenerateGroupUUID(group);
    }
}

export function ChangeGroupName(prev, next) {
    if (prev === next) {
        return;
    }

    const group = { ...global.groups[prev] };
    delete global.groups[prev];

    const name = UniqueName(next, v => v in global.groups);
    global.groups[name] = { ...group, name };

    const $el = group.element;
    $el.dataset.unique = name;
    $el.querySelector(":scope > .name").textContent = name;
}