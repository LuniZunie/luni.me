import { global } from "../../global.js"

export function AllGroupsEmpty() {
    if (global.groups.empty) {
        return true;
    } else {
        let res = true;
        global.groups.forward(group => {
            if (group.members.length > 0) {
                res = false;
            }
        });

        return res;
    }
}