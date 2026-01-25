export function EncodeMemberSelectors(selectors) {
    return selectors
        .map(selector => encodeURIComponent(selector))
        .join(",");
}

export function DecodeMemberSelectors(selectors) {
    return selectors
        .split(",")
        .map(selector => decodeURIComponent(selector));
}