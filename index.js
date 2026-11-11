// -----------------------------------------------------------------------------
// Entry point of the Melimelo integration for Gladys Assistant.
//
// The Gladys supervisor injects three variables in the container, read by the
// SDK by itself: GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR. Everything else — the handlers, the
// synchronization loop — is wired in src/app.js, which the tests drive with the
// SDK's fake Gladys.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';
import { createFiredStore } from './src/melimelo/firedStore.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// /data is the only writable path of the sandbox (read-only rootfs).
const dataDir = process.env.MELIMELO_DATA_DIR ?? '/data';

const gladys = new GladysIntegration();

registerHandlers(gladys, {
  fired: createFiredStore({ file: join(dataDir, 'fired-triggers.json') }),
  userAgent: `gladys-melimelo/${version}`,
});

logger.info(`Starting the Melimelo integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
