from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.assignment.responder_assignment import ResponderAssignment
from backend.app.assignment.volunteer_matching import VolunteerMatching
from backend.app.db.operational_store import OperationalRepository, load_seed_file
from backend.app.graph.neo4j_client import Neo4jClient
from backend.app.logistics.supply_distribution import SupplyDistribution
from backend.app.routing.dijkstra_router import DijkstraRouter
from backend.app.routing.yen_router import YenRouter
from backend.app.triage.bayesian_severity import BayesianSeverityInference
from backend.app.triage.priority_queue import PriorityQueue


def _print_counts(repository: OperationalRepository) -> None:
    checks = {
        "sos_incidents": "sos_id",
        "responders": "responder_id",
        "volunteers": "volunteer_id",
        "hospitals": "hospital_id",
        "shelters": "shelter_id",
        "depots": "depot_id",
        "tasks": "task_id",
        "zone_history_priors": "zone_id",
        "road_edges": "road_id",
        "zone_definitions": "id",
    }
    for table_name, id_column in checks.items():
        result = repository.get_table_count(table_name, id_column)
        print(f"Postgres {table_name}: rows={result['row_count']} distinct_ids={result['distinct_ids']}")


def _print_neo4j_counts(client: Neo4jClient) -> None:
    queries = {
        "zones": "MATCH (n:Zone) RETURN COUNT(n) AS count",
        "responders": "MATCH (n:Responder) RETURN COUNT(n) AS count",
        "hospitals": "MATCH (n:Hospital) RETURN COUNT(n) AS count",
        "shelters": "MATCH (n:Shelter) RETURN COUNT(n) AS count",
        "depots": "MATCH (n:Depot) RETURN COUNT(n) AS count",
        "roads": "MATCH ()-[r:CONNECTED_TO]->() RETURN COUNT(r) AS count",
    }
    for label, query in queries.items():
        result = client.execute_query(query)
        count = result[0]["count"] if result else 0
        print(f"Neo4j {label}: {count}")


def _run_algorithm_checks(seed_dir: Path) -> None:
    sos_rows = load_seed_file(seed_dir / "sos_seed.json")
    responders = load_seed_file(seed_dir / "responders_seed.json")
    volunteers = load_seed_file(seed_dir / "volunteers_seed.json")
    tasks = load_seed_file(seed_dir / "tasks_seed.json")
    roads = load_seed_file(seed_dir / "roads_seed.json")
    shelters = load_seed_file(seed_dir / "shelters_seed.json")
    depots = load_seed_file(seed_dir / "depots_seed.json")
    priors = load_seed_file(seed_dir / "zone_history_seed.json")

    route_sos = next((row for row in sos_rows if not row["needs_oxygen"]), sos_rows[0])
    incident = {
        "id": route_sos["sos_id"],
        "sos_id": route_sos["sos_id"],
        "zone": route_sos["zone_id"],
        "severity": route_sos["severity"],
        "needs_oxygen": route_sos["needs_oxygen"],
        "people_count": route_sos["people_count"],
        "created_at": route_sos["created_at"],
        "disaster_type": route_sos["disaster_type"],
        "is_elderly": route_sos["is_elderly"],
        "required_skill": route_sos["required_skill"],
        "latitude": route_sos["latitude"],
        "longitude": route_sos["longitude"],
    }
    queue = PriorityQueue()
    print("Priority queue score:", queue.calculate_priority(incident))

    responder_rows = [{
        "id": row["responder_id"],
        "name": row["full_name"],
        "type": row["role_title"],
        "skills": row["profile_data"]["skills"],
        "has_equipment": row["profile_data"]["has_equipment"],
        "available": row["profile_data"]["available"],
        "current_zone": row["primary_station_zone_id"],
        "latitude": row["profile_data"]["latitude"],
        "longitude": row["profile_data"]["longitude"],
    } for row in responders]
    route_responder = next(
        (row for row in responder_rows if row["has_equipment"] and row["available"]),
        responder_rows[0],
    )
    route = DijkstraRouter(roads=roads).find_route_details(
        incident["zone"], "zone_e", incident=incident, responder=route_responder
    )
    print("Dijkstra route nodes:", len(route["route"]))

    yen = YenRouter(dijkstra_router=DijkstraRouter(roads=roads)).find_backup_routes(
        incident["zone"], "zone_e", incident=incident, responder=route_responder
    )
    print("Yen routes:", len(yen))

    assignment = ResponderAssignment(responders=responder_rows).assign_responder(incident)
    print("Hungarian responder:", assignment.get("responder_id"))

    volunteer_rows = [{
        "id": row["volunteer_id"],
        "name": row["full_name"],
        "skills": row["skills"],
        "languages": row["languages"],
        "available": row["available"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
    } for row in volunteers]
    task_rows = [{
        "id": row["task_id"],
        "required_skill": row["required_skill"],
        "required_language": row["required_language"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
    } for row in tasks]
    matches = VolunteerMatching(volunteers=volunteer_rows, tasks=task_rows).match_volunteers()
    print("Gale-Shapley matches:", len(matches))

    flow = SupplyDistribution(depots=[{
        "id": row["depot_id"],
        "supply": row["supply"],
        "zone_id": row["zone_id"],
    } for row in depots], shelters=[{
        "id": row["shelter_id"],
        "demand": row["demand"],
        "zone_id": row["zone_id"],
    } for row in shelters], routes=roads).distribute_supplies()
    print("Min-cost flow shipments:", len(flow["flow_plan"]))

    inference = BayesianSeverityInference(priors=priors).infer_with_explanation(incident)
    print("Bayesian inferred severity:", inference["inferred_severity"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate seeded CrisisMap AI data and algorithm readiness.")
    parser.add_argument("--seed-dir", default="data/seed")
    args = parser.parse_args()

    repository = OperationalRepository()
    client = Neo4jClient()
    try:
        _print_counts(repository)
    except Exception as exc:
        print(f"Postgres validation skipped: {exc}")
    try:
        _print_neo4j_counts(client)
    except Exception as exc:
        print(f"Neo4j validation skipped: {exc}")
    _run_algorithm_checks(Path(args.seed_dir))


if __name__ == "__main__":
    main()
