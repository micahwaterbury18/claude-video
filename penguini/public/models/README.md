# Drop Penguini's model here

Put a file called **`penguini.glb`** in this folder and the game uses it
instead of the stand-in built out of spheres and cylinders. No code change,
no setting to flip — the game checks for the file when it starts.

If the file isn't here, you get the stand-in and a note in the browser
console. Nothing breaks either way.

## What the file needs to be

| | |
|---|---|
| **Format** | `.glb` — one single file with the textures baked inside. Not `.gltf` (that one splits into several files), not `.fbx`, `.obj` or `.blend`. |
| **Name** | exactly `penguini.glb`, all lower case |
| **Size** | under about 15 MB, or phones will struggle |
| **Detail** | ideally under 150,000 triangles. Generated models often come out at 500,000+ and need reducing. |
| **Facing** | pointing down −Z, standing upright, feet at the origin |

Scale doesn't matter. The game measures whatever arrives and resizes it to
1.55 m, so a model that's 1 unit tall and one that's 100 units tall both
come out right.

## The rigging question

**Rigged** means the model has a skeleton inside it, so his arms and legs can
be moved. **Not rigged** means it's a single frozen shape, like a statue.

A statue is fine for the title screen. It cannot walk, and Phase 1 needs him
to walk. So if the tool you use offers rigging or an animation option, take
it — otherwise we'll be back here later.

When the game starts, open the browser console and it tells you which one you
got:

```
[penguini] loaded model: 48,120 triangles, 0 animation(s), rigged, original height 2.06 units
```

## Getting a model made

Image-to-3D tools take a character sheet like yours and produce a `.glb` in a
few minutes — Meshy, Tripo and Rodin all do this, and most have a free tier.
Check their current terms yourself. Feed them the front view from the
character sheet and ask for a T-pose or A-pose if the option exists, since
that rigs far more reliably than an action pose.

The alternative is modelling him properly in Blender, which is free but is a
real skill and a real time investment.
