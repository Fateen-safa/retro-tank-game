import Enemy from './Enemy.js';
import { W } from '../constants.js';

// Strafing fighter (flying vehicle 1). When its trigger x scrolls into view it swoops in from the
// right edge, fires a fan of bolts at the tank as it passes, and leaves on the left.
// Heavy variant (flying vehicle 2) is tougher and drops a bomb carpet instead of a fan.
export default class Strafer extends Enemy {
  constructor(scene, x, stats, y = 110, heavy = false) {
    super(scene, x, y, heavy ? 'vehicle2' : 'vehicle1', stats, 'strafer');
    this.heavy = heavy;
    this.baseY = y;
    if (heavy) this.hp = stats.heavyHp;
    this.setOrigin(0.5, 0.5).setVisible(false);
    if (heavy) this.body.setSize(120, 56, false).setOffset(28, 40);
    else this.body.setSize(120, 46, false).setOffset(28, 26);
    this.body.enable = false;
    this.play(heavy ? 'vehicle2-fly' : 'vehicle1-fly');
    // Engine flame behind the craft (the art faces right; it flies left, so the flame sits on the right)
    this.flame = scene.add.sprite(x, y, heavy ? 'v2-thrust1' : 'v1-thrust1').play(heavy ? 'v2-thrust' : 'v1-thrust')
      .setDepth(this.depth - 1).setVisible(false).setFlipX(true);
    this.nextShot = 0;
    this.on('destroy', () => this.flame.destroy());
  }

  onScreen(margin = 0) {
    // Wakes when its trigger point reaches the right edge of the screen
    const cam = this.scene.cameras.main;
    if (!this.awake) return this.x < cam.scrollX + W + margin + 40;
    return super.onScreen(margin);
  }

  onWake(time) {
    const cam = this.scene.cameras.main;
    this.x = cam.scrollX + W + 100;
    this.setVisible(true).setFlipX(true);
    this.flame.setVisible(true);
    this.body.enable = true;
    this.nextShot = time + 500;
    this.scene.sfx.play('bossJump', { vol: 0.6 });
  }

  think(time, dt, tank) {
    if (!this.awake) return;
    const s = this.stats;
    this.setVelocityX(-s.speed);
    this.y = this.baseY + Math.sin(time / 300) * 6;
    this.flame.setPosition(this.x + (this.heavy ? 92 : 86), this.y + (this.heavy ? 14 : 4));
    const dx = tank.x - this.x;
    if (tank.alive && time >= this.nextShot && Math.abs(dx) < 240) {
      if (this.heavy) {
        this.nextShot = time + s.heavyBombEveryMs;
        this.scene.weapons.fireEnemy('bomb', this.x, this.y + 40);
      } else {
        this.nextShot = time + s.fireEveryMs;
        const gx = this.x - 70, gy = this.y + 18;
        const base = Phaser.Math.Angle.Between(gx, gy, tank.x + tank.speedX * 0.4, tank.centerY);
        const step = Phaser.Math.DegToRad(s.fanDeg);
        for (let i = 0; i < s.fanCount; i++) this.scene.weapons.fireEnemy('ebolt', gx, gy, base + (i - (s.fanCount - 1) / 2) * step);
      }
    }
    // Off the left edge: gone
    if (this.x < this.scene.cameras.main.scrollX - 200) this.destroy();
  }
}
