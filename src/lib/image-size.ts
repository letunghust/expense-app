/** The `resize` that brings an image's longest side down to `max`, or null when it already fits. */
export function shrinkToFit(width: number, height: number, max: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
