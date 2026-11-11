// -----------------------------------------------------------------------------
// The synchronization loop: Melimelo -> Gladys.
//
// Melimelo pushes nothing, so the integration reads it on its own timer (the
// `sync_interval` of the configuration, 5 minutes by default) and, at each
// read:
//   1. publishes the household device when it is new (one device per household);
//   2. publishes the figures that CHANGED (publishChangedStates: the host API
//      accepts 300 states a minute, sized for changes, not snapshots);
//   3. fires the scene triggers the new snapshot calls for;
//   4. nudges the dashboard widget when something it shows changed;
//   5. reports the connection status shown in the Configuration screen.
//
// Never two reads at once: a sync asked while one runs (a scene action, the
// "Synchronize now" button) waits for that one instead of starting another.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured } from '../config.js';
import { buildHouseholdDevice, buildHouseholdStates } from '../devices/household.js';
import { detectSceneEvents } from '../capabilities/triggers.js';
import { errorMessage, NOT_CONFIGURED } from '../messages.js';
import { summarize } from './summary.js';

const logger = createLogger({ name: 'sync' });

/** A stable value re-sent every 30 minutes, so Gladys keeps it recently dated. */
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

/** Items added by Gladys itself are ignored by "an item was added" for this long. */
const OWN_ITEM_MEMORY_MS = 60 * 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.gladys the SDK instance
 * @param {() => object} deps.getConfig current normalized configuration
 * @param {(config: object) => object} deps.createClient MelimeloClient factory
 * @param {object} deps.fired fired store (src/melimelo/firedStore.js)
 * @param {() => void} [deps.onChange] called when what the widget shows changed
 * @param {() => Date} [deps.now]
 */
export function createSync({
  gladys,
  getConfig,
  createClient,
  fired,
  onChange = () => {},
  now = () => new Date(),
}) {
  const state = {
    snapshot: null,
    summary: null,
    lastSyncAt: null,
    lastError: null,
    publishedDevices: '',
  };
  /** id or lower-cased name -> time added, for the shopping items Gladys added */
  const ownItems = new Map();
  let running = null;
  let timer = null;
  let stopped = true;
  let connectionReported = null;

  const ownItemsView = {
    has(value) {
      const key = String(value ?? '').toLowerCase();
      const at = ownItems.get(key);
      return at !== undefined && now().getTime() - at < OWN_ITEM_MEMORY_MS;
    },
  };

  async function reportConnection(connected, message) {
    const signature = connected ? 'ok' : JSON.stringify(message);
    if (signature === connectionReported) return;
    connectionReported = signature;
    await gladys.setConnectionStatus(connected, connected ? undefined : message).catch((err) => {
      connectionReported = null;
      logger.warn(`Cannot report the connection status: ${err.message}`);
    });
  }

  async function publishDevice(household) {
    const device = buildHouseholdDevice(gladys, household);
    const signature = JSON.stringify(device);
    if (signature === state.publishedDevices) return;
    await gladys.publishDiscoveredDevices([device]);
    state.publishedDevices = signature;
  }

  async function fireEvents(previous, snapshot, config, at) {
    const events = detectSceneEvents({
      previous,
      snapshot,
      config,
      now: at,
      fired,
      ownItems: ownItemsView,
    });
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        if (event.once) fired.add(event.once);
        logger.info(`Scene trigger ${event.key} fired`);
      } catch (err) {
        // Not remembered: the next sync tries again.
        logger.warn(`Scene trigger ${event.key} refused: ${err.message}`);
      }
    }
    if (events.some((event) => event.once)) await fired.save();
  }

  async function run() {
    const config = getConfig();
    if (!isConfigured(config)) {
      state.lastError = { kind: 'not_configured' };
      await reportConnection(false, NOT_CONFIGURED);
      return null;
    }
    const at = now();
    let snapshot;
    try {
      snapshot = await createClient(config).fetchSnapshot({ now: at, timeZone: config.timezone });
    } catch (err) {
      state.lastError = { kind: err.kind ?? 'invalid', at: at.toISOString() };
      logger.warn(`Synchronization failed: ${err.message}`);
      await reportConnection(false, errorMessage(err));
      onChange();
      return null;
    }

    const previous = state.snapshot?.household.id === snapshot.household.id ? state.snapshot : null;
    const summary = summarize(snapshot, at, config.timezone);
    const changed = JSON.stringify(summary) !== JSON.stringify(state.summary) || state.lastError;
    state.snapshot = snapshot;
    state.summary = summary;
    state.lastSyncAt = at.toISOString();
    state.lastError = null;

    try {
      await publishDevice(snapshot.household);
      await gladys.publishChangedStates(buildHouseholdStates(gladys, snapshot.household, summary), {
        heartbeat: STATE_HEARTBEAT_MS,
      });
    } catch (err) {
      logger.warn(`Cannot publish the household to Gladys: ${err.message}`);
    }
    await fireEvents(previous, snapshot, config, at);
    await reportConnection(true);
    if (changed || snapshot.shopping.length !== previous?.shopping.length) onChange();
    return snapshot;
  }

  function schedule() {
    clearTimeout(timer);
    if (stopped) return;
    timer = setTimeout(async () => {
      await sync();
      schedule();
    }, getConfig().sync_interval * 1000);
    timer.unref?.();
  }

  /** Synchronize now; resolves the snapshot, or null when it failed. */
  function sync() {
    if (!running) {
      running = run()
        .catch((err) => {
          logger.error('Synchronization crashed', err);
          return null;
        })
        .finally(() => {
          running = null;
        });
    }
    return running;
  }

  return {
    state,
    sync,

    /** Start (or restart, after a config change) the loop with a sync right away. */
    async start() {
      stopped = false;
      clearTimeout(timer);
      await sync();
      schedule();
    },

    stop() {
      stopped = true;
      clearTimeout(timer);
    },

    /** Forget what was published: Gladys reconnected and resynchronized from scratch. */
    resetPublished() {
      state.publishedDevices = '';
      connectionReported = null;
    },

    /** Remember an item Gladys added, so it is not announced back as "added". */
    rememberOwnItem(id, name) {
      const at = now().getTime();
      for (const value of [id, name]) {
        if (value) ownItems.set(String(value).toLowerCase(), at);
      }
    },
  };
}
