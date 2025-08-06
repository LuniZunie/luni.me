import { Text } from "../../../module/text.js";
import { CreateNotification } from "../../../module/notification.js";
import { ReadFile, VALID_EXTENSIONS } from "../function/file/read.js";

export function ImportEventHandler($import) {
    $import.addEventListener("click", () => {
        switch (document.querySelector(".selected[data-radio='import:type']")?.dataset.value) {
            case "file": {
                document.querySelector("#file-input").click();
            } break;
            case "code": {
                const $editor = document.querySelector("#file-editor"),
                      $text = $editor.querySelector(".textarea"),
                      $name = $editor.querySelector(".name");

                $text.textContent = "";
                $text.focus();

                $name.value = "";
                $name.classList.add("invalid");

                $editor.classList.remove("hidden");
            } break;
        }
    });
};

export function ImportFileEventHandler($input) {
    $input.addEventListener("change", async e => {
        const files = e.target.files;
        if (files.length === 0) {
            return;
        }

        let fail = 0;
        for (const file of files) {
            const name = file.name;
            ReadFile(file)
                .catch(error => {
                    fail++;

                    CreateNotification(`Failed to import file: ${name}`, "var(--notification-red)");
                    console.error(`Failed to import file: ${name}`, error);
                });
        }

        const success = files.length - fail;

        let background;
        if (fail === 0) {
            background = "var(--notification-green)";
        } else if (success === 0) {
            background = "var(--notification-red)";
        } else {
            background = "var(--notification-green)";
        }

        const successText = new Text("file").case().get(success),
              failText = new Text("file").case().get(fail);

        /* TODO redo notification */
        CreateNotification(`Imported ${success} ${successText} successfully, ${fail} ${failText} failed`, background, 5000);

        $input.value = "";
    });
};

const VALID_NAMES = /^[\w.\-]+?/;

const VALID = new RegExp(VALID_NAMES.source + VALID_EXTENSIONS.source, "i");
export function FileEditorNameEventHandler($input) {
    const $button = $input.closest("#file-editor").querySelector(".button.save");

    $input.addEventListener("input", e => {
        $input.classList.toggle("invalid", !VALID.test($input.value));
    });
    $input.addEventListener("keydown", e => {
        switch (e.key) {
            case "Enter": {
                e.preventDefault();
                $button.click();
            } break;
        }
    });
};

export function FileEditorSaveEventHandler($button) {
    const $editor = document.querySelector("#file-editor"),
          $text = $editor.querySelector(".textarea"),
          $name = $editor.querySelector(".name");

    $button.addEventListener("click", e => {
        const name = $name.value;
        if (VALID.test(name)) {
            $editor.classList.add("hidden");

            const file = new File(
                [ new Blob([ $text.textContent ], { type: "text/plain" }) ],
                name,
                { type: "text/plain", lastModified: Date.now() }
            );

            $text.textContent = "";

            $name.value = "";
            $name.classList.add("invalid");

            ReadFile(file)
                .catch(error => {
                    CreateNotification(`Failed to import file: ${name}`, "var(--notification-red)");
                    console.error(`Failed to import file: ${name}`, error);
                });
        } else {
            $name.classList.add("invalid");
        }
    });
};