# Full text configuration export

`node recovered/tools/extract-resource.mjs extract-all-text` selectively exported every `.xml` and `.bml` entry indexed in the downloaded p3553 containers into this directory. BML is binary XML and appears as `.bml.xml`. The original XML payloads were converted to UTF-8, their encoding declarations were updated, and stray whitespace before an XML declaration was removed in two files so XML parsers can read them.

Results for this archive revision: **11,219 files** (5,513 XML and 5,706 BML), **54,379,755 decoded source bytes**, **30,947,912 UTF-8 export bytes**, **0 extraction failures**, and **0 case-insensitive path collisions**. Every exported file parsed with Python's `xml.etree.ElementTree`. The latest run's extracted/verified split is in `_report.json`; it may change when the command is rerun, while the selected and byte totals remain the same.

Images, audio, meshes, and other binary asset formats were left in the original `mirror/p3553/` containers. This directory contains configuration and layout data, not the original application source project.
