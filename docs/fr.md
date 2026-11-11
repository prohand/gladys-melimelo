# Melimelo pour Gladys

Cette intégration relie votre foyer [Melimelo](https://melimelo.co) — l'application
d'organisation de la famille — à Gladys Assistant. Gladys voit vos tâches, votre liste de
courses, les jours de collecte des déchets, les anniversaires et l'agenda du foyer, et peut
s'en servir dans des scènes et sur le tableau de bord.

Elle fonctionne **par le cloud** : Gladys interroge l'API de Melimelo sur internet. Rien n'est
installé sur votre réseau.

Il faut **Gladys 5.3.0 ou plus récent**.

## Ce qu'il vous faut

- **L'URL de l'API Melimelo** (une adresse `https://…`) ;
- **Un jeton d'accès personnel** de votre foyer.

Les deux sont fournis par Melimelo. À ce jour, Melimelo ne publie pas encore d'API publique :
tant que ce n'est pas le cas, l'intégration ne peut pas se connecter. Elle est prête à
fonctionner dès que Melimelo ouvre cet accès.

## Installation

1. Dans Gladys, ouvrez **Intégrations**, cherchez **Melimelo** et installez-la.
2. Dans l'écran **Configuration** de l'intégration :
   - collez l'**URL de l'API Melimelo** ;
   - collez le **jeton d'accès** (il est stocké comme un secret) ;
   - si besoin, ajustez les réglages ci-dessous.
3. Cliquez sur **Tester la connexion** : le message indique le nom du foyer trouvé et le
   nombre de tâches et d'articles.
4. Ouvrez **Découverte** : l'appareil **Melimelo – <nom du foyer>** apparaît. Ajoutez-le pour
   suivre ses valeurs dans Gladys.

## Réglages

| Réglage                       | Par défaut     | Rôle                                                                 |
| ----------------------------- | -------------- | -------------------------------------------------------------------- |
| URL de l'API Melimelo         | —              | Adresse de l'API. Seul `https` est accepté.                          |
| Jeton d'accès                 | —              | Jeton personnel du foyer. Jamais affiché ni écrit dans les logs.     |
| Intervalle de synchronisation | 300 s          | Fréquence de lecture de Melimelo (60 à 3600 s).                      |
| Heure du rappel poubelles     | 19             | Heure (0-23) à partir de laquelle « poubelles demain » se déclenche. |
| Préavis des événements        | 15 min         | Délai avant un événement pour « événement imminent » (5 à 240 min).  |
| Fuseau horaire                | `Europe/Paris` | Sert à savoir ce que sont « aujourd'hui » et « demain ».             |

## L'appareil « Foyer »

Un appareil par foyer, en lecture seule :

| Valeur                               | Exemple    |
| ------------------------------------ | ---------- |
| Tâches ouvertes                      | 4          |
| Tâches en retard                     | 1          |
| Articles sur la liste de courses     | 7          |
| Événements aujourd'hui               | 2          |
| Jours avant la prochaine collecte    | 1          |
| Prochaine collecte                   | Bac jaune  |
| Jours avant le prochain anniversaire | 9          |
| Prochain anniversaire                | Mamie (80) |

Ces valeurs servent dans les conditions de scène, par exemple : « s'il y a des tâches en
retard, envoyer un message ».

## Scènes

### Déclencheurs

| Clé                           | Quand                                                                  | Variables                                    |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `task_due`                    | Une tâche ouverte arrive à échéance aujourd'hui                        | `title`, `assignee`, `due_date`              |
| `garbage_collection_tomorrow` | Veille d'une collecte, à partir de l'heure de rappel (filtre par type) | `type`, `label`, `date`                      |
| `birthday_today`              | Jour d'un anniversaire                                                 | `name`, `age`                                |
| `shopping_item_added`         | Un membre du foyer ajoute un article (pas Gladys)                      | `item`, `quantity`, `added_by`               |
| `event_starting_soon`         | Un événement de l'agenda commence bientôt (hors journées entières)     | `title`, `start_time`, `location`, `minutes` |

Chaque déclencheur ne se déclenche **qu'une fois** par tâche, collecte, anniversaire ou
événement, même si l'intégration redémarre. Les variables s'utilisent dans les actions
suivantes, par exemple `{{triggerEvent.data.title}}`.

Les déclencheurs sont vérifiés à chaque synchronisation : avec un intervalle de 300 s, un
événement peut être annoncé jusqu'à 5 minutes plus tard que le préavis choisi.

### Actions

| Clé                 | Rôle                                               | Résultat                         |
| ------------------- | -------------------------------------------------- | -------------------------------- |
| `add_shopping_item` | Ajoute un article à la liste de courses            | `added`                          |
| `create_task`       | Crée une tâche (échéance `AAAA-MM-JJ` facultative) | `task_id`                        |
| `complete_task`     | Termine la tâche ouverte portant ce titre          | `completed` (`false` si absente) |
| `sync_now`          | Relit Melimelo tout de suite                       | `tasks_open`, `shopping_items`   |

Exemple : « Quand le capteur du frigo voit la porte ouverte plus de 2 minutes, ajouter
"Vérifier le frigo" aux tâches. »

## Tableau de bord

Le widget **Foyer Melimelo** affiche :

- le nombre de tâches, d'articles à acheter et d'événements du jour ;
- une liste au choix (réglage du widget) : tâches, courses, agenda ou collecte des déchets ;
- l'état de la connexion, l'heure de la dernière synchro, la prochaine collecte et le
  prochain anniversaire ;
- les boutons **Ajouter aux courses** (un petit formulaire), **Synchroniser** et **Ouvrir
  Melimelo**.

## Dépannage

| Message                                | Que faire                                           |
| -------------------------------------- | --------------------------------------------------- |
| « Renseignez l'URL de l'API… »         | Remplissez l'URL et le jeton dans la configuration. |
| « Melimelo a refusé le jeton d'accès » | Créez un nouveau jeton et collez-le.                |
| « L'API Melimelo ne connaît pas… »     | Vérifiez l'URL de l'API.                            |
| « Melimelo est injoignable »           | Vérifiez l'URL et la connexion internet de Gladys.  |
| « Melimelo demande de ralentir »       | Augmentez l'intervalle de synchronisation.          |

Les logs de l'intégration se trouvent dans **Paramètres → Système** de Gladys (logs du
conteneur). Le jeton n'y apparaît jamais.

## Vie privée

L'intégration ne parle qu'à l'API Melimelo que vous avez configurée. Les données du foyer
restent dans Gladys. Seule une petite liste des déclencheurs déjà envoyés est gardée sur le
disque (`/data`), 45 jours au plus.
