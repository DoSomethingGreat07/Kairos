import asyncio
from typing import Dict, Any, List, Set
import json
from datetime import datetime

class Broadcaster:
    """
    WebSocket broadcaster for real-time updates.
    Manages connections and broadcasts incident updates to all clients.
    """

    def __init__(self):
        self.connections: Set[Any] = set()
        self.active_incidents: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def startup(self):
        """Initialize broadcaster."""
        print("Starting WebSocket broadcaster...")

    async def shutdown(self):
        """Shutdown broadcaster and close all connections."""
        async with self._lock:
            for connection in self.connections.copy():
                try:
                    await connection.close()
                except Exception:
                    pass
            self.connections.clear()
        print("WebSocket broadcaster shut down")

    async def connect(self, websocket):
        """Add a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.connections.add(websocket)

        try:
            # Send current state to new connection
            await self._send_current_state(websocket)

            # Keep connection alive
            while True:
                # Wait for any message (ping/pong)
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    try:
                        await websocket.send_text(json.dumps({"type": "ping"}))
                    except Exception:
                        break
                except Exception:
                    break
        except Exception:
            pass
        finally:
            async with self._lock:
                self.connections.discard(websocket)

    def disconnect(self, websocket):
        """Remove a WebSocket connection."""
        self.connections.discard(websocket)

    async def broadcast_incident_update(self, incident: Dict[str, Any]):
        """Broadcast incident update to all connected clients."""
        update_data = {
            "type": "incident_update",
            "incident_id": incident.get("id"),
            "status": incident.get("status"),
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "assignment": incident.get("assignment"),
                "eta": incident.get("eta"),
                "responder": incident.get("assignment", {}).get("responder_name"),
                "destination": incident.get("dispatch_mode", {}).get("destination"),
                "messages": incident.get("messages", {})
            }
        }

        # Update active incidents cache
        self.active_incidents[incident["id"]] = {
            "status": incident.get("status"),
            "last_update": datetime.utcnow(),
            "data": update_data["data"]
        }

        await self._broadcast(update_data)

    async def broadcast_dashboard_update(self, dashboard_data: Dict[str, Any]):
        """Broadcast dashboard metrics update."""
        update_data = {
            "type": "dashboard_update",
            "timestamp": datetime.utcnow().isoformat(),
            "data": dashboard_data
        }

        await self._broadcast(update_data)

    async def broadcast_responder_update(self, responder_data: Dict[str, Any]):
        """Broadcast responder status update."""
        update_data = {
            "type": "responder_update",
            "responder_id": responder_data.get("id"),
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "status": responder_data.get("status", "unknown"),
                "location": responder_data.get("location"),
                "assignment": responder_data.get("assignment"),
                "available": responder_data.get("available", True)
            }
        }

        await self._broadcast(update_data)

    async def broadcast_resource_update(self, resource_data: Dict[str, Any]):
        """Broadcast resource availability update."""
        update_data = {
            "type": "resource_update",
            "resource_type": resource_data.get("type"),
            "resource_id": resource_data.get("id"),
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "available_capacity": resource_data.get("available_capacity"),
                "total_capacity": resource_data.get("total_capacity"),
                "utilization_rate": resource_data.get("utilization_rate")
            }
        }

        await self._broadcast(update_data)

    async def _broadcast(self, data: Dict[str, Any]):
        """Broadcast data to all connected clients."""
        if not self.connections:
            return

        message = json.dumps(data)

        # Create a copy of connections to avoid modification during iteration
        async with self._lock:
            connections = self.connections.copy()

        # Send to all connections
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Connection is dead, will be cleaned up on next receive
                pass

    async def _send_current_state(self, websocket):
        """Send current system state to a new connection."""
        state_data = {
            "type": "initial_state",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "active_incidents": self.active_incidents,
                "connection_count": len(self.connections) + 1  # +1 for current connection
            }
        }

        try:
            await websocket.send_text(json.dumps(state_data))
        except Exception:
            pass

    async def get_connection_count(self) -> int:
        """Get number of active connections."""
        async with self._lock:
            return len(self.connections)

    async def get_active_incidents_count(self) -> int:
        """Get number of active incidents."""
        return len([inc for inc in self.active_incidents.values() if inc["status"] != "resolved"])

    def get_incident_status(self, incident_id: str) -> Dict[str, Any]:
        """Get status of a specific incident."""
        return self.active_incidents.get(incident_id, {})

    async def cleanup_old_incidents(self, max_age_hours: int = 24):
        """Clean up old resolved incidents from cache."""
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)

        to_remove = []
        for incident_id, incident_data in self.active_incidents.items():
            if (incident_data["status"] == "resolved" and
                incident_data["last_update"].timestamp() < cutoff_time):
                to_remove.append(incident_id)

        for incident_id in to_remove:
            del self.active_incidents[incident_id]

    async def broadcast_system_status(self, status_data: Dict[str, Any]):
        """Broadcast overall system status."""
        update_data = {
            "type": "system_status",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "active_connections": await self.get_connection_count(),
                "active_incidents": await self.get_active_incidents_count(),
                "system_load": status_data.get("system_load", "normal"),
                "last_incident_time": status_data.get("last_incident_time"),
                "average_response_time": status_data.get("average_response_time")
            }
        }

        await self._broadcast(update_data)

    async def send_targeted_update(self, client_id: str, data: Dict[str, Any]):
        """Send targeted update to specific client (if supported by WebSocket implementation)."""
        # This would require client identification, for now broadcast to all
        update_data = {
            "type": "targeted_update",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }

        await self._broadcast(update_data)

    def get_broadcast_stats(self) -> Dict[str, Any]:
        """Get broadcasting statistics."""
        return {
            "active_connections": len(self.connections),
            "active_incidents": len(self.active_incidents),
            "resolved_incidents": len([inc for inc in self.active_incidents.values() if inc["status"] == "resolved"]),
            "pending_incidents": len([inc for inc in self.active_incidents.values() if inc["status"] in ["received", "assigned"]]),
            "in_progress_incidents": len([inc for inc in self.active_incidents.values() if inc["status"] == "en_route"])
        }

# Global broadcaster instance
broadcaster = Broadcaster()
