import { FileStorage } from "../function/file/file-storage/storage.js";
import { global } from "../global.js";
import cString from "../../../module/cString.js";
import { Text } from "../../../module/text.js";

export function ViewFilesEventHandler($button) {
    const $files = document.querySelector("#top > .files"),
          $viewer = document.querySelector("#file-viewer"),
          $tabs = $viewer.querySelector(":scope > .tabs");

    $button.addEventListener("click", e => {
        const $selected = $files.querySelectorAll(".file.selected");
        if ($selected.length === 0) {
            return;
        }

        $tabs.innerHTML = "";
        let first = true;
        $selected.forEach($file => {
            const unique = $file.dataset.unique;

            const $tab = document.createElement("div");
            $tab.className = "tab";
            $tab.textContent = unique;

            $tab.dataset.event = "file-viewer:tab";
            $tab.dataset.unique = unique;

            if (first) {
                first = false;

                $tab.classList.add("selected");
                LoadFileSelection($tab)
                    .catch(console.error);
            }

            $tabs.appendChild($tab);
        });

        $viewer.classList.remove("hidden");
    });
};

export function ViewFilesTabEventHandler($tab) {
    const $viewer = document.querySelector("#file-viewer"),
          $tabs = $viewer.querySelector(":scope > .tabs");

    $tab.addEventListener("click", e => {
        $tabs.querySelectorAll(".tab.selected").forEach($el => $el.classList.remove("selected"));
        $tab.classList.add("selected");

        LoadFileSelection($tab)
            .catch(console.error);
    });
};

let open;
async function LoadFileSelection($tab) {
    const $viewer = document.querySelector("#file-viewer"),
          $content = $viewer.querySelector(":scope > .content");

    $content.innerHTML = "";

    const file = global.files[$tab.dataset.unique];
    if (!file) {
        return;
    }

    if (!file.isMetadataLoaded()) {
        await file.load(FileStorage.Type.Metadata);
    }

    open = file;
    const size = cString.fromNumber(file.data.size, {
        decimal: 0,
        abbreviations: [
            "byte", "kilobyte", "megabyte",
            "gigabyte", "terabyte", "petabyte",
            "exabyte", "zettabyte", "yottabyte",
            "ronnabyte", "quettabyte"
        ]
    });

    const $data = $viewer.querySelector(":scope > .data");
    $data.innerHTML = "";

    const $format = document.createElement("span");
    $format.className = "format selectable";
    $format.textContent = file.data.format ?? file.getLoadedMetadata()?.format ?? "Unknown";
    $format.title = "File format";
    $data.appendChild($format);

    const $size = document.createElement("span");
    $size.className = "size selectable";
    $size.textContent = new Text(size).case().get(+size.split(" ")[0] || 0);
    $size.title = "File size";
    $data.appendChild($size);

    const $date = document.createElement("span");
    $date.className = "date selectable";
    $date.textContent = new Date(file.data.date || 0).toLocaleString();
    $date.title = "File date";
    $data.appendChild($date);

    for (const [ key, values ] of file.directives) {
        for (const value of values) {
            const $item = document.createElement("div");
            $item.className = "item selectable";
            $item.textContent = `${key} ${value}`;
            $item.dataset.event = "scroll:horizontal";
            $content.appendChild($item);
        }
    }
};

export function ViewFilesDeleteEventHandler($button) {
    const $viewer = document.querySelector("#file-viewer"),
          $tabs = $viewer.querySelector(":scope > .tabs");

    $button.addEventListener("click", e => {
        const unique = open.data.unique;
        delete global.files[unique];
        open.data.element.remove();

        for (const [ key, group ] of Object.entries(global.group ?? { })) {
            group.member = group.members.filter(member => unique !== member.selectors[0].value);
            if (group.member.length === 0) {
                group.element.remove();
                delete global.group[key];
            }
        }

        const $tab = $tabs.querySelector(":scope > .tab.selected"),
              $new = $tab.nextElementSibling ?? $tab.previousElementSibling;

        if ($new) {
            $new.classList.add("selected");
            LoadFileSelection($new)
                .catch(console.error);
        } else {
            $viewer.classList.add("hidden");
        }

        $tab.remove();
    });
};