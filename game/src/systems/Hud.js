import { W, H, DEPTH, textStyle } from '../constants.js';
import { GEM_COLOR, gemFrames } from '../scenes/BootScene.js';

const panel = (scene, x, y, w, h) => scene.add.nineslice(x, y, 'hud-icons', 'panel', w, h, 4, 4, 4, 4).setOrigin(0);

// Heads-up display built from pixel-art pieces:
//  left panel  — pilot portrait, armor cells (HP), lives, parry meter
//  right panel — score, active power-up and its timer
//  top centre  — boss portrait, name and health bar (during the boss fight)
export default class Hud {
  constructor(scene, maxHp, maxLives) {
    this.scene = scene;
    this.maxHp = maxHp;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.hud);
    this.root = [];

    // ---- Left panel ----
    fixed(panel(scene, 6, 6, 150, 58));
    this.portraitX = 12;
    this.portrait = fixed(scene.add.image(12, 11, 'portrait-pilot').setOrigin(0));
    fixed(scene.add.text(66, 11, 'ARMOR', textStyle(8, '#f5af42')));
    this.cells = [];
    for (let i = 0; i < maxHp; i++) this.cells.push(fixed(scene.add.image(66 + i * 10, 22, 'hud-icons', 'cell-full').setOrigin(0)));
    this.lives = [];
    for (let i = 0; i < maxLives; i++) this.lives.push(fixed(scene.add.image(66 + i * 19, 38, 'hud-icons', 'life').setOrigin(0)));
    fixed(scene.add.image(66, 51, 'hud-icons', 'shield-icon').setOrigin(0));
    this.parryBar = fixed(scene.add.graphics());

    // ---- Right panel ----
    fixed(panel(scene, W - 146, 6, 140, 40));
    fixed(scene.add.text(W - 138, 12, 'SCORE', textStyle(8, '#f5af42')));
    this.score = fixed(scene.add.text(W - 14, 12, '', textStyle(8)).setOrigin(1, 0));
    this.powerIcon = fixed(scene.add.sprite(W - 130, 33, 'gems', 0)).setVisible(false);
    this.powerLabel = fixed(scene.add.text(W - 118, 29, '', textStyle(8, '#c8f0dc'))).setVisible(false);
    this.powerBar = fixed(scene.add.graphics());

    // ---- Boss bar ----
    this.bossPanel = fixed(panel(scene, W / 2 - 130, 6, 260, 34)).setVisible(false);
    this.bossPortrait = fixed(scene.add.image(W / 2 - 126, 10, 'portrait-boss').setOrigin(0).setScale(0.5)).setVisible(false);
    this.bossLabel = fixed(scene.add.text(W / 2 - 98, 11, 'MECH UNIT', textStyle(8, '#ff5a4a'))).setVisible(false);
    this.bossPhase = fixed(scene.add.text(W / 2 + 122, 11, '', textStyle(8, '#f5af42')).setOrigin(1, 0)).setVisible(false);
    this.bossBar = fixed(scene.add.graphics());

    // ---- Centre banner ----
    this.bannerShadow = fixed(scene.add.text(W / 2 + 2, 112, '', textStyle(16, '#170304')).setOrigin(0.5)).setVisible(false);
    this.banner = fixed(scene.add.text(W / 2, 110, '', textStyle(16, '#f5af42')).setOrigin(0.5)).setVisible(false);
    this.sub = fixed(scene.add.text(W / 2, 134, '', textStyle(8, '#c8f0dc')).setOrigin(0.5)).setVisible(false);

    // ---- Hint line (bottom) ----
    this.hint = fixed(scene.add.text(W / 2, H - 22, '', textStyle(8, '#ffffff')).setOrigin(0.5)).setVisible(false);
  }

  setHp(hp, hurt = false) {
    this.cells.forEach((c, i) => c.setFrame(i < hp ? 'cell-full' : 'cell-empty'));
    this.hp = hp;
    if (hurt) {
      // Portrait flinches and flashes red
      this.portrait.setTint(0xff6060);
      this.portrait.x = this.portraitX + 2;
      this.scene.time.delayedCall(60, () => { this.portrait.x = this.portraitX - 2; });
      this.scene.time.delayedCall(120, () => { this.portrait.x = this.portraitX; this.portrait.clearTint(); });
    }
  }

  // Called every frame: blinks the last armor cell when HP is low
  tick(time) {
    if (this.hp === 1) this.cells[0].setAlpha(Math.floor(time / 180) % 2 ? 0.35 : 1);
    else if (this.cells[0]) this.cells[0].setAlpha(1);
  }

  setLives(n) { this.lives.forEach((l, i) => l.setVisible(i < n)); }
  setScore(n) { this.score.setText(String(n).padStart(7, '0')); }

  // Parry readiness 0..1 (1 = ready)
  setParry(ready) {
    const g = this.parryBar.clear();
    const x = 78, y = 52, w = 70;
    g.fillStyle(0x170304).fillRect(x, y, w + 2, 6);
    g.fillStyle(ready >= 1 ? 0x7fe3ff : 0x2a5a78).fillRect(x + 1, y + 1, Math.round(w * ready), 4);
  }

  // type = null to hide; remaining 0..1
  setPower(type, remaining) {
    const g = this.powerBar.clear();
    if (!type) { this.powerIcon.setVisible(false); this.powerLabel.setVisible(false); return; }
    this.powerIcon.setVisible(true).setFrame(gemFrames(GEM_COLOR[type]).start);
    this.powerLabel.setVisible(true).setText(type === 'spread' ? 'SPREAD' : 'CHARGE');
    const x = W - 62, y = 30, w = 48;
    g.fillStyle(0x170304).fillRect(x, y, w + 2, 6);
    g.fillStyle(type === 'spread' ? 0xff5a4a : 0x5aa8ff).fillRect(x + 1, y + 1, Math.round(w * remaining), 4);
  }

  // Boss name and portrait for the boss bar. The dreadnought reuses a portrait tinted red.
  setBossInfo(name, portrait) {
    this.bossLabel.setText(name);
    if (portrait === 'portrait-boss3') this.bossPortrait.setTexture('portrait-boss').setTint(0xff7a6a);
    else this.bossPortrait.setTexture(portrait).clearTint();
  }

  // hp = null hides the bar
  setBoss(hp, max, phase = 1) {
    const g = this.bossBar.clear();
    const show = hp !== null;
    for (const o of [this.bossPanel, this.bossPortrait, this.bossLabel, this.bossPhase]) o.setVisible(show);
    if (!show) return;
    this.bossPhase.setText(phase === 3 ? 'RAGE' : `PHASE ${phase}`);
    const w = 220, x = W / 2 - 98, y = 24;
    g.fillStyle(0x170304).fillRect(x - 1, y - 1, w + 2, 9);
    g.fillStyle(0x380b04).fillRect(x, y, w, 7);
    g.fillStyle(phase === 3 ? 0xff2a2a : 0xff5a4a).fillRect(x, y, Math.round(w * Math.max(0, hp) / max), 7);
    g.fillStyle(0xffffff, 0.25).fillRect(x, y, Math.round(w * Math.max(0, hp) / max), 2);
    // Phase markers at 66% and 33%
    g.fillStyle(0x170304).fillRect(x + Math.round(w * 0.33), y, 1, 7).fillRect(x + Math.round(w * 0.66), y, 1, 7);
  }

  // Big centre text, with an optional smaller line under it. Uses the scene clock.
  flash(text, ms = 1400, sub = '') {
    this.banner.setText(text).setVisible(true);
    this.bannerShadow.setText(text).setVisible(true);
    this.sub.setText(sub).setVisible(!!sub);
    this.bannerTimer?.remove();
    this.bannerTimer = this.scene.time.delayedCall(ms, () => {
      this.banner.setVisible(false); this.bannerShadow.setVisible(false); this.sub.setVisible(false);
    });
  }

  // Contextual tutorial hint along the bottom of the screen
  showHint(text, ms = 3500) {
    this.hint.setText(text).setVisible(true);
    this.hintTimer?.remove();
    this.hintTimer = this.scene.time.delayedCall(ms, () => this.hint.setVisible(false));
  }
}
