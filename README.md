# Retro Tank Shooter

A side-scrolling pixel-art tank shooter that runs in the browser, built with [Phaser 3](https://phaser.io).
Drive through three levels, aim with the mouse, parry enemy shots back at them, teleport between
platforms, and take down three bosses.

Art: Luis Zuno ([Ansimuz](https://ansimuz.itch.io)) — *Legacy Collection*, CC0.
Sound and music are synthesized in code.

## Controls

| Input | Action |
|---|---|
| `A` / `D` | Drive |
| Mouse | Aim the turret |
| Left click (hold) | Fire |
| `Space` / right click | Parry |
| `W` on a glowing pad | Teleport |
| `Esc` / `P` | Pause |

## Run it locally

```bash
python game/dev-server.py
```

Then open <http://localhost:8080/game/>. (Opening the HTML file directly doesn't work — browsers
block loading images from `file://`.)

## Deploy

- **Vercel:** import the repo; `vercel.json` makes it a static site with no build step.
  The site root forwards to `game/`.
- **GitHub Pages:** in the repo go to **Settings → Pages → Source: GitHub Actions**. The workflow in
  `.github/workflows/pages.yml` builds and publishes on every push to `main`.
- **itch.io:** run `python game/build.py` and upload `dist/retro-tank-shooter.zip` as an HTML5 game.

See [SPEC.md](SPEC.md) for the full design.
