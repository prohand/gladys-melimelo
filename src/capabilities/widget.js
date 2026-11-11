// -----------------------------------------------------------------------------
// Dashboard widget (Gladys 5.1+): the household, at a glance.
//
// Four tiles (tasks, shopping list, today's events, bins), one list chosen per
// widget instance (tasks, shopping, agenda or bin days), a status block
// (connection, last sync, next collection, next birthday) and three buttons:
// add to the shopping list (a form behind the tap, Gladys 5.2+), synchronize
// now, and open Melimelo.
//
// The content is declarative (the core renders it, no HTML). The budget: at
// most 8 components, 1 focal (the list), 6 tiles, 1 status and 4 buttons —
// test/widget.test.js checks it with the SDK's own validateWidgetContent.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { localize, pick } from '../i18n.js';
import { NOT_CONFIGURED, errorMessage } from '../messages.js';
import { daysBetween, localDate, localTime } from '../time.js';

/** Key of the manifest widget. Never renamed: dashboards store it. */
export const HOUSEHOLD_WIDGET = 'household';

/** The widget button actions. Never renamed: they are relayed back by key. */
export const WIDGET_ACTIONS = { ADD_SHOPPING_ITEM: 'add_shopping_item', SYNC_NOW: 'sync_now' };

/** The lists an instance can show (the `list` setting of the manifest). */
export const WIDGET_LISTS = ['tasks', 'shopping', 'agenda', 'garbage'];

export const MELIMELO_APP_URL = 'https://app.melimelo.co';

const MAX_LIST_ITEMS = 8;

const GARBAGE_LABELS = {
  household: { en: 'Household waste', fr: 'Ordures ménagères', de: 'Restmüll', es: 'Basura' },
  recycling: { en: 'Recycling', fr: 'Recyclage', de: 'Wertstoffe', es: 'Reciclaje' },
  glass: { en: 'Glass', fr: 'Verre', de: 'Glas', es: 'Vidrio' },
  compost: { en: 'Organic waste', fr: 'Biodéchets', de: 'Biomüll', es: 'Orgánico' },
  bulky: { en: 'Bulky waste', fr: 'Encombrants', de: 'Sperrmüll', es: 'Voluminosos' },
  other: { en: 'Collection', fr: 'Collecte', de: 'Abholung', es: 'Recogida' },
};

/** "today", "tomorrow", "in 3 days"… */
export function relativeDay(days) {
  return localize((language) => {
    if (days === 0)
      return pick(language, { en: 'today', fr: "aujourd'hui", de: 'heute', es: 'hoy' });
    if (days === 1)
      return pick(language, { en: 'tomorrow', fr: 'demain', de: 'morgen', es: 'mañana' });
    if (days < 0) {
      return pick(language, {
        en: `${-days} d late`,
        fr: `${-days} j de retard`,
        de: `${-days} T überfällig`,
        es: `${-days} d de retraso`,
      });
    }
    return pick(language, {
      en: `in ${days} days`,
      fr: `dans ${days} jours`,
      de: `in ${days} Tagen`,
      es: `en ${days} días`,
    });
  });
}

function garbageLabel(collection) {
  return collection.label ?? GARBAGE_LABELS[collection.type] ?? GARBAGE_LABELS.other;
}

function listItems(list, snapshot, today, timeZone) {
  if (list === 'shopping') {
    return snapshot.shopping.slice(0, MAX_LIST_ITEMS).map((item) => ({
      title: item.name,
      ...(item.quantity ? { subtitle: item.quantity } : {}),
    }));
  }
  if (list === 'agenda') {
    return snapshot.events
      .filter((event) => localDate(new Date(event.start), timeZone) >= today)
      .slice(0, MAX_LIST_ITEMS)
      .map((event) => {
        const day = localDate(new Date(event.start), timeZone);
        const when = event.allDay ? '' : ` · ${localTime(new Date(event.start), timeZone)}`;
        return {
          title: event.title,
          subtitle: localize(
            (language) => `${pick(language, relativeDay(daysBetween(today, day)))}${when}`,
          ),
          ...(event.location ? { description: event.location } : {}),
        };
      });
  }
  if (list === 'garbage') {
    return snapshot.garbage.slice(0, MAX_LIST_ITEMS).map((collection) => ({
      title: garbageLabel(collection),
      subtitle: relativeDay(daysBetween(today, collection.date)),
      date: collection.date,
    }));
  }
  // Tasks: the late ones first, then by due date, the undated ones last.
  return [...snapshot.tasks]
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, MAX_LIST_ITEMS)
    .map((task) => {
      const days = task.due ? daysBetween(today, task.due) : null;
      return {
        title: task.title,
        ...(task.assignee ? { subtitle: task.assignee } : {}),
        ...(days !== null && days <= 1
          ? {
              badge: {
                text: relativeDay(days),
                color: days < 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
              },
            }
          : {}),
      };
    });
}

function statusItems(syncState, summary, timeZone) {
  const items = [];
  if (syncState.lastError) {
    items.push({
      label: { en: 'Melimelo', fr: 'Melimelo', de: 'Melimelo', es: 'Melimelo' },
      value: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
      icon: 'cloud-off',
      color: WIDGET_COLORS.DANGER,
    });
  } else {
    items.push({
      label: { en: 'Melimelo', fr: 'Melimelo', de: 'Melimelo', es: 'Melimelo' },
      value: { en: 'Connected', fr: 'Connecté', de: 'Verbunden', es: 'Conectado' },
      icon: 'cloud',
      color: WIDGET_COLORS.SUCCESS,
    });
  }
  if (syncState.lastSyncAt) {
    items.push({
      label: {
        en: 'Last sync',
        fr: 'Dernière synchro',
        de: 'Letzte Synchronisierung',
        es: 'Última sincronización',
      },
      value: localTime(new Date(syncState.lastSyncAt), timeZone),
      icon: 'refresh-cw',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  if (summary?.nextCollection) {
    const label = garbageLabel(summary.nextCollection);
    const when = relativeDay(summary.nextCollection.days);
    items.push({
      label: {
        en: 'Next collection',
        fr: 'Prochaine collecte',
        de: 'Nächste Abholung',
        es: 'Próxima recogida',
      },
      value: localize((language) =>
        `${typeof label === 'string' ? label : pick(language, label)} · ${pick(language, when)}`.slice(
          0,
          40,
        ),
      ),
      icon: 'trash-2',
      color: summary.nextCollection.days <= 1 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
    });
  }
  if (summary?.nextBirthday) {
    const when = relativeDay(summary.nextBirthday.days);
    items.push({
      label: {
        en: 'Next birthday',
        fr: 'Prochain anniversaire',
        de: 'Nächster Geburtstag',
        es: 'Próximo cumpleaños',
      },
      value: localize((language) =>
        `${summary.nextBirthday.name} · ${pick(language, when)}`.slice(0, 40),
      ),
      icon: 'gift',
      color: summary.nextBirthday.days === 0 ? WIDGET_COLORS.PRIMARY : WIDGET_COLORS.NEUTRAL,
    });
  }
  return items;
}

const BUTTONS = [
  {
    type: 'button',
    label: {
      en: 'Add to shopping',
      fr: 'Ajouter aux courses',
      de: 'Zum Einkauf',
      es: 'Añadir a la compra',
    },
    icon: 'shopping-cart',
    style: 'primary',
    action: {
      key: WIDGET_ACTIONS.ADD_SHOPPING_ITEM,
      fields: [
        {
          key: 'item',
          type: 'string',
          required: true,
          label: { en: 'Item', fr: 'Article', de: 'Artikel', es: 'Artículo' },
        },
        {
          key: 'quantity',
          type: 'string',
          required: false,
          label: { en: 'Quantity', fr: 'Quantité', de: 'Menge', es: 'Cantidad' },
        },
      ],
    },
  },
  {
    type: 'button',
    label: { en: 'Synchronize', fr: 'Synchroniser', de: 'Synchronisieren', es: 'Sincronizar' },
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.SYNC_NOW },
  },
  {
    type: 'button',
    label: {
      en: 'Open Melimelo',
      fr: 'Ouvrir Melimelo',
      de: 'Melimelo öffnen',
      es: 'Abrir Melimelo',
    },
    icon: 'external-link',
    style: 'secondary',
    link: { url: MELIMELO_APP_URL },
  },
];

/**
 * The content of the `household` widget.
 *
 * @param {object} state
 * @param {object} state.syncState `sync.state` (snapshot, summary, lastSyncAt, lastError)
 * @param {object} state.config normalized configuration
 * @param {object} [state.settings] the instance settings (`list`)
 * @param {Date} [state.now]
 */
export function buildHouseholdWidget({ syncState, config, settings = {}, now = new Date() }) {
  const components = [];
  const { snapshot, summary } = syncState;

  // The explanation only while there is nothing else to show: once a snapshot
  // exists, the status block says "Error" and the 8-component budget is full.
  if (syncState.lastError && !snapshot) {
    const text =
      syncState.lastError.kind === 'not_configured'
        ? NOT_CONFIGURED
        : errorMessage(syncState.lastError);
    components.push({ type: 'text', variant: 'body', text });
  }

  if (snapshot && summary) {
    const today = localDate(now, config.timezone);
    components.push(
      {
        type: 'value',
        value: summary.tasksOpen,
        label: { en: 'Tasks', fr: 'Tâches', de: 'Aufgaben', es: 'Tareas' },
        icon: 'check-square',
        color: summary.tasksOverdue > 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.NEUTRAL,
      },
      {
        type: 'value',
        value: summary.shoppingItems,
        label: { en: 'Shopping', fr: 'Courses', de: 'Einkauf', es: 'Compra' },
        icon: 'shopping-cart',
      },
      {
        type: 'value',
        value: summary.eventsToday,
        label: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
        icon: 'calendar',
      },
    );
    const list = WIDGET_LISTS.includes(settings.list) ? settings.list : 'tasks';
    const items = listItems(list, snapshot, today, config.timezone);
    if (items.length > 0) {
      components.push({ type: 'card-list', display: 'list', items });
    } else {
      components.push({
        type: 'text',
        variant: 'caption',
        text: {
          en: 'Nothing to show.',
          fr: 'Rien à afficher.',
          de: 'Nichts anzuzeigen.',
          es: 'Nada que mostrar.',
        },
      });
    }
  }

  components.push({ type: 'status', items: statusItems(syncState, summary, config.timezone) });
  components.push(...(snapshot ? BUTTONS : BUTTONS.slice(1)));

  // Each nudge after a sync re-pulls it; the TTL is only a safety net.
  return { ttl_seconds: Math.min(3600, Math.max(60, config.sync_interval)), components };
}
