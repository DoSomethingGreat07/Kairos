"""Bayesian severity inference with explicit zone-history priors."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from ..operations.default_data import severity_prior_definitions


SEVERITY_LEVELS = ("critical", "high", "medium", "low")


class BayesianSeverityInference:
    """Infer severity using priors and explainable feature likelihoods."""

    def __init__(self, priors: List[Dict[str, Any]] | None = None) -> None:
        self.priors = priors or severity_prior_definitions()

    def infer_severity(self, incident: Dict[str, Any]) -> str:
        result = self.infer_with_explanation(incident)
        return result["inferred_severity"]

    def get_severity_confidence(self, incident: Dict[str, Any]) -> Dict[str, float]:
        result = self.infer_with_explanation(incident)
        return result["posterior"]

    def infer_with_explanation(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        zone_id = incident.get("zone") or incident.get("zone_id") or "zone_a"
        disaster_type = str(incident.get("disaster_type", "medical")).lower()
        prior = self._find_prior(zone_id, disaster_type)
        likelihoods, factors = self._calculate_feature_likelihoods(incident)

        unnormalized = {
            severity: prior[severity] * likelihoods[severity]
            for severity in SEVERITY_LEVELS
        }
        total = sum(unnormalized.values()) or 1.0
        posterior = {
            severity: value / total
            for severity, value in unnormalized.items()
        }
        inferred = max(posterior, key=posterior.get)
        strongest_factor = max(factors, key=lambda item: abs(item[1] - 1.0))[0] if factors else "prior severity distribution"

        return {
            "inferred_severity": inferred,
            "posterior": posterior,
            "prior": prior,
            "feature_likelihood": likelihoods,
            "explanation": f"Inferred {inferred} severity. Strongest factor: {strongest_factor}.",
        }

    def _find_prior(self, zone_id: str, disaster_type: str) -> Dict[str, float]:
        for entry in self.priors:
            if entry["zone_id"] == zone_id and entry["disaster_type"] == disaster_type:
                return {
                    "critical": entry["prior_critical"],
                    "high": entry["prior_high"],
                    "medium": entry["prior_medium"],
                    "low": entry["prior_low"],
                }
        # fallback to disaster-agnostic average prior
        matched = [entry for entry in self.priors if entry["zone_id"] == zone_id] or self.priors
        averaged = {
            severity: sum(entry[f"prior_{severity}"] for entry in matched) / len(matched)
            for severity in SEVERITY_LEVELS
        }
        return averaged

    def _calculate_feature_likelihoods(self, incident: Dict[str, Any]) -> Tuple[Dict[str, float], List[Tuple[str, float]]]:
        people_count = int(incident.get("people_count", 1) or 1)
        is_elderly = bool(incident.get("is_elderly", incident.get("elderly", False)))
        disaster_type = str(incident.get("disaster_type", "medical")).lower()

        likelihood = {severity: 1.0 for severity in SEVERITY_LEVELS}
        factors: List[Tuple[str, float]] = []

        elderly_factor = {
            "critical": 1.35 if is_elderly else 0.95,
            "high": 1.20 if is_elderly else 1.0,
            "medium": 1.0,
            "low": 0.80 if is_elderly else 1.05,
        }
        crowd_factor = {
            "critical": 1.0 + min(people_count, 10) * 0.06,
            "high": 1.0 + min(people_count, 10) * 0.04,
            "medium": 1.0 + min(people_count, 10) * 0.02,
            "low": max(0.55, 1.0 - min(people_count, 10) * 0.03),
        }
        disaster_factor_lookup = {
            "fire": {"critical": 1.25, "high": 1.20, "medium": 1.0, "low": 0.75},
            "flood": {"critical": 1.15, "high": 1.10, "medium": 1.0, "low": 0.85},
            "earthquake": {"critical": 1.30, "high": 1.20, "medium": 0.95, "low": 0.70},
            "storm": {"critical": 1.10, "high": 1.10, "medium": 1.0, "low": 0.90},
            "medical": {"critical": 1.05, "high": 1.10, "medium": 1.0, "low": 0.95},
            "medical emergency": {"critical": 1.08, "high": 1.12, "medium": 1.0, "low": 0.92},
        }
        disaster_factor = disaster_factor_lookup.get(disaster_type, {severity: 1.0 for severity in SEVERITY_LEVELS})

        for severity in SEVERITY_LEVELS:
            likelihood[severity] *= elderly_factor[severity]
            likelihood[severity] *= crowd_factor[severity]
            likelihood[severity] *= disaster_factor[severity]

        factors.append(("elderly involvement", elderly_factor["critical"]))
        factors.append(("people count", crowd_factor["critical"]))
        factors.append((f"disaster type: {disaster_type}", disaster_factor["critical"]))
        return likelihood, factors
