/**
 * @zakkster/lite-steer — Zero-GC Steering Behaviors
 *
 * 15 production-ready autonomous agent behaviors built entirely on
 * @zakkster/lite-vec. Every function uses the module scratchpad pattern:
 * temporary vectors are allocated once at module load, reused forever.
 *
 * Zero allocations in the hot path. Deterministic when used with lite-random.
 *
 * Depends on: @zakkster/lite-vec
 *
 * USAGE PATTERN:
 *   All steering functions write into an `out` vec2 (the force/acceleration).
 *   Apply it in your game loop:
 *
 *     seek(force, pos, vel, target, 200, 0.1);
 *     vec2.add(vel, vel, force);
 *     vec2.add(pos, pos, vel);
 */

import { vec2 } from '@zakkster/lite-vec';


// ─────────────────────────────────────────────────────────
//  MODULE SCRATCHPADS
//  Allocated once. Reused by every function call.
//  JS engines optimize Float32Array access into register ops.
// ─────────────────────────────────────────────────────────

const _tmp   = vec2.create();
const _tmp2  = vec2.create();
const _diff  = vec2.create();
const _perp  = vec2.create();
const _proj  = vec2.create();
const _seg   = vec2.create();


// ═══════════════════════════════════════════════════════════
//  INDIVIDUAL BEHAVIORS
// ═══════════════════════════════════════════════════════════

/**
 * Seek: steer toward a target at maximum speed.
 * Classic Craig Reynolds steering.
 *
 * @param {Float32Array} out           Output force vector
 * @param {Float32Array} pos           Current position
 * @param {Float32Array} vel           Current velocity
 * @param {Float32Array} target        Target position
 * @param {number}       maxSpeed      Desired approach speed
 * @param {number}       steerStrength How aggressively to correct course (0–1)
 */
export function seek(out, pos, vel, target, maxSpeed, steerStrength) {
    vec2.sub(out, target, pos);
    vec2.normalize(out, out);
    vec2.scale(out, out, maxSpeed);
    vec2.sub(out, out, vel);
    vec2.scale(out, out, steerStrength);
}


/**
 * Arrive: seek with smooth deceleration near the target.
 * The agent slows to a stop instead of orbiting.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Float32Array} vel
 * @param {Float32Array} target
 * @param {number}       maxSpeed
 * @param {number}       slowRadius   Distance at which deceleration begins
 */
export function arrive(out, pos, vel, target, maxSpeed, slowRadius) {
    vec2.sub(out, target, pos);
    const dist = vec2.mag(out);
    if (dist < 0.001) { vec2.zero(out); return; }

    const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
    vec2.scale(out, out, speed / dist); // normalize + scale in one step
    vec2.sub(out, out, vel);
}


/**
 * Flee: steer away from a threat. Ignores threats beyond panicDist.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Float32Array} vel
 * @param {Float32Array} threat
 * @param {number}       maxSpeed
 * @param {number}       panicDist    Only flee if closer than this
 */
export function flee(out, pos, vel, threat, maxSpeed, panicDist) {
    if (vec2.distSq(pos, threat) > panicDist * panicDist) {
        vec2.zero(out);
        return;
    }
    vec2.sub(out, pos, threat);
    vec2.normalize(out, out);
    vec2.scale(out, out, maxSpeed);
    vec2.sub(out, out, vel);
}


/**
 * Wander: natural random motion. Returns the updated wander angle
 * so the caller can store it per-entity.
 *
 * Uses an RNG parameter instead of Math.random() for deterministic output.
 *
 * @param {Float32Array} out
 * @param {Float32Array} vel           Current velocity (direction is extracted)
 * @param {number}       wanderRadius  Size of the wander circle
 * @param {number}       wanderRate    How fast the angle drifts
 * @param {number}       wanderAngle   Current wander angle (stored per entity)
 * @param {{ next: () => number }} rng Seeded RNG (or { next: Math.random })
 * @returns {number} Updated wander angle — store this on the entity
 */
export function wander(out, vel, wanderRadius, wanderRate, wanderAngle, rng) {
    const newAngle = wanderAngle + (rng.next() - 0.5) * wanderRate;

    vec2.normalize(_tmp, vel);
    vec2.scale(_tmp, _tmp, wanderRadius);

    vec2.fromAngle(_tmp2, newAngle);
    vec2.scale(_tmp2, _tmp2, wanderRadius);

    vec2.add(out, _tmp, _tmp2);
    return newAngle;
}


/**
 * Follow a flow field. Queries the field function for desired direction.
 * The fieldFn receives a scratchpad vector to write into — zero allocations.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Float32Array} vel
 * @param {Function}     fieldFn       (out, x, y) => void — writes direction into out
 * @param {number}       maxSpeed
 * @param {number}       steerStrength
 */
export function followFlow(out, pos, vel, fieldFn, maxSpeed, steerStrength) {
    fieldFn(_tmp, pos[0], pos[1]);
    vec2.normalize(out, _tmp);
    vec2.scale(out, out, maxSpeed);
    vec2.sub(out, out, vel);
    vec2.scale(out, out, steerStrength);
}


// ═══════════════════════════════════════════════════════════
//  BOIDS (Flocking)
// ═══════════════════════════════════════════════════════════

/**
 * Separation: steer away from nearby neighbors to avoid crowding.
 * Boids rule #1.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Array<{pos: Float32Array}>} neighbors
 * @param {number} desiredDist  Minimum comfortable distance
 */
export function separation(out, pos, neighbors, desiredDist) {
    vec2.zero(out);
    let count = 0;
    const dSqThreshold = desiredDist * desiredDist;

    for (let i = 0; i < neighbors.length; i++) {
        const dSq = vec2.distSq(pos, neighbors[i].pos);
        if (dSq > 0 && dSq < dSqThreshold) {
            vec2.sub(_diff, pos, neighbors[i].pos);
            vec2.normalize(_diff, _diff);
            vec2.scale(_diff, _diff, 1 / dSq);
            vec2.add(out, out, _diff);
            count++;
        }
    }

    if (count > 0) vec2.scale(out, out, 1 / count);
}


/**
 * Alignment: steer toward the average heading of neighbors.
 * Boids rule #2.
 *
 * @param {Float32Array} out
 * @param {Float32Array} vel
 * @param {Array<{vel: Float32Array}>} neighbors
 */
export function alignment(out, vel, neighbors) {
    vec2.zero(out);

    for (let i = 0; i < neighbors.length; i++) {
        vec2.add(out, out, neighbors[i].vel);
    }

    if (neighbors.length > 0) {
        vec2.scale(out, out, 1 / neighbors.length);
        vec2.sub(out, out, vel);
        vec2.normalize(out, out);
    }
}


/**
 * Cohesion: steer toward the center of mass of neighbors.
 * Boids rule #3.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Array<{pos: Float32Array}>} neighbors
 */
export function cohesion(out, pos, neighbors) {
    vec2.zero(out);

    for (let i = 0; i < neighbors.length; i++) {
        vec2.add(out, out, neighbors[i].pos);
    }

    if (neighbors.length > 0) {
        vec2.scale(out, out, 1 / neighbors.length);
        vec2.sub(out, out, pos);
        vec2.normalize(out, out);
    }
}


// ═══════════════════════════════════════════════════════════
//  BOUNDARIES
// ═══════════════════════════════════════════════════════════

/**
 * Screen wrap (Asteroids-style). Teleports to opposite edge.
 * Mutates pos in-place.
 *
 * @param {Float32Array} pos
 * @param {number} width
 * @param {number} height
 */
export function wrap(pos, width, height) {
    if (pos[0] < 0) pos[0] += width;
    else if (pos[0] > width) pos[0] -= width;
    if (pos[1] < 0) pos[1] += height;
    else if (pos[1] > height) pos[1] -= height;
}


/**
 * Screen bounce. Reverses velocity on edge contact.
 * Mutates pos and vel in-place. Clamps position to bounds.
 *
 * @param {Float32Array} pos
 * @param {Float32Array} vel
 * @param {number} width
 * @param {number} height
 * @param {number} [restitution=0.8]  Bounciness (1 = perfect, 0.5 = lossy)
 */
export function bounce(pos, vel, width, height, restitution = 0.8) {
    if (pos[0] <= 0)      { pos[0] = 0;      vel[0] = Math.abs(vel[0]) * restitution; }
    if (pos[0] >= width)  { pos[0] = width;   vel[0] = -Math.abs(vel[0]) * restitution; }
    if (pos[1] <= 0)      { pos[1] = 0;       vel[1] = Math.abs(vel[1]) * restitution; }
    if (pos[1] >= height) { pos[1] = height;  vel[1] = -Math.abs(vel[1]) * restitution; }
}


/**
 * Soft edge avoidance. Applies a gradient steering force
 * that increases as the agent gets closer to the edge.
 * Much smoother than hard bounce.
 *
 * @param {Float32Array} out       Output force
 * @param {Float32Array} pos
 * @param {number} margin          Distance from edge where force begins
 * @param {number} width
 * @param {number} height
 * @param {number} strength        Maximum force magnitude
 */
export function avoidEdges(out, pos, margin, width, height, strength) {
    out[0] = 0;
    out[1] = 0;

    if (pos[0] < margin)               out[0] = strength * (1 - pos[0] / margin);
    else if (pos[0] > width - margin)  out[0] = -strength * (1 - (width - pos[0]) / margin);

    if (pos[1] < margin)               out[1] = strength * (1 - pos[1] / margin);
    else if (pos[1] > height - margin) out[1] = -strength * (1 - (height - pos[1]) / margin);
}


// ═══════════════════════════════════════════════════════════
//  ORBITAL & VORTEX
// ═══════════════════════════════════════════════════════════

/**
 * Orbit: rotate position around a center point.
 * One-liner powered by vec2.rotateAround.
 *
 * @param {Float32Array} out     Output position
 * @param {Float32Array} pos     Current position
 * @param {Float32Array} center  Orbit center
 * @param {number}       speed   Radians per second
 * @param {number}       dt      Delta time in seconds
 */
export function orbit(out, pos, center, speed, dt) {
    vec2.rotateAround(out, pos, center, speed * dt);
}


/**
 * Swirl toward a target: attraction + perpendicular spin.
 * The closer the particle, the faster it spirals.
 * Perfect for "sucked into a vortex" VFX.
 *
 * @param {Float32Array} out
 * @param {Float32Array} pos
 * @param {Float32Array} target
 * @param {number}       strength   Pull force
 * @param {number}       swirl      Tangential spin force
 */
export function swirlToward(out, pos, target, strength, swirl) {
    vec2.sub(out, target, pos);
    const dist = vec2.mag(out);

    vec2.normalize(out, out);
    vec2.scale(out, out, strength);

    vec2.perp(_perp, out);
    vec2.scale(_perp, _perp, swirl / (dist + 1));

    vec2.add(out, out, _perp);
}


// ═══════════════════════════════════════════════════════════
//  NOISE & FIELDS
// ═══════════════════════════════════════════════════════════

/**
 * Curl noise: compute a divergence-free 2D vector from a scalar noise field.
 * Produces swirling, organic flow. Perfect for smoke, water, generative art.
 *
 * @param {Float32Array} out
 * @param {number}       x       Sample X position
 * @param {number}       y       Sample Y position
 * @param {Function}     noiseFn (x, y) => number (e.g. SimplexNoise.noise2D)
 * @param {number}       [eps=0.001]  Finite difference step size
 */
export function curl(out, x, y, noiseFn, eps = 0.001) {
    const n1 = noiseFn(x, y + eps);
    const n2 = noiseFn(x, y - eps);
    const n3 = noiseFn(x + eps, y);
    const n4 = noiseFn(x - eps, y);

    out[0] = (n3 - n4) / (2 * eps);
    out[1] = -(n1 - n2) / (2 * eps);
}


// ═══════════════════════════════════════════════════════════
//  PATH FOLLOWING
// ═══════════════════════════════════════════════════════════

/**
 * Project a point onto a line segment. Returns the closest point.
 * Zero-GC via scratchpad.
 *
 * @param {Float32Array} out     Closest point on segment
 * @param {Float32Array} p       The point to project
 * @param {Float32Array} a       Segment start
 * @param {Float32Array} b       Segment end
 */
export function projectToSegment(out, p, a, b) {
    vec2.sub(_seg, b, a);
    const lenSq = vec2.magSq(_seg);

    if (lenSq < 0.0001) {
        vec2.copy(out, a);
        return;
    }

    vec2.sub(_tmp, p, a);
    let t = vec2.dot(_tmp, _seg) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;

    out[0] = a[0] + _seg[0] * t;
    out[1] = a[1] + _seg[1] * t;
}


/**
 * Follow a polyline path. Steers toward the closest point on the path,
 * advanced by a lookahead distance for smooth anticipation.
 *
 * @param {Float32Array} out       Output steering force
 * @param {Float32Array} pos       Current position
 * @param {Float32Array} vel       Current velocity
 * @param {Array<Float32Array>} path  Array of vec2 waypoints
 * @param {number}       maxSpeed
 * @param {number}       [lookahead=20]  How far ahead on the path to target
 */
export function followPath(out, pos, vel, path, maxSpeed, lookahead = 20) {
    if (path.length < 2) { vec2.zero(out); return; }

    let closestDistSq = Infinity;
    let bestSegIdx = 0;
    let bestT = 0;

    // Find nearest point on the path
    for (let i = 0; i < path.length - 1; i++) {
        projectToSegment(_proj, pos, path[i], path[i + 1]);
        const dSq = vec2.distSq(pos, _proj);
        if (dSq < closestDistSq) {
            closestDistSq = dSq;
            bestSegIdx = i;
            vec2.sub(_seg, path[i + 1], path[i]);
            const segLen = vec2.mag(_seg);
            if (segLen > 0.001) {
                vec2.sub(_tmp, _proj, path[i]);
                bestT = vec2.mag(_tmp) / segLen;
            } else { bestT = 0; }
        }
    }

    // Advance along the path by lookahead distance
    let remain = lookahead;
    let segIdx = bestSegIdx;
    let t = bestT;

    while (remain > 0 && segIdx < path.length - 1) {
        vec2.sub(_seg, path[segIdx + 1], path[segIdx]);
        const segLen = vec2.mag(_seg);
        const remainOnSeg = segLen * (1 - t);

        if (remain <= remainOnSeg) {
            t += remain / (segLen || 1);
            remain = 0;
        } else {
            remain -= remainOnSeg;
            segIdx++;
            t = 0;
        }
    }

    // Compute target point
    if (segIdx >= path.length - 1) {
        vec2.copy(_proj, path[path.length - 1]);
    } else {
        vec2.lerp(_proj, path[segIdx], path[segIdx + 1], t);
    }

    // Seek toward the lookahead point
    seek(out, pos, vel, _proj, maxSpeed, 1);
}
