import Enemy from './Enemy.js';
import { spawnFx } from '../systems/Fx.js';

// One of the two Level 2 gunships (flying vehicle 2). The TwinGunships controller tells it what to do.
class Gunship extends Enemy {
  constructor(scene, x, y, stats, boss, side) {
    super(scene, x, y, 'vehicle2', stats, 'gunship');
    this.boss = boss;
    this.side = side; // -1 = starts on the left, 1 = right
    this.isBoss = true;
    this.homeX = x;
    this.homeY = y;
    this.setOrigin(0.5, 0.5);
    this.body.setSize(130, 56, false).setOffset(24, 40);
    this.play('vehicle2-fly');
    this.flame = scene.add.sprite(x, y, 'v2-thrust1').play('v2-thrust').setDepth(this.depth - 1);
    this.on('destroy', () => this.flame.destroy());
    this.mode = 'hover';
    this.target = { x, y };
    this.t = side * 2;
  }

  // The art faces right; face toward a direction and keep the engine flame behind
  face(dir) {
    this.setFlipX(dir < 0);
    this.flame.setFlipX(dir < 0).setPosition(this.x - dir * 92, this.y + 14);
  }

  update() { /* driven by TwinGunships */ }
}

// Level 2 boss: two gunships that take turns strafing, carpet-bombing and firing bolt volleys.
// When one goes down, the other enrages (faster, homing fire, sky rain).
export default class TwinGunships {
  constructor(scene, x, stats) {
    this.scene = scene;
    this.stats = stats;
    const A = scene.level.arena;
    this.left = A.x + 40;
    this.right = A.x + 600;
    this.ships = [
      new Gunship(scene, A.x + 170, stats.hoverY, stats, this, -1),
      new Gunship(scene, A.x + 470, stats.hoverY - 20, stats, this, 1),
    ];
    this.reset();
  }

  // ---- Boss interface ----
  get name() { return 'TWIN GUNSHIPS'; }
  get portrait() { return 'portrait-boss2'; }
  get parts() { return this.ships; }
  get alive() { return this.ships.filter((s) => s.active && s.hp > 0); }
  get active() { return this.alive.length > 0; }
  get hp() { return this.ships.reduce((a, s) => a + Math.max(0, s.active ? s.hp : 0), 0); }
  get maxHp() { return this.stats.hp * 2; }
  get phase() { return this.alive.length === 2 ? 1 : 3; }
  get rainEveryMs() { return this.phase === 3 ? 1800 : 0; }
  get finalFx() { return 'explosion-d'; }
  phaseText() { return ['RAGE MODE!', 'THE LAST GUNSHIP IS OUT FOR REVENGE']; }

  onDamaged(part) {
    if (part.hp > 0) return { defeated: false, phase: 0 };
    // One gunship down
    const rest = this.alive.filter((s) => s !== part);
    if (rest.length === 0) { this.lastDown = part; return { defeated: true, phase: 0 }; }
    this.killShip(part);
    this.enraged = true;
    return { defeated: false, phase: 3 };
  }

  killShip(s) {
    const scene = this.scene;
    s.body.enable = false;
    s.mode = 'dead';
    for (let i = 0; i < 5; i++) {
      scene.time.delayedCall(i * 140, () => {
        spawnFx(scene, s.x + Phaser.Math.Between(-60, 60), s.y + Phaser.Math.Between(-20, 30), 'explosion-b');
        scene.sfx.play('explodeSmall', { gapMs: 0 });
      });
    }
    scene.time.delayedCall(700, () => { spawnFx(scene, s.x, s.y, 'explosion-d'); scene.sfx.play('explodeBig'); s.destroy(); });
  }

  deathArea() { const s = this.lastDown || this.ships[0]; return { x: s.x, y: s.y, w: 140, h: 60, ground: this.scene.terrain.heightAt(s.x) }; }
  stop() { for (const s of this.ships) if (s.active) { s.body.enable = false; s.setVelocity(0, 0); s.mode = 'dead'; } }
  destroyAll() { for (const s of this.ships) if (s.active) s.destroy(); }

  reset() {
    this.awake = false;
    this.enraged = false;
    this.turn = 0;
    this.nextAttack = 0;
    for (const s of this.ships) {
      if (!s.active) continue;
      s.hp = this.stats.hp;
      s.x = s.homeX; s.y = s.homeY;
      s.mode = 'hover';
      s.target = { x: s.homeX, y: s.homeY };
      s.setVelocity(0, 0);
      s.face(-s.side);
    }
  }

  wake(time) {
    if (this.awake) return;
    this.awake = true;
    for (const s of this.ships) s.awake = true;
    this.nextAttack = time + 800;
  }

  get speedScale() { return this.enraged ? this.stats.enragedScale : 1; }

  // Start the next attack, alternating ships
  attack(time, tank) {
    const ships = this.alive;
    const actor = ships[this.turn % ships.length];
    const partner = ships.find((s) => s !== actor);
    this.turn++;
    const roll = this.turn % 3;
    if (roll === 1) this.startStrafe(actor, time);
    else if (roll === 2) this.startCarpet(actor, time);
    else this.volley(actor, tank);
    if (partner) this.scene.time.delayedCall(600, () => partner.active && partner.mode === 'hover' && this.volley(partner, this.scene.tank));
    if (this.enraged) {
      this.scene.time.delayedCall(900, () => {
        if (!actor.active || actor.mode === 'dead') return;
        for (let i = 0; i < 2; i++) this.scene.weapons.fireEnemy('fire', actor.x, actor.y + 20, -Math.PI / 2 + (i - 0.5) * 1.2);
      });
    }
    this.nextAttack = time + this.stats.attackGapMs / this.speedScale + (roll === 0 ? 0 : 1800);
  }

  volley(s, tank) {
    if (!s.active || !tank.alive) return;
    const n = this.stats.volley + (this.enraged ? 2 : 0);
    for (let i = 0; i < n; i++) {
      this.scene.time.delayedCall(i * 160, () => {
        if (!s.active || s.mode === 'dead') return;
        const dir = tank.x < s.x ? -1 : 1;
        const gx = s.x + dir * 70, gy = s.y + 24;
        const t = s.leadTarget(gx, gy, tank, this.scene.stats.enemyShots.ebolt.speed);
        this.scene.weapons.fireEnemy('ebolt', gx, gy, Phaser.Math.Angle.Between(gx, gy, t.x, t.y));
      });
    }
  }

  // Dive low and sweep across the arena, raining sparks
  startStrafe(s, time) {
    const fromLeft = s.x < (this.left + this.right) / 2;
    s.mode = 'strafe-in';
    s.target = { x: fromLeft ? this.left : this.right, y: this.stats.strafeY };
    s.strafeDir = fromLeft ? 1 : -1;
    s.nextDrop = 0;
    this.scene.warnAt(fromLeft ? this.left + 80 : this.right - 80, this.scene.terrain.heightAt(s.x), 700);
    this.scene.sfx.play('bossCrouch');
  }

  // Fly high across the arena dropping a line of bombs
  startCarpet(s) {
    const fromLeft = s.x < (this.left + this.right) / 2;
    s.mode = 'carpet-in';
    s.target = { x: fromLeft ? this.left : this.right, y: this.stats.hoverY - 30 };
    s.strafeDir = fromLeft ? 1 : -1;
    s.nextDrop = 0;
  }

  update(time, dt, tank) {
    const st = this.stats;
    const k = this.speedScale;
    for (const s of this.ships) {
      if (!s.active || s.mode === 'dead') continue;
      s.t += dt;
      if (!this.awake) { s.face(-s.side); s.y = s.homeY + Math.sin(s.t * 2) * 4; s.flame.setPosition(s.x + s.side * 92, s.y + 14); continue; }

      if (s.mode === 'hover' || s.mode === 'strafe-in' || s.mode === 'carpet-in' || s.mode === 'return') {
        const speed = (s.mode === 'hover' ? st.speed * 0.6 : st.speed * 1.6) * k;
        const dx = s.target.x - s.x, dy = s.target.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          s.setVelocity(0, 0);
          if (s.mode === 'strafe-in') { s.mode = 'strafe'; this.scene.sfx.play('flyerDive'); }
          else if (s.mode === 'carpet-in') s.mode = 'carpet';
          else if (s.mode === 'return') s.mode = 'hover';
        } else {
          s.setVelocity(dx / d * speed, dy / d * speed);
        }
        if (s.mode === 'hover') {
          // Drift between hover points on its side of the arena
          if (d < 6) s.target = { x: Phaser.Math.Between(this.left + 120, this.right - 120), y: st.hoverY + Phaser.Math.Between(-20, 20) };
          s.face(tank.x < s.x ? -1 : 1);
        } else s.face(Math.sign(dx) || 1);
      } else if (s.mode === 'strafe' || s.mode === 'carpet') {
        s.setVelocity(s.strafeDir * st.strafeSpeed * k, 0);
        s.face(s.strafeDir);
        if (time >= s.nextDrop) {
          if (s.mode === 'strafe') {
            s.nextDrop = time + st.strafeShotEveryMs / k;
            this.scene.weapons.fireEnemy('spark', s.x, s.y + 30, Math.PI / 2 + s.strafeDir * 0.35);
          } else {
            s.nextDrop = time + st.carpetEveryMs / k;
            this.scene.weapons.fireEnemy('bomb', s.x, s.y + 40);
          }
        }
        const done = s.strafeDir > 0 ? s.x >= this.right : s.x <= this.left;
        if (done) { s.mode = 'return'; s.target = { x: (this.left + this.right) / 2 + s.side * 150, y: st.hoverY }; }
      }
      s.y += Math.sin(s.t * 3) * 0.3;
      s.flame.setPosition(s.x - (s.flipX ? -1 : 1) * 92, s.y + 14);
    }
    if (this.awake && tank.alive && time >= this.nextAttack && this.alive.every((s) => s.mode === 'hover' || s.mode === 'return')) {
      this.attack(time, tank);
    }
  }
}
