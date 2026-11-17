# Retro Tank Shooter — Game Spec

*Working title. Spec v1, 2026-11-17.*

## 1. Overview

This is a side-scrolling 2D pixel-art tank shooter that runs in the browser. The player drives a heavy sci-fi tank from left to right through alien levels. They aim the cannon with the mouse, blast walkers, flyers and gunships, collect power-ups, and fight a boss at the end of each level.

| Decision | Choice |
|---|---|
| View | Side-view (matches the only tank sprite in the asset pack) |
| Platform | Desktop browser, keyboard + mouse |
| Engine | [Phaser 3](https://phaser.io) (pinned to `3.80.1`), plain JavaScript ES modules, no build step |
| Game shape | Scrolling levels with a boss at the end of each |
| Aiming | Mouse aim: the turret barrel rotates toward the cursor |
| Art | Ansimuz *Legacy Collection*, CC0 ([license](TankGame-Assets/public-license.pdf)). No credit is required, but we'll include one anyway |

## 2. General requirements

These hold for every milestone.

### 2.1 Display
- **R1.** The game renders at a fixed internal resolution of **640 × 360** (changed from 384 × 216 so the tank takes up less of the screen) and scales by the largest **whole number** that fits the window. Pixels stay crisp, with no blur: `pixelArt: true` and `roundPixels: true`.
- **R2.** Background layers are anchored to the bottom of the screen. The far sky and towers are drawn at 2× to fill the taller view, with a 1× towers layer in front for parallax depth.
- **R3.** The game runs at a steady 60 FPS on a mid-range laptop in Chrome, Edge and Firefox.

### 2.2 Controls
| Input | Action |
|---|---|
| `A` / `D` (or `←` / `→`) | Drive left / right |
| Mouse move | Aim the turret. The tank hull flips to face the side the cursor is on |
| Left click (hold to auto-fire) | Fire the main cannon |
| `Space` or right-click | Parry (see R12) |
| `W` / `↑` on a teleporter pad | Teleport to the linked pad (see R13) |
| `Esc` / `P` | Pause |
| `R` (on game-over screen) | Restart |

- **R4.** The barrel's angle is limited to between **15° below horizontal** and **straight up**, on whichever side the tank faces.
- **R5.** Shells leave the barrel's tip, not the middle of the tank.

### 2.3 Tank (player)
- **R6.** The tank has hit points, starting at **5**. Touching an enemy or getting hit by an enemy shot costs 1 HP (homing fireballs and boss landings cost 2). After a hit, the tank can't be damaged again for **0.7 s** and blinks while protected.
- **R7.** The tread animation plays only while the tank is moving.
- **R8.** At 0 HP the tank explodes and the game-over screen appears.

### 2.3b Parry, platforms and hazards (added after Milestone 2)
- **R12. Parry.** `Space` or right-click raises an energy shield for **0.25 s** (1 s cooldown, shown as a meter under the lives counter). Any enemy shot that reaches the shield is sent back at the nearest on-screen enemy, **1.3× faster with 2× damage**, and scores 50. A successful parry cuts the cooldown to 0.3 s, so you can chain parries.
- **R13. Platforms and teleporters.** Floating platforms sit above the ground throughout the level. The tank can't jump; it reaches platforms only through **teleporter pads**, which are linked in pairs (stand on one and press `W`). Driving off a platform's edge drops the tank to the surface below. Platforms block shots from both sides, so they work as cover. Teleporting gives 0.4 s of protection and makes any homing shots fizzle out.
- **R14. Hazards.**
  - **Sky rain:** in marked zones (and during the boss fight), bullets fall from the top of the screen. Each one is announced by a blinking red marker where it will land. Platforms stop rain.
  - **Homing fireballs** (fired by red elite units and the raging boss) fly through cover and are faster than the tank. They can only be parried or escaped by teleporting.

### 2.3c Presentation, sound and game feel
- **R15. Sound.** Every player, enemy and boss action has a sound effect: firing (each weapon), charging, impacts, explosions (small and big), getting hit, the low-armor alarm, death, respawn, landing, parry (raise and deflect), teleport, pickups, heal, power-up, checkpoint, enemy and boss fire, homing fireballs, bombs, sky-rain warnings, flyer dives, boss stomp, crouch, jump, landing, shockwave, phase change and warning siren, menu clicks, stage clear and game over. The pack has no audio, so sounds are **synthesized in code at load time** (`src/systems/Synth.js`). Pitch varies slightly on every play, the same sound can't restart within a few milliseconds, and sounds far off screen play quieter. Master volume is saved in the browser; `M` mutes on the title screen.
- **R16. HUD.** Pixel-art panels (drawn for this game in the pack's palette) show the pilot portrait, 5 armor cells (HP), mini-tank life icons, the parry meter, score and the active power-up with its timer. The boss bar shows a boss portrait, phase markers at 66% and 33%, and the current phase. The last armor cell blinks at 1 HP.
- **R17. Game feel.**
  - **Hit-stop:** short freezes on parries (60 ms), heavy kills, getting hit, boss phase changes and the boss's death.
  - **Feedback:** barrel recoil, screen shake, the pilot portrait flinches when hit, a red screen edge on damage, and a pulsing red edge plus alarm at 1 HP.
  - **Look:** a soft vignette and faint scanlines, plus fade transitions between screens.
  - **Pause menu** (`Esc`/`P`, and automatically when the window loses focus): resume, restart, volume, quit to title.
  - **Tutorial hints**, shown once per session at the moment each one becomes relevant: movement, first teleporter, first incoming shot (parry), first homing fireball, first sky rain, charge shot, boss arena.

### 2.4 Code & project layout
- **R9.** The project folder is laid out like this:
  ```
  retro game/
    SPEC.md
    TankGame-Assets/        ← art (read-only source of truth)
    game/
      index.html
      dev-server.py         ← local server that disables caching
      build.py              ← makes the itch.io package
      src/ main.js, scenes/, entities/, systems/, data/levels/
    dist/                   ← build output (retro-tank-shooter/ + .zip)
  ```
  In development, Phaser 3.80.1 is loaded from cdnjs, pinned to that exact version. The itch.io build bundles its own copy. The pixel font loads from Google Fonts in both.
- **R10.** To play, run `python game/dev-server.py` from `retro game/` and open `http://localhost:8080/game/`. The dev server turns off browser caching, so a normal reload always picks up code changes. (Browsers block loading images straight from `file://`, so opening the page directly won't work.)
- **R11.** Enemy stats, weapon stats and level layouts live in data files (`src/data/`), not hard-coded, so they can be tuned without touching game logic.

## 3. Milestones

Every milestone ends with a game you can **play from start to finish**: a start screen, a win condition, a lose condition, and a restart.

---

### Milestone 1 — "Drive & Shoot" (vertical slice)

**Goal:** prove the core feel. Driving, aiming and shooting are fun on one short stage.

**Playable loop:** start screen → drive across a 3-screen-wide stage → destroy alien walkers → reach the exit beacon to **win**, or lose all HP for **game over** → restart.

Requirements:
- **M1-1** A title screen shows the game title and "Click to start".
- **M1-2** The stage is **another-world**: a sky layer, a back-towers layer with parallax scrolling, and a flat ground strip plus a few blocks built from the tileset. It is about 1150 px (3 screens) wide.
- **M1-3** The camera follows the tank horizontally, smoothly, and stops at the stage edges.
- **M1-4** The tank drives (R7), aims with the mouse (R4) and fires (R5). The **barrel is a separate sprite** that rotates, cut from the original tank art (see §5, Gap 1, now done).
- **M1-5** The main cannon uses **Bolt** shells: fast, flying straight, at 4 shots per second. Each impact plays the **Hit** effect.
- **M1-6** **Alien walkers** (about 6, placed by hand) walk toward the tank once it's on screen and hurt it on contact. Each has 2 HP and plays **enemy-death** when destroyed.
- **M1-7** The heads-up display (HUD) shows HP as pips. A win screen and a game-over screen each offer restart.
- **M1-8** Debug toggle `F1` shows collision boxes.

**Done when:** a new player can finish the stage in under 2 minutes, and dying or winning both lead back to a working restart.

---

### Milestone 2 — "Full Level"

**Goal:** one complete, varied level with a boss, pickups and score.

**Playable loop:** title → Level 1 (**another-world**, about 8 screens long) → mid-level checkpoint → **mini-boss** → level-clear screen showing the score.

Requirements:
- **M2-1** Levels are loaded from a data file (`levels/level1.json`): ground tiles, blocks, enemy spawn points, pickups, checkpoint, boss position.
- **M2-2** Ground has height changes (steps and ramps). The tank follows the slope, and shells explode against solid blocks.
- **M2-3** The enemy roster grows:
  | Enemy | Behaviour | HP |
  |---|---|---|
  | Alien walker | Walks toward the tank and hurts on contact | 2 |
  | Alien flyer | Swoops toward the tank in a sine-wave path, then flies away | 2 |
  | Bipedal unit | Walks, stops, fires a slow **Pulse** shot along the ground | 4 |
  | Spaceship unit | Hovers above and drops bombs that blow up with the **ground explosion** effect. The pack has no bomb sprite, so bombs are **Spark** shots pointing down | 5 |
- **M2-4** The **mech unit** is the mini-boss: **90 HP**, with a health bar, fought in a **three-floor arena** linked by teleporters. The camera locks to the arena during the fight. Dying there sends you back to the checkpoint and resets the boss. It drops one health gem at half HP.
  | Phase | HP | Attacks |
  |---|---|---|
  | 1 | 100–66% | Stomps toward the tank, fires 3-shot **Spark** bursts aimed where the tank is heading |
  | 2 | 66–33% | Faster, 4-shot bursts, plus a **jump-stomp**: flashes, leaps to the tank (a red marker shows where it'll land), crushes for 2 HP, sends **waveform** shockwaves along the floor both ways and calls a 6-bullet sky rain |
  | 3 | under 33% | **Rage** (red tint): 1.5× speed, 5-shot bursts, 2 homing fireballs per burst, constant light rain |
- **M2-3b** Smarter enemies: walkers come in packs and lunge when close; flyers dive at the tank; bipedal units aim ahead of a moving tank; red **elite** bipedal units fire homing fireballs; bombers drop 3-bomb clusters aimed ahead of the tank. Health drops are rarer.
- **M2-4b** **Supply crates** (the gem item boxes) sit along the level. One shot breaks a crate and drops a set gem.
- **M2-5** Pickups, using gems from the gem sheet, drop from some destroyed enemies:
  - Green gem: +1 HP
  - Blue gem: **Charged shot** for 15 s. Hold the button to charge, release to fire a piercing **charged** blast
  - Red gem: **Spread shot** for 15 s. Fires 3 **crossed** shells in a fan
- **M2-6** Score goes up for each enemy destroyed and each gem picked up, and is shown in the HUD. The best score is saved in `localStorage`.
- **M2-7** Checkpoint: dying sends the tank back to the checkpoint with full HP, and the player has **3 lives**. Losing all lives means game over.
- **M2-8** Juice: screen shake on big explosions, a white flash when an enemy is hit, and a small smoke puff at the barrel tip when firing.

**Done when:** Level 1 can be beaten without debug tools, the mini-boss fight takes 45–90 s for a first-time player, and all three power-ups work.

---

### Milestone 3 — "Campaign & Polish"

**Goal:** a short, complete game you could share.

**Playable loop:** title → level select (unlocked as you go) → Levels 1–3 → final boss → ending screen with total score.

Requirements:
- **M3-1** Three levels, each with its own art and enemy mix:
  | # | Level | Environment | New threat | Boss |
  |---|---|---|---|---|
  | 1 | Overgrown Ruins | another-world | — | Mech unit |
  | 2 | Desert Outpost | desert-outpost + alien-base sections | Flying vehicles 1 & 2 (strafing runs) | Twin flying vehicle 2s |
  | 3 | Junk Wastelands | junk-wastelands with an industrial-parallax skyline | Every enemy type, denser waves | **Flying vehicle 3 dreadnought** |
- **M3-1b** New enemy, **strafer** (flying vehicle 1): sweeps in from the right edge, fires a fan of red-orange enemy bolts, and leaves. **Heavy strafers** (flying vehicle 2) drop a bomb carpet instead. Enemy bolts are tinted red-orange so they never look like the player's shots.
- **M3-1c** **Twin Gunships** (Level 2 boss, 2 × 55 HP): two flying vehicle 2s that take turns doing low strafing runs that rain sparks, high bomb carpets, and aimed bolt volleys. When one goes down, the other enrages (faster, homing fireballs, sky rain). The arena has open space in the middle so you can shoot up at them from the ground, and a small platform with a teleporter by each wall for cover.
- **M3-2** The final boss is the **Dreadnought** (flying vehicle 3, **150 HP**, 3 phases), hovering on the right of a three-floor arena:
  | Phase | Attacks |
  |---|---|
  | 1 | Fans of 5 bolts aimed ahead of the tank; calls in a pair of flyers every 9 s |
  | 2 | Adds a **sweeping waveform beam**: the nose charges (warning siren + hint), then sweeps from high to low with **one random safe gap**. Plus sky rain |
  | 3 | **Rage**: red tint, belly thrusters flare, it roams the arena; 7-bolt fans, homing fireballs, faster beams, constant rain |
  It dies in a chain of **explosion-1-d** blasts, then one giant **explosion-1-e** with a white flash. Health gems drop at 100 and 50 HP.
- **M3-3** ✅ Sound effects (R15) and **music**: five chiptune loops synthesized in code (`src/systems/Songs.js`): title, one theme per level, and a boss theme that speeds up in the final phase. **SFX and music have separate volume sliders** (title menu and pause menu), saved in the browser. `M` mutes both on the title screen.
- **M3-4** ✅ Pause menu: resume, restart level, SFX volume, music volume, quit to title.
- **M3-5** ✅ Level select: clearing a level unlocks the next, saved in `localStorage`. Locked levels are greyed out.
- **M3-6** ✅ A "how to play" card appears before the first game (and from the title menu). Any key or click skips it.
- **M3-7** ✅ Credits thank Ansimuz with a clickable link to ansimuz.itch.io, and credit the font, engine and sound. After the final boss, the credits double as the ending screen with the final score.
- **M3-8** ✅ `python game/build.py` makes `dist/retro-tank-shooter/` (index.html at the root, bundled Phaser, art copied to `assets/`) and `dist/retro-tank-shooter.zip` to upload to itch.io as an HTML5 game.
- **M3-9** Campaign flow: after a stage clear, **Continue** starts the next level and carries the score over. After a game over, **Retry** restarts that level from the score you had when it began.

**Done when:** a new player can finish all 3 levels in about 15–20 minutes, and nothing breaks (no crashes, no soft-locks) in a full playthrough on all three browsers.

## 4. Asset list

All paths are relative to this spec. Frame size = the size of one animation frame. **Sheet** = all frames side by side in one image, which is the file we load in Phaser. The **Frames** link is the folder of separate frame images.

### 4.1 Player
| Asset | Sheet | Frames | Frame size | Count | Use | Milestone |
|---|---|---|---|---|---|---|
| Tank (original) | [Spritesheet.png](TankGame-Assets/player/tank/Spritesheet.png) | [Sprites/](TankGame-Assets/player/tank/Sprites/) | 128×64 | 4 | Source art for the edited tank below | ref |
| Tank hull (edited) | [hull-sheet.png](TankGame-Assets/player/tank/edited/hull-sheet.png) | — | 128×64 | 4 | Tank hull + treads, used in game | M1 |
| Tank barrel (edited) | [barrel.png](TankGame-Assets/player/tank/edited/barrel.png) | — | 48×8 | 1 | Rotating turret barrel | M1 |
| Tank reference | [tank-unit-preview.png](TankGame-Assets/player/tank/tank-unit-preview.png) | — | 224×176 | 1 | Shows the scale against the scenery | ref |

### 4.2 Enemies
| Asset | Sheet | Frames | Frame size | Count | Use | Milestone |
|---|---|---|---|---|---|---|
| Alien walker (walk) | [alien-enemy-walk.png](TankGame-Assets/enemies/alien-walking-enemy/Spritesheets/alien-enemy-walk.png) | [walk/](TankGame-Assets/enemies/alien-walking-enemy/Sprites/walk/) | 57×42 | 6 | Basic ground enemy | M1 |
| Alien walker (idle) | [alien-enemy-idle.png](TankGame-Assets/enemies/alien-walking-enemy/Spritesheets/alien-enemy-idle.png) | [Idle/](TankGame-Assets/enemies/alien-walking-enemy/Sprites/Idle/) | 48×48 | 4 | Before it notices the tank | M1 |
| Alien flyer | [spritesheet.png](TankGame-Assets/enemies/alien-flying-enemy/spritesheet.png) | [sprites/](TankGame-Assets/enemies/alien-flying-enemy/sprites/) | 83×64 | 8 | Swooping flyer | M2 |
| Bipedal unit | [spritesheet.png](TankGame-Assets/enemies/bipedal-Unit/spritesheet.png) | [sprites/](TankGame-Assets/enemies/bipedal-Unit/sprites/) | 80×64 | 7 | Ground shooter | M2 |
| Spaceship unit | [Spritesheet.png](TankGame-Assets/enemies/spaceship-unit/Spritesheets/Spritesheet.png) | [ShipandThrust/](TankGame-Assets/enemies/spaceship-unit/Sprites/ShipandThrust/) | 106×77 | 8 | Bomber | M2 |
| Mech unit | [mech-unit.png](TankGame-Assets/enemies/mech-unit/spritesheet/mech-unit.png) | [sprites/](TankGame-Assets/enemies/mech-unit/sprites/) | 96×80 | 10 | Mini-boss, Level 1 | M2 |
| Flying vehicle 1 | [spritesheet.png](TankGame-Assets/enemies/flying-vehicles/vehicle%201/spritesheet.png) | [Sprites/](TankGame-Assets/enemies/flying-vehicles/vehicle%201/Sprites/), [thrust/](TankGame-Assets/enemies/flying-vehicles/vehicle%201/thrust/) | 176×96 (thrust 48×48) | 3 + 3 | Strafing fighter | M3 |
| Flying vehicle 2 | [spritesheet.png](TankGame-Assets/enemies/flying-vehicles/vehicle%202/spritesheet.png) | [Sprites/](TankGame-Assets/enemies/flying-vehicles/vehicle%202/Sprites/), [thrust/](TankGame-Assets/enemies/flying-vehicles/vehicle%202/thrust/) | 176×125 (thrust 81×58) | 3 + 3 | Heavy flyer / Level 2 boss | M3 |
| Flying vehicle 3 | [spritesheet.png](TankGame-Assets/enemies/flying-vehicles/vehicle%203/spritesheet.png) | [Sprites/](TankGame-Assets/enemies/flying-vehicles/vehicle%203/Sprites/), [thrust-back/](TankGame-Assets/enemies/flying-vehicles/vehicle%203/Sprites/frames-thrust/thrust-back/), [thrust-bottom/](TankGame-Assets/enemies/flying-vehicles/vehicle%203/Sprites/frames-thrust/thrust-bottom/) | 329×160 | 3 + 3 + 3 | Final boss | M3 |

### 4.3 Projectiles
| Asset | Sheet | Frames | Frame size | Count | Use | Milestone |
|---|---|---|---|---|---|---|
| Bolt | [spritesheet.png](TankGame-Assets/projectiles/Bolt/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/Bolt/sprites/) | 48×32 | 4 | Main cannon shell; boss volleys | M1 |
| Pulse | [spritesheet.png](TankGame-Assets/projectiles/Pulse/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/Pulse/sprites/) | 63×32 | 4 | Bipedal unit shot | M2 |
| Spark | [spritesheet.png](TankGame-Assets/projectiles/spark/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/spark/sprites/) | 63×32 | 5 | Mech-unit burst | M2 |
| Charged | [spritesheet.png](TankGame-Assets/projectiles/charged/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/charged/sprites/) | 63×48 | 6 | Charged-shot power-up | M2 |
| Crossed | [spritesheet.png](TankGame-Assets/projectiles/crossed/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/crossed/sprites/) | 32×32 | 6 | Spread-shot power-up | M2 |
| Waveform | [spritesheet.png](TankGame-Assets/projectiles/waveform/spritesheet.png) | [sprites/](TankGame-Assets/projectiles/waveform/sprites/) | 95×32 | 4 | Mini-boss ground shockwave (M2); final-boss sweeping beam (M3) | M2 |

### 4.4 Effects
| Asset | Sheet | Frames | Frame size | Count | Use | Milestone |
|---|---|---|---|---|---|---|
| Hit | [hit.png](TankGame-Assets/fx/hit/hit.png) | [Sprites/](TankGame-Assets/fx/hit/Sprites/) | 31×32 | 3 | Shell impact | M1 |
| Enemy death | [spritesheet.png](TankGame-Assets/fx/enemy-death/spritesheet.png) | [Sprites/](TankGame-Assets/fx/enemy-death/Sprites/) | 48×48 | 8 | Small enemy destroyed | M1 |
| Explosion 1-a | [spritesheet.png](TankGame-Assets/fx/explosions/explosion-1-a/spritesheet.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-a/Sprites/) | 32×32 | 8 | Muzzle smoke / tiny blast | M2 |
| Explosion 1-b | [spritesheet.png](TankGame-Assets/fx/explosions/explosion-1-b/spritesheet.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-b/Sprites/) | 64×64 | 8 | Medium enemy destroyed | M2 |
| Explosion 1-c | [spritesheet.png](TankGame-Assets/fx/explosions/explosion-1-c/spritesheet.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-c/Sprites/) | 128×80 | 10 | Tank destroyed | M1 |
| Explosion 1-d | [spritsheet.png](TankGame-Assets/fx/explosions/explosion-1-d/spritsheet.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-d/Sprites/) | 128×128 | 12 | Boss death chain | M3 |
| Explosion 1-e | [explosion-5.png](TankGame-Assets/fx/explosions/explosion-1-e/explosion-5.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-e/Sprites/) | 192×192 | 22 | Final boss death | M3 |
| Explosion 1-f | [Sprites.png](TankGame-Assets/fx/explosions/explosion-1-f/Sprites.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-f/Sprites/) | 48×48 | 8 | Projectile popping against a wall | M2 |
| Explosion 1-g | [spritesheet.png](TankGame-Assets/fx/explosions/explosion-1-g/spritesheet.png) | [Sprites/](TankGame-Assets/fx/explosions/explosion-1-g/Sprites/) | 48×48 | 7 | Spread-shell impact | M2 |
| Ground explosion | [explosion-animation.png](TankGame-Assets/fx/ground-explosion/spritesheet/explosion-animation.png) + [.json](TankGame-Assets/fx/ground-explosion/spritesheet/explosion-animation.json) | [sprites/](TankGame-Assets/fx/ground-explosion/sprites/) | 112×128 | 9 | Bomber bombs, boss stomps | M2 |
| Energy shield | [spritesheet.png](TankGame-Assets/fx/grotto/energy-shield/spritesheet.png) | [frames](TankGame-Assets/fx/grotto/energy-shield/) | 51×47 | 8 | Parry shield (drawn 2×); also the teleporter pad orb | M2 |
| Electro shock | [spritesheet.png](TankGame-Assets/fx/grotto/electro-shock/spritesheet.png) | [frames](TankGame-Assets/fx/grotto/electro-shock/) | 128×96 | 9 | Teleport flash, boss phase change | M2 |
| Energy smack | [spritesheet.png](TankGame-Assets/fx/grotto/energy-smack/spritesheet.png) | [frames](TankGame-Assets/fx/grotto/energy-smack/) | 128×96 | 8 | Parry spark; red landing/rain warning marker | M2 |
| Fire ball | [spritesheet.png](TankGame-Assets/fx/grotto/fire-ball/spritesheet.png) | [frames](TankGame-Assets/fx/grotto/fire-ball/) | 52×29 | 3 | Homing fireball (parry-only threat) | M2 |
| Hits 1–6 | [hits-1](TankGame-Assets/fx/hits/hits-1/spritesheet.png), [Hits-2](TankGame-Assets/fx/hits/Hits-2/spritesheet.png), [Hits-3](TankGame-Assets/fx/hits/Hits-3/spritesheet.png), [hits-4](TankGame-Assets/fx/hits/hits-4/spritesheet.png), [Hits-5](TankGame-Assets/fx/hits/Hits-5/spritesheet.png), [Hits-6](TankGame-Assets/fx/hits/Hits-6/spritesheet.png) | [hits/](TankGame-Assets/fx/hits/) | 32×32 | 5–7 | Impact variety: one per weapon type | M2 |

### 4.5 Environments
| Asset | Layers / tiles | Preview | Use | Milestone |
|---|---|---|---|---|
| Another world | [sky](TankGame-Assets/environments/another-world/PNG/layered/sky.png), [back-towers](TankGame-Assets/environments/another-world/PNG/layered/back-towers.png), [composed-bg](TankGame-Assets/environments/another-world/PNG/layered/composed-bg.png), [tileset](TankGame-Assets/environments/another-world/PNG/layered/another-world-tileset.png) | [preview](TankGame-Assets/environments/another-world/PNG/another-world-PREVIEW.png) | Level 1 | M1 |
| Desert outpost | [sky](TankGame-Assets/environments/desert-outpost/PNG/sky.png), [back](TankGame-Assets/environments/desert-outpost/PNG/back.png), [tileset](TankGame-Assets/environments/desert-outpost/PNG/sci-fi-environment-tileset.png) | [preview](TankGame-Assets/environments/desert-outpost/preview-sci-fi-environment-tileset.png) | Level 2 | M3 |
| Alien base | [background](TankGame-Assets/environments/alien-base/PNG/layers/background.png), [back-structures](TankGame-Assets/environments/alien-base/PNG/layers/back-structures.png), [tileset](TankGame-Assets/environments/alien-base/PNG/layers/tileset.png) | [preview](TankGame-Assets/environments/alien-base/PNG/preview-alien-environment.png) | Level 2 indoor section | M3 |
| Junk wastelands | [back](TankGame-Assets/environments/junk-wastelands/layers/back.png), [middle](TankGame-Assets/environments/junk-wastelands/layers/middle.png), [near](TankGame-Assets/environments/junk-wastelands/layers/near.png), [tileset](TankGame-Assets/environments/junk-wastelands/layers/tileset.png) | [preview](TankGame-Assets/environments/junk-wastelands/preview.png) | Level 3 | M3 |
| Industrial parallax | [bg](TankGame-Assets/environments/industrial-parallax/Layers/bg.png), [far-buildings](TankGame-Assets/environments/industrial-parallax/Layers/far-buildings.png), [buildings](TankGame-Assets/environments/industrial-parallax/Layers/buildings.png), [foreground](TankGame-Assets/environments/industrial-parallax/Layers/skill-foreground.png) | — | Level 3 skyline section | M3 |
| City skyline | [sky](TankGame-Assets/environments/city-skyline/layers/Sky-layer.png), [buildings](TankGame-Assets/environments/city-skyline/layers/buildings-layer.png) | [preview](TankGame-Assets/environments/city-skyline/urban-landscape-background-Preview.png) | Title / level-select background | M3 |

### 4.5b HUD art
| Asset | File | Use | Milestone |
|---|---|---|---|
| HUD icons (made for this game) | [hud-icons.png](TankGame-Assets/ui/hud-icons.png) | Armor cell full/empty (8×12), life tank (16×10), 9-slice panel (16×16), shield icon (8×8) | M2 |
| Pilot portrait | [base2.png](TankGame-Assets/ui/portraits/base2.png) | HUD pilot (48×48) | M2 |
| Boss portrait | [base4.png](TankGame-Assets/ui/portraits/base4.png) | Boss bar (drawn at ½ size) | M2 |
| Other portraits | [base1.png](TankGame-Assets/ui/portraits/base1.png), [base3.png](TankGame-Assets/ui/portraits/base3.png) | Spare: M3 boss bars / story cards | M3 |

### 4.6 Pickups & UI
| Asset | File | Use | Milestone |
|---|---|---|---|
| Gems | [gems-spritesheet.png](TankGame-Assets/pickups/gems/spritesheets/gems-spritesheet.png) | Power-ups: green = HP, blue = charged, red = spread | M2 |
| Gem item boxes | same sheet, framed rows | Breakable supply crates | M2 |
| Gem stage tileset | [stage-tileset.png](TankGame-Assets/pickups/gems/spritesheets/stage-tileset.png) | Not planned; spare | — |

## 5. Gaps: things the asset pack doesn't cover

1. **Separate turret barrel (needed for mouse aim). ✅ Done in M1.** The barrel was erased from the 4 tank frames and cut out as its own sprite:
   - [hull-sheet.png](TankGame-Assets/player/tank/edited/hull-sheet.png): 4 frames, 128×64, barrel removed. Frames 2 and 4 bob up 1 px, and the barrel follows.
   - [barrel.png](TankGame-Assets/player/tank/edited/barrel.png): 48×8. The pivot is 4 px in from the left end, which sits at (68, 31) in hull frame 1.
2. **Audio. ✅ Done:** sound effects and music are both synthesized in code (see R15, M3-3).
3. **Font / HUD. ✅ Done:** *Press Start 2P* (SIL Open Font License) from Google Fonts, plus HUD icons drawn for this game (see §4.5b).
4. **Title logo.** Text logo in the pixel font for now. Optional custom art later.

## 6. Out of scope (for now)
Mobile/touch controls, gamepad, multiplayer, online leaderboards, a level editor UI (levels are edited as JSON or in the free *Tiled* editor).
