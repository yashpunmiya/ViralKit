# ViralKit brand tokens

## Direction

Premium infrastructure for builders. A light, warm-neutral canvas, crisp white surfaces, deep green type, and one measured olive-lime signal. The interface should feel clear and trustworthy, with contract-backed data presented plainly. Dark mode remains available as a secondary theme.

## Color

| Token        | Light default | Dark alternative | Use                                   |
| ------------ | ------------- | ---------------- | ------------------------------------- |
| Canvas       | `#F7F8F5`     | `#10110F`        | Page background                       |
| Surface      | `#FFFFFF`     | `#171815`        | Cards and panels                      |
| Raised       | `#F3F5F1`     | `#1D1E1A`        | Inputs and elevated surfaces          |
| Ink          | `#18211B`     | `#F3F3EC`        | Primary text                          |
| Muted        | `#4F5B53`     | `#A4A59B`        | Secondary text                        |
| Line         | `#DCE3DC`     | `#30312B`        | Borders and dividers                  |
| Signal olive | `#506E12`     | `#C6F36B`        | Primary actions, positive chain state |

## Type

- Display and body: Manrope, self-hosted through `next/font`.
- Technical data: IBM Plex Mono, self-hosted through `next/font`.
- Use compact tracking for large headings; keep body copy relaxed and readable.

## Shape and motion

- Rounded corners: 10–16px for cards, 8–10px for controls.
- Use subtle borders and low-contrast surface changes instead of heavy shadows.
- Hover motion is limited to small lifts and color changes. Honor reduced-motion preferences.

## Product rules

- Label chain balances and transactions as Monad Testnet.
- Only show values read from contracts or Envio; use explicit empty states otherwise.
- Keep sample integrations in `/examples` and identify their sample context.
