import { W, H } from './constants.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import EndScene from './scenes/EndScene.js';
import PauseScene from './scenes/PauseScene.js';
import { LevelSelectScene, HowToScene, CreditsScene } from './scenes/MenuScenes.js';

// Largest whole-number zoom that fits the window (R1: crisp pixels, no blur).
function zoomFor() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
}

// Make sure the pixel font is ready before any text is drawn.
try {
  await document.fonts.load('8px "Press Start 2P"');
} catch (e) {
  console.warn('Pixel font failed to load, using fallback.', e);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#10121c',
  scale: { mode: Phaser.Scale.NONE, zoom: zoomFor() },
  physics: { default: 'arcade', arcade: { debug: false, gravity: { x: 0, y: 0 } } },
  scene: [BootScene, TitleScene, GameScene, EndScene, PauseScene, LevelSelectScene, HowToScene, CreditsScene],
});

window.addEventListener('resize', () => game.scale.setZoom(zoomFor()));
window.__game = game; // handy for debugging in the console
