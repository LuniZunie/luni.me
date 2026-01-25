import "../../prototype/HTML.js";
import AutoGroupLogic from "./auto-group-logic.js";
import ColorSystem from "./color-system.js";
import { ColorToHex, HexToColor, InverseShade } from "./color.js";
import { global } from "./global.js";

export function ChangeGroupName(prev, next) {
    if (typeof prev !== "string" || typeof next !== "string") throw new TypeError("Group names must be strings");
    if (prev === next) return;

    let n = 2, matched = false;
    if (next in global.groups) {
        // remove the "\s(n)" suffix if it exists but also get n
        const match = next.match(/\s\((\d+)\)$/);
        if (match) {
            matched = true;
            n = parseInt(match[1], 10);
            next = next.slice(0, -match[0].length); // remove the suffix
        }
    }

    const group = { ...global.groups[prev] };
    delete global.groups[prev]; // remove old group

    let name = next;
    for (let i = n; name in global.groups || matched; i++)
        name = `${next} (${i})`, matched = false;

    global.groups[name] = {
        ...group,
        name
    };

    global.groupElements.set(group.element, name);

    group.element.qs(".name").textContent = name;
}

export function CreateGroup(rawName = "Unnamed Group", members = []) {
    if (typeof rawName !== "string") throw new TypeError("Group name must be a string");
    if (!Array.isArray(members)) throw new TypeError("Group members must be an array");

    global.groups ??= {};

    let name = rawName;
    for (let i = 2; name in global.groups; i++)
        name = `${rawName} (${i})`;

    const $group = document.qs("#side-bar > .content").create("div", {
        class: "group",
        dataset: {
            events: "group,multiselect",
            multiselect: "group"
        },
        title: `Group: ${name}`
    }, { end: true });

    // Set initial expanded state based on screen size
    const isNarrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;
    if (!isNarrow) {
        $group.classList.add("expanded");
    }
    $group.create("div", {
        class: "name selectable",
        content: name,
        contenteditable: "plaintext-only",
        spellcheck: false,
        dataset: {
            events: "force-horizontal-scroll,group>name",
            stopSelectPropagation: true
        },
        title: "Edit group name"
    }, { end: true });

    $group.create("div", { class: "members" }, { end: true });

    const $buttons = $group.create("div", { class: "buttons" }, { end: true });

    // Edit button (left side)
    $buttons.create("div", {
        class: "button edit",
        html: "<svg class='iconify'><path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'/></svg>",
        title: "Edit group",
        dataset: {
            events: "group>edit"
        }
    }, { end: true });

    // Movement buttons container (center)
    const $movementContainer = $buttons.create("div", { class: "movement-buttons" }, { end: true });
    $movementContainer.create("div", {
        class: "button move-top",
        html: "<svg class='iconify'><path d='M7 14l5-5 5 5'/><path d='M7 20l5-5 5 5'/></svg>",
        title: "Move to top",
        dataset: {
            events: "group>move-top"
        }
    }, { end: true });
    $movementContainer.create("div", {
        class: "button move-up",
        html: "<svg class='iconify'><path d='M7 14l5-5 5 5'/></svg>",
        title: "Move up",
        dataset: {
            events: "group>move-up"
        }
    }, { end: true });
    $movementContainer.create("div", {
        class: "button move-down",
        html: "<svg class='iconify'><path d='M7 10l5 5 5-5'/></svg>",
        title: "Move down",
        dataset: {
            events: "group>move-down"
        }
    }, { end: true });
    $movementContainer.create("div", {
        class: "button move-bottom",
        html: "<svg class='iconify'><path d='M7 4l5 5 5-5'/><path d='M7 10l5 5 5-5'/></svg>",
        title: "Move to bottom",
        dataset: {
            events: "group>move-bottom"
        }
    }, { end: true });

    // Delete button (right side)
    $buttons.create("div", {
        class: "button delete",
        html: "<svg class='iconify'><path d='M4 12h16'/></svg>",
        title: "Delete group",
        dataset: {
            events: "group>delete"
        }
    }, { end: true });

    global.groups[name] = {
        name,
        element: $group,
        members: []
    };

    global.groupElements ??= new Map();
    global.groupElements.set($group, name);

    for (const member of members) {
        if (Array.isArray(member)) AddMemberToGroup(name, member);
        else AddMemberToGroup(name, member.data, member.color, member.settings);
    }
    if (members.length === 0)
        global.groups[name].UUID = GenerateUUID(global.groups[name]);

    $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
}

export function AddMemberToGroup(name, member, color, settings = {}) {
    if (typeof name !== "string") throw new TypeError("Group name must be a string");
    if (!Array.isArray(member)) throw new TypeError("Member must be an array");

    const group = global.groups[name];
    if (!group) throw new Error(`Group "${name}" not found`);

    // Generate color if not provided, using the same logic as AutoGroup
    if (!color) {
        // Get all current members in this group to generate consistent colors
        const currentMembers = group.members.map(m => [ m[0], m[1], m[2] ]); // [name, type, strand]
        const allMembers = [...currentMembers, [ member[0], member[1], member[2] ]];

        // Generate group colors using the same system as AutoGroup
        const groupColorMap = ColorSystem.generateGroupColors(allMembers);
        const comboKey = `${member[1]}${member[2]}`; // type + strand

        // Get color maps for file influence if needed
        const colorMaps = ColorSystem.buildColorMaps(global.files);

        // Generate color using the same method as AutoGroup
        color = ColorSystem.getMemberColorForGroup(
            member[0], // name
            member[1], // type
            member[2], // strand
            groupColorMap,
            colorMaps.fileMap,
            false // assume no file grouping for manual additions
        );
    }

    const $members = group.element.qs(".members");
    const $member = $members.create("div", {
        class: "member",
        dataset: {
            events: "group>member"
        }
    }, { end: true });

    const $selectors = $member.create("div", {
        class: "selectors inset",
        dataset: {
            events: "force-horizontal-scroll"
        }
    }, { end: true });
    for (const selector of member) {
        if (selector === null || selector === undefined) continue; // skip null/undefined selectors
        if (typeof selector !== "string") throw new TypeError("Selector must be a string");
        $selectors.create("span", {
            class: "selector outset",
            content: selector,
            dataset: { selector },
            title: `Selector: ${selector}`
        }, { end: true });
    }

    // Create button container for all buttons
    const $buttonContainer = $member.create("div", {
        class: "button-container"
    }, { end: true });

    // Color button (moved to the left)
    const isFileDefinedMode = settings.asDefinedInFile === true;

    const $color = $buttonContainer.create("div", {
        class: `button color ${isFileDefinedMode ? "file-defined" : ""}`,
        dataset: {
            events: "group>member>color",
            color,
            asDefinedInFile: isFileDefinedMode
        },
        title: "Change color"
    }, { end: true });

    $color.style.setProperty("--color", color);
    $color.style.setProperty("--outline", ColorToHex(InverseShade(HexToColor(color))));

    $color.create("div", {
        class: "file-defined-icon",
        html: "<svg class='iconify'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6zM8 13h8zM8 17h8zM8 9h2z'/></svg>"
    }, { end: true });
    $color.create("div", {
        class: "alpha-background"
    }, { end: true });

    // Copy/Paste button stack
    const $copyPasteStack = $buttonContainer.create("div", {
        class: "copy-paste-stack"
    }, { end: true });

    $copyPasteStack.create("div", {
        class: "button copy",
        html: "<svg class='iconify'><rect x='8' y='7' width='13' height='16' rx='2' ry='2'/><path d='M5 18H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>",
        dataset: {
            events: "group>member>copy"
        },
        title: "Copy color to clipboard"
    }, { end: true });

    $copyPasteStack.create("div", {
        class: "button paste disabled",
        html: "<svg class='iconify'><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/><rect x='8' y='2' width='8' height='4' rx='1' ry='1'/></svg>",
        dataset: {
            events: "group>member>paste",
            paste: "hexadecimal"
        },
        title: "Paste color from clipboard"
    }, { end: true });

    // Remove button
    $buttonContainer.create("div", {
        class: "button remove",
        html: "<svg class='iconify'><path d='M18 6 6 18M6 6 18 18'/></svg>",
        dataset: {
            events: "group>member>remove"
        },
        title: "Remove member from group"
    }, { end: true });

    group.members.push({ member, color, settings });
    group.UUID = GenerateUUID(group);
}

export async function AutoGroup(options, selectedFileIds = null) {
    // Always clear all groups before creating new ones
    global.groupElements = new Map();
    global.groups = {};
    document.qs("#side-bar > .content").innerHTML = ""; // clear groups

    const groups = await AutoGroupLogic(options, selectedFileIds);
    for (const group of groups)
        CreateGroup(group.name, group.members, group.members);
}

export function AllEmptyGroups() {
    if (!global.groups) return true;
    for (const group of Object.values(global.groups))
        if (group.members.length > 0) return false; // at least one group has
    return true;
}

export function CanCleanGroups() {
    if (Object.keys(global.groups ?? {}).length === 0) return false;

    const $selected = new Set(document.qsa("#side-bar > .content > .group.selected"));
    const checkSelected = $selected.size > 0;

    const UUIDs = new Set();
    for (const group of Object.values(global.groups)) {
        if (checkSelected && !$selected.has(group.element)) continue; // only check selected groups

        if (group.members.length === 0) return true;

        const UUID = group.UUID ??= GenerateUUID(group);
        if (UUIDs.has(UUID)) return true;
        UUIDs.add(UUID);
    }

    return false;
}

export function CleanGroups() {
    if (!CanCleanGroups()) return;

    const $selected = new Set(document.qsa("#side-bar > .content > .group.selected"));
    const checkSelected = $selected.size > 0;

    const UUIDs = new Set();
    for (const group of Object.values(global.groups)) {
        if (checkSelected && !$selected.has(group.element)) continue; // only check selected groups

        if (group.members.length === 0) {
            group.element.remove();
            delete global.groups[group.name];
            continue;
        }

        const UUID = group.UUID ?? GenerateUUID(group);
        if (UUIDs.has(UUID)) {
            group.element.remove();
            delete global.groups[group.name];
        } else UUIDs.add(UUID);
    }
}

export function MoveGroupToTop(groupName) {
    const group = global.groups[groupName];
    if (!group || !group.element) return false;

    const $container = group.element.parentElement;
    if ($container.firstElementChild !== group.element) {
        $container.insertBefore(group.element, $container.firstElementChild);
        group.element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return true;
    }
    return false;
}

export function MoveGroupUp(groupName) {
    const group = global.groups[groupName];
    if (!group || !group.element) return false;

    const $prev = group.element.previousElementSibling;
    if ($prev) {
        group.element.parentElement.insertBefore(group.element, $prev);
        group.element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return true;
    }
    return false;
}

export function MoveGroupDown(groupName) {
    const group = global.groups[groupName];
    if (!group || !group.element) return false;

    const $next = group.element.nextElementSibling;
    if ($next) {
        group.element.parentElement.insertBefore($next, group.element);
        group.element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return true;
    }
    return false;
}

export function MoveGroupToBottom(groupName) {
    const group = global.groups[groupName];
    if (!group || !group.element) return false;

    const $container = group.element.parentElement;
    if ($container.lastElementChild !== group.element) {
        $container.appendChild(group.element);
        group.element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return true;
    }
    return false;
}

export function GenerateUUID(group) {
    const sorted = [ ...group.members ].sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++)
            if (a[i] !== b[i]) return a[i].localeCompare(b[i]);
        return a.length - b.length;
    });
    return JSON.stringify(sorted);
}