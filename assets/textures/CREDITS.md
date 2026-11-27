# Ground textures

Ground looks come from [Poly Haven](https://polyhaven.com) (CC0: free to use, no credit required; shown in the app as
"Powered by Poly Haven"). Downloaded 2026-11-26 through the Poly Haven API at 1K JPG (diffuse, normal GL, roughness) and
recompressed for the web. Water and ice are not pictures: they are made in code (`apps/web/src/features/table/boardLooks.ts`).

| Folder | Poly Haven asset | Authors |
| --- | --- | --- |
| `surfaces/grass` | [Grass Ground](https://polyhaven.com/a/grass_ground) | Charlotte Baglioni |
| `surfaces/moss` | [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) | Rob Tuytel |
| `surfaces/dirt` | [Dirt](https://polyhaven.com/a/dirt) | Charlotte Baglioni |
| `surfaces/cobble` | [Cobblestone Floor 001](https://polyhaven.com/a/cobblestone_floor_001) | Rob Tuytel |
| `surfaces/flagstone` | [Stone Tiles 02](https://polyhaven.com/a/stone_tiles_02) | Charlotte Baglioni |
| `surfaces/rock` | [Rock Surface](https://polyhaven.com/a/rock_surface) | Amal Kumar |
| `surfaces/bricks` | [Red Brick 03](https://polyhaven.com/a/red_brick_03) | Rob Tuytel |
| `surfaces/snow` | [Snow 01](https://polyhaven.com/a/snow_01) | Rob Tuytel |
| `surfaces/bark` | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) | Rob Tuytel |
| `surfaces/woodfloor` | [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck) | Dimitrios Savva |
| `surfaces/roof` | [Roof Tiles 14](https://polyhaven.com/a/roof_tiles_14) | Rob Tuytel |
| `terrain/rough` | [Rocky Trail](https://polyhaven.com/a/rocky_trail) | Amal Kumar |
| `terrain/steep` | [Cliff Side](https://polyhaven.com/a/cliff_side) | James Ray Cock, Jenelle van Heerden, Dario Barresi |
| `wall` | [Castle Wall Slates](https://polyhaven.com/a/castle_wall_slates) | Rob Tuytel |

Older sets still from ambientCG (CC0), not ground: `felt`, `wood` (the table), `ice` (unused by the custom ice). Each
folder's `SOURCE.txt` says where its pictures came from.

# Sky light (HDRI)

Each mood's sky light is a [Poly Haven](https://polyhaven.com) HDRI (CC0), 2K HDR, used as environment lighting only (T5).
Downloaded 2026-11-26 through the Poly Haven API.

| Folder | Poly Haven asset | Authors |
| --- | --- | --- |
| `hdris/day` | [Kloofendal 43d Clear (Pure Sky)](https://polyhaven.com/a/kloofendal_43d_clear_puresky) | Greg Zaal |
| `hdris/dawn` | [Aarfontein Dawn](https://polyhaven.com/a/aarfontein_dawn) | Jarod Guest, Greg Zaal |
| `hdris/dusk` | [Belfast Sunset (Pure Sky)](https://polyhaven.com/a/belfast_sunset_puresky) | Greg Zaal, Dimitrios Savva, Jarod Guest |
| `hdris/night` | [Dikhololo Night](https://polyhaven.com/a/dikhololo_night) | Greg Zaal |
| `hdris/dungeon` | [Castle Zavelstein Cellar](https://polyhaven.com/a/castle_zavelstein_cellar) | Andreas Mischok |

# Models

Board models are [Poly Haven](https://polyhaven.com) CC0 glTF files, cleaned with `npm run model` (T6) to a few thousand triangles, 2K WebP textures, and a one-hex scale. Downloaded 2026-11-26 through the Poly Haven API.

| Folder | Poly Haven asset | Authors |
| --- | --- | --- |
| `models/boulder` | [Boulder 01](https://polyhaven.com/a/boulder_01) | Rico Cilliers |

# Library paints

Extra board-relevant ground looks from [Poly Haven](https://polyhaven.com) (CC0), 2K JPG (colour, normal GL, roughness) plus a 1K set and a swatch thumb. Downloaded through the Poly Haven API and written by `scripts/import-polyhaven.mjs`.

| Folder | Poly Haven asset | Authors |
| --- | --- | --- |
| `library/grass_path_2` | [Grass Path 2](https://polyhaven.com/a/grass_path_2) | Rob Tuytel |
| `library/sparse_grass` | [Sparse Grass](https://polyhaven.com/a/sparse_grass) | Amal Kumar |
| `library/withered_grass` | [Withered Grass](https://polyhaven.com/a/withered_grass) | Charlotte Baglioni |
| `library/leafy_grass` | [Leafy Grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni |
| `library/mossy_rock` | [Mossy Rock](https://polyhaven.com/a/mossy_rock) | Rob Tuytel |
| `library/mossy_stone_wall` | [Mossy Stone Wall](https://polyhaven.com/a/mossy_stone_wall) | Amal Kumar |
| `library/mossy_cobblestone` | [Mossy Cobblestone](https://polyhaven.com/a/mossy_cobblestone) | Sơn Nguyễn |
| `library/forest_ground_04` | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) | Rob Tuytel, Rico Cilliers |
| `library/forest_floor` | [Forest Floor](https://polyhaven.com/a/forest_floor) | eye-candy.xyz |
| `library/leaves_forest_ground` | [Leaves Forest Ground](https://polyhaven.com/a/leaves_forest_ground) | Dario Barresi, Dimitrios Savva |
| `library/dirt_floor` | [Dirt Floor](https://polyhaven.com/a/dirt_floor) | eye-candy.xyz |
| `library/raked_dirt` | [Raked Dirt](https://polyhaven.com/a/raked_dirt) | Dario Barresi, Dimitrios Savva |
| `library/stony_dirt_path` | [Stony Dirt Path](https://polyhaven.com/a/stony_dirt_path) | eye-candy.xyz |
| `library/brown_mud_03` | [Brown Mud 03](https://polyhaven.com/a/brown_mud_03) | Rob Tuytel |
| `library/muddy_tracks` | [Muddy Tracks](https://polyhaven.com/a/muddy_tracks) | Amal Kumar |
| `library/sand_03` | [Sand 03](https://polyhaven.com/a/sand_03) | Charlotte Baglioni |
| `library/damp_beach_sand` | [Damp Beach Sand](https://polyhaven.com/a/damp_beach_sand) | Dimitrios Savva |
| `library/red_sand` | [Red Sand](https://polyhaven.com/a/red_sand) | Rohit Seervi |
| `library/clean_pebbles` | [Clean Pebbles](https://polyhaven.com/a/clean_pebbles) | Dario Barresi, Charlotte Baglioni |
| `library/gravel_floor` | [Gravel Floor](https://polyhaven.com/a/gravel_floor) | Jenelle van Heerden, Matterfield |
| `library/rocks_ground_05` | [Rocks Ground 05](https://polyhaven.com/a/rocks_ground_05) | Rob Tuytel |
| `library/stone_tiles` | [Stone Tiles](https://polyhaven.com/a/stone_tiles) | Christopher Melani |
| `library/cobblestone_02` | [Cobblestone 02](https://polyhaven.com/a/cobblestone_02) | Amal Kumar |
| `library/patterned_cobblestone` | [Patterned Cobblestone](https://polyhaven.com/a/patterned_cobblestone) | Rob Tuytel |
| `library/square_cobblestone` | [Square Cobblestone](https://polyhaven.com/a/square_cobblestone) | Sơn Nguyễn |
| `library/stone_floor` | [Stone Floor](https://polyhaven.com/a/stone_floor) | Dimitrios Savva |
| `library/t_brick_floor_002` | [Brick Floor 002](https://polyhaven.com/a/t_brick_floor_002) | Dimitrios Savva, Rico Cilliers |
| `library/worn_brick_floor` | [Worn Brick Floor](https://polyhaven.com/a/worn_brick_floor) | Amal Kumar |
| `library/rock_face_03` | [Rock Face 03](https://polyhaven.com/a/rock_face_03) | Dario Barresi, Rico Cilliers |
| `library/rock_01` | [Rock 01](https://polyhaven.com/a/rock_01) | Rob Tuytel |
| `library/dry_riverbed_rock` | [Dry Riverbed Rock](https://polyhaven.com/a/dry_riverbed_rock) | Amal Kumar |
| `library/dark_rock` | [Dark Rock](https://polyhaven.com/a/dark_rock) | Amal Kumar |
| `library/snow_02` | [Snow 02](https://polyhaven.com/a/snow_02) | Rob Tuytel |
| `library/snow_03` | [Snow 03](https://polyhaven.com/a/snow_03) | Rob Tuytel |
| `library/wood_planks` | [Wood Planks](https://polyhaven.com/a/wood_planks) | Amal Kumar |
| `library/weathered_brown_planks` | [Weathered Brown Planks](https://polyhaven.com/a/weathered_brown_planks) | Dimitrios Savva, Rico Cilliers |
| `library/weathered_planks` | [Weathered Planks](https://polyhaven.com/a/weathered_planks) | Dario Barresi, Dimitrios Savva |
| `library/old_wood_floor` | [Old Wood Floor](https://polyhaven.com/a/old_wood_floor) | Guillaume Monsergent |
| `library/bark_brown_01` | [Bark Brown 01](https://polyhaven.com/a/bark_brown_01) | Rob Tuytel |
| `library/pine_bark` | [Pine Bark](https://polyhaven.com/a/pine_bark) | Dimitrios Savva |

# Library models

Board models from [Poly Haven](https://polyhaven.com) (CC0), cleaned with `npm run model` (high 2K + light 1K). Boulder 01 is listed under Models above. Downloaded through the Poly Haven API.

| Folder | Poly Haven asset | Authors |
| --- | --- | --- |
| `models/namaqualand_boulder_02` | [Namaqualand Boulder 02](https://polyhaven.com/a/namaqualand_boulder_02) | Greg Zaal, Rico Cilliers |
| `models/namaqualand_boulder_03` | [Namaqualand Boulder 03](https://polyhaven.com/a/namaqualand_boulder_03) | Jenelle van Heerden, Dario Barresi |
| `models/namaqualand_boulder_04` | [Namaqualand Boulder 04](https://polyhaven.com/a/namaqualand_boulder_04) | Jenelle van Heerden |
| `models/namaqualand_boulder_05` | [Namaqualand Boulder 05](https://polyhaven.com/a/namaqualand_boulder_05) | Jenelle van Heerden, Dario Barresi |
| `models/coast_rocks_05` | [Coast Rocks 05](https://polyhaven.com/a/coast_rocks_05) | Rob Tuytel |
| `models/sand_rocks_small_01` | [Sand Rocks Small 01](https://polyhaven.com/a/sand_rocks_small_01) | Rob Tuytel, Rico Cilliers |
| `models/rock_moss_set_01` | [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Kless Gyzen |
| `models/tree_small_02` | [Tree Small 02](https://polyhaven.com/a/tree_small_02) | Rico Cilliers |
| `models/fir_tree_01` | [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) | Rob Tuytel, Rico Cilliers |
| `models/pine_tree_01` | [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) | Rob Tuytel, Rico Cilliers |
| `models/island_tree_01` | [Island Tree 01](https://polyhaven.com/a/island_tree_01) | Rob Tuytel, Rico Cilliers |
| `models/jacaranda_tree` | [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree) | Rob Tuytel, Rico Cilliers |
| `models/fir_sapling` | [Fir Sapling](https://polyhaven.com/a/fir_sapling) | Rob Tuytel, Rico Cilliers |
| `models/dead_tree_trunk_02` | [Dead Tree Trunk 02](https://polyhaven.com/a/dead_tree_trunk_02) | Jenelle van Heerden, Rico Cilliers |
| `models/tree_stump_01` | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | Rob Tuytel |
| `models/searsia_lucida` | [Searsia Lucida](https://polyhaven.com/a/searsia_lucida) | James Ray Cock, Jenelle van Heerden |
| `models/fern_02` | [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers |
| `models/wild_rooibos_bush` | [Wild Rooibos Bush](https://polyhaven.com/a/wild_rooibos_bush) | James Ray Cock, Jenelle van Heerden |
| `models/shrub_02` | [Shrub 02](https://polyhaven.com/a/shrub_02) | Rico Cilliers |
| `models/shrub_03` | [Shrub 03](https://polyhaven.com/a/shrub_03) | Rico Cilliers |
| `models/nettle_plant` | [Nettle Plant](https://polyhaven.com/a/nettle_plant) | Rob Tuytel, Rico Cilliers |
| `models/celandine_01` | [Celandine 01](https://polyhaven.com/a/celandine_01) | Rob Tuytel, Rico Cilliers |
| `models/dandelion_01` | [Dandelion 01](https://polyhaven.com/a/dandelion_01) | Rob Tuytel, Rico Cilliers |
| `models/shrub_01` | [Shrub 01](https://polyhaven.com/a/shrub_01) | Rico Cilliers |
| `models/grass_medium_01` | [Grass Medium 01](https://polyhaven.com/a/grass_medium_01) | Rob Tuytel, Rico Cilliers |
| `models/moss_01` | [Moss 01](https://polyhaven.com/a/moss_01) | Rob Tuytel |
| `models/dry_branches_medium_01` | [Dry Branches Medium 01](https://polyhaven.com/a/dry_branches_medium_01) | Rico Cilliers |

