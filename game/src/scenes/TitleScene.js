import { W, H, textStyle, addBackground } from '../constants.js';
import { getBest, getUnlocked, hasSeenHowTo } from '../systems/Save.js';
import Sfx, { volumes, setSfxVolume, setMusicVolume } from '../systems/Sfx.js';
import Music from '../systems/Music.js';
import Menu from '../systems/Menu.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor('#1f8877');
    this.scrollBg = addBackground(this);
    this.bgX = 0;
    this.leaving = false;

    // Ground strip for the tank to sit on
    const gy = 280;
    for (let x = 0; x < W; x += 16) {
      this.add.image(x, gy, 'aw-tiles', (x / 16) % 3 === 1 ? 'ground-top-b' : 'ground-top-a').setOrigin(0);
      for (let y = gy + 16; y < H; y += 16) this.add.image(x, y, 'aw-tiles', 'ground-fill').setOrigin(0);
    }

    // Tank parked on the left, barrel raised
    this.add.image(150 + 4, gy - 33, 'tank-barrel').setOrigin(4 / 48, 0.5).setRotation(-0.35);
    this.add.sprite(150, gy, 'tank-hull', 0).setOrigin(0.5, 1).play('tank-drive');

    this.add.text(W / 2 + 2, 72, 'RETRO TANK\nSHOOTER', { ...textStyle(32, '#170304'), align: 'center' }).setOrigin(0.5);
    this.add.text(W / 2, 70, 'RETRO TANK\nSHOOTER', { ...textStyle(32, '#f5af42'), align: 'center' }).setOrigin(0.5);

    const sfx = (this.sfx = new Sfx(this));
    const panelX = W / 2 + 40;
    this.add.nineslice(panelX - 100, 128, 'hud-icons', 'panel', 200, 132, 4, 4, 4, 4).setOrigin(0);
    const unlocked = getUnlocked();
    this.menu = new Menu(this, panelX, 148, [
      { label: () => 'START GAME', run: () => this.go(hasSeenHowTo() ? 'Game' : 'HowTo', hasSeenHowTo() ? { level: 0, score: 0 } : { next: 'Game' }) },
      { label: () => 'LEVEL SELECT', run: () => this.go('LevelSelect'), disabled: () => unlocked < 1 },
      { label: () => 'HOW TO PLAY', run: () => this.go('HowTo', { next: 'Title' }) },
      { label: () => 'CREDITS', run: () => this.go('Credits') },
      { label: () => `SFX   < ${Math.round(volumes.sfx * 100)}% >`, run: () => setSfxVolume(volumes.sfx >= 1 ? 0 : volumes.sfx + 0.1), left: () => setSfxVolume(volumes.sfx - 0.1), right: () => setSfxVolume(volumes.sfx + 0.1) },
      { label: () => `MUSIC < ${Math.round(volumes.music * 100)}% >`, run: () => setMusicVolume(volumes.music >= 1 ? 0 : volumes.music + 0.1, this.game), left: () => setMusicVolume(volumes.music - 0.1, this.game), right: () => setMusicVolume(volumes.music + 0.1, this.game) },
    ], { sfx, gap: 19 });

    const best = getBest();
    if (best > 0) this.add.text(W / 2, 300, `BEST SCORE ${String(best).padStart(7, '0')}`, textStyle(8, '#f5af42')).setOrigin(0.5);
    this.add.text(W / 2, 324, 'MOUSE OR KEYBOARD   W/S MOVE   ENTER SELECT', textStyle(8, '#c8f0dc')).setOrigin(0.5);
    this.add.text(W - 8, H - 8, 'M: MUTE', textStyle(8, '#8a7a8a')).setOrigin(1, 1);
    this.input.keyboard.on('keydown-M', () => {
      const muted = volumes.sfx === 0 && volumes.music === 0;
      setSfxVolume(muted ? 0.8 : 0);
      setMusicVolume(muted ? 0.5 : 0, this.game);
      this.menu.refresh();
    });

    // Vignette + scanlines like in-game, then fade in
    this.add.image(0, 0, 'vignette').setOrigin(0);
    this.add.tileSprite(0, 0, W, H, 'scanlines').setOrigin(0);
    this.cameras.main.fadeIn(600, 16, 18, 28);

    // Browsers only allow sound after the first click or key press; start the music then.
    const music = Music.get(this);
    if (this.sound.locked) this.sound.once('unlocked', () => music.play('title'));
    else music.play('title');
  }

  go(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    if (key === 'Game') this.sfx.play('respawn');
    this.cameras.main.fadeOut(350, 16, 18, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }

  update(_t, delta) {
    this.bgX += delta * 0.03;
    this.scrollBg(this.bgX);
  }
}
