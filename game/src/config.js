// Every tuning number and colour in one place. Solmar Bay is a fixed 3600x2700 world of
// roads on a 360 px grid; the renderer scales the 1280x720 view to the window, so no rule
// below depends on the screen size.

export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2700 };
export const ROAD = { spacing: 360, width: 76, half: 38, lane: 19 };
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.35,
  shootCooldown: 0.22,
  startAmmo: 24,
  startCash: 50,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 430,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 540,
  policeMaxSpeed: 500,
  turnRate: 2.6,
  drag: 0.55,
  hp: 100,
};

export const WANTED = {
  max: 5,
  decayDelay: 10,
  decayInterval: 6,
  crimeCooldown: 1.2,
};

export const POLICE = { ramDamage: 12, ramCooldown: 0.8, bustTime: 1.6, bustRange: 30 };

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: 'Mara needs a driver. Steal any car, then bring it to the garage on Coral Row.',
    reward: 300,
  },
  {
    id: 'hot-delivery',
    title: 'Hot Delivery',
    brief: 'A package for the pier. Pick it up at the garage and reach the Marina in 80 seconds.',
    reward: 500,
  },
  {
    id: 'shake-the-tail',
    title: 'Shake the Tail',
    brief: 'The heat is on. Hit all three checkpoints, then lose the cops completely.',
    reward: 400,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    brief: 'Collect Mara in Old Town and get her to the Hills safehouse. The Vultures will try to stop you.',
    reward: 800,
  },
  {
    id: 'bay-heist',
    title: 'Bay Heist',
    brief: 'Hit the Solmar Bay Bank, grab the cash, and vanish to the hideout. Every cop in the city is coming.',
    reward: 1500,
  },
];

export const PALETTE = {
  sand: '#f0d49a',
  water: '#37a3c2',
  waterDeep: '#2b7fa3',
  grass: '#8fbf6a',
  grassDark: '#7cad58',
  asphalt: '#45413d',
  asphaltEdge: '#33302d',
  lane: '#f5d76e',
  sidewalk: '#b8a88e',
  building: '#e8a87c',
  buildingRoof: '#d98c6a',
  park: '#6fae52',
  tree: '#3f7d3a',
  player: '#2ecc71',
  playerShirt: '#1f9e57',
  copCar: '#2b6cb0',
  copLight: '#e53e3e',
  ped: '#f2e394',
  enemy: '#8b2f39',
  marker: '#ffd23f',
  text: '#1d2733',
  panel: 'rgba(20, 28, 40, 0.82)',
  panelLight: 'rgba(255, 250, 235, 0.92)',
  gold: '#ffd23f',
  red: '#e53e3e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, missions, best stats) is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';

/** Car paint jobs, by model name. */
export const CAR_MODELS = [
  { name: 'Sunbeam', color: '#e8b64c' },
  { name: 'Coral', color: '#e2725b' },
  { name: 'Lagoon', color: '#4aa3c7' },
  { name: 'Palm', color: '#7fb069' },
  { name: 'Dusk', color: '#6b5b95' },
  { name: 'Bone', color: '#e8e0d0' },
  { name: 'Cherry', color: '#c0392b' },
  { name: 'Teal', color: '#1abc9c' },
];
