// -----------------------------------------------------------------------------
// The user-facing messages: connection status, action answers, toasts.
// Every one is a `{ en, fr, de, es }` object (src/i18n.js), picked by Gladys in
// the reader's language.
// -----------------------------------------------------------------------------

export const NOT_CONFIGURED = {
  en: 'Fill in the Melimelo API URL and access token in the configuration.',
  fr: "Renseignez l'URL de l'API Melimelo et le jeton d'accès dans la configuration.",
  de: 'Trage die URL der Melimelo-API und das Zugriffstoken in der Konfiguration ein.',
  es: 'Introduzca la URL de la API de Melimelo y el token de acceso en la configuración.',
};

const ERRORS = {
  unauthorized: {
    en: 'Melimelo refused the access token: create a new one and paste it in the configuration.',
    fr: "Melimelo a refusé le jeton d'accès : créez-en un nouveau et collez-le dans la configuration.",
    de: 'Melimelo hat das Zugriffstoken abgelehnt: Erstelle ein neues und füge es in der Konfiguration ein.',
    es: 'Melimelo ha rechazado el token de acceso: cree uno nuevo y péguelo en la configuración.',
  },
  not_found: {
    en: 'The Melimelo API does not know this address: check the API URL.',
    fr: "L'API Melimelo ne connaît pas cette adresse : vérifiez l'URL de l'API.",
    de: 'Die Melimelo-API kennt diese Adresse nicht: Prüfe die URL der API.',
    es: 'La API de Melimelo no conoce esta dirección: compruebe la URL de la API.',
  },
  rate_limited: {
    en: 'Melimelo asks to slow down: the next synchronization will try again.',
    fr: 'Melimelo demande de ralentir : la prochaine synchronisation réessaiera.',
    de: 'Melimelo bittet um weniger Anfragen: Die nächste Synchronisierung versucht es erneut.',
    es: 'Melimelo pide ir más despacio: la próxima sincronización lo volverá a intentar.',
  },
  server: {
    en: 'Melimelo is having trouble right now: the next synchronization will try again.',
    fr: 'Melimelo rencontre un problème en ce moment : la prochaine synchronisation réessaiera.',
    de: 'Melimelo hat gerade Probleme: Die nächste Synchronisierung versucht es erneut.',
    es: 'Melimelo tiene problemas en este momento: la próxima sincronización lo volverá a intentar.',
  },
  network: {
    en: 'Melimelo cannot be reached: check the API URL and the internet connection of Gladys.',
    fr: "Melimelo est injoignable : vérifiez l'URL de l'API et la connexion internet de Gladys.",
    de: 'Melimelo ist nicht erreichbar: Prüfe die URL der API und die Internetverbindung von Gladys.',
    es: 'No se puede contactar con Melimelo: compruebe la URL de la API y la conexión a internet de Gladys.',
  },
  invalid: {
    en: 'Melimelo sent an unexpected answer: see the integration logs.',
    fr: "Melimelo a envoyé une réponse inattendue : consultez les logs de l'intégration.",
    de: 'Melimelo hat eine unerwartete Antwort gesendet: Sieh in den Logs der Integration nach.',
    es: 'Melimelo ha enviado una respuesta inesperada: consulte los registros de la integración.',
  },
};

/** The message explaining why a call to Melimelo failed. */
export function errorMessage(err) {
  return ERRORS[err?.kind] ?? ERRORS.invalid;
}

export const SYNC_DONE = {
  en: 'Synchronized with Melimelo.',
  fr: 'Synchronisé avec Melimelo.',
  de: 'Mit Melimelo synchronisiert.',
  es: 'Sincronizado con Melimelo.',
};

/** Toast of an item added to the shopping list. */
export function itemAdded(name) {
  return {
    en: `“${name}” added to the shopping list.`,
    fr: `« ${name} » ajouté à la liste de courses.`,
    de: `„${name}“ zur Einkaufsliste hinzugefügt.`,
    es: `«${name}» añadido a la lista de la compra.`,
  };
}

/** The "Test the connection" report, from the summary of a fresh snapshot. */
export function connectionReport(household, summary) {
  const { tasksOpen, shoppingItems, eventsToday } = summary;
  return {
    en: `Connected to the household “${household.name}”: ${tasksOpen} open task(s), ${shoppingItems} item(s) to buy, ${eventsToday} event(s) today.`,
    fr: `Connecté au foyer « ${household.name} » : ${tasksOpen} tâche(s) ouverte(s), ${shoppingItems} article(s) à acheter, ${eventsToday} événement(s) aujourd'hui.`,
    de: `Mit dem Haushalt „${household.name}“ verbunden: ${tasksOpen} offene Aufgabe(n), ${shoppingItems} Artikel zu kaufen, ${eventsToday} Termin(e) heute.`,
    es: `Conectado al hogar «${household.name}»: ${tasksOpen} tarea(s) pendiente(s), ${shoppingItems} artículo(s) por comprar, ${eventsToday} evento(s) hoy.`,
  };
}
