/** Session-only chronological history for the Formation Studio.
 * Do not persist commands: server-signed restoration receipts expire and the
 * live Tiptap history must not be replayed against a reloaded lesson.
 */
export type StudioUndoCommand =
  | { kind: 'prose'; lessonId: string; key: string; at: number }
  | { kind: 'content'; lessonId: string; blockId: string; before: Record<string, unknown>; after: Record<string, unknown>; at: number }
  | { kind: 'order'; lessonId: string; before: string[]; after: string[]; at: number }
  | { kind: 'settings'; lessonId: string; blockId: string; before: Record<string, unknown>; after: Record<string, unknown>; at: number }
  | { kind: 'structure'; lessonId: string; blockId: string; operation: 'add' | 'delete'; receipt?: string; at: number };

export function createStudioUndoLedger(limit = 60) {
  const undo: StudioUndoCommand[] = [];
  const redo: StudioUndoCommand[] = [];
  return {
    record(command: StudioUndoCommand) {
      const last = undo[undo.length - 1];
      // One typing burst is one undo step. Distinct actions retain their exact order.
      if (last?.kind === 'prose' && command.kind === 'prose' && last.key === command.key
          && last.lessonId === command.lessonId && command.at - last.at < 900) {
        last.at = command.at;
      } else if (last?.kind === 'content' && command.kind === 'content'
          && last.blockId === command.blockId && last.lessonId === command.lessonId
          && command.at - last.at < 1200) {
        last.after = command.after;
        last.at = command.at;
      } else {
        undo.push(command);
        if (undo.length > limit) undo.shift();
      }
      redo.length = 0;
    },
    undoCommand: () => undo[undo.length - 1],
    redoCommand: () => redo[redo.length - 1],
    completeUndo(command: StudioUndoCommand) {
      if (undo[undo.length - 1] !== command) return false;
      undo.pop(); redo.push(command); return true;
    },
    completeRedo(command: StudioUndoCommand) {
      if (redo[redo.length - 1] !== command) return false;
      redo.pop(); undo.push(command); return true;
    },
    clear() { undo.length = 0; redo.length = 0; },
    sizes: () => ({ undo: undo.length, redo: redo.length }),
  };
}
