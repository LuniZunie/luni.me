import { global } from "../../global.js";
import { GenerateGroupUUID } from "./generate-uuid.js";
import { DeleteGroup } from "./main.js";

export function CanCleanGroups() {
    if (global.groups.empty) {
        return false;
    }

    let $selected = document.querySelectorAll("#groups > .content > .group.selected");
    if ($selected.length === 0) {
        $selected = document.querySelectorAll("#groups > .content > .group");
    }

    const UUIDs = new Set();
    for (const $group of $selected) {
        const group = global.groups.get($group.dataset.unique);
        if (group.members.length === 0) {
            return true;
        }

        const UUID = group.UUID ??= GenerateGroupUUID(group);
        if (UUIDs.has(UUID)) {
            return true;
        }
        UUIDs.add(UUID);
    }

    return false;
}

export function CleanGroups($groups) {
    if ($groups.length === 0) {
        $groups = document.querySelectorAll("#groups > .content > .group");
    }

    const UUIDs = new Set();
    for (const $group of $groups) {
        const group = global.groups.get($group.dataset.unique);
        if (group.members.length === 0) {
            DeleteGroup(group.name);
            continue;
        }

        const UUID = group.UUID ??= GenerateGroupUUID(group);
        if (UUIDs.has(UUID)) {
            DeleteGroup(group.name);
            continue;
        }
        UUIDs.add(UUID);
    }

    return false;
}