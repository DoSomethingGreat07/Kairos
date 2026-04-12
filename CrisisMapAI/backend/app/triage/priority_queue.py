"""Binary-heap priority queue for SOS incidents.

This module implements the finalized queue formula exactly:

score = severity_score - (0.5 if needs_oxygen) - (people_count * 0.01)

Lower scores represent higher priority, so the heap is ordered directly by the
computed score and `created_at` acts as the FIFO tiebreaker.
"""

from __future__ import annotations

import heapq
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


SEVERITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


class PriorityQueue:
    """Priority queue for SOS incidents backed by Python's binary heap."""

    def __init__(self) -> None:
        self.queue: List[Tuple[float, datetime, str]] = []
        self.incidents: Dict[str, Dict[str, Any]] = {}

    def calculate_priority(self, incident: Dict[str, Any]) -> float:
        """Return the finalized queue priority score."""
        severity = str(incident.get("severity", "medium")).lower()
        severity_score = SEVERITY_ORDER.get(severity, SEVERITY_ORDER["medium"])
        needs_oxygen = bool(incident.get("needs_oxygen", incident.get("oxygen_required", False)))
        people_count = int(incident.get("people_count", 1) or 1)
        return float(severity_score - (0.5 if needs_oxygen else 0.0) - (people_count * 0.01))

    def build_explanation(self, incident: Dict[str, Any], score: Optional[float] = None) -> str:
        """Create a concise queue explanation for operators and logs."""
        parts = [f"{str(incident.get('severity', 'medium')).capitalize()} severity"]
        if incident.get("needs_oxygen", incident.get("oxygen_required", False)):
            parts.append("oxygen need increased priority")
        if int(incident.get("people_count", 1) or 1) > 1:
            parts.append(f"{incident.get('people_count')} people slightly increased priority")
        final_score = self.calculate_priority(incident) if score is None else score
        return f"{', '.join(parts)}. Final queue score: {final_score:.2f}"

    def push_incident(self, incident: Dict[str, Any]) -> Tuple[float, str]:
        """Insert an incident into the heap and cache its explainable score."""
        incident_id = str(incident.get("sos_id") or incident.get("id"))
        created_at = self._coerce_datetime(incident.get("created_at") or incident.get("timestamp") or datetime.utcnow())
        score = self.calculate_priority(incident)
        enriched = dict(incident)
        enriched["priority_score"] = score
        enriched.setdefault("explainability", {})
        enriched["explainability"]["priority_queue"] = self.build_explanation(enriched, score)
        heapq.heappush(self.queue, (score, created_at, incident_id))
        self.incidents[incident_id] = enriched
        return score, incident_id

    def add_incident(self, incident: Dict[str, Any]) -> None:
        """Backward-compatible insert wrapper used by the API layer."""
        self.push_incident(incident)

    def pop_incident(self) -> Optional[Dict[str, Any]]:
        """Remove and return the highest-priority incident."""
        while self.queue:
            _, _, incident_id = heapq.heappop(self.queue)
            incident = self.incidents.pop(incident_id, None)
            if incident is not None:
                return incident
        return None

    def get_next_incident(self) -> Optional[Dict[str, Any]]:
        """Backward-compatible pop wrapper."""
        return self.pop_incident()

    def peek_next_incident(self) -> Optional[Dict[str, Any]]:
        """Peek at the next incident without removing it."""
        while self.queue:
            _, _, incident_id = self.queue[0]
            incident = self.incidents.get(incident_id)
            if incident is not None:
                return incident
            heapq.heappop(self.queue)
        return None

    def get_queue_size(self) -> int:
        return len(self.incidents)

    def get_all_incidents(self) -> List[Dict[str, Any]]:
        ordered = sorted(self.queue)
        return [self.incidents[incident_id] for _, _, incident_id in ordered if incident_id in self.incidents]

    def remove_incident(self, incident_id: str) -> None:
        self.incidents.pop(incident_id, None)

    @staticmethod
    def _coerce_datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.utcnow()
