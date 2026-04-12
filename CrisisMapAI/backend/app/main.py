from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime
import asyncio
from contextlib import asynccontextmanager

from .config import settings
from .api.sos import router as sos_router
from .api.dashboard import router as dashboard_router
from .api.registration import router as registration_router
from .api.auth import router as auth_router
from .db.postgres import RegistrationRepository
from .realtime.broadcaster import broadcaster
from .graph.neo4j_client import Neo4jClient
from .graph.seed_pipeline import Neo4jSeedPipeline


async def certification_expiry_worker() -> None:
    repository = RegistrationRepository()
    while True:
        try:
            updated = repository.expire_certifications()
            if updated:
                print(f"Certification expiry check updated {updated} responder certifications")
        except Exception as exc:
            print(f"Certification expiry check failed: {exc}")
        await asyncio.sleep(60 * 60 * 24)


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting CrisisMap AI backend...")

    # Initialize Neo4j connection
    neo4j_client = Neo4jClient()
    app.state.neo4j = neo4j_client

    # Seed database with initial data
    try:
        pipeline = Neo4jSeedPipeline(neo4j_client)
        await pipeline.seed_all_data(include_edge_cases=True)
        print("Database seeded successfully")
    except Exception as e:
        print(f"Error seeding database: {e}")

    # Start broadcaster
    await broadcaster.startup()
    certification_task = asyncio.create_task(certification_expiry_worker())

    yield

    # Shutdown
    print("Shutting down CrisisMap AI backend...")
    certification_task.cancel()
    try:
        await certification_task
    except asyncio.CancelledError:
        pass
    await broadcaster.shutdown()
    await neo4j_client.close()

# Create FastAPI app
app = FastAPI(
    title="CrisisMap AI",
    description="Emergency coordination platform with intelligent dispatch",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],  # Frontend dev URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sos_router, prefix="/api", tags=["sos"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])
app.include_router(registration_router, prefix="/api", tags=["registration"])
app.include_router(auth_router, prefix="/api", tags=["auth"])

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        broadcaster.disconnect(websocket)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "CrisisMap AI Emergency Coordination Platform",
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
