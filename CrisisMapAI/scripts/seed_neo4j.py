from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db.operational_store import load_seed_file
from backend.app.graph.neo4j_client import Neo4jClient


def _seed_zones(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "zones_seed.json")
    normalized = [{
        "id": row["id"],
        "name": row["name"],
        "polygon_points_json": json.dumps(row.get("polygon_points", [])),
    } for row in rows]
    client.execute_query(
        """
        UNWIND $rows AS row
        MERGE (z:Zone {id: row.id})
        SET z.name = row.name,
            z.polygon_points_json = row.polygon_points_json,
            z.created_at = datetime()
        """,
        {"rows": normalized},
    )


def _seed_roads(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "roads_seed.json")
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (a:Zone {id: row.source_zone}), (b:Zone {id: row.target_zone})
        MERGE (a)-[r:CONNECTED_TO {road_id: row.road_id}]->(b)
        SET r.travel_time = row.travel_time,
            r.safe = row.safe,
            r.congestion = row.congestion,
            r.has_oxygen = row.has_oxygen,
            r.distance_km = row.distance_km,
            r.capacity = row.capacity,
            r.passable = row.passable,
            r.blocked = row.blocked
        """,
        {"rows": rows},
    )


def _seed_reference_nodes(client: Neo4jClient, seed_dir: Path, file_name: str, label: str, zone_rel: str, property_map: str) -> None:
    rows = load_seed_file(seed_dir / file_name)
    client.execute_query(
        f"""
        UNWIND $rows AS row
        MATCH (z:Zone {{id: row.zone_id}})
        MERGE (n:{label} {{id: row.id}})
        SET n += apoc.map.fromPairs({property_map})
        MERGE (n)-[:{zone_rel}]->(z)
        """,
        {"rows": rows},
    )


def _seed_responders(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "responders_seed.json")
    normalized = [{
        "id": row["responder_id"],
        "full_name": row["full_name"],
        "role_title": row["role_title"],
        "zone_id": row["primary_station_zone_id"],
        "available": row["profile_data"].get("available", row.get("availability_status") == "available_now"),
        "skills": row["profile_data"].get("skills", row.get("active_capabilities", [])),
        "has_equipment": row["profile_data"].get("has_equipment", True),
    } for row in rows]
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (z:Zone {id: row.zone_id})
        MERGE (r:Responder {id: row.id})
        SET r.name = row.full_name,
            r.role_title = row.role_title,
            r.available = row.available,
            r.skills = row.skills,
            r.has_equipment = row.has_equipment
        MERGE (r)-[:LOCATED_IN]->(z)
        """,
        {"rows": normalized},
    )


def _seed_hospitals(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "hospitals_seed.json")
    normalized = [{"id": row["hospital_id"], **row} for row in rows]
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (z:Zone {id: row.zone_id})
        MERGE (h:Hospital {id: row.id})
        SET h.name = row.name,
            h.available_beds = row.available_beds,
            h.total_beds = row.total_beds,
            h.latitude = row.latitude,
            h.longitude = row.longitude
        MERGE (h)-[:SERVES]->(z)
        """,
        {"rows": normalized},
    )


def _seed_shelters(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "shelters_seed.json")
    normalized = [{"id": row["shelter_id"], **row} for row in rows]
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (z:Zone {id: row.zone_id})
        MERGE (s:Shelter {id: row.id})
        SET s.name = row.name,
            s.capacity = row.capacity,
            s.occupancy = row.occupancy,
            s.demand = row.demand,
            s.latitude = row.latitude,
            s.longitude = row.longitude
        MERGE (s)-[:LOCATED_IN]->(z)
        """,
        {"rows": normalized},
    )


def _seed_depots(client: Neo4jClient, seed_dir: Path) -> None:
    rows = load_seed_file(seed_dir / "depots_seed.json")
    normalized = [{"id": row["depot_id"], **row} for row in rows]
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (z:Zone {id: row.zone_id})
        MERGE (d:Depot {id: row.id})
        SET d.name = row.name,
            d.supply = row.supply,
            d.latitude = row.latitude,
            d.longitude = row.longitude
        MERGE (d)-[:LOCATED_IN]->(z)
        """,
        {"rows": normalized},
    )
    shelter_rows = load_seed_file(seed_dir / "shelters_seed.json")
    shelter_lookup = {row["shelter_id"]: row for row in shelter_rows}
    rel_rows = []
    for depot in rows:
        for shelter_id in depot.get("assigned_shelters", []):
            if shelter_id in shelter_lookup:
                rel_rows.append({
                    "depot_id": depot["depot_id"],
                    "shelter_id": shelter_id,
                    "planned_supply": max(1, depot["supply"] // max(1, len(depot.get("assigned_shelters", [])))),
                })
    client.execute_query(
        """
        UNWIND $rows AS row
        MATCH (d:Depot {id: row.depot_id}), (s:Shelter {id: row.shelter_id})
        MERGE (d)-[r:SUPPLIES]->(s)
        SET r.planned_supply = row.planned_supply
        """,
        {"rows": rel_rows},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk seed CrisisMap AI graph data into Neo4j.")
    parser.add_argument("--seed-dir", default="data/seed", help="Directory containing JSON or CSV seed files.")
    parser.add_argument("--reset", action="store_true", help="Delete existing graph nodes before seeding.")
    args = parser.parse_args()

    seed_dir = Path(args.seed_dir)
    client = Neo4jClient()
    if args.reset:
        client.execute_query("MATCH (n) DETACH DELETE n")

    _seed_zones(client, seed_dir)
    _seed_roads(client, seed_dir)
    _seed_responders(client, seed_dir)
    _seed_hospitals(client, seed_dir)
    _seed_shelters(client, seed_dir)
    _seed_depots(client, seed_dir)
    print("Neo4j bulk seed complete.")


if __name__ == "__main__":
    main()
