export function IsViewNarrow() {
    return window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;
};