# AGENTS.md

Single-file HTML5 Canvas game (Asteroids clone). Pure JS, no framework, no bundler, no dependencies.

## Commands
- There is **no build, test, lint, or typecheck**. Nothing to install or run.
- To run: open `index.html` directly in a browser, or `npx serve .` then visit `http://localhost:3000`.
- Only way to verify changes is by manually running the game in a browser (check the browser console for JS errors).

## Architecture
- All game logic lives in `game.js` (423 lines), loaded via `<script src="game.js">` in `index.html`.
- `game.js` and `index.html` are tightly coupled to the fixed canvas size `800x600`. The `W`/`H` constants in `game.js:5-6` MUST match the `width`/`height` attributes of `<canvas id="canvas">` in `index.html:23`. Change both together.
- Entities expose `update(dt)` / `draw()` methods; the game loop (`loop` in `game.js:414`) drives them with a `dt` delta in seconds and requests `requestAnimationFrame`.
- Game state is a top-level string: `'playing' | 'dead' | 'gameover'` (`game.js:241`).

## Gotchas
- Asteroid size 1/2/3 (`size` index) drive radius, speed, and points via parallel arrays `RADII`/`SPEEDS`/`POINTS` (`game.js:61-63`). **Index 0 is unused/reserved** — all three arrays start with a dummy `0`. When adding a size or tweaking balance, keep the arrays in sync and payloads indexed the same.
- All on-screen UI strings (HUD, `GAME OVER`, level text) are in **Spanish**; keep new UI text in Spanish.
- Input uses `e.code` (`ArrowUp`, `Space`, etc.) with `preventDefault()` to block page scroll — detection is in `game.js:12-24`.
- `Ship.reset()` and `initGame()` re-seed all state; changing ship constants (ROT/THRUST/DRAG at `game.js:143-145`) affects gameplay feel and must be tested manually.
