import { W, H, LEVELS, textStyle, addBackground } from '../constants.js';
import { getUnlocked, markHowToSeen, getBest } from '../systems/Save.js';
import Sfx from '../systems/Sfx.js';
import Music from '../systems/Music.js';
import Menu from '../systems/Menu.js';

// Shared look for the menu screens: background, overlay, fade in/out, Esc to go back.
class MenuBase extends Phaser.Scene {
  setup(title) {
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#1f8877');
    this.scrollBg = addBackground(this);
    this.bgX = 0;
    this.add.rectangle(0, 0, W, H, 0x0a040c, 0.45).setOrigin(0);
    this.add.text(W / 2 + 2, 34, title, textStyle(16, '#170304')).setOrigin(0.5);
    this.add.text(W / 2, 32, title, textStyle(16, '#f5af42')).setOrigin(0.5);
    this.sfx = new Sfx(this);
    Music.get(this).play('title');
    this.cameras.main.fadeIn(350, 16, 18, 28);
  }

  overlay() {
    this.add.image(0, 0, 'vignette').setOrigin(0);
    this.add.tileSprite(0, 0, W, H, 'scanlines').setOrigin(0);
  }

  go(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(300, 16, 18, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }

  update(_t, delta) { this.bgX += delta * 0.03; this.scrollBg(this.bgX); }
}

// Level select: unlocked levels can be started; locked ones are shown greyed out (M3-5).
export class LevelSelectScene extends MenuBase {
  constructor() { super('LevelSelect'); }

  create() {
    this.setup('LEVEL SELECT');
    const unlocked = getUnlocked();
    const preview = ['aw-composed', 'd-back', 'j-middle'];
    LEVELS.forEach((key, i) => {
      const L = this.cache.json.get(key);
      const x = W / 2 + (i - 1) * 200, y = 150;
      const open = i <= unlocked;
      this.add.nineslice(x - 90, y - 70, 'hud-icons', 'panel', 180, 150, 4, 4, 4, 4).setOrigin(0);
      const img = this.add.image(x, y - 12, preview[i]).setDisplaySize(160, 96);
      if (!open) img.setTint(0x333333);
      this.add.text(x, y + 50, `LEVEL ${i + 1}`, textStyle(8, open ? '#f5af42' : '#5a4a5a')).setOrigin(0.5);
      this.add.text(x, y + 64, open ? L.name.toUpperCase() : 'LOCKED', textStyle(8, open ? '#ffffff' : '#5a4a5a')).setOrigin(0.5);
    });
    new Menu(this, W / 2, 262, [
      ...LEVELS.map((key, i) => ({
        label: () => `PLAY LEVEL ${i + 1}`,
        run: () => this.go('Game', { level: i, score: 0 }),
        disabled: () => i > unlocked,
      })),
      { label: () => 'BACK', run: () => this.go('Title') },
    ], { sfx: this.sfx, gap: 18 });
    this.input.keyboard.on('keydown-ESC', () => this.go('Title'));
    this.overlay();
  }
}

// How to play card, shown before the first game and from the title menu (M3-6). Skippable.
export class HowToScene extends MenuBase {
  constructor() { super('HowTo'); }

  init(data) { this.next = data?.next || 'Title'; }

  create() {
    this.setup('HOW TO PLAY');
    this.add.nineslice(40, 56, 'hud-icons', 'panel', W - 80, 250, 4, 4, 4, 4).setOrigin(0);
    const rows = [
      ['A / D', 'DRIVE'],
      ['MOUSE', 'AIM THE TURRET'],
      ['LEFT CLICK', 'FIRE  (HOLD FOR AUTO-FIRE)'],
      ['SPACE / RIGHT CLICK', 'PARRY - SENDS SHOTS BACK FOR 2X DAMAGE'],
      ['W', 'TELEPORT ON A GLOWING PAD'],
      ['ESC / P', 'PAUSE'],
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(70, 76 + i * 20, k, textStyle(8, '#f5af42'));
      this.add.text(250, 76 + i * 20, v, textStyle(8));
    });
    const tips = [
      'GEMS: GREEN = +1 ARMOR, RED = SPREAD SHOT, BLUE = CHARGE SHOT',
      'RED MARKERS SHOW WHERE SHOTS WILL FALL - PLATFORMS GIVE COVER',
      'FIREBALLS FOLLOW YOU: PARRY THEM OR TELEPORT AWAY',
      'SHOOT SUPPLY CRATES FOR GEMS.  3 LIVES, ONE CHECKPOINT PER LEVEL',
    ];
    tips.forEach((t, i) => this.add.text(W / 2, 214 + i * 18, t, textStyle(8, '#c8f0dc')).setOrigin(0.5));

    const label = this.next === 'Game' ? 'CLICK OR ENTER TO START   ESC TO SKIP' : 'CLICK OR ENTER TO GO BACK';
    const prompt = this.add.text(W / 2, 330, label, textStyle(8)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    const done = () => {
      markHowToSeen();
      this.sfx.play('uiSelect');
      if (this.next === 'Game') this.go('Game', { level: 0, score: 0 }); else this.go('Title');
    };
    this.time.delayedCall(250, () => {
      this.input.once('pointerdown', done);
      this.input.keyboard.once('keydown-ENTER', done);
      this.input.keyboard.once('keydown-SPACE', done);
      this.input.keyboard.once('keydown-ESC', done);
    });
    this.overlay();
  }
}

// Credits (M3-7)
export class CreditsScene extends MenuBase {
  constructor() { super('Credits'); }

  init(data) { this.ending = !!data?.ending; this.finalScore = data?.score || 0; }

  create() {
    this.setup(this.ending ? 'MISSION COMPLETE' : 'CREDITS');
    this.add.nineslice(60, 60, 'hud-icons', 'panel', W - 120, 236, 4, 4, 4, 4).setOrigin(0);
    let y = 80;
    const line = (t, c = '#ffffff', gap = 16) => { this.add.text(W / 2, y, t, textStyle(8, c)).setOrigin(0.5); y += gap; };
    if (this.ending) {
      line('THE DREADNOUGHT IS DOWN. THE WASTELANDS ARE QUIET.', '#c8f0dc');
      line(`FINAL SCORE  ${String(this.finalScore).padStart(7, '0')}`, '#f5af42');
      line(`BEST SCORE   ${String(getBest()).padStart(7, '0')}`, '#f5af42', 24);
    }
    line('PIXEL ART', '#f5af42');
    line('LUIS ZUNO (ANSIMUZ) - LEGACY COLLECTION, CC0');
    line('THANK YOU FOR THE AMAZING ART!', '#c8f0dc');
    const link = this.add.text(W / 2, y, 'ANSIMUZ.ITCH.IO', textStyle(8, '#7fe3ff')).setOrigin(0.5).setInteractive({ useHandCursor: true });
    link.on('pointerdown', () => window.open('https://ansimuz.itch.io', '_blank', 'noopener'));
    y += 24;
    line('FONT', '#f5af42');
    line('PRESS START 2P BY CODEMAN38 (SIL OPEN FONT LICENSE)', '#ffffff', 24);
    line('ENGINE', '#f5af42');
    line('PHASER 3', '#ffffff', 24);
    line('SOUND AND MUSIC', '#f5af42');
    line('SYNTHESIZED IN CODE FOR THIS GAME');

    new Menu(this, W / 2, 318, [{ label: () => 'BACK TO TITLE', run: () => this.go('Title') }], { sfx: this.sfx });
    this.input.keyboard.on('keydown-ESC', () => this.go('Title'));
    this.overlay();
  }
}
