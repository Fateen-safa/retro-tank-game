import Enemy from './Enemy.js';

// Level 3 final boss (M3-2): the dreadnought (flying vehicle 3).
//  Phase 1: fans of bolts, and calls in flyer minions.
//  Phase 2: adds a sweeping waveform beam with one safe gap, plus sky rain.
//  Phase 3: enraged — thrusters flare, it roams the arena, wider fans, homing fireballs, constant rain.
// The art faces right; it is flipped to face the player coming from the left.
export default class Dreadnought extends Enemy {
  constructor(scene, x, stats) {
    super(scene, x, stats.hoverY, 'vehicle3', stats, 'dreadnought');
    this.isBoss = true;
    this.homeX = x;
    this.setOrigin(0.5, 0.5).setFlipX(true);
    this.body.setSize(250, 96, false).setOffset(40, 36);
    // Engine flames: rear (right side when flipped) and belly (shown when enraged)
    this.backFlame = scene.add.sprite(x, 0, 'v3-back1').play('v3-back').setFlipX(true).setDepth(this.depth - 1);
    this.bellyFlames = [-60, 40].map(() => scene.add.sprite(x, 0, 'v3-bottom1').play('v3-bottom').setDepth(this.depth - 1).setVisible(false));
    this.glow = scene.add.sprite(x, 0, 'charged', 0).setDepth(this.depth + 1).setVisible(false);
    this.on('destroy', () => { this.backFlame.destroy(); this.bellyFlames.forEach((f) => f.destroy()); this.glow.destroy(); });
    this.reset();
  }

  // ---- Boss interface ----
  get name() { return 'DREADNOUGHT'; }
  get portrait() { return 'portrait-boss3'; }
  get parts() { return [this]; }
  get maxHp() { return this.stats.hp; }
  get cfg() { return this.stats.phases[this.phase - 1]; }
  get rainEveryMs() { return this.cfg.rainEveryMs; }
  get finalFx() { return 'explosion-e'; }
  phaseText(p) {
    return p === 2 ? ['PHASE 2', 'BEAM SWEEPS - FIND THE GAP'] : ['RAGE MODE!', 'IT IS COMING FOR YOU'];
  }
  onDamaged() {
    if (this.hp <= 0) return { defeated: true, phase: 0 };
    const r = this.hp / this.stats.hp;
    const p = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    if (p === this.phase) return { defeated: false, phase: 0 };
    this.phase = p;
    if (p === 3) { this.setTint(0xff9a8a); this.bellyFlames.forEach((f) => f.setVisible(true)); }
    return { defeated: false, phase: p };
  }
  restoreTint() { if (this.phase === 3) this.setTint(0xff9a8a); }
  deathArea() { return { x: this.x, y: this.y, w: 260, h: 100, ground: this.scene.terrain.heightAt(this.x) }; }
  stop() { this.state = 'dead'; this.setVelocity(0, 0); this.body.enable = false; this.glow.setVisible(false); }
  destroyAll() { this.destroy(); }

  reset() {
    this.hp = this.stats.hp;
    this.dropsGiven = 0;
    this.phase = 1;
    this.awake = false;
    this.state = 'idle';
    this.attacks = 0;
    this.x = this.homeX;
    this.y = this.stats.hoverY;
    this.t = 0;
    this.clearTint();
    this.bellyFlames?.forEach((f) => f.setVisible(false));
    this.glow?.setVisible(false);
  }

  wake(time) {
    if (this.awake) return;
    this.awake = true;
    this.nextAttack = time + 1000;
    this.nextMinions = time + this.stats.minionEveryMs;
  }

  // Cannon at the nose (left side when facing left)
  get gun() { return { x: this.x - 150, y: this.y + 22 }; }

  update(time, dt, tank) { if (this.active) this.think(time, dt, tank); }

  think(time, dt, tank) {
    this.t += dt;
    const c = this.cfg;
    const A = this.scene.level.arena;
    // Movement: hover in place, or roam the top of the arena when enraged
    if (this.state !== 'dead') {
      if (this.phase === 3 && this.awake) {
        const tx = A.x + 320 + Math.sin(this.t * 0.5) * 170;
        this.x = Phaser.Math.Linear(this.x, tx, 0.02);
      }
      this.y = this.stats.hoverY + Math.sin(this.t * 1.6) * 8;
    }
    this.backFlame.setPosition(this.x + 170, this.y - 8);
    this.bellyFlames[0].setPosition(this.x - 60, this.y + 70);
    this.bellyFlames[1].setPosition(this.x + 50, this.y + 70);
    if (!this.awake || this.state === 'dead' || !tank.alive) { this.glow.setVisible(false); return; }

    if (this.state === 'idle' && time >= this.nextAttack) {
      this.attacks++;
      if (c.beamEvery && this.attacks % c.beamEvery === 0) this.startBeam(time, tank);
      else this.fan(time, tank);
    }
    if (this.state === 'charge') {
      const g = this.gun;
      const k = Phaser.Math.Clamp((time - this.stateStart) / this.stats.beamChargeMs, 0, 1);
      this.glow.setVisible(true).setPosition(g.x, g.y).setScale(0.4 + k).setAlpha(0.5 + k * 0.5).setFlipX(true);
      if (k >= 1) { this.state = 'beam'; this.stateStart = time; this.nextBeamShot = time; }
    } else if (this.state === 'beam') {
      const k = (time - this.stateStart) / this.stats.beamMs;
      const g = this.gun;
      this.glow.setPosition(g.x, g.y);
      // Sweep from aiming up-left to aiming down at the floor, skipping the safe gap
      const a = Phaser.Math.Linear(this.beamFrom, this.beamTo, k);
      if (time >= this.nextBeamShot && Math.abs(a - this.beamGap) > Phaser.Math.DegToRad(this.stats.beamGapDeg)) {
        this.nextBeamShot = time + this.stats.beamShotEveryMs;
        this.scene.weapons.fireEnemy('wave', g.x, g.y, a, 1.2);
      }
      if (k >= 1) { this.state = 'idle'; this.glow.setVisible(false); this.nextAttack = time + 1400 / c.speedScale; }
    }
    // Minions
    if (time >= this.nextMinions) {
      this.nextMinions = time + this.stats.minionEveryMs / c.speedScale;
      this.scene.spawnMinions(2);
    }
  }

  fan(time, tank) {
    const c = this.cfg;
    const g = this.gun;
    const base = Phaser.Math.Angle.Between(g.x, g.y, tank.x + tank.speedX * 0.5, tank.centerY);
    const step = Phaser.Math.DegToRad(c.fanDeg);
    for (let i = 0; i < c.fan; i++) this.scene.weapons.fireEnemy('ebolt', g.x, g.y, base + (i - (c.fan - 1) / 2) * step);
    for (let i = 0; i < c.homing; i++) this.scene.weapons.fireEnemy('fire', this.x, this.y - 40, -Math.PI / 2 + (i - 0.5) * 1.4);
    this.scene.cameras.main.shake(80, 0.004);
    this.nextAttack = time + this.stats.volleyEveryMs / c.speedScale;
  }

  startBeam(time, tank) {
    const g = this.gun;
    this.state = 'charge';
    this.stateStart = time;
    // Sweep covers everything from above the top platform down to the floor below the nose.
    // Angles are kept in 0..2π so the sweep goes through "left" (π), not through "right" (0).
    const wrap = (a) => (a < 0 ? a + Math.PI * 2 : a);
    this.beamFrom = wrap(Phaser.Math.Angle.Between(g.x, g.y, this.scene.level.arena.x, 40));
    this.beamTo = wrap(Phaser.Math.Angle.Between(g.x, g.y, g.x - 60, 340));
    // Safe gap: a random angle in the sweep that never fires
    this.beamGap = Phaser.Math.FloatBetween(Math.min(this.beamFrom, this.beamTo) + 0.15, Math.max(this.beamFrom, this.beamTo) - 0.15);
    this.scene.hud.showHint('BEAM CHARGING - FIND THE GAP, PARRY OR TELEPORT!', 1800);
    this.scene.sfx.play('charge', { vol: 1, detune: 0 });
    this.scene.sfx.play('bossWarning');
  }
}
