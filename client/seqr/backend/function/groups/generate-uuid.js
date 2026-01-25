import { cArray } from "../../../../module/cArray.js";

export function GenerateGroupUUID(group) {
    const sorted = group.members
        .slice()
        .sort((a, b) => cArray.localeCompare(a.selectors, b.selectors));
    return JSON.stringify(sorted);
};