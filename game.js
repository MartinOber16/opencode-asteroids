'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyC'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ─────────────────────────────────────────────────────────────
const SHOOTING_STAR_POINTS = 150;
const SHOOTING_STAR_TTL = 6;
const SHOOTING_STAR_RADIUS = 18;

const SHIELD_TIME = 6;

class ShootingStar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = SHOOTING_STAR_RADIUS;
    this.ttl = SHOOTING_STAR_TTL;
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = rand(380, 500);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.trail = [];
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.shift();

    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (i / this.trail.length) * 0.6;
      ctx.strokeStyle = `rgba(255,160,40,${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - this.vx * 0.02, t.y - this.vy * 0.02);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffb347';
    const pulse = 1 + Math.sin(Date.now() / 120) * 0.08;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, -7);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-18, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKINS = [
  { name: 'Clásica',   stroke: '#fff',            fill: 'rgba(255,255,255,0.06)',  glow: null,    lineWidth: 1.5, flame: 'rgba(255, 130, 0, 0.85)' },
  { name: 'Neón',      stroke: '#0ff',            fill: 'rgba(0,255,255,0.06)',    glow: '#0ff',   lineWidth: 1.8, flame: 'rgba(0, 255, 255, 0.9)' },
  { name: 'Fénix',     stroke: '#ff7b2b',         fill: 'rgba(255,123,43,0.06)',   glow: '#ff2d2d', lineWidth: 1.8, flame: 'rgba(255, 110, 20, 0.9)' },
  { name: 'Esmeralda', stroke: '#3ff05c',         fill: 'rgba(63,240,92,0.06)',    glow: '#12c94a', lineWidth: 1.8, flame: 'rgba(63, 240, 92, 0.9)' },
  { name: 'Espectro',  stroke: '#c683ff',         fill: 'rgba(198,131,255,0.06)',  glow: '#9a4dff', lineWidth: 1.8, flame: 'rgba(198, 131, 255, 0.9)' },
];
const SKIN_STORAGE_KEY = 'asteroids_skin';
let skinIndex = 0;

function loadSkin() {
  try {
    const saved = parseInt(localStorage.getItem(SKIN_STORAGE_KEY), 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < SKINS.length) skinIndex = saved;
  } catch (e) { /* almacenamiento no disponible */ }
}

function setSkin(i) {
  skinIndex = ((i % SKINS.length) + SKINS.length) % SKINS.length;
  try { localStorage.setItem(SKIN_STORAGE_KEY, String(skinIndex)); } catch (e) { /* no disponible */ }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.speedBoostTime = 0;
    this.shieldTime     = 0;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.speedBoostTime > 0) this.speedBoostTime -= dt;
    if (this.shieldTime    > 0) this.shieldTime    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      const thrust = this.speedBoostTime > 0 ? THRUST * 2 : THRUST;
      this.vx += Math.cos(this.angle) * thrust * dt;
      this.vy += Math.sin(this.angle) * thrust * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.lineJoin = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.fillStyle = skin.fill;
    ctx.fill();
    ctx.strokeStyle = skin.stroke;
    ctx.lineWidth   = skin.lineWidth;
    if (skin.glow) {
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur  = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.flame;
      ctx.stroke();
    }

    // Escudo
    if (this.shieldTime > 0) {
      const pulse = 1 + Math.sin(Date.now() / 100) * 0.05;
      let alpha = 0.85;
      if (this.shieldTime < 1.5 && Math.floor(this.shieldTime * 6) % 2 === 0) alpha = 0.3;
      ctx.strokeStyle = `rgba(79, 179, 255, ${alpha.toFixed(2)})`;
      ctx.fillStyle   = `rgba(79, 179, 255, ${(alpha * 0.18).toFixed(2)})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 23 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-up ──────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 10;
    this.dead = false;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 60);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-1.5, 1.5);
    this.pulse = 0;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.pulse += dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    if (this.type === 'shield') {
      ctx.strokeStyle = '#4fb3ff';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(79,179,255,0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4fb3ff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -5);
      ctx.lineTo(7, 1);
      ctx.quadraticCurveTo(7, 6, 0, 8);
      ctx.quadraticCurveTo(-7, 6, -7, 1);
      ctx.lineTo(-7, -5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(0,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerUpTimer;
let shootingStarTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUpTimer = 10;
  shootingStarTimer = 15;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function spawnShootingStar() {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - W / 2, y - H / 2) < 150);
  shootingStars.push(new ShootingStar(x, y));
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (pressed('KeyC')) setSkin(skinIndex + 1);

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(pu => pu.update(dt));
  shootingStars.forEach(ss => ss.update(dt));

  // Spawneo periódico de power-ups
  powerUpTimer -= dt;
  if (powerUpTimer <= 0) {
    if (powerUps.length < 2) {
      const type = Math.random() < 0.5 ? 'speed' : 'shield';
      powerUps.push(new PowerUp(rand(40, W - 40), rand(40, H - 40), type));
    }
    powerUpTimer = 10;
  }

  // Spawneo periódico de estrellas fugaces
  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) {
    if (shootingStars.length < 2) spawnShootingStar();
    shootingStarTimer = 15;
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(pu => !pu.dead);
  shootingStars = shootingStars.filter(ss => !ss.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);

  // Bala vs estrella fugaz
  for (const b of bullets) {
    for (const ss of shootingStars) {
      if (!ss.dead && !b.dead && dist(b, ss) < ss.radius) {
        b.dead = true;
        ss.dead = true;
        score += SHOOTING_STAR_POINTS;
        explode(ss.x, ss.y, 12);
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  const newShipAsteroids = [];
  for (const a of asteroids) {
    if (dist(ship, a) < ship.radius + a.radius * 0.82) {
      if (ship.shieldTime > 0) {
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newShipAsteroids.push(...a.split());
      } else if (ship.invincible <= 0) {
        killShip();
        break;
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newShipAsteroids);

  // Nave vs estrella fugaz
  for (const ss of shootingStars) {
    if (dist(ship, ss) < ship.radius + ss.radius) {
      if (ship.shieldTime > 0) {
        ss.dead = true;
        score += SHOOTING_STAR_POINTS;
        explode(ss.x, ss.y, 12);
      } else if (ship.invincible <= 0) {
        killShip();
        break;
      }
    }
  }
  shootingStars = shootingStars.filter(ss => !ss.dead);

  // Nave vs power-up
  for (const pu of powerUps) {
    if (dist(ship, pu) < ship.radius + pu.radius) {
      pu.dead = true;
      if (pu.type === 'speed') ship.speedBoostTime = 5;
      else if (pu.type === 'shield') ship.shieldTime = SHIELD_TIME;
      break;
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = SKINS[skinIndex].stroke;
  ctx.lineWidth   = 1.4;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '12px monospace';
  ctx.fillText(`SKIN: ${SKINS[skinIndex].name}   [C]`, 14, H - 14);

  if (ship.shieldTime > 0) {
    ctx.fillStyle = '#4fb3ff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`¡ESCUDO! ${Math.ceil(ship.shieldTime)}s`, W / 2, H - 40);
  }

  if (ship.speedBoostTime > 0) {
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`¡VELOCIDAD! ${Math.ceil(ship.speedBoostTime)}s`, W / 2, H - 20);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  shootingStars.forEach(ss => ss.draw());
  bullets.forEach(b => b.draw());
  powerUps.forEach(pu => pu.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

loadSkin();
initGame();
requestAnimationFrame(loop);
