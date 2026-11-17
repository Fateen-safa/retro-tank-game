import { DEPTH, GRAVITY } from '../constants.js';

// Gem power-up (M2-5). Falls to the surface below, bobs, blinks before it disappears.
export default class Pickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type, lifetimeMs) {
    super(scene, x, y, 'gems', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.type = type;
    this.vy = -90;
    this.landed = false;
    this.bornAt = scene.time.now;
    this.lifetimeMs = lifetimeMs;
    this.setDepth(DEPTH.shot).setOrigin(0.5, 1);
    this.body.setSize(14, 14, false).setOffset(1, 1);
    this.play(`gem-${type}`);
  }

  update(time, dt) {
    if (!this.landed) {
      const prevY = this.y;
      this.vy += GRAVITY * 0.6 * dt;
      const y = prevY + this.vy * dt;
      const land = this.vy > 0 ? this.scene.terrain.landing(this.x, prevY, y) : null;
      if (land) { this.y = land.y - 2; this.landed = true; this.groundY = this.y; }
      else this.y = y;
    } else {
      this.y = this.groundY - Math.abs(Math.sin((time - this.bornAt) / 220)) * 3;
    }
    const age = time - this.bornAt;
    if (age > this.lifetimeMs - 3000) this.setVisible(Math.floor(age / 100) % 2 === 0);
    if (age > this.lifetimeMs) this.destroy();
  }
}
