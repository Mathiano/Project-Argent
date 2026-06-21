// Depth-sort for the layer-2 pass (Phase 7). Everything that can occlude or be
// occluded — the player and the multi-tile props — carries a `sortY` (the pixel
// Y of its base/feet row's bottom edge). Drawing in ascending sortY order gives
// correct top-down depth: an entity higher on the map (smaller sortY) draws
// first and is overlapped by anything lower (larger sortY). So a tree whose base
// is south of the player draws after the player → it occludes them (walk-behind);
// a tree north of the player draws before → the player passes in front.
//
// Stable: equal sortY keeps input order (JS Array.sort is stable), so a prop and
// the player on the same row render deterministically.
export interface YSortable {
  readonly sortY: number;
}

export function ySortOrder<T extends YSortable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sortY - b.sortY);
}
