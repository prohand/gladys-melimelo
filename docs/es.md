# Melimelo para Gladys

Esta integración conecta su hogar [Melimelo](https://melimelo.co) — la app para organizar la
familia — con Gladys Assistant. Gladys ve sus tareas, la lista de la compra, los días de
recogida de basura, los cumpleaños y la agenda del hogar, y puede usarlos en escenas y en el
panel.

Funciona **a través de la nube**: Gladys lee la API de Melimelo por internet. No se instala
nada en su red.

Requiere **Gladys 5.3.0 o posterior**.

## Qué necesita

- **La URL de la API de Melimelo** (una dirección `https://…`);
- **Un token de acceso personal** de su hogar.

Ambos los proporciona Melimelo. Hoy, Melimelo todavía no publica una API pública: mientras
tanto, la integración no puede conectarse. Está lista para funcionar en cuanto Melimelo abra
ese acceso.

## Instalación

1. En Gladys, abra **Integraciones**, busque **Melimelo** e instálela.
2. En la pantalla **Configuración** de la integración:
   - pegue la **URL de la API de Melimelo**;
   - pegue el **token de acceso** (se guarda como secreto);
   - si lo necesita, ajuste los parámetros de abajo.
3. Pulse **Probar la conexión**: el mensaje indica el hogar encontrado y cuenta sus tareas y
   artículos.
4. Abra **Descubrimiento**: aparece el dispositivo **Melimelo – <nombre del hogar>**. Añádalo
   para seguir sus valores en Gladys.

## Parámetros

| Parámetro                   | Por defecto    | Para qué sirve                                             |
| --------------------------- | -------------- | ---------------------------------------------------------- |
| URL de la API de Melimelo   | —              | Dirección de la API. Solo se acepta `https`.               |
| Token de acceso             | —              | Token personal del hogar. Nunca se muestra ni se registra. |
| Intervalo de sincronización | 300 s          | Con qué frecuencia se lee Melimelo (60 a 3600 s).          |
| Hora del aviso de basura    | 19             | Hora (0-23) a partir de la que se activa «basura mañana».  |
| Aviso de eventos            | 15 min         | Antelación de «evento a punto de empezar» (5 a 240 min).   |
| Zona horaria                | `Europe/Paris` | Indica qué son «hoy» y «mañana».                           |

## El dispositivo «Hogar»

Un dispositivo de solo lectura por hogar:

| Valor                              | Ejemplo             |
| ---------------------------------- | ------------------- |
| Tareas pendientes                  | 4                   |
| Tareas atrasadas                   | 1                   |
| Artículos en la lista de la compra | 7                   |
| Eventos de hoy                     | 2                   |
| Días hasta la próxima recogida     | 1                   |
| Próxima recogida                   | Contenedor amarillo |
| Días hasta el próximo cumpleaños   | 9                   |
| Próximo cumpleaños                 | Abuela (80)         |

Úselos en las condiciones de escena, p. ej. «si hay tareas atrasadas, enviar un mensaje».

## Escenas

### Disparadores

| Clave                         | Cuándo                                                                 | Variables                                    |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `task_due`                    | Una tarea pendiente vence hoy                                          | `title`, `assignee`, `due_date`              |
| `garbage_collection_tomorrow` | El día antes de una recogida, desde la hora de aviso (filtro por tipo) | `type`, `label`, `date`                      |
| `birthday_today`              | El día de un cumpleaños                                                | `name`, `age`                                |
| `shopping_item_added`         | Un miembro del hogar añade un artículo (nunca Gladys)                  | `item`, `quantity`, `added_by`               |
| `event_starting_soon`         | Un evento de la agenda empieza pronto (salvo eventos de todo el día)   | `title`, `start_time`, `location`, `minutes` |

Cada disparador se activa **solo una vez** por tarea, recogida, cumpleaños o evento, incluso
si la integración se reinicia. Use las variables en las acciones siguientes, p. ej.
`{{triggerEvent.data.title}}`.

Los disparadores se comprueban en cada sincronización: con un intervalo de 300 s, un evento
puede anunciarse hasta 5 minutos más tarde que el aviso elegido.

### Acciones

| Clave               | Para qué sirve                                     | Resultado                          |
| ------------------- | -------------------------------------------------- | ---------------------------------- |
| `add_shopping_item` | Añade un artículo a la lista de la compra          | `added`                            |
| `create_task`       | Crea una tarea (vencimiento `AAAA-MM-DD` opcional) | `task_id`                          |
| `complete_task`     | Completa la tarea pendiente con este título        | `completed` (`false` si no existe) |
| `sync_now`          | Lee Melimelo de inmediato                          | `tasks_open`, `shopping_items`     |

Ejemplo: «Cuando el sensor de la nevera vea la puerta abierta más de 2 minutos, añadir
"Revisar la nevera" a las tareas».

## Panel

El widget **Hogar Melimelo** muestra:

- el número de tareas, de artículos por comprar y de eventos de hoy;
- una lista a elegir (parámetro del widget): tareas, compra, agenda o recogida de basura;
- la conexión, la hora de la última sincronización, la próxima recogida y el próximo
  cumpleaños;
- los botones **Añadir a la compra** (un pequeño formulario), **Sincronizar** y **Abrir
  Melimelo**.

## Solución de problemas

| Mensaje                                       | Qué hacer                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| «Introduzca la URL de la API de Melimelo…»    | Rellene la URL y el token en la configuración.       |
| «Melimelo ha rechazado el token de acceso»    | Cree un nuevo token y péguelo.                       |
| «La API de Melimelo no conoce esta dirección» | Compruebe la URL de la API.                          |
| «No se puede contactar con Melimelo»          | Compruebe la URL y la conexión a internet de Gladys. |
| «Melimelo pide ir más despacio»               | Aumente el intervalo de sincronización.              |

Los registros de la integración están en Gladys, en **Ajustes → Sistema** (registros del
contenedor). El token nunca aparece en ellos.

## Privacidad

La integración solo habla con la API de Melimelo que ha configurado. Los datos del hogar se
quedan en Gladys. Solo se guarda en el disco (`/data`) una breve lista de los disparadores ya
enviados, 45 días como máximo.
