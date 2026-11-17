import { W, DEPTH } from '../constants.js';

// Shared enemy behaviour: hit points, white flash, wake-up when on screen, standing on ground or a platform.
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, stats, type, platform = null) {
    super(scene, x, y, texture, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.type = type;
    this.stats = stats;
    this.hp = stats.hp;
    this.awake = false;
    this.platform = platform;
    this.deathFx = 'explosion-b';
    this.setDepth(DEPTH.enemy);
  }

  get terrain() { return this.scene.terrain; }

  // Ground height under this enemy, or its platform's top.
  standY() { return this.terrain.standY(this.x, this.platform); }

  // Keep a platform enemy on its platform. Returns true if it hit an edge.
  clampToPlatform(margin = 14) {
    const p = this.platform;
    if (!p) return false;
    const lo = p.x + margin, hi = p.x + p.w - margin;
    if (this.x < lo || this.x > hi) { this.x = Phaser.Math.Clamp(this.x, lo, hi); return true; }
    return false;
  }

  onScreen(margin = 0) {
    const cam = this.scene.cameras.main;
    return this.x > cam.scrollX - margin && this.x < cam.scrollX + W + margin;
  }

  // Override in subclasses. tank is the Tank instance.
  think(time, dt, tank) {}

  update(time, dt, tank) {
    if (!this.active) return;
    if (!this.awake && this.onScreen(-8)) { this.awake = true; this.onWake?.(time, tank); }
    this.think(time, dt, tank);
  }

  // Returns true if this hit killed it.
  hit(damage) {
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.active) { this.clearTint(); this.restoreTint?.(); } });
    return this.hp <= 0;
  }

  // Push back a little after touching the tank so it doesn't stick to it.
  // It also pauses briefly, so one walker can't chew through all your HP.
  knockBack(fromX) {
    this.x += Math.sign(this.x - fromX || 1) * 40;
    this.clampToPlatform();
    this.stunUntil = this.scene.time.now + 900;
  }

  stunned(time) { return time < (this.stunUntil || 0); }

  // Where a shot fired now at speed v should aim to hit the moving tank.
  leadTarget(gx, gy, tank, speed) {
    const dist = Phaser.Math.Distance.Between(gx, gy, tank.x, tank.centerY);
    const t = dist / speed;
    return { x: tank.x + tank.speedX * t, y: tank.centerY };
  }
}
