# The table — spec (owner, 2026-11-22)

Stage 2, step 8. The rules of the 2D hex table: what each person can do, and the **intent** that asks the server to do it.
Written from Gabriel's answers on 2026-11-22. Anything not decided yet is under **Open**; don't fill it in, ask.

## How the table talks to the server

- The **server is authoritative** for movement, vision, rolls and every rule. A client never changes the table itself:
  it sends an **intent** (a request, like `token.move`), the server checks who's asking and whether it's allowed,
  saves what needs saving, then tells everyone in the campaign what happened (an **event**).
- A refused intent changes nothing; the sender gets the reason ("That token isn't yours").
- Intent names are `thing.verb`. Every intent below lists **who can send it**.
- Grid: **hex, flat-top, 5 ft per hex** (hard rule). Positions are hex coordinates; the hex math lives in `@tenebris/rules` (step 10).
- **Saved** = stored in the database, so a reload shows it again (Gate 2: "a DM prepares a scene with party tokens, reloads, nothing is lost").
  **Not saved** = only sent to whoever's in the campaign right now.

## Who's who

- **DM**: the campaign's DM. Can do everything on the table.
- **Player**: a member of the campaign.
- **Owner** (of a token or overlay): the player it belongs to. A token's owner is set by the DM; an overlay's owner is whoever placed it.

## Scenes and maps

| Intent | Who | What it does | Saved |
|---|---|---|---|
| `map.upload` | DM | Upload a map picture to **their campaign** (PNG, JPG or WebP) | yes |
| `map.remove` | DM | Delete one of the campaign's maps | yes |
| `scene.create` | DM | A new scene, on one of the campaign's maps | yes |
| `scene.update` | DM | Name, map, map position and scale under the hexes | yes |
| `scene.remove` | DM | Delete a scene (its tokens and overlays go with it) | yes |
| `scene.activate` | DM | The scene everyone's table shows | yes |
| `terrain.paint` | DM | Paint hexes (terrain, walls); step 12 | yes |

- Maps belong to a campaign; any DM can upload to the campaigns they run.
- Players see the active scene only.

## Tokens

| Intent | Who | What it does | Saved |
|---|---|---|---|
| `token.place` | DM | Put a token on the scene: a character, a monster, or a summon/pet; **sets its owner** (a player, or none) | yes |
| `token.move` | the token's **owner**, or the DM | Move it to a hex. The server checks the path (walls, step 13) | yes |
| `token.update` | DM | Owner, name, picture, size | yes |
| `token.remove` | DM | Take it off the scene | yes |

- **Summons and pets:** for Stage 2 the **DM places them and picks the owner**; the owner then moves them like their own token.
  (Stage 3 may let a summon ability place one by itself: that's just the server sending `token.place` for the player.)
- A player's character token is owned by that player.
- **Only the DM moves tokens that aren't theirs.**

## Measuring

| Intent | Who | What it does | Saved |
|---|---|---|---|
| `measure.update` | anyone | Start or change a measurement (from hex, to hex) | no |
| `measure.clear` | whoever is measuring | Stop measuring | no |

- **Everyone sees** everyone's measurements, live. Nothing is saved: a reload shows none.
- The server works out the distance (hex math), so every screen shows the same number.

## Overlays (spell areas and other shapes)

| Intent | Who | What it does | Saved |
|---|---|---|---|
| `overlay.add` | **anyone** | Place a shape on the scene, with an optional turn counter | yes |
| `overlay.update` | the overlay's **owner** (whoever placed it), or the DM | Move, resize, change it or its counter | yes |
| `overlay.remove` | the overlay's **owner**, or the DM | Take it off | yes |

- Everyone sees overlays, and they **stay until removed** or their counter runs out.
- **Turn counter** (optional; none = it stays until someone removes it):
  - It counts the **turn ends of the creature it belongs to**: a player's overlay counts their character's turns.
    "3 turns" = it disappears when that character's turn has ended 3 times.
    Placed during that character's own turn, the end of that turn is the first of the three.
  - An overlay the **DM** places: the DM picks which creature's turns it counts (usually the caster, such as a monster).
    No creature picked = no counting; it stays until removed.
  - **No fight running** (no initiative): the counter waits. It only counts while turns are going.
  - The **server** counts: when initiative moves past that creature's turn, it lowers the counter, and at 0 it removes the overlay
    and tells everyone. Clients never count.
- **Ending one early** (dispelled, interrupted, placed by mistake): the DM can always `overlay.remove` any overlay.
  When the DM removes someone else's, the table's feed says so ("DM removed Fog Cloud"), so the player knows it was on purpose.

## Later (decided, not built in Stage 2)

- **Line of sight** (Stage 3, step 18): a toggle so rolls, measurements and the like are shown only to those who can see them.
  The server already owns vision, so it decides who gets each event. Build measuring and the feed so they can be filtered per player later.

## Open (Gabriel decides)

- **Where uploaded maps are stored.** Not on Render's disk (it's wiped on every deploy): object storage such as Cloudflare R2 or Neon storage.
  Also: largest file size, and whether pictures are converted to WebP on upload.
- Overlay shapes for v1 (circle, cone, line, square?) and whether they snap to hexes.
- Whether players can see a token's exact HP on the table (the sheet rule says players see only a health word for monsters).
