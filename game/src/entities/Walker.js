import Enemy from './Enemy.js';

// Feet position inside each sheet's frame, so the walker stands on the ground.
const FEET = { 'walker-walk': 38 / 42, 'walker-idle': 45 / 48 };
const BODY_W = 30, BODY_H = 24;

// Alien walker: idles until on screen, walks toward the tank, and lunges when close.
export default class Walker extends Enemy {
  constructor(scene, x, stats, platform = null) {
    super(scene, x, scene.terrain.standY(x, platform), 'walker-idle', stats, 'walker', platform);
    this.deathFx = 'enemy-death';
    this.body.setSize(BODY_W, BODY_H, false);
    this.setSheet('walker-idle');
  }

  setSheet(key) {
    if (this.sheet === key) return;
    this.sheet = key;
    this.play(key);
    this.setOrigin(0.5, FEET[key]);
    const f = this.frame;
    this.body.setOffset((f.width - BODY_W) / 2, f.height * FEET[key] - BODY_H);
  }

  onWake() { this.setSheet('walker-walk'); }

  think(time, dt, tank) {
    this.clampToPlatform();
    this.y = this.standY();
    if (!this.awake) {
      this.setVelocityX(0);
      this.setFlipX(tank.x > this.x);
      return;
    }
    const dx = tank.x - this.x;
    const dir = Math.sign(dx) || -1;
    // Lunge when the tank is close and on the same level
    const sameLevel = Math.abs(tank.y - this.y) < 24;
    const speed = this.stats.speed * (sameLevel && Math.abs(dx) < this.stats.lungeRange ? this.stats.lungeScale : 1);
    this.setVelocityX(this.stunned(time) ? 0 : dir * speed);
    this.anims.timeScale = speed > this.stats.speed ? 1.8 : 1;
    this.setFlipX(dir > 0); // art faces left
  }
}
