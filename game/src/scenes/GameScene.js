import { W, H, DEPTH, LEVELS, textStyle, addBackground } from '../constants.js';
import Terrain from '../systems/Terrain.js';
import Weapons from '../systems/Weapons.js';
import Hud from '../systems/Hud.js';
import { spawnFx } from '../systems/Fx.js';
import Sfx from '../systems/Sfx.js';
import ScreenFx from '../systems/ScreenFx.js';
import { submitScore, getBest, unlockLevel } from '../systems/Save.js';
import Music from '../systems/Music.js';
import Tank from '../entities/Tank.js';
import Walker from '../entities/Walker.js';
import Flyer from '../entities/Flyer.js';
import Bipedal from '../entities/Bipedal.js';
import Bomber from '../entities/Bomber.js';
import MechBoss from '../entities/MechBoss.js';
import TwinGunships from '../entities/TwinGunships.js';
import Dreadnought from '../entities/Dreadnought.js';
import Strafer from '../entities/Strafer.js';
import Crate from '../entities/Crate.js';
import Pickup from '../entities/Pickup.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  // data: { level: index into LEVELS, score: carried over from the previous level }
  init(data) {
    this.levelIndex = Phaser.Math.Clamp(data?.level ?? 0, 0, LEVELS.length - 1);
    this.startScore = data?.score ?? 0;
  }

  create() {
    this.stats = this.cache.json.get('stats');
    this.level = this.cache.json.get(LEVELS[this.levelIndex]);
    this.score = this.startScore;
    this.parries = 0;
    this.lives = this.stats.tank.lives;
    this.startTime = this.time.now;
    this.ended = false;
    this.respawning = false;
    this.arenaLocked = false;
    this.bossDown = false;
    this.checkpointReached = false;
    this.teleportReadyAt = 0;
    this.nextRain = 0;
    this.frozenUntil = 0;
    this.nextLowHpBeep = 0;
    this.sfx = new Sfx(this);
    // Tutorial hints are shown once per browser session
    this.hintsSeen = this.registry.get('hintsSeen') || new Set();
    this.registry.set('hintsSeen', this.hintsSeen);

    const L = this.level;
    const cam = this.cameras.main;
    this.setWorldBounds(0, L.width);
    cam.setBackgroundColor(L.skyColor);

    this.terrain = new Terrain(this, L.ground, L.width, L.platforms || [], L.tiles || null);
    this.buildLevel();

    // Player and weapons
    this.weapons = new Weapons(this, this.stats);
    this.tank = new Tank(this, L.playerStart, this.stats.tank, this.terrain);
    cam.startFollow(this.tank.hull, true, 0.12, 0.12, 0, 0);
    cam.setDeadzone(60, H);
    cam.setFollowOffset(-110, 0); // see more of what's ahead

    // Enemies, crates, boss
    this.enemies = this.physics.add.group();
    const E = this.stats.enemies;
    const plat = (i) => (i === undefined || i === null ? null : this.terrain.platforms[i]);
    const make = {
      walker: (e) => new Walker(this, e.x, E.walker, plat(e.p)),
      flyer: (e) => new Flyer(this, e.x, E.flyer, e.y),
      bipedal: (e) => new Bipedal(this, e.x, E.bipedal, plat(e.p), !!e.elite),
      bomber: (e) => new Bomber(this, e.x, E.bomber),
      strafer: (e) => new Strafer(this, e.x, E.strafer, e.y, !!e.heavy),
    };
    for (const e of L.enemies) this.enemies.add(make[e.type](e));
    for (const c of L.crates || []) this.enemies.add(new Crate(this, c.x, E.crate, c.drop, plat(c.p)));
    const B = L.boss || 'mech';
    if (B === 'twin') this.boss = new TwinGunships(this, L.arena.bossX, E.gunship);
    else if (B === 'dreadnought') this.boss = new Dreadnought(this, L.arena.bossX, E.dreadnought);
    else this.boss = new MechBoss(this, L.arena.bossX, E.mech);
    for (const part of this.boss.parts) this.enemies.add(part);
    this.bossDrops = 0;

    this.pickups = this.add.group();

    // Collisions
    this.physics.add.overlap(this.weapons.playerShots, this.enemies, (shot, enemy) => this.onShotHitsEnemy(shot, enemy));
    this.physics.add.overlap(this.tank.hull, this.weapons.enemyShots, (_hull, shot) => this.onShotHitsTank(shot));
    this.physics.add.overlap(this.tank.hull, this.enemies, (_hull, enemy) => this.onEnemyTouchesTank(enemy));
    this.physics.add.overlap(this.tank.hull, this.pickups, (_hull, p) => this.collect(p));

    // Input
    this.keys = this.input.keyboard.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,F1,ESC,P');
    this.keys.ESC.on('down', () => this.pause());
    this.keys.P.on('down', () => this.pause());
    this.game.events.on('blur', this.onBlur, this);
    this.events.once('shutdown', () => this.game.events.off('blur', this.onBlur, this));
    this.input.mouse?.disableContextMenu();
    this.keys.F1.on('down', () => this.toggleDebug());
    this.keys.SPACE.on('down', () => this.tryParry());
    this.keys.W.on('down', () => this.tryTeleport());
    this.keys.UP.on('down', () => this.tryTeleport());
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) this.tryParry();
      else if (p.leftButtonDown()) this.weapons.press(this.time.now);
    });
    this.input.on('pointerup', (p) => {
      if (p.rightButtonReleased && p.rightButtonReleased()) return;
      this.weapons.release(this.time.now, this.tank.muzzle, this.canFire());
    });

    this.screenFx = new ScreenFx(this);
    this.hud = new Hud(this, this.stats.tank.hp, this.stats.tank.lives);
    this.hud.setHp(this.tank.hp);
    this.hud.setLives(this.lives);
    this.hud.setScore(this.score);
    this.hud.setBoss(null);
    this.hud.setParry(1);
    this.hud.flash(L.name.toUpperCase(), 2400, `LEVEL ${this.levelIndex + 1}`);
    this.music = Music.get(this);
    this.music.play(L.music || 'level1');
    this.hint('move', 'A/D DRIVE   MOUSE AIM   CLICK FIRE', 4500);
    cam.fadeIn(500, 16, 18, 28);
  }

  // ---------- Game feel helpers ----------

  // Show a tutorial hint the first time something happens
  hint(id, text, ms = 3800) {
    if (this.hintsSeen.has(id)) return;
    this.hintsSeen.add(id);
    this.hud.showHint(text, ms);
  }

  // Freeze the action for a few milliseconds to make big hits land harder
  hitStop(ms) {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
    this.physics.world.pause();
  }

  pause() {
    if (this.ended || this.scene.isPaused()) return;
    this.weapons.release(this.time.now, this.tank.muzzle, false);
    this.sfx.play('uiBack');
    this.scene.launch('Pause');
    this.scene.pause();
  }

  onBlur() { if (!this.ended && !this.scene.isPaused()) this.pause(); }

  goTo(sceneKey, data) {
    this.cameras.main.fadeOut(350, 16, 18, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey, data));
  }

  setWorldBounds(x, width) {
    this.physics.world.setBounds(x, 0, width, H);
    this.cameras.main.setBounds(x, 0, width, H);
  }

  buildLevel() {
    const L = this.level;
    this.scrollBg = addBackground(this, L.background || undefined);

    const decorTex = L.tiles?.texture || 'aw-tiles';
    for (const d of L.decor) {
      const y = this.terrain.standY(d.x, d.p === undefined ? null : this.terrain.platforms[d.p]);
      this.add.image(d.x, y + (d.dy || 0), d.texture || decorTex, d.frame).setOrigin(0.5, 1).setDepth(DEPTH.decor);
    }
    this.terrain.render();

    // Checkpoint beacon (M2-7)
    const cx = L.checkpointX;
    this.checkpoint = this.add.image(cx, this.terrain.heightAt(cx), 'aw-tiles', 'beacon').setOrigin(0.5, 1).setDepth(DEPTH.decor).setAlpha(0.55);

    // Teleporter pads: a floating energy orb above the surface, linked in pairs
    this.pads = (L.teleporters || []).map((t) => {
      const platform = t.p === undefined || t.p === null ? null : this.terrain.platforms[t.p];
      const y = this.terrain.standY(t.x, platform);
      const orb = this.add.sprite(t.x, y - 26, 'energy-shield', 0).setDepth(DEPTH.pad).play('pad-orb');
      const base = this.add.image(t.x, y, 'aw-tiles', 'block-small').setOrigin(0.5, 1).setScale(1.5, 0.5).setTint(0x7fe3ff).setDepth(DEPTH.pad);
      return { ...t, platform, y, orb, base };
    });
    for (const pad of this.pads) {
      pad.dest = this.pads.find((o) => o.id === pad.to);
      const up = pad.dest && pad.dest.y < pad.y;
      pad.label = this.add.text(pad.x, pad.y - 58, up ? 'W  UP' : 'W  DOWN', textStyle(8, '#7fe3ff')).setOrigin(0.5).setDepth(DEPTH.hud - 1).setVisible(false);
    }

    // Arena wall on the left side, shown once the fight starts
    const ax = L.arena.x;
    this.arenaGate = this.add.image(ax + 8, this.terrain.heightAt(ax + 8), 'aw-tiles', 'gate').setOrigin(0.5, 1).setDepth(DEPTH.tank + 1).setVisible(false);
  }

  canFire() { return !this.ended && this.tank.alive && !this.respawning; }

  toggleDebug() {
    const world = this.physics.world;
    if (!world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = !world.drawDebug;
    world.debugGraphic.clear();
  }

  addScore(n) {
    this.score += n;
    this.hud.setScore(this.score);
  }

  // ---------- Parry & teleport ----------

  tryParry() {
    if (!this.canFire()) return;
    if (this.tank.parry(this.time.now)) { this.sfx.play('parryUp', { vol: 0.6 }); this.checkParry(); }
  }

  // While the shield is up, deflect every enemy shot that reaches it.
  checkParry() {
    const t = this.tank, now = this.time.now;
    if (!t.parrying(now)) return;
    const r = this.stats.tank.parryRadius;
    let any = false;
    for (const b of this.weapons.enemyShots.getChildren().slice()) {
      if (Phaser.Math.Distance.Between(b.x, b.y, t.x, t.centerY) > r) continue;
      this.weapons.reflect(b, this.nearestEnemy(b.x, b.y));
      this.parries++;
      this.addScore(this.stats.parry.score);
      any = true;
    }
    if (any) {
      t.parrySuccess(now);
      this.hitStop(60);
      this.cameras.main.shake(70, 0.005);
      this.hud.flash('PARRY!', 500);
    }
  }

  nearestEnemy(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies.getChildren()) {
      if (!e.active || e.hp <= 0 || e.harmless || (e.isBoss && !this.boss.awake)) continue;
      if (!e.onScreen(0)) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  padUnderTank() {
    const t = this.tank;
    if (!t.alive || t.airborne) return null;
    return this.pads.find((p) => p.platform === t.platform && Math.abs(p.x - t.x) < this.stats.teleport.range) || null;
  }

  tryTeleport() {
    const now = this.time.now;
    if (!this.canFire() || now < this.teleportReadyAt) return;
    const pad = this.padUnderTank();
    if (!pad || !pad.dest) return;
    const d = pad.dest;
    this.teleportReadyAt = now + this.stats.teleport.cooldownMs;
    spawnFx(this, this.tank.x, this.tank.centerY, 'teleport');
    this.tank.teleportTo(now, d.x, d.platform);
    spawnFx(this, d.x, d.y - 26, 'teleport');
    this.weapons.fizzleHoming();
    this.cameras.main.flash(80, 127, 227, 255);
    this.sfx.play('teleport');
  }

  // ---------- Hazards ----------

  // Blinking red marker where something is about to land.
  warnAt(x, y, ms) {
    const m = this.add.sprite(x, y - 6, 'energy-smack', 4).setTint(0xff5a4a).setDepth(DEPTH.fx);
    const blink = this.time.addEvent({ delay: 90, loop: true, callback: () => m.setVisible(!m.visible) });
    this.sfx.at('rainWarn', x, { vol: 0.6, gapMs: 90 });
    this.time.delayedCall(ms, () => { blink.remove(); m.destroy(); });
  }

  // Bullets falling from the sky, with a warning on the surface below each one.
  rainBurst(count, xMin, xMax) {
    const warn = this.stats.rain.warnMs;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(Math.round(xMin), Math.round(xMax));
      const surf = this.terrain.supportBelow(x, -1000);
      this.time.delayedCall(i * 110, () => {
        if (this.ended) return;
        this.warnAt(x, surf.y, warn);
        this.time.delayedCall(warn, () => { if (!this.ended) this.weapons.fireEnemy('rain', x, -16, Math.PI / 2); });
      });
    }
  }

  updateRain(time) {
    const t = this.tank;
    if (!t.alive || time < this.nextRain) return;
    // Rain zones in the level
    for (const z of this.level.rain || []) {
      if (t.x >= z.x0 && t.x <= z.x1) {
        this.nextRain = time + z.everyMs;
        this.hint('rain', 'INCOMING FROM ABOVE!  WATCH THE RED MARKERS - PLATFORMS GIVE COVER');
        const s = this.stats.rain.spreadX;
        this.rainBurst(z.count, Math.max(z.x0, t.x - s), Math.min(z.x1, t.x + s + 80));
        return;
      }
    }
    // Boss rage phase: constant light rain
    const b = this.boss;
    if (this.arenaLocked && b.active && b.awake && b.rainEveryMs) {
      this.nextRain = time + b.rainEveryMs;
      this.rainBurst(2, t.x - 120, t.x + 120);
    }
  }

  // ---------- Collisions ----------

  onShotHitsEnemy(shot, enemy) {
    if (!shot.active || !enemy.active || enemy.hp <= 0) return;
    if (enemy.isBoss && (!this.boss.awake || this.bossDown)) return; // sleeping boss is out of reach
    if (shot.hitSet.has(enemy)) return;       // a piercing shot hits each enemy once
    shot.hitSet.add(enemy);
    this.weapons.impact(shot, true);
    const dead = enemy.hit(shot.damage);
    if (!enemy.isBoss) { if (dead) this.killEnemy(enemy); return; }

    const boss = this.boss;
    const res = boss.onDamaged(enemy);
    this.hud.setBoss(boss.hp, boss.maxHp, boss.phase);
    if (res.defeated) { this.bossDefeated(); return; }
    // Health gems at set HP thresholds keep the fight fair
    const drops = boss.stats.healthDrops || [];
    const next = drops[this.bossDrops];
    if (next !== undefined && boss.hp <= next) {
      this.bossDrops++;
      this.spawnPickup(enemy.x, enemy.y - 40, 'health');
    }
    if (res.phase) {
      const [title, sub] = boss.phaseText(res.phase);
      this.hud.flash(title, 1400, sub);
      this.cameras.main.shake(300, 0.012);
      this.sfx.play('bossPhase');
      this.hitStop(150);
      spawnFx(this, enemy.x, enemy.y - 20, 'teleport');
      if (res.phase === 3) this.music.play('boss', 1.15);
    }
  }

  // Dreadnought minions: a pair of flyers swooping in from the right
  spawnMinions(n) {
    const cam = this.cameras.main;
    for (let i = 0; i < n; i++) {
      const f = new Flyer(this, cam.scrollX + W + 40 + i * 60, this.stats.enemies.flyer, 200 + i * 40);
      f.awake = true;
      f.dir = -1;
      this.enemies.add(f);
    }
  }

  onShotHitsTank(shot) {
    if (!shot.active || !this.tank.alive) return;
    if (this.tank.parrying(this.time.now)) {
      // Anything that touches the tank while the shield is up gets deflected
      this.weapons.reflect(shot, this.nearestEnemy(shot.x, shot.y));
      this.parries++;
      this.addScore(this.stats.parry.score);
      this.tank.parrySuccess(this.time.now);
      this.hitStop(60);
      this.hud.flash('PARRY!', 500);
      return;
    }
    const dmg = shot.damage;
    if (shot.kind === 'bomb') this.bombBlast(shot.x, this.terrain.supportBelow(shot.x, shot.y - 20).y, dmg);
    this.weapons.impact(shot, true);
    this.hurtTank(dmg);
  }

  onEnemyTouchesTank(enemy) {
    if (!enemy.active || enemy.harmless || this.ended || enemy.hp <= 0) return;
    if (enemy.isBoss && (!this.boss.awake || this.bossDown)) return;
    if (!this.hurtTank(enemy.stats.contactDamage)) return;
    if (!enemy.isBoss) { enemy.knockBack(this.tank.x); return; }
    // The boss doesn't budge: shove the tank away instead
    const b = this.physics.world.bounds;
    const hull = this.tank.hull;
    hull.x = Phaser.Math.Clamp(hull.x + Math.sign(hull.x - enemy.x || -1) * 48, b.x + 50, b.right - 50);
  }

  bombBlast(x, y, dmg) {
    this.cameras.main.shake(140, 0.01);
    const t = this.tank;
    if (t.alive && Math.abs(t.x - x) < this.stats.enemyShots.bomb.blastRadius + 40 && Math.abs(t.y - y) < 30) this.hurtTank(dmg);
  }

  hurtTank(dmg) {
    const t = this.tank;
    if (!t.damage(this.time.now, dmg)) return false;
    spawnFx(this, t.x + Phaser.Math.Between(-20, 20), t.y - 30, 'hits-6');
    this.cameras.main.shake(120, 0.008);
    this.sfx.play('playerHit');
    this.screenFx.hurt();
    this.hitStop(50);
    this.hud.setHp(t.hp, true);
    if (!t.alive) this.tankDestroyed();
    return true;
  }

  collect(p) {
    if (!p.active || !this.tank.alive) return;
    const now = this.time.now;
    if (p.type === 'health') {
      this.tank.heal(1);
      this.hud.setHp(this.tank.hp);
      this.hud.flash('+1 ARMOR', 900);
      this.sfx.play('heal');
    } else {
      this.weapons.setPower(p.type, now);
      this.hud.flash(p.type === 'spread' ? 'SPREAD SHOT' : 'CHARGE SHOT', 1100);
      this.sfx.play('powerUp');
      if (p.type === 'charged') this.hint('charged', 'HOLD THE MOUSE BUTTON, RELEASE TO FIRE A PIERCING BLAST');
    }
    spawnFx(this, p.x, p.y - 8, 'hits-4');
    this.addScore(50);
    p.destroy();
  }

  // ---------- Spawning / dying ----------

  spawnPickup(x, y, type) {
    const p = new Pickup(this, x, y, type, this.stats.powerUps.pickupLifetimeMs);
    this.pickups.add(p);
    return p;
  }

  rollDrop(enemy) {
    if (enemy.drop) return enemy.drop;
    if (Math.random() >= (enemy.stats.dropChance || 0)) return null;
    const weights = this.stats.powerUps.dropWeights;
    let r = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    for (const [type, w] of Object.entries(weights)) { if ((r -= w) < 0) return type; }
    return null;
  }

  killEnemy(enemy) {
    const y = enemy.type === 'crate' ? enemy.y - 8 : enemy.body.center.y;
    spawnFx(this, enemy.x, y, enemy.deathFx);
    if (enemy.deathFx === 'explosion-b') { this.cameras.main.shake(100, 0.006); this.hitStop(35); }
    this.sfx.at(enemy.type === 'walker' ? 'squish' : enemy.type === 'crate' ? 'crateBreak' : 'explodeSmall', enemy.x);
    this.addScore(enemy.stats.score * (enemy.elite ? 2 : 1));
    const drop = this.rollDrop(enemy);
    if (drop) this.spawnPickup(enemy.x, y, drop);
    enemy.destroy();
  }

  tankDestroyed() {
    const t = this.tank;
    const x = t.x, y = t.y;
    t.hide();
    this.weapons.clearPower();
    this.cameras.main.shake(300, 0.015);
    const boom = spawnFx(this, x, y + 2, 'tank-explode', { originY: 1 });
    this.sfx.play('tankDeath');
    this.hitStop(200);
    this.lives--;
    this.hud.setLives(this.lives);
    this.respawning = true;
    boom.once('animationcomplete', () => {
      if (this.lives <= 0) { this.endGame(false); return; }
      this.time.delayedCall(400, () => this.respawn());
    });
  }

  respawn() {
    const L = this.level;
    const x = this.checkpointReached ? L.checkpointX : L.playerStart;
    // Leaving the arena resets the fight
    if (this.arenaLocked) {
      this.arenaLocked = false;
      this.setWorldBounds(0, L.width);
      this.arenaGate.setVisible(false);
      this.boss.reset();
      this.bossDrops = 0;
      this.hud.setBoss(null);
      this.music.play(this.level.music || 'level1');
    }
    // Clear enemies right on top of the respawn point
    for (const e of this.enemies.getChildren()) {
      if (!e.isBoss && e.type !== 'crate' && Math.abs(e.x - x) < 120) e.destroy();
    }
    this.weapons.enemyShots.clear(true, true);
    this.tank.respawn(this.time.now, x);
    this.sfx.play('respawn');
    spawnFx(this, x, this.tank.centerY, 'teleport');
    this.cameras.main.centerOn(x + 110, H / 2);
    this.hud.setHp(this.tank.hp);
    this.respawning = false;
  }

  lockArena() {
    const A = this.level.arena;
    this.arenaLocked = true;
    this.setWorldBounds(A.x, W);
    this.arenaGate.setVisible(true);
    const boss = this.boss;
    this.hud.flash('WARNING!', 1800, `${boss.name} APPROACHING`);
    this.sfx.play('bossWarning');
    this.hud.setBossInfo(boss.name, boss.portrait);
    this.hud.setBoss(boss.hp, boss.maxHp, boss.phase);
    this.music.play('boss');
    this.hint('arena', 'USE THE TELEPORTERS TO SWITCH FLOORS', 4000);
    this.time.delayedCall(1200, () => { if (this.arenaLocked) this.boss.wake(this.time.now); });
  }

  bossDefeated() {
    const boss = this.boss;
    this.bossDown = true;
    boss.stop();
    this.hud.setBoss(0, boss.maxHp, boss.phase);
    this.weapons.enemyShots.clear(true, true);
    this.addScore(boss.stats.score);
    this.music.stop(600);
    const a = boss.deathArea();
    const big = boss.finalFx === 'explosion-e';
    const chainFx = big ? 'explosion-d' : 'explosion-b';
    const n = big ? 14 : 9;
    // Chain of explosions across the boss, then the big one
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 150, () => {
        spawnFx(this, a.x + Phaser.Math.Between(-a.w / 2, a.w / 2), a.y + Phaser.Math.Between(-a.h / 2, a.h / 2), chainFx, { scale: big ? 0.75 : 1 });
        this.cameras.main.shake(120, 0.01);
        this.sfx.play('explodeSmall', { gapMs: 0 });
      });
    }
    this.time.delayedCall(n * 150 + 150, () => {
      if (boss.finalFx === 'ground-explosion') spawnFx(this, a.x, a.ground + 4, 'ground-explosion', { originY: 1, scale: 1.5 });
      else spawnFx(this, a.x, a.y, boss.finalFx, { scale: big ? 2 : 1.5 });
      this.cameras.main.shake(500, 0.025);
      if (big) this.cameras.main.flash(300, 255, 255, 255);
      this.sfx.play('explodeBig');
      this.hitStop(220);
      boss.destroyAll();
      this.hud.flash(this.levelIndex === LEVELS.length - 1 ? 'MISSION COMPLETE!' : 'STAGE CLEAR!', 2400);
      this.time.delayedCall(500, () => this.sfx.play('stageClear'));
    });
    this.time.delayedCall(n * 150 + 2600, () => this.endGame(true));
  }

  endGame(won) {
    if (this.ended) return;
    this.ended = true;
    this.tank.hull.setVelocityX(0);
    if (!won) this.music.stop(400);
    const best = getBest();
    const newBest = submitScore(this.score);
    if (won) unlockLevel(this.levelIndex + 1);
    const data = {
      won, score: this.score, levelStartScore: this.startScore, level: this.levelIndex,
      best: Math.max(best, this.score), newBest, parries: this.parries, timeMs: this.time.now - this.startTime,
    };
    this.time.delayedCall(won ? 300 : 200, () => this.goTo('End', data));
  }

  // ---------- Frame update ----------

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;
    this.scrollBg(cam.scrollX);
    this.screenFx.tick(time, this.tank.alive && this.tank.hp === 1);
    this.hud.tick(time);

    // Hit-stop: hold everything still for a moment
    if (time < this.frozenUntil) return;
    if (this.physics.world.isPaused) this.physics.world.resume();

    // Low-armor alarm
    if (this.tank.alive && this.tank.hp === 1 && time >= this.nextLowHpBeep) {
      this.nextLowHpBeep = time + 1400;
      this.sfx.play('lowHp', { vol: 0.7 });
    }

    const t = this.tank;
    if (!this.ended && t.alive) {
      const k = this.keys;
      t.update(time, dt, {
        left: k.A.isDown || k.LEFT.isDown,
        right: k.D.isDown || k.RIGHT.isDown,
      }, this.input.activePointer.positionToCamera(cam));

      // Checkpoint
      if (!this.checkpointReached && t.x >= this.level.checkpointX) {
        this.checkpointReached = true;
        this.checkpoint.setAlpha(1);
        this.hud.flash('CHECKPOINT', 1200);
        this.sfx.play('checkpoint');
      }
      // Boss arena
      if (!this.arenaLocked && !this.bossDown && t.x >= this.level.arena.x + 90) this.lockArena();
      // Fell off the bottom of the world (shouldn't happen, but be safe)
      if (t.y > H + 40) this.hurtTank(99);
    }
    const p = this.input.activePointer;
    this.weapons.update(time, p.isDown && p.leftButtonDown(), t.muzzle, this.canFire());

    for (const e of this.enemies.getChildren().slice()) if (!e.isBoss) e.update(time, dt, t);
    if (!this.bossDown || this.boss.active) this.boss.update(time, dt, t);
    for (const pk of this.pickups.getChildren().slice()) pk.update(time, dt);
    this.weapons.updateShots(time, dt, this.terrain, t, (x, y, dmg) => this.bombBlast(x, y, dmg));
    this.checkParry();
    this.updateRain(time);

    // Teleport prompts
    const near = this.padUnderTank();
    for (const pad of this.pads) pad.label.setVisible(pad === near && time >= this.teleportReadyAt);
    if (near) this.hint('teleport', 'PRESS W ON A TELEPORTER TO REACH OTHER PLATFORMS');
    // First time a shot gets close: teach parry
    if (t.alive) {
      for (const b of this.weapons.enemyShots.getChildren()) {
        const d = Phaser.Math.Distance.Between(b.x, b.y, t.x, t.centerY);
        if (d < 170) {
          if (b.look.homing) this.hint('homing', 'FIREBALLS FOLLOW YOU!  PARRY THEM OR TELEPORT AWAY');
          else this.hint('parry', 'PRESS SPACE OR RIGHT-CLICK JUST BEFORE A SHOT HITS TO PARRY IT');
          break;
        }
      }
    }

    const w = this.weapons;
    const power = w.mode(time);
    this.hud.setPower(power === 'bolt' ? null : power, (w.powerUntil - time) / this.stats.powerUps.durationMs);
    const pr = this.stats.tank.parryCooldownMs;
    this.hud.setParry(Phaser.Math.Clamp(1 - (t.parryReadyAt - time) / pr, 0, 1));
  }
}
