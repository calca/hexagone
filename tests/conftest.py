"""Rende importabili i moduli in scripts/ (non e' un package installato:
gli script si importano a vicenda assumendo di girare da cwd=repo root,
come fa scripts/pipeline.py)."""
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
