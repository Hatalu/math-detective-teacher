import { describe, expect, it } from 'vitest';
import { draw, normalize, pool } from './picker';

describe('student number picker', () => {
  it('pool respects range, skips and no-repeat', () => {
    const p = normalize({ from: 1, to: 6, skip: [2, 5], used: [3], noRepeat: true });
    expect(pool(p)).toEqual([1, 4, 6]);
    expect(pool({ ...p, noRepeat: false })).toEqual([1, 3, 4, 6]);
  });
  it('normalize swaps a reversed range, clamps, and drops out-of-range / duplicate entries', () => {
    const p = normalize({ from: 30, to: 0, skip: [5, 5, 31, 1.5], used: [40] });
    expect([p.from, p.to]).toEqual([1, 30]);
    expect(p.skip).toEqual([5]);
    expect(p.used).toEqual([]);
  });
  it('draw only returns pool members, and null when empty', () => {
    const p = normalize({ from: 10, to: 12, skip: [11] });
    expect(draw(p, () => 0)).toBe(10);
    expect(draw(p, () => 0.999)).toBe(12);
    expect(draw(normalize({ from: 1, to: 2, skip: [1, 2] }))).toBeNull();
    for (let k = 0; k < 50; k++) expect([10, 12]).toContain(draw(p));
  });
});
