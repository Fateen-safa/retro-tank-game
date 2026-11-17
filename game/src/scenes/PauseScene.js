import { W, H, textStyle } from '../constants.js';
import Sfx, { volumes, setSfxVolume, setMusicVolume } from '../systems/Sfx.js';

// Pause menu over the paused game: resume, restart, volume, quit (M3-4, brought forward).
export default class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    this.sfx = new Sfx(this);
    this.add.rectangle(0, 0, W, H, 0x0a040c, 0.6).setOrigin(0);
    this.add.nineslice(W / 2 - 120, 90, 'hud-icons', 'panel', 240, 190, 4, 4, 4, 4).setOrigin(0);
    this.add.text(W / 2 + 2, 114, 'PAUSED', textStyle(16, '#170304')).setOrigin(0.5);
    this.add.text(W / 2, 112, 'PAUSED', textStyle(16, '#f5af42')).setOrigin(0.5);

    this.items = [
      { label: () => 'RESUME', run: () => this.resume() },
      { label: () => 'RESTART LEVEL', run: () => this.leave('Game') },
      { label: () => `SFX    < ${Math.round(volumes.sfx * 100)}% >`, run: () => this.changeVolume('sfx', 0.1, true), left: () => this.changeVolume('sfx', -0.1), right: () => this.changeVolume('sfx', 0.1) },
      { label: () => `MUSIC  < ${Math.round(volumes.music * 100)}% >`, run: () => this.changeVolume('music', 0.1, true), left: () => this.changeVolume('music', -0.1), right: () => this.changeVolume('music', 0.1) },
      { label: () => 'QUIT TO TITLE', run: () => this.leave('Title') },
    ];
    this.index = 0;
    this.texts = this.items.map((it, i) => {
      const t = this.add.text(W / 2, 150 + i * 22, '', textStyle(8)).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => { this.select(i); this.items[i].run(); });
      return t;
    });
    this.add.text(W / 2, 262, 'ESC TO RESUME', textStyle(8, '#8a7a8a')).setOrigin(0.5);
    this.refresh();

    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => this.resume());
    kb.on('keydown-P', () => this.resume());
    kb.on('keydown-UP', () => this.select(this.index - 1, true));
    kb.on('keydown-W', () => this.select(this.index - 1, true));
    kb.on('keydown-DOWN', () => this.select(this.index + 1, true));
    kb.on('keydown-S', () => this.select(this.index + 1, true));
    kb.on('keydown-LEFT', () => this.items[this.index].left?.());
    kb.on('keydown-A', () => this.items[this.index].left?.());
    kb.on('keydown-RIGHT', () => this.items[this.index].right?.());
    kb.on('keydown-D', () => this.items[this.index].right?.());
    kb.on('keydown-ENTER', () => this.items[this.index].run());
    kb.on('keydown-SPACE', () => this.items[this.index].run());
  }

  select(i, sound = false) {
    const n = this.items.length;
    const next = ((i % n) + n) % n;
    if (next !== this.index && sound) this.sfx.play('uiSelect');
    this.index = next;
    this.refresh();
  }

  refresh() {
    this.texts.forEach((t, i) => {
      const on = i === this.index;
      t.setText((on ? '> ' : '  ') + this.items[i].label() + (on ? ' <' : '  ')).setColor(on ? '#f5af42' : '#ffffff');
    });
  }

  changeVolume(which, d, wrap = false) {
    let v = Math.round((volumes[which] + d) * 10) / 10;
    if (wrap && v > 1) v = 0;
    if (which === 'sfx') setSfxVolume(v); else setMusicVolume(v, this.game);
    this.refresh();
    this.sfx.play('uiSelect');
  }

  resume() {
    this.sfx.play('uiSelect');
    this.scene.resume('Game');
    this.scene.stop();
  }

  leave(key) {
    this.sfx.play('uiSelect');
    const game = this.scene.get('Game');
    const data = key === 'Game' ? { level: game.levelIndex, score: game.startScore } : undefined;
    this.scene.stop('Game');
    this.scene.start(key, data);
  }
}
