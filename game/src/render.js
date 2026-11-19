// render.js - everything Sunset Bay draws: the city, its traffic, the
// chase, the HUD with its minimap, and the menu and end screens.
// Pure canvas 2D, no images: buildings, cars and people are all shapes
// painted from the deterministic world data.

import { WORLD_W, WORLD_H, AVENUES_X, STREETS_Y, ROAD_W } from './world.js';
import { clamp } from './rng.js';

export const VIEW_W = 960;
export const VIEW_H = 540;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawWorld(ctx, game) {
  const { world, cam } = game;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Base ground: warm grass-sand between the streets.
  ctx.fillStyle = '#79a86b';
  ctx.fillRect(cam.x - 20, cam.y - 20, VIEW_W + 40, VIEW_H + 40);

  // The bay itself along the south edge, with a sandy promenade.
  const waterGrad = ctx.createLinearGradient(0, 1500, 0, WORLD_H);
  waterGrad.addColorStop(0, '#3f9db8');
  waterGrad.addColorStop(1, '#1f6f96');
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(0, 1492, WORLD_W, 34);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, 1526, WORLD_W, WORLD_H - 1526);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = 1544 + i * 5 + Math.sin(game.time * 1.3 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo((i * 211 + game.time * 12) % WORLD_W, y);
    ctx.lineTo((i * 211 + game.time * 12) % WORLD_W + 60, y);
    ctx.stroke();
  }

  // Car parks and plazas.
  for (const lot of world.lots) {
    ctx.fillStyle = lot.plaza ? '#a8bf8f' : '#5d6066';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    if (!lot.plaza) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 14; x < lot.x + lot.w - 10; x += 30) {
        ctx.strokeRect(x, lot.y + 10, 22, lot.h - 20);
      }
    }
  }

  // Streets: asphalt bands with a kerb edge and dashed centre lines.
  ctx.fillStyle = '#43464d';
  for (const x of AVENUES_X) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of STREETS_Y) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = '#d8d8d2';
  for (const x of AVENUES_X) { ctx.fillRect(x - ROAD_W / 2 - 3, 0, 3, WORLD_H); ctx.fillRect(x + ROAD_W / 2, 0, 3, WORLD_H); }
  for (const y of STREETS_Y) { ctx.fillRect(0, y - ROAD_W / 2 - 3, WORLD_W, 3); ctx.fillRect(0, y + ROAD_W / 2, WORLD_W, 3); }
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  for (const x of AVENUES_X) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke(); }
  for (const y of STREETS_Y) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke(); }
  ctx.setLineDash([]);

  // Buildings: sunset-toned blocks with a soft shadow and lit windows.
  for (const b of world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = `hsl(${b.tone} 42% 62%)`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = `hsl(${b.tone} 48% 52%)`;
    ctx.fillRect(b.x, b.y, b.w, 10);
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = ((i * 7 + j * 13 + Math.floor(b.lit * 97)) % 5) !== 0;
        ctx.fillStyle = lit ? 'rgba(255,236,170,0.85)' : 'rgba(40,50,66,0.55)';
        ctx.fillRect(b.x + 10 + i * 24, b.y + 16 + j * 22, 13, 12);
      }
    }
    ctx.fillStyle = 'rgba(30,26,20,0.75)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(b.name, b.x + 8, b.y + b.h - 7);
  }

  // Palms: a curved trunk and a fan of fronds.
  for (const p of world.palms) {
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + 5 * p.s, p.y - 12 * p.s, p.x + 9 * p.s, p.y - 20 * p.s);
    ctx.stroke();
    ctx.strokeStyle = '#3e8e4f';
    ctx.lineWidth = 3 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + 9 * p.s, p.y - 20 * p.s);
      ctx.lineTo(p.x + 9 * p.s + Math.cos(a) * 15 * p.s, p.y - 20 * p.s + Math.sin(a) * 8 * p.s - 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawObjectiveMarker(ctx, game) {
  const obj = game.currentObjective();
  if (!obj || !obj.at || game.mode !== 'play') return;
  const { cam } = game;
  const pulse = 1 + Math.sin(game.time * 5) * 0.12;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(obj.at.x, obj.at.y, (obj.radius || 44) * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,77,0.16)';
  ctx.beginPath();
  ctx.arc(obj.at.x, obj.at.y, (obj.radius || 44) * pulse, 0, Math.PI * 2);
  ctx.fill();
  // A light beacon so the goal reads from across the map.
  const grad = ctx.createLinearGradient(0, obj.at.y - 190, 0, obj.at.y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.at.x - 9, obj.at.y - 190, 18, 190);
  ctx.restore();
}

export function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, -19, -8, 40, 20, 6); ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -20, -10, 40, 20, 6); ctx.fill();
  ctx.fillStyle = 'rgba(20,26,36,0.9)';
  rr(ctx, -6, -8, 13, 16, 3); ctx.fill(); // cabin glass
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, 8, -8, 5, 16, 2); ctx.fill();
  ctx.fillStyle = '#191919';
  for (const [wx, wy] of [[-13, -11], [13, -11], [-13, 9], [13, 9]]) ctx.fillRect(wx - 4, wy, 9, 3.4);
  // Headlights at the nose, brake lights glowing at the tail when slowing.
  ctx.fillStyle = '#fff6bf';
  ctx.beginPath(); ctx.arc(20, -6, 2.4, 0, Math.PI * 2); ctx.arc(20, 6, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = car.brake ? '#ff2d2d' : '#7d1f1f';
  ctx.beginPath(); ctx.arc(-20, -6, car.brake ? 3.4 : 2.2, 0, Math.PI * 2); ctx.arc(-20, 6, car.brake ? 3.4 : 2.2, 0, Math.PI * 2); ctx.fill();
  if (car.smoke > 0.3) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(12, 0, 6 + Math.sin(time * 9 + car.x) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPoliceShape(ctx, cop, time) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, -20, -9, 42, 21, 6); ctx.fill();
  ctx.fillStyle = '#eef1f4';
  rr(ctx, -21, -10, 42, 20, 6); ctx.fill();
  ctx.fillStyle = '#2456a6';
  ctx.fillRect(-21, -3, 42, 6);
  ctx.fillStyle = 'rgba(20,26,36,0.9)';
  rr(ctx, -6, -8, 13, 16, 3); ctx.fill();
  ctx.fillStyle = '#191919';
  for (const [wx, wy] of [[-14, -11], [14, -11], [-14, 9], [14, 9]]) ctx.fillRect(wx - 4, wy, 9, 3.4);
  // Alternating light bar.
  const phase = Math.floor(time * 6 + cop.sirenOffset) % 2 === 0;
  ctx.fillStyle = phase ? '#ff3b30' : '#5b2d2d';
  ctx.fillRect(-4, -8, 7, 6);
  ctx.fillStyle = phase ? '#2d4a7d' : '#2f7bff';
  ctx.fillRect(3, -8, 7, 6);
  ctx.fillStyle = cop.brake ? '#ff2d2d' : '#7d1f1f';
  ctx.beginPath(); ctx.arc(-21, -6, cop.brake ? 3.4 : 2.2, 0, Math.PI * 2); ctx.arc(-21, 6, cop.brake ? 3.4 : 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPerson(ctx, person, shirt, isPlayer, time) {
  ctx.save();
  ctx.translate(person.x, person.y);
  const bob = person.moving ? Math.sin(time * 11 + person.walkPhase) * 1.6 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0, 3, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(0, -3 + bob * 0.3, 4.4, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, Math.PI * 2); ctx.stroke();
    // Facing tick toward the aim / walk direction.
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(person.angle) * 13, Math.sin(person.angle) * 13);
    ctx.stroke();
  }
  ctx.restore();
}

function starRow(ctx, x, y, wanted) {
  ctx.font = '22px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd94d' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 24, y);
  }
}

export function drawMinimap(ctx, game) {
  const w = 176;
  const h = 118;
  const x = VIEW_W - w - 12;
  const y = 12;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(12,20,28,0.78)';
  rr(ctx, x - 3, y - 3, w + 6, h + 6, 8); ctx.fill();
  ctx.fillStyle = '#5d7a52';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2f7ea6';
  ctx.fillRect(x, y + 1526 * sy, w, h - 1526 * sy);
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = 3;
  for (const ax of AVENUES_X) { ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); ctx.stroke(); }
  for (const syLine of STREETS_Y) { ctx.beginPath(); ctx.moveTo(x, y + syLine * sy); ctx.lineTo(x + w, y + syLine * sy); ctx.stroke(); }
  const dot = (px, py, colour, r = 3) => {
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(x + px * sx, y + py * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const car of game.cars) dot(car.x, car.y, '#cfd4da', 1.6);
  for (const cop of game.police) dot(cop.x, cop.y, '#ff5040', 2.6);
  const obj = game.currentObjective();
  if (obj && obj.at) {
    const blink = Math.floor(game.time * 3) % 2 === 0;
    dot(obj.at.x, obj.at.y, blink ? '#ffd94d' : '#fff3b0', 4);
  }
  if (game.tailCar) dot(game.tailCar.x, game.tailCar.y, '#ffb340', 3.4);
  dot(game.player.x, game.player.y, '#ffffff', 3.6);
  ctx.restore();
  return { x, y, w, h };
}

export function drawHUD(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(12,20,28,0.66)';
  rr(ctx, 12, 12, 218, 74, 9); ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 24, 42);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(24, 54, 150, 10);
  ctx.fillStyle = game.player.hp > 30 ? '#57d977' : '#e5484d';
  ctx.fillRect(24, 54, 150 * clamp(game.player.hp, 0, 100) / 100, 10);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(game.player.hp)}`, 180, 63);
  if (game.player.inCar) {
    ctx.fillText(`${Math.round(Math.abs(game.player.inCar.speed) * 1.6)} km/h`, 24, 80);
  }

  starRow(ctx, VIEW_W - 150, 158, game.wanted);

  // Mission panel.
  if (game.mode === 'play') {
    const mission = game.currentMission();
    ctx.fillStyle = 'rgba(12,20,28,0.66)';
    rr(ctx, 12, VIEW_H - 92, 430, 80, 9); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(mission ? `Job ${game.missionIndex + 1}/5 — ${mission.title}` : 'Sunset Bay — free roam', 24, VIEW_H - 66);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    const obj = game.currentObjective();
    ctx.fillText(obj ? obj.text : 'All jobs done. The bay is yours.', 24, VIEW_H - 44);
    if (obj && obj.at) {
      const d = Math.round(Math.hypot(game.player.x - obj.at.x, game.player.y - obj.at.y));
      ctx.fillStyle = '#bcd7ff';
      ctx.fillText(`${d} m to marker`, 24, VIEW_H - 24);
    } else if (obj && obj.type === 'follow') {
      ctx.fillStyle = '#bcd7ff';
      ctx.fillText(`Tail progress ${Math.floor(game.followProgress)} / ${obj.duration}s — keep the sedan in sight`, 24, VIEW_H - 24);
    } else if (obj && obj.type === 'escape') {
      ctx.fillStyle = '#bcd7ff';
      ctx.fillText(game.wanted > 0 ? 'Break line of sight and stay hidden' : 'Heat is gone — head to the hideout', 24, VIEW_H - 24);
    }
  }

  // Bust meter.
  if (game.bust > 0.02 && game.mode === 'play') {
    ctx.fillStyle = 'rgba(12,20,28,0.7)';
    rr(ctx, VIEW_W / 2 - 110, VIEW_H - 130, 220, 30, 8); ctx.fill();
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(VIEW_W / 2 - 100, VIEW_H - 118, 200 * clamp(game.bust, 0, 1), 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('BUSTED?', VIEW_W / 2 - 28, VIEW_H - 124 + 22);
  }

  if (game.messageT > 0) {
    ctx.globalAlpha = clamp(game.messageT, 0, 1);
    ctx.fillStyle = 'rgba(12,20,28,0.8)';
    const width = Math.min(760, 30 + game.message.length * 8.2);
    rr(ctx, VIEW_W / 2 - width / 2, 96, width, 38, 9); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, VIEW_W / 2, 120);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawTitle(ctx, game) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(38,16,54,0.88)');
  grad.addColorStop(0.55, 'rgba(146,52,84,0.78)');
  grad.addColorStop(1, 'rgba(255,122,61,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(VIEW_W / 2, 208, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(146,52,84,0.9)';
  ctx.fillRect(0, 208, VIEW_W, 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUNSET BAY', VIEW_W / 2, 128);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('An open-world crime story in a city that never cools down', VIEW_W / 2, 162);
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(game.hasSave ? 'Press ENTER for a new game  •  C to continue' : 'Press ENTER or click to start', VIEW_W / 2, 330);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('WASD / arrows — move & drive    E — steal / enter / exit car    Mouse + click or SPACE — fight', VIEW_W / 2, 368);
  ctx.fillText('Shift — sprint / boost    M — mute    Five jobs for Mara Voss: $9,500 if you finish them all', VIEW_W / 2, 394);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Your progress saves automatically after every job.', VIEW_W / 2, 470);
  ctx.textAlign = 'left';
}

export function drawEndCard(ctx, game, title, lines, colour) {
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = colour;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 210);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 262 + i * 30));
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('Press ENTER to keep playing', VIEW_W / 2, 262 + lines.length * 30 + 26);
  ctx.textAlign = 'left';
}
