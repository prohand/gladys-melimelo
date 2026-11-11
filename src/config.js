// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. The SDK fetches it (`gladys.getConfig()`)
// and announces every change (`gladys.onConfigUpdated()`); this module only
// applies the defaults and the bounds, so the rest of the code never deals with
// `undefined`, a number typed as a string, or an hour of 25.
// -----------------------------------------------------------------------------

import { isValidTimeZone } from './time.js';

// Defaults: they MUST match the `default` of the manifest (test/manifest.test.js).
export const DEFAULT_CONFIG = {
  // Base URL of the Melimelo cloud API, and the personal access token of the
  // household. Both come from Melimelo; nothing works without them.
  api_url: '',
  api_token: '',
  // Seconds between two synchronizations with the Melimelo cloud.
  sync_interval: 300,
  // Hour (0-23, household time) from which the "bins go out tomorrow" trigger fires.
  garbage_reminder_hour: 19,
  // Minutes before a calendar event that "an event is about to start" fires.
  event_notice_minutes: 15,
  // IANA time zone of the household: "today" and "tomorrow" are counted in it.
  timezone: 'Europe/Paris',
};

const BOUNDS = {
  sync_interval: [60, 3600],
  garbage_reminder_hour: [0, 23],
  event_notice_minutes: [5, 240],
};

function boundedInteger(value, key) {
  const [min, max] = BOUNDS[key];
  const number = Math.round(Number(value));
  if (value === '' || value === null || !Number.isFinite(number)) return DEFAULT_CONFIG[key];
  return Math.min(max, Math.max(min, number));
}

/**
 * The API base URL, or `null` when it is missing or unsafe. Only https is
 * accepted — the token travels in every request — except on the loopback, for
 * a developer running a local copy of the API.
 */
export function normalizeApiUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
  if (url.username || url.password) return null;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const timezone =
    typeof raw.timezone === 'string' && isValidTimeZone(raw.timezone.trim())
      ? raw.timezone.trim()
      : DEFAULT_CONFIG.timezone;
  return {
    api_url: normalizeApiUrl(raw.api_url) ?? '',
    api_token: typeof raw.api_token === 'string' ? raw.api_token.trim() : '',
    sync_interval: boundedInteger(
      raw.sync_interval ?? DEFAULT_CONFIG.sync_interval,
      'sync_interval',
    ),
    garbage_reminder_hour: boundedInteger(
      raw.garbage_reminder_hour ?? DEFAULT_CONFIG.garbage_reminder_hour,
      'garbage_reminder_hour',
    ),
    event_notice_minutes: boundedInteger(
      raw.event_notice_minutes ?? DEFAULT_CONFIG.event_notice_minutes,
      'event_notice_minutes',
    ),
    timezone,
  };
}

/** Whether the integration has what it needs to reach Melimelo. */
export function isConfigured(config) {
  return Boolean(config.api_url && config.api_token);
}
