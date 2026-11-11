# Melimelo für Gladys

Diese Integration verbindet deinen [Melimelo](https://melimelo.co)-Haushalt — die App zur
Organisation der Familie — mit Gladys Assistant. Gladys sieht deine Aufgaben, die
Einkaufsliste, die Abholtage der Müllabfuhr, Geburtstage und den Kalender des Haushalts und
kann sie in Szenen und auf dem Dashboard verwenden.

Sie arbeitet **über die Cloud**: Gladys liest die Melimelo-API über das Internet. In deinem
Netzwerk wird nichts installiert.

Erforderlich ist **Gladys 5.3.0 oder neuer**.

## Was du brauchst

- **Die URL der Melimelo-API** (eine `https://…`-Adresse);
- **Ein persönliches Zugriffstoken** deines Haushalts.

Beides wird von Melimelo bereitgestellt. Derzeit veröffentlicht Melimelo noch keine
öffentliche API: Solange das so ist, kann sich die Integration nicht verbinden. Sie ist
bereit, sobald Melimelo diesen Zugang öffnet.

## Einrichtung

1. Öffne in Gladys **Integrationen**, suche **Melimelo** und installiere sie.
2. Im Bildschirm **Konfiguration** der Integration:
   - füge die **URL der Melimelo-API** ein;
   - füge das **Zugriffstoken** ein (es wird als Geheimnis gespeichert);
   - passe bei Bedarf die Einstellungen unten an.
3. Klicke auf **Verbindung testen**: Die Meldung nennt den gefundenen Haushalt und zählt
   seine Aufgaben und Artikel.
4. Öffne **Erkennung**: Das Gerät **Melimelo – <Name des Haushalts>** erscheint. Füge es
   hinzu, um seine Werte in Gladys zu verfolgen.

## Einstellungen

| Einstellung                 | Standard       | Wozu                                                          |
| --------------------------- | -------------- | ------------------------------------------------------------- |
| URL der Melimelo-API        | —              | Adresse der API. Nur `https` wird akzeptiert.                 |
| Zugriffstoken               | —              | Persönliches Token des Haushalts. Nie angezeigt, nie geloggt. |
| Synchronisierungsintervall  | 300 s          | Wie oft Melimelo gelesen wird (60 bis 3600 s).                |
| Uhrzeit der Müll-Erinnerung | 19             | Uhrzeit (0-23), ab der „Müllabfuhr morgen“ auslöst.           |
| Vorlauf für Termine         | 15 min         | Vorlauf von „Termin beginnt gleich“ (5 bis 240 min).          |
| Zeitzone                    | `Europe/Paris` | Bestimmt, was „heute“ und „morgen“ ist.                       |

## Das Gerät „Haushalt“

Ein schreibgeschütztes Gerät pro Haushalt:

| Wert                             | Beispiel    |
| -------------------------------- | ----------- |
| Offene Aufgaben                  | 4           |
| Überfällige Aufgaben             | 1           |
| Artikel auf der Einkaufsliste    | 7           |
| Termine heute                    | 2           |
| Tage bis zur nächsten Abholung   | 1           |
| Nächste Abholung                 | Gelbe Tonne |
| Tage bis zum nächsten Geburtstag | 9           |
| Nächster Geburtstag              | Oma (80)    |

Nutze sie in Szenen-Bedingungen, z. B. „wenn es überfällige Aufgaben gibt, eine Nachricht
senden“.

## Szenen

### Auslöser

| Schlüssel                     | Wann                                                               | Variablen                                    |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `task_due`                    | Eine offene Aufgabe ist heute fällig                               | `title`, `assignee`, `due_date`              |
| `garbage_collection_tomorrow` | Am Vortag einer Abholung, ab der Erinnerungszeit (Filter nach Art) | `type`, `label`, `date`                      |
| `birthday_today`              | Am Tag eines Geburtstags                                           | `name`, `age`                                |
| `shopping_item_added`         | Ein Mitglied des Haushalts fügt einen Artikel hinzu (nie Gladys)   | `item`, `quantity`, `added_by`               |
| `event_starting_soon`         | Ein Termin beginnt gleich (ganztägige Termine ausgenommen)         | `title`, `start_time`, `location`, `minutes` |

Jeder Auslöser löst **nur einmal** pro Aufgabe, Abholung, Geburtstag oder Termin aus, auch
nach einem Neustart der Integration. Die Variablen stehen in den folgenden Aktionen zur
Verfügung, z. B. `{{triggerEvent.data.title}}`.

Die Auslöser werden bei jeder Synchronisierung geprüft: Bei einem Intervall von 300 s kann ein
Termin bis zu 5 Minuten später als der gewählte Vorlauf gemeldet werden.

### Aktionen

| Schlüssel           | Wozu                                                     | Ergebnis                             |
| ------------------- | -------------------------------------------------------- | ------------------------------------ |
| `add_shopping_item` | Fügt der Einkaufsliste einen Artikel hinzu               | `added`                              |
| `create_task`       | Erstellt eine Aufgabe (Fälligkeit `JJJJ-MM-TT` optional) | `task_id`                            |
| `complete_task`     | Erledigt die offene Aufgabe mit diesem Titel             | `completed` (`false`, wenn nicht da) |
| `sync_now`          | Liest Melimelo sofort                                    | `tasks_open`, `shopping_items`       |

Beispiel: „Wenn der Kühlschranksensor die Tür länger als 2 Minuten offen sieht, ‚Kühlschrank
prüfen‘ zu den Aufgaben hinzufügen.“

## Dashboard

Das Widget **Melimelo-Haushalt** zeigt:

- die Zahl der Aufgaben, der zu kaufenden Artikel und der heutigen Termine;
- eine Liste nach Wahl (Widget-Einstellung): Aufgaben, Einkauf, Kalender oder Müllabfuhr;
- die Verbindung, die Uhrzeit der letzten Synchronisierung, die nächste Abholung und den
  nächsten Geburtstag;
- die Schaltflächen **Zum Einkauf** (ein kleines Formular), **Synchronisieren** und
  **Melimelo öffnen**.

## Fehlerbehebung

| Meldung                                      | Was tun                                       |
| -------------------------------------------- | --------------------------------------------- |
| „Trage die URL der Melimelo-API …“           | URL und Token in der Konfiguration eintragen. |
| „Melimelo hat das Zugriffstoken abgelehnt“   | Ein neues Token erstellen und einfügen.       |
| „Die Melimelo-API kennt diese Adresse nicht“ | Die URL der API prüfen.                       |
| „Melimelo ist nicht erreichbar“              | URL und Internetverbindung von Gladys prüfen. |
| „Melimelo bittet um weniger Anfragen“        | Das Synchronisierungsintervall erhöhen.       |

Die Logs der Integration findest du in Gladys unter **Einstellungen → System**
(Container-Logs). Das Token erscheint dort nie.

## Datenschutz

Die Integration spricht nur mit der konfigurierten Melimelo-API. Die Daten des Haushalts
bleiben in Gladys. Nur eine kurze Liste der bereits gesendeten Auslöser wird auf der Festplatte
(`/data`) gespeichert, höchstens 45 Tage lang.
