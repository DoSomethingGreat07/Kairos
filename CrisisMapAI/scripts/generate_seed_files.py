from __future__ import annotations

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.operations.seed_factory import build_seed_bundle


def main() -> None:
    seed_dir = ROOT / "data" / "seed"
    seed_dir.mkdir(parents=True, exist_ok=True)
    for file_name, rows in build_seed_bundle().items():
        path = seed_dir / file_name
        path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        print(f"Wrote {len(rows):>3} rows to {path}")


if __name__ == "__main__":
    main()
