import "../../prototype/HTML.js";
import { global } from "./global.js";
import { CreateNotification } from "./notification.js";
import { ChangeGroupName } from "./groups.js";

/**
 * File Reference Manager for soft-delete functionality
 * Allows files to be "deleted" but recoverable for undo operations
 */
class FileReferenceManager {
    constructor() {
        this.softDeletedFiles = new Map(); // fileKey -> { data, timestamp, storageKey }
        this.maxRetentionTime = 5 * 60 * 1000; // 5 minutes
        this.storagePrefix = "seqr_deleted_";

        // Cleanup old soft-deleted files periodically
        setInterval(() => this.cleanup(), 60000); // Every minute
    }

    /**
     * Create a lightweight reference for a file
     */
    createReference(fileKey, fileData) {
        return {
            fileName: fileData.fileName,
            type: fileData.type,
            size: fileData.size,
            lastModified: fileData.lastModified,
            isProxy: fileData.constructor?.name === "FileDataProxy" || fileData.constructor?.name === "ChunkedFileDataProxy",
            fileId: fileData.fileId
        };
    }

    /**
     * Move a file to soft-deleted state
     */
    async softDeleteFile(fileKey, fileData) {
        const timestamp = Date.now();
        const storageKey = `${this.storagePrefix}${fileKey}_${timestamp}`;

        console.log(`Soft-deleting file: ${fileKey}`, {
            constructor: fileData.constructor?.name,
            hasFileId: !!fileData.fileId,
            hasIsDataLoaded: typeof fileData.isDataLoaded === "function",
            hasGetDataIfLoaded: typeof fileData.getDataIfLoaded === "function"
        });

        // Check if this is a proxy object with data management methods
        const isProxy = fileData.constructor?.name === "FileDataProxy" ||
                       fileData.constructor?.name === "ChunkedFileDataProxy" ||
                       typeof fileData.isDataLoaded === "function";

        if (isProxy) {
            // For proxy objects, preserve the proxy and don't delete IndexedDB data yet
            this.softDeletedFiles.set(fileKey, {
                fileData,
                timestamp,
                storageKey,
                isProxy: true
            });
        } else {
            // For regular file objects, store the entire data
            this.softDeletedFiles.set(fileKey, {
                fileData,
                timestamp,
                storageKey,
                isProxy: false
            });
        }

        console.log(`Soft-deleted files count: ${this.softDeletedFiles.size}`);
    }

    /**
     * Restore a file from soft-deleted state
     */
    async restoreFile(fileKey, fileReference) {
        const softDeleted = this.softDeletedFiles.get(fileKey);
        if (!softDeleted) {
            console.warn(`Cannot restore file ${fileKey}: not found in soft-deleted files`);
            return null;
        }

        console.log(`Restoring file: ${fileKey}`);

        // Remove from soft-deleted state
        this.softDeletedFiles.delete(fileKey);

        // Return the original file data
        return softDeleted.fileData;
    }

    /**
     * Permanently delete files that are past retention time
     */
    async cleanup() {
        const now = Date.now();
        const toDelete = [];

        for (const [fileKey, info] of this.softDeletedFiles) {
            if (now - info.timestamp > this.maxRetentionTime) {
                toDelete.push(fileKey);
            }
        }

        for (const fileKey of toDelete) {
            const info = this.softDeletedFiles.get(fileKey);
            if (info?.isProxy && info.fileData?.deleteFileData) {
                // Now actually delete the IndexedDB data
                try {
                    await info.fileData.deleteFileData();
                } catch (error) {
                    console.warn(`Failed to delete IndexedDB data for ${fileKey}:`, error);
                }
            }
            this.softDeletedFiles.delete(fileKey);
        }

        if (toDelete.length > 0) {
            console.log(`Cleaned up ${toDelete.length} expired soft-deleted files`);
        }
    }

    /**
     * Force cleanup of all soft-deleted files (for app shutdown, etc.)
     */
    async forceCleanup() {
        for (const [fileKey, info] of this.softDeletedFiles) {
            if (info?.isProxy && info.fileData?.deleteFileData) {
                try {
                    await info.fileData.deleteFileData();
                } catch (error) {
                    console.warn(`Failed to delete IndexedDB data for ${fileKey}:`, error);
                }
            }
        }
        this.softDeletedFiles.clear();
    }
}

// Create global instance
const fileReferenceManager = new FileReferenceManager();

/**
 * Undo/Redo system for SeqR application
 * Manages a stack of undoable actions with their reverse operations
 */
class UndoRedoManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 100; // Limit history to prevent memory issues
    }

    /**
     * Execute an action and add it to the undo stack
     * @param {Object} action - Action object with execute, undo, and description properties
     */
    executeAction(action) {
        if (!action || typeof action.execute !== "function" || typeof action.undo !== "function") {
            console.error("Invalid action: must have execute and undo functions");
            return false;
        }

        try {
            // Execute the action
            action.execute();

            // Add to undo stack
            this.undoStack.push(action);

            // Clear redo stack since we"re creating a new branch
            this.redoStack = [];

            // Limit stack size
            if (this.undoStack.length > this.maxHistorySize)
                this.undoStack.shift();

            this.updateUI();
            return true;
        } catch (error) {
            console.error("Failed to execute action:", error);
            return false;
        }
    }

    /**
     * Undo the last action
     */
    undo() {
        if (this.undoStack.length === 0) return false;

        const action = this.undoStack.pop();
        try {
            action.undo();
            this.redoStack.push(action);
            this.updateUI();

            CreateNotification(`Undo: ${action.description}`, "var(--notification-blue)");

            // Handle sidebar-related actions
            this.handleSidebarAction(action);

            return true;
        } catch (error) {
            console.error("Failed to undo action:", error);
            // Put the action back if undo failed
            this.undoStack.push(action);
            return false;
        }
    }

    /**
     * Redo the last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return false;

        const action = this.redoStack.pop();
        try {
            action.execute();
            this.undoStack.push(action);
            this.updateUI();

            CreateNotification(`Redo: ${action.description}`, "var(--notification-green)");

            // Handle sidebar-related actions
            this.handleSidebarAction(action);

            return true;
        } catch (error) {
            console.error("Failed to redo action:", error);
            // Put the action back if redo failed
            this.redoStack.push(action);
            return false;
        }
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get the description of the next action to undo
     */
    getUndoDescription() {
        if (this.undoStack.length === 0) return null;
        return this.undoStack[this.undoStack.length - 1].description;
    }

    /**
     * Get the description of the next action to redo
     */
    getRedoDescription() {
        if (this.redoStack.length === 0) return null;
        return this.redoStack[this.redoStack.length - 1].description;
    }

    /**
     * Handle sidebar-related actions by opening sidebar and scrolling to updated elements
     */
    handleSidebarAction(action) {
        // Check if this is a sidebar-related action
        const sidebarKeywords = ["group", "Group", "Clean", "Auto group"];
        const isSidebarAction = sidebarKeywords.some(keyword =>
            action.description.includes(keyword)
        );

        if (!isSidebarAction) return;

        // Open sidebar if collapsed
        const $sideBar = document.qs("#side-bar");
        if ($sideBar?.classList.contains("collapsed")) {
            $sideBar.classList.remove("collapsed");
        }

        // Small delay to ensure DOM updates are complete before scrolling
        requestAnimationFrame(() => {
            this.scrollToRelevantElement(action);
        });
    }

    /**
     * Scroll to the relevant element based on the action type
     */
    scrollToRelevantElement(action) {
        const $content = document.qs("#side-bar > .content");
        if (!$content) return;

        let $targetElement = null;

        // Extract group name from action description for specific group actions
        if (action.description.includes("Create group")) {
            const match = action.description.match(/Create group "([^"]+)"/);
            if (match) {
                const groupName = match[1];
                const group = global.groups[groupName];
                $targetElement = group?.element;
            }
        } else if (action.description.includes("Delete group")) {
            const match = action.description.match(/Delete group "([^"]+)"/);
            if (match) {
                const groupName = match[1];
                const group = global.groups[groupName];
                $targetElement = group?.element;
            }
        } else if (action.description.includes("Rename group")) {
            // For rename actions, find the group element by looking for either old or new name
            const matches = action.description.match(/Rename group "([^"]+)" to "([^"]+)"/);
            if (matches) {
                const [, oldName, newName] = matches;
                // Try to find by new name first (after undo/redo), then old name
                let group = global.groups[newName] || global.groups[oldName];
                $targetElement = group?.element;
            }
        } else if (action.description.includes("Clean") || action.description.includes("Auto group")) {
            // For batch operations, scroll to the first group
            const firstGroup = document.qs("#side-bar > .content > .group");
            $targetElement = firstGroup;
        }

        // Scroll to the target element
        if ($targetElement) {
            $targetElement.scrollIntoView({
                block: "center",
                inline: "nearest",
                behavior: "smooth"
            });
        } else {
            // If no specific element found, scroll to top of content
            $content.scrollIntoView({
                block: "start",
                inline: "nearest",
                behavior: "smooth"
            });
        }
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.updateUI();
    }

    /**
     * Update UI elements that depend on undo/redo state
     */
    updateUI() {
        // Update undo button
        const $undoButton = document.qs("[data-events*=\"undo\"]");
        if ($undoButton) {
            $undoButton.classList.toggle("disabled", !this.canUndo());
            $undoButton.title = this.canUndo()
                ? `Undo: ${this.getUndoDescription()}`
                : "Nothing to undo";
        }

        // Update redo button
        const $redoButton = document.qs("[data-events*=\"redo\"]");
        if ($redoButton) {
            $redoButton.classList.toggle("disabled", !this.canRedo());
            $redoButton.title = this.canRedo()
                ? `Redo: ${this.getRedoDescription()}`
                : "Nothing to redo";
        }
    }
}

/**
 * Separate undo/redo manager specifically for color selector operations
 * This runs in isolation when the color selector is open
 */
class ColorSelectorUndoRedoManager extends UndoRedoManager {
    constructor() {
        super();
        this.isActive = false;
        this.originalUndoRedoManager = null;
    }

    /**
     * Activate the color selector undo/redo system
     */
    activate(originalManager) {
        this.isActive = true;
        this.originalUndoRedoManager = originalManager;
        this.undoStack = [];
        this.redoStack = [];
        this.updateUI();
    }

    /**
     * Deactivate and clear the color selector undo/redo system
     */
    deactivate() {
        this.isActive = false;
        this.undoStack = [];
        this.redoStack = [];
        this.originalUndoRedoManager = null;
        // Restore main undo/redo UI
        if (this.originalUndoRedoManager) {
            this.originalUndoRedoManager.updateUI();
        }
    }

    /**
     * Override updateUI to handle color selector specific buttons
     */
    updateUI() {
        if (!this.isActive) return;

        // Update main undo/redo buttons to show color selector state
        const $undoButton = document.qs("[data-events*=\"undo\"]");
        const $redoButton = document.qs("[data-events*=\"redo\"]");

        if ($undoButton) {
            $undoButton.classList.toggle("disabled", this.undoStack.length === 0);
            $undoButton.title = this.undoStack.length > 0
                ? `Undo color change: ${this.undoStack[this.undoStack.length - 1].description}`
                : "Nothing to undo";
        }

        if ($redoButton) {
            $redoButton.classList.toggle("disabled", this.redoStack.length === 0);
            $redoButton.title = this.redoStack.length > 0
                ? `Redo color change: ${this.redoStack[this.redoStack.length - 1].description}`
                : "Nothing to redo";
        }
    }
}

// Create global instance
const undoRedoManager = new UndoRedoManager();
const colorSelectorUndoRedoManager = new ColorSelectorUndoRedoManager();

/**
 * Separate undo/redo manager specifically for data selector operations
 * This runs in isolation when the data selector is open
 */
class DataSelectorUndoRedoManager extends UndoRedoManager {
    constructor() {
        super();
        this.isActive = false;
        this.originalUndoRedoManager = null;
        this.currentTab = null; // Track which file tab the operation belongs to
    }

    /**
     * Activate the data selector undo/redo system
     */
    activate(originalManager) {
        this.isActive = true;
        this.originalUndoRedoManager = originalManager;
        this.undoStack = [];
        this.redoStack = [];
        this.currentTab = null;
        this.updateUI();
    }

    /**
     * Deactivate and clear the data selector undo/redo system
     */
    deactivate() {
        this.isActive = false;
        this.undoStack = [];
        this.redoStack = [];
        this.originalUndoRedoManager = null;
        this.currentTab = null;
        // Restore main undo/redo UI
        if (this.originalUndoRedoManager) {
            this.originalUndoRedoManager.updateUI();
        }
    }

    /**
     * Set the current tab for tracking which file operations belong to
     */
    setCurrentTab(tabElement) {
        this.currentTab = tabElement;
    }

    /**
     * Execute an action and automatically switch to the associated tab during undo/redo
     */
    executeActionWithTab(action, tabElement) {
        // Store the tab reference with the action
        const wrappedAction = {
            ...action,
            tabElement: tabElement,
            originalExecute: action.execute,
            originalUndo: action.undo,
            execute() {
                // Switch to the associated tab if not already selected
                if (this.tabElement && !this.tabElement.classList.contains("selected")) {
                    // Deselect current tab
                    this.tabElement.parentElement?.qsa(".file.selected").forEach($el => $el.classList.remove("selected"));
                    // Select the target tab
                    this.tabElement.classList.add("selected");
                    // Load the tab content will be handled by the original execute
                }
                return this.originalExecute();
            },
            undo() {
                // Switch to the associated tab if not already selected
                if (this.tabElement && !this.tabElement.classList.contains("selected")) {
                    // Deselect current tab
                    this.tabElement.parentElement?.qsa(".file.selected").forEach($el => $el.classList.remove("selected"));
                    // Select the target tab
                    this.tabElement.classList.add("selected");
                    // Load the tab content will be handled by the original undo
                }
                return this.originalUndo();
            }
        };

        this.executeAction(wrappedAction);
    }

    /**
     * Override updateUI to handle data selector specific buttons
     */
    updateUI() {
        if (!this.isActive) return;

        // Update main undo/redo buttons to show data selector state
        const $undoButton = document.qs("[data-events*=\"undo\"]");
        const $redoButton = document.qs("[data-events*=\"redo\"]");

        if ($undoButton) {
            $undoButton.classList.toggle("disabled", this.undoStack.length === 0);
            $undoButton.title = this.undoStack.length > 0
                ? `Undo data selection: ${this.undoStack[this.undoStack.length - 1].description}`
                : "Nothing to undo";
        }

        if ($redoButton) {
            $redoButton.classList.toggle("disabled", this.redoStack.length === 0);
            $redoButton.title = this.redoStack.length > 0
                ? `Redo data selection: ${this.redoStack[this.redoStack.length - 1].description}`
                : "Nothing to redo";
        }
    }
}

const dataSelectorUndoRedoManager = new DataSelectorUndoRedoManager();

// Keyboard shortcuts
document.addEventListener("keydown", e => {
    // Don't interfere if user is typing in an input field
    if (e.target.matches("input, textarea, [contenteditable]")) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        // Route to appropriate undo/redo manager based on active state
        if (colorSelectorUndoRedoManager.isActive) {
            colorSelectorUndoRedoManager.undo();
        } else if (dataSelectorUndoRedoManager.isActive) {
            dataSelectorUndoRedoManager.undo();
        } else {
            undoRedoManager.undo();
        }
    } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") ||
               ((e.ctrlKey || e.metaKey) && e.key === "y")) {
        e.preventDefault();
        // Route to appropriate undo/redo manager based on active state
        if (colorSelectorUndoRedoManager.isActive) {
            colorSelectorUndoRedoManager.redo();
        } else if (dataSelectorUndoRedoManager.isActive) {
            dataSelectorUndoRedoManager.redo();
        } else {
            undoRedoManager.redo();
        }
    }
});

// Action factory functions for common operations
export const Actions = {
    /**
     * Create an action for creating a group
     */
    createGroup(groupName, groupElement) {
        return {
            description: `Create group "${groupName}"`,
            execute() {
                // This will be called by the existing CreateGroup function
                // The group creation has already happened, just store references
            },
            undo() {
                const name = global.groupElements.get(groupElement);
                if (name && global.groups[name]) {
                    delete global.groups[name];
                    global.groupElements.delete(groupElement);
                    groupElement.remove();
                }
            }
        };
    },

    /**
     * Create an action for deleting a group
     */
    deleteGroup(groupName, groupData, groupElement) {
        // Store the original position in the sidebar content
        const $content = document.qs("#side-bar > .content");
        const nextSibling = groupElement.nextElementSibling;
        const previousSibling = groupElement.previousElementSibling;

        return {
            description: `Delete group "${groupName}"`,
            execute() {
                if (global.groups[groupName]) {
                    delete global.groups[groupName];
                    global.groupElements.delete(groupElement);
                    groupElement.remove();
                }
            },
            undo() {
                // Recreate the group
                global.groups[groupName] = groupData;
                global.groupElements.set(groupElement, groupName);

                // Re-insert the element at its original position
                const $content = document.qs("#side-bar > .content");
                if (nextSibling && nextSibling.parentNode === $content) {
                    // Insert before the next sibling
                    $content.insertBefore(groupElement, nextSibling);
                } else if (previousSibling && previousSibling.parentNode === $content) {
                    // Insert after the previous sibling
                    previousSibling.insertAdjacentElement('afterend', groupElement);
                } else {
                    // If no siblings found (or they were also removed), append at the end
                    $content.appendChild(groupElement);
                }
            }
        };
    },

    /**
     * Create an action for renaming a group
     */
    renameGroup(oldName, newName, groupElement) {
        // We need to track the actual final name that ChangeGroupName will use
        // since it might resolve conflicts by appending numbers
        let actualNewName = null;

        return {
            get description() {
                // Dynamic description that updates after we know the actual name
                if (actualNewName) {
                    return `Rename group "${oldName}" to "${actualNewName}"`;
                }
                return `Rename group "${oldName}" to "${newName}"`;
            },
            execute() {
                // Use ChangeGroupName to handle name conflicts properly
                ChangeGroupName(oldName, newName);
                // After calling ChangeGroupName, get the actual name that was used
                actualNewName = global.groupElements.get(groupElement);
            },
            undo() {
                // Rename back to the original name
                if (actualNewName) {
                    ChangeGroupName(actualNewName, oldName);
                    actualNewName = null; // Reset for potential redo
                }
            }
        };
    },

    /**
     * Create an action for adding a member to a group
     */
    addGroupMember(groupName, member, color) {
        return {
            description: `Add member to group "${groupName}"`,
            execute() {
                const group = global.groups[groupName];
                if (group) {
                    group.members.push({ member, color });
                    // The UI update will be handled by the calling function
                }
            },
            undo() {
                const group = global.groups[groupName];
                if (group) {
                    const index = group.members.findIndex(m =>
                        JSON.stringify(m.member) === JSON.stringify(member)
                    );
                    if (index !== -1) {
                        group.members.splice(index, 1);
                        // Remove the member element from UI
                        const $group = group.element;
                        const $member = $group.qs(`.member[data-member="${member.join("|")}"]`);
                        if ($member) $member.remove();
                    }
                }
            }
        };
    },

    /**
     * Create an action for removing a file
     */
    removeFile(fileKey, fileData, fileElement) {
        // Store the file data in a soft-deleted state that can be recovered
        const fileReference = fileReferenceManager.createReference(fileKey, fileData);

        // Store the original position in the file list
        const $fileList = document.qs("#top-bar > .file-list");
        const nextSibling = fileElement.nextElementSibling;
        const previousSibling = fileElement.previousElementSibling;

        return {
            description: `Remove file "${fileKey}"`,
            async execute() {
                if (global.files[fileKey]) {
                    // Move to soft-deleted state instead of immediate destruction
                    await fileReferenceManager.softDeleteFile(fileKey, global.files[fileKey]);
                    delete global.files[fileKey];
                    global.fileElements.delete(fileElement);
                    fileElement.remove();
                }
            },
            async undo() {
                // Restore file from soft-deleted state
                const restoredFile = await fileReferenceManager.restoreFile(fileKey, fileReference);
                if (restoredFile) {
                    global.files[fileKey] = restoredFile;
                    global.fileElements.set(fileElement, fileKey);

                    // Re-insert the file element at its original position
                    const $fileList = document.qs("#top-bar > .file-list");
                    if (nextSibling && nextSibling.parentNode === $fileList) {
                        // Insert before the next sibling
                        $fileList.insertBefore(fileElement, nextSibling);
                    } else if (previousSibling && previousSibling.parentNode === $fileList) {
                        // Insert after the previous sibling
                        previousSibling.insertAdjacentElement('afterend', fileElement);
                    } else {
                        // If no siblings found (or they were also removed), append at the end
                        $fileList.appendChild(fileElement);
                    }
                }
            }
        };
    },

    /**
     * Create an action for changing member color
     */
    changeMemberColor(groupName, memberIndex, oldColor, newColor) {
        return {
            description: `Change member color in "${groupName}"`,
            execute() {
                const group = global.groups[groupName];
                if (group && group.members[memberIndex]) {
                    group.members[memberIndex].color = newColor;
                }
            },
            undo() {
                const group = global.groups[groupName];
                if (group && group.members[memberIndex]) {
                    group.members[memberIndex].color = oldColor;
                }
            }
        };
    },

    /**
     * Create an action for auto-grouping
     */
    autoGroup(previousGroups, previousGroupElements) {
        return {
            description: "Auto group files",
            execute() {
                // Auto grouping has already been executed
                // Just store the fact that it happened
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
        };
    },

    /**
     * Create an action for importing/adding a file
     */
    importFile(fileName, fileElement) {
        return {
            description: `Import file "${fileName}"`,
            async execute() {
                // If this is a redo, restore from soft-deleted state
                const restoredFile = await fileReferenceManager.restoreFile(fileName, null);
                if (restoredFile) {
                    global.files[fileName] = restoredFile;
                    global.fileElements.set(fileElement, fileName);

                    // Re-insert the file element
                    const $fileList = document.qs("#top-bar > .file-list");
                    $fileList.appendChild(fileElement);
                } else {
                    // This is the initial execution - file import has already been done
                    // Just store the fact that it happened
                }
            },
            async undo() {
                // Remove the imported file
                if (global.files[fileName]) {
                    // Use soft-delete for file data preservation in case of redo
                    await fileReferenceManager.softDeleteFile(fileName, global.files[fileName]);
                    delete global.files[fileName];
                    global.fileElements.delete(fileElement);
                    fileElement.remove();

                    // Clean up affected groups
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
                            // Dynamically import LoadFileSelection to avoid circular imports
                            import("./file-viewer.js").then(({ default: LoadFileSelection }) => {
                                LoadFileSelection($new).catch(console.error);
                            });
                        }
                    }

                    $tab?.remove();
                    if ($files.children.length === 0) {
                        $fileViewer.classList.add("hidden");
                    }
                }
            }
        };
    },

    /**
     * Create an action for batch importing multiple files
     */
    importFiles(fileInfos) {
        return {
            description: `Import ${fileInfos.length} file${fileInfos.length > 1 ? "s" : ""}`,
            async execute() {
                // If this is a redo, restore all files from soft-deleted state
                for (const { fileName, fileElement } of fileInfos) {
                    const restoredFile = await fileReferenceManager.restoreFile(fileName, null);
                    if (restoredFile) {
                        global.files[fileName] = restoredFile;
                        global.fileElements.set(fileElement, fileName);

                        // Re-insert the file element
                        const $fileList = document.qs("#top-bar > .file-list");
                        $fileList.appendChild(fileElement);
                    }
                }
                // If no files were restored, this is the initial execution
            },
            async undo() {
                // Remove all imported files
                for (const { fileName, fileElement } of fileInfos) {
                    if (global.files[fileName]) {
                        // Use soft-delete for file data preservation in case of redo
                        await fileReferenceManager.softDeleteFile(fileName, global.files[fileName]);
                        delete global.files[fileName];
                        global.fileElements.delete(fileElement);
                        fileElement.remove();
                    }
                }

                // Clean up affected groups
                const fileNames = fileInfos.map(info => info.fileName);
                for (const group of Object.values(global.groups ?? {})) {
                    const hasMember = group.members.length > 0;
                    group.members = group.members.filter(m => !fileNames.includes(m.member[0]));
                    group.element.qsa(`.member`).forEach($member => {
                        const selector = $member.qs(".selector:first-child");
                        if (selector && fileNames.includes(selector.dataset.selector)) {
                            $member.remove();
                        }
                    });

                    if (hasMember && group.members.length === 0) {
                        group.element.remove();
                        delete global.groups[group.name];
                        global.groupElements.delete(group.element);
                    }
                }

                // Handle file viewer updates
                const $fileViewer = document.qs("#file-viewer");
                const $files = $fileViewer.qs(".files");
                if ($files.children.length === 0) {
                    $fileViewer.classList.add("hidden");
                }
            }
        };
    },
    cleanGroups(removedGroups) {
        return {
            description: "Clean empty groups",
            execute() {
                // Cleaning has already been executed
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
        };
    }
};

export default undoRedoManager;
export { fileReferenceManager, colorSelectorUndoRedoManager, dataSelectorUndoRedoManager };

// Clean up soft-deleted files when the page is about to unload
window.addEventListener("beforeunload", () => {
    // Use a shorter timeout for immediate cleanup on page unload
    fileReferenceManager.forceCleanup().catch(console.error);
});
