const nameMatch = /\s\((\d+)\)$/;
export function UniqueName(name, check) {
    let n = 2, matched = false;
    if (check(name)) {
        const match = name.match(nameMatch);
        if (match) {
            matched = true;
            n = parseInt(match[1], 10);
            name = name.slice(0, -match[0].length);
        }
    }

    let newName = name;
    for (let i = n; check(name) || matched; i++) {
        name = `${newName} (${i})`;
        matched = false;
    }

    return name;
};