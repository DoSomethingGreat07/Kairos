"""Volunteer-task matching using Gale-Shapley stable matching."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from ..operations.default_data import task_definitions, volunteer_definitions


class VolunteerMatching:
    def __init__(self, volunteers: Optional[List[Dict[str, Any]]] = None, tasks: Optional[List[Dict[str, Any]]] = None) -> None:
        self.volunteers = volunteers or volunteer_definitions()
        self.tasks = tasks or task_definitions()

    def match_volunteers(self, incident: Optional[Dict[str, Any]] = None, tasks: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        available_volunteers = [row for row in self.volunteers if row.get("available", False)]
        active_tasks = tasks or self._tasks_for_incident(incident)
        if not available_volunteers or not active_tasks:
            return []

        volunteer_preferences = {
            volunteer["id"]: self._rank_tasks_for_volunteer(volunteer, active_tasks)
            for volunteer in available_volunteers
        }
        task_preferences = {
            task["id"]: self._rank_volunteers_for_task(task, available_volunteers)
            for task in active_tasks
        }

        assignments: Dict[str, str] = {}
        task_matches: Dict[str, str] = {}
        next_choice_index = {volunteer["id"]: 0 for volunteer in available_volunteers}
        free = [volunteer["id"] for volunteer in available_volunteers]

        while free:
            volunteer_id = free.pop(0)
            ranked_tasks = volunteer_preferences[volunteer_id]
            if next_choice_index[volunteer_id] >= len(ranked_tasks):
                continue
            task_id = ranked_tasks[next_choice_index[volunteer_id]]
            next_choice_index[volunteer_id] += 1

            current_match = task_matches.get(task_id)
            if current_match is None:
                task_matches[task_id] = volunteer_id
                assignments[volunteer_id] = task_id
                continue

            preference = task_preferences[task_id]
            if preference.index(volunteer_id) < preference.index(current_match):
                del assignments[current_match]
                free.append(current_match)
                task_matches[task_id] = volunteer_id
                assignments[volunteer_id] = task_id
            else:
                free.append(volunteer_id)

        task_lookup = {task["id"]: task for task in active_tasks}
        volunteer_lookup = {volunteer["id"]: volunteer for volunteer in available_volunteers}
        results = []
        for volunteer_id, task_id in assignments.items():
            volunteer = volunteer_lookup[volunteer_id]
            task = task_lookup[task_id]
            score = self._score(volunteer, task)
            volunteer_latitude, volunteer_longitude = self._volunteer_position(volunteer)
            results.append({
                "volunteer_id": volunteer_id,
                "volunteer_name": volunteer["name"],
                "task_id": task_id,
                "task_type": task.get("required_skill"),
                "match_score": score,
                "estimated_arrival": f"{max(1, round(self._distance_km(volunteer, task) / 0.8))} minutes",
                "current_location": {
                    "latitude": volunteer_latitude,
                    "longitude": volunteer_longitude,
                    "zone_id": volunteer.get("current_zone_id") or volunteer.get("zone_id"),
                },
                "rationale": self._rationale(volunteer, task, score),
            })
        return results

    def _tasks_for_incident(self, incident: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not incident:
            return self.tasks
        latitude = incident.get("latitude") or incident.get("location", {}).get("latitude") or 40.7128
        longitude = incident.get("longitude") or incident.get("location", {}).get("longitude") or -74.0060
        required_skill = incident.get("required_skill") or "Basic First Aid"
        required_language = (incident.get("contact") or {}).get("language") or "English"
        return [{
            "id": f"task_{incident.get('id', 'incident')}",
            "required_skill": required_skill,
            "required_language": required_language,
            "latitude": latitude,
            "longitude": longitude,
        }]

    def _rank_tasks_for_volunteer(self, volunteer: Dict[str, Any], tasks: List[Dict[str, Any]]) -> List[str]:
        scored = [(task["id"], self._score(volunteer, task)) for task in tasks]
        scored.sort(key=lambda item: item[1], reverse=True)
        return [task_id for task_id, _ in scored]

    def _rank_volunteers_for_task(self, task: Dict[str, Any], volunteers: List[Dict[str, Any]]) -> List[str]:
        scored = [(volunteer["id"], self._score(volunteer, task)) for volunteer in volunteers]
        scored.sort(key=lambda item: item[1], reverse=True)
        return [volunteer_id for volunteer_id, _ in scored]

    def _score(self, volunteer: Dict[str, Any], task: Dict[str, Any]) -> float:
        skill_match = 10 if task["required_skill"] in volunteer.get("skills", []) else 0
        language_match = 5 if task["required_language"] in volunteer.get("languages", []) else 0
        return skill_match + language_match - self._distance_km(volunteer, task)

    def _rationale(self, volunteer: Dict[str, Any], task: Dict[str, Any], score: float) -> str:
        reasons = []
        if task["required_skill"] in volunteer.get("skills", []):
            reasons.append("skill match (+10)")
        if task["required_language"] in volunteer.get("languages", []):
            reasons.append("language match (+5)")
        current_zone = volunteer.get("current_zone_id") or volunteer.get("zone_id")
        reasons.append(f"distance penalty from current location in {current_zone} ({self._distance_km(volunteer, task):.2f} km)")
        return f"Stable match score {score:.2f}: " + ", ".join(reasons)

    @staticmethod
    def _volunteer_position(volunteer: Dict[str, Any]) -> tuple[float, float]:
        return (
            volunteer.get("current_latitude", volunteer["latitude"]),
            volunteer.get("current_longitude", volunteer["longitude"]),
        )

    @classmethod
    def _distance_km(cls, volunteer: Dict[str, Any], task: Dict[str, Any]) -> float:
        radius = 6_371.0
        volunteer_latitude, volunteer_longitude = cls._volunteer_position(volunteer)
        phi1 = math.radians(volunteer_latitude)
        phi2 = math.radians(task["latitude"])
        delta_phi = math.radians(task["latitude"] - volunteer_latitude)
        delta_lambda = math.radians(task["longitude"] - volunteer_longitude)
        a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))
