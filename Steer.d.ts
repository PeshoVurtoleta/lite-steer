import type { Vec2 } from '@zakkster/lite-vec';

export function seek(out: Vec2, pos: Vec2, vel: Vec2, target: Vec2, maxSpeed: number, steerStrength: number): void;
export function arrive(out: Vec2, pos: Vec2, vel: Vec2, target: Vec2, maxSpeed: number, slowRadius: number): void;
export function flee(out: Vec2, pos: Vec2, vel: Vec2, threat: Vec2, maxSpeed: number, panicDist: number): void;
export function wander(out: Vec2, vel: Vec2, wanderRadius: number, wanderRate: number, wanderAngle: number, rng: { next(): number }): number;
export function followFlow(out: Vec2, pos: Vec2, vel: Vec2, fieldFn: (out: Vec2, x: number, y: number) => void, maxSpeed: number, steerStrength: number): void;
export function separation(out: Vec2, pos: Vec2, neighbors: Array<{ pos: Vec2 }>, desiredDist: number): void;
export function alignment(out: Vec2, vel: Vec2, neighbors: Array<{ vel: Vec2 }>): void;
export function cohesion(out: Vec2, pos: Vec2, neighbors: Array<{ pos: Vec2 }>): void;
export function wrap(pos: Vec2, width: number, height: number): void;
export function bounce(pos: Vec2, vel: Vec2, width: number, height: number, restitution?: number): void;
export function avoidEdges(out: Vec2, pos: Vec2, margin: number, width: number, height: number, strength: number): void;
export function orbit(out: Vec2, pos: Vec2, center: Vec2, speed: number, dt: number): void;
export function swirlToward(out: Vec2, pos: Vec2, target: Vec2, strength: number, swirl: number): void;
export function curl(out: Vec2, x: number, y: number, noiseFn: (x: number, y: number) => number, eps?: number): void;
export function projectToSegment(out: Vec2, p: Vec2, a: Vec2, b: Vec2): void;
export function followPath(out: Vec2, pos: Vec2, vel: Vec2, path: Vec2[], maxSpeed: number, lookahead?: number): void;
