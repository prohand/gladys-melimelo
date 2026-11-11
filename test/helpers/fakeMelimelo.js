// -----------------------------------------------------------------------------
// An in-memory Melimelo API, served through an injected `fetch`.
//
// It answers the routes of src/melimelo/client.js (ROUTES) the way the API
// contract of the README describes them, records every request, and can be
// told to fail (`failWith`) to exercise the error paths. No network involved.
// -----------------------------------------------------------------------------

export const API_URL = 'https://api.melimelo.test/v1';
export const TOKEN = 'secret-token-123';

export function createFakeMelimelo(initial = {}) {
  const data = {
    household: { id: 'hh-1', name: 'Les Martin' },
    tasks: [],
    shopping: [],
    garbage: [],
    birthdays: [],
    events: [],
    ...initial,
  };
  const requests = [];
  let failure = null;
  let nextId = 100;

  const json = (status, body) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  async function fetch(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: init.headers,
      body,
    });

    if (failure) {
      if (failure === 'network') throw new TypeError('fetch failed');
      return json(failure, { error: 'nope' });
    }
    if (init.headers?.Authorization !== `Bearer ${TOKEN}`)
      return json(401, { error: 'unauthorized' });

    const path = url.pathname.replace(/^\/v1/, '');
    if (method === 'GET' && path === '/household') return json(200, data.household);
    if (method === 'GET' && path === '/tasks') return json(200, { data: data.tasks });
    if (method === 'POST' && path === '/tasks') {
      const task = { id: `t-${nextId++}`, title: body.title, due_date: body.due_date ?? null };
      data.tasks.push(task);
      return json(201, task);
    }
    const complete = path.match(/^\/tasks\/([^/]+)\/complete$/);
    if (method === 'POST' && complete) {
      const id = decodeURIComponent(complete[1]);
      if (!data.tasks.some((task) => task.id === id)) return json(404, { error: 'not found' });
      data.tasks = data.tasks.filter((task) => task.id !== id);
      return json(204);
    }
    if (method === 'GET' && path === '/shopping-list/items')
      return json(200, { items: data.shopping });
    if (method === 'POST' && path === '/shopping-list/items') {
      const item = {
        id: `s-${nextId++}`,
        name: body.name,
        quantity: body.quantity ?? null,
        added_by: 'Gladys',
      };
      data.shopping.push(item);
      return json(201, { data: item });
    }
    if (method === 'GET' && path === '/garbage-collections') return json(200, data.garbage);
    if (method === 'GET' && path === '/birthdays') return json(200, data.birthdays);
    if (method === 'GET' && path === '/events') return json(200, { data: data.events });
    return json(404, { error: 'unknown route' });
  }

  return {
    data,
    requests,
    fetch,
    /** `null` to answer again, an HTTP status, or `'network'`. */
    failWith(status) {
      failure = status;
    },
  };
}
