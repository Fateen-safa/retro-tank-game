import Enemy from './Enemy.js';

// Bipedal unit: walks toward the tank, stops in range and fires a Pulse aimed where the tank is going.
// Elite units (red) fire homing fireballs that can only be parried or escaped by teleporting.
export default class Bipedal extends Enemy {
  constructor(scene, x, stats, platform = null, elite = false) {
    super(scene, x, scene.terrain.standY(x, platform), 'bipedal', stats, 'bipedal', platform);
    this.elite = elite;
    if (elite) this.hp = stats.eliteHp;
    this.setOrigin(0.5, 1);
    this.body.setSize(36, 46, false).setOffset(22, 17);
    this.play('bipedal-walk');
    this.anims.pause();
    this.nextShot = 0;
    this.facing = -1;
    this.restoreTint();
  }

  restoreTint() { if (this.elite) this.setTint(0xff8a7a); }

  onWake(time) { this.nextShot = time + 900; }

  think(time, dt, tank) {
    this.clampToPlatform();
    this.y = this.standY();
    const dx = tank.x - this.x;
    this.facing = Math.sign(dx) || -1;
    this.setFlipX(this.facing < 0); // art faces right
    if (!this.awake || !tank.alive) { this.setVelocityX(0); this.anims.pause(); return; }

    const dist = Math.abs(dx);
    if (dist > this.stats.range && !this.stunned(time)) {
      this.setVelocityX(this.facing * this.stats.speed);
      this.anims.resume();
      if (this.clampToPlatform()) this.anims.pause();
    } else {
      this.setVelocityX(0);
      this.anims.pause();
    }
    if (time >= this.nextShot && dist < this.stats.range * 1.6) {
      const gx = this.x + 28 * this.facing, gy = this.y - 38;
      if (this.elite) {
        this.nextShot = time + this.stats.eliteFireEveryMs;
        this.scene.weapons.fireEnemy('fire', gx, gy, Phaser.Math.Angle.Between(gx, gy, tank.x, tank.centerY));
      } else {
        this.nextShot = time + this.stats.fireEveryMs;
        const speed = this.scene.stats.enemyShots.pulse.speed;
        const t = this.leadTarget(gx, gy, tank, speed);
        this.scene.weapons.fireEnemy('pulse', gx, gy, Phaser.Math.Angle.Between(gx, gy, t.x, t.y));
      }
    }
  }
}
