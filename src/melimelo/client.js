// -----------------------------------------------------------------------------
// The Melimelo cloud API client.
//
// Melimelo (https://melimelo.co) is a household organizer: a shared calendar,
// tasks, the shopping list, the bin collection days, birthdays… This client
// reads them and writes the few things a scene may want to add (a shopping
// item, a task) — over HTTPS, with the household's personal access token.
//
// IMPORTANT — the API contract. Melimelo publishes no public API yet. Every
// route this integration calls is listed in ROUTES below and documented in the
// README ("Melimelo API contract"): when Melimelo opens its API, this file is
// the only one to align. The normalizers are deliberately tolerant (a list or
// `{ data: [...] }`, `title` or `name`, `due_date` or `dueDate`…) so that small
// differences do not need code.
//
// The token is a secret: it only ever goes in the Authorization header, never
// in a URL, an error message or a log line.
// -----------------------------------------------------------------------------

import { addDays, localDate, toDay } from '../time.js';

/** Every route of the Melimelo API this integration uses. */
export const ROUTES = {
  HOUSEHOLD: '/household',
  TASKS: '/tasks',
  TASK_COMPLETE: (id) => `/tasks/${encodeURIComponent(id)}/complete`,
  SHOPPING_ITEMS: '/shopping-list/items',
  GARBAGE_COLLECTIONS: '/garbage-collections',
  BIRTHDAYS: '/birthdays',
  EVENTS: '/events',
};

/** The bin collection kinds the integration tells apart (anything else is `other`). */
export const GARBAGE_TYPES = ['household', 'recycling', 'glass', 'compost', 'bulky', 'other'];

const GARBAGE_ALIASES = {
  household: [
    'household',
    'ordures',
    'ordures ménagères',
    'menagere',
    'ménagères',
    'waste',
    'trash',
  ],
  recycling: ['recycling', 'recyclage', 'tri', 'jaune', 'yellow', 'emballages'],
  glass: ['glass', 'verre'],
  compost: ['compost', 'biodéchets', 'biodechets', 'organic', 'green', 'végétaux', 'vegetaux'],
  bulky: ['bulky', 'encombrants'],
};

/** How far ahead the integration looks. */
export const HORIZON_DAYS = { GARBAGE: 14, BIRTHDAYS: 366, EVENTS: 2 };

const DEFAULT_TIMEOUT_MS = 15_000;

/** An error answered by the Melimelo API, or the lack of an answer. */
export class MelimeloApiError extends Error {
  /**
   * @param {string} kind `unauthorized` | `not_found` | `rate_limited` | `server` | `network` | `invalid`
   * @param {string} message never contains the token
   * @param {number} [status] HTTP status, when the API answered
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'MelimeloApiError';
    this.kind = kind;
    this.status = status;
  }
}

function kindOfStatus(status) {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'invalid';
}

/** The array a list endpoint answered, whatever envelope it came in. */
export function asList(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'items', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function first(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function text(value, max = 200) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    return text(first(value, ['name', 'display_name', 'displayName', 'first_name']), max);
  }
  const string = String(value).trim();
  return string === '' ? null : string.slice(0, max);
}

/** Normalize the bin kind the API names, in any language, to {@link GARBAGE_TYPES}. */
export function garbageType(value) {
  const name = String(value ?? '')
    .trim()
    .toLowerCase();
  for (const [type, aliases] of Object.entries(GARBAGE_ALIASES)) {
    if (aliases.some((alias) => name === alias || name.includes(alias))) return type;
  }
  return 'other';
}

export function normalizeTask(raw, timeZone) {
  const id = text(first(raw, ['id', 'uuid', '_id']));
  const title = text(first(raw, ['title', 'name', 'label']));
  if (!id || !title) return null;
  const done =
    Boolean(first(raw, ['done', 'completed', 'is_done', 'isDone'])) ||
    ['done', 'completed'].includes(String(raw.status ?? '').toLowerCase());
  return {
    id,
    title,
    due: toDay(first(raw, ['due_date', 'dueDate', 'due', 'date']), timeZone),
    assignee: text(first(raw, ['assignee', 'assigned_to', 'assignedTo', 'member']), 60),
    done,
  };
}

export function normalizeShoppingItem(raw) {
  const id = text(first(raw, ['id', 'uuid', '_id']));
  const name = text(first(raw, ['name', 'title', 'label']));
  if (!id || !name) return null;
  return {
    id,
    name,
    quantity: text(first(raw, ['quantity', 'qty', 'amount']), 40),
    addedBy: text(first(raw, ['added_by', 'addedBy', 'created_by', 'createdBy', 'author']), 60),
    checked: Boolean(first(raw, ['checked', 'done', 'bought', 'in_cart', 'inCart'])),
  };
}

export function normalizeGarbageCollection(raw, timeZone) {
  const date = toDay(first(raw, ['date', 'day', 'collection_date', 'collectionDate']), timeZone);
  if (!date) return null;
  const label = text(first(raw, ['label', 'name', 'type', 'kind']), 60);
  return { date, type: garbageType(first(raw, ['type', 'kind', 'name', 'label'])), label };
}

export function normalizeBirthday(raw, timeZone, today) {
  const name = text(first(raw, ['name', 'person', 'title']), 60);
  const birth = toDay(first(raw, ['date', 'birth_date', 'birthDate', 'birthday']), timeZone);
  if (!name || !birth) return null;
  // The API may send the birth date or the next occurrence: count from the
  // month and day either way, and the age when the year is a real birth year.
  const [birthYear, month, day] = birth.split('-').map(Number);
  const [year] = today.split('-').map(Number);
  const occurrence = (y) =>
    `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // February 29th falls on March 1st in the years that have none.
  const valid = (y) =>
    month === 2 && day === 29 && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1
      ? `${y}-03-01`
      : occurrence(y);
  let next = valid(year);
  if (next < today) next = valid(year + 1);
  const nextYear = Number(next.slice(0, 4));
  // A date of this year or next is the occurrence itself, not a birth date: no age.
  const age = birthYear > 1900 && nextYear - birthYear >= 1 ? nextYear - birthYear : null;
  return { name, date: next, age };
}

export function normalizeEvent(raw) {
  const id = text(first(raw, ['id', 'uuid', '_id']));
  const title = text(first(raw, ['title', 'name', 'summary']));
  const startValue = first(raw, ['start', 'start_at', 'startAt', 'starts_at', 'startsAt']);
  const start = startValue ? new Date(startValue) : null;
  if (!id || !title || !start || Number.isNaN(start.getTime())) return null;
  const allDay =
    Boolean(first(raw, ['all_day', 'allDay', 'full_day', 'fullDay'])) ||
    (typeof startValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startValue));
  return {
    id,
    title,
    start: start.toISOString(),
    allDay,
    location: text(first(raw, ['location', 'place', 'where']), 120),
  };
}

function compact(list) {
  return list.filter((entry) => entry !== null);
}

export class MelimeloClient {
  /**
   * @param {object} options
   * @param {string} options.apiUrl base URL, already validated by normalizeApiUrl
   * @param {string} options.token personal access token (secret)
   * @param {typeof fetch} [options.fetch] injected in tests
   * @param {number} [options.timeoutMs]
   * @param {string} [options.userAgent]
   */
  constructor({
    apiUrl,
    token,
    fetch = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = 'gladys-melimelo',
  }) {
    this.baseUrl = `${apiUrl.replace(/\/+$/, '')}/`;
    this.token = token;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
  }

  async request(method, path, { query, body } = {}) {
    const url = new URL(path.replace(/^\/+/, ''), this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          'User-Agent': this.userAgent,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error', // never replay the token to another host
      });
    } catch (err) {
      const reason = err?.name === 'TimeoutError' ? 'timed out' : err?.message || 'unreachable';
      throw new MelimeloApiError('network', `${method} ${url.pathname}: ${reason}`);
    }
    if (!response.ok) {
      throw new MelimeloApiError(
        kindOfStatus(response.status),
        `${method} ${url.pathname}: HTTP ${response.status}`,
        response.status,
      );
    }
    if (response.status === 204) return null;
    const raw = await response.text();
    if (raw.trim() === '') return null;
    try {
      return JSON.parse(raw);
    } catch {
      throw new MelimeloApiError('invalid', `${method} ${url.pathname}: the answer is not JSON`);
    }
  }

  /** `{ id, name }` of the household the token belongs to. */
  async getHousehold() {
    const payload = await this.request('GET', ROUTES.HOUSEHOLD);
    const household = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
    const id = text(first(household, ['id', 'uuid', '_id']), 80);
    if (!id) throw new MelimeloApiError('invalid', 'GET /household: no household id');
    return { id, name: text(first(household, ['name', 'title']), 60) ?? 'Melimelo' };
  }

  async listOpenTasks(timeZone) {
    const payload = await this.request('GET', ROUTES.TASKS, { query: { status: 'open' } });
    return compact(asList(payload).map((task) => normalizeTask(task, timeZone))).filter(
      (task) => !task.done,
    );
  }

  async listShoppingItems() {
    const payload = await this.request('GET', ROUTES.SHOPPING_ITEMS);
    return compact(asList(payload).map(normalizeShoppingItem)).filter((item) => !item.checked);
  }

  async listGarbageCollections(timeZone, today) {
    const payload = await this.request('GET', ROUTES.GARBAGE_COLLECTIONS, {
      query: { from: today, to: addDays(today, HORIZON_DAYS.GARBAGE) },
    });
    return compact(asList(payload).map((entry) => normalizeGarbageCollection(entry, timeZone)))
      .filter((entry) => entry.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async listBirthdays(timeZone, today) {
    const payload = await this.request('GET', ROUTES.BIRTHDAYS);
    return compact(asList(payload).map((entry) => normalizeBirthday(entry, timeZone, today)))
      .filter((entry) => entry.date <= addDays(today, HORIZON_DAYS.BIRTHDAYS))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async listEvents(from, to) {
    const payload = await this.request('GET', ROUTES.EVENTS, {
      query: { from: from.toISOString(), to: to.toISOString() },
    });
    return compact(asList(payload).map(normalizeEvent)).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
  }

  /** Add an item to the shopping list; resolves its id (null when the API gives none). */
  async addShoppingItem(name, quantity) {
    const payload = await this.request('POST', ROUTES.SHOPPING_ITEMS, {
      body: { name, ...(quantity ? { quantity } : {}) },
    });
    return text(first(payload?.data ?? payload, ['id', 'uuid', '_id']), 80);
  }

  /** Create a task; resolves its id (null when the API gives none). */
  async createTask(title, dueDate) {
    const payload = await this.request('POST', ROUTES.TASKS, {
      body: { title, ...(dueDate ? { due_date: dueDate } : {}) },
    });
    return text(first(payload?.data ?? payload, ['id', 'uuid', '_id']), 80);
  }

  async completeTask(id) {
    await this.request('POST', ROUTES.TASK_COMPLETE(id));
  }

  /**
   * Everything the integration shows, in one read. The household comes first:
   * a wrong token fails there, before five more requests.
   *
   * @param {{ now: Date, timeZone: string }} options
   */
  async fetchSnapshot({ now, timeZone }) {
    const today = localDate(now, timeZone);
    const household = await this.getHousehold();
    const eventsUntil = new Date(now.getTime() + HORIZON_DAYS.EVENTS * 24 * 60 * 60 * 1000);
    const [tasks, shopping, garbage, birthdays, events] = await Promise.all([
      this.listOpenTasks(timeZone),
      this.listShoppingItems(),
      this.listGarbageCollections(timeZone, today),
      this.listBirthdays(timeZone, today),
      this.listEvents(new Date(now.getTime() - 12 * 60 * 60 * 1000), eventsUntil),
    ]);
    return {
      fetchedAt: now.toISOString(),
      today,
      household,
      tasks,
      shopping,
      garbage,
      birthdays,
      events,
    };
  }
}
