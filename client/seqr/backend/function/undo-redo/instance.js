import { UndoRedoManager, FloatUndoRedoManager } from "./manager.js";

const MainUndoRedo = new UndoRedoManager(),
      DataSelectorUndoRedo = new FloatUndoRedoManager(),
      ColorSelectorUndoRedo = new FloatUndoRedoManager();

export { MainUndoRedo, DataSelectorUndoRedo, ColorSelectorUndoRedo };
const instances = [
    DataSelectorUndoRedo,
    ColorSelectorUndoRedo
];

export function GetActiveUndoRedoManager() {
    let active = MainUndoRedo;
    for (const instance of instances) {
        if (instance.active === true) {
            active = instance;
            break;
        }
    }

    return active;
}