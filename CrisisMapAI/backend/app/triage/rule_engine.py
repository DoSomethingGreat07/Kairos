from typing import Dict, Any, List

class RuleEngine:
    """
    Rule engine for determining dispatch mode based on incident conditions.
    Maps incident characteristics to appropriate response types.
    """

    def __init__(self):
        self.rules = self._initialize_rules()

    def _initialize_rules(self) -> List[Dict[str, Any]]:
        """Initialize dispatch rules."""
        return [
            # Critical severity rules
            {
                "conditions": {
                    "severity": "critical",
                    "oxygen_required": True
                },
                "dispatch_mode": {
                    "responder_type": "advanced_life_support",
                    "priority": "immediate",
                    "destination": "hospital",
                    "needs_volunteers": False,
                    "needs_supplies": True,
                    "estimated_response_time": "10-20 minutes"
                }
            },
            {
                "conditions": {
                    "severity": "critical",
                    "injury": True,
                    "people_count": lambda x: x >= 3
                },
                "dispatch_mode": {
                    "responder_type": "multiple_ambulances",
                    "priority": "immediate",
                    "destination": "hospital",
                    "needs_volunteers": True,
                    "needs_supplies": True,
                    "estimated_response_time": "8-15 minutes"
                }
            },

            # High severity rules
            {
                "conditions": {
                    "severity": "high",
                    "oxygen_required": True
                },
                "dispatch_mode": {
                    "responder_type": "advanced_life_support",
                    "priority": "high",
                    "destination": "hospital",
                    "needs_volunteers": False,
                    "needs_supplies": False,
                    "estimated_response_time": "10-20 minutes"
                }
            },
            {
                "conditions": {
                    "severity": "high",
                    "disaster_type": "fire"
                },
                "dispatch_mode": {
                    "responder_type": "fire_response_unit",
                    "priority": "high",
                    "destination": "safe_zone",
                    "needs_volunteers": True,
                    "needs_supplies": False,
                    "estimated_response_time": "5-15 minutes"
                }
            },

            # Medium severity rules
            {
                "conditions": {
                    "severity": "medium",
                    "elderly": True
                },
                "dispatch_mode": {
                    "responder_type": "basic_ambulance",
                    "priority": "medium",
                    "destination": "hospital",
                    "needs_volunteers": True,
                    "needs_supplies": False,
                    "estimated_response_time": "15-30 minutes"
                }
            },
            {
                "conditions": {
                    "severity": "medium",
                    "disaster_type": "flood"
                },
                "dispatch_mode": {
                    "responder_type": "rescue_unit",
                    "priority": "medium",
                    "destination": "shelter",
                    "needs_volunteers": True,
                    "needs_supplies": True,
                    "estimated_response_time": "20-40 minutes"
                }
            },

            # Low severity rules
            {
                "conditions": {
                    "severity": "low",
                    "people_count": lambda x: x > 1
                },
                "dispatch_mode": {
                    "responder_type": "bus_transport",
                    "priority": "low",
                    "destination": "shelter",
                    "needs_volunteers": True,
                    "needs_supplies": False,
                    "estimated_response_time": "30-60 minutes"
                }
            },
            {
                "conditions": {
                    "severity": "low"
                },
                "dispatch_mode": {
                    "responder_type": "volunteer_transport",
                    "priority": "low",
                    "destination": "shelter",
                    "needs_volunteers": True,
                    "needs_supplies": False,
                    "estimated_response_time": "45-90 minutes"
                }
            },

            # Default fallback
            {
                "conditions": {},
                "dispatch_mode": {
                    "responder_type": "basic_ambulance",
                    "priority": "medium",
                    "destination": "hospital",
                    "needs_volunteers": False,
                    "needs_supplies": False,
                    "estimated_response_time": "20-40 minutes"
                }
            }
        ]

    def determine_dispatch_mode(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine dispatch mode based on incident conditions.

        Evaluates rules in order of specificity and returns the first match.
        """
        for rule in self.rules:
            if self._matches_conditions(incident, rule["conditions"]):
                dispatch_mode = rule["dispatch_mode"].copy()

                # Add incident-specific customizations
                dispatch_mode["incident_id"] = incident.get("id")
                dispatch_mode["rationale"] = self._generate_rationale(incident, rule)

                return dispatch_mode

        # Should never reach here due to default rule
        return self.rules[-1]["dispatch_mode"]

    def _matches_conditions(self, incident: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Check if incident matches rule conditions."""
        for key, expected_value in conditions.items():
            actual_value = incident.get(key)

            if callable(expected_value):
                # Function-based condition
                if not expected_value(actual_value):
                    return False
            elif actual_value != expected_value:
                return False

        return True

    def _generate_rationale(self, incident: Dict[str, Any], rule: Dict[str, Any]) -> str:
        """Generate human-readable rationale for dispatch decision."""
        conditions = rule["conditions"]
        dispatch_mode = rule["dispatch_mode"]

        rationale_parts = []

        # Severity-based rationale
        if "severity" in conditions:
            severity = conditions["severity"]
            rationale_parts.append(f"Incident severity is {severity}")

        # Special conditions
        if conditions.get("oxygen_required"):
            rationale_parts.append("oxygen support is required")
        if conditions.get("injury"):
            rationale_parts.append("injuries are present")
        if conditions.get("elderly"):
            rationale_parts.append("elderly individuals are involved")
        if "people_count" in conditions and callable(conditions["people_count"]):
            rationale_parts.append("multiple people are affected")

        # Disaster type
        if "disaster_type" in conditions:
            disaster = conditions["disaster_type"]
            rationale_parts.append(f"this is a {disaster} incident")

        # Combine rationale
        if rationale_parts:
            rationale = "Because " + ", ".join(rationale_parts) + ", "
        else:
            rationale = ""

        # Add dispatch decision
        responder_type = dispatch_mode["responder_type"].replace("_", " ")
        destination = dispatch_mode["destination"]
        rationale += f"dispatching {responder_type} to {destination}."

        return rationale

    def get_available_responder_types(self) -> List[str]:
        """Get all available responder types from rules."""
        responder_types = set()
        for rule in self.rules:
            responder_types.add(rule["dispatch_mode"]["responder_type"])
        return list(responder_types)

    def get_rules_summary(self) -> List[Dict[str, Any]]:
        """Get summary of all rules for explainability."""
        return [
            {
                "conditions": rule["conditions"],
                "responder_type": rule["dispatch_mode"]["responder_type"],
                "destination": rule["dispatch_mode"]["destination"],
                "priority": rule["dispatch_mode"]["priority"]
            }
            for rule in self.rules
        ]
