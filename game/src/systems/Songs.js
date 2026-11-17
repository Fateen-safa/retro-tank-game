// Chiptune music, written as data and turned into sound by Synth.renderSound.
// Each song: tempo, a chord per bar, and 16-step patterns for bass, arpeggio, lead rhythm and drums.
//   bass:  x = root, o = octave up, f = fifth, . = rest
//   arp:   digits pick a chord tone (0 root, 1 third, 2 fifth, 3 octave), . = rest
//   lead:  x = a melody note starts here (pitches are generated from the chords with a fixed seed)
//   kick / snare / hat: x = hit

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// "A2m" -> { root: midi, minor: true }
function chord(str) {
  const m = /^([A-G](?:#|b)?)(\d)(m?)$/.exec(str);
  return { root: NOTE[m[1]] + (Number(m[2]) + 1) * 12, minor: m[3] === 'm' };
}

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const SONGS = {
  title: {
    bpm: 96, bars: 8, seed: 7, chords: ['A2m', 'F2', 'C3', 'G2'],
    bass: 'x.......x...o...', arp: '0.1.2.3.2.1.0.1.', lead: 'x.....x...x.....',
    kick: '', snare: '', hat: '....x.......x...',
    voices: { bass: 'tri', arp: 'sine', lead: 'square' }, pad: true, leadVol: 0.1,
  },
  level1: {
    bpm: 128, bars: 8, seed: 11, chords: ['A2m', 'F2', 'G2', 'E2m'],
    bass: 'x.x.o.x.x.x.o.x.', arp: '0.2.3.2.0.2.3.2.', lead: 'x..x..x.x...x.x.',
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    voices: { bass: 'square', arp: 'square', lead: 'square' }, leadVol: 0.11,
  },
  level2: {
    bpm: 136, bars: 8, seed: 23, chords: ['D2m', 'A#2', 'C3', 'A2'],
    bass: 'x..xo..xx..xo.x.', arp: '0.1.2.1.0.1.2.3.', lead: 'x.x...x..x.x..x.',
    kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
    voices: { bass: 'saw', arp: 'tri', lead: 'saw' }, leadVol: 0.09,
  },
  level3: {
    bpm: 118, bars: 8, seed: 31, chords: ['E2m', 'C2', 'D2', 'B1m'],
    bass: 'x.xxo.x.x.xxo.xo', arp: '0..1..2..3..2..1', lead: 'x...x..x..x.x...',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x.x.x.',
    voices: { bass: 'saw', arp: 'square', lead: 'square' }, leadVol: 0.1,
  },
  boss: {
    bpm: 158, bars: 8, seed: 5, chords: ['A2m', 'A2m', 'F2', 'E2'],
    bass: 'xxoxxxoxxxoxxfox', arp: '0213021302130213', lead: 'x.xx.x.xx.x.xx.x',
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    voices: { bass: 'saw', arp: 'square', lead: 'square' }, leadVol: 0.1,
  },
};

// Turn a song into synth layers (see Synth.renderSound). Returns { layers, length }.
export function songLayers(spec) {
  const step = 60 / spec.bpm / 4;
  const steps = spec.bars * 16;
  const length = steps * step;
  const L = [];
  const rand = rng(spec.seed);
  const pat = (p, i) => p && p[i % 16] === 'x';

  // Melody: generated once for 4 bars and repeated (with an octave lift on the second pass)
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19];
  const melody = [];
  let deg = 4;
  for (let i = 0; i < 64; i++) {
    if (spec.lead[i % 16] !== 'x') { melody.push(null); continue; }
    deg = Phaser.Math.Clamp(deg + Math.floor(rand() * 5) - 2, 0, scale.length - 1);
    melody.push(deg);
  }

  for (let i = 0; i < steps; i++) {
    const at = i * step;
    const bar = Math.floor(i / 16);
    const c = chord(spec.chords[bar % spec.chords.length]);
    const tones = [0, c.minor ? 3 : 4, 7, 12];
    const s16 = i % 16;

    // Bass
    const b = spec.bass[s16];
    if (b && b !== '.') {
      const n = c.root + (b === 'o' ? 12 : b === 'f' ? 7 : 0);
      L.push({ wave: spec.voices.bass, f0: hz(n), dur: step * 0.9, at, vol: 0.22, duty: 0.5, curve: 1.2, lp0: 1800 });
    }
    // Arpeggio
    const a = spec.arp[s16];
    if (a && a !== '.') {
      L.push({ wave: spec.voices.arp, f0: hz(c.root + 24 + tones[Number(a)]), dur: step * 0.8, at, vol: 0.07, duty: 0.25, curve: 2 });
    }
    // Lead
    const m = melody[i % 64];
    if (m !== null) {
      let len = 1;
      while (len < 4 && melody[(i + len) % 64] === null) len++;
      const lift = Math.floor(i / 64) % 2 === 1 && spec.bars > 4 ? 12 : 0;
      L.push({ wave: spec.voices.lead, f0: hz(c.root + 24 + scale[m] + lift - (c.minor ? 0 : 0)), dur: step * len * 0.85, at, vol: spec.leadVol, duty: 0.25, curve: 0.8, vib: [6, 0.006] });
    }
    // Pad: one long chord per bar
    if (spec.pad && s16 === 0) {
      for (const t of tones.slice(0, 3)) L.push({ wave: 'saw', f0: hz(c.root + 12 + t), dur: step * 16, at, vol: 0.035, attack: 0.3, curve: 0.6, lp0: 900 });
    }
    // Drums
    if (pat(spec.kick, i)) L.push({ wave: 'sine', f0: 150, f1: 42, dur: 0.14, at, vol: 0.45 });
    if (pat(spec.snare, i)) L.push({ wave: 'noise', f0: 7000, dur: 0.12, at, vol: 0.2, lp0: 6000, lp1: 2000 }, { wave: 'tri', f0: 220, f1: 140, dur: 0.06, at, vol: 0.12 });
    if (pat(spec.hat, i)) L.push({ wave: 'noise', f0: 12000, dur: 0.035, at, vol: 0.06, lp0: 11000, curve: 3 });
  }
  return { layers: L, length };
}
