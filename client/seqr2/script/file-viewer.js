import "../../prototype/HTML.js";
import { Text } from "../../module/text.js";
import cString from "../../module/cString.js";
import { global } from "./global.js";

export default async function LoadFileSelection($) {
    const $fileViewer = document.qs("#file-viewer");
    if (!$fileViewer) return;

    const $content = $fileViewer.qs(".content");
    $content.innerHTML = ""; // clear previous content

    const file = global.files[$.dataset.unique];
    if (!file) return;

    // Load file data if not already loaded
    if (!file.isDataLoaded()) await file.loadFileData();

    global.fileOpen = file.element;

    // Get format from metadata for chunked files
    const fileFormat = file.format || (file.getLoadedMetadata && file.getLoadedMetadata()?.format) || "Unknown";

    const size = cString.fromNumber(file.size || 0, {
        decimal: 0,
        abbreviations: [ "byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte", "exabyte", "zettabyte", "yottabyte", "ronnabyte", "quettabyte" ],
    });

    const $data = $fileViewer.qs(".data");
    $data.innerHTML = ""; // clear previous data

    $data.create("span", {
        content: String(fileFormat),
        class: "file-format selectable",
        title: "File format"
    }, { end: true });
    $data.create("span", {
        content: String(new Text(size).plural().case().get(+size.split(" ")[0] || 0)),
        class: "file-size selectable",
        title: "File size"
    }, { end: true });
    $data.create("span", {
        content: String(new Date(file.date || 0).toLocaleString()),
        class: "file-date selectable",
        title: "File date"
    }, { end: true });

    for (const [ k, vs ] of file.metadata)
        for (const v of vs)
            $content.create("div", {
                class: "item selectable",
                content: String(`${k} ${v}`),
                dataset: {
                    events: "force-horizontal-scroll"
                }
            }, { end: true });
}