// Tiny retro sound synthesizer. Every sound effect in the game is generated here at load time,
// so there are no audio files to download or license.
//
// A sound is a list of layers mixed together. Each layer:
//   wave:   'square' | 'saw' | 'tri' | 'sine' | 'noise'
//   f0, f1: start / end frequency in Hz (exponential slide)
//   dur:    seconds; at: start offset in seconds
//   vol:    0..1; attack: seconds; curve: decay shape (higher = snappier)
//   duty:   square-wave duty (0..1); vib: [rate Hz, depth 0..1]
//   lp0, lp1: low-pass cutoff start / end in Hz (optional)
//   notes:  [Hz, ...] plays an arpeggio instead of a slide (each note dur/notes.length)

const TWO_PI = Math.PI * 2;

function renderLayer(out, sr, L) {
  const start = Math.floor((L.at || 0) * sr);
  const n = Math.floor(L.dur * sr);
  const attack = Math.max(1, Math.floor((L.attack ?? 0.004) * sr));
  const curve = L.curve ?? 2;
  const vol = L.vol ?? 0.5;
  const duty = L.duty ?? 0.5;
  let phase = 0, lp = 0, noiseVal = 0, noisePhase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / n;
    let f;
    if (L.notes) f = L.notes[Math.min(L.notes.length - 1, Math.floor(t * L.notes.length))];
    else f = L.f0 * Math.pow((L.f1 ?? L.f0) / L.f0, t);
    if (L.vib) f *= 1 + Math.sin(TWO_PI * L.vib[0] * i / sr) * L.vib[1];
    phase = (phase + f / sr) % 1;
    let s;
    switch (L.wave) {
      case 'square': s = phase < duty ? 1 : -1; break;
      case 'saw': s = phase * 2 - 1; break;
      case 'tri': s = 1 - 4 * Math.abs(phase - 0.5); break;
      case 'sine': s = Math.sin(TWO_PI * phase); break;
      default: // noise, pitched by holding each random value for one period
        noisePhase += f / sr;
        if (noisePhase >= 1) { noisePhase -= 1; noiseVal = Math.random() * 2 - 1; }
        s = noiseVal;
    }
    if (L.lp0) {
      const cut = L.lp0 * Math.pow((L.lp1 ?? L.lp0) / L.lp0, t);
      const a = 1 - Math.exp(-TWO_PI * cut / sr);
      lp += a * (s - lp);
      s = lp;
    }
    const env = (i < attack ? i / attack : 1) * Math.pow(1 - t, curve);
    out[start + i] += s * env * vol;
  }
}

// fixedLength (seconds) is used for music loops so they repeat seamlessly.
export function renderSound(layers, sr, fixedLength = 0) {
  const len = fixedLength || Math.max(...layers.map((l) => (l.at || 0) + l.dur)) + 0.02;
  const out = new Float32Array(Math.ceil(len * sr));
  for (const L of layers) renderLayer(out, sr, L);
  // Soft clip so stacked layers never crackle
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.2) * 0.9;
  return out;
}

// ---- The sound list: one entry per game action ----
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const SOUNDS = {
  // Player weapons
  shoot:        [{ wave: 'square', f0: 950, f1: 260, dur: 0.11, vol: 0.35, duty: 0.3, curve: 2 },
                 { wave: 'noise', f0: 6000, dur: 0.06, vol: 0.25, lp0: 5000, lp1: 1200 }],
  shootSpread:  [{ wave: 'saw', f0: 720, f1: 200, dur: 0.15, vol: 0.3, lp0: 4000 },
                 { wave: 'square', f0: 1100, f1: 400, dur: 0.1, vol: 0.18, duty: 0.2, at: 0.02 },
                 { wave: 'noise', f0: 5000, dur: 0.08, vol: 0.2, lp0: 3000 }],
  charge:       [{ wave: 'sine', f0: 180, f1: 900, dur: 0.5, vol: 0.25, curve: 0.3, vib: [18, 0.04] },
                 { wave: 'square', f0: 360, f1: 1800, dur: 0.5, vol: 0.06, duty: 0.15, curve: 0.3 }],
  shootCharged: [{ wave: 'square', f0: 300, f1: 55, dur: 0.4, vol: 0.4, duty: 0.4 },
                 { wave: 'noise', f0: 3000, dur: 0.35, vol: 0.4, lp0: 4000, lp1: 300 },
                 { wave: 'sine', f0: 90, f1: 40, dur: 0.4, vol: 0.5 }],

  // Hits & explosions
  enemyHit:     [{ wave: 'noise', f0: 9000, dur: 0.05, vol: 0.3, lp0: 7000 },
                 { wave: 'square', f0: 420, f1: 180, dur: 0.06, vol: 0.18, duty: 0.25 }],
  wallHit:      [{ wave: 'noise', f0: 4000, dur: 0.07, vol: 0.18, lp0: 2500, lp1: 600 }],
  explodeSmall: [{ wave: 'noise', f0: 2500, dur: 0.4, vol: 0.5, lp0: 3500, lp1: 200 },
                 { wave: 'sine', f0: 140, f1: 40, dur: 0.3, vol: 0.4 }],
  explodeBig:   [{ wave: 'noise', f0: 1800, dur: 1.0, vol: 0.6, lp0: 2500, lp1: 90, curve: 1.6 },
                 { wave: 'sine', f0: 90, f1: 28, dur: 0.9, vol: 0.6 },
                 { wave: 'noise', f0: 600, dur: 0.6, vol: 0.3, lp0: 500, at: 0.12 }],
  squish:       [{ wave: 'noise', f0: 1500, dur: 0.22, vol: 0.4, lp0: 1800, lp1: 300 },
                 { wave: 'square', f0: 380, f1: 90, dur: 0.18, vol: 0.2, duty: 0.4 }],
  crateBreak:   [{ wave: 'noise', f0: 3500, dur: 0.15, vol: 0.35, lp0: 3000, lp1: 800 },
                 { wave: 'square', f0: 900, f1: 1400, dur: 0.06, vol: 0.12, at: 0.05 }],

  // Player state
  playerHit:    [{ wave: 'square', f0: 220, f1: 70, dur: 0.25, vol: 0.4, duty: 0.45 },
                 { wave: 'noise', f0: 2500, dur: 0.2, vol: 0.35, lp0: 2500, lp1: 400 },
                 { wave: 'saw', f0: 110, f1: 60, dur: 0.2, vol: 0.2 }],
  lowHp:        [{ wave: 'square', f0: 1000, dur: 0.07, vol: 0.12, duty: 0.5, curve: 0.5 },
                 { wave: 'square', f0: 750, dur: 0.07, vol: 0.12, duty: 0.5, curve: 0.5, at: 0.1 }],
  tankDeath:    [{ wave: 'noise', f0: 1500, dur: 1.4, vol: 0.6, lp0: 3000, lp1: 70, curve: 1.3 },
                 { wave: 'sine', f0: 110, f1: 25, dur: 1.2, vol: 0.6 },
                 { wave: 'square', notes: [392, 311, 262, 196], dur: 0.8, vol: 0.12, duty: 0.3, at: 0.3, curve: 0.6 }],
  land:         [{ wave: 'sine', f0: 120, f1: 50, dur: 0.12, vol: 0.4 },
                 { wave: 'noise', f0: 1200, dur: 0.08, vol: 0.2, lp0: 900 }],
  respawn:      [{ wave: 'sine', f0: 200, f1: 1200, dur: 0.45, vol: 0.25, vib: [25, 0.05], curve: 0.8 },
                 { wave: 'tri', notes: [C5, E5, G5, C6], dur: 0.4, vol: 0.15, at: 0.1, curve: 0.5 }],

  // Parry & teleport
  parryUp:      [{ wave: 'sine', f0: 1200, f1: 1900, dur: 0.09, vol: 0.2 },
                 { wave: 'noise', f0: 9000, dur: 0.05, vol: 0.08, lp0: 8000 }],
  parry:        [{ wave: 'square', notes: [E6, G6, 2093], dur: 0.12, vol: 0.18, duty: 0.25, curve: 0.8 },
                 { wave: 'sine', f0: 2600, dur: 0.35, vol: 0.25, curve: 3 },
                 { wave: 'noise', f0: 9000, dur: 0.04, vol: 0.2 }],
  teleport:     [{ wave: 'sine', f0: 260, f1: 1700, dur: 0.32, vol: 0.3, vib: [30, 0.08], curve: 1 },
                 { wave: 'square', f0: 520, f1: 3400, dur: 0.32, vol: 0.06, duty: 0.1, curve: 1 },
                 { wave: 'noise', f0: 8000, dur: 0.2, vol: 0.08, lp0: 9000, at: 0.1 }],

  // Pickups & progress
  pickup:       [{ wave: 'square', notes: [880, 1320], dur: 0.1, vol: 0.18, duty: 0.25, curve: 0.6 }],
  heal:         [{ wave: 'tri', notes: [C5, E5, G5, C6], dur: 0.24, vol: 0.3, curve: 0.5 }],
  powerUp:      [{ wave: 'square', notes: [C5, E5, G5, C6, E6, G6], dur: 0.36, vol: 0.16, duty: 0.25, curve: 0.4 },
                 { wave: 'tri', notes: [C5 / 2, G5 / 2, C5], dur: 0.36, vol: 0.2, curve: 0.4 }],
  checkpoint:   [{ wave: 'square', notes: [G5, C6, E6, G6], dur: 0.4, vol: 0.15, duty: 0.5, curve: 0.4 }],

  // Enemies
  enemyShot:    [{ wave: 'tri', f0: 520, f1: 900, dur: 0.12, vol: 0.2 },
                 { wave: 'square', f0: 1040, f1: 1800, dur: 0.08, vol: 0.05, duty: 0.2 }],
  homing:       [{ wave: 'saw', f0: 110, f1: 160, dur: 0.35, vol: 0.25, lp0: 900 },
                 { wave: 'noise', f0: 1200, dur: 0.35, vol: 0.25, lp0: 1500, lp1: 400 }],
  bombDrop:     [{ wave: 'sine', f0: 1600, f1: 500, dur: 0.45, vol: 0.12, curve: 0.8 }],
  rainWarn:     [{ wave: 'square', f0: 1400, dur: 0.05, vol: 0.06, duty: 0.5, curve: 0.3 }],
  rainFall:     [{ wave: 'sine', f0: 2000, f1: 600, dur: 0.35, vol: 0.08, curve: 0.8 }],
  flyerDive:    [{ wave: 'saw', f0: 300, f1: 900, dur: 0.3, vol: 0.12, lp0: 2500, vib: [40, 0.05] }],

  // Boss
  bossStomp:    [{ wave: 'sine', f0: 75, f1: 35, dur: 0.25, vol: 0.55 },
                 { wave: 'noise', f0: 800, dur: 0.18, vol: 0.25, lp0: 700, lp1: 150 }],
  bossShot:     [{ wave: 'square', f0: 420, f1: 820, dur: 0.12, vol: 0.18, duty: 0.35 },
                 { wave: 'noise', f0: 7000, dur: 0.05, vol: 0.12 }],
  bossCrouch:   [{ wave: 'saw', f0: 90, f1: 140, dur: 0.6, vol: 0.25, lp0: 600, curve: 0.4, vib: [9, 0.1] }],
  bossJump:     [{ wave: 'saw', f0: 120, f1: 420, dur: 0.35, vol: 0.3, lp0: 1500 },
                 { wave: 'noise', f0: 2000, dur: 0.25, vol: 0.2, lp0: 1500, lp1: 400 }],
  bossLand:     [{ wave: 'sine', f0: 60, f1: 22, dur: 0.8, vol: 0.7 },
                 { wave: 'noise', f0: 1200, dur: 0.7, vol: 0.5, lp0: 1800, lp1: 80 }],
  shockwave:    [{ wave: 'noise', f0: 3000, dur: 0.6, vol: 0.3, lp0: 300, lp1: 3500, curve: 1 },
                 { wave: 'saw', f0: 80, f1: 160, dur: 0.6, vol: 0.15, lp0: 800 }],
  bossPhase:    [{ wave: 'saw', f0: 140, f1: 55, dur: 0.9, vol: 0.4, lp0: 1200, vib: [7, 0.12], curve: 0.8 },
                 { wave: 'square', f0: 70, f1: 45, dur: 0.9, vol: 0.2, duty: 0.3, curve: 0.8 },
                 { wave: 'noise', f0: 1500, dur: 0.6, vol: 0.2, lp0: 1200, at: 0.1 }],
  bossWarning:  [0, 0.25, 0.5].map((at) => ({ wave: 'square', f0: 880, f1: 660, dur: 0.18, vol: 0.16, duty: 0.5, curve: 0.4, at })),

  // UI & results
  uiSelect:     [{ wave: 'square', f0: 660, f1: 990, dur: 0.06, vol: 0.18, duty: 0.25 }],
  uiBack:       [{ wave: 'square', f0: 660, f1: 440, dur: 0.06, vol: 0.18, duty: 0.25 }],
  stageClear:   [{ wave: 'square', notes: [C5, E5, G5, C6, G5, C6, E6, G6], dur: 1.1, vol: 0.16, duty: 0.25, curve: 0.3 },
                 { wave: 'tri', notes: [C5 / 2, C5 / 2, G5 / 2, G5 / 2, C5, C5, C5, C5], dur: 1.1, vol: 0.25, curve: 0.3 }],
  gameOver:     [{ wave: 'tri', notes: [392, 330, 262, 196], dur: 1.1, vol: 0.3, curve: 0.5 },
                 { wave: 'square', notes: [196, 165, 131, 98], dur: 1.1, vol: 0.08, duty: 0.4, curve: 0.5 }],
};
