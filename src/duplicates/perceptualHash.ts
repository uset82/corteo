// Perceptual difference hash (dHash) + duplicate grouping for Phase 3.4.
//
// A clip signature is 64 bits: an 9×8 grayscale sample grid is compared
// left-to-right per row, and each brighter-than-its-right-neighbour sample sets
// a bit. Gradients survive rescaling and brightness drift far better than an
// average hash, so a re-imported or re-graded copy of the same shot still pairs
// up while unrelated frames do not. Distances are Hamming distances.

/** Sampled columns per row: one more than the 8 bits a row contributes. */
export const SAMPLE_COLUMNS = 9;
export const HASH_ROWS = 8;
/** Bits per signature (8 per row × 8 rows). */
export const HASH_BITS = (SAMPLE_COLUMNS - 1) * HASH_ROWS;
/** Distances at or below this are treated as the same shot (0..HASH_BITS). */
export const DEFAULT_DUPLICATE_THRESHOLD = 6;

export interface HashedClip {
  id: string;
  hash: string;
}

export interface DuplicateGroup {
  /** Item ids; the first id is the canonical shot. */
  clips: string[];
  /** 0..100, derived from the worst distance inside the group. */
  similarity: number;
}

/** 64-bit dHash from a row-major 9×8 grayscale grid. */
export function differenceHash(gray: Uint8Array | readonly number[]): string {
  const expected = SAMPLE_COLUMNS * HASH_ROWS;
  if (gray.length < expected) throw new Error(`dHash needs ${expected} samples, got ${gray.length}`);
  let bits = '';
  for (let row = 0; row < HASH_ROWS; row += 1) {
    const rowStart = row * SAMPLE_COLUMNS;
    for (let column = 0; column < SAMPLE_COLUMNS - 1; column += 1) {
      bits += (gray[rowStart + column] ?? 0) > (gray[rowStart + column + 1] ?? 0) ? '1' : '0';
    }
  }
  return bits;
}

/** Bit count of `a XOR b`; unequal lengths compare the common prefix. */
export function hammingDistance(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  let distance = Math.abs(a.length - b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
}

export function similarityOf(distance: number): number {
  return Math.round(Math.max(0, 1 - distance / HASH_BITS) * 1000) / 10;
}

/**
 * Group hashed clips whose pairwise distance stays within `threshold`.
 *
 * Union-find rather than the obvious nested scan: a chain of near-identical
 * re-cuts (A~B, B~C) then reports one group instead of B silently absorbing C
 * into a second group and hiding the duplicate set from the editor.
 */
export function groupDuplicates(
  clips: readonly HashedClip[],
  threshold = DEFAULT_DUPLICATE_THRESHOLD,
): DuplicateGroup[] {
  const parent = clips.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    let walk = index;
    while (parent[walk] !== walk) {
      const next = parent[walk]!;
      parent[walk] = root;
      walk = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const worst = new Map<number, number>();
  for (let a = 0; a < clips.length; a += 1) {
    for (let b = a + 1; b < clips.length; b += 1) {
      const distance = hammingDistance(clips[a]!.hash, clips[b]!.hash);
      if (distance > threshold) continue;
      union(a, b);
      const root = find(a);
      worst.set(root, Math.max(worst.get(root) ?? 0, distance));
    }
  }

  const buckets = new Map<number, string[]>();
  clips.forEach((clip, index) => {
    const root = find(index);
    if (!worst.has(root)) return;
    buckets.set(root, [...(buckets.get(root) ?? []), clip.id]);
  });

  return [...buckets.entries()]
    .filter(([, clipsInGroup]) => clipsInGroup.length > 1)
    .map(([root, clipsInGroup]) => ({
      clips: clipsInGroup,
      similarity: similarityOf(worst.get(root) ?? 0),
    }))
    .sort((a, b) => b.similarity - a.similarity || b.clips.length - a.clips.length);
}
