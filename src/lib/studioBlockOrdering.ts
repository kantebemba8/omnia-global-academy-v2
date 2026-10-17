/**
 * Formation Studio V4: slot-based ordering. A slot is a position between
 * blocks (0 = before first; N = after last), not the target block index.
 * This keeps mouse, touch alternatives and keyboard movements consistent.
 */
export function reorderBlocksAtSlot<T extends { id: string }>(
  blocks: readonly T[], sourceId: string, requestedSlot: number,
): T[] {
  if (!Number.isInteger(requestedSlot) || requestedSlot < 0 || requestedSlot > blocks.length) {
    throw new Error('INVALID_INSERTION_SLOT');
  }
  const source = blocks.findIndex(item => item.id === sourceId);
  if (source < 0 || new Set(blocks.map(item => item.id)).size !== blocks.length) {
    throw new Error('INVALID_BLOCK_SET');
  }
  const next = [...blocks];
  const [moving] = next.splice(source, 1);
  const insertAt = requestedSlot - (source < requestedSlot ? 1 : 0);
  next.splice(insertAt, 0, moving);
  return next;
}

export function orderChanged<T extends { id: string }>(before: readonly T[], after: readonly T[]): boolean {
  return before.length !== after.length || before.some((item, i) => item.id !== after[i]?.id);
}
