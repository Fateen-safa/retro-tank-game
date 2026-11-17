import { W, DEPTH } from '../constants.js';
import { spawnFx } from './Fx.js';

// How each projectile looks. Numbers (speed, damage...) live in stats.json.
// origin = the projectile's head inside its frame; rot = extra rotation so the art points along travel.
// ghost = flies through ground and platforms; homing = steers toward the tank.
const LOOK = {
  bolt:    { tex: 'bolt',      anim: 'bolt-fly',     fw: 48, fh: 32, origin: [12, 15], rot: Math.PI, size: 12, hitFx: 'hit',         wallFx: 'hits-1' },
  spread:  { tex: 'crossed',   anim: 'crossed-spin', fw: 32, fh: 32, origin: [16, 16], rot: null,    size: 14, hitFx: 'explosion-g', wallFx: 'hits-4' },
  charged: { tex: 'charged',   anim: 'charged-fly',  fw: 63, fh: 48, origin: [50, 24], rot: 0,       size: 22, hitFx: 'hits-3',      wallFx: 'hits-3' },
  pulse:   { tex: 'pulse',     anim: 'pulse-fly',    fw: 63, fh: 32, origin: [52, 17], rot: 0,       size: 10, hitFx: 'hits-2',      wallFx: 'explosion-f' },
  spark:   { tex: 'spark',     anim: 'spark-fly',    fw: 63, fh: 32, origin: [50, 17], rot: 0,       size: 10, hitFx: 'hits-5',      wallFx: 'explosion-f' },
  rain:    { tex: 'spark',     anim: 'spark-fly',    fw: 63, fh: 32, origin: [50, 17], rot: 0,       size: 10, hitFx: 'hits-5',      wallFx: 'explosion-f' },
  bomb:    { tex: 'spark',     anim: 'spark-fly',    fw: 63, fh: 32, origin: [50, 17], rot: 0,       size: 12, hitFx: 'ground-explosion', wallFx: 'ground-explosion' },
  fire:    { tex: 'fire-ball', anim: 'fire-fly',     fw: 52, fh: 29, origin: [42, 14], rot: 0,       size: 14, hitFx: 'explosion-b', wallFx: 'explosion-b', ghost: true, homing: true },
  wave:    { tex: 'waveform',  anim: 'wave-fly',     fw: 95, fh: 32, origin: [60, 16], rot: 0,       size: 26, hitFx: 'hits-3',      wallFx: 'hits-3', ghost: true },
  // Enemy bolts are tinted red-orange so they never look like the player's own shots
  ebolt:   { tex: 'bolt',      anim: 'bolt-fly',     fw: 48, fh: 32, origin: [12, 15], rot: Math.PI, size: 12, hitFx: 'hit',         wallFx: 'hits-1', tint: 0xff8a5a },
};

export default class Weapons {
  constructor(scene, stats) {
    this.scene = scene;
    this.stats = stats;
    this.playerShots = scene.physics.add.group();
    this.enemyShots = scene.physics.add.group();
    this.power = null;
    this.powerUntil = 0;
    this.lastShot = -Infinity;
    this.queued = false;
    this.chargeStart = null;
    this.chargeGlow = scene.add.sprite(0, 0, 'charged', 0).setDepth(DEPTH.shot).setVisible(false);
  }

  mode(time) { return this.power && time < this.powerUntil ? this.power : 'bolt'; }

  setPower(type, time) {
    this.power = type;
    this.powerUntil = time + this.stats.powerUps.durationMs;
    this.chargeStart = null;
  }

  clearPower() {
    this.power = null; this.powerUntil = 0; this.chargeStart = null; this.chargeGlow.setVisible(false);
    this.chargeSound?.stop(); this.chargeSound = null;
  }

  // Mouse button pressed / released
  press(time) {
    if (this.mode(time) === 'charged') {
      this.chargeStart = time;
      this.chargeSound?.stop();
      this.chargeSound = this.scene.sfx.play('charge', { vol: 0.8, detune: 0, gapMs: 0 });
    } else this.queued = true;
  }

  release(time, muzzle, canFire) {
    if (this.chargeStart === null) return;
    const held = time - this.chargeStart;
    this.chargeStart = null;
    this.chargeSound?.stop();
    this.chargeSound = null;
    this.chargeGlow.setVisible(false);
    if (!canFire) return;
    if (held >= this.stats.weapons.charged.minChargeMs) this.firePlayer('charged', muzzle, time);
    else this.firePlayer('bolt', muzzle, time);
  }

  // Called every frame while the game runs.
  update(time, held, muzzle, canFire) {
    const mode = this.mode(time);
    if (mode === 'charged') {
      this.queued = false;
      if (this.chargeStart !== null && canFire) {
        const t = Phaser.Math.Clamp((time - this.chargeStart) / this.stats.weapons.charged.minChargeMs, 0, 1);
        this.chargeGlow.setVisible(true).setPosition(muzzle.x, muzzle.y).setScale(0.3 + 0.4 * t)
          .setAlpha(0.4 + 0.6 * t).setRotation(muzzle.angle).setFrame(t >= 1 ? (Math.floor(time / 60) % 2) : 0);
      } else this.chargeGlow.setVisible(false);
      return;
    }
    this.chargeGlow.setVisible(false);
    if (!canFire) { this.queued = false; return; }
    const w = this.stats.weapons[mode];
    if ((this.queued || held) && time - this.lastShot >= 1000 / w.fireRate) {
      this.queued = false;
      this.firePlayer(mode, muzzle, time);
    }
  }

  firePlayer(kind, muzzle, time) {
    const w = this.stats.weapons[kind];
    this.lastShot = time;
    if (kind === 'spread') {
      const step = Phaser.Math.DegToRad(w.spreadDeg);
      for (let i = 0; i < w.count; i++) {
        const a = muzzle.angle + (i - (w.count - 1) / 2) * step;
        this.spawn(this.playerShots, kind, muzzle.x, muzzle.y, a, w.speed, w.damage, w.lifetimeMs);
      }
    } else {
      this.spawn(this.playerShots, kind, muzzle.x, muzzle.y, muzzle.angle, w.speed, w.damage, w.lifetimeMs);
    }
    this.scene.sfx.play(kind === 'spread' ? 'shootSpread' : kind === 'charged' ? 'shootCharged' : 'shoot', { vol: 0.7 });
    this.scene.tank?.kick(kind === 'charged' ? 6 : 3);
    // Muzzle smoke (M2-8)
    spawnFx(this.scene, muzzle.x, muzzle.y, 'explosion-a', { scale: kind === 'charged' ? 1 : 0.75 });
    if (kind === 'charged') this.scene.cameras.main.shake(90, 0.006);
  }

  fireEnemy(kind, x, y, angle, speedScale = 1, sound = undefined) {
    const s = this.stats.enemyShots[kind];
    const snd = sound ?? { pulse: 'enemyShot', spark: 'enemyShot', ebolt: 'bossShot', fire: 'homing', bomb: 'bombDrop', rain: 'rainFall', wave: 'shockwave' }[kind];
    if (snd) this.scene.sfx.at(snd, x, { vol: kind === 'rain' ? 0.5 : 0.8, gapMs: kind === 'rain' ? 120 : 40 });
    if (kind === 'bomb') {
      const b = this.spawn(this.enemyShots, kind, x, y, Math.PI / 2, 10, s.damage, s.lifetimeMs);
      b.body.setGravityY(s.gravity);
      return b;
    }
    return this.spawn(this.enemyShots, kind, x, y, angle, s.speed * speedScale, s.damage, s.lifetimeMs);
  }

  spawn(group, kind, x, y, angle, speed, damage, lifetimeMs) {
    const L = LOOK[kind];
    const b = group.create(x, y, L.tex, 0);
    b.kind = kind;
    b.look = L;
    b.damage = damage;
    b.speed = speed;
    b.pierce = kind === 'charged';
    b.hitSet = new Set();
    b.dieAt = this.scene.time.now + lifetimeMs;
    b.setOrigin(L.origin[0] / L.fw, L.origin[1] / L.fh).setDepth(DEPTH.shot);
    if (L.rot !== null) b.setRotation(angle + L.rot);
    b.body.setSize(L.size, L.size, false).setOffset(L.origin[0] - L.size / 2, L.origin[1] - L.size / 2);
    b.play(L.anim);
    if (L.tint) b.setTint(L.tint);
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return b;
  }

  // Parry: turn an enemy shot around and send it at the nearest enemy with extra damage.
  reflect(b, target) {
    const x = b.x, y = b.y;
    const speed = Math.max(b.speed || 200, 220) * this.stats.parry.reflectSpeedScale;
    this.enemyShots.remove(b);
    this.playerShots.add(b);
    b.body.setGravityY(0);
    b.reflected = true;
    b.homingOff = true;
    b.damage = Math.ceil(b.damage * this.stats.parry.damageMultiplier);
    b.hitSet = new Set();
    b.dieAt = this.scene.time.now + 2500;
    let angle;
    if (target) angle = Phaser.Math.Angle.Between(x, y, target.body.center.x, target.body.center.y);
    else { const v = b.body.velocity; angle = Math.atan2(-v.y || -1, -v.x); }
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    if (b.look.rot !== null) b.setRotation(angle + b.look.rot);
    b.setTint(0xfff2a0);
    spawnFx(this.scene, x, y, 'parry-spark', { scale: 0.75 });
    this.scene.sfx.play('parry', { vol: 0.9, gapMs: 60 });
  }

  // Projectile hits something: play its impact effect and remove it (unless it pierces).
  impact(b, onEnemy) {
    const L = b.look;
    const fx = onEnemy ? L.hitFx : L.wallFx;
    if (fx === 'ground-explosion' || fx === 'explosion-b') this.scene.sfx.at('explodeSmall', b.x, { vol: 0.8 });
    else if (onEnemy) this.scene.sfx.at('enemyHit', b.x, { vol: 0.6 });
    else this.scene.sfx.at('wallHit', b.x, { vol: 0.5, gapMs: 60 });
    if (fx === 'ground-explosion') spawnFx(this.scene, b.x, b.y + 4, fx, { originY: 1 });
    else spawnFx(this.scene, b.x, b.y, fx);
    if (!onEnemy || !b.pierce) b.destroy();
  }

  // Destroy every homing shot (the tank teleported away from them).
  fizzleHoming() {
    for (const b of this.enemyShots.getChildren().slice()) if (b.look.homing) this.impact(b, false);
  }

  // Terrain impacts, homing, lifetime, off-screen cleanup. onBomb(x, y, dmg) runs when a bomb lands.
  updateShots(time, dt, terrain, tank, onBomb) {
    const cam = this.scene.cameras.main;
    for (const group of [this.playerShots, this.enemyShots]) {
      for (const b of group.getChildren().slice()) {
        const L = b.look;
        if (b.kind === 'bomb') b.setRotation(Math.atan2(b.body.velocity.y, b.body.velocity.x));
        if (L.homing && !b.homingOff && tank.alive) {
          // Steer toward the tank: it can't be outrun, only parried or teleported away from.
          const v = b.body.velocity;
          const cur = Math.atan2(v.y, v.x);
          const want = Phaser.Math.Angle.Between(b.x, b.y, tank.x, tank.centerY);
          const turn = this.stats.enemyShots.fire.turnRate * dt;
          const a = Phaser.Math.Angle.RotateTo(cur, want, turn);
          b.setVelocity(Math.cos(a) * b.speed, Math.sin(a) * b.speed).setRotation(a);
        }
        const off = b.x < cam.scrollX - 80 || b.x > cam.scrollX + W + 80 || b.y < -80 || b.y > 420;
        if (!L.ghost && terrain.isSolid(b.x, b.y)) {
          if (b.kind === 'bomb') onBomb(b.x, terrain.supportBelow(b.x, b.y - 20).y, b.damage);
          this.impact(b, false);
        } else if (off || time > b.dieAt) {
          b.destroy();
        }
      }
    }
  }
}
