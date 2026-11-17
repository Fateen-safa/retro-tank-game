import Enemy from './Enemy.js';
import { spawnFx } from '../systems/Fx.js';

// Mech unit boss with three phases (M2-4, reworked for challenge):
//  1. Stomps toward the tank and fires aimed Spark bursts.
//  2. Adds a jump-stomp: telegraphed leap, ground shockwaves both ways, and sky rain.
//  3. Rage: faster, longer bursts, homing fireballs, constant rain.
// Asleep until the arena locks; GameScene calls wake().
export default class MechBoss extends Enemy {
  constructor(scene, x, stats) {
    super(scene, x, scene.terrain.heightAt(x), 'mech', stats, 'mech');
    this.homeX = x;
    this.setOrigin(0.5, 1);
    this.body.setSize(44, 60, false).setOffset(24, 20);
    this.play('mech-walk');
    this.anims.pause();
    this.isBoss = true;
    this.deathFx = null; // handled by GameScene's boss death sequence
    this.reset();

    // Stomp: every footfall frame shakes the screen and kicks up dust
    this.on('animationupdate', (_a, frame) => {
      if (this.state === 'walk' && (frame.index === 3 || frame.index === 8)) this.stomp(0.4);
    });
  }

  reset() {
    this.hp = this.stats.hp;
    this.dropsGiven = 0;
    this.x = this.homeX;
    this.y = this.terrain.heightAt(this.x);
    this.state = 'sleep';
    this.phase = 1;
    this.awake = false;
    this.jumpCount = 0;
    this.setVelocityX(0);
    this.clearTint();
    if (this.anims) this.anims.pause();
  }

  // ---- Boss interface used by GameScene (shared by all bosses) ----
  get name() { return 'MECH UNIT'; }
  get portrait() { return 'portrait-boss'; }
  get parts() { return [this]; }
  get maxHp() { return this.stats.hp; }
  get rainEveryMs() { return this.cfg.rainEveryMs; }
  get finalFx() { return 'ground-explosion'; }
  phaseText(p) {
    return p === 2 ? ['PHASE 2', 'IT CAN JUMP NOW - GET OFF THE FLOOR'] : ['RAGE MODE!', 'HOMING FIRE - PARRY OR TELEPORT'];
  }
  // A part took damage: report what happened
  onDamaged() { return { defeated: this.hp <= 0, phase: this.hp > 0 ? this.updatePhase() : 0 }; }
  deathArea() { return { x: this.x, y: this.y - 40, w: 56, h: 70, ground: this.y }; }
  stop() { this.state = 'dead'; this.setVelocityX(0); this.anims.pause(); this.body.enable = false; }
  destroyAll() { this.destroy(); }

  // The boss only wakes when the arena locks.
  update(time, dt, tank) {
    if (!this.active) return;
    this.think(time, dt, tank);
  }

  wake(time) {
    if (this.state !== 'sleep') return;
    this.awake = true;
    this.enter('walk', time);
  }

  get cfg() { return this.stats.phases[this.phase - 1]; }

  restoreTint() { if (this.phase === 3) this.setTint(0xff9a8a); }

  // Check HP thresholds; returns the new phase number if it changed.
  updatePhase() {
    const r = this.hp / this.stats.hp;
    const p = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    if (p === this.phase) return 0;
    this.phase = p;
    this.restoreTint();
    return p;
  }

  enter(state, time) {
    this.state = state;
    const c = this.cfg;
    if (state === 'walk') {
      this.stateUntil = time + this.stats.walkMs;
      this.anims.resume();
      this.anims.timeScale = c.speedScale;
    } else if (state === 'shoot') {
      this.setVelocityX(0);
      this.anims.pause();
      this.shotsLeft = c.burst;
      this.nextShot = time + 250;
    } else if (state === 'rest') {
      this.setVelocityX(0);
      this.anims.pause();
      this.stateUntil = time + this.stats.restMs / c.speedScale;
    } else if (state === 'crouch') {
      this.setVelocityX(0);
      this.anims.pause();
      this.stateUntil = time + this.stats.crouchMs;
    }
  }

  stomp(scale) {
    this.scene.cameras.main.shake(90, 0.006);
    if (scale < 1) this.scene.sfx.at('bossStomp', this.x, { vol: 0.7 });
    spawnFx(this.scene, this.x + 14 * (this.flipX ? -1 : 1), this.y + 6, 'ground-explosion', { originY: 1, scale });
  }

  // Next move after a burst: phase 2+ alternates in a jump-stomp.
  afterBurst(time, tank) {
    if (this.phase >= 2) {
      this.jumpCount++;
      // Land where the tank is if it's on the ground; otherwise land in the middle of the arena
      const A = this.scene.level.arena;
      const target = tank.platform ? A.x + 320 : tank.x;
      this.jumpFrom = this.x;
      this.jumpTo = Phaser.Math.Clamp(target, A.x + 60, A.x + 580);
      this.scene.warnAt(this.jumpTo, this.terrain.heightAt(this.jumpTo), this.stats.crouchMs + this.stats.jumpMs);
      this.enter('crouch', time);
      this.scene.sfx.play('bossCrouch');
    } else {
      this.enter('rest', time);
    }
  }

  think(time, dt, tank) {
    if (this.state === 'sleep' || this.state === 'dead') { this.setVelocityX(0); return; }
    if (!tank.alive) { this.setVelocityX(0); this.anims.pause(); return; }
    const c = this.cfg;
    const dir = Math.sign(tank.x - this.x) || -1;
    if (this.state !== 'jump') this.y = this.terrain.heightAt(this.x);
    this.setFlipX(dir < 0);

    if (this.state === 'walk') {
      // Stay out of ramming range when the tank is on the ground; walk under it when it's on a platform
      const tooClose = !tank.platform && Math.abs(tank.x - this.x) < 110;
      this.setVelocityX(tooClose ? 0 : dir * this.stats.speed * c.speedScale);
      if (time >= this.stateUntil) this.enter('shoot', time);
    } else if (this.state === 'shoot') {
      if (time >= this.nextShot) {
        this.nextShot = time + this.stats.burstGapMs / c.speedScale;
        this.shotsLeft--;
        const gx = this.x + 30 * dir, gy = this.y - 52;
        const speed = this.scene.stats.enemyShots.spark.speed;
        const t = this.leadTarget(gx, gy, tank, speed);
        const jitter = Phaser.Math.Between(-c.aimJitter, c.aimJitter);
        this.scene.weapons.fireEnemy('spark', gx, gy, Phaser.Math.Angle.Between(gx, gy, t.x + jitter, t.y), 1, 'bossShot');
        if (this.shotsLeft <= 0) {
          for (let i = 0; i < c.homing; i++) {
            const a = -Math.PI / 2 + (i - (c.homing - 1) / 2) * 0.8;
            this.scene.weapons.fireEnemy('fire', this.x, this.y - 70, a);
          }
          this.afterBurst(time, tank);
        }
      }
    } else if (this.state === 'rest' && time >= this.stateUntil) {
      this.enter('walk', time);
    } else if (this.state === 'crouch') {
      // Telegraph: flash before the leap
      if (Math.floor(time / 90) % 2) this.setTintFill(0xffe0a0); else { this.clearTint(); this.restoreTint(); }
      if (time >= this.stateUntil) {
        this.clearTint(); this.restoreTint();
        this.state = 'jump';
        this.jumpStart = time;
        this.scene.sfx.play('bossJump');
      }
    } else if (this.state === 'jump') {
      const t = Phaser.Math.Clamp((time - this.jumpStart) / this.stats.jumpMs, 0, 1);
      this.x = Phaser.Math.Linear(this.jumpFrom, this.jumpTo, t);
      const gy = this.terrain.heightAt(this.x);
      this.y = gy - Math.sin(t * Math.PI) * this.stats.jumpHeight;
      this.setVelocityX(0);
      if (t >= 1) this.land(time, tank);
    }
  }

  land(time, tank) {
    const s = this.scene;
    this.y = this.terrain.heightAt(this.x);
    this.stomp(1);
    s.sfx.play('bossLand');
    s.cameras.main.shake(260, 0.016);
    // Crushed if standing where it lands
    if (!tank.platform && Math.abs(tank.x - this.x) < 70) s.hurtTank(this.stats.landDamage);
    // Shockwaves along the arena floor in both directions (parry them or get off the ground)
    const gy = this.y - 14;
    s.weapons.fireEnemy('wave', this.x + 40, gy, 0);
    s.weapons.fireEnemy('wave', this.x - 40, gy, Math.PI);
    s.rainBurst(this.cfg.rain, s.level.arena.x + 20, s.level.arena.x + 620);
    this.enter('rest', time);
  }
}
