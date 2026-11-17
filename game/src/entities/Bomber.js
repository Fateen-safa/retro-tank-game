import Enemy from './Enemy.js';

// Spaceship unit: hovers above the tank and drops clusters of bombs (M2-3).
export default class Bomber extends Enemy {
  constructor(scene, x, stats) {
    super(scene, x, stats.hoverY, 'bomber', stats, 'bomber');
    this.setOrigin(0.5, 0.5);
    this.body.setSize(70, 40, false).setOffset(22, 18);
    this.play('bomber-fly');
    this.nextDrop = 0;
    this.t = Math.random() * 10;
  }

  onWake(time) { this.nextDrop = time + 1200; }

  think(time, dt, tank) {
    this.t += dt;
    if (!this.awake) { this.setVelocity(0, 0); return; }
    // Aim ahead of the tank so driving straight doesn't dodge everything
    const targetX = tank.x + tank.speedX * 0.8;
    const dx = targetX - this.x;
    const vx = Phaser.Math.Clamp(dx * 1.2, -this.stats.speed, this.stats.speed);
    this.setVelocityX(tank.alive ? vx : 0);
    this.y = this.stats.hoverY + Math.sin(this.t * 2.2) * 6;
    if (Math.abs(vx) > 4) this.setFlipX(vx < 0); // art faces right
    if (tank.alive && Math.abs(dx) < 50 && time >= this.nextDrop) {
      this.nextDrop = time + this.stats.dropEveryMs;
      const n = this.stats.cluster;
      for (let i = 0; i < n; i++) {
        const b = this.scene.weapons.fireEnemy('bomb', this.x, this.y + 22);
        b.setVelocityX((i - (n - 1) / 2) * this.stats.clusterSpreadX);
      }
    }
  }
}
