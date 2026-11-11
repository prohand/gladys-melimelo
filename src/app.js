// -----------------------------------------------------------------------------
// The wiring: SDK handlers -> Melimelo.
//
// Kept apart from index.js so the tests can drive it with the SDK's fake
// Gladys (`createFakeGladys`): index.js only builds the real SDK instance and
// connects. Everything is registered BEFORE connect(), as the SDK requires.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig } from './config.js';
import { MelimeloClient } from './melimelo/client.js';
import { createFiredStore } from './melimelo/firedStore.js';
import { createSync } from './melimelo/sync.js';
import { summarize } from './melimelo/summary.js';
import { addShoppingItem, createSceneActions } from './capabilities/scenes.js';
import { HOUSEHOLD_WIDGET, WIDGET_ACTIONS, buildHouseholdWidget } from './capabilities/widget.js';
import {
  connectionReport,
  errorMessage,
  itemAdded,
  NOT_CONFIGURED,
  SYNC_DONE,
} from './messages.js';

const logger = createLogger({ name: 'melimelo' });

/**
 * Register every handler on a Gladys SDK instance.
 *
 * @param {object} gladys GladysIntegration (or the fake one of the tests)
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch] HTTP client handed to the Melimelo client
 * @param {object} [options.fired] fired store (memory-only by default)
 * @param {() => Date} [options.now]
 * @param {string} [options.userAgent]
 * @returns {{ sync: object, getConfig: () => object }}
 */
export function registerHandlers(gladys, options = {}) {
  const {
    fetch = globalThis.fetch,
    now = () => new Date(),
    userAgent = 'gladys-melimelo',
  } = options;
  const fired = options.fired ?? createFiredStore();
  let config = normalizeConfig();

  const createClient = (current) =>
    new MelimeloClient({ apiUrl: current.api_url, token: current.api_token, fetch, userAgent });

  const getClient = () => {
    if (!isConfigured(config)) throw new Error(NOT_CONFIGURED.en);
    return createClient(config);
  };

  const sync = createSync({
    gladys,
    getConfig: () => config,
    createClient,
    fired,
    now,
    onChange: () => gladys.requestWidgetRefresh(HOUSEHOLD_WIDGET),
  });

  // --- Discovery: the household device, published at every sync ------------
  gladys.onScanRequest(async () => {
    sync.resetPublished();
    await sync.sync();
  });

  // --- Configuration screen buttons -----------------------------------------
  gladys.onAction('test_connection', async () => {
    if (!isConfigured(config)) return NOT_CONFIGURED;
    try {
      const at = now();
      const snapshot = await getClient().fetchSnapshot({ now: at, timeZone: config.timezone });
      return connectionReport(snapshot.household, summarize(snapshot, at, config.timezone));
    } catch (err) {
      logger.warn(`Connection test failed: ${err.message}`);
      return errorMessage(err);
    }
  });

  gladys.onAction('sync_now', async () => {
    if (!isConfigured(config)) return NOT_CONFIGURED;
    const snapshot = await sync.sync();
    return snapshot ? SYNC_DONE : errorMessage(sync.state.lastError);
  });

  // --- Scene actions ----------------------------------------------------------
  for (const [key, handler] of Object.entries(createSceneActions({ getClient, sync }))) {
    gladys.onSceneAction(key, handler);
  }

  // --- Dashboard widget ---------------------------------------------------------
  gladys.onWidgetGet(HOUSEHOLD_WIDGET, async ({ settings }) =>
    buildHouseholdWidget({ syncState: sync.state, config, settings, now: now() }),
  );

  gladys.onWidgetAction(HOUSEHOLD_WIDGET, async (actionKey, _params, { values } = {}) => {
    if (actionKey === WIDGET_ACTIONS.SYNC_NOW) {
      const snapshot = await sync.sync();
      return snapshot ? SYNC_DONE : errorMessage(sync.state.lastError);
    }
    if (actionKey === WIDGET_ACTIONS.ADD_SHOPPING_ITEM) {
      // An older core drops the form and relays the tap without values.
      if (!values?.item) throw new Error('No item received: Gladys 5.2 or newer is required');
      const name = await addShoppingItem(
        { client: getClient(), sync },
        values.item,
        values.quantity,
      );
      return itemAdded(name);
    }
    throw new Error(`Unknown widget action: ${actionKey}`);
  });

  // --- Configuration updated by the user ---------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    config = normalizeConfig(newConfig);
    logger.info('Configuration updated: synchronizing again');
    await sync.start();
  });

  // --- Connection lifecycle -----------------------------------------------------
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await fired.load();
      // Gladys resynchronized from scratch: publish the device again.
      sync.resetPublished();
      await sync.start();
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
    }
  });

  gladys.on('disconnected', () => {
    sync.stop();
  });

  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal}: stopping`);
    sync.stop();
    await fired.save();
  });

  return { sync, getConfig: () => config };
}
