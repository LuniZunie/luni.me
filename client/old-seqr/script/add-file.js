import "../../prototype/HTML.js";
import { global } from "./global.js";
import ChunkedFileDataProxy from "./chunked-file-data-proxy.js";

import cString from "../../module/cString.js";
import { Text } from "../../module/text.js";

export default function AddFile(file) {
    if (!(file instanceof File)) return null;

    const fileName = file.name;
    const [ name, extension ] = cString.splitOn(fileName, ".", (n, len) => n === len - 1);

    let unique = fileName;
    global.files ??= {};
    for (let i = 2; global.files[unique];)
        unique = `${fileName} (${i++})`;

    global.files[unique] = new ChunkedFileDataProxy(unique, {
        unique,
        name, extension,
        size: file.size,
        date: file.lastModified,
        metadata: []
    });

    // Create detailed title with file info
    const size = cString.fromNumber(file.size, {
        decimal: 0,
        abbreviations: [ "byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte", "exabyte", "zettabyte", "yottabyte", "ronnabyte", "quettabyte" ],
    });
    const title = `${unique}\n${String(new Text(size).plural().case().get(+size.split(" ")[0] || 0))}\n${String(new Date(file.lastModified || 0).toLocaleString())}`;

    const $file = document.qs("#top-bar > .file-list").create("span", {
        class: "file disabled outset",
        content: unique,
        dataset: {
            events: "file,multiselect",
            multiselect: "file"
        },
        title: title
    }, { end: true });

    global.fileElements ??= new Map();
    global.fileElements.set($file, unique);

    return { element: $file, unique };
}