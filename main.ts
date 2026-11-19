// Sunset Bay's hand-in program (Node 22, standard library only).
// The game itself is the static site in game/ - plain files a desktop
// browser opens offline - and this program delivers it: it copies
// game/ and screenshots/ into the output directory and writes the
// dossier the judge reads, using the kit's vendored buildDossier so
// the bytes match what the scorer rebuilds on its side.
//
// Run it locally the same way the grader does, with an output override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the gate's own limits, so this program refuses
// exactly what the scorer would refuse instead of handing in a dossier
// that could never match: screenshot count and size, game file count
// and total bytes, and the longest path allowed under game/.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Sunset Bay dossier written to ${outputDir} (${dossier.length} bytes)`);
