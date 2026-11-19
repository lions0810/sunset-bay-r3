# Sunset Bay

![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/lions0810/sunset-bay-r3/rank.svg)
![reward](https://make.fun/badge/gta6-01/lions0810/sunset-bay-r3/reward.svg)

**Sunset Bay** is an original top-down 2D open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). Explore a sun-soaked
bay city on foot and behind the wheel, steal cars, outrun the bay police,
and work five jobs for harbour fixer Mara Voss — $9,500 if you finish them all.

## Play it

No build step and no network: serve the `game/` folder with any static
file server (or run `node serve.ts` and open http://localhost:8080),
then open `game/index.html` in desktop Chrome.

- **WASD / arrows** — walk and drive
- **E / F** — steal, enter and exit cars
- **Mouse** — aim; **click or Space** — fight (Space is the handbrake in a car)
- **Shift** — sprint · **M** — mute · **Enter** — start / continue

## The game

- A deterministic 2400×1600 city (`?seed=N` rebuilds the same streets):
  six avenues, four streets, shops, car parks, palm plazas and the bay.
- Live traffic that follows lanes and turns at intersections, pedestrians
  on the pavements, parked cars to steal, and a five-star wanted system:
  police pursue at real speed, box you in, and bust you if they hold you
  slow and close for 4.5 seconds. Break their 400 px line of sight to cool off.
- Five-mission story chain — First Run ($400), Borrowed Wheels ($900),
  Quiet Tail ($1,800), Heat Check ($2,400), Bay Payday ($4,000) — with a
  follow-the-sedan tail job, a lose-the-heat escape job, combat, a HUD
  with minimap, synthesized sound effects, and automatic saving after
  every completed job.

## Handing it in

`node main.ts` (with `MAKEFUN_OUTPUT_DIR` set locally) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored `buildDossier` from `vendor/makefun-game.ts`, byte for byte the
way the scorer rebuilds it.

Screenshots in `screenshots/` are real renders of the game, staged with
`?shot=title|drive|mission&seed=7` (see `shots.json`).

## Verified

A headless-Chrome playtest drove the full story chain end to end:
First Run +$400, Borrowed Wheels +$900, Quiet Tail +$1,800,
Heat Check +$2,400, Bay Payday +$4,000 (plus $25 per cash bag),
finishing on the win card with $9,825 from a $250 start.
`node main.ts` with `MAKEFUN_OUTPUT_DIR` set produces `dossier.json`
with no errors, byte-identical across repeated runs.
