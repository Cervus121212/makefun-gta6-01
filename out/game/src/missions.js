// The mission chain: five jobs for Mara and the Coral Kings, from a first stolen car to
// the Bay Heist. Each mission is a list of stages; a stage is done when the player reaches
// a marker, steals a car, survives a timer, or loses the cops. Rewards are paid in cash and
// the next job opens at the garage. Failing a timer or dying fails the mission, not the run.
import { MISSIONS } from './config.js';
import { nearestRoadPoint } from './city.js';
import { addWanted } from './police.js';

export function createMissionState() {
  return {
    index: 0, // which mission is current; 5 means the whole chain is done
    started: false,
    stage: 0,
    timer: 0,
    target: null,
    objective: '',
    contact: null,
    passenger: false,
    checkpoints: [],
    checkpointIndex: 0,
    channel: 0,
    rivals: [],
    done: [],
    failed: false,
  };
}

/** Where the next mission starts: always Mara's garage until the chain is done. */
export function missionStartPoint(state) {
  return state.city.landmarks.garage;
}

/** The current objective marker (world position + label), or null when none. */
export function missionTarget(state) {
  const m = state.mission;
  if (!m.started || m.failed) return null;
  return m.target;
}

/** Begin the current mission: set its first stage and its story beat. */
export function startMission(state) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  m.started = true;
  m.failed = false;
  m.stage = 0;
  m.checkpointIndex = 0;
  m.passenger = false;
  m.channel = 0;
  m.rivals = [];
  state.audio.mission();
  state.message(`${def.title} — ${def.brief}`, 6);
  switch (m.index) {
    case 0:
      m.objective = 'Steal a car (press E near one)';
      m.target = null;
      break;
    case 1:
      m.objective = 'Pick up the package at the garage';
      m.target = { x: state.city.landmarks.garage.x, y: state.city.landmarks.garage.y, label: 'Package' };
      break;
    case 2:
      addWanted(state, 2, 'WANTED — the cops saw the handoff!');
      m.checkpoints = [
        { x: 1380, y: 660, label: 'Checkpoint 1' },
        { x: 2460, y: 1740, label: 'Checkpoint 2' },
        { x: 660, y: 2100, label: 'Checkpoint 3' },
      ];
      m.target = m.checkpoints[0];
      m.objective = 'Hit the checkpoints, then lose the cops';
      break;
    case 3: {
      const square = state.city.landmarks.oldTown;
      m.contact = { x: square.x + 40, y: square.y + 30, angle: 0, color: '#ff8fb3', panic: 0, speed: 0, walkPhase: 0 };
      m.objective = 'Pick up Mara in Old Town Square';
      m.target = { x: square.x, y: square.y, label: 'Mara' };
      break;
    }
    case 4:
      m.objective = 'Drive to the Solmar Bay Bank';
      m.target = { x: state.city.landmarks.bank.x, y: state.city.landmarks.bank.y, label: 'Bank' };
      break;
    default:
      break;
  }
}

/** Pay the reward, mark the mission done, and open the next one. */
function completeMission(state) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  state.player.cash += def.reward;
  state.stats.missionsDone += 1;
  if (!m.done.includes(def.id)) m.done.push(def.id);
  state.audio.cash();
  state.message(`Mission complete: ${def.title} — +$${def.reward}`, 5);
  m.index += 1;
  m.started = false;
  m.stage = 0;
  m.target = null;
  m.objective = '';
  m.contact = null;
  m.passenger = false;
  m.rivals = [];
  if (m.index >= MISSIONS.length) {
    state.message('You own Solmar Bay. Free roam — the city is yours.', 8);
    state.storyDone = true;
  } else {
    state.message(`New job at the garage: ${MISSIONS[m.index].title}. Press ENTER there to start.`, 6);
  }
  state.save();
}

/** Fail the mission (timer ran out); the player can retry it at the garage. */
function failMission(state, reason) {
  const m = state.mission;
  m.failed = true;
  m.started = false;
  m.target = null;
  m.objective = '';
  m.contact = null;
  m.passenger = false;
  m.rivals = [];
  state.audio.fail();
  state.message(`Mission failed: ${reason} — head back to the garage to retry.`, 5);
}

function near(state, target, rangePx) {
  if (!target) return false;
  return Math.hypot(state.player.x - target.x, state.player.y - target.y) < rangePx;
}

/** Drive the rival chase cars at the player's car during The Pickup. */
function updateRivals(state, dt) {
  for (const rival of state.mission.rivals) {
    if (rival.removed) continue;
    const px = state.player.x;
    const py = state.player.y;
    const want = Math.atan2(py - rival.y, px - rival.x);
    let diff = want - rival.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rival.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    rival.x += Math.cos(rival.angle) * rival.speed * dt;
    rival.y += Math.sin(rival.angle) * rival.speed * dt;
    rival.speed += (520 - rival.speed) * 0.3 * dt;
    const d = Math.hypot(px - rival.x, py - rival.y);
    if (d < 46) {
      if (state.player.inCar) {
        state.player.inCar.hp -= 6;
        state.player.inCar.speed *= 0.6;
        state.audio.crash();
      }
      rival.speed *= 0.4;
    }
    if (d > 1600) rival.removed = true;
  }
  state.mission.rivals = state.mission.rivals.filter((r) => !r.removed);
}

/** Advance the current mission one step; returns 'complete' | 'failed' | null. */
export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m.started || m.failed) return null;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time');
      return 'failed';
    }
  }
  updateRivals(state, dt);
  switch (m.index) {
    case 0: {
      if (m.stage === 0) {
        if (state.player.inCar) {
          m.stage = 1;
          m.target = { x: state.city.landmarks.garage.x, y: state.city.landmarks.garage.y, label: 'Garage' };
          m.objective = 'Bring the car to Mara\u2019s garage';
          state.message('Nice wheels. Now bring it to the garage.', 3);
        }
      } else if (near(state, m.target, 80)) {
        completeMission(state);
        return 'complete';
      }
      break;
    }
    case 1: {
      if (m.stage === 0) {
        if (near(state, m.target, 70)) {
          m.stage = 1;
          m.timer = 80;
          m.target = { x: state.city.landmarks.pier.x, y: state.city.landmarks.pier.y, label: 'Marina Pier' };
          m.objective = 'Deliver the package to the Marina Pier — fast!';
          state.message('Package grabbed. 80 seconds — go!', 3);
        }
      } else if (near(state, m.target, 80)) {
        completeMission(state);
        return 'complete';
      }
      break;
    }
    case 2: {
      if (m.stage === 0) {
        const cp = m.checkpoints[m.checkpointIndex];
        if (near(state, cp, 90)) {
          m.checkpointIndex += 1;
          state.audio.pickup();
          if (m.checkpointIndex >= m.checkpoints.length) {
            m.stage = 1;
            m.target = null;
            m.objective = 'Now lose the cops — stay quiet and hidden';
            state.message('All checkpoints hit. Now vanish.', 3);
          } else {
            m.target = m.checkpoints[m.checkpointIndex];
            state.message(`Checkpoint ${m.checkpointIndex} of 3 — keep moving!`, 2.5);
          }
        }
      } else if (state.wanted === 0) {
        completeMission(state);
        return 'complete';
      }
      break;
    }
    case 3: {
      if (m.stage === 0) {
        if (near(state, m.target, 60)) {
          m.stage = 1;
          m.passenger = true;
          m.target = { x: state.city.landmarks.safehouse.x, y: state.city.landmarks.safehouse.y, label: 'Safehouse' };
          m.objective = 'Get Mara to the Hills safehouse — the Vultures are coming';
          state.message('Mara\u2019s in. Drive — the Vultures are on us!', 3);
          // Two rival cars join the chase.
          for (let i = 0; i < 2; i += 1) {
            const point = nearestRoadPoint(state.city, state.player.x + (i === 0 ? 500 : -500), state.player.y + 300);
            m.rivals.push({
              x: point.x, y: point.y, angle: 0, speed: 300, color: '#8b2f39',
              model: 'Vulture', kind: 'rival', hp: 80, removed: false,
            });
          }
          addWanted(state, 1, 'The Vultures called the cops!');
        }
      } else if (near(state, m.target, 80)) {
        completeMission(state);
        return 'complete';
      }
      break;
    }
    case 4: {
      if (m.stage === 0) {
        if (near(state, m.target, 80)) {
          m.stage = 1;
          m.channel = 3;
          m.target = { x: state.city.landmarks.bank.x, y: state.city.landmarks.bank.y, label: 'Grab the cash!' };
          m.objective = 'Inside! Grab the cash — stay in the vault 3 seconds';
          state.message('You\u2019re in the bank. Grab it all!', 3);
        }
      } else if (m.stage === 1) {
        if (near(state, m.target, 70) && !state.player.inCar) {
          m.channel -= dt;
          if (m.channel <= 0) {
            m.stage = 2;
            addWanted(state, 4, 'WANTED — 4 stars! Every cop in Solmar Bay is coming!');
            m.target = { x: state.city.landmarks.hideout.x, y: state.city.landmarks.hideout.y, label: 'Hideout' };
            m.objective = 'Escape to the hideout with the cash!';
            state.message('Cash grabbed! Run for the hideout!', 3);
            if (state.spawnEnemy) {
              state.spawnEnemy(state.player.x + 120, state.player.y - 80);
              state.spawnEnemy(state.player.x - 100, state.player.y + 100);
            }
          }
        } else {
          m.channel = 3;
        }
      } else if (near(state, m.target, 80)) {
        completeMission(state);
        return 'complete';
      }
      break;
    }
    default:
      break;
  }
  return null;
}
