import { global } from "./global.js";
import ColorSystem from "./color-system.js";

export default async function AutoGroupLogic(options, selectedFileIds = null) {
    // Load all file data first, but only for selected files if specified
    const fileLoadPromises = [];
    const filesToProcess = selectedFileIds
        ? Object.fromEntries(selectedFileIds.map(id => [ id, global.files[id] ]).filter(([ _, file ]) => file))
        : global.files ?? {};

    for (const file of Object.values(filesToProcess))
        if (!file.isDataLoaded())
            fileLoadPromises.push(file.loadFileData());

    if (fileLoadPromises.length > 0)
        await Promise.all(fileLoadPromises);

    const groups = [];    // Define grouping configuration based on options
    const groupingConfig = {
        useFile: options.has("file"),
        useType: options.has("type"),
        useStrand: options.has("strand"),
        get keys() {
            const ks = [];
            if (this.useFile) ks.push("file");
            if (this.useType) ks.push("type");
            if (this.useStrand) ks.push("strand");
            return ks;
        },
        get isAllData() {
            return this.keys.length === 0;
        }
    };

    // Build color maps for consistent color assignment
    const colorMaps = ColorSystem.buildColorMaps(filesToProcess);

    // Helper function to get value for a grouping key
    const GetValue = (k, name, type, v) => {
        switch (k) {
            case "file": return name;
            case "type": return type;
            case "strand": return v;
            default: return "";
        }
    };

    // Helper function to create group key and name
    const CreateGroupKey = vs => vs.join("|");
    const CreateGroupName = vs => {
        if (groupingConfig.isAllData) return "AutoGroup w/ no options";
        return vs.filter(v => v).join(" ");
    };

    // Helper function to ensure nested object structure exists
    const EnsureNestedStructure = (o, path) => {
        let temp = o;
        for (const k of path)
            temp = temp[k] ??= {};
        return temp;
    };

    // Helper function to extract groups from nested structure
    const ExtractGroups = (o, depth = 0) => {
        if (depth === groupingConfig.keys.length)
            return [ o ];

        const result = [];
        for (const v of Object.values(o))
            result.push(...ExtractGroups(v, depth + 1));
        return result;
    };

    // Handle the "All Data" case (no grouping options)
    if (groupingConfig.isAllData) {
        const group = { name: CreateGroupName([]), members: [] };
        const membersData = [];

        // Collect all member data first
        const definedInFiles = {};
        for (const [ name, file ] of Object.entries(filesToProcess)) {
            let definedRoot = definedInFiles[name] ??= {};
            for (const [ type, vs ] of Object.entries(file.types)) {
                const root = file.colors[type];
                if (root) {
                    definedRoot = definedRoot[type] ??= {};
                    for (const v of vs) {
                        membersData.push([name, type, v]);
                        definedRoot[v] = root[v];
                    }
                } else {
                    for (const v of vs) {
                        membersData.push([name, type, v]);
                    }
                }
            }
        }

        // Generate unique colors for this group
        const groupColorMap = ColorSystem.generateGroupColors(membersData);

        // Assign colors to members
        for (const [ name, type, strand ] of membersData) {
            const memberColor = ColorSystem.getMemberColorForGroup(name, type, strand, groupColorMap, colorMaps.fileMap, groupingConfig.useFile);
            group.members.push({
                data: [ name, type, strand ],
                color: memberColor,
                settings: {
                    asDefinedInFile: definedInFiles[name]?.[type]?.[strand] || false // Indicate if this member is defined in the file
                }
            });
        }

        groups.push(group);
    } else {
        // Handle all other cases dynamically
        const temp = {};
        const groupMembersData = new Map(); // Track members data for each group

        const definedInFiles = {};
        for (const [ name, file ] of Object.entries(filesToProcess)) {
            let definedRoot = definedInFiles[name] ??= {};
            for (const [ type, vs ] of Object.entries(file.types)) {
                const root = file.colors[type];
                if (root) {
                    definedRoot = definedRoot[type] ??= {};
                }

                for (const v of vs) {
                    if (root) {
                        definedRoot[v] = root[v];
                    }

                    // Get values for each grouping key
                    const values = groupingConfig.keys.map(key => GetValue(key, name, type, v));

                    // Create the nested structure path
                    const path = [ ...values ];

                    // Ensure the nested structure exists
                    const parent = EnsureNestedStructure(temp, path.slice(0, -1));
                    const finalKey = path[path.length - 1];

                    // Create the group if it doesn't exist
                    if (!parent[finalKey]) {
                        parent[finalKey] = {
                            name: CreateGroupName(values),
                            members: []
                        };
                        groupMembersData.set(parent[finalKey], []);
                    }

                    // Track member data for color generation
                    groupMembersData.get(parent[finalKey]).push([ name, type, v ]);
                }
            }
        }

        // Extract all groups and assign colors
        const extractedGroups = ExtractGroups(temp);
        for (const group of extractedGroups) {
            const membersData = groupMembersData.get(group) || [];
            const groupColorMap = ColorSystem.generateGroupColors(membersData);

            // Assign colors to each member in this group
            for (const [ name, type, strand ] of membersData) {
                const memberColor = ColorSystem.getMemberColorForGroup(name, type, strand, groupColorMap, colorMaps.fileMap, groupingConfig.useFile);
                group.members.push({
                    data: [ name, type, strand ],
                    color: memberColor,
                    settings: {
                        asDefinedInFile: definedInFiles[name]?.[type]?.[strand] || false // Indicate if this member is defined in the file
                    }
                });
            }
        }

        groups.push(...extractedGroups);
    }

    return groups;
}