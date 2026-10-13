# Direction approved

User choice (verbatim), 2026-10-13:

> берем @FleetMonitor/design-demos/01-gallery-dark.html

Shown before the choice:

- `design-demos/01-gallery-dark.html` — Gallery Dark / «Плёнка» — `design-demos/shots/01-gallery-dark.png`
- `design-demos/02-departure-board.html` — `design-demos/shots/02-departure-board.png`
- `design-demos/03-decision-desk.html` — `design-demos/shots/03-decision-desk.png`

Chosen direction: 01, the filmstrip. Implemented in the React app. Directions 02 and 03 stay as drafts only.

Live translation, decided with the choice:

- One workplace. `/map` is the full-bleed film. Журнал and сводка stay, in the same dark bar, as the audit and the summary.
- Counts are в сети / без связи / критических. No depot count. The prototype’s «12 в депо» was only vehicles without a position in the fake snapshot.
- Connection copy comes from the socket: «поток: живой» or «поток: нет связи».
- Attention is a latest CRITICAL event, or offline with `lastSeen` within 5 minutes. Never-seen is not attention.
- «Скрыть» stores the event id for the session. A newer critical event shows again. There is no acknowledge API.
- Film order: critical (newest first), recent offline, moving, standing, long offline.
