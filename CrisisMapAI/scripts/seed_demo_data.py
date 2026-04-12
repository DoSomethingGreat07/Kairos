import json
import sys
import psycopg2
from psycopg2.extras import execute_values

# Usage: python seed_demo_data.py path/to/mock_data.json
if len(sys.argv) != 2:
    print("Usage: python seed_demo_data.py path/to/mock_data.json")
    sys.exit(1)

MOCK_DATA_PATH = sys.argv[1]

# Update these as needed for your environment
PG_CONN = dict(
    dbname="crisismap",
    user="crisismap",
    password="crisismap",
    host="localhost",
    port=5432
)

def main():
    with open(MOCK_DATA_PATH, "r") as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = [data]

    conn = psycopg2.connect(**PG_CONN)
    cur = conn.cursor()

    for incident in data:
        # Insert victim
        victim = incident["victim_profile"]
        cur.execute(
            """
            INSERT INTO victims (name, age, phone, latitude, longitude, zone, special_needs)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                victim["name"],
                victim["age"],
                victim["phone"],
                victim["location"]["latitude"],
                victim["location"]["longitude"],
                victim["location"]["zone"],
                ",".join(victim.get("special_needs", []))
            )
        )
        victim_id = cur.fetchone()[0]

        # Insert incident/SOS
        cur.execute(
            """
            INSERT INTO sos (sos_id, timestamp, victim_id, incident_type, situation, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                incident["sos_id"],
                incident["timestamp"],
                victim_id,
                incident["incident_type"],
                incident.get("situation", ""),
                incident["status"]
            )
        )
    conn.commit()
    cur.close()
    conn.close()
    print("Demo data seeded successfully.")

if __name__ == "__main__":
    main()
