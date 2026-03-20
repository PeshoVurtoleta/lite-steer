import {describe, it, expect, vi} from 'vitest';

vi.mock('@zakkster/lite-vec', async () => {
    const actual = await import('./Vec.js');
    return actual;
});

import {vec2} from './Vec.js';

import {
    seek, arrive, flee, wander, followFlow,
    separation, alignment, cohesion,
    wrap, bounce, avoidEdges,
    orbit, swirlToward, curl,
    projectToSegment, followPath,
} from './Steer.js';

const force = vec2.create();

describe('🧭 lite-steer', () => {

    describe('seek()', () => {
        it('steers toward target', () => {
            const pos = vec2.create(0, 0);
            const vel = vec2.create(0, 0);
            const target = vec2.create(100, 0);
            seek(force, pos, vel, target, 10, 1);
            expect(force[0]).toBeGreaterThan(0);
        });

        it('output is zero when at target', () => {
            const pos = vec2.create(50, 50);
            const vel = vec2.create(10, 0);
            seek(force, pos, vel, pos, 10, 1);
            // When pos === target, desired direction is zero-length
            // normalize produces (0,0), so force = (0,0) - vel
            expect(force[0]).toBeCloseTo(-10);
        });
    });

    describe('arrive()', () => {
        it('decelerates near target', () => {
            const pos = vec2.create(95, 0);
            const vel = vec2.create(0, 0);
            const target = vec2.create(100, 0);
            arrive(force, pos, vel, target, 100, 50);
            // 5 units away with slowRadius 50 → speed = 100 * 5/50 = 10
            expect(force[0]).toBeCloseTo(10);
        });

        it('returns zero when at target', () => {
            const pos = vec2.create(100, 100);
            arrive(force, pos, vec2.create(), pos, 100, 50);
            expect(force[0]).toBe(0);
            expect(force[1]).toBe(0);
        });
    });

    describe('flee()', () => {
        it('steers away from threat', () => {
            const pos = vec2.create(10, 0);
            const threat = vec2.create(0, 0);
            flee(force, pos, vec2.create(), threat, 10, 50);
            expect(force[0]).toBeGreaterThan(0); // moving away
        });

        it('ignores threats beyond panicDist', () => {
            const pos = vec2.create(100, 0);
            const threat = vec2.create(0, 0);
            flee(force, pos, vec2.create(), threat, 10, 50);
            expect(force[0]).toBe(0);
            expect(force[1]).toBe(0);
        });
    });

    describe('wander()', () => {
        it('returns updated angle', () => {
            const vel = vec2.create(1, 0);
            const rng = {next: () => 0.5}; // neutral randomness
            const newAngle = wander(force, vel, 10, 0.5, 0, rng);
            expect(typeof newAngle).toBe('number');
        });

        it('produces non-zero force', () => {
            const vel = vec2.create(5, 0);
            const rng = {next: () => 0.7};
            wander(force, vel, 20, 1.0, 0, rng);
            expect(vec2.mag(force)).toBeGreaterThan(0);
        });

        it('is deterministic with same RNG', () => {
            const vel = vec2.create(5, 0);
            let i = 0;
            const rng1 = {next: () => [0.3, 0.7, 0.1][i++ % 3]};
            wander(force, vel, 20, 1.0, 0, rng1);
            const x1 = force[0], y1 = force[1];

            i = 0;
            const rng2 = {next: () => [0.3, 0.7, 0.1][i++ % 3]};
            wander(force, vel, 20, 1.0, 0, rng2);
            expect(force[0]).toBeCloseTo(x1);
            expect(force[1]).toBeCloseTo(y1);
        });
    });

    describe('followFlow()', () => {
        it('steers along flow direction', () => {
            const pos = vec2.create(50, 50);
            const vel = vec2.create(0, 0);
            const fieldFn = (out, x, y) => {
                out[0] = 1;
                out[1] = 0;
            }; // rightward flow
            followFlow(force, pos, vel, fieldFn, 10, 1);
            expect(force[0]).toBeGreaterThan(0);
        });
    });

    describe('separation()', () => {
        it('pushes away from close neighbors', () => {
            const pos = vec2.create(50, 50);
            const neighbors = [
                {pos: vec2.create(55, 50)},
                {pos: vec2.create(45, 50)},
            ];
            separation(force, pos, neighbors, 30);
            // Symmetric neighbors should roughly cancel on X
            expect(Math.abs(force[0])).toBeLessThan(1);
        });

        it('returns zero with no neighbors in range', () => {
            const pos = vec2.create(0, 0);
            const neighbors = [{pos: vec2.create(1000, 1000)}];
            separation(force, pos, neighbors, 10);
            expect(force[0]).toBe(0);
            expect(force[1]).toBe(0);
        });
    });

    describe('alignment()', () => {
        it('steers toward average heading', () => {
            const vel = vec2.create(0, 0);
            const neighbors = [
                {vel: vec2.create(10, 0)},
                {vel: vec2.create(10, 0)},
            ];
            alignment(force, vel, neighbors);
            expect(force[0]).toBeGreaterThan(0);
        });
    });

    describe('cohesion()', () => {
        it('steers toward center of mass', () => {
            const pos = vec2.create(0, 0);
            const neighbors = [
                {pos: vec2.create(10, 0)},
                {pos: vec2.create(20, 0)},
            ];
            cohesion(force, pos, neighbors);
            expect(force[0]).toBeGreaterThan(0); // center of mass is at (15, 0)
        });
    });

    describe('wrap()', () => {
        it('wraps left edge', () => {
            const pos = vec2.create(-5, 50);
            wrap(pos, 100, 100);
            expect(pos[0]).toBe(95);
        });

        it('wraps right edge', () => {
            const pos = vec2.create(105, 50);
            wrap(pos, 100, 100);
            expect(pos[0]).toBe(5);
        });

        it('wraps top edge', () => {
            const pos = vec2.create(50, -10);
            wrap(pos, 100, 100);
            expect(pos[1]).toBe(90);
        });
    });

    describe('bounce()', () => {
        it('reverses velocity on left wall', () => {
            const pos = vec2.create(-1, 50);
            const vel = vec2.create(-10, 0);
            bounce(pos, vel, 100, 100, 1);
            expect(vel[0]).toBeGreaterThan(0);
            expect(pos[0]).toBe(0);
        });

        it('applies restitution', () => {
            const pos = vec2.create(-1, 50);
            const vel = vec2.create(-10, 0);
            bounce(pos, vel, 100, 100, 0.5);
            expect(vel[0]).toBeCloseTo(5);
        });
    });

    describe('avoidEdges()', () => {
        it('pushes right when near left edge', () => {
            avoidEdges(force, vec2.create(10, 50), 40, 800, 600, 1);
            expect(force[0]).toBeGreaterThan(0);
        });

        it('returns zero when far from edges', () => {
            avoidEdges(force, vec2.create(400, 300), 40, 800, 600, 1);
            expect(force[0]).toBe(0);
            expect(force[1]).toBe(0);
        });
    });

    describe('orbit()', () => {
        it('rotates position around center', () => {
            const pos = vec2.create(10, 0);
            const center = vec2.create(5, 0);
            orbit(pos, pos, center, Math.PI / 2, 1); // 90° in 1 second
            expect(pos[0]).toBeCloseTo(5);
            expect(pos[1]).toBeCloseTo(5);
        });
    });

    describe('swirlToward()', () => {
        it('produces force with both radial and tangential components', () => {
            const pos = vec2.create(0, 0);
            const target = vec2.create(100, 0);
            swirlToward(force, pos, target, 10, 50);
            expect(force[0]).toBeGreaterThan(0); // radial: toward target
            expect(force[1]).not.toBe(0);          // tangential: perpendicular spin
        });
    });

    describe('curl()', () => {
        it('computes divergence-free field from noise', () => {
            const noiseFn = (x, y) => Math.sin(x) * Math.cos(y);
            curl(force, 1, 1, noiseFn);
            expect(Number.isFinite(force[0])).toBe(true);
            expect(Number.isFinite(force[1])).toBe(true);
        });
    });

    describe('projectToSegment()', () => {
        it('projects onto the middle of a segment', () => {
            const out = vec2.create();
            projectToSegment(out, vec2.create(5, 10), vec2.create(0, 0), vec2.create(10, 0));
            expect(out[0]).toBeCloseTo(5);
            expect(out[1]).toBeCloseTo(0);
        });

        it('clamps to segment start', () => {
            const out = vec2.create();
            projectToSegment(out, vec2.create(-5, 0), vec2.create(0, 0), vec2.create(10, 0));
            expect(out[0]).toBeCloseTo(0);
        });

        it('clamps to segment end', () => {
            const out = vec2.create();
            projectToSegment(out, vec2.create(15, 0), vec2.create(0, 0), vec2.create(10, 0));
            expect(out[0]).toBeCloseTo(10);
        });
    });

    describe('followPath()', () => {
        it('steers toward path', () => {
            const pos = vec2.create(5, 20);
            const vel = vec2.create(0, 0);
            const path = [vec2.create(0, 0), vec2.create(100, 0)];
            followPath(force, pos, vel, path, 10);
            expect(force[1]).toBeLessThan(0); // should steer downward toward path
        });

        it('handles single-segment path', () => {
            const pos = vec2.create(50, 50);
            followPath(force, pos, vec2.create(), [vec2.create(0, 0), vec2.create(100, 0)], 10);
            expect(Number.isFinite(force[0])).toBe(true);
        });

        it('returns zero for path with < 2 points', () => {
            followPath(force, vec2.create(), vec2.create(), [vec2.create(0, 0)], 10);
            expect(force[0]).toBe(0);
            expect(force[1]).toBe(0);
        });
    });
});
