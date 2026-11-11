// -----------------------------------------------------------------------------
// The date-based scene events already fired, remembered across restarts.
//
// "It is Léa's birthday" must fire once on the day, not once per container
// start: an update of the integration at noon would wish it again. The keys
// (`birthday_today:Léa:2026-11-14`…) are kept in /data — the only writable path
// of the sandbox — for 45 days, then forgotten.
//
// A file that cannot be read or written is not an error worth stopping for:
// the store keeps working in memory and says so once in the logs.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'fired-store' });

const KEEP_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * @param {object} [options]
 * @param {string|null} [options.file] JSON file; `null` keeps everything in memory
 * @param {() => number} [options.now]
 */
export function createFiredStore({ file = null, now = Date.now } = {}) {
  /** key -> time it fired (ms) */
  const entries = new Map();
  let warned = false;

  const warnOnce = (message, err) => {
    if (warned) return;
    warned = true;
    logger.warn(`${message} (${err?.code ?? err?.message}); fired triggers kept in memory only`);
  };

  return {
    has(key) {
      return entries.has(key);
    },

    add(key) {
      entries.set(key, now());
    },

    get size() {
      return entries.size;
    },

    async load() {
      if (!file) return;
      try {
        const content = JSON.parse(await readFile(file, 'utf8'));
        for (const [key, at] of Object.entries(content ?? {})) {
          if (Number.isFinite(at) && now() - at < KEEP_MS) entries.set(key, at);
        }
      } catch (err) {
        if (err?.code !== 'ENOENT') warnOnce(`Cannot read ${file}`, err);
      }
    },

    async save() {
      for (const [key, at] of entries) {
        if (now() - at >= KEEP_MS) entries.delete(key);
      }
      if (!file) return;
      try {
        await mkdir(dirname(file), { recursive: true });
        // Written aside then renamed: a crash mid-write never leaves half a file.
        const temporary = `${file}.tmp`;
        await writeFile(temporary, JSON.stringify(Object.fromEntries(entries)));
        await rename(temporary, file);
      } catch (err) {
        warnOnce(`Cannot write ${file}`, err);
      }
    },
  };
}
