from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db.operational_store import OperationalRepository
from backend.app.graph.neo4j_client import Neo4jClient


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset CrisisMap AI operational data in Postgres and Neo4j.")
    parser.add_argument("--postgres-only", action="store_true")
    parser.add_argument("--neo4j-only", action="store_true")
    args = parser.parse_args()

    if not args.neo4j_only:
        repository = OperationalRepository()
        repository.ensure_schema()
        repository.truncate_operational_data()
        print("PostgreSQL operational tables truncated.")

    if not args.postgres_only:
        client = Neo4jClient()
        client.execute_query("MATCH (n) DETACH DELETE n")
        print("Neo4j graph cleared.")


if __name__ == "__main__":
    main()
