function GenerateUUID() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const CACHE_SIZE = 256;
const cache = [];

function Fill() {
    if (cache.length < CACHE_SIZE) cache.push(GenerateUUID());
    requestIdleCallback(Fill);
}
if (typeof requestIdleCallback === "function") requestIdleCallback(Fill);

export default function UUID() {
    if (cache.length === 0) return GenerateUUID();
    return cache.pop();
}