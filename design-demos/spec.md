# Fleet Monitor — design spec for three directions

Fleet Monitor is a dispatcher console for a 20-vehicle fleet in Almaty. The working product is a React app with three equal pages: a live Leaflet map, an events table, and a stats dashboard. Dispatchers lose the map when they read an event. Markers are identical dots. A critical event is a toast that vanishes. The socket already knows when the stream drops, and the UI never says so.

This prototype is one afternoon snapshot, 14:32, not a live socket. Say that on screen: «снимок смены · 14:32». Eight vehicles are on the road. Twelve are at the depot with no signal this hour. Do not invent positions for the twelve.

## People and places

Audience: one dispatcher at a desk, 1 m from a laptop, watching for the next thing that needs a person. Tone: calm, precise, slightly tense. Not a marketing site. Not a game. Safety product: the screen should feel predictable.

City is the visual motif. Almaty, late day, asphalt, a tail light. Do not use the current app blue `#2563eb`, purple gradients, emoji icons, or cards with a colored left border.

Copy is Russian. Body text at least 14px. Labels at least 12px. Contrast at least 4.5:1. System font (`system-ui`), because this direction follows Apple's type. Large numbers use negative tracking. Buttons respond on press (`transform: scale(0.97)`). Honor `prefers-reduced-motion: reduce` by dropping movement and keeping opacity.

There is no logo. Set the name in type: «Монитор».

## The same eight vehicles in every version

| device | driver | plate | state | speed | heading | note |
|---|---|---|---|---|---|---|
| ALM-006 | Алина Жексен | KZ 105 AAF 02 | online | 28 | 312 | CRITICAL, опасность столкновения, 14:32 |
| ALM-001 | Айбек Нуртаев | KZ 100 AAA 02 | online | 62 | 84 | CRITICAL, превышение, сгруппировано ×3, 14:28 |
| ALM-002 | Диана Сарсенова | KZ 101 AAB 02 | online | 41 | 190 | MEDIUM, резкое торможение, 14:19 |
| ALM-003 | Руслан Омаров | KZ 102 AAC 02 | online, idle | 0 | 0 | LOW, сонливость, 13:58 |
| ALM-005 | Ерлан Мукашев | KZ 104 AAE 02 | online | 55 | 20 | нет событий |
| ALM-007 | Нурсултан Есдаулет | KZ 106 AAG 02 | online | 12 | 140 | нет событий |
| ALM-004 | Нурайым Бекова | KZ 103 AAD 02 | offline 18 мин | — | — | последняя точка есть, маркер приглушён |
| ALM-008 | Самал Абилова | KZ 107 AAH 02 | offline 2 мин | — | — | связь только что пропала |

Positions, Almaty, only for vehicles that have a last point:

- ALM-006: 43.238, 76.945 (center, critical now)
- ALM-001: 43.256, 76.910
- ALM-002: 43.222, 76.960
- ALM-003: 43.245, 76.970 (idle)
- ALM-005: 43.230, 76.900
- ALM-007: 43.215, 76.930
- ALM-004: 43.260, 76.980 (stale)
- ALM-008: 43.228, 76.990 (stale)

Counts that are allowed because they fall out of this table: 6 в сети, 2 без связи, 12 в депо, 2 критических, 4 события за час. Do not add any other statistic.

## Behavior the prototype must actually do

- Select a vehicle from the list and from the map. Selection is the same object.
- Filter: все / внимание / в сети / без связи. «Внимание» means the two critical vehicles plus the one that just went offline (Самал).
- Dismiss the critical notice. It stays dismissed.
- Escape clears the selection.
- Pressed controls scale down immediately.
- Status is a word, not a pile of badges: «смотри сейчас», «едет», «стоит», «нет связи».
- Show `×3` on Aibek's speeding event.
- Show heading as direction, not only a number.
- Chrome includes «поток: снимок», so nobody thinks this file is the live socket.

Do not invent acknowledge, calling the driver, geofences, or a trail. The API has no ack, no phone, no geofence, and GPS history is stored but not exposed.

## Output

One self-contained HTML file. Viewport 1440×900. The main decision fits without scrolling the page. A list may scroll inside itself. No external CSS framework. Leaflet from a CDN is allowed if the direction is a real map. OSM attribution stays visible. If tiles fail, do not draw a fake city; say the map did not load.
