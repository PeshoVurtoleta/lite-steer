# @zakkster/lite-steer

[![npm version](https://img.shields.io/npm/v/@zakkster/lite-steer.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/@zakkster/lite-steer)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@zakkster/lite-steer?style=for-the-badge)](https://bundlephobia.com/result?p=@zakkster/lite-steer)
[![npm downloads](https://img.shields.io/npm/dm/@zakkster/lite-steer?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-steer)
[![npm total downloads](https://img.shields.io/npm/dt/@zakkster/lite-steer?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-steer)
![TypeScript](https://img.shields.io/badge/TypeScript-Types-informational)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Zero-GC steering behaviors for autonomous agents. Boids, seek, flee, wander, path following, curl noise.

**10,000 boids at 60fps. 6 scratchpad vectors. Zero garbage collection.**

## Why lite-steer?

| Feature | lite-steer | Yuka | p5.js steer | Custom code |
|---|---|---|---|---|
| **Zero-GC (scratchpad)** | **Yes** | No | No | Manual |
| **Float32Array (lite-vec)** | **Yes** | No | No | Rare |
| **Deterministic wander** | **Yes (seeded RNG)** | No | No | No |
| **Path following** | **Yes (with lookahead)** | Yes | No | Manual |
| **Curl noise** | **Yes** | No | No | Manual |
| **rotateAround orbit** | **Yes (1-liner)** | No | No | 5+ lines |
| **Bundle size** | **< 3KB** | ~40KB | ~800KB (full) | 0 |

## Installation

```bash
npm install @zakkster/lite-steer
```

## Quick Start

```javascript
import { vec2 } from '@zakkster/lite-vec';
import { seek, bounce } from '@zakkster/lite-steer';

const pos = vec2.create(100, 100);
const vel = vec2.create(0, 0);
const force = vec2.create();
const target = vec2.create(400, 300);

function update() {
    seek(force, pos, vel, target, 200, 0.1);
    vec2.add(vel, vel, force);
    vec2.add(pos, pos, vel);
    bounce(pos, vel, 800, 600);
}
```

## Recipes

### Firefly Swarm (Wander + Avoid Edges)

```javascript
wanderAngle = wander(force, vel, 20, 0.4, wanderAngle, rng);
avoidEdges(force2, pos, 40, width, height, 0.5);

vec2.add(force, force, force2);
vec2.add(vel, vel, force);
vec2.scale(vel, vel, 0.95); // air friction
vec2.add(pos, pos, vel);
```

### School of Fish (Boids)

```javascript
separation(fSep, pos, neighbors, 30);
alignment(fAli, vel, neighbors);
cohesion(fCoh, pos, neighbors);

vec2.scale(fSep, fSep, 1.5);  // avoid crowding strongly
vec2.scale(fAli, fAli, 1.0);
vec2.scale(fCoh, fCoh, 1.2);  // stay with the group

vec2.add(force, fSep, fAli);
vec2.add(force, force, fCoh);

vec2.add(vel, vel, force);
vec2.clampMag(vel, vel, 0, MAX_SPEED);
vec2.add(pos, pos, vel);
```

### Vortex Particles

```javascript
swirlToward(force, pos, center, 40, 120);

vec2.add(vel, vel, force);
vec2.scale(vel, vel, 0.98); // drag for smooth spiraling
vec2.add(pos, pos, vel);
```

### Smoke / Fluid (Curl Noise)

```javascript
curl(force, pos[0], pos[1], noiseFn);
vec2.scale(force, force, 40);

vec2.add(vel, vel, force);
vec2.scale(vel, vel, 0.92); // heavy drag = thick smoke
vec2.add(pos, pos, vel);
```

### Path-Following Drones

```javascript
followPath(force, pos, vel, path, 120, 30);

vec2.add(vel, vel, force);
vec2.clampMag(vel, vel, 0, 150);
vec2.add(pos, pos, vel);
```

### Butterfly Motion (Wander + Orbit)

```javascript
wanderAngle = wander(force, vel, 10, 0.6, wanderAngle, rng);
vec2.add(vel, vel, force);
vec2.scale(vel, vel, 0.90);
vec2.add(pos, pos, vel);

orbit(pos, pos, center, 0.4, dt); // gentle orbit around flower
```

### Flee Cursor (Interactive Art)

```javascript
const mouse = vec2.create(mouseX, mouseY);
flee(force, pos, vel, mouse, 200, 150);

vec2.add(vel, vel, force);
vec2.scale(vel, vel, 0.96);
vec2.add(pos, pos, vel);
```

## All 16 Functions

**Individual:** `seek`, `arrive`, `flee`, `wander`, `followFlow`
**Boids:** `separation`, `alignment`, `cohesion`
**Boundaries:** `wrap`, `bounce`, `avoidEdges`
**Orbital:** `orbit`, `swirlToward`
**Noise:** `curl`
**Path:** `projectToSegment`, `followPath`

## License

MIT
