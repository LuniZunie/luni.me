export function GenerateGroupUUID(group) {
    const sorted = group.members
        .slice(0)
        .sort((a, b) => {
            const aLen = a.length,
                  bLen = b.length,
                  len = Math.min(aLen, bLen);
            for (let i = 0; i < len; i++) {
                if (a[i] !== b[i]) {
                    return a[i].toLocaleCompare(b[i]);
                }
            }

            return aLen - bLen;
        });
    return JSON.stringify(sorted);
};