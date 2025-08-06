import { UndoRedoManager, FloatUndoRedoManager } from "./manager.js";

const MainUndoRedo = new UndoRedoManager(),
      DataSelectorUndoRedo = new FloatUndoRedoManager(),
      ColorSelectorUndoRed = new FloatUndoRedoManager();

export { MainUndoRedo, DataSelectorUndoRedo, ColorSelectorUndoRed };