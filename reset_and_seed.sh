#!/usr/bin/env bash
# reset_and_seed.sh - Resets demo data and seeds new mock data for CrisisMap AI demo

set -e

# 1. Stop backend/frontend if needed (manual step or add pm2/docker stop here)

echo "Resetting PostgreSQL demo tables..."
psql -U crisismap -d crisismap -h localhost -c "TRUNCATE TABLE incidents, sos, victims RESTART IDENTITY CASCADE;"

echo "Resetting Neo4j demo nodes..."
cypher-shell -u neo4j -p password "MATCH (n) DETACH DELETE n;"

echo "Seeding new mock data..."
python3 CrisisMapAI/scripts/seed_demo_data.py CrisisMapAI/mock_data.json

echo "Demo data reset and seeded successfully!"
