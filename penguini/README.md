# PENGUINI

A 3D open-world story game set in Cold City, an arctic metropolis built and run
by penguins. The world is ridiculous; the stakes are played straight.

Built with [Three.js](https://threejs.org) (the 3D bit) and
[Vite](https://vitejs.dev) (the tool that turns the code into files a browser
can load). Plain JavaScript, no TypeScript. It runs in a browser on desktop and
on phones, and it deploys as static files to GitHub Pages for free.

---

## Running it on your own computer

You need [Node.js](https://nodejs.org) installed once (get the "LTS" version).
After that, open a terminal in this folder and type:

```bash
npm install     # only needed the first time - downloads Three.js and Vite
npm run dev     # starts the game
```

It'll print a web address like `http://localhost:5173/`. Open that in your
browser. Leave the terminal running - every time you save a file, the browser
updates itself.

Press `Ctrl+C` in the terminal to stop it.

To see it on your phone while you're working, `npm run dev` also prints a
"Network" address. Type that into your phone's browser (both devices have to be
on the same wifi).

## Putting it on the internet

You don't have to do anything. Pushing to GitHub triggers
`.github/workflows/deploy-penguini.yml`, which builds the game and publishes it.
Watch it happen on the repo's **Actions** tab.

To build the published version locally and check it before pushing:

```bash
npm run build     # writes the finished files into dist/
npm run preview   # serves dist/ so you can look at it
```

---

## What's in here

```
penguini/
├── index.html        the page the browser opens - mostly the loading screen
├── src/
│   ├── main.js       the starting point: renderer, camera, the game loop
│   ├── world.js      the ground, the lighting, and the colour palette
│   └── sky.js        the night sky and the aurora
├── data/             dialogue scenes will live here (JSON you can edit yourself)
├── docs/
│   └── story-scope.md  the full 20-chapter story - the source for every scene
├── public/           images and sounds go here once we have any
└── vite.config.js    build settings - you rarely need to touch this
```

Every file is commented in plain English. If a comment doesn't make sense, that's
a bug in the comment - say so.

## The story

The whole narrative - four districts, the cast, twenty chapters, four endings -
is written down in [`docs/story-scope.md`](docs/story-scope.md). That document is
the source every dialogue scene gets written from. It does not all get built now;
its own build order says chapter 1 first, then 2-4, then chapter 9, then the rest.

Three things in it change what gets built during Phase 1:

- **The Meridian towers have to be visible from every street on Block 9.** That's
  the thesis of the game, not a level-design note, so the tall towers get placed
  on the skyline rather than dropped on the block.
- **Chapter 1 is the Phase 1 scene** - behind the Krill King, Slick kicks him out
  of the Frostbite Boys.
- **Cash / Heat / Cred aren't the only numbers.** The endings hang on two hidden
  values, Built and Took, so `state.js` tracks those from day one even though
  nothing displays them.

## Where we are

**Phase 1 - the vertical slice.** One city block, walkable, with one complete
story moment in it.

- [x] Project set up and deploying to GitHub Pages
- [x] Snowy ground and the aurora night sky
- [x] Start screen: Penguini, pistol at the lens, Cold City behind him
- [x] Model loading — drop a `.glb` into `public/models/` and it replaces the
      stand-in automatically ([how](public/models/README.md))
- [ ] Penguini's real 3D model, rigged so he can move

**Phase 2 - the city.**

- [x] Four districts: Igloo Row, the Boardwalk, the Docks, the Meridian
- [x] Roads linking them, so it's one city rather than four islands
- [x] A map screen (M, or the MAP button) drawn from the same district data
      the game uses, so it can never disagree with the real city
- [x] District titles when you cross into somewhere new
- [x] NPC penguins and seal cops walking their own routes
- [ ] Day/night cycle
- [ ] Enterable interiors
- [x] Walking: drag anywhere to move, on phone or computer. WASD too.
- [x] Third-person camera that follows him and swings in behind
- [x] Block 9 — Igloo Row, the Krill King, streetlights — with collision
- [x] Three interaction points, press E (or tap the prompt) to talk
- [x] Dialogue system reading branching scenes from `data/scenes.json`
- [x] HUD: Cash, Heat, Cred - changed by the choices you make
- [x] Chapter 1: Penguini gets kicked out of the Frostbite Boys
- [x] Save/load - your game keeps itself in the browser
- [ ] Penguini's real 3D model, rigged so he can move

Phases 2-4 (the rest of the city, missions, the full story) come after Phase 1
is playable end to end.

## The rules of the look

- Cartoon, not realistic. Flat colours, no textures, chunky exaggerated shapes.
- Deep navy night `#0a1624`, ice white, and two neon accents: hot pink
  `#ff4d8d` for signage and the criminal world, aurora green `#3ff0c2` for the
  sky and anything hopeful.
- The aurora is the signature visual. Visible from everywhere, always moving.
- Lit like a cold night with warm windows. The freezing street below, the lit
  interiors above.

All of those colours are defined in one place, `PALETTE` at the top of
`src/world.js`, plus the sky uniforms at the bottom of `src/sky.js`.
