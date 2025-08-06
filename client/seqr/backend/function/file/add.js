import { global } from "../../global.js";
import cString from "../../../../module/cString.js";
import { Text } from "../../../../module/text.js";
import { UniqueName } from "../unique-name.js";
import { ChunkedProxy } from "./file-storage/proxy.js";

export function AddFile(file) {
    if (!(file instanceof File)) {
        return null;
    }

    const rawName = file.name,
          [ name, extension ] = cString.splitOn(rawName, ".", (n, len) => n === len - 1);

    global.files ??= {};
    const unique = UniqueName(rawName, v => v in global.files);
    global.files[unique] = new ChunkedProxy(unique, {
        unique,
        name, extension,
        size: file.size,
        date: file.lastModified,
        metadata: []
    });

    const $file = document.createElement("span");
    $file.className = "file disabled outset";
    $file.textContent = unique;

    $file.dataset.unique = unique;
    $file.dataset.event = "multiselect,file";
    $file.dataset.multiselect = "file";

    const size = cString.fromNumber(file.size, {
        decimal: 0,
        abbreviations: [
            "byte", "kilobyte", "megabyte",
            "gigabyte", "terabyte", "petabyte",
            "exabyte", "zettabyte", "yottabyte",
            "ronnabyte", "quettabyte"
        ]
    });

    const sizeText = new Text(size).case().get(+size.split(" ")[0] || 0),
          dateText = new Date(file.lastModified || 0).toLocaleString();
    $file.title = `${unique}\n${sizeText}\n${dateText}`;

    document.querySelector("#top > .files").appendChild($file);

    return { element: $file, unique };
}