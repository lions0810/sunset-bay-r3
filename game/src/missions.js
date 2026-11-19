// missions.js - the five-job story chain of Sunset Bay.
// Mara Voss, a harbour fixer, feeds the player one job at a time. Each
// mission is a list of objectives the game engine interprets; finishing
// every objective pays the mission reward and unlocks the next job.
// Rewards run $400 -> $900 -> $1,800 -> $2,400 -> $4,000 ($9,500 total).

export const MISSION_REWARDS = [400, 900, 1800, 2400, 4000];
export const TOTAL_REWARD = MISSION_REWARDS.reduce((a, b) => a + b, 0);

export const PLACES = {
  maraCorner: { x: 1000, y: 600, label: 'Mara’s corner' },
  courierVan: { x: 1800, y: 1000, label: 'harbour depot' },
  palmLot: { x: 640, y: 330, label: 'Palm Lot' },
  chopGarage: { x: 2200, y: 1400, label: 'Rico’s garage' },
  oldPier: { x: 200, y: 1400, label: 'old pier hideout' },
  northGate: { x: 2200, y: 200, label: 'north gate' },
  bagA: { x: 600, y: 600, label: 'Cafe Sol corner' },
  bagB: { x: 1400, y: 1000, label: 'Gallery Ora corner' },
  bagC: { x: 1800, y: 200, label: 'Hotel Mar corner' },
};

export const MISSIONS = [
  {
    id: 'first-run',
    title: 'First Run',
    giver: 'Mara Voss',
    intro: 'Mara: “Simple start. Pick up my parcel across town, then drop it at the harbour depot. No scratches on the day, please.”',
    reward: MISSION_REWARDS[0],
    objectives: [
      { type: 'goto', at: PLACES.maraCorner, text: 'Pick up Mara’s parcel', radius: 46 },
      { type: 'goto', at: PLACES.courierVan, text: 'Deliver the parcel to the harbour depot', radius: 52 },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Mara Voss',
    intro: 'Mara: “A coral convertible in the Palm Lot was never really theirs. Take it to Rico’s garage — he pays, I smile.”',
    reward: MISSION_REWARDS[1],
    objectives: [
      { type: 'steal', at: PLACES.palmLot, text: 'Steal the coral convertible in the Palm Lot', radius: 60 },
      { type: 'goto', at: PLACES.chopGarage, text: 'Deliver the car to Rico’s garage', radius: 58, needsTargetCar: true },
    ],
  },
  {
    id: 'quiet-tail',
    title: 'Quiet Tail',
    giver: 'Mara Voss',
    intro: 'Mara: “Follow the grey sedan leaving the depot. Stay close enough to watch, far enough to be furniture.”',
    reward: MISSION_REWARDS[2],
    objectives: [
      { type: 'follow', at: PLACES.courierVan, text: 'Tail the grey sedan — keep it in sight', duration: 18, minDist: 105, maxDist: 430 },
    ],
  },
  {
    id: 'heat-check',
    title: 'Heat Check',
    giver: 'Mara Voss',
    intro: 'Mara: “The bay police think you are famous now. Prove them wrong: lose the heat, then lie low at the old pier.”',
    reward: MISSION_REWARDS[3],
    wantedOnStart: 3,
    objectives: [
      { type: 'escape', text: 'Lose the police (break their line of sight)' },
      { type: 'goto', at: PLACES.oldPier, text: 'Lie low at the old pier hideout', radius: 54 },
    ],
  },
  {
    id: 'bay-payday',
    title: 'Bay Payday',
    giver: 'Mara Voss',
    intro: 'Mara: “Last one. Three cash bags, three corners, then the north gate. The bay is yours after this, partner.”',
    reward: MISSION_REWARDS[4],
    wantedOnStart: 2,
    objectives: [
      { type: 'collect', at: PLACES.bagA, text: 'Grab the bag at Cafe Sol corner', radius: 44 },
      { type: 'collect', at: PLACES.bagB, text: 'Grab the bag at Gallery Ora corner', radius: 44 },
      { type: 'collect', at: PLACES.bagC, text: 'Grab the bag at Hotel Mar corner', radius: 44 },
      { type: 'goto', at: PLACES.northGate, text: 'Escape through the north gate', radius: 56 },
    ],
  },
];

export function missionByIndex(index) {
  return MISSIONS[index] || null;
}

export function objectiveLabel(mission, objectiveIndex) {
  const obj = mission.objectives[objectiveIndex];
  if (!obj) return 'Free roam — the bay is yours';
  return obj.text;
}
