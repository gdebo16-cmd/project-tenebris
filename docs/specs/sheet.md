# Sheets — spec (owner, 2026-11-19)

Mockup: https://claude.ai/artifact/KUhgTCxF2iH2ADEhBQrKHR (Character · Monster · DM)

## Idea

One set of small **blocks**, assembled into different **layouts**. Every block reads one shared "creature" shape (TypeScript type); adapters turn a character or a monster into it (`characterToCreature`, `monsterToCreature`). A new layout = a different list of blocks.

## Blocks

| Block | Shows | Used in |
|---|---|---|
| SheetHeader | portrait / art, name, species · role · level (monster: type, threat, XP), role rune | Character, Monster |
| HealthBlock | HP / max, temp HP (ward), bar; Damage / Heal / Ward with an amount when editable | Character, Monster |
| CoreStatsBlock | armor, speed, initiative (tap to roll), proficiency (monster: threat, XP) | Character, Monster |
| StatsBlock | the 8 stats with modifier; tap to roll a check (server rolls) | Character, Monster |
| ConditionsBlock | condition chips; toggle when editable | Character, Monster |
| ActionsBlock | attacks with to-hit and damage buttons | Character, Monster |
| SpellsBlock | slots + spells with Cast | Character |
| InventoryBlock | money, equipped gear, items | Character |
| FeaturesBlock | role / calling / species / gift features (monster: features) | Character, Monster |
| TraitsBlock | resistances, weaknesses, senses | Monster |
| RollFeed | recent rolls | Character, Monster, DM |
| PartyBlock | each player: portrait, rune, HP bar, armor, conditions, quick ±, open sheet | DM |
| EncounterBlock | monsters in the fight: HP bar, health word, quick ±, open sheet, add monster | DM |
| InitiativeBlock | turn order, current turn highlighted, Next turn, round counter | DM |
| DmNotesBlock | private notes | DM |

## Layouts

- **Character sheet** — phone-first: header, health, core stats, stats, conditions, then tabs (Actions · Spells · Gear · Features), roll feed.
- **Monster sheet** — phone-first: same blocks plus Traits; no Spells/Inventory tabs.
- **DM sheet** — laptop/tablet page, stacks on phones: Initiative, Notes, table Rolls on one side; Party and Encounter on the other. Contents not final — owner wants all of the above for now.

## Permissions (locked)

- **DM can edit everything.**
- **Players can edit only their own sheet**; other players' sheets are read-only.
- Players looking at a monster see a **limited view**: name, type, a health word (Unhurt / Wounded / Bloodied / Near death / Down) and visible conditions. Exact HP, stats and actions stay DM-only.

## Notes

- All rolls happen on the server; the mockup rolls in the browser only for show.
- Sample character values are placeholders; Ash Hound uses the real content-pack monster. Its art (`ash_hound.png`) is missing in both repos.
