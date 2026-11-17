import { W, H, LEVELS, textStyle, addBackground } from '../constants.js';
import Sfx from '../systems/Sfx.js';
import Music from '../systems/Music.js';
import Menu from '../systems/Menu.js';

// Shown after a level is cleared or all lives are lost.
// Cleared: continue to the next level (score carries over). Final level: go to the ending.
// Lost: retry the level from its starting score, or quit.
export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) {
    this.won = !!data.won;
    this.level = data.level || 0;
    this.score = data.score || 0;
    this.levelStartScore = data.levelStartScore || 0;
    this.timeMs = data.timeMs || 0;
    this.best = data.best || 0;
    this.newBest = !!data.newBest;
    this.parries = data.parries || 0;
  }

  create() {
    this.leaving = false;
    const last = this.level === LEVELS.length - 1;
    this.cameras.main.setBackgroundColor(this.won ? '#1f8877' : '#170304');
    addBackground(this);
    this.add.rectangle(0, 0, W, H, 0x170304, this.won ? 0.35 : 0.75).setOrigin(0).setDepth(5);

    const title = this.won ? (last ? 'MISSION COMPLETE!' : 'STAGE CLEAR!') : 'GAME OVER';
    const color = this.won ? '#f5af42' : '#ff5a4a';
    this.add.text(W / 2 + 2, 82, title, textStyle(24, '#170304')).setOrigin(0.5);
    this.add.text(W / 2, 80, title, textStyle(24, color)).setOrigin(0.5);
    this.add.text(W / 2, 108, `LEVEL ${this.level + 1}  ${this.cache.json.get(LEVELS[this.level]).name.toUpperCase()}`, textStyle(8, '#c8f0dc')).setOrigin(0.5);

    this.add.nineslice(W / 2 - 110, 124, 'hud-icons', 'panel', 220, 84, 4, 4, 4, 4).setOrigin(0).setDepth(6);
    const secs = (this.timeMs / 1000).toFixed(1);
    const lines = [`SCORE   ${String(this.score).padStart(7, '0')}`, `BEST    ${String(this.best).padStart(7, '0')}`, `PARRIES ${this.parries}`, `TIME    ${secs}s`];
    lines.forEach((l, i) => this.add.text(W / 2 - 92, 136 + i * 16, l, textStyle(8)));
    if (this.newBest) {
      const nb = this.add.text(W / 2, 218, 'NEW BEST SCORE!', textStyle(8, '#5ce0a0')).setOrigin(0.5);
      this.tweens.add({ targets: nb, scale: 1.2, duration: 300, yoyo: true, repeat: -1 });
    }

    const sfx = new Sfx(this);
    const items = [];
    if (this.won && !last) items.push({ label: () => `CONTINUE TO LEVEL ${this.level + 2}`, run: () => this.go('Game', { level: this.level + 1, score: this.score }) });
    if (this.won && last) items.push({ label: () => 'CONTINUE', run: () => this.go('Credits', { ending: true, score: this.score }) });
    if (!this.won) items.push({ label: () => 'RETRY LEVEL', run: () => this.go('Game', { level: this.level, score: this.levelStartScore }) });
    items.push({ label: () => 'QUIT TO TITLE', run: () => this.go('Title') });

    // Everything except the background sits above the dark overlay
    for (const c of this.children.list) if (c.type === 'Text') c.setDepth(10);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(7);
    this.add.tileSprite(0, 0, W, H, 'scanlines').setOrigin(0).setDepth(7);
    this.cameras.main.fadeIn(400, 16, 18, 28);
    if (!this.won) { Music.get(this).stop(300); this.time.delayedCall(250, () => sfx.play('gameOver')); }
    else Music.get(this).play('title');

    // Small delay so the click that ended the game doesn't pick an option by accident
    this.time.delayedCall(450, () => {
      const menu = new Menu(this, W / 2, 252, items, { sfx, gap: 20 });
      menu.texts.forEach((t) => t.setDepth(10));
      this.input.keyboard.once('keydown-R', () => items[0].run());
    });
  }

  go(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(350, 16, 18, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
