# Selectively recovered game data

These seven small examples came from the mirrored p3553 containers. They show data that can be recovered separately from the minified web application:

| Source entry | Export | What it describes |
| --- | --- | --- |
| `DataPack1:etc_/driftSkillConfig.xml` | `DataPack1/etc_/driftSkillConfig.xml` | Drift skill timing and thresholds |
| `DataPack2:kart_/drift/param.xml` | `DataPack2/kart_/drift/param.xml` | Kart body and drift parameters |
| `DataPack2:kart_/mancarXUN/param.xml` | `DataPack2/kart_/mancarXUN/param.xml` | One kart's body parameters |
| `DataPack3:track_/ice_S02/track.xml` | `DataPack3/track_/ice_S02/track.xml` | One track's metadata |
| `dialog2_selectTrackEx.rho:selectTrackEx@zz.bml` | `dialog2_selectTrackEx.rho/selectTrackEx@zz.bml.xml` | Track selection UI layout |
| `zeta_cn_ppl.rho:ppl.bml` | `zeta_cn_ppl.rho/ppl.bml.xml` | Binary XML UI/configuration tree |
| `stage_.rho:stageClassNameList.bml` | `stage_.rho/stageClassNameList.bml.xml` | Stage class mapping from binary XML |

Run `node recovered/tools/extract-resource.mjs list driftSkillConfig` to find indexed entries. Run `node recovered/tools/extract-resource.mjs extract 'DataPack1:etc_/driftSkillConfig.xml'` to export one. `extract-raw` preserves the original decoded bytes under `recovered/data/_raw/` if needed for other file formats.

The extractor checks the selected container's indexed size and each decoded entry's length. For Rho5 it also verifies the payload MD5; for Rho blocks carrying a checksum it verifies Adler-32. Existing exported files must match byte-for-byte before the tool reports `verified`. The original XML and binary XML were converted to UTF-8; `.bml` files were serialized as `.bml.xml`. All seven exported XML files parse successfully with Python's `xml.etree.ElementTree`.

These are game assets and configuration, not the application's original JavaScript or TypeScript project files.
