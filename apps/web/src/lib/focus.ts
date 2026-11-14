export type FocusDirection = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function nextFocusIndex(
  currentIndex: number,
  itemCount: number,
  columns: number,
  direction: FocusDirection
): number {
  if (itemCount <= 1) {
    return 0;
  }

  const safeColumns = Math.max(1, columns);
  const moves: Record<FocusDirection, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -safeColumns,
    ArrowDown: safeColumns
  };
  return Math.min(itemCount - 1, Math.max(0, currentIndex + moves[direction]));
}
