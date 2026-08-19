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
├── public/           images and sounds go here once we have any
└── vite.config.js    build settings - you rarely need to touch this
```

Every file is commented in plain English. If a comment doesn't make sense, that's
a bug in the comment - say so.

## Where we are

**Phase 1 - the vertical slice.** One city block, walkable, with one complete
story moment in it.

- [x] Project set up and deploying to GitHub Pages
- [x] Snowy ground and the aurora night sky
- [ ] Penguini himself, built from primitives, with a waddle
- [ ] Third-person camera, WASD + mouse on desktop, on-screen stick on mobile
- [ ] One street block: 8-12 buildings, streetlights, collision
- [ ] Three interaction points, press E to talk
- [ ] Dialogue system reading branching scenes from `data/scenes.json`
- [ ] HUD: Cash, Heat, Cred - changed by the choices you make
- [ ] The scene: Penguini gets kicked out of the Frostbite Boys

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
