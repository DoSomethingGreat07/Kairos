import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'CrisisMapAI'))

from neo4j import GraphDatabase
from backend.app.config import settings

URI = settings.neo4j_uri
USER = settings.neo4j_user
PASSWORD = settings.neo4j_password

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
driver.verify_connectivity()
print("connected")
driver.close()