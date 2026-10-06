"""Locate a privately held APK without recording a machine-specific path."""

import json
import os
from pathlib import Path


def apk_from_summary(summary_path: Path) -> Path:
    """Use KARTSIM_APK, or look for the recorded filename in Downloads."""
    configured = os.environ.get("KARTSIM_APK")
    if configured:
        apk = Path(configured).expanduser()
    else:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        apk = Path.home() / "Downloads" / Path(summary["apk"]).name
    if not apk.is_file():
        raise FileNotFoundError("APK not found; set KARTSIM_APK to its local path")
    return apk
