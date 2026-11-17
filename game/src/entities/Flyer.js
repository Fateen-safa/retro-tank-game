import Enemy from './Enemy.js';

// Alien flyer: cruises on a sine wave, dives at the tank once when it gets close, then climbs and flies off (M2-3).
export default class Flyer extends Enemy {
  constructor(scene, x, stats, baseY = 220) {
    super(scene, x, baseY, 'flyer', stats, 'flyer');
    this.baseY = baseY;
    this.phase = 0;
    this.dir = -1;
    this.state = 'cruise';
    this.setOrigin(50 / 83, 30 / 64);
    this.body.setSize(36, 30, false).setOffset(32, 16);
    this.play('flyer-fly');
  }

  onWake(time, tank) { this.dir = Math.sign(tank.x - this.x) || -1; }

  think(time, dt, tank) {
    if (!this.awake) { this.setVelocity(0, 0); return; }
    const s = this.stats;
    if (this.state === 'cruise') {
      this.phase += dt * 2.4;
      this.setVelocity(this.dir * s.speed, 0);
      this.y = this.baseY + Math.sin(this.phase) * s.amplitude;
      // Dive when the tank is just ahead
      const dx = (tank.x - this.x) * this.dir;
      if (tank.alive && dx > 0 && dx < s.diveRange) {
        this.state = 'dive';
        this.diveUntil = time + 700;
        const a = Phaser.Math.Angle.Between(this.x, this.y, tank.x, tank.centerY);
        this.setVelocity(Math.cos(a) * s.diveSpeed, Math.sin(a) * s.diveSpeed);
        this.anims.timeScale = 2;
        this.scene.sfx.at('flyerDive', this.x, { vol: 0.7 });
      }
    } else if (this.state === 'dive') {
      if (time > this.diveUntil || this.terrain.isSolid(this.x, this.y + 20)) {
        this.state = 'climb';
        this.setVelocity(this.dir * s.speed, -s.diveSpeed * 0.6);
        this.anims.timeScale = 1;
      }
    } else if (this.state === 'climb' && this.y <= this.baseY - s.amplitude) {
      this.setVelocityY(0);
    }
    this.setFlipX(this.body.velocity.x > 0); // art faces left
    if (!this.onScreen(140)) this.destroy();
  }
}
