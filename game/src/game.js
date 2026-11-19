// game.js - Sunset Bay's engine: player, traffic, police, combat,
// missions, wanted heat, busts, saving and the shot scenes used for
// the entry screenshots. Tuning that playtesting settled is kept in
// TUNING below and nowhere else, so the numbers stay easy to audit.

import { Rng, clamp, angleDelta, distance } from './rng.js';
import {
  WORLD_W, WORLD_H, AVENUES_X, STREETS_Y,
  generateWorld, collideBuildings, isRoadPoint,
} from './world.js';
import { MISSIONS, PLACES } from './missions.js';
import { SoundFX } from './audio.js';

export const TUNING = {
  policeMaxSpeed: 385,
  policeAccel: 315,
  policeBrake: 640,
  bustFillSeconds: 4.5,
  escapeSightDistance: 400,
  playerCarAccel: 305,
  playerCarMax: 355,
  playerCarBrake: 580,
  walkSpeed: 178,
  sprintSpeed: 262,
};

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93e', '#59b06a', '#e6e6e6', '#8a5fc0', '#3fbfae', '#d97bb0', '#5a6270'];
const SHIRTS = ['#ffd94d', '#7ec8f7', '#ff9d76', '#b5e48c', '#f7f0e1', '#e56b6f'];
const SAVE_KEY = 'sunset-bay-save-v3';

let carId = 1;

function makeCar(x, y, angle, color, kind) {
  return {
    id: carId++, x, y, angle, speed: 0, color, kind,
    hp: 6, smoke: 0, brake: false, driver: 'none',
    axis: 'x', dir: 1, lane: 21, baseSpeed: 130, turnCooldown: 0,
    vx: 0, vy: 0, sirenOffset: Math.random() * 4,
  };
}

export class Game {
  constructor(canvas, input, params) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = new SoundFX();
    this.seed = Number(params.get('seed') || 7) || 7;
    this.shot = params.get('shot');
    this.world = generateWorld(this.seed);
    this.time = 0;
    this.mode = 'title';
    this.cam = { x: 520, y: 330 };
    this.cash = 250;
    this.missionIndex = 0;
    this.objectiveIndex = 0;
    this.missionDelay = 0;
    this.followProgress = 0;
    this.tooCloseT = 0;
    this.heat = 0;
    this.wanted = 0;
    this.escapeT = 0;
    this.bust = 0;
    this.message = '';
    this.messageT = 0;
    this.lastIntro = '';
    this.muted = false;
    this.shotReadyFrames = 0;
    this.player = {
      x: 940, y: 560, angle: 0, hp: 100, inCar: null,
      walkPhase: 0, moving: false, fireCooldown: 0, hurtCooldown: 0,
    };
    this.cars = [];
    this.police = [];
    this.peds = [];
    this.bullets = [];
    this.targetCar = null;
    this.tailCar = null;
    this.spawnTraffic();
    this.spawnParked();
    this.spawnPeds();
    this.hasSave = this.readSave() !== null;
    if (this.shot) this.setupShot(this.shot);
  }

  // ---------------------------------------------------------- spawning
  spawnTraffic() {
    const rng = new Rng(`traffic-${this.seed}`);
    for (let i = 0; i < 15; i++) {
      const horizontal = rng.chance(0.55);
      const car = makeCar(0, 0, 0, CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)], 'traffic');
      car.driver = 'ai';
      car.baseSpeed = rng.range(105, 165);
      if (horizontal) {
        const y = STREETS_Y[rng.int(0, STREETS_Y.length - 1)];
        car.axis = 'x';
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.x = rng.range(80, WORLD_W - 80);
        car.y = y + car.dir * car.lane;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        const x = AVENUES_X[rng.int(0, AVENUES_X.length - 1)];
        car.axis = 'y';
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.x = x + (car.dir > 0 ? -car.lane : car.lane);
        car.y = rng.range(80, WORLD_H - 160);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.speed = car.baseSpeed;
      this.cars.push(car);
    }
  }

  spawnParked() {
    const rng = new Rng(`parked-${this.seed}`);
    // The coral convertible Mara wants, always waiting in the Palm Lot.
    this.targetCar = makeCar(PLACES.palmLot.x, PLACES.palmLot.y, 0.3, '#ff7a59', 'target');
    this.cars.push(this.targetCar);
    for (const lot of this.world.lots) {
      if (lot.plaza) continue;
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const car = makeCar(
          lot.x + 26 + i * 52, lot.y + lot.h / 2, Math.PI / 2,
          CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)], 'parked',
        );
        if (distance(car, this.targetCar) > 30) this.cars.push(car);
      }
    }
    // A few kerbside cars on the avenues.
    for (let i = 0; i < 6; i++) {
      const x = AVENUES_X[rng.int(0, AVENUES_X.length - 1)];
      const car = makeCar(x + 34, rng.range(120, WORLD_H - 220), Math.PI / 2,
        CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)], 'parked');
      if (!this.world.buildings.some((b) => Math.abs(car.x - (b.x + b.w / 2)) < 60 && Math.abs(car.y - (b.y + b.h / 2)) < 60)) {
        this.cars.push(car);
      }
    }
  }

  spawnPeds() {
    const rng = new Rng(`peds-${this.seed}`);
    for (let i = 0; i < 26; i++) {
      const ix = AVENUES_X[rng.int(0, AVENUES_X.length - 1)];
      const iy = STREETS_Y[rng.int(0, STREETS_Y.length - 1)];
      const ped = {
        x: ix + rng.range(-48, 48), y: iy + rng.range(-48, 48),
        tx: ix, ty: iy, angle: 0, speed: rng.range(38, 62),
        shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)],
        walkPhase: rng.range(0, 6), moving: true, down: 0, fleeT: 0, hp: 2,
      };
      this.peds.push(ped);
    }
  }

  spawnTailCar() {
    if (this.tailCar) return;
    this.tailCar = makeCar(PLACES.courierVan.x, PLACES.courierVan.y, 0, '#9aa1ab', 'tail');
    this.tailCar.driver = 'ai';
    this.tailCar.baseSpeed = 118;
    this.tailCar.axis = 'x';
    this.tailCar.dir = -1;
    this.tailCar.angle = Math.PI;
    this.tailCar.y = PLACES.courierVan.y - this.tailCar.lane;
    this.tailCar.speed = 118;
    this.cars.push(this.tailCar);
  }

  // ---------------------------------------------------------- save
  readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash, missionIndex: this.missionIndex,
      }));
    } catch { /* private mode: play on without saving */ }
    this.hasSave = true;
  }

  // ---------------------------------------------------------- flow
  startGame(useSave) {
    const save = useSave ? this.readSave() : null;
    this.cash = save ? save.cash : 250;
    this.missionIndex = save ? clamp(save.missionIndex, 0, 5) : 0;
    this.player.hp = 100;
    this.player.inCar = null;
    this.player.x = 940; this.player.y = 560; this.player.angle = 0;
    this.heat = 0; this.wanted = 0; this.bust = 0;
    this.police = [];
    this.mode = 'play';
    this.sfx.click();
    if (this.missionIndex < MISSIONS.length) this.beginMission(this.missionIndex);
    else this.showMessage('Free roam — every job is done. The bay is yours.');
  }

  beginMission(index) {
    this.missionIndex = index;
    this.objectiveIndex = 0;
    this.followProgress = 0;
    this.tooCloseT = 0;
    const mission = MISSIONS[index];
    if (!mission) return;
    this.lastIntro = mission.intro;
    if (mission.wantedOnStart) this.setHeat(mission.wantedOnStart);
    if (mission.id === 'quiet-tail') this.spawnTailCar();
    this.showMessage(`New job: ${mission.title} — $${mission.reward.toLocaleString('en-US')}`);
  }

  currentMission() {
    return MISSIONS[this.missionIndex] || null;
  }

  currentObjective() {
    const mission = this.currentMission();
    if (!mission || this.mode !== 'play' || this.missionDelay > 0) return null;
    return mission.objectives[this.objectiveIndex] || null;
  }

  showMessage(text) {
    this.message = text;
    this.messageT = 4.2;
  }

  setHeat(stars) {
    this.heat = Math.max(this.heat, stars);
    this.wanted = clamp(Math.ceil(this.heat - 0.0001), 0, 5);
  }

  addCrime(amount) {
    this.heat = clamp(this.heat + amount, 0, 5);
    this.wanted = clamp(Math.ceil(this.heat - 0.0001), 0, 5);
  }

  completeObjective() {
    const mission = this.currentMission();
    if (!mission) return;
    this.objectiveIndex++;
    this.sfx.pickup();
    if (this.objectiveIndex < mission.objectives.length) {
      this.showMessage('Objective done — keep going.');
      return;
    }
    // Mission complete: pay out, save, roll into the next job.
    this.cash += mission.reward;
    this.sfx.complete();
    this.showMessage(`${mission.title} complete: +$${mission.reward.toLocaleString('en-US')}`);
    const finished = this.missionIndex;
    this.missionIndex = finished + 1;
    this.writeSave();
    if (this.missionIndex >= MISSIONS.length) {
      this.missionDelay = 1.4;
      this.pendingWin = true;
    } else {
      this.missionDelay = 1.8;
    }
  }

  setupShot(name) {
    this.mode = 'play';
    this.cash = 1250;
    this.missionIndex = 0;
    this.beginMission(0);
    this.messageT = 0;
    if (name === 'title') {
      this.mode = 'title';
      this.cam.x = 520; this.cam.y = 330;
    } else if (name === 'drive') {
      const car = this.cars.find((c) => c.kind === 'traffic') || this.cars[0];
      car.x = 1010; car.y = 621; car.axis = 'x'; car.dir = 1; car.angle = 0; car.speed = 205;
      this.player.inCar = car;
      this.player.x = car.x; this.player.y = car.y;
      // Company on the road so the shot feels alive.
      const other = this.cars[3];
      other.x = 830; other.y = 579; other.axis = 'x'; other.dir = -1; other.angle = Math.PI; other.speed = 120;
      const third = this.cars[5];
      third.x = 1230; third.y = 621; third.axis = 'x'; third.dir = 1; third.angle = 0; third.speed = 150;
    } else if (name === 'mission') {
      this.player.x = 872; this.player.y = 548;
      this.setHeat(1);
      const cop = this.makeCop(1130, 668);
      cop.angle = -0.6;
      this.police.push(cop);
    }
  }

  makeCop(x, y) {
    return {
      x, y, angle: 0, speed: 0, hp: 10, brake: false,
      sirenOffset: Math.random() * 4, ramCooldown: 0,
    };
  }

  // ---------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    if (this.messageT > 0) this.messageT -= dt;
    if (this.input.tap('KeyM')) {
      this.muted = !this.muted;
      this.sfx.enabled = !this.muted;
    }
    if (this.input.anyGesture) this.sfx.unlock();

    if (this.mode === 'title') {
      if (this.input.tap('Enter') || this.input.mouse.clicked) this.startGame(false);
      else if (this.input.tap('KeyC') && this.hasSave) this.startGame(true);
      this.input.endFrame();
      return;
    }
    if (this.mode === 'busted' || this.mode === 'wasted' || this.mode === 'win') {
      if (this.input.tap('Enter') || this.input.mouse.clicked) {
        if (this.mode === 'win') { this.mode = 'play'; this.pendingWin = false; }
        else this.respawnAfterArrest();
      }
      this.input.endFrame();
      return;
    }

    if (this.missionDelay > 0) {
      this.missionDelay -= dt;
      if (this.missionDelay <= 0) {
        if (this.pendingWin) { this.mode = 'win'; }
        else this.beginMission(this.missionIndex);
      }
    }

    this.updatePlayer(dt);
    this.updateTraffic(dt);
    this.updatePolice(dt);
    this.updatePeds(dt);
    this.updateBullets(dt);
    this.updateCarContacts(dt);
    this.updateWanted(dt);
    this.updateObjectives(dt);
    this.updateCamera(dt);
    this.input.endFrame();
  }

  respawnAfterArrest() {
    this.mode = 'play';
    this.player.inCar = null;
    this.player.x = 1000; this.player.y = 252;
    this.player.hp = Math.max(70, this.player.hp);
    if (this.player.hp <= 0) this.player.hp = 100;
    this.bust = 0;
  }

  updateCamera(dt) {
    const tx = clamp(this.player.x - 480, 0, WORLD_W - 960);
    const ty = clamp(this.player.y - 270, 0, WORLD_H - 540);
    const k = Math.min(1, dt * 7);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  updatePlayer(dt) {
    const p = this.player;
    p.fireCooldown -= dt;
    p.hurtCooldown -= dt;
    if (p.inCar) {
      const car = p.inCar;
      const throttle = this.input.down('KeyW', 'ArrowUp');
      const reverse = this.input.down('KeyS', 'ArrowDown');
      const steer = (this.input.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      car.brake = false;
      if (throttle) car.speed += TUNING.playerCarAccel * dt;
      if (reverse) {
        if (car.speed > 12) { car.speed -= TUNING.playerCarBrake * dt; car.brake = true; }
        else car.speed -= 190 * dt;
      }
      if (this.input.down('Space')) { // handbrake
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
        car.brake = true;
      }
      car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
      car.speed = clamp(car.speed, -135, TUNING.playerCarMax);
      if (steer !== 0 && Math.abs(car.speed) > 8) {
        car.angle += steer * clamp(Math.abs(car.speed) / 130, 0.25, 1.5) * 1.55 * dt * Math.sign(car.speed);
      }
      const before = { x: car.x, y: car.y };
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      collideBuildings(this.world, car, 17);
      if (Math.hypot(car.x - before.x, car.y - before.y) < Math.abs(car.speed) * dt * 0.35 && Math.abs(car.speed) > 120) {
        this.damagePlayer(6, true);
        car.speed *= -0.22;
        this.sfx.crash();
      }
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.moving = Math.abs(car.speed) > 5;
      if (this.input.tap('KeyE', 'KeyF')) this.exitCar();
    } else {
      const ax = this.input.axisX();
      const ay = this.input.axisY();
      const sprint = this.input.down('ShiftLeft', 'ShiftRight');
      const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
      p.moving = ax !== 0 || ay !== 0;
      if (p.moving) {
        const len = Math.hypot(ax, ay);
        p.x += (ax / len) * speed * dt;
        p.y += (ay / len) * speed * dt;
        p.angle = Math.atan2(ay, ax);
        p.walkPhase += dt * 2;
        collideBuildings(this.world, p, 11);
      }
      // Aim at the mouse; firing is click or Space.
      const aimX = this.cam.x + this.input.mouse.x;
      const aimY = this.cam.y + this.input.mouse.y;
      if (this.input.mouse.down || this.input.down('Space')) p.angle = Math.atan2(aimY - p.y, aimX - p.x);
      if ((this.input.mouse.clicked || this.input.tap('Space')) && p.fireCooldown <= 0) {
        this.fireBullet(aimX, aimY);
      }
      if (this.input.tap('KeyE', 'KeyF')) this.tryEnterCar();
    }
  }

  fireBullet(tx, ty) {
    const p = this.player;
    p.fireCooldown = 0.24;
    const a = Math.atan2(ty - p.y, tx - p.x);
    this.bullets.push({
      x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
      vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.55, from: 'player',
    });
    this.sfx.shoot();
    this.addCrime(0.25);
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car === this.player.inCar) continue;
      const d = distance(this.player, car);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  tryEnterCar() {
    const car = this.nearestCar(44);
    if (!car) return;
    const wasParked = car.kind === 'parked' || car.kind === 'target';
    car.driver = 'player';
    if (car.kind === 'traffic') car.kind = 'stolen';
    this.player.inCar = car;
    car.speed = 0;
    this.sfx.door();
    if (wasParked || car.kind === 'stolen') {
      this.addCrime(car.kind === 'target' ? 0.6 : 0.8);
      if (car === this.targetCar) this.showMessage('That is the one. Rico is waiting across the bay.');
    }
  }

  exitCar() {
    const car = this.player.inCar;
    if (!car) return;
    car.driver = 'none';
    if (car.kind === 'stolen') car.kind = 'parked';
    this.player.inCar = null;
    this.player.x = car.x - Math.sin(car.angle) * 26;
    this.player.y = car.y + Math.cos(car.angle) * 26;
    collideBuildings(this.world, this.player, 11);
    this.sfx.door();
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      if (car.driver === 'player' || car === this.player.inCar) continue;
      if (car.kind === 'parked' || car.kind === 'target') continue;
      if (car.driver !== 'ai') continue;
      car.turnCooldown -= dt;
      // Slow for a car ahead in the same lane.
      let target = car.baseSpeed;
      for (const other of this.cars) {
        if (other === car) continue;
        const ahead = car.axis === 'x'
          ? Math.abs(other.y - car.y) < 16 && (other.x - car.x) * car.dir > 0 && (other.x - car.x) * car.dir < 58
          : Math.abs(other.x - car.x) < 16 && (other.y - car.y) * car.dir > 0 && (other.y - car.y) * car.dir < 58;
        if (ahead) target = Math.min(target, Math.max(0, Math.abs(other.speed) - 8));
      }
      car.brake = car.speed > target + 12;
      car.speed += clamp(target - car.speed, -260 * dt, 150 * dt);
      if (car.axis === 'x') {
        car.x += car.dir * car.speed * dt;
        car.y = (car.axisY ?? car.y);
        // Possible turn at an avenue crossing.
        for (const ax of AVENUES_X) {
          if (Math.abs(car.x - ax) < 5 && car.turnCooldown <= 0 && Math.random() < 0.30) {
            car.axis = 'y';
            car.dir = Math.random() < 0.5 ? 1 : -1;
            car.x = ax + (car.dir > 0 ? -car.lane : car.lane);
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            car.turnCooldown = 3;
            break;
          }
        }
        if (car.x < 50 || car.x > WORLD_W - 50) { car.dir *= -1; car.y += car.dir * 0 + (car.dir > 0 ? 42 : -42) * 0; car.angle = car.dir > 0 ? 0 : Math.PI; car.y = Math.round((car.y - 21) / 1) ; car.x = clamp(car.x, 50, WORLD_W - 50); }
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        car.y += car.dir * car.speed * dt;
        for (const sy of STREETS_Y) {
          if (Math.abs(car.y - sy) < 5 && car.turnCooldown <= 0 && Math.random() < 0.30) {
            car.axis = 'x';
            car.dir = Math.random() < 0.5 ? 1 : -1;
            car.y = sy + car.dir * car.lane;
            car.angle = car.dir > 0 ? 0 : Math.PI;
            car.turnCooldown = 3;
            break;
          }
        }
        if (car.y < 50 || car.y > WORLD_H - 190) { car.dir *= -1; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; car.x += car.dir > 0 ? -42 : 42; car.y = clamp(car.y, 50, WORLD_H - 190); }
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.x = clamp(car.x, 30, WORLD_W - 30);
      car.y = clamp(car.y, 30, WORLD_H - 30);
    }
  }

  updatePolice(dt) {
    // Keep the responding fleet sized to the wanted level.
    const want = this.wanted > 0 ? Math.min(2 + this.wanted, 6) : 0;
    if (this.police.length < want && Math.random() < dt * 2.2) {
      const a = Math.random() * Math.PI * 2;
      const d = 560 + Math.random() * 160;
      const x = clamp(this.player.x + Math.cos(a) * d, 60, WORLD_W - 60);
      const y = clamp(this.player.y + Math.sin(a) * d, 60, WORLD_H - 200);
      if (!isRoadPoint(x, y)) {
        // Nudge spawns onto the nearest intersection.
        const near = { x: AVENUES_X[0], y: STREETS_Y[0] };
        let bd = 1e9;
        for (const ax of AVENUES_X) for (const sy of STREETS_Y) {
          const dd = Math.hypot(ax - x, sy - y);
          if (dd < bd) { bd = dd; near.x = ax; near.y = sy; }
        }
        this.police.push(this.makeCop(near.x, near.y));
      } else this.police.push(this.makeCop(x, y));
    }
    if (this.police.length > want) this.police.length = want;

    for (const cop of this.police) {
      cop.ramCooldown -= dt;
      const dist = distance(cop, this.player);
      const targetAngle = Math.atan2(this.player.y - cop.y, this.player.x - cop.x);
      const turn = clamp(angleDelta(cop.angle, targetAngle), -2.4 * dt, 2.4 * dt);
      cop.angle += turn;
      const onFootStop = !this.player.inCar && dist < 52;
      let target = onFootStop ? 0 : TUNING.policeMaxSpeed;
      if (dist < 90 && this.player.inCar) target = Math.max(Math.abs(this.player.inCar.speed) + 30, 120);
      cop.brake = cop.speed > target + 20;
      if (cop.speed < target) cop.speed = Math.min(target, cop.speed + TUNING.policeAccel * dt);
      else cop.speed = Math.max(target, cop.speed - TUNING.policeBrake * dt);
      const before = { x: cop.x, y: cop.y };
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      collideBuildings(this.world, cop, 17);
      if (Math.hypot(cop.x - before.x, cop.y - before.y) < cop.speed * dt * 0.3 && cop.speed > 140) cop.speed *= 0.4;
      if (Math.floor(this.time * 3 + cop.sirenOffset) !== Math.floor((this.time - dt) * 3 + cop.sirenOffset)) {
        if (dist < 430) this.sfx.sirenStep(Math.floor(this.time * 3) % 2 === 0);
      }
      // Ramming a driven player car hurts and slows both vehicles.
      if (this.player.inCar && dist < 36 && cop.ramCooldown <= 0 && Math.abs(cop.speed) > 90) {
        cop.ramCooldown = 0.9;
        this.damagePlayer(7, true);
        this.player.inCar.speed *= 0.72;
        cop.speed *= 0.6;
        this.sfx.crash();
      }
    }

    // Bust pressure: a nearby officer while the player is slow or on foot.
    const nearest = this.police.reduce((m, c) => Math.min(m, distance(c, this.player)), Infinity);
    const playerSpeed = this.player.inCar ? Math.abs(this.player.inCar.speed) : (this.player.moving ? 150 : 0);
    if (nearest < 60 && playerSpeed < 48 && this.wanted > 0) {
      this.bust += dt / TUNING.bustFillSeconds;
    } else {
      this.bust = Math.max(0, this.bust - dt * 0.45);
    }
    if (this.bust >= 1) this.doBusted();
  }

  doBusted() {
    this.mode = 'busted';
    this.cash = Math.max(0, this.cash - 150);
    this.heat = 0; this.wanted = 0; this.bust = 0;
    this.police = [];
    this.sfx.busted();
  }

  damagePlayer(amount, fromCrash) {
    const p = this.player;
    if (p.hurtCooldown > 0 && fromCrash) return;
    p.hp -= amount;
    p.hurtCooldown = 0.5;
    this.sfx.hurt();
    if (p.hp <= 0) {
      this.mode = 'wasted';
      this.cash = Math.max(0, this.cash - 100);
      this.heat = 0; this.wanted = 0;
      this.police = [];
      p.hp = 0;
    }
  }

  updatePeds(dt) {
    for (const ped of this.peds) {
      if (ped.down > 0) { ped.down -= dt; ped.moving = false; continue; }
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        // Pick the next corner along the pavement grid.
        const ix = AVENUES_X.reduce((a, b) => Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a);
        const iy = STREETS_Y.reduce((a, b) => Math.abs(b - ped.y) < Math.abs(a - ped.y) ? b : a);
        if (Math.random() < 0.5) ped.tx = AVENUES_X[Math.floor(Math.random() * AVENUES_X.length)] + (Math.random() < 0.5 ? -48 : 48);
        else ped.ty = STREETS_Y[Math.floor(Math.random() * STREETS_Y.length)] + (Math.random() < 0.5 ? -48 : 48);
        ped.tx = clamp(ped.tx || ix, 30, WORLD_W - 30);
        ped.ty = clamp(ped.ty || iy, 30, WORLD_H - 180);
      } else {
        const flee = ped.fleeT > 0;
        ped.fleeT -= dt;
        const sp = flee ? 165 : ped.speed;
        ped.x += (dx / d) * sp * dt;
        ped.y += (dy / d) * sp * dt;
        ped.angle = Math.atan2(dy, dx);
        ped.moving = true;
        ped.walkPhase += dt * 2;
        collideBuildings(this.world, ped, 9);
      }
      // Cars are dangerous to stand in front of.
      for (const car of this.cars) {
        const speed = Math.abs(car.speed);
        if (speed > 85 && distance(ped, car) < 19) {
          ped.down = 6;
          ped.hp = 0;
          if (car === this.player.inCar) { this.addCrime(1.2); this.damagePlayer(0, false); this.showMessage('You hit a pedestrian!'); }
        }
      }
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.from === 'player') {
        for (const ped of this.peds) {
          if (ped.down <= 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 11) {
            ped.down = 8; b.life = 0; this.addCrime(1.1); this.showMessage('Witnesses are calling it in!');
          }
        }
        for (const car of this.cars) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 21) {
            car.hp -= 1; car.smoke = clamp(car.hp <= 2 ? 1 : car.smoke + 0.3, 0, 1); b.life = 0; this.addCrime(0.4);
          }
        }
        for (const cop of this.police) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 21) {
            cop.hp -= 1; b.life = 0; this.addCrime(0.8);
            if (cop.hp <= 0) { cop.x = -999; cop.speed = 0; this.showMessage('Police car disabled!'); }
          }
        }
      }
    }
    this.police = this.police.filter((c) => c.x > -100);
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  // Vehicle contact with a simple impulse: overlapping cars push apart
  // and trade the velocity component along their contact normal.
  updateCarContacts(dt) {
    const movers = [...this.cars.filter((c) => c.driver === 'player' || c.driver === 'ai'), ...this.police];
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i];
        const b = movers[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= 40) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = 40 - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const avx = Math.cos(a.angle) * a.speed;
        const avy = Math.sin(a.angle) * a.speed;
        const bvx = Math.cos(b.angle) * b.speed;
        const bvy = Math.sin(b.angle) * b.speed;
        const rel = (bvx - avx) * nx + (bvy - avy) * ny;
        if (rel < 0) {
          const impulse = -rel * 0.72;
          const aAlong = avx * Math.cos(a.angle) + avy * Math.sin(a.angle);
          const bAlong = bvx * Math.cos(b.angle) + bvy * Math.sin(b.angle);
          a.speed = aAlong - impulse * (nx * Math.cos(a.angle) + ny * Math.sin(a.angle));
          b.speed = bAlong + impulse * (nx * Math.cos(b.angle) + ny * Math.sin(b.angle));
          if (rel < -120 && (a === this.player.inCar || b === this.player.inCar)) {
            this.damagePlayer(5, true);
            this.sfx.crash();
          }
        }
      }
    }
    void dt;
  }

  updateWanted(dt) {
    if (this.wanted <= 0) { this.escapeT = 0; return; }
    const nearest = this.police.reduce((m, c) => Math.min(m, distance(c, this.player)), Infinity);
    const seen = nearest <= TUNING.escapeSightDistance;
    if (!seen) {
      this.escapeT += dt;
      if (this.escapeT > 1.6) {
        this.heat = Math.max(0, this.heat - dt * 0.14);
        this.wanted = clamp(Math.ceil(this.heat - 0.0001), 0, 5);
        if (this.wanted === 0) this.showMessage('You lost the police.');
      }
    } else this.escapeT = 0;
  }

  updateObjectives(dt) {
    const obj = this.currentObjective();
    if (!obj) return;
    const p = this.player;
    if (obj.type === 'goto') {
      const inTarget = obj.needsTargetCar ? p.inCar === this.targetCar : true;
      if (inTarget && distance(p, obj.at) < obj.radius) this.completeObjective();
    } else if (obj.type === 'collect') {
      if (distance(p, obj.at) < obj.radius) { this.cash += 25; this.completeObjective(); }
    } else if (obj.type === 'steal') {
      if (p.inCar === this.targetCar) this.completeObjective();
      else if (distance(p, obj.at) < obj.radius && this.targetCar) {
        // Objective completes on entering the car; marker guides on foot.
      }
    } else if (obj.type === 'follow') {
      const car = this.tailCar;
      if (!car) return;
      const d = distance(p, car);
      const onScreen = Math.abs(car.x - p.x) < 470 && Math.abs(car.y - p.y) < 260;
      if (onScreen && d >= obj.minDist && d <= obj.maxDist) {
        this.followProgress += dt;
        this.tooCloseT = Math.max(0, this.tooCloseT - dt);
        if (this.followProgress >= obj.duration) {
          this.tailCar = null;
          car.kind = 'traffic';
          this.completeObjective();
        }
      } else if (d < obj.minDist) {
        this.tooCloseT += dt;
        if (this.tooCloseT > 2.5) {
          this.followProgress = Math.max(0, this.followProgress - 4);
          this.tooCloseT = 0;
          this.showMessage('Too close — they nearly made you!');
        }
      }
    } else if (obj.type === 'escape') {
      if (this.wanted === 0) this.completeObjective();
    }
  }

  // ---------------------------------------------------------- debug
  snapshot() {
    return {
      mode: this.mode, cash: this.cash, wanted: this.wanted,
      missionIndex: this.missionIndex, objectiveIndex: this.objectiveIndex,
      followProgress: Math.round(this.followProgress * 10) / 10,
      player: {
        x: Math.round(this.player.x), y: Math.round(this.player.y),
        hp: Math.round(this.player.hp), inCar: !!this.player.inCar,
        targetCar: this.player.inCar === this.targetCar,
      },
      police: this.police.length, cars: this.cars.length, peds: this.peds.length,
      objective: (() => { const o = this.currentObjective(); return o ? o.type : null; })(),
    };
  }

  teleport(x, y) {
    const p = this.player;
    if (p.inCar) { p.inCar.x = x; p.inCar.y = y; }
    p.x = x; p.y = y;
    this.updateCamera(1);
  }
}
