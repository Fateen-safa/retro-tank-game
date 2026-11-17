import { DEPTH, GRAVITY } from '../constants.js';

// Barrel pivot inside a 128x64 hull frame (frame 0, facing right).
const PIVOT_X = 68;
const PIVOT_Y = 31;
const BARREL_ORIGIN_X = 4 / 48; // pivot sits 4px into the 48px barrel sprite
const MUZZLE_DIST = 42;          // pivot -> barrel tip
const TREAD_HALF = 36;           // half the distance between the tread ends, for slope tilt

// Collision box (hull without the empty sprite margin)
const BODY_W = 96, BODY_H = 44, BODY_X = 18, BODY_Y = 20;

export default class Tank {
  constructor(scene, x, stats, terrain) {
    this.scene = scene;
    this.stats = stats;
    this.terrain = terrain;
    this.hp = stats.hp;
    this.alive = true;
    this.facing = 1;
    this.aim = 0;
    this.tilt = 0;
    this.invulnUntil = 0;
    this.platform = null;   // platform the tank stands on (null = ground)
    this.airborne = false;
    this.vy = 0;
    this.muzzle = { x, y: 0, angle: 0 };
    this.recoil = 0;

    // Parry (timed deflect shield)
    this.parryUntil = 0;
    this.parryReadyAt = 0;

    this.barrel = scene.add.image(0, 0, 'tank-barrel').setOrigin(BARREL_ORIGIN_X, 0.5).setDepth(DEPTH.barrel);
    this.hull = scene.physics.add.sprite(x, terrain.heightAt(x), 'tank-hull', 0).setOrigin(0.5, 1).setDepth(DEPTH.tank);
    this.hull.body.setSize(BODY_W, BODY_H, false).setOffset(BODY_X, BODY_Y);
    this.hull.setCollideWorldBounds(true);
    this.hull.owner = this;
    this.shield = scene.add.sprite(x, 0, 'energy-shield', 0).setScale(2).setDepth(DEPTH.shield).setVisible(false);
    this.shield.on('animationcomplete', (a) => { if (a.key === 'shield-break') this.shield.setVisible(false); });
    this.settle(true);
  }

  get x() { return this.hull.x; }
  get y() { return this.hull.y; }
  get centerY() { return this.hull.y - 26; }
  get body() { return this.hull.body; }
  get speedX() { return this.hull.body.velocity.x; }

  parrying(time) { return time < this.parryUntil; }

  // Barrel kicks back when firing
  kick(px) { this.recoil = px; }

  // Start the parry shield. Returns false while on cooldown.
  parry(time) {
    if (!this.alive || time < this.parryReadyAt) return false;
    this.parryUntil = time + this.stats.parryWindowMs;
    this.parryReadyAt = time + this.stats.parryCooldownMs;
    this.shield.setVisible(true).play('shield-up');
    return true;
  }

  // A shot was deflected: show the shield breaking and shorten the cooldown as a reward.
  parrySuccess(time) {
    this.shield.setVisible(true).play('shield-break');
    this.parryReadyAt = Math.min(this.parryReadyAt, time + this.stats.parrySuccessCooldownMs);
  }

  // Sit the tank on its surface and tilt it to match a ground slope (M2-2).
  settle(snap = false) {
    const x = this.hull.x;
    let target = 0;
    if (this.platform) {
      this.hull.y = this.platform.y;
    } else {
      const yl = this.terrain.heightAt(x - TREAD_HALF);
      const yr = this.terrain.heightAt(x + TREAD_HALF);
      target = Math.atan2(yr - yl, TREAD_HALF * 2);
      this.hull.y = (yl + yr) / 2 + 1;
    }
    this.tilt = snap ? target : Phaser.Math.Linear(this.tilt, target, 0.25);
    this.hull.setRotation(this.tilt);
  }

  // Move: drive, fall off platform edges, land on surfaces.
  move(dt) {
    const x = this.hull.x;
    if (!this.airborne) {
      if (this.platform && !this.terrain.onPlatform(this.platform, x)) {
        this.airborne = true;
        this.vy = 0;
        this.platform = null;
      } else {
        this.settle();
        return;
      }
    }
    const prevY = this.hull.y;
    this.vy += GRAVITY * dt;
    const y = prevY + this.vy * dt;
    const land = this.terrain.landing(x, prevY, y);
    if (land) {
      this.airborne = false;
      this.platform = land.platform;
      this.vy = 0;
      this.settle();
      this.scene.cameras.main.shake(80, 0.004);
      this.scene.sfx.play('land', { vol: 0.8 });
    } else {
      this.hull.y = y;
      this.tilt = Phaser.Math.Linear(this.tilt, 0, 0.1);
      this.hull.setRotation(this.tilt);
    }
  }

  // input: {left, right}; pointer: {x, y} in world space
  update(time, dt, input, pointer) {
    if (!this.alive) return;
    const { stats } = this;

    // Drive (R7: treads only animate while moving)
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.hull.setVelocityX(dir * stats.speed);
    if (dir !== 0) this.hull.anims.play('tank-drive', true);
    else this.hull.anims.stop();
    this.move(dt);

    // Face the side the cursor is on
    this.facing = pointer.x >= this.hull.x ? 1 : -1;
    this.hull.setFlipX(this.facing < 0);
    this.hull.body.setOffset(this.facing > 0 ? BODY_X : 128 - BODY_X - BODY_W, BODY_Y);

    // Barrel pivot, following the 1px bob in frames 1 and 3 and the hull tilt
    const bob = this.hull.frame.name % 2 === 1 ? -1 : 0;
    const lx = (PIVOT_X - 64) * this.facing;
    const ly = -64 + PIVOT_Y + bob;
    const c = Math.cos(this.tilt), s = Math.sin(this.tilt);
    const px = this.hull.x + lx * c - ly * s;
    const py = this.hull.y + lx * s + ly * c;

    // Aim (R4: from 15° below horizontal up to straight up, on the facing side)
    const maxDown = Phaser.Math.DegToRad(stats.maxAimDownDeg);
    let a = Math.atan2(pointer.y - py, Math.abs(pointer.x - px));
    a = Phaser.Math.Clamp(a, -Math.PI / 2, maxDown);
    this.aim = this.facing > 0 ? a : Math.PI - a;
    this.recoil *= 0.7;
    const rx = Math.cos(this.aim) * this.recoil, ry = Math.sin(this.aim) * this.recoil;
    this.barrel.setPosition(px - rx, py - ry).setRotation(this.aim).setFlipY(this.facing < 0);

    this.muzzle.x = px + Math.cos(this.aim) * MUZZLE_DIST;
    this.muzzle.y = py + Math.sin(this.aim) * MUZZLE_DIST;
    this.muzzle.angle = this.aim;

    // Shield: visible only while the parry window is open (or while its break animation plays)
    this.shield.setPosition(this.hull.x, this.centerY);
    const breaking = this.shield.anims.isPlaying && this.shield.anims.currentAnim?.key === 'shield-break';
    if (!this.parrying(time) && !breaking) this.shield.setVisible(false);

    // Blink while invulnerable (R6)
    const blinking = time < this.invulnUntil && Math.floor(time / 80) % 2 === 0;
    this.hull.setAlpha(blinking ? 0.35 : 1);
    this.barrel.setAlpha(blinking ? 0.35 : 1);
  }

  // Jump to a teleporter pad: x on the given surface.
  teleportTo(time, x, platform) {
    this.platform = platform;
    this.airborne = false;
    this.vy = 0;
    this.hull.x = x;
    this.settle(true);
    this.invulnUntil = Math.max(this.invulnUntil, time + this.stats.teleportInvulnMs);
  }

  // Returns true if the hit landed.
  damage(time, amount) {
    if (!this.alive || time < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + this.stats.invulnMs;
    this.hull.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.hull.clearTint());
    if (this.hp === 0) this.alive = false;
    return true;
  }

  heal(amount) { this.hp = Math.min(this.stats.hp, this.hp + amount); }

  hide() {
    this.alive = false;
    this.hull.setVisible(false).setVelocity(0, 0);
    this.hull.body.enable = false;
    this.barrel.setVisible(false);
    this.shield.setVisible(false);
  }

  respawn(time, x) {
    this.platform = null;
    this.airborne = false;
    this.vy = 0;
    this.hull.setPosition(x, this.terrain.heightAt(x)).setVisible(true).setAlpha(1);
    this.hull.body.enable = true;
    this.barrel.setVisible(true);
    this.hp = this.stats.hp;
    this.alive = true;
    this.invulnUntil = time + this.stats.respawnInvulnMs;
    this.parryReadyAt = 0;
    this.settle(true);
  }
}
