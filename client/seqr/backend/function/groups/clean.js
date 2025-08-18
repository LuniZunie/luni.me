import { global } from "../../global.js";
import { GenerateGroupUUID } from "./generate-uuid.js";

export function CanCleanGroups() {
    if (!global.groups || Object.keys(global.groups).length === 0) {
        return false;
    }

    const $selected = document.querySelectorAll("#groups > .content > .group.selected");
    if ($selected.length === 0) {
        return false;
    }

    const UUIDs = new Set();
    for (const $group of $selected) {
        const group = global.groups[$group.dataset.unique];
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
};