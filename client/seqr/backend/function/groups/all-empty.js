import { global } from "../../global.js"

export function AllGroupsEmpty() {
    if (global.groups) {
        for (const group of Object.values(global.groups)) {
            if (group.members.length > 0) {
                return false;
            }
            return true;
        }
    } else {
        return true;
    }
}