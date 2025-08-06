import { AutoScroll } from "./DOM/auto-scroll.js";
import { SetupButtonPlus } from "./DOM/button-plus.js";
import { CoverEventHandler } from "./DOM/cover.js";
import { SetupNumberPlus } from "./DOM/number-plus.js";
import { SliderTrackEventHandler, SliderValueEventHandler } from "./DOM/slider.js";
import { RadioEventHandler, ToggleEventHandler } from "./DOM/togglers.js";
import { AspectRatioInputEventHandler, AspectRatioPresetEventHandler } from "./event-handlers/aspect-ratio.js";
import { DeleteFilesEventHandler } from "./event-handlers/delete-files.js";
import { ImportEventHandler, ImportFileEventHandler, FileEditorNameEventHandler, FileEditorSaveEventHandler } from "./event-handlers/import.js";
import { MultiselectEventHandler } from "./event-handlers/multiselect.js";
import { ViewFilesDeleteEventHandler, ViewFilesEventHandler, ViewFilesTabEventHandler } from "./event-handlers/view-files.js";
import { ViewRangeEventHandler, ViewRangeInputsEventHandler } from "./event-handlers/view-range.js";
import { UpdateColorSelector } from "./function/color-selector.js";
import { GroupsResizeEventHandler } from "./function/groups-resize.js";
import { SwitchTheme } from "./function/theme.js";
import { UpdateRenderSettings } from "./function/update-render-settings.js";

function update() {
    document.querySelectorAll("[data-event]").forEach($el => {
        const events = $el.dataset.event.split(",");
        for (const event of events) {
            switch (event) {
                case "radio": {
                    RadioEventHandler($el);
                } break;
                case "toggle": {
                    ToggleEventHandler($el);
                } break;
                case "multiselect": {
                    MultiselectEventHandler($el);
                } break;

                case "slider:track": {
                    SliderTrackEventHandler($el);
                } break;
                case "slider:value": {
                    SliderValueEventHandler($el);
                } break;

                case "cover": {
                    CoverEventHandler($el);
                } break;

                case "switch-theme": {
                    $el.addEventListener("click", SwitchTheme);
                } break;

                case "import": {
                    ImportEventHandler($el);
                } break;
                case "import:file": {
                    ImportFileEventHandler($el);
                } break;
                case "file-editor:name": {
                    FileEditorNameEventHandler($el);
                } break;
                case "file-editor:save": {
                    FileEditorSaveEventHandler($el);
                } break;

                case "files:delete": {
                    DeleteFilesEventHandler($el);
                } break;

                case "files:view": {
                    ViewFilesEventHandler($el);
                } break;
                case "file-viewer:tab": {
                    ViewFilesTabEventHandler($el);
                } break;
                case "file-viewer:delete": {
                    ViewFilesDeleteEventHandler($el);
                } break;

                case "groups:toggle": {
                    $el.addEventListener("click", () => document.documentElement.querySelector("#groups").classList.toggle("collapsed"));
                } break;
                case "groups:resize": {
                    GroupsResizeEventHandler($el);
                } break;

                case "render-settings:view-range": {
                    ViewRangeEventHandler($el);
                } break;
                case "render-settings:min": {
                    ViewRangeInputsEventHandler($el, "min");
                } break;
                case "render-settings:max": {
                    ViewRangeInputsEventHandler($el, "max");
                } break;

                case "render-settings:update-text(click)": {
                    $el.addEventListener("click", e => {
                        UpdateRenderSettings();
                    });
                } break;
                case "render-settings:update-text(change)": {
                    $el.addEventListener("change", e => {
                        UpdateRenderSettings();
                    });
                } break;

                case "render-settings:aspect-ratio:width": {
                    AspectRatioInputEventHandler($el);
                } break;
                case "render-settings:aspect-ratio:height": {
                    AspectRatioInputEventHandler($el);
                } break;
                case "render-settings:aspect-ratio:preset": {
                    AspectRatioPresetEventHandler($el);
                } break;

                case "render-settings:background": {
                    const $preview = $el.closest(".content").querySelector(".preview");
                    $el.addEventListener("change", e => {
                        const v = $el.value || $el.placeHolder;
                        if (CSS.supports("background", v)) {
                            $preview.style.background = v;
                        } else {
                            $preview.style.background = "";
                        }
                    });
                } break;
            }
        }

        delete $el.dataset.event;
    });

    SetupButtonPlus();
    SetupNumberPlus();

    AutoScroll();

    window.requestAnimationFrame(update);
}
window.requestAnimationFrame(update);