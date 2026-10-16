/** OGA Career Studio V3 / Lot 2 — document history in browser memory only. */
export type CareerHistory<T> = {
  past: T[];
  future: T[];
  lastControl: Element | null;
  lastTime: number;
};
export function createCareerHistory<T>(): CareerHistory<T> {
  return { past: [], future: [], lastControl: null, lastTime: 0 };
}
function snapshot<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}
export function recordCareerEdit<T>(history: CareerHistory<T>, previous: T, control: Element | null, now: number): CareerHistory<T> {
  const grouped = control !== null && control === history.lastControl && now - history.lastTime < 700 && history.past.length > 0 && history.future.length === 0;
  return { past: grouped ? history.past : [...history.past.slice(-23), snapshot(previous)], future: [], lastControl: control, lastTime: now };
}
export function undoCareerEdit<T>(history: CareerHistory<T>, current: T | null): { history: CareerHistory<T>; document: T | null } {
  if (!current || !history.past.length) return { history, document: null };
  const previous = history.past[history.past.length - 1];
  return { history: { past: history.past.slice(0, -1), future: [...history.future, snapshot(current)], lastControl: null, lastTime: 0 }, document: snapshot(previous) };
}
export function redoCareerEdit<T>(history: CareerHistory<T>, current: T | null): { history: CareerHistory<T>; document: T | null } {
  if (!current || !history.future.length) return { history, document: null };
  const next = history.future[history.future.length - 1];
  return { history: { past: [...history.past, snapshot(current)], future: history.future.slice(0, -1), lastControl: null, lastTime: 0 }, document: snapshot(next) };
}
/** Move an item without changing its fields, IDs, or its companions. */
export function moveCareerEntry<T extends { id: string }>(items: readonly T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex(item => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
