/**
 * Undo/redo stack — stubbed for Phase 7.
 */
export class History {
  private undoStack: unknown[] = [];
  private redoStack: unknown[] = [];

  push(_entry: unknown) {
    // TODO: Phase 7
  }

  undo(): unknown | undefined {
    return this.undoStack.pop();
  }

  redo(): unknown | undefined {
    return this.redoStack.pop();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
