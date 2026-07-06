import { describe, expect, it } from 'vitest';
import { chevronPath, chevronPathAt, notchDepth } from '../src/draw/geometry.js';

describe('notchDepth', () => {
  it('is half the height for regular proportions', () => {
    expect(notchDepth(160, 60)).toBe(30);
  });

  it('clamps for very narrow steps', () => {
    expect(notchDepth(50, 60)).toBe(20);
  });
});

describe('chevronPath', () => {
  it('produces a closed six-point path', () => {
    const path = chevronPath(160, 60);
    expect(path).toBe('M0,0L130,0L160,30L130,60L0,60L30,30Z');
  });

  it('offsets by the shape position in absolute form', () => {
    expect(chevronPathAt(10, 20, 160, 60)).toBe('M10,20L140,20L170,50L140,80L10,80L40,50Z');
  });
});
