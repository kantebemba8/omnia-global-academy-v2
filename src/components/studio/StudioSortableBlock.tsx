import type { ReactNode, DragEvent } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

type Handle = { ref: (node: HTMLElement | null) => void; props: Record<string, unknown> };

/**
 * Dnd-kit is bound ONLY to the reorder handle. Inputs, Tiptap, buttons and
 * media drop zones inside the block remain interactive and untouched.
 */
export default function StudioSortableBlock({
  id, disabled, onPaletteDragOver, onPaletteDrop, children,
}: {
  id: string;
  disabled: boolean;
  onPaletteDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onPaletteDrop: (event: DragEvent<HTMLDivElement>) => void;
  children: (handle: Handle) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <div
    ref={setNodeRef}
    onDragOver={onPaletteDragOver}
    onDrop={onPaletteDrop}
    className="relative group"
    style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.65 : 1 }}
  >
    {children({ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } })}
  </div>;
}
