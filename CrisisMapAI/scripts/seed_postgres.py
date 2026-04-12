from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db.operational_store import OperationalRepository


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk seed CrisisMap AI operational data into PostgreSQL.")
    parser.add_argument("--seed-dir", default="data/seed", help="Directory containing JSON or CSV seed files.")
    parser.add_argument("--reset", action="store_true", help="Truncate operational and execution tables before seeding.")
    args = parser.parse_args()

    repository = OperationalRepository()
    repository.ensure_schema()
    if args.reset:
        repository.truncate_operational_data()
        repository.ensure_schema()

    counts = repository.seed_batch_from_directory(Path(args.seed_dir))
    for file_name, row_count in counts.items():
        print(f"{file_name}: {row_count} rows")


if __name__ == "__main__":
    main()
