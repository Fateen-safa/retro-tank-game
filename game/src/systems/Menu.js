import { textStyle } from '../constants.js';

// A vertical list of menu options, driven by mouse (hover/click) and keyboard
// (W/S or arrows to move, Enter/Space to choose, A/D or arrows to adjust sliders).
// item: { label: () => string, run: () => void, left?: () => void, right?: () => void, disabled?: () => bool }
export default class Menu {
  constructor(scene, x, y, items, { gap = 22, sfx = null, size = 8 } = {}) {
    this.scene = scene;
    this.items = items;
    this.sfx = sfx;
    this.index = items.findIndex((it) => !it.disabled?.());
    if (this.index < 0) this.index = 0;
    this.texts = items.map((it, i) => {
      const t = scene.add.text(x, y + i * gap, '', textStyle(size)).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i, true));
      t.on('pointerdown', () => { this.select(i); this.choose(); });
      return t;
    });
    const kb = scene.input.keyboard;
    const on = (keys, fn) => keys.forEach((k) => kb.on(`keydown-${k}`, fn));
    on(['UP', 'W'], () => this.move(-1));
    on(['DOWN', 'S'], () => this.move(1));
    on(['LEFT', 'A'], () => { this.items[this.index].left?.(); this.refresh(); });
    on(['RIGHT', 'D'], () => { this.items[this.index].right?.(); this.refresh(); });
    on(['ENTER', 'SPACE'], () => this.choose());
    this.refresh();
  }

  move(d) {
    const n = this.items.length;
    let i = this.index;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!this.items[i].disabled?.()) break; }
    this.select(i, true);
  }

  select(i, sound = false) {
    if (this.items[i].disabled?.()) return;
    if (i !== this.index && sound) this.sfx?.play('uiSelect', { vol: 0.6 });
    this.index = i;
    this.refresh();
  }

  choose() {
    const it = this.items[this.index];
    if (it.disabled?.()) return;
    this.sfx?.play('uiSelect');
    it.run();
    this.refresh();
  }

  refresh() {
    this.texts.forEach((t, i) => {
      const it = this.items[i];
      const on = i === this.index;
      const off = it.disabled?.();
      t.setText((on ? '> ' : '  ') + it.label() + (on ? ' <' : '  '))
        .setColor(off ? '#5a4a5a' : on ? '#f5af42' : '#ffffff');
    });
  }
}
