# Embedded vehicle data

These files are extracted from the downloaded KartSim v39.11 JavaScript bundle. They are recovered runtime data, not copies of the author's original source files. `manifest.json` records the exact bundle hash, JavaScript string offsets, output hashes, row counts, and provenance labels found in each table.

Run `node recovered/embedded-data/extract.mjs` from the workspace root to regenerate the files. The script uses only Node.js built-ins and refuses a bundle whose SHA-256 differs from the inspected version.

| File | Original bundle symbol | Contents |
| --- | --- | --- |
| `vehicle-physics-h10.csv` | `h10` | 91 columns, 2,374 vehicle and speed rows, all marked `cn-server-capture` |
| `vehicle-physics-d10.csv` | `d10` | 91 columns, 3,276 rows with six provenance labels from local and launcher sources |
| `vehicle-physics-overrides.mjs` | `hn`, `jI`, `XI` | Original `Map` initializer and five following `hn.set(...)` calls; 436 final keys |

The CSV files contain the template literal text verbatim, including the final newline. The override module copies the initializer and mutations verbatim, adding only a declaration prefix and export. Use `import { vehiclePhysicsOverrides } from './vehicle-physics-overrides.mjs'` to read its final values.
