// main.js - Sunset Bay's boot file: wires the canvas, input and engine
// together, runs the frame loop, and exposes the small debug surface
// the screenshot and playtest harnesses use (__SB and __shotReady).

import { Game } from './game.js';
import { Input } from './input.js';
import { drawWorld, drawObjectiveMarker, drawCarShape, drawPoliceShape, drawPerson, drawHUD, drawMinimap, drawTitle, drawEndCard } from './render.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const input = new Input(canvas);
const game = new Game(canvas, input, params);

function render() {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, game);
  // The objective marker translates into world space itself, so it is
  // called outside the entity pass's camera transform.
  drawObjectiveMarker(ctx, game);

  ctx.save();
  ctx.translate(-game.cam.x, -game.cam.y);
  for (const car of game.cars) {
    if (car === game.player.inCar) continue;
    drawCarShape(ctx, car, game.time);
  }
  for (const cop of game.police) drawPoliceShape(ctx, cop, game.time);
  for (const ped of game.peds) {
    if (ped.down > 0) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else drawPerson(ctx, ped, ped.shirt, false, game.time);
  }
  if (game.player.inCar) drawCarShape(ctx, game.player.inCar, game.time);
  else drawPerson(ctx, game.player, '#ffd94d', true, game.time);
  ctx.fillStyle = '#ffe98a';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (game.mode === 'title') {
    drawTitle(ctx, game);
  } else {
    drawMinimap(ctx, game);
    drawHUD(ctx, game);
    if (game.mode === 'busted') {
      drawEndCard(ctx, game, 'BUSTED', ['The bay police got their photo after all.', 'Fine paid: $150 — your jobs are still waiting.'], '#ff6b5e');
    } else if (game.mode === 'wasted') {
      drawEndCard(ctx, game, 'WASTED', ['You wake up outside Bay Clinic.', 'Treatment bill: $100 — Mara still believes in you.'], '#e5484d');
    } else if (game.mode === 'win') {
      drawEndCard(ctx, game, 'BAY LEGEND', ['All five jobs done — $9,500 earned for Mara Voss.', `Final cash: $${game.cash.toLocaleString('en-US')} — Sunset Bay is yours now.`], '#ffd94d');
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (!game.shot) game.update(dt);
  else {
    // Shot scenes are staged stills: render the posed world, and let
    // the harness know once two frames are on screen.
    game.time += dt;
    game.updateCamera(1);
  }
  render();
  game.shotReadyFrames++;
  if (game.shotReadyFrames >= 2) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__SB = {
  game,
  snapshot: () => game.snapshot(),
  startNew: () => game.startGame(false),
  teleport: (x, y) => game.teleport(x, y),
  // Walk the player to the mission-two target car's doorstep.
  enterTargetCar: () => {
    if (game.targetCar) game.teleport(game.targetCar.x - 30, game.targetCar.y);
  },
};
