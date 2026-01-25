import "../../prototype/HTML.js";
import { global } from "./global.js";

import Tooltip from "../../module/tooltip.js";
import { Text } from "../../module/text.js";
import cString from "../../module/cString.js";
import ReadFile from "./read-file.js";
import { ChangeGroupName, CreateGroup, AddMemberToGroup, CanCleanGroups, CleanGroups, AutoGroup, AllEmptyGroups, GenerateUUID } from "./groups.js";
import { LoadDataSelection, SaveDataSelection } from "./data-selector.js";
import LoadFileSelection from "./file-viewer.js";
import { ColorToHex, HexToColor, InverseShade, RgbToHsl } from "./color.js";
import CreateColorSpectrum from "./create-color-spectrum.js";
import cMath from "../../module/cMath.js";
import UpdateColorSelector from "./update-color-selector.js";
import UpdateDrawSettings from "./update-draw-settings.js";
import Draw from "./draw.js";
import undoRedoManager, { Actions, fileReferenceManager, colorSelectorUndoRedoManager, dataSelectorUndoRedoManager } from "./undo-redo.js";
import { CreateNotification } from "./notification.js";

const TPS = 30; // ticks per second
const SPT = 1 / TPS; // seconds per tick

// Color selector debouncing system
let colorSelectorDebounceTimeout = null;
let colorSelectorInitialState = null;
let colorSelectorCurrentState = null;

async function SmoothScroll($, dist, time, callback = () => true) {
    if (dist === 0) return Promise.resolve([ 0, 0 ]); // no scrolling needed

    const start = $.scrollLeft, end = start + dist;

    let resolve;
    const promise = new Promise(res => resolve = res);
    const deadline = Date.now() + time;

    const scroll = () => {
        const now = Date.now();
        const progress = Math.min(1, (now - (deadline - time)) / time);

        const pos = start + progress * dist;
        if (now >= deadline) {
            $.scrollLeft = end; // ensure we reach the end
            resolve([ 0, 0 ]);
        } else if (!callback($, pos))
            resolve([ dist - (pos - start), Math.max(0, deadline - now) ]);
        else {
            $.scrollLeft = pos;
            requestAnimationFrame(scroll); // continue scrolling
        }
    };

    requestAnimationFrame(scroll); // start scrolling
    return promise;
}

// Helper function to handle debounced color selector undo actions
function CreateDebouncedColorAction(description, immediateUpdate, undoCallback) {
    // If this is the first change in a sequence, capture the initial state
    if (!colorSelectorInitialState) {
        const $colorSelector = document.qs("#color-selector");
        colorSelectorInitialState = {
            red: parseFloat($colorSelector.dataset.red) || 0,
            green: parseFloat($colorSelector.dataset.green) || 0,
            blue: parseFloat($colorSelector.dataset.blue) || 0,
            alpha: parseFloat($colorSelector.dataset.alpha) || 1
        };
    }

    // Apply the immediate change
    immediateUpdate();

    // Capture the current state after the change
    const $colorSelector = document.qs("#color-selector");
    colorSelectorCurrentState = {
        red: parseFloat($colorSelector.dataset.red) || 0,
        green: parseFloat($colorSelector.dataset.green) || 0,
        blue: parseFloat($colorSelector.dataset.blue) || 0,
        alpha: parseFloat($colorSelector.dataset.alpha) || 1
    };

    // Clear any existing timeout
    if (colorSelectorDebounceTimeout) {
        clearTimeout(colorSelectorDebounceTimeout);
    }

    // Set up a new debounced action
    colorSelectorDebounceTimeout = setTimeout(() => {
        // Only create undo action if there was actually a change
        const initial = colorSelectorInitialState;
        const current = colorSelectorCurrentState;

        if (initial.red !== current.red || initial.green !== current.green ||
            initial.blue !== current.blue || initial.alpha !== current.alpha) {

            colorSelectorUndoRedoManager.executeAction({
                description: `${description} (R:${current.red}, G:${current.green}, B:${current.blue}, A:${current.alpha.toFixed(2)})`,
                execute() {
                    UpdateColorSelector(current.red, current.green, current.blue, current.alpha);
                },
                undo() {
                    UpdateColorSelector(initial.red, initial.green, initial.blue, initial.alpha);
                }
            });
        }

        // Reset the debouncing state
        colorSelectorDebounceTimeout = null;
        colorSelectorInitialState = null;
        colorSelectorCurrentState = null;
    }, 300); // 300ms delay
}

// Clipboard availability and fallback functionality
let clipboardAvailable = false;
let clipboardTestCompleted = false;

async function CheckClipboardAvailability() {
    if (clipboardTestCompleted) return clipboardAvailable;

    try {
        // Test if clipboard API is available and functional
        if (!navigator.clipboard)
            throw new Error("Clipboard API not available");

        // Test read permission (this might prompt user)
        if (document.hasFocus())
            await navigator.clipboard.readText();

        clipboardAvailable = true;
    } catch (error) {
        console.warn("Clipboard not available:", error.message);
        clipboardAvailable = false;
    }

    clipboardTestCompleted = true;
    return clipboardAvailable;
}

async function CopyToClipboard(text) {
    try {
        if (!clipboardAvailable)
            throw new Error("Clipboard not available");

        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.warn("Failed to copy to clipboard:", error.message);

        CreateNotification("Unable to copy to clipboard", "var(--notification-red)");

        return false;
    }
}

async function readFromClipboard() {
    try {
        if (!clipboardAvailable || !document.hasFocus())
            return null;

        return await navigator.clipboard.readText();
    } catch (error) {
        console.warn("Failed to read from clipboard:", error.message);
        return null;
    }
}

function SaveColorChanges() {
    // Flush any pending debounced actions before processing final save
    FlushPendingColorActions();

    // Validate that we have a valid color selector context
    if (!global.colorSelector) {
        console.warn("No color selector context available");
        return;
    }

    // Get current color values from the color selector
    const colorState = GetCurrentColorState();
    if (!colorState) return;

    // Get the member context and validate it
    const memberContext = GetMemberContext();
    if (!memberContext) return;

    // Capture state for undo/redo
    const previousState = CapturePreviousState(memberContext);

    // Execute the color change with undo/redo support
    undoRedoManager.executeAction({
        description: CreateColorChangeDescription(colorState, memberContext),
        execute: () => ApplyColorChange(colorState, memberContext),
        undo: () => RestorePreviousState(previousState, memberContext)
    });
}

function FlushPendingColorActions() {
    if (!colorSelectorDebounceTimeout) return;

    clearTimeout(colorSelectorDebounceTimeout);

    const initial = colorSelectorInitialState;
    const current = colorSelectorCurrentState;

    if (initial && current && HasColorChanged(initial, current)) {
        colorSelectorUndoRedoManager.executeAction({
            description: `Change color (R:${current.red}, G:${current.green}, B:${current.blue}, A:${current.alpha.toFixed(2)})`,
            execute: () => UpdateColorSelector(current.red, current.green, current.blue, current.alpha),
            undo: () => UpdateColorSelector(initial.red, initial.green, initial.blue, initial.alpha)
        });
    }

    // Reset debouncing state
    colorSelectorDebounceTimeout = null;
    colorSelectorInitialState = null;
    colorSelectorCurrentState = null;
}

function GetCurrentColorState() {
    const $colorSelector = document.qs("#color-selector");
    if (!$colorSelector) {
        console.warn("Color selector element not found");
        return null;
    }

    const r = parseFloat($colorSelector.dataset.red) || 0;
    const g = parseFloat($colorSelector.dataset.green) || 0;
    const b = parseFloat($colorSelector.dataset.blue) || 0;
    const a = parseFloat($colorSelector.dataset.alpha) || 1;

    const $fileToggle = document.qs("#color-selector > .file-defined-section > .container > .switch > input[type='checkbox']");
    const isFileDefinedMode = $fileToggle?.checked || false;

    return {
        r, g, b, a,
        hex: ColorToHex([r, g, b, a]),
        isFileDefinedMode
    };
}

function GetMemberContext() {
    const $member = global.colorSelector;
    const $colorButton = $member?.qs(".color");
    const $group = $member?.closest(".group");

    if (!$member || !$colorButton || !$group) {
        console.warn("Invalid member context");
        return null;
    }

    const groupName = global.groupElements.get($group);
    if (!groupName) {
        console.warn("Group name not found");
        return null;
    }

    // Get member data from selector elements
    const memberData = [];
    $member.qsa(".selector").forEach($selector => {
        memberData.push($selector.dataset.selector);
    });

    if (memberData.length === 0) {
        console.warn("No member data found");
        return null;
    }

    // Find member index in group
    const group = global.groups[groupName];
    const memberIndex = group?.members.findIndex(m =>
        m.member.join("|") === memberData.join("|")
    );

    if (memberIndex === undefined || memberIndex === -1) {
        console.warn("Member not found in group");
        return null;
    }

    return {
        $member,
        $colorButton,
        $group,
        groupName,
        group,
        memberIndex,
        memberData
    };
}

function CapturePreviousState(memberContext) {
    const { $colorButton } = memberContext;

    return {
        color: $colorButton.dataset.color,
        isFileDefinedMode: $colorButton.dataset.asDefinedInFile === "true",
        recentColors: localStorage.getItem("SeqR:recent-colors") || ""
    };
}

function CreateColorChangeDescription(colorState, memberContext) {
    const { hex, isFileDefinedMode } = colorState;
    return `Change member color to ${hex}${isFileDefinedMode ? " (file-defined)" : ""}`;
}

function ApplyColorChange(colorState, memberContext) {
    const { r, g, b, a, hex, isFileDefinedMode } = colorState;
    const { $colorButton, group, memberIndex } = memberContext;

    // Update DOM elements
    $colorButton.dataset.color = hex;
    $colorButton.style.setProperty("--color", hex);
    $colorButton.style.setProperty("--outline", ColorToHex(InverseShade([r, g, b])));

    // Update data model
    group.members[memberIndex].color = hex;
    group.members[memberIndex].settings = group.members[memberIndex].settings || {};
    group.members[memberIndex].settings.asDefinedInFile = isFileDefinedMode;

    // Update file-defined mode
    $colorButton.dataset.asDefinedInFile = isFileDefinedMode;
    $colorButton.classList.toggle("file-defined", isFileDefinedMode);

    // Update recent colors
    UpdateRecentColors(hex);
}

function RestorePreviousState(previousState, memberContext) {
    const { color, isFileDefinedMode, recentColors } = previousState;
    const { $colorButton, group, memberIndex } = memberContext;

    // Restore DOM elements
    $colorButton.dataset.color = color;
    $colorButton.style.setProperty("--color", color);
    $colorButton.style.setProperty("--outline", ColorToHex(InverseShade(HexToColor(color))));

    // Restore data model
    group.members[memberIndex].color = color;
    group.members[memberIndex].settings = group.members[memberIndex].settings || {};
    group.members[memberIndex].settings.asDefinedInFile = isFileDefinedMode;

    // Restore file-defined mode
    $colorButton.dataset.asDefinedInFile = isFileDefinedMode;
    $colorButton.classList.toggle("file-defined", isFileDefinedMode);

    // Restore recent colors
    localStorage.setItem("SeqR:recent-colors", recentColors);
}

function HasColorChanged(initial, current) {
    return initial.red !== current.red ||
           initial.green !== current.green ||
           initial.blue !== current.blue ||
           initial.alpha !== current.alpha;
}

function UpdateRecentColors(hex) {
    let recent = localStorage.getItem("SeqR:recent-colors") || "";
    recent = recent.split(",").filter(color => color); // Remove empty strings

    // Remove the color if it already exists to avoid duplicates
    const existingIndex = recent.indexOf(hex);
    if (existingIndex !== -1) recent.splice(existingIndex, 1);

    // Add the new color to the end
    recent.push(hex);

    // Maintain max limit
    if (recent.length > (global.maxRecentColors || 10)) {
        recent = recent.slice(-global.maxRecentColors);
    }

    localStorage.setItem("SeqR:recent-colors", recent.join(","));
}

function update() {
    document.qsa("[data-events]").forEach($ => {
        const events = $.dataset.events.split(",");
        for (const event of events) {
            switch (event) {
                case "link": {
                    $.addEventListener("click", e => {
                        const href = $.dataset.href;
                        if (href)
                            window.open(href, "_blank");
                    });
                } break;

                case "toggle": {
                    $.addEventListener("click", e => $.classList.toggle("selected"));
                } break;

                case "multiselect": {
                    $.addEventListener("click", e => {
                        if (e.target.dataset.stopSelectPropagation === "true") return;

                        for (const sel of [ ".button", ".button-plus" ]) {
                            const $el = e.target.closest(sel);
                            if ($el && $.contains($el)) return;
                        }

                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            $.classList.toggle("selected");
                        } else if (e.shiftKey && global.lastSelected) {
                            $.parentElement?.qsa(".selected").forEach($el => $el.classList.remove("selected"));

                            const start = global.lastSelected.compareDocumentPosition($) & Node.DOCUMENT_POSITION_FOLLOWING ? global.lastSelected : $;
                            const end = global.lastSelected.compareDocumentPosition($) & Node.DOCUMENT_POSITION_FOLLOWING ? $ : global.lastSelected;

                            let current = start;
                            while (current && current !== end) {
                                current.classList.add("selected");
                                current = current.nextElementSibling;
                            }
                            end.classList.add("selected");

                            return;
                        } else {
                            $.parentElement?.qsa(".selected").forEach($el => $el.classList.remove("selected"));
                            $.classList.add("selected");
                        }

                        global.lastSelected = $;
                    });
                } break;

                case "radio": {
                    $.addEventListener("click", e => {
                        const group = $.dataset.group;
                        (global.radio ??= {})[group] = $.dataset.value;

                        document.qsa(`.selected[data-group="${group}"]`).forEach($radio => $radio.classList.remove("selected"));
                        $.classList.add("selected");
                    });
                } break;
                case "cycle-click": {
                    $.addEventListener("click", () => $.closest(".button-plus")?.qs(".trigger")?.click());
                } break;
                case "cycle-enter": {
                    $.addEventListener("keydown", e => {
                        if (e.key === "Enter") $.closest(".button-plus")?.qs(".trigger")?.click();
                    });
                } break;

                case "slider": {
                    function UpdateSlider(e) {
                        if (e.target !== $) return;

                        const $slider = $.closest(".slider-container");
                        const [ min, max ] = [ parseFloat($slider.dataset.min) || 0, parseFloat($slider.dataset.max) || 100 ];
                        const step = parseFloat($slider.dataset.step) || 1;

                        const y = 1 - e.offsetY / $.clientHeight;
                        const value = Math.round((min + (max - min) * y) / step) * step;
                        $slider.style.setProperty("--value", `${Math.round(y * 100 / step) * step}%`);

                        $slider.qs(".value > .input").textContent = value;

                        $slider.dataset.value = value; // update the dataset value
                        $slider.qs(".trigger").click();
                    }

                    $.addEventListener("mousedown", UpdateSlider);
                    $.addEventListener("mousemove", e => {
                        if (e.target !== $) return;
                        if (e.buttons === 1) UpdateSlider(e);
                    });
                    $.addEventListener("mouseleave", e => {
                        if (e.target !== $) return;
                        if (e.buttons === 1) {
                            UpdateSlider({
                                target: $,
                                offsetY: Math.max(0, Math.min(e.offsetY, $.clientHeight)) // ensure offsetY is within bounds
                            });
                        }
                    });
                    $.addEventListener("wheel", e => {
                        const $slider = $.closest(".slider-container");
                        const value = parseFloat($slider.dataset.value) || 0;

                        const [ min, max ] = [ parseFloat($slider.dataset.min) || 0, parseFloat($slider.dataset.max) || 100 ];
                        const step = parseFloat($slider.dataset.step) || 1;

                        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);
                        $slider.style.setProperty("--value", `${(v - min) / (max - min) * 100}%`);
                        $slider.qs(".value > .input").textContent = v;

                        $slider.dataset.value = v; // update the dataset value
                        $slider.qs(".trigger").click();
                    }, { passive: false });
                } break;
                case "slider-value": {
                    function UpdateSlider(e, fix) {
                        let v = parseFloat($.textContent.replace(/[^\d.-]/g, "") || "0");

                        const $slider = $.closest(".slider-container");
                        const [ min, max ] = [ parseFloat($slider.dataset.min) || 0, parseFloat($slider.dataset.max) || 100 ];
                        if (!isNaN(v)) {
                            const step = parseFloat($slider.dataset.step) || 1;

                            v = cMath.clamp(v, min, max); // ensure value is within bounds
                            const value = Math.round((v - min) / step) * step;
                            $slider.style.setProperty("--value", `${(value - min) / (max - min) * 100}%`);

                            if (fix) $.textContent = value + min; // ensure value is within bounds

                            $slider.dataset.value = value + min; // update the dataset value
                            $slider.qs(".trigger")?.click(); // trigger the change event
                        } else $.textContent = $slider.dataset.value ||= min; // reset to default value if not a number
                    }

                    $.addEventListener("input", e => {
                        UpdateSlider(e, false);
                    });
                    $.addEventListener("focusout", e => {
                        UpdateSlider(e, true);
                    });
                    $.addEventListener("wheel", e => { // inc or dec value on wheel
                        const $slider = $.closest(".slider-container");
                        const value = parseFloat($slider.dataset.value) || 0;

                        const [ min, max ] = [ parseFloat($slider.dataset.min) || 0, parseFloat($slider.dataset.max) || 100 ];
                        const step = parseFloat($slider.dataset.step) || 1;

                        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);
                        $.textContent = v, $slider.dataset.value = v;

                        UpdateSlider(e, true); // update the value
                    }, { passive: false });
                } break;

                case "number-input": {
                    function UpdateNumberInput(e, fix) {
                        let v = parseFloat($.textContent.replace(/[^\d.-]/g, "") || "0");

                        const [ min, max ] = [ parseFloat($.dataset.min) || 0, parseFloat($.dataset.max) || 100 ];
                        if (!isNaN(v)) {
                            const step = parseFloat($.dataset.step) || 1;

                            v = cMath.clamp(v, min, max); // ensure value is within bounds
                            const value = Math.round((v - min) / step) * step;
                            if (fix) $.textContent = value + min; // ensure value is within bounds

                            $.dataset.value = value + min; // update the dataset value
                            $.parentElement.qs(`.trigger[data-label="${$.dataset.label}"]`)?.click(); // trigger the change event
                        } else $.textContent = $.dataset.value ||= min; // reset to default value if not a number
                    }

                    $.addEventListener("input", e => {
                        UpdateNumberInput(e, false);
                    });
                    $.addEventListener("focusout", e => {
                        UpdateNumberInput(e, true);
                    });
                    $.addEventListener("wheel", e => { // inc or dec value on wheel
                        const value = parseFloat($.dataset.value) || 0;

                        const [ min, max ] = [ parseFloat($.dataset.min || "0"), parseFloat($.dataset.max || "100") ];
                        const step = parseFloat($.dataset.step || "1");

                        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);
                        $.textContent = v, $.dataset.value = v;

                        UpdateNumberInput(e, true); // update the value
                    }, { passive: false });
                } break;
                case "number-input-scroll": { // elment = input[type="number"]
                    $.addEventListener("wheel", e => {
                        const value = parseFloat($.value) || 0;

                        const [ min, max ] = [ parseFloat($.min || "-Infinity"), parseFloat($.max || "Infinity") ];
                        const step = parseFloat($.step || "1");

                        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);
                        $.value = v;

                        e.preventDefault(); // prevent default scrolling behavior
                        $.dispatchEvent(new Event("input")); // trigger input event
                    }, { passive: false });
                } break;

                case "force-horizontal-scroll": {
                    $.addEventListener("wheel", e => {
                        const [ x, y ] = [ e.deltaY, e.deltaX ];

                        $.scrollLeft += x;
                        $.scrollTop += y;

                        if ((x !== 0 && $.scrollWidth > $.clientWidth) || (y !== 0 && $.scrollHeight > $.clientHeight)) {
                            e.preventDefault(); // prevent default scrolling behavior
                            e.stopPropagation(); // stop event propagation
                        }
                    }, { passive: false });
                } break;
                case "force-vertical-scroll": {
                    $.addEventListener("wheel", e => {
                        const d = e.deltaX + e.deltaY;
                        $.scrollTop += d;
                        if (d !== 0 && $.scrollHeight > $.clientHeight) {
                            e.preventDefault(); // prevent default horizontal scrolling behavior
                            e.stopPropagation(); // stop event propagation
                        }
                    }, { passive: false });
                } break;
                case "force-horizontal-scroll": {
                    $.addEventListener("wheel", e => {
                        const d = e.deltaX + e.deltaY;
                        $.scrollLeft += d;
                        if (d !== 0 && $.scrollWidth > $.clientWidth) {
                            e.preventDefault(); // prevent default vertical scrolling behavior
                            e.stopPropagation(); // stop event propagation
                        }
                    }, { passive: false });
                } break;

                case "cover": {
                    $.addEventListener("click", () => {
                        // Check if color selector is open before closing
                        const $colorSelector = document.qs("#color-selector:not(.hidden)");
                        const wasColorSelectorOpen = $colorSelector !== null;

                        // Check if data selector is open before closing
                        const $dataSelector = document.qs("#data-selector:not(.hidden)");
                        const wasDataSelectorOpen = $dataSelector !== null;

                        // Flush any pending debounced color actions before closing
                        if (wasColorSelectorOpen && colorSelectorDebounceTimeout) {
                            clearTimeout(colorSelectorDebounceTimeout);

                            // Execute the pending action immediately
                            const initial = colorSelectorInitialState;
                            const current = colorSelectorCurrentState;

                            if (initial && current &&
                                (initial.red !== current.red || initial.green !== current.green ||
                                 initial.blue !== current.blue || initial.alpha !== current.alpha)) {

                                colorSelectorUndoRedoManager.executeAction({
                                    description: `Change color (R:${current.red}, G:${current.green}, B:${current.blue}, A:${current.alpha.toFixed(2)})`,
                                    execute() {
                                        UpdateColorSelector(current.red, current.green, current.blue, current.alpha);
                                    },
                                    undo() {
                                        UpdateColorSelector(initial.red, initial.green, initial.blue, initial.alpha);
                                    }
                                });
                            }

                            // Reset debouncing state
                            colorSelectorDebounceTimeout = null;
                            colorSelectorInitialState = null;
                            colorSelectorCurrentState = null;
                        }

                        document.qsa(".float:not(.hidden)").forEach($float => $float.classList.add("hidden"));

                        // Deactivate color selector undo/redo system if it was open
                        if (wasColorSelectorOpen && colorSelectorUndoRedoManager.isActive) {
                            colorSelectorUndoRedoManager.deactivate();
                        }

                        // Deactivate data selector undo/redo system if it was open
                        if (wasDataSelectorOpen && dataSelectorUndoRedoManager.isActive) {
                            dataSelectorUndoRedoManager.deactivate();
                        }
                    });
                } break;

                case "toggle-ui-mode": {
                    $.addEventListener("click", () => {
                        document.body.classList.add("no-transition");

                        document.documentElement.classList.toggle("light");

                        const light = document.documentElement.classList.contains("light");
                        localStorage.setItem("light-mode", light);

                        requestAnimationFrame(() => document.body.classList.remove("no-transition"));
                    });
                } break;

                case "import": {
                    $.addEventListener("click", () => {
                        switch (global.radio?.["import-type"]) {
                            case "file": {
                                document.qs("#file-input").click();
                            } break;
                            case "code": {
                                const $editor = document.qs("#text-editor");

                                const $text = $editor.qs(".textarea"), $name = $editor.qs(".file-name");
                                $text.textContent = "";
                                $name.value = "";
                                $name.classList.add("invalid");

                                $text.focus();

                                $editor.classList.remove("hidden");
                            } break;
                        }
                    });
                } break;

                case "undo": {
                    $.addEventListener("click", e => {
                        // Route to appropriate undo/redo manager based on active state
                        if (colorSelectorUndoRedoManager.isActive) {
                            colorSelectorUndoRedoManager.undo();
                        } else if (dataSelectorUndoRedoManager.isActive) {
                            dataSelectorUndoRedoManager.undo();
                        } else {
                            undoRedoManager.undo();
                        }
                    });
                } break;

                case "redo": {
                    $.addEventListener("click", e => {
                        // Route to appropriate undo/redo manager based on active state
                        if (colorSelectorUndoRedoManager.isActive) {
                            colorSelectorUndoRedoManager.redo();
                        } else if (dataSelectorUndoRedoManager.isActive) {
                            dataSelectorUndoRedoManager.redo();
                        } else {
                            undoRedoManager.redo();
                        }
                    });
                } break;

                case "file-input": {
                    $.addEventListener("change", async e => {
                        const files = e.target.files;
                        if (files.length === 0) return;

                        console.log(`Starting import of ${files.length} file(s)`);
                        const fileInfos = [];
                        const errors = [];

                        // Import all files
                        for (const file of files) {
                            const result = await ReadFile(file);

                            if (result?.error) {
                                // Handle error cases - notification already shown by ReadFile
                                errors.push({
                                    fileName: file.name,
                                    error: result.error,
                                    message: result.message
                                });
                                console.error(`Failed to import file: ${file.name} - ${result.error}`);
                            } else if (result?.fileName && result?.element) {
                                fileInfos.push({
                                    fileName: result.fileName,
                                    fileElement: result.element
                                });
                                console.log(`Imported file: ${result.fileName}`);
                            }
                        }

                        // Create undo/redo action for successful imports
                        if (fileInfos.length > 0) {
                            if (fileInfos.length === 1) {
                                undoRedoManager.executeAction(Actions.importFile(
                                    fileInfos[0].fileName,
                                    fileInfos[0].fileElement
                                ));
                            } else {
                                undoRedoManager.executeAction(Actions.importFiles(fileInfos));
                            }
                            console.log(`Created undo/redo action for ${fileInfos.length} file(s)`);
                        }

                        // Show summary if there were errors and some successes
                        if (errors.length > 0 && fileInfos.length > 0) {
                            CreateNotification(
                                `Imported ${fileInfos.length} file(s) successfully, ${errors.length} file(s) failed`,
                                "var(--notification-gray)",
                                4000
                            );
                        }

                        $.value = ""; // reset input value to allow re-uploading the same file
                    });
                } break;

                case "remove-files": {
                    $.addEventListener("click", e => {
                        const $selected = document.qsa("#top-bar > .file-list > .file.selected");
                        if ($selected.length === 0) {
                            // Remove all files
                            const allFiles = {};
                            const allFileElements = new Map(global.fileElements ?? new Map());
                            const allGroups = {};
                            const allGroupElements = new Map(global.groupElements ?? new Map());
                            // Store the original order of files for proper restoration
                            const originalFileOrder = Object.keys(global.files ?? {});

                            // Create serializable copies of files (without circular references)
                            for (const [key, file] of Object.entries(global.files ?? {})) {
                                allFiles[key] = {
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    lastModified: file.lastModified,
                                    // Store only essential data, not the full proxy objects
                                    data: file.data,
                                    types: file.types
                                };
                            }

                            // Create serializable copies of groups
                            for (const [key, group] of Object.entries(global.groups ?? {})) {
                                allGroups[key] = {
                                    name: group.name,
                                    members: group.members,
                                    UUID: group.UUID
                                };
                            }

                            undoRedoManager.executeAction({
                                description: "Remove all files",
                                async execute() {
                                    // Soft-delete all files
                                    for (const [fileName, fileData] of Object.entries(global.files ?? {})) {
                                        await fileReferenceManager.softDeleteFile(fileName, fileData);
                                    }

                                    global.fileElements = new Map();
                                    global.files = {};
                                    global.fileOpen = null;
                                    document.qs("#top-bar > .file-list").innerHTML = "";
                                    global.groups = {};
                                    global.groupElements = new Map();
                                    document.qs("#side-bar > .content").innerHTML = "";
                                },
                                async undo() {
                                    // Restore all files from soft-deleted state in original order
                                    const restoredFiles = {};
                                    for (const fileName of originalFileOrder) {
                                        const restoredFile = await fileReferenceManager.restoreFile(fileName, null);
                                        if (restoredFile) {
                                            restoredFiles[fileName] = restoredFile;
                                        }
                                    }

                                    global.files = restoredFiles;
                                    global.fileElements = allFileElements;
                                    global.groups = allGroups;
                                    global.groupElements = allGroupElements;

                                    // Recreate file elements
                                    const $fileList = document.qs("#top-bar > .file-list");
                                    for (const [element, fileName] of allFileElements) {
                                        $fileList.appendChild(element);
                                    }

                                    // Recreate group elements
                                    const $groupContent = document.qs("#side-bar > .content");
                                    for (const [element, groupName] of allGroupElements) {
                                        $groupContent.appendChild(element);
                                    }

                                    // Trigger update to re-attach event handlers
                                    update();
                                }
                            });
                        } else {
                            // Remove selected files
                            const filesToRemove = [];
                            // Store the original order of all files for proper restoration
                            const originalFileOrder = Object.keys(global.files ?? {});

                            $selected.forEach($file => {
                                const fileName = global.fileElements.get($file);
                                if (fileName && global.files[fileName]) {
                                    const file = global.files[fileName];
                                    filesToRemove.push({
                                        fileName,
                                        fileData: {
                                            name: file.name,
                                            size: file.size,
                                            type: file.type,
                                            lastModified: file.lastModified,
                                            // Store only essential data, not the full proxy objects
                                            data: file.data,
                                            types: file.types
                                        },
                                        element: $file,
                                        // Store position information for proper restoration
                                        nextSibling: $file.nextElementSibling,
                                        previousSibling: $file.previousElementSibling
                                    });
                                }
                            });

                            const affectedGroups = {};
                            const deletedGroups = {}; // Store groups that will be completely deleted

                            // Store groups that will be affected
                            for (const group of Object.values(global.groups ?? {})) {
                                const originalMembers = [...group.members];
                                const filteredMembers = group.members.filter(m =>
                                    !filesToRemove.some(f => f.fileName === m.member[0])
                                );
                                if (originalMembers.length !== filteredMembers.length) {
                                    if (filteredMembers.length === 0) {
                                        // Group will be completely deleted
                                        deletedGroups[group.name] = {
                                            groupData: {
                                                name: group.name,
                                                members: originalMembers,
                                                UUID: group.UUID
                                            },
                                            element: group.element,
                                            nextSibling: group.element.nextElementSibling,
                                            previousSibling: group.element.previousElementSibling
                                        };
                                    } else {
                                        // Group will lose some members but remain
                                        affectedGroups[group.name] = {
                                            originalMembers,
                                            filteredMembers
                                        };
                                    }
                                }
                            }

                            undoRedoManager.executeAction({
                                description: `Remove ${filesToRemove.length} file${filesToRemove.length > 1 ? "s" : ""}`,
                                async execute() {
                                    for (const fileInfo of filesToRemove) {
                                        // Use soft-delete for file data preservation
                                        if (global.files[fileInfo.fileName]) {
                                            await fileReferenceManager.softDeleteFile(fileInfo.fileName, global.files[fileInfo.fileName]);
                                        }

                                        delete global.files[fileInfo.fileName];
                                        global.fileElements.delete(fileInfo.element);
                                        fileInfo.element.remove();

                                        // Update affected groups
                                        for (const group of Object.values(global.groups ?? {})) {
                                            const hasMember = group.members.length > 0;
                                            group.members = group.members.filter(m => m.member[0] !== fileInfo.fileName);
                                            group.element.qsa(`.member:has(.selector:first-child[data-selector="${fileInfo.fileName}"])`).forEach($member => $member.remove());

                                            if (hasMember && group.members.length === 0) {
                                                group.element.remove();
                                                delete global.groups[group.name];
                                                global.groupElements.delete(group.element);
                                            }
                                        }
                                    }
                                },
                                async undo() {
                                    // Restore files from soft-deleted state in correct order
                                    const $fileList = document.qs("#top-bar > .file-list");

                                    // Restore files and update fileElements map
                                    for (const fileInfo of filesToRemove) {
                                        const restoredFile = await fileReferenceManager.restoreFile(fileInfo.fileName, null);
                                        if (restoredFile) {
                                            global.files[fileInfo.fileName] = restoredFile;
                                            global.fileElements.set(fileInfo.element, fileInfo.fileName);
                                        }
                                    }

                                    // Rebuild global.files in original order to preserve iteration order
                                    // Create new object with entries in correct order
                                    const orderedFiles = {};
                                    for (const fileName of originalFileOrder) {
                                        if (global.files[fileName]) {
                                            orderedFiles[fileName] = global.files[fileName];
                                        }
                                    }
                                    global.files = orderedFiles;

                                    // Re-insert file elements at their original positions
                                    for (const fileInfo of filesToRemove.reverse()) {
                                        if (global.files[fileInfo.fileName]) {
                                            if (fileInfo.nextSibling && fileInfo.nextSibling.parentNode === $fileList) {
                                                // Insert before the next sibling
                                                $fileList.insertBefore(fileInfo.element, fileInfo.nextSibling);
                                            } else if (fileInfo.previousSibling && fileInfo.previousSibling.parentNode === $fileList) {
                                                // Insert after the previous sibling
                                                fileInfo.previousSibling.insertAdjacentElement('afterend', fileInfo.element);
                                            } else {
                                                // If no siblings found, append at the end
                                                $fileList.appendChild(fileInfo.element);
                                            }
                                        }
                                    }
                                    // Restore original order for potential future operations
                                    filesToRemove.reverse();

                                    // Restore affected groups (those that lost some but not all members)
                                    for (const [groupName, groupInfo] of Object.entries(affectedGroups)) {
                                        if (global.groups[groupName]) {
                                            // Clear existing members from DOM
                                            const $members = global.groups[groupName].element.qs(".members");
                                            $members.innerHTML = "";

                                            // Reset members array and recreate all member elements
                                            global.groups[groupName].members = [];
                                            for (const memberData of groupInfo.originalMembers) {
                                                AddMemberToGroup(groupName, memberData.member, memberData.color, memberData.settings);
                                            }
                                        }
                                    }

                                    // Restore completely deleted groups
                                    for (const [groupName, groupInfo] of Object.entries(deletedGroups)) {
                                        // Recreate the group data structure
                                        global.groups[groupName] = {
                                            name: groupInfo.groupData.name,
                                            element: groupInfo.element,
                                            members: [],
                                            UUID: groupInfo.groupData.UUID
                                        };

                                        global.groupElements.set(groupInfo.element, groupName);

                                        // Re-insert the group element at its original position
                                        const $content = document.qs("#side-bar > .content");
                                        if (groupInfo.nextSibling && groupInfo.nextSibling.parentNode === $content) {
                                            $content.insertBefore(groupInfo.element, groupInfo.nextSibling);
                                        } else if (groupInfo.previousSibling && groupInfo.previousSibling.parentNode === $content) {
                                            groupInfo.previousSibling.insertAdjacentElement("afterend", groupInfo.element);
                                        } else {
                                            $content.appendChild(groupInfo.element);
                                        }

                                        // Clear existing members from DOM and recreate all member elements
                                        const $members = groupInfo.element.qs(".members");
                                        $members.innerHTML = "";

                                        for (const memberData of groupInfo.groupData.members) {
                                            AddMemberToGroup(groupName, memberData.member, memberData.color, memberData.settings);
                                        }
                                    }

                                    // Trigger update to re-attach event handlers
                                    update();
                                }
                            });
                        }
                    });
                } break;

                case "view-files": {
                    $.addEventListener("click", e => {
                        const $selected = document.qsa("#top-bar > .file-list > .file.selected");
                        if ($selected.length === 0) return;

                        const $fileViewer = document.qs("#file-viewer");
                        const $files = $fileViewer.qs(".files");
                        $files.innerHTML = "";

                        let first = true;
                        $selected.forEach($file => {
                            const unique = global.fileElements.get($file);

                            const $fileTab = $files.create("div", {
                                class: "file",
                                content: unique,
                                dataset: {
                                    events: "view-files>file",
                                    unique
                                },
                                title: `View file: ${unique}`
                            }, { end: true });

                            if (first) {
                                first = false;

                                $fileTab.classList.add("selected");
                                LoadFileSelection($fileTab).catch(console.error);
                            }
                        });

                        $fileViewer.classList.remove("hidden");
                    });
                } break;
                case "view-files>file": {
                    $.addEventListener("click", async e => {
                        $.parentElement?.qsa(".file.selected").forEach($el => $el.classList.remove("selected"));
                        $.classList.add("selected");

                        await LoadFileSelection($);
                    });
                } break;

                case "file>delete": {
                    $.addEventListener("click", async e => {
                        const $file = global.fileOpen;
                        if (!$file) return;

                        const fileName = global.fileElements.get($file);
                        if (!fileName) return;

                        const fileData = global.files[fileName];
                        if (!fileData) return;

                        // Store affected groups data before deletion
                        const affectedGroups = {};
                        for (const group of Object.values(global.groups ?? {})) {
                            if (group.members.some(m => m.member[0] === fileName)) {
                                affectedGroups[group.name] = {
                                    originalMembers: [...group.members],
                                    element: group.element
                                };
                            }
                        }

                        // Store the original position in the file list
                        const nextSibling = $file.nextElementSibling;
                        const previousSibling = $file.previousElementSibling;

                        undoRedoManager.executeAction({
                            description: `Delete file "${fileName}"`,
                            async execute() {
                                // Use soft-delete for file data preservation
                                if (global.files[fileName]) {
                                    await fileReferenceManager.softDeleteFile(fileName, global.files[fileName]);
                                }

                                delete global.files[fileName];
                                global.fileElements.delete($file);
                                $file.remove();
                                global.fileOpen = null;

                                // Update groups
                                for (const group of Object.values(global.groups ?? {})) {
                                    const hasMember = group.members.length > 0;
                                    group.members = group.members.filter(m => m.member[0] !== fileName);
                                    group.element.qsa(`.member:has(.selector:first-child[data-selector="${fileName}"])`).forEach($member => $member.remove());

                                    if (hasMember && group.members.length === 0) {
                                        group.element.remove();
                                        delete global.groups[group.name];
                                        global.groupElements.delete(group.element);
                                    }
                                }

                                // Handle file viewer updates
                                const $fileViewer = document.qs("#file-viewer");
                                const $files = $fileViewer.qs(".files");
                                const $tab = $files.querySelector(`.file.selected`);

                                if ($tab && $tab.classList.contains("selected")) {
                                    const $new = $tab.nextElementSibling || $tab.previousElementSibling;
                                    if ($new) {
                                        $new.classList.add("selected");
                                        LoadFileSelection($new).catch(console.error);
                                    }
                                }

                                $tab?.remove();
                                if ($files.children.length === 0)
                                    $fileViewer.classList.add("hidden");
                            },
                            async undo() {
                                // Restore file from soft-deleted state
                                const restoredFile = await fileReferenceManager.restoreFile(fileName, null);
                                if (restoredFile) {
                                    global.files[fileName] = restoredFile;
                                    global.fileElements.set($file, fileName);

                                    // Re-insert the file element at its original position
                                    const $fileList = document.qs("#top-bar > .file-list");
                                    if (nextSibling && nextSibling.parentNode === $fileList) {
                                        // Insert before the next sibling
                                        $fileList.insertBefore($file, nextSibling);
                                    } else if (previousSibling && previousSibling.parentNode === $fileList) {
                                        // Insert after the previous sibling
                                        previousSibling.insertAdjacentElement('afterend', $file);
                                    } else {
                                        // If no siblings found, append at the end
                                        $fileList.appendChild($file);
                                    }

                                    // Restore affected groups
                                    for (const [groupName, groupInfo] of Object.entries(affectedGroups)) {
                                        if (global.groups[groupName]) {
                                            global.groups[groupName].members = groupInfo.originalMembers;
                                            // Re-add group to UI if it was removed
                                            if (!groupInfo.element.parentNode) {
                                                document.qs("#side-bar > .content").appendChild(groupInfo.element);
                                                global.groupElements.set(groupInfo.element, groupName);
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    });
                } break;

                case "side-bar>toggle": {
                    $.addEventListener("click", e => {
                        const $sideBar = document.qs("#side-bar");
                        $sideBar.classList.toggle("collapsed");
                        $sideBar.qsa(".button-plus > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click()); // close all open button-plus menus
                    });
                } break;

                case "sidebar-resize": {
                    let isDragging = false;
                    let startX = 0;
                    let startWidth = 0;
                    let animationFrame = null;

                    function MouseMove(e) {
                        if (!isDragging) return;

                        // Cancel any pending animation frame
                        if (animationFrame) {
                            cancelAnimationFrame(animationFrame);
                        }

                        // Use requestAnimationFrame for smoother updates
                        animationFrame = requestAnimationFrame(() => {
                            const deltaX = startX - e.clientX; // Negative because sidebar is on the right
                            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.7, startWidth + deltaX));
                            const newWidthVw = (newWidth / window.innerWidth) * 100;

                            document.body.style.setProperty("--side-bar-size", `${newWidthVw}vw`);
                            animationFrame = null;
                        });

                        e.preventDefault();
                    }

                    function MouseUp(e) {
                        if (!isDragging) return;

                        isDragging = false;
                        $.classList.remove("dragging");

                        // Cancel any pending animation frame
                        if (animationFrame) {
                            cancelAnimationFrame(animationFrame);
                            animationFrame = null;
                        }

                        // Re-enable transitions after a small delay to prevent flash
                        requestAnimationFrame(() => {
                            document.body.classList.remove("no-transition");
                        });

                        // Save the sidebar width to localStorage
                        const currentWidth = document.body.style.getPropertyValue("--side-bar-size");
                        if (currentWidth) {
                            localStorage.setItem("SeqR:sidebar-width", currentWidth);
                        }

                        // Remove document-level listeners
                        document.removeEventListener("mousemove", MouseMove);
                        document.removeEventListener("mouseup", MouseUp);

                        e.preventDefault();
                    }

                    $.addEventListener("mousedown", e => {
                        // Only respond to left mouse button
                        if (e.button !== 0) return;

                        isDragging = true;
                        startX = e.clientX;

                        // Aggressively disable transitions during drag
                        document.body.classList.add("no-transition");

                        // Get current sidebar width in pixels
                        const $sideBar = document.qs("#side-bar");
                        const computedStyle = getComputedStyle(document.body);
                        const currentSidebarSize = computedStyle.getPropertyValue("--side-bar-size");

                        // Parse the current width - handle both vw and px units
                        let currentWidthVw;
                        if (currentSidebarSize.includes("vw")) {
                            currentWidthVw = parseFloat(currentSidebarSize);
                        } else if (currentSidebarSize.includes("px")) {
                            const px = parseFloat(currentSidebarSize);
                            currentWidthVw = (px / window.innerWidth) * 100;
                        } else {
                            currentWidthVw = 30; // Default fallback
                        }

                        startWidth = (currentWidthVw / 100) * window.innerWidth;

                        $.classList.add("dragging");

                        // Add document-level listeners for global mouse tracking
                        document.addEventListener("mousemove", MouseMove);
                        document.addEventListener("mouseup", MouseUp);

                        e.preventDefault();
                    });
                } break;

                case "side-bar>new-group": {
                    $.addEventListener("click", e => {
                        // Generate a unique name for the new group
                        let name = "Unnamed Group";
                        for (let i = 2; name in (global.groups ?? {}); i++)
                            name = `Unnamed Group (${i})`;

                        // Execute the action through the undo system
                        undoRedoManager.executeAction({
                            description: `Create group "${name}"`,
                            execute() {
                                CreateGroup(name);
                            },
                            undo() {
                                const $group = global.groups[name]?.element;
                                if ($group && global.groups[name]) {
                                    delete global.groups[name];
                                    global.groupElements.delete($group);
                                    $group.remove();
                                }
                            }
                        });
                    });
                } break;
                case "side-bar>auto-group": {
                    $.addEventListener("click", async e => {
                        const options = new Set();
                        document.qsa("#side-bar > .bottom > .button-plus.auto-group > .cycles > .options > .simple-button.selected")
                            .forEach($el => options.add($el.dataset.value));

                        // Get selected files, if any
                        const $selectedFiles = document.qsa("#top-bar > .file-list > .file.selected");
                        const selectedFileIds = Array.from($selectedFiles).map($file =>
                            global.fileElements.get($file)
                        ).filter(Boolean);

                        // Store current state before auto-grouping
                        const previousGroups = JSON.parse(JSON.stringify(global.groups ?? {}));
                        const previousGroupElements = new Map(global.groupElements ?? new Map());

                        // Execute auto-group through undo system
                        undoRedoManager.executeAction({
                            description: "Auto group files",
                            async execute() {
                                // If files are selected, only auto-group those files
                                // Otherwise, auto-group all files (existing behavior)
                                await AutoGroup(options, selectedFileIds.length > 0 ? selectedFileIds : null);
                            },
                            undo() {
                                // Clear current groups
                                document.qs("#side-bar > .content").innerHTML = "";

                                // Restore previous state
                                global.groups = previousGroups;
                                global.groupElements = previousGroupElements;

                                // Recreate group elements
                                for (const [element, name] of previousGroupElements) {
                                    document.qs("#side-bar > .content").appendChild(element);
                                }
                            }
                        });
                    });
                } break;
                case "side-bar>clean-groups": {
                    $.addEventListener("click", e => {
                        if (!CanCleanGroups()) return;

                        // Store groups that will be removed
                        const $selected = new Set(document.qsa("#side-bar > .content > .group.selected"));
                        const checkSelected = $selected.size > 0;
                        const removedGroups = {};
                        const UUIDs = new Set();

                        // Identify which groups will be removed and store position information
                        for (const [name, group] of Object.entries(global.groups ?? {})) {
                            if (checkSelected && !$selected.has(group.element)) continue;

                            if (group.members.length === 0) {
                                removedGroups[name] = {
                                    ...group,
                                    nextSibling: group.element.nextElementSibling,
                                    previousSibling: group.element.previousElementSibling
                                };
                                continue;
                            }

                            const UUID = group.UUID ?? `${name}|${group.members.length}`;
                            if (UUIDs.has(UUID)) {
                                removedGroups[name] = {
                                    ...group,
                                    nextSibling: group.element.nextElementSibling,
                                    previousSibling: group.element.previousElementSibling
                                };
                            } else UUIDs.add(UUID);
                        }

                        // Execute through undo system
                        undoRedoManager.executeAction({
                            description: "Clean empty/duplicate groups",
                            execute() {
                                CleanGroups();
                            },
                            undo() {
                                // Restore removed groups in reverse order to maintain positions
                                const groupEntries = Object.entries(removedGroups);
                                groupEntries.reverse().forEach(([name, group]) => {
                                    global.groups[name] = group;
                                    global.groupElements.set(group.element, name);

                                    // Re-insert the element at its original position
                                    const $content = document.qs("#side-bar > .content");
                                    if (group.nextSibling && group.nextSibling.parentNode === $content) {
                                        $content.insertBefore(group.element, group.nextSibling);
                                    } else if (group.previousSibling && group.previousSibling.parentNode === $content) {
                                        group.previousSibling.insertAdjacentElement("afterend", group.element);
                                    } else {
                                        $content.appendChild(group.element);
                                    }
                                });
                            }
                        });
                    });
                } break;
                case "side-bar>delete-groups": {
                    $.addEventListener("click", e => {
                        const $selected = document.qsa("#side-bar > .content > .group.selected");

                        if ($selected.length === 0) {
                            // Delete all groups
                            const allGroups = {};
                            const allGroupElements = new Map();

                            // Properly preserve all group data including element references
                            for (const [name, group] of Object.entries(global.groups ?? {})) {
                                allGroups[name] = { ...group }; // Shallow copy to preserve element reference
                            }

                            // Preserve the element mappings
                            for (const [element, name] of global.groupElements ?? new Map()) {
                                allGroupElements.set(element, name);
                            }

                            undoRedoManager.executeAction({
                                description: "Delete all groups",
                                execute() {
                                    global.groupElements = new Map();
                                    global.groups = {};
                                    document.qs("#side-bar > .content").innerHTML = "";
                                },
                                undo() {
                                    global.groups = allGroups;
                                    global.groupElements = allGroupElements;

                                    // Recreate group elements in the DOM
                                    const $content = document.qs("#side-bar > .content");
                                    for (const [element, name] of allGroupElements) {
                                        $content.appendChild(element);
                                        // Ensure the group.element reference is properly set
                                        if (global.groups[name]) {
                                            global.groups[name].element = element;
                                        }
                                    }
                                }
                            });
                        } else {
                            // Delete selected groups
                            const deletedGroups = [];
                            $selected.forEach($group => {
                                const name = global.groupElements.get($group);
                                if (name && global.groups[name]) {
                                    deletedGroups.push({
                                        name,
                                        groupData: { ...global.groups[name] },
                                        element: $group,
                                        // Store position information for proper restoration
                                        nextSibling: $group.nextElementSibling,
                                        previousSibling: $group.previousElementSibling
                                    });
                                }
                            });

                            undoRedoManager.executeAction({
                                description: `Delete ${$selected.length} group${$selected.length > 1 ? "s" : ""}`,
                                execute() {
                                    deletedGroups.forEach(({ name, element }) => {
                                        if (global.groups[name]) {
                                            delete global.groups[name];
                                            global.groupElements.delete(element);
                                            element.remove();
                                        }
                                    });
                                },
                                undo() {
                                    // Restore groups in reverse order to maintain positions
                                    deletedGroups.reverse().forEach(({ name, groupData, element, nextSibling, previousSibling }) => {
                                        global.groups[name] = groupData;

                                        // Update the element reference to the correct DOM element
                                        global.groups[name].element = element;

                                        global.groupElements.set(element, name);

                                        // Re-insert the element at its original position
                                        const $content = document.qs("#side-bar > .content");

                                        if (nextSibling && nextSibling.parentNode === $content) {
                                            $content.insertBefore(element, nextSibling);
                                        } else if (previousSibling && previousSibling.parentNode === $content) {
                                            previousSibling.insertAdjacentElement('afterend', element);
                                        } else {
                                            $content.appendChild(element);
                                        }
                                    });
                                    // Restore original order
                                    deletedGroups.reverse();
                                }
                            });
                        }
                    });
                } break;

                case "group>name": {
                    let originalName = null;

                    $.addEventListener("click", e => {
                        // Mobile group expand/collapse functionality
                        const isNarrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;

                        if (isNarrow && !$.isContentEditable) {
                            const $group = $.closest(".group");
                            $group.classList.toggle("expanded");

                            // Prevent text selection on mobile tap
                            e.preventDefault();
                        }
                    });

                    $.addEventListener("focusin", e => {
                        // Store the original name when editing starts
                        const $group = $.closest(".group");
                        originalName = global.groupElements.get($group);
                    });

                    $.addEventListener("focusout", e => {
                        const $group = $.closest(".group");
                        const newName = $.textContent.trim();

                        if (originalName && originalName !== newName && newName !== "") {
                            // Use undo/redo system for group renaming
                            undoRedoManager.executeAction(Actions.renameGroup(originalName, newName, $group));
                        } else {
                            // Fall back to direct change if names are the same or new name is empty
                            ChangeGroupName(originalName, newName);
                        }

                        originalName = null;
                    });
                } break;
                case "group>edit": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        global.dataSelectorGroup = $group;
                        global.dataSelectorTabs = new Map();

                        const $dataSelector = document.qs("#data-selector");
                        const $files = $dataSelector.qs(".files");
                        $files.innerHTML = "";

                        const group = global.groups[global.groupElements.get($group)], members = {};
                        for (const { member } of group.members) {
                            let temp = members[member[0]] ??= {};
                            temp = temp[member[1]] ??= new Set();
                            temp.add(member[2]);
                        }

                        let first = true, tab;
                        for (const unique of Object.keys(global.files ?? {})) {
                            const $file = $files.create("div", {
                                class: "file",
                                content: unique,
                                dataset: {
                                    events: "data-selector>file",
                                    unique
                                },
                                title: `Select file for data: ${unique}`
                            }, { end: true });

                            const save = members[unique] || {};
                            global.dataSelectorTabs.set($file, save);
                            if (Object.keys(save).length > 0) {
                                $file.classList.add("has-selected");

                                if (tab === undefined) {
                                    first = false, tab = true;

                                    $file.classList.add("selected");
                                    LoadDataSelection($file).catch(console.error);
                                }
                            }

                            if (first === true) first = $file;
                        }

                        if (first || true !== true) {
                            first.classList.add("selected");
                            LoadDataSelection(first).catch(console.error);
                        }

                        // Activate data selector undo/redo system
                        dataSelectorUndoRedoManager.activate(undoRedoManager);

                        $dataSelector.classList.remove("hidden");
                    });
                } break;
                case "group>member>copy": {
                    $.addEventListener("click", async e => {
                        // Check if the copy button is disabled
                        if ($.classList.contains("disabled")) return;

                        const color = $.closest(".member")?.qs(".color")?.dataset.color;
                        if (color) {
                            const success = await CopyToClipboard(color);
                            if (success) CreateNotification(`Copied: ${color}`, "var(--notification-green)");
                        }
                    });
                } break;
                case "group>member>paste": {
                    $.addEventListener("click", e => {
                        // Check if the paste button is disabled
                        if ($.classList.contains("disabled"))
                            return;

                        const color = global.pasteText;
                        if (!color) {
                            console.warn("No text available to paste");
                            return;
                        }

                        const $color = $.closest(".member")?.qs(".color");
                        const $member = $.closest(".member");
                        const $group = $member?.closest(".group");

                        if (!$color || !$member || !$group) return;

                        const oldColor = $color.dataset.color;
                        const groupName = global.groupElements.get($group);

                        // Get member data from selectors
                        const memberData = [];
                        $member.qsa(".selectors > .selector").forEach($selector => {
                            memberData.push($selector.dataset.selector);
                        });

                        if (!groupName || memberData.length === 0) return;

                        // Find member index in group
                        const group = global.groups[groupName];
                        const memberIndex = group?.members.findIndex(m =>
                            m.member.join("|") === memberData.join("|")
                        );

                        if (memberIndex === undefined || memberIndex === -1) return;

                        undoRedoManager.executeAction({
                            description: `Change member color to ${color}`,
                            execute() {
                                $color.dataset.color = color;
                                $color.style.setProperty("--color", color);
                                $color.style.setProperty("--outline", ColorToHex(InverseShade(HexToColor(color))));

                                // Update the group data
                                if (group.members[memberIndex]) {
                                    group.members[memberIndex].color = color;
                                }

                                // Show paste notification
                                CreateNotification(`Pasted: ${color}`, "var(--notification-blue)");
                            },
                            undo() {
                                $color.dataset.color = oldColor;
                                $color.style.setProperty("--color", oldColor);
                                $color.style.setProperty("--outline", ColorToHex(InverseShade(HexToColor(oldColor))));

                                // Restore the group data
                                if (group.members[memberIndex]) {
                                    group.members[memberIndex].color = oldColor;
                                }
                            }
                        });
                    });
                } break;
                case "group>member>color": {
                    $.addEventListener("mouseenter", e => { // tooltip
                        const color = $.dataset.color;
                        if (!color) return;

                        const text = $.dataset.asDefinedInFile === "true"
                            ? `File defined (${color} fallback)`
                            : color;

                        new Tooltip($, text, { anchor: "center top", offsetY: -1 });
                    });

                    $.addEventListener("click", e => {
                        const color = $.dataset.color;

                        const [ r, g, b, a = 1 ] = HexToColor(color);
                        UpdateColorSelector(r, g, b, a, true);

                        // Set the file toggle state
                        const $fileToggle = document.qs("#color-selector > .file-defined-section > .container > .switch > input[type='checkbox']");
                        $fileToggle.checked = $.dataset.asDefinedInFile === "true";

                        document.qs("#color-selector")?.classList.remove("hidden");
                        global.colorSelector = $.closest(".member");

                        // Activate color selector undo/redo system
                        colorSelectorUndoRedoManager.activate(undoRedoManager);
                    });
                } break;

                case "group>member>remove": {
                    $.addEventListener("click", e => {
                        const $member = $.closest(".member");
                        const $group = $member?.closest(".group");

                        if (!$member || !$group) return;

                        const groupName = global.groupElements.get($group);
                        const group = global.groups[groupName];

                        if (!group) return;

                        // Get member data from selectors
                        const memberData = [];
                        $member.qsa(".selectors > .selector").forEach($selector => {
                            memberData.push($selector.dataset.selector);
                        });

                        if (memberData.length === 0) return;

                        // Find member index in group
                        const memberIndex = group.members.findIndex(m =>
                            m.member.join("|") === memberData.join("|")
                        );

                        if (memberIndex === undefined || memberIndex === -1) return;

                        const memberInfo = group.members[memberIndex];
                        const nextSibling = $member.nextElementSibling;
                        const previousSibling = $member.previousElementSibling;

                        undoRedoManager.executeAction({
                            description: `Remove member from group "${groupName}"`,
                            execute() {
                                // Remove from group data
                                group.members.splice(memberIndex, 1);

                                // Remove from DOM
                                $member.remove();

                                // If group is now empty, remove it
                                if (group.members.length === 0) {
                                    delete global.groups[groupName];
                                    global.groupElements.delete($group);
                                    $group.remove();
                                }

                                // Regenerate UUID
                                if (group.members.length > 0) {
                                    group.UUID = GenerateUUID(group);
                                }
                            },
                            undo() {
                                // If group was deleted, recreate it
                                if (!global.groups[groupName]) {
                                    global.groups[groupName] = group;
                                    global.groupElements.set($group, groupName);

                                    // Re-insert group in sidebar
                                    document.qs("#side-bar > .content").appendChild($group);
                                }

                                // Restore member to group data
                                group.members.splice(memberIndex, 0, memberInfo);

                                // Re-insert member element at correct position
                                const $members = $group.qs(".members");
                                if (nextSibling && nextSibling.parentNode === $members) {
                                    $members.insertBefore($member, nextSibling);
                                } else if (previousSibling && previousSibling.parentNode === $members) {
                                    $members.insertBefore($member, previousSibling.nextSibling);
                                } else {
                                    $members.appendChild($member);
                                }

                                // Regenerate UUID
                                group.UUID = GenerateUUID(group);
                            }
                        });
                    });
                } break;

                case "data-selector>file": {
                    $.addEventListener("click", e => {
                        $.parentElement?.qsa(".file.selected").forEach($el => $el.classList.remove("selected"));
                        $.classList.add("selected");

                        // Set the current tab for the data selector undo/redo manager
                        dataSelectorUndoRedoManager.setCurrentTab($);

                        LoadDataSelection($).catch(console.error);
                    });
                } break;
                case "data-selector>type": {
                    $.addEventListener("click", e => {
                        const $currentTab = document.body.qs("#data-selector > .files > .file.selected");
                        if (!$currentTab) return;

                        const fileName = $currentTab.dataset.unique;
                        const typeName = $.dataset.type;
                        const sectionType = $.closest(".section").dataset.type;

                        // Read the state from the authoritative data source
                        const currentData = global.dataSelectorTabs.get($currentTab) || {};
                        const currentSectionSet = currentData[sectionType] || new Set();
                        const wasSelected = currentSectionSet.has(typeName);

                        // Create deep copy of current state for undo
                        const beforeState = {};
                        for (const [key, set] of Object.entries(currentData)) {
                            beforeState[key] = new Set(set);
                        }

                        // Create the new state for execute/redo
                        const afterState = {};
                        for (const [key, set] of Object.entries(currentData)) {
                            afterState[key] = new Set(set);
                        }

                        // Modify the after state
                        const afterSectionSet = afterState[sectionType] || new Set();
                        if (wasSelected) {
                            afterSectionSet.delete(typeName);
                            if (afterSectionSet.size === 0) {
                                delete afterState[sectionType];
                            } else {
                                afterState[sectionType] = afterSectionSet;
                            }
                        } else {
                            afterSectionSet.add(typeName);
                            afterState[sectionType] = afterSectionSet;
                        }

                        // Create undo/redo action that works with data states
                        dataSelectorUndoRedoManager.executeActionWithTab({
                            description: `${wasSelected ? "Deselect" : "Select"} ${sectionType}: ${typeName} in ${fileName}`,
                            execute() {
                                // Apply the new state
                                global.dataSelectorTabs.set($currentTab, afterState);

                                // Update the tab's "has-selected" class
                                $currentTab.classList.toggle("has-selected", Object.keys(afterState).length > 0);

                                // Reload the tab to ensure visual consistency
                                LoadDataSelection($currentTab).catch(console.error);
                            },
                            undo() {
                                // Restore the previous state
                                global.dataSelectorTabs.set($currentTab, beforeState);

                                // Update the tab's "has-selected" class
                                $currentTab.classList.toggle("has-selected", Object.keys(beforeState).length > 0);

                                // Reload the tab to reflect restored data
                                LoadDataSelection($currentTab).catch(console.error);
                            }
                        }, $currentTab);
                    });
                } break;
                case "data-selector>discard": {
                    $.addEventListener("click", e => {
                        document.qs("#cover")?.click(); // close the data selector
                    });
                } break;
                case "data-selector>save": {
                    $.addEventListener("click", async e => {
                        const $group = global.dataSelectorGroup;
                        if (!$group) return;

                        const group = global.groups[global.groupElements.get($group)];
                        const groupName = global.groupElements.get($group);
                        const oldMembers = [...group.members]; // Store original members

                        // Store the existing member elements for restoration
                        const oldMemberElements = [];
                        $group.qsa(".members > .member").forEach($member => {
                            oldMemberElements.push($member.cloneNode(true));
                        });

                        undoRedoManager.executeAction({
                            description: `Update group "${groupName}" members`,
                            async execute() {
                                // Get color information from existing members before clearing
                                const oldData = {};
                                const definedInFiles = {};
                                $group.qsa(".members > .member").forEach($member => {
                                    const $color = $member.qs(".color");

                                    const color = $color?.dataset.color;
                                    if (color) {
                                        let root = colors;
                                        $member.qsa(".selectors > .selector").forEach($selector => {
                                            const selector = $selector.dataset.selector;
                                            root = root[selector] ??= {};
                                        });
                                        root.color = color;
                                    }

                                    const asDefinedInFile = $color?.dataset.asDefinedInFile;
                                    if (asDefinedInFile) {
                                        let root = definedInFiles;
                                        $member.qsa(".selectors > .selector").forEach($selector => {
                                            const selector = $selector.dataset.selector;
                                            root = root[selector] ??= {};
                                        });
                                        root.asDefinedInFile = asDefinedInFile === "true";
                                    }
                                });

                                group.members = []; // Clear current members

                                // Load all file data before processing
                                const fileLoadPromises = [];
                                const saves = global.dataSelectorTabs.entries();
                                const uniques = [];

                                for (const [ $file, save ] of saves) {
                                    const unique = $file.dataset.unique, file = global.files[unique];
                                    if (!file) continue;

                                    uniques.push([ unique, save ]);

                                    if (!file.isDataLoaded())
                                        fileLoadPromises.push(file.loadFileData());
                                }

                                $group.qs(".members").innerHTML = "";

                                if (fileLoadPromises.length > 0)
                                    await Promise.all(fileLoadPromises);

                                for (const [ unique, save ] of uniques) {
                                   const file = global.files[unique];
                                    if (!file) continue;

                                    for (const [ type, vs ] of Object.entries(file.types)) {
                                        if (!save[type]) continue; // no types selected
                                        for (const v of vs)
                                            if (save[type].has(v)) {
                                                const color = colors[unique]?.[type]?.[v]?.color;
                                                const asDefinedInFile = definedInFiles[unique]?.[type]?.[v]?.asDefinedInFile;
                                                AddMemberToGroup(group.name, [ unique, type, v ], color, { asDefinedInFile });
                                            }
                                    }
                                }

                                document.qs("#cover")?.click(); // close the data selector
                            },
                            undo() {
                                // Restore original members
                                group.members = oldMembers;

                                // Clear current member elements
                                const $membersContainer = $group.qs(".members");
                                $membersContainer.innerHTML = "";

                                // Restore original member elements
                                oldMemberElements.forEach($element => {
                                    $membersContainer.appendChild($element);
                                });

                                // Trigger update to re-attach event handlers
                                update();
                            }
                        });
                    });
                } break;

                case "group>delete": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        const name = global.groupElements.get($group);
                        if (!name || !global.groups[name]) return;

                        const groupData = { ...global.groups[name] };

                        // Use the Actions.deleteGroup which already handles positioning
                        undoRedoManager.executeAction(Actions.deleteGroup(name, groupData, $group));
                    });
                } break;

                case "group>move-top": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        const $container = $group.parentElement;
                        if ($container.firstElementChild !== $group) {
                            $container.insertBefore($group, $container.firstElementChild);
                            $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
                        }
                    });
                } break;

                case "group>move-up": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        const $prev = $group.previousElementSibling;
                        if ($prev) {
                            $group.parentElement.insertBefore($group, $prev);
                            $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
                        }
                    });
                } break;

                case "group>move-down": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        const $next = $group.nextElementSibling;
                        if ($next) {
                            $group.parentElement.insertBefore($next, $group);
                            $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
                        }
                    });
                } break;

                case "group>move-bottom": {
                    $.addEventListener("click", e => {
                        const $group = $.closest(".group");
                        if (!$group) return;

                        const $container = $group.parentElement;
                        if ($container.lastElementChild !== $group) {
                            $container.appendChild($group);
                            $group.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
                        }
                    });
                } break;

                case "text-editor>textarea": {

                } break;
                case "text-editor>file-name": {
                    $.addEventListener("input", e => {
                        const text = $.value;
                        if (/^[a-zA-Z0-9._\-]+?\.(gft|gff|gff2|gff3|gtf|bed|bedgraph|bdg|wig|wiggle|sam|vcf|fa|fasta|fas|fq|fastq)$/.test(text))
                            $.classList.remove("invalid");
                        else $.classList.add("invalid");
                    });
                    $.addEventListener("keydown", e => {
                        switch (e.key) {
                            case "Enter": {
                                e.preventDefault();
                                $.closest("#text-editor")?.qs(".button")?.click();
                            } break;
                        }
                    });
                } break;
                case "text-editor>save": {
                    $.addEventListener("click", async e => {
                        const $editor = $.closest("#text-editor");
                        const $text = $editor.qs(".textarea"), $name = $editor.qs(".file-name");

                        const name = $name.value;

                        if (/^[a-zA-Z0-9._\-]+?\.(gft|gff|gff2|gff3|gtf|bed|bedgraph|bdg|wig|wiggle|sam|vcf|fa|fasta|fas|fq|fastq)$/.test(name)) {
                            $editor.classList.add("hidden");

                            const file = new File(
                                [ new Blob([ $text.textContent ], { type: "text/plain" }) ],
                                name,
                                { type: "text/plain", lastModified: Date.now() }
                            );

                            $text.textContent = "";
                            $name.value = "";
                            $name.classList.add("invalid");

                            // Import the file and create undo/redo action
                            const result = await ReadFile(file);
                            if (result?.error) {
                                // Error notification already shown by ReadFile
                                console.error(`Failed to import text file: ${name} - ${result.error}`);
                            } else if (result?.fileName && result?.element) {
                                undoRedoManager.executeAction(Actions.importFile(
                                    result.fileName,
                                    result.element
                                ));
                            }
                        } else $name.classList.add("invalid");
                    });
                } break;

                case "color-selector>select": {
                    $.addEventListener("click", e => {
                        if (e.target !== $) return; // only trigger on the main element, not on children

                        const $colorSelector = document.qs("#color-selector");
                        const oldR = parseFloat($colorSelector.dataset.red) || 0;
                        const oldG = parseFloat($colorSelector.dataset.green) || 0;
                        const oldB = parseFloat($colorSelector.dataset.blue) || 0;
                        const oldA = parseFloat($colorSelector.dataset.alpha) || 1;

                        const [ x, y ] = [ e.offsetX / $.clientWidth * $.width, e.offsetY / $.clientHeight * $.height ];
                        const [ r, g, b ] = global.colorSelectorPen.getImageData(x, y, 1, 1).data;

                        // Only process if color actually changed
                        if (r !== oldR || g !== oldG || b !== oldB) {
                            CreateDebouncedColorAction(
                                "Pick color from spectrum",
                                () => {
                                    UpdateColorSelector(r, g, b, null);
                                }
                            );
                        } else {
                            UpdateColorSelector(r, g, b, null);
                        }
                    });
                } break;
                case "color-selector>red": {
                    $.addEventListener("click", e => {
                        const value = +$.parentElement.qs(`:not(.trigger)[data-label="${$.dataset.label}"]`).dataset.value || 0;
                        const $colorSelector = document.qs("#color-selector");
                        const oldValue = parseFloat($colorSelector.dataset.red) || 0;

                        // Only process if value actually changed
                        if (value !== oldValue) {
                            CreateDebouncedColorAction(
                                "Change red value",
                                () => {
                                    $colorSelector.dataset.red = value;
                                    $colorSelector.style.setProperty("--red", value);
                                }
                            );
                        } else {
                            $colorSelector.dataset.red = value;
                            $colorSelector.style.setProperty("--red", value);
                        }
                    });
                } break;
                case "color-selector>green": {
                    $.addEventListener("click", e => {
                        const value = +$.parentElement.qs(`:not(.trigger)[data-label="${$.dataset.label}"]`).dataset.value || 0;
                        const $colorSelector = document.qs("#color-selector");
                        const oldValue = parseFloat($colorSelector.dataset.green) || 0;

                        // Only process if value actually changed
                        if (value !== oldValue) {
                            CreateDebouncedColorAction(
                                "Change green value",
                                () => {
                                    $colorSelector.dataset.green = value;
                                    $colorSelector.style.setProperty("--green", value);
                                }
                            );
                        } else {
                            $colorSelector.dataset.green = value;
                            $colorSelector.style.setProperty("--green", value);
                        }
                    });
                } break;
                case "color-selector>blue": {
                    $.addEventListener("click", e => {
                        const value = +$.parentElement.qs(`:not(.trigger)[data-label="${$.dataset.label}"]`).dataset.value || 0;
                        const $colorSelector = document.qs("#color-selector");
                        const oldValue = parseFloat($colorSelector.dataset.blue) || 0;

                        // Only process if value actually changed
                        if (value !== oldValue) {
                            CreateDebouncedColorAction(
                                "Change blue value",
                                () => {
                                    $colorSelector.dataset.blue = value;
                                    $colorSelector.style.setProperty("--blue", value);
                                }
                            );
                        } else {
                            $colorSelector.dataset.blue = value;
                            $colorSelector.style.setProperty("--blue", value);
                        }
                    });
                } break;
                case "color-selector>alpha": {
                    $.addEventListener("click", e => {
                        const $colorSelector = document.qs("#color-selector");
                        const value = parseFloat($colorSelector.qs(".content > .slider-container.alpha").dataset.value) / 100;
                        const oldValue = parseFloat($colorSelector.dataset.alpha) || 1;

                        // Only process if value actually changed
                        if (value !== oldValue) {
                            CreateDebouncedColorAction(
                                "Change alpha value",
                                () => {
                                    $colorSelector.style.setProperty("--alpha", value);
                                    $colorSelector.dataset.alpha = value;
                                }
                            );
                        } else {
                            $colorSelector.style.setProperty("--alpha", value);
                            $colorSelector.dataset.alpha = value;
                        }
                    });
                } break;
                case "color-selector>easy-select>color": {
                    $.addEventListener("click", e => {
                        const $colorSelector = document.qs("#color-selector");
                        const oldR = parseFloat($colorSelector.dataset.red) || 0;
                        const oldG = parseFloat($colorSelector.dataset.green) || 0;
                        const oldB = parseFloat($colorSelector.dataset.blue) || 0;
                        const oldA = parseFloat($colorSelector.dataset.alpha) || 1;

                        const [ r, g, b, a = 1 ] = HexToColor($.dataset.color);
                        // Only create undo action if color actually changed
                        if (r !== oldR || g !== oldG || b !== oldB || a !== oldA) {
                            // First flush any pending debounced actions
                            if (colorSelectorDebounceTimeout) {
                                clearTimeout(colorSelectorDebounceTimeout);
                                colorSelectorDebounceTimeout = null;
                                colorSelectorInitialState = null;
                                colorSelectorCurrentState = null;
                            }

                            colorSelectorUndoRedoManager.executeAction({
                                description: `Select preset color ${$.dataset.color}`,
                                execute() {
                                    UpdateColorSelector(r, g, b, a);
                                },
                                undo() {
                                    UpdateColorSelector(oldR, oldG, oldB, oldA);
                                }
                            });
                        } else
                            UpdateColorSelector(r, g, b, a);
                    });
                } break;
                case "color-selector>file-toggle": {
                    $.addEventListener("click", e => { // add to undo/redo stack

                        const $checkbox = $.qs("input[type='checkbox']");
                        const isFileDefinedMode = !$checkbox.checked;
                        colorSelectorUndoRedoManager.executeAction({
                            description: `Toggle file-defined color mode to ${isFileDefinedMode ? "enabled" : "disabled"}`,
                            execute() {
                                $checkbox.checked = isFileDefinedMode;
                            },
                            undo() {
                                $checkbox.checked = !isFileDefinedMode;
                            }
                        });
                    });
                } break;
                case "color-selector>discard": {
                    $.addEventListener("click", e => {
                        document.qs("#cover")?.click(); // close the color selector
                    });
                } break;
                case "color-selector>save": {
                    $.addEventListener("click", e => {
                        SaveColorChanges();
                        document.qs("#cover")?.click(); // close the color selector
                    });
                } break;

                case "draw": {
                    $.addEventListener("click", async e => {
                        let min = Infinity, max = -Infinity;

                        // Load all necessary file data first
                        const fileLoadPromises = [];
                        for (const group of Object.values(global.groups ?? {})) {
                            for (const member of group.members) {
                                const [ unique, type, value ] = member.member;
                                const file = global.files[unique];
                                if (!file) continue;

                                if (!file.isDataLoaded())
                                    fileLoadPromises.push(file.loadFileData());
                            }
                        }

                        if (fileLoadPromises.length > 0)
                            await Promise.all(fileLoadPromises);

                        for (const group of Object.values(global.groups ?? {})) {
                            for (const member of group.members) {
                                const [ unique, type, value ] = member.member;
                                if (!global.files[unique]?.types[type]?.has(value)) continue;

                                const minmax = global.files[unique].minmax?.[type]?.[value];
                                if (!minmax) continue;

                                if (minmax.min < min) min = minmax.min;
                                if (minmax.max > max) max = minmax.max;
                            }
                        }

                        // Only reset view range if this is the first time or if global ranges are not set
                        const shouldResetViewRange = (global.viewRangeMin === undefined || global.viewRangeMax === undefined);

                        if (shouldResetViewRange) {
                            // First time: set both bounds and view range to the calculated min/max
                            UpdateDrawSettings(min, max);
                        } else {
                            // Always update bounds, but try to preserve current view range (clamped to new bounds)
                            UpdateDrawSettings(min, max, true);
                        }

                        global.viewRangeMin = min;
                        global.viewRangeMax = max;

                        document.qs("#draw-settings").classList.remove("hidden");
                    });
                }

                case "draw-settings>view-range": {
                    let isDragging = false;
                    let dragTarget = null;
                    let mouseDownPos = null;

                    function MouseMove(e) {
                        if (!isDragging || !dragTarget) return;

                        const containerRect = $.getBoundingClientRect();
                        const x = cMath.clamp((e.clientX - containerRect.x) / containerRect.width, 0, 1);

                        const currentMin = parseFloat($.style.getPropertyValue("--min")) || 0;
                        const currentMax = parseFloat($.style.getPropertyValue("--max")) || 1;

                        let newMin = currentMin;
                        let newMax = currentMax;

                        if (dragTarget === "min") {
                            newMin = x;
                            if (newMin > currentMax) {
                                // Swap when min crosses max
                                newMin = currentMax;
                                newMax = x;
                                dragTarget = "max";
                                $.dataset.closest = "max";
                                $.parentElement.dataset.lastChange = "max";
                            }
                        } else {
                            newMax = x;
                            if (newMax < currentMin) {
                                // Swap when max crosses min
                                newMax = currentMin;
                                newMin = x;
                                dragTarget = "min";
                                $.dataset.closest = "min";
                                $.parentElement.dataset.lastChange = "min";
                            }
                        }

                        $.style.setProperty("--min", newMin);
                        $.style.setProperty("--max", newMax);

                        const realMin = parseFloat($.closest(".section.view-range").dataset.min) || 0;
                        const realMax = parseFloat($.closest(".section.view-range").dataset.max) || 100;
                        const realDelta = realMax - realMin;

                        const textMin = Math.round(realMin + realDelta * newMin);
                        const textMax = Math.round(realMin + realDelta * newMax);

                        $.qs(".min").textContent = textMin;
                        $.qs(".max").textContent = textMax;

                        $.parentElement.qs(".inputs > .min").value = textMin;
                        $.parentElement.qs(".inputs > .max").value = textMax;

                        e.preventDefault?.();
                    }

                    function MouseUp(e) {
                        if (!isDragging) return;

                        // Check if this was a click (no significant mouse movement)
                        const mouseUpPos = { x: e.clientX, y: e.clientY };
                        const mouseMoveDistance = Math.sqrt(
                            Math.pow(mouseUpPos.x - mouseDownPos.x, 2) +
                            Math.pow(mouseUpPos.y - mouseDownPos.y, 2)
                        );

                        // If mouse didn't move much (< 5 pixels), treat as click
                        if (mouseMoveDistance < 5) // Move the target edge to the clicked position
                            MouseMove({ clientX: e.clientX });

                        isDragging = false;
                        dragTarget = null;
                        mouseDownPos = null;

                        // Remove document-level listeners
                        document.removeEventListener("mousemove", MouseMove);
                        document.removeEventListener("mouseup", MouseUp);

                        e.preventDefault();
                    }

                    $.addEventListener("mousedown", e => {
                        // Only respond to left mouse button (button 0)
                        if (e.button !== 0) return;

                        const $shading = $.qs(".shading");
                        const containerRect = $.getBoundingClientRect();
                        const shadingRect = $shading.getBoundingClientRect();

                        const x = (e.clientX - containerRect.x) / containerRect.width;
                        const selectX1 = (shadingRect.x - containerRect.x) / containerRect.width;
                        const selectX2 = selectX1 + shadingRect.width / containerRect.width;

                        let d1 = Math.abs(x - selectX1);
                        let d2 = Math.abs(x - selectX2);

                        // Store initial mouse position for click detection
                        mouseDownPos = { x: e.clientX, y: e.clientY };

                        // Handle edge case when min and max are the same
                        if (Math.abs(selectX1 - selectX2) < 0.01) {
                            if (x < selectX1) dragTarget = "min";
                            else dragTarget = "max";
                        } else {
                            // Determine which edge is closer
                            if (d1 < d2) dragTarget = "min";
                            else dragTarget = "max";
                        }

                        $.dataset.closest = dragTarget;
                        $.parentElement.dataset.lastChange = dragTarget;
                        isDragging = true;

                        // Add document-level listeners for global mouse tracking
                        document.addEventListener("mousemove", MouseMove);
                        document.addEventListener("mouseup", MouseUp);

                        e.preventDefault();
                    });
                } break;
                case "draw-settings>view-range>min":
                case "draw-settings>view-range>max": {
                    const isMin = event.includes("min");

                    $.addEventListener("input", e => {
                        // Just store the value during typing, don't clamp yet
                        const value = parseFloat($.value);
                        if (isNaN(value)) return;

                        const $section = $.closest(".section.view-range");
                        $section.dataset.lastChange = isMin ? "min" : "max";
                    });

                    $.addEventListener("focusout", e => {
                        const value = parseFloat($.value);

                        if ($.value.trim() === "" || isNaN(value)) {
                            // Restore to current range value if empty or invalid
                            const $section = $.closest(".section.view-range");
                            const $range = $section.qs(".range");
                            const realMin = parseFloat($section.dataset.min) || 0, realMax = parseFloat($section.dataset.max) || 100;
                            const realDelta = realMax - realMin;
                            const currentValue = parseFloat($range.style.getPropertyValue(isMin ? "--min" : "--max")) || (isMin ? 0 : 1);

                            $.value = Math.round(realMin + realDelta * currentValue);
                            return;
                        }

                        // Now clamp and update the range on focusout
                        const $section = $.closest(".section.view-range");
                        const $range = $section.qs(".range");
                        const realMin = parseFloat($section.dataset.min) || 0, realMax = parseFloat($section.dataset.max) || 100;
                        const realDelta = realMax - realMin;

                        const normValue = cMath.clamp((value - realMin) / realDelta, 0, 1);
                        const currentMin = parseFloat($range.style.getPropertyValue("--min")) || 0;
                        const currentMax = parseFloat($range.style.getPropertyValue("--max")) || 1;

                        let finalValue;
                        if (isMin) {
                            finalValue = Math.min(normValue, currentMax);
                            $range.style.setProperty("--min", finalValue);
                            $range.qs(".min").textContent = Math.round(realMin + realDelta * finalValue);
                        } else {
                            finalValue = Math.max(normValue, currentMin);
                            $range.style.setProperty("--max", finalValue);
                            $range.qs(".max").textContent = Math.round(realMin + realDelta * finalValue);
                        }

                        $.value = Math.round(realMin + realDelta * finalValue);
                        $section.dataset.lastChange = isMin ? "min" : "max";
                    });
                } break;
                case "draw-settings>update-text-preview(click)": {
                    $.addEventListener("click", e => {
                        UpdateDrawSettings();
                    });
                } break;
                case "draw-settings>update-text-preview(change)": {
                    $.addEventListener("change", e => {
                        UpdateDrawSettings();
                    });
                } break;
                case "draw-settings>background": {
                    $.addEventListener("change", e => {
                        const value = $.value || $.placeholder;

                        const $preview = $.closest(".content").qs(".preview");
                        if (CSS.supports("background", value)) $preview.style.background = value;
                        else $preview.style.background = "";
                    });
                } break;

                case "draw-settings>aspect-ratio": {
                    $.addEventListener("input", e => {
                        // Clear any selected preset when manual input is used
                        const $presets = $.closest(".section").qsa(".presets > .button.selected");
                        for (const $preset of $presets)
                            $preset.classList.remove("selected");
                    });
                } break;

                case "draw-settings>aspect-ratio-preset": {
                    $.addEventListener("click", e => {
                        const width = parseInt($.dataset.width);
                        const height = parseInt($.dataset.height);

                        // Update the input values
                        const $section = $.closest(".section");
                        $section.qs(".aspect-input > .width").value = width;
                        $section.qs(".aspect-input > .height").value = height;

                        // Update preset selection
                        const $presets = $section.qsa(".presets > .button");
                        for (const $preset of $presets)
                            $preset.classList.remove("selected");
                        $.classList.add("selected");
                    });
                } break;

                case "draw-settings>scale-toggle": {
                    $.addEventListener("change", e => {
                        const $section = document.qs("#draw-settings .section.scale");
                        const enabled = $.checked;

                        // Add/remove enabled class for visual feedback
                        $section.classList.toggle("enabled", enabled);

                        // Enable/disable scale settings based on checkbox
                        const $inputs = $section.qsa("input[type='number'], .button");
                        for (const $input of $inputs)
                            $input.classList.toggle("disabled", !enabled);
                    });
                } break;

                case "draw-settings>scale-position": {
                    $.addEventListener("click", e => {
                        // Don't allow selection if button is disabled
                        if ($.classList.contains("disabled")) return;

                        // Handle radio button selection for scale position
                        const $buttons = document.qsa("#draw-settings .section.scale .position .button");
                        for (const $button of $buttons)
                            $button.classList.remove("selected");
                        $.classList.add("selected");
                    });
                } break;

                case "draw-settings>draw": {
                    $.addEventListener("click", async e => {
                        const $drawSettings = document.qs("#draw-settings");
                        const settings = {};

                        {
                            const $viewRange = $drawSettings.qs(".content > .section.view-range > .range");
                            settings.viewRange = {};

                            const min = parseFloat($viewRange.qs(".min").textContent || "-Infinity");
                            const max = parseFloat($viewRange.qs(".max").textContent || "Infinity");

                            const realMin = global.viewRangeMin;
                            const realMax = global.viewRangeMax;

                            settings.viewRange.min = cMath.clamp(min, realMin, realMax);
                            settings.viewRange.max = cMath.clamp(max, realMin, realMax);
                        }

                        {
                            const $textStyle = $drawSettings.qs(".content > .section.text-style > .content");
                            settings.textStyle = {};

                            {
                                const align = $textStyle.qs(".align > .content > .button.selected")?.dataset.value;
                                if (align === "left" || align === "center" || align === "right") settings.textStyle.align = align;
                                else settings.textStyle.align = "center";
                            }

                            {
                                const style = {};
                                const $styles = $textStyle.qsa(".style > .content > .button.selected");
                                for (const $style of $styles) style[$style.dataset.value] = true;

                                settings.textStyle.style = style;
                            }

                            {
                                const $font = $textStyle.qs(".font > .content");

                                const size = parseFloat($font.qs(".size > input").value || "16");
                                settings.textStyle.size = cMath.clamp(size, 1, 100);

                                const color = $font.qs(".color > input").value || "#FFFFFF";
                                if (CSS.supports("color", color)) settings.textStyle.color = color;
                                else settings.textStyle.color = "#FFFFFF";

                                const font = $font.qs(".family > select").value;
                                const valid = new Set([
                                    "Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia",
                                    "Impact", "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype",
                                    "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"
                                ]);
                                if (CSS.supports("font-family", font) || !valid.has(font)) settings.textStyle.font = font;
                                else settings.textStyle.font = "Arial";
                            }
                        }

                        {
                            const $background = $drawSettings.qs(".content > .section.background > .content > input");

                            const background = $background.value || $background.placeholder || "none";
                            if (CSS.supports("background", background)) settings.background = background;
                            else settings.background = "none";
                        }

                        {
                            const $aspectRatio = $drawSettings.qs(".content > .section.aspect-ratio > .content > .aspect-input");

                            const width = parseInt($aspectRatio.qs(".width").value || "1");
                            const height = parseInt($aspectRatio.qs(".height").value || "1");

                            settings.aspectRatio = {
                                width: cMath.clamp(width, 1, 9999),
                                height: cMath.clamp(height, 1, 9999)
                            };
                        }

                        {
                            const $scaleSection = $drawSettings.qs(".content > .section.scale");
                            const $scale = $scaleSection.qs(".content");
                            settings.scale = {};

                            const enabled = $scaleSection.qs("#draw-settings\\>scale-enabled").checked;
                            settings.scale.enabled = enabled;

                            if (enabled) {
                                const position = $scale.qs(".position > .content > .button.selected")?.dataset.value || "top";
                                settings.scale.position = position;

                                const majorTicks = parseInt($scale.qs("#draw-settings\\>scale-major-ticks").value || "10");
                                const minorTicks = parseInt($scale.qs("#draw-settings\\>scale-minor-ticks").value || "5");

                                settings.scale.majorTicks = cMath.clamp(majorTicks, 2, 20);
                                settings.scale.minorTicks = cMath.clamp(minorTicks, 0, 10);
                            }
                        }

                        await Draw(settings);

                        document.qs("#cover")?.click(); // close the color selector
                    });
                } break;

                case "draw-settings>restore-defaults": {
                    $.addEventListener("click", e => {
                        const $drawSettings = document.qs("#draw-settings");

                        // Create undo/redo action for restoring defaults
                        const beforeState = {};
                        const afterState = {};

                        // Capture current state
                        beforeState.viewRange = {
                            min: parseFloat($drawSettings.qs(".section.view-range .range .min").textContent || "0"),
                            max: parseFloat($drawSettings.qs(".section.view-range .range .max").textContent || "100")
                        };
                        beforeState.textAlign = global.radio?.["draw-settings>text-align"] || "center";
                        beforeState.textStyles = [];
                        $drawSettings.qsa(".section.text-style .style .button.selected").forEach($btn => {
                            beforeState.textStyles.push($btn.dataset.value);
                        });
                        beforeState.fontSize = parseInt(document.qs("#draw-settings\\>text-size").value || "50");
                        beforeState.fontColor = document.qs("#draw-settings\\>text-color").value || "#FFFFFF";
                        beforeState.fontFamily = document.qs("#draw-settings\\>text-family").value || "Arial";
                        beforeState.aspectRatio = {
                            width: parseInt($drawSettings.qs(".section.aspect-ratio .aspect-input .width").value || "1"),
                            height: parseInt($drawSettings.qs(".section.aspect-ratio .aspect-input .height").value || "1")
                        };
                        beforeState.background = $drawSettings.qs(".section.background input[name='background']").value || "";
                        beforeState.scale = {
                            enabled: document.qs("#draw-settings\\>scale-enabled").checked,
                            position: global.radio?.["draw-settings>scale-position"] || "top",
                            majorTicks: parseInt(document.qs("#draw-settings\\>scale-major-ticks").value || "10"),
                            minorTicks: parseInt(document.qs("#draw-settings\\>scale-minor-ticks").value || "5")
                        };

                        // Set default state
                        afterState.viewRange = {
                            min: global.viewRangeMin ?? 0,
                            max: global.viewRangeMax ?? 100
                        };
                        afterState.textAlign = "center";
                        afterState.textStyles = [];
                        afterState.fontSize = 50;
                        afterState.fontColor = "#FFFFFF";
                        afterState.fontFamily = "Arial";
                        afterState.aspectRatio = { width: 1, height: 1 };
                        afterState.background = "";
                        afterState.scale = {
                            enabled: false,
                            position: "top",
                            majorTicks: 10,
                            minorTicks: 5
                        };

                        undoRedoManager.executeAction({
                            description: "Restore draw settings defaults",
                            execute() {
                                applyDrawSettingsState(afterState);
                            },
                            undo() {
                                applyDrawSettingsState(beforeState);
                            }
                        });

                        function applyDrawSettingsState(state) {
                            // View Range
                            const $viewRangeSection = $drawSettings.qs(".section.view-range");
                            const $range = $viewRangeSection.qs(".range");
                            const $minSpan = $range.qs(".min");
                            const $maxSpan = $range.qs(".max");
                            const $minInput = $viewRangeSection.qs(".inputs .min");
                            const $maxInput = $viewRangeSection.qs(".inputs .max");

                            $minSpan.textContent = state.viewRange.min;
                            $maxSpan.textContent = state.viewRange.max;
                            $minInput.value = state.viewRange.min;
                            $maxInput.value = state.viewRange.max;

                            const sectionMin = parseFloat($viewRangeSection.dataset.min);
                            const sectionMax = parseFloat($viewRangeSection.dataset.max);
                            const minValue = (state.viewRange.min - sectionMin) / (sectionMax - sectionMin);
                            const maxValue = (state.viewRange.max - sectionMin) / (sectionMax - sectionMin);
                            $range.style.setProperty("--min", minValue);
                            $range.style.setProperty("--max", maxValue);

                            // Text Align
                            $drawSettings.qsa(".align .content .button").forEach($btn => {
                                $btn.classList.toggle("selected", $btn.dataset.value === state.textAlign);
                            });
                            global.radio = global.radio || {};
                            global.radio["draw-settings>text-align"] = state.textAlign;

                            // Text Styles
                            $drawSettings.qsa(".style .content .button").forEach($btn => {
                                $btn.classList.toggle("selected", state.textStyles.includes($btn.dataset.value));
                            });

                            // Font settings
                            document.qs("#draw-settings\\>text-size").value = state.fontSize;
                            document.qs("#draw-settings\\>text-color").value = state.fontColor;
                            document.qs("#draw-settings\\>text-family").value = state.fontFamily;

                            // Aspect Ratio
                            $drawSettings.qs(".section.aspect-ratio .aspect-input .width").value = state.aspectRatio.width;
                            $drawSettings.qs(".section.aspect-ratio .aspect-input .height").value = state.aspectRatio.height;

                            // Update aspect ratio preset selection
                            $drawSettings.qsa(".section.aspect-ratio .presets .button").forEach($btn => {
                                const isDefault = parseInt($btn.dataset.width) === state.aspectRatio.width &&
                                                parseInt($btn.dataset.height) === state.aspectRatio.height;
                                $btn.classList.toggle("selected", isDefault);
                            });

                            // Background
                            $drawSettings.qs(".section.background input[name='background']").value = state.background;

                            // Scale settings
                            document.qs("#draw-settings\\>scale-enabled").checked = state.scale.enabled;

                            // Update scale position selection
                            $drawSettings.qsa(".section.scale .position .content .button").forEach($btn => {
                                $btn.classList.toggle("selected", $btn.dataset.value === state.scale.position);
                            });
                            global.radio = global.radio || {};
                            global.radio["draw-settings>scale-position"] = state.scale.position;

                            // Scale tick settings
                            document.qs("#draw-settings\\>scale-major-ticks").value = state.scale.majorTicks;
                            document.qs("#draw-settings\\>scale-minor-ticks").value = state.scale.minorTicks;

                            // Enable/disable scale controls based on checkbox state
                            const $scaleInputs = $drawSettings.qsa(".section.scale input[type='number'], .section.scale .button");
                            for (const $input of $scaleInputs)
                                $input.classList.toggle("disabled", !state.scale.enabled);

                            // Update text preview
                            UpdateDrawSettings();
                        }
                    });
                } break;

                case "export": {
                    $.addEventListener("click", e => {
                        // Get the selected export type
                        const $selectedType = document.qs("[data-group='export-type'].selected");
                        const mimeType = $selectedType?.dataset.value || "image/png";

                        // Get the filename input
                        const $filenameInput = document.qs("input[name='export-file-name']");
                        let filename = $filenameInput?.value?.trim();

                        // Generate default filename if none provided
                        if (!filename) {
                            const now = new Date();
                            const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
                            filename = `seqr-export-${timestamp}`;
                        }

                        // Get file extension from mime type
                        let extension;
                        switch (mimeType) {
                            case "image/png": extension = "png"; break;
                            case "image/jpeg": extension = "jpg"; break;
                            case "image/webp": extension = "webp"; break;
                            case "image/svg+xml": extension = "svg"; break;
                            default: extension = "png";
                        }

                        // Ensure filename has the correct extension
                        if (!filename.toLowerCase().endsWith(`.${extension}`))
                            filename = `${filename}.${extension}`;

                        // Get the SVG content
                        const $svg = document.qs("#content > svg");
                        if (!$svg) {
                            console.error("No SVG content found to export");
                            return;
                        }

                        if (mimeType === "image/svg+xml") {
                            // Direct SVG export
                            const svgData = new XMLSerializer().serializeToString($svg);
                            const svgBlob = new Blob([ svgData ], { type: "image/svg+xml" });
                            DownloadFile(svgBlob, filename);
                        } else {
                            // Convert SVG to high-quality raster image
                            const svgData = new XMLSerializer().serializeToString($svg);
                            const $paper = document.createElement("canvas");
                            const pen = $paper.getContext("2d");
                            const img = new Image();

                            img.onload = () => {
                                // Get SVG viewBox to determine aspect ratio
                                const viewBox = $svg.getAttribute("viewBox");
                                let svgWidth = 1000, svgHeight = 1000; // Default fallback

                                if (viewBox) {
                                    const [ , , w, h ] = viewBox.split(" ").map(Number);
                                    if (w && h) {
                                        svgWidth = w;
                                        svgHeight = h;
                                    }
                                }

                                // Determine export size based on visualization complexity
                                const hasText = $svg.querySelector("text") !== null;
                                const textCount = $svg.querySelectorAll("text").length;
                                const complexityScale = Math.max(1, Math.sqrt(textCount / 5)); // Scale with text density

                                const baseScale = hasText ? Math.max(4, Math.min(8, 4 + complexityScale)) : 4;
                                const minWidth = hasText ? Math.max(1200, 800 + textCount * 50) : 1200;

                                const aspectRatio = svgHeight / svgWidth;
                                const baseWidth = Math.max(svgWidth * 1.5, minWidth);

                                $paper.width = baseWidth * baseScale;
                                $paper.height = baseWidth * aspectRatio * baseScale;

                                // Scale the drawing context for high-resolution
                                pen.scale(baseScale, baseScale);

                                // Set high-quality rendering
                                pen.imageSmoothingEnabled = true;
                                pen.imageSmoothingQuality = "high";

                                // Draw the image
                                pen.drawImage(img, 0, 0, baseWidth, baseWidth * aspectRatio);

                                $paper.toBlob(blob => {
                                    if (blob) DownloadFile(blob, filename);
                                    else console.error("Failed to convert SVG to image");
                                }, mimeType, 0.98); // Highest quality setting
                            };

                            img.onerror = () => {
                                console.error("Failed to load SVG for conversion");
                            };

                            // Create SVG with explicit dimensions for better image conversion
                            const parser = new DOMParser();
                            const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
                            const svgElement = svgDoc.documentElement;

                            // Set explicit width and height on the SVG for conversion
                            const viewBox = svgElement.getAttribute("viewBox");
                            if (viewBox) {
                                const [ , , w, h ] = viewBox.split(" ").map(Number);
                                if (w && h) {
                                    svgElement.setAttribute("width", w);
                                    svgElement.setAttribute("height", h);
                                }
                            }

                            const modifiedSvgData = new XMLSerializer().serializeToString(svgElement);
                            const svgBlob = new Blob([ modifiedSvgData ], { type: "image/svg+xml" });
                            img.src = URL.createObjectURL(svgBlob);
                        }

                        function DownloadFile(blob, filename) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = filename;
                            a.style.display = "none";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }

                        // Clear the filename input after export
                        if ($filenameInput)
                            $filenameInput.value = "";
                    });
                } break;
            }
        }

        delete $.dataset.events;
    });

    document.qsa(".auto-scroll").forEach($ => {
        let speed = parseFloat($.dataset.scrollSpeed) || 3;
        let carry = (parseFloat($.dataset.scrollCarry) || 0) + speed;

        speed = Math.floor(carry);
        $.dataset.scrollCarry = carry - speed;

        let $scrolls = $.qsa(".scroll-text").length;
        if ($scrolls === 0) {
            const content = $.innerHTML;
            $.innerHTML = "";

            $.create("span", {
                class: "scroll-text",
                html: content
            }, { end: true });
            $scrolls = 1;
        }

        const $scroll = $.qs(".scroll-text");
        const cs = getComputedStyle($scroll);

        const textWidth = $scroll.clientWidth + ((parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0));
        const containerWidth = $.clientWidth;

        if (textWidth < containerWidth)
            return $.qsa(".scroll-text:not(:first-child)").forEach($el => $el.remove());

        const min = Math.ceil(containerWidth / textWidth) + 1;
        const n = min - $scrolls;
        if (n > 0) $scroll.duplicate(n);
        else if (n < 0) {
            const $scrollTexts = $.qsa(".scroll-text");
            for (let i = 0; i < -n; i++)
                $scrollTexts[i]?.remove?.();
        }

        const targetPos = Date.now() / 1000 * TPS * speed % textWidth;
        $.scrollLeft = targetPos;

        const scroll = ($, dist, time) => {
            SmoothScroll($, dist, time, (el, pos) => {
                const loopLen = textWidth;
                if (pos >= loopLen) {
                    el.scrollLeft = pos % loopLen;
                    return false;
                }
                return true;
            }).then(([ rDist, rTime ]) => {
                if (rDist > 0)
                    scroll($, rDist, rTime); // continue scrolling with the remaining distance and time
            });
        };

        scroll($, speed, SPT * 1000);
    });

    document.qs("#top-bar > .button-plus.remove-files").classList.toggle("disabled", Object.keys(global.files ?? {}).length === 0);
    document.qs("#top-bar > .button-plus.view-files").classList.toggle("disabled", document.qs("#top-bar > .file-list > .file.selected") === null);

    document.qs("#top-bar > .button-plus.draw").classList.toggle("disabled", AllEmptyGroups());
    document.qs("#top-bar > .button-plus.export").classList.toggle("disabled", !global.hasDrawn);

    document.qs("#side-bar > .content").classList.toggle("no-files", Object.keys(global.files ?? {}).length === 0);

    document.qs("#side-bar > .bottom > .button-plus.clean-groups").classList.toggle("disabled", !CanCleanGroups());
    document.qs("#side-bar > .bottom > .button-plus.delete-groups").classList.toggle("disabled", Object.keys(global.groups ?? {}).length === 0);

    document.qs("#side-bar > .bottom > .button-plus.auto-group").classList.toggle("disabled", Object.keys(global.files ?? {}).length === 0);

    { // Update tooltip or title to show behavior
        const selectedFiles = document.qsa("#top-bar > .file-list > .file.selected").length;
        const selectedGroups = document.qsa("#side-bar > .content > .group.selected").length;

        const fileText = new Text("file").plural().case().get(selectedFiles);
        const groupText = new Text("group").plural().case().get(selectedGroups);

        // Auto-group button
        const $autoGroupButton = document.qs("#side-bar > .bottom > .button-plus.auto-group");
        if (selectedFiles > 0)
            $autoGroupButton.title = `Auto-group ${selectedFiles} selected ${fileText}`;
        else $autoGroupButton.title = "Auto-group all files";

        // Remove files button
        const $removeFilesButton = document.qs("#top-bar > .button-plus.remove-files");
        if (selectedFiles > 0)
            $removeFilesButton.title = `Remove ${selectedFiles} selected ${fileText}`;
        else $removeFilesButton.title = "Remove all files";

        // View files button
        const $viewFilesButton = document.qs("#top-bar > .button-plus.view-files");
        if (selectedFiles > 0)
            $viewFilesButton.title = `View ${selectedFiles} selected ${fileText}`;
        else $viewFilesButton.title = "View selected files";

        // Clean groups button
        const $cleanGroupsButton = document.qs("#side-bar > .bottom > .button-plus.clean-groups");
        if (selectedGroups > 0)
            $cleanGroupsButton.title = `Delete ${selectedGroups} selected empty and duplicate ${groupText}`;
        else $cleanGroupsButton.title = "Delete all empty and duplicate groups";

        // Delete groups button
        const $deleteGroupsButton = document.qs("#side-bar > .bottom > .button-plus.delete-groups");
        if (selectedGroups > 0)
            $deleteGroupsButton.title = `Delete ${selectedGroups} selected ${groupText}`;
        else $deleteGroupsButton.title = "Delete all groups";
    }

    document.qsa(".button-plus.disabled > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click()); // close all open button-plus menus

    // Check clipboard availability and update paste functionality
    CheckClipboardAvailability().then(async (isAvailable) => {
        if (isAvailable) {
            const text = await readFromClipboard();
            if (text !== null) {
                global.pasteText = text;

                const types = [];
                if (/^#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(text))
                    types.push("hexadecimal");

                document.qsa("[data-paste]").forEach($ => $.classList.add("disabled"));
                for (const type of types)
                    document.qsa(`[data-paste="${type}"]`).forEach($ => $.classList.remove("disabled"));
            } else // Disable all paste buttons if can't read clipboard
                document.qsa("[data-paste]").forEach($ => $.classList.add("disabled"));
        } else {
            // Disable all copy and paste buttons if clipboard is not available
            document.qsa("[data-paste]").forEach($ => $.classList.add("disabled"));
            document.qsa("[data-events*='copy']").forEach($ => $.classList.add("disabled"));
        }
    });

    if (window.location.hash === "#load") {
        // clear the hash to prevent reloading
        window.location.hash = "";

        const build = (name, txt) => {
            const file = new File(
                [ new Blob([ txt ], { type: "text/plain" }) ],
                name,
                { type: "text/plain", lastModified: Date.now() }
            );

            ReadFile(file)
                .then(res => {
                    if (res?.fileName && res?.element) {
                        undoRedoManager.executeAction(Actions.importFile(
                            res.fileName,
                            res.element
                        ));
                    }
                })
                .catch(res => console.error(`Failed to load text file: ${name} - ${red.error}`));
        }

        build(
            "showcase_gff.gff3",
`##gff-version 3
chr1	Ensembl	gene	1000	5000	.	+	.	ID=gene1;Name=ExampleGene
chr1	Ensembl	mRNA	1000	5000	.	+	.	ID=transcript1;Parent=gene1;Name=TranscriptA
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon1;Parent=transcript1
chr1	Ensembl	CDS	1050	1200	.	+	0	ID=cds1;Parent=transcript1
chr1	Ensembl	UTR	1000	1049	.	+	.	ID=utr1;Parent=transcript1

chr1	Ensembl	exon	1300	1500	.	+	.	ID=exon2;Parent=transcript1
chr1	Ensembl	CDS	1300	1500	.	+	0	ID=cds2;Parent=transcript1

chr1	Ensembl	exon	2000	2500	.	+	.	ID=exon3;Parent=transcript1
chr1	Ensembl	CDS	2000	2400	.	+	2	ID=cds3;Parent=transcript1
chr1	Ensembl	UTR	2401	2500	.	+	.	ID=utr2;Parent=transcript1

chr1	Ensembl	mRNA	1000	2600	.	+	.	ID=transcript2;Parent=gene1;Name=TranscriptB
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon4;Parent=transcript2
chr1	Ensembl	CDS	1100	1200	.	+	0	ID=cds4;Parent=transcript2

chr1	Ensembl	exon	1400	1600	.	+	.	ID=exon5;Parent=transcript2
chr1	Ensembl	CDS	1400	1600	.	+	0	ID=cds5;Parent=transcript2

chr1	Ensembl	exon	2600	3000	.	+	.	ID=exon6;Parent=transcript2
chr1	Ensembl	CDS	2600	2900	.	+	0	ID=cds6;Parent=transcript2
chr1	Ensembl	UTR	2901	3000	.	+	.	ID=utr3;Parent=transcript2`
        );

        build(
            "showcase_bed.bed",
`chr1	999	5000	gene1_transcript1	0	+	1050	2400	0,0,255	3	201,201,501	0,300,1000
chr1	999	3000	gene1_transcript2	0	+	1100	2900	0,128,0	3	201,201,400	0,400,1600
chr1	1000	4000	gene2_transcript1	0	-	1200	3800	255,0,0	2	500,600	0,2400
chr1	1500	4200	gene2_transcript2	0	-	1600	4000	255,165,0	3	300,400,500	0,900,2100`
        );

        build(
            "showcase_gtf.gtf",
`##gtf-version 2.5
##genome-build GRCh38
##annotation-source Ensembl
chr1	Ensembl	gene	1000	5000	.	+	.	gene_id "ENSG00000001"; gene_name "EXAMPLE1"; gene_biotype "protein_coding";
chr1	Ensembl	transcript	1000	5000	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; transcript_name "EXAMPLE1-001"; transcript_biotype "protein_coding";
chr1	Ensembl	exon	1000	1200	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1"; exon_id "ENSE00000001";
chr1	Ensembl	CDS	1050	1200	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1"; protein_id "ENSP00000001";
chr1	Ensembl	start_codon	1050	1052	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1";
chr1	Ensembl	exon	1400	1600	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "2"; exon_id "ENSE00000002";
chr1	Ensembl	CDS	1400	1600	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "2"; protein_id "ENSP00000001";
chr1	Ensembl	exon	2000	2500	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3"; exon_id "ENSE00000003";
chr1	Ensembl	CDS	2000	2400	.	+	2	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3"; protein_id "ENSP00000001";
chr1	Ensembl	stop_codon	2401	2403	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3";`
        );

        build(
            "showcase_vcf.vcf",
`##fileformat=VCFv4.3
##reference=GRCh38
##contig=<ID=chr1,length=248956422>
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	Sample1
chr1	1500	rs123456	A	G	60	PASS	DP=30;AF=0.5	GT:DP	0/1:25
chr1	2200	.	C	T	45	PASS	DP=20;AF=0.3	GT:DP	0/1:18
chr1	3800	rs789012	G	A,C	80	PASS	DP=40;AF=0.4,0.1	GT:DP	1/2:35
chr1	4500	.	ATCG	A	35	PASS	DP=15;AF=0.6	GT:DP	1/1:12`
        );

        build(
            "showcase_bedgraph.bedgraph",
`track type=bedGraph name="Coverage Signal" description="Sequencing coverage depth"
chr1	1000	1100	15.5
chr1	1100	1200	22.3
chr1	1200	1400	18.7
chr1	1400	1600	45.2
chr1	1600	1800	38.9
chr1	1800	2000	12.1
chr1	2000	2200	55.8
chr1	2200	2400	67.3
chr1	2400	2600	42.6
chr1	2600	2800	29.4
chr1	2800	3000	33.7
chr1	3000	3200	51.2
chr1	3200	3400	28.8
chr1	3400	3600	41.5
chr1	3600	3800	36.2
chr1	3800	4000	19.6
chr1	4000	4200	24.3
chr1	4200	4400	47.9
chr1	4400	4600	52.1
chr1	4600	4800	31.8
chr1	4800	5000	26.7`
        );

        build(
            "showcase_sam.sam",
`@HD	VN:1.6	SO:coordinate
@SQ	SN:chr1	LN:248956422
@RG	ID:sample1	SM:sample1	PL:ILLUMINA
@PG	ID:bwa	PN:bwa	VN:0.7.17
read001	99	chr1	1150	60	100M	=	1350	300	ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read002	147	chr1	1350	60	100M	=	1150	-300	TGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCA	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read003	0	chr1	2100	60	75M25S	*	0	0	GGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCATCGATCGATCGATCGATCG	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII#####################
read004	16	chr1	2300	55	50M50H	*	0	0	AAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGG	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read005	0	chr1	3500	60	100M	*	0	0	CGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAT	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII`
        );

        build(
            "showcase_fasta.fasta",
`>chr1:1000-2000 example genomic sequence
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCT
TATATATATATATATATATATATATATATATATATATATATATATATA
CGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCG
AAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAA
TTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTT
ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAC
TGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATG
GGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGG
CCTTAACCCCTTAACCCCTTAACCCCTTAACCCCTTAACCCCTTAACCCC
AAAAGGGGCCCCTTTTAAAAGGGGCCCCTTTTAAAAGGGGCCCCTTTTAA
TTTTAAAACCCCGGGGTTTTAAAACCCCGGGGTTTTAAAACCCCGGGGTT
GGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGG
CCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCC
AAAATTTTGGGGCCCCAAAATTTTGGGGCCCCAAAATTTTGGGGCCCCAA
TTTTCCCCAAAATTTTCCCCAAAATTTTCCCCAAAATTTTCCCCAAAATT
GGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGG
AACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAA
TTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATT
CCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCC
>gene_region exon sequence with coding potential
ATGTCCAAAGGTCCTGAGTTTGACCCTAAGAAGTCTATCGGCCTGGACC
TGCTGAAGGACCTGTTTGACAAGATGGCCAAGGTGGACCCTGAGGTGAA
GTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAGCTGCTG
GACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGGACCTGA
AAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGGTGGACCCTGAGGT
GAAGTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAGCTG
CTGGACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGGACC
TGAAAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGGTGGACCCTGA
GGTGAAGTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAG
CTGCTGGACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGG
ACCTGAAAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGTAG`
        );
    }

    requestAnimationFrame(update);
}
update();

// Add click-outside-to-close functionality for button-plus elements
document.addEventListener("click", e => {
    // Check if the click was inside any button-plus element
    const $clickedButtonPlus = e.target.closest(".button-plus");

    // If we clicked outside all button-plus elements, close any open ones
    if (!$clickedButtonPlus) {
        document.qsa(".button-plus").forEach($buttonPlus => {
            const $normal = $buttonPlus.qs(".icon .normal");
            const $cancel = $buttonPlus.qs(".icon .cancel");

            // Only close if currently open (cancel is visible)
            if ($cancel && !$cancel.classList.contains("hidden")) {
                $buttonPlus.qsa("div.cycles > div:not(.hidden)").forEach($cycle => $cycle.classList.add("hidden"));
                $normal.classList.remove("hidden");
                $cancel.classList.add("hidden");
            }
        });
    }

    // Mobile side-bar backdrop click handler
    const $sideBar = document.qs("#side-bar");
    const $clickedInsideSideBar = !e.target.closest("#content");

    // Check if we're on mobile/narrow display and side-bar is open
    if (!$clickedInsideSideBar && !$sideBar.classList.contains("collapsed")) {
        const isNarrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;

        if (isNarrow) {
            // Close the side-bar on mobile when clicking outside
            $sideBar.classList.add("collapsed");
            // Also close any open button-plus menus within the side-bar
            $sideBar.qsa(".button-plus > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click());
        }
    }
});

window.addEventListener("load", () => {
    document.body.classList.add("no-transition");

    {
        const $colorSelector = document.qs("#color-selector");
        global.colorSelectorPen = CreateColorSpectrum($colorSelector.qs(".content > .easel > .paper"));

        const $easySelect = $colorSelector.qs(".content > .easy-select");
        const totalRows = 15;

        // No need to create file toggle dynamically since it's now in the HTML

        let otherRows = 0; // No dynamic file-defined option anymore
        const $divs = $easySelect.qsa("div:not(.recent)");
        for (const $div of $divs) {
            const colors = $div.textContent.replace(/\s/g, "").split(",");
            $div.innerHTML = ""; // clear the selector
            for (const color in colors) {
                otherRows += .25;
                const $color = $div.create("div", {
                    class: "color",
                    style: {
                        "--color": colors[color],
                        "--outline": ColorToHex(InverseShade(HexToColor(colors[color])))
                    },
                    dataset: {
                        color: colors[color],
                        events: "color-selector>easy-select>color"
                    },
                    title: `Select color: ${colors[color]}`
                }, { end: true });

                // Add alpha background for semi-transparent colors
                $color.create("div", {
                    class: "alpha-background"
                }, { end: true });
            }
        }

        const recentRows = totalRows - Math.ceil(otherRows);
        const totalRecent = recentRows * 4;
        global.maxRecentColors = totalRecent;
    }

    const isNarrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;
    if (isNarrow) {
        const $sideBar = document.qs("#side-bar");
        // Close the side-bar on mobile when clicking outside
        $sideBar.classList.add("collapsed");
        // Also close any open button-plus menus within the side-bar
        $sideBar.qsa(".button-plus > .icon:has(.cancel:not(.hidden))").forEach($el => $el.click());
    }

    UpdateDrawSettings(0, 100);

    requestAnimationFrame(() => document.body.classList.remove("no-transition"));
    requestAnimationFrame(() => document.body.qs("#loading").classList.add("hidden"));
});

window.addEventListener("click", e => {
    let closest = e.target.closest("[data-multiselect]");
    if (closest)
        document.qsa(`[data-multiselect]:not([data-multiselect="${closest.dataset.multiselect}"]).selected`).forEach($ => $.classList.remove("selected"));
    else {
        closest = e.target.closest("[data-pseudo-multiselect]");
        if (closest) {
            const pseudo = closest.dataset.pseudoMultiselect;
            if (pseudo !== "*")
                document.qsa(`[data-multiselect]:not([data-multiselect="${pseudo}"]).selected`).forEach($ => $.classList.remove("selected"));
        } else {
            document.qsa("[data-multiselect].selected").forEach($ => $.classList.remove("selected"));
            global.lastSelected = null; // reset last selected element
        }
    }
});

window.addEventListener("resize", () => {
    document.body.classList.add("no-transition");

    // Handle group collapse/expand based on screen size
    const isNarrow = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 1/1)").matches;
    const $groups = document.qsa("#side-bar .content > .group");

    if (isNarrow) {
        // Collapse all groups in narrow mode (unless already expanded)
        $groups.forEach($group => {
            if (!$group.classList.contains("expanded")) {
                $group.classList.remove("expanded");
            }
        });
    } else {
        // Expand all groups in wide mode
        $groups.forEach($group => {
            $group.classList.add("expanded");
        });
    }

    requestAnimationFrame(() => document.body.classList.remove("no-transition"));
});

// Global keydown handler for multi-select deletion
document.addEventListener("keydown", e => {
    // Only handle Delete/Backspace keys
    if (e.key !== "Delete" && e.key !== "Backspace") return;

    // Don't interfere if user is typing in an input field
    if (e.target.matches("input, textarea, [contenteditable]")) return;

    // Check for selected files
    const $selectedFiles = document.qsa("#top-bar > .file-list > .file.selected");
    if ($selectedFiles.length > 0) {
        e.preventDefault();
        // Trigger the remove-files functionality
        document.qs("#top-bar > .button-plus.remove-files > .terminus")?.click();
        return;
    }

    // Check for selected groups
    const $selectedGroups = document.qsa("#side-bar > .content > .group.selected");
    if ($selectedGroups.length > 0) {
        e.preventDefault();

        if ($selectedGroups.length === 1) {
            // Single group deletion with undo/redo
            const $group = $selectedGroups[0];
            const name = global.groupElements.get($group);
            if (name && global.groups[name]) {
                const groupData = { ...global.groups[name] };
                undoRedoManager.executeAction(Actions.deleteGroup(name, groupData, $group));
            }
        } else {
            // Multiple group deletion with undo/redo
            const groupsToDelete = [];
            $selectedGroups.forEach($group => {
                const name = global.groupElements.get($group);
                if (name && global.groups[name]) {
                    groupsToDelete.push({
                        name,
                        groupData: { ...global.groups[name] },
                        element: $group,
                        // Store position information for proper restoration
                        nextSibling: $group.nextElementSibling,
                        previousSibling: $group.previousElementSibling
                    });
                }
            });

            if (groupsToDelete.length > 0) {
                undoRedoManager.executeAction({
                    description: `Delete ${groupsToDelete.length} groups`,
                    execute() {
                        groupsToDelete.forEach(({ name, element }) => {
                            if (global.groups[name]) {
                                delete global.groups[name];
                                global.groupElements.delete(element);
                                element.remove();
                            }
                        });
                    },
                    undo() {
                        // Restore groups in reverse order to maintain positions
                        groupsToDelete.reverse().forEach(({ name, groupData, element, nextSibling, previousSibling }) => {
                            global.groups[name] = groupData;

                            // Ensure the element reference is properly set
                            global.groups[name].element = element;

                            global.groupElements.set(element, name);

                            // Re-insert the element at its original position
                            const $content = document.qs("#side-bar > .content");

                            if (nextSibling && nextSibling.parentNode === $content) {
                                $content.insertBefore(element, nextSibling);
                            } else if (previousSibling && previousSibling.parentNode === $content) {
                                previousSibling.insertAdjacentElement('afterend', element);
                            } else {
                                $content.appendChild(element);
                            }
                        });
                        // Restore original order
                        groupsToDelete.reverse();
                    }
                });
            }
        }

        // Update UI state
        update();
        return;
    }
});

// Initialize clipboard availability check when the page loads
document.addEventListener("DOMContentLoaded", () => {
    // Restore saved sidebar width
    const savedSidebarWidth = localStorage.getItem("SeqR:sidebar-width");
    if (savedSidebarWidth) {
        document.body.style.setProperty("--side-bar-size", savedSidebarWidth);
    }

    // Initialize scale settings
    const $scaleCheckbox = document.qs("#draw-settings\\>scale-enabled");
    if ($scaleCheckbox && $scaleCheckbox.checked) {
        const $section = document.qs("#draw-settings .section.scale");
        $section.classList.add("enabled");

        // Enable scale settings since checkbox is checked by default
        const $inputs = $section.qsa("input[type='number'], .button");
        for (const $input of $inputs)
            $input.classList.remove("disabled");
    }

    // Delay clipboard check to ensure page is fully loaded
    setTimeout(() => {
        CheckClipboardAvailability();
    }, 1000);
});

// Also check clipboard availability when the window gains focus
window.addEventListener("focus", () => {
    // Reset test completion to re-check when window gains focus
    clipboardTestCompleted = false;
    CheckClipboardAvailability();
});