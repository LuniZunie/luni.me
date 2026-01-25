import { AllEmptyGroups } from "../../../old-seqr/script/groups.js";
import { CanCleanGroups } from "../function/groups/clean.js";
import { global } from "../global.js";

export function DisableButtons() {
    const files = global.files ?? {},
          hasFiles = Object.values(files).length > 0;
    const hasGroups = !global.groups.empty;

    const $top = document.querySelector("#top"),
          $groups = document.querySelector("#groups"),
          $selected = $top.querySelector(":scope > .files > .file.selected");

    $top.querySelector(":scope > .button-plus.delete").classList.toggle("disabled", !hasFiles);
    $top.querySelector(":scope > .button-plus.view").classList.toggle("disabled", $selected === null);
    $top.querySelector(":scope > .button-plus.render").classList.toggle("disabled", AllEmptyGroups());
    $top.querySelector(":scope > .button-plus.export").classList.toggle("disabled", !global.hasDrawn);

    $groups.classList.toggle("no-files", !hasFiles);

    const $bottom = $groups.querySelector(":scope > .bottom");
    $bottom.querySelector(":scope > .button-plus.new").classList.toggle("disabled", !hasFiles);
    $bottom.querySelector(":scope > .button-plus.auto").classList.toggle("disabled", !hasFiles);
    $bottom.querySelector(":scope > .button-plus.clean").classList.toggle("disabled", !CanCleanGroups());
    $bottom.querySelector(":scope > .button-plus.delete").classList.toggle("disabled", !hasGroups);
};