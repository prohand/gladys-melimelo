# Melimelo for Gladys

This integration connects your [Melimelo](https://melimelo.co) household — the family
organizer app — to Gladys Assistant. Gladys sees your tasks, shopping list, bin collection
days, birthdays and the household calendar, and can use them in scenes and on the dashboard.

It works **through the cloud**: Gladys reads the Melimelo API over the internet. Nothing is
installed on your network.

It requires **Gladys 5.3.0 or newer**.

## What you need

- **The Melimelo API URL** (an `https://…` address);
- **A personal access token** of your household.

Both are provided by Melimelo. Today, Melimelo does not publish a public API yet: until it
does, the integration cannot connect. It is ready to work as soon as Melimelo opens that
access.

## Setup

1. In Gladys, open **Integrations**, search for **Melimelo** and install it.
2. In the **Configuration** screen of the integration:
   - paste the **Melimelo API URL**;
   - paste the **access token** (it is stored as a secret);
   - adjust the settings below if needed.
3. Click **Test the connection**: the message names the household found and counts its
   tasks and items.
4. Open **Discovery**: the device **Melimelo – <household name>** shows up. Add it to follow
   its values in Gladys.

## Settings

| Setting                  | Default        | What it does                                             |
| ------------------------ | -------------- | -------------------------------------------------------- |
| Melimelo API URL         | —              | Address of the API. Only `https` is accepted.            |
| Access token             | —              | Personal token of the household. Never shown nor logged. |
| Synchronization interval | 300 s          | How often Melimelo is read (60 to 3600 s).               |
| Bin reminder hour        | 19             | Hour (0-23) from which "bins go out tomorrow" fires.     |
| Event notice             | 15 min         | Lead time of "event about to start" (5 to 240 min).      |
| Time zone                | `Europe/Paris` | Tells what "today" and "tomorrow" are.                   |

## The "Household" device

One read-only device per household:

| Value                          | Example     |
| ------------------------------ | ----------- |
| Open tasks                     | 4           |
| Overdue tasks                  | 1           |
| Shopping list items            | 7           |
| Today's events                 | 2           |
| Days until the next collection | 1           |
| Next bin collection            | Yellow bin  |
| Days until the next birthday   | 9           |
| Next birthday                  | Granny (80) |

Use them in scene conditions, e.g. "if there are overdue tasks, send a message".

## Scenes

### Triggers

| Key                           | When                                                              | Variables                                    |
| ----------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `task_due`                    | An open task is due today                                         | `title`, `assignee`, `due_date`              |
| `garbage_collection_tomorrow` | The day before a collection, from the reminder hour (type filter) | `type`, `label`, `date`                      |
| `birthday_today`              | On the day of a birthday                                          | `name`, `age`                                |
| `shopping_item_added`         | A household member adds an item (never Gladys)                    | `item`, `quantity`, `added_by`               |
| `event_starting_soon`         | A calendar event starts soon (all-day events excluded)            | `title`, `start_time`, `location`, `minutes` |

Each trigger fires **only once** per task, collection, birthday or event, even if the
integration restarts. Use the variables in the following actions, e.g.
`{{triggerEvent.data.title}}`.

Triggers are checked at every synchronization: with a 300 s interval, an event may be
announced up to 5 minutes later than the chosen notice.

### Actions

| Key                 | What it does                                    | Output                           |
| ------------------- | ----------------------------------------------- | -------------------------------- |
| `add_shopping_item` | Adds an item to the shopping list               | `added`                          |
| `create_task`       | Creates a task (optional `YYYY-MM-DD` due date) | `task_id`                        |
| `complete_task`     | Completes the open task with this title         | `completed` (`false` if missing) |
| `sync_now`          | Reads Melimelo right away                       | `tasks_open`, `shopping_items`   |

Example: "When the fridge sensor sees the door open for more than 2 minutes, add 'Check the
fridge' to the tasks."

## Dashboard

The **Melimelo household** widget shows:

- the number of tasks, items to buy and today's events;
- one list of your choice (widget setting): tasks, shopping, agenda or bin days;
- the connection, the time of the last sync, the next collection and the next birthday;
- the buttons **Add to shopping** (a small form), **Synchronize** and **Open Melimelo**.

## Troubleshooting

| Message                             | What to do                                           |
| ----------------------------------- | ---------------------------------------------------- |
| "Fill in the Melimelo API URL…"     | Fill in the URL and the token in the configuration.  |
| "Melimelo refused the access token" | Create a new token and paste it.                     |
| "The Melimelo API does not know…"   | Check the API URL.                                   |
| "Melimelo cannot be reached"        | Check the URL and the internet connection of Gladys. |
| "Melimelo asks to slow down"        | Raise the synchronization interval.                  |

The integration logs are in Gladys **Settings → System** (container logs). The token never
appears there.

## Privacy

The integration only talks to the Melimelo API you configured. The household data stays in
Gladys. Only a short list of the triggers already sent is kept on disk (`/data`), 45 days at
most.
