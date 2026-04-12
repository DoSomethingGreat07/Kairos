import openai
from typing import Dict, Any, List
import json
from ..config import settings

class LLMMessenger:
    """
    LLM-based message generation for victim, responder, and coordinator communication.
    Generates human-readable messages from deterministic system outputs.
    """

    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.model = "gpt-3.5-turbo"  # Can be upgraded to gpt-4 for better quality

    async def generate_messages(self, incident: Dict[str, Any]) -> Dict[str, str]:
        """
        Generate human-readable messages for all stakeholders.
        LLM only summarizes deterministic outputs, no decision making.
        """
        if not self.client:
            # Fallback to template-based messages if no OpenAI key
            return self._generate_template_messages(incident)

        try:
            # Generate victim confirmation
            victim_message = await self._generate_victim_message(incident)

            # Generate responder instructions
            responder_message = await self._generate_responder_message(incident)

            # Generate coordinator summary
            coordinator_message = await self._generate_coordinator_message(incident)

            return {
                "victim_confirmation": victim_message,
                "responder_instructions": responder_message,
                "coordinator_summary": coordinator_message
            }

        except Exception as e:
            print(f"Error generating LLM messages: {e}")
            return self._generate_template_messages(incident)

    async def _generate_victim_message(self, incident: Dict[str, Any]) -> str:
        """Generate calm, reassuring message for victims."""
        assignment = incident.get("assignment", {})
        eta = assignment.get("eta", "unknown")
        responder = assignment.get("responder_name", "emergency responder")

        prompt = f"""
        Generate a calm, reassuring message for someone who just reported an emergency.

        Incident details:
        - Disaster type: {incident.get('disaster_type', 'emergency')}
        - Severity: {incident.get('severity', 'unknown')}
        - People affected: {incident.get('people_count', 1)}
        - Special needs: oxygen={incident.get('oxygen_required', False)}, injuries={incident.get('injury', False)}, elderly={incident.get('elderly', False)}
        - Assigned responder: {responder}
        - Estimated arrival: {eta}

        The message should:
        - Be empathetic and reassuring
        - Confirm help is on the way
        - Provide clear ETA if available
        - Give safety instructions
        - Be concise (under 100 words)
        - Use simple, clear language

        Do not make any decisions or add information not provided.
        """

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.3
        )

        return response.choices[0].message.content.strip()

    async def _generate_responder_message(self, incident: Dict[str, Any]) -> str:
        """Generate clear instructions for responders."""
        assignment = incident.get("assignment", {})
        route = assignment.get("route", [])
        destination = assignment.get("destination", {})

        prompt = f"""
        Generate clear, professional instructions for an emergency responder.

        Assignment details:
        - Incident type: {incident.get('disaster_type', 'emergency')}
        - Location: {incident.get('zone', 'unknown zone')}
        - Severity: {incident.get('severity', 'unknown')}
        - People affected: {incident.get('people_count', 1)}
        - Special requirements: oxygen={incident.get('oxygen_required', False)}, injuries={incident.get('injury', False)}
        - Route: {' → '.join(route) if route else 'direct route'}
        - Destination: {destination.get('name', 'scene')} ({destination.get('type', 'location')})
        - ETA to scene: {assignment.get('eta', 'unknown')}

        The instructions should:
        - Be clear and professional
        - Include route information
        - Specify destination and purpose
        - Mention any special equipment needed
        - Be concise but complete
        - Use emergency response terminology appropriately

        Do not make decisions about treatment or add unprovided information.
        """

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.2
        )

        return response.choices[0].message.content.strip()

    async def _generate_coordinator_message(self, incident: Dict[str, Any]) -> str:
        """Generate summary for coordinators."""
        assignment = incident.get("assignment", {})
        volunteers = incident.get("volunteers", [])
        supply_plan = incident.get("supply_plan", {})

        prompt = f"""
        Generate a concise summary for emergency coordinators.

        Incident overview:
        - ID: {incident.get('id', 'unknown')}
        - Type: {incident.get('disaster_type', 'emergency')}
        - Zone: {incident.get('zone', 'unknown')}
        - Severity: {incident.get('severity', 'unknown')}
        - Priority score: {incident.get('priority_score', 0)}
        - People affected: {incident.get('people_count', 1)}

        Response actions:
        - Responder assigned: {assignment.get('responder_name', 'none')}
        - ETA: {assignment.get('eta', 'unknown')}
        - Volunteers matched: {len(volunteers)}
        - Supplies distributed: {supply_plan.get('total_items_distributed', 0)} items

        The summary should:
        - Be factual and concise
        - Highlight key response actions
        - Note any special requirements
        - Be suitable for coordination logs
        - Under 150 words

        Stick to provided facts only.
        """

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.1
        )

        return response.choices[0].message.content.strip()

    def _generate_template_messages(self, incident: Dict[str, Any]) -> Dict[str, str]:
        """Fallback template-based message generation."""
        assignment = incident.get("assignment", {})
        eta = assignment.get("eta", "shortly")
        responder = assignment.get("responder_name", "emergency team")

        victim_message = f"""Help is on the way. {responder} is assigned to your emergency and will arrive in {eta}. Stay in a safe location and follow any instructions from emergency personnel. You are not alone - help is coming."""

        responder_message = f"""Emergency assignment: Respond to {incident.get('disaster_type', 'emergency')} in {incident.get('zone', 'assigned zone')}. ETA: {eta}. Check for {incident.get('people_count', 1)} people affected. {'Oxygen equipment required.' if incident.get('oxygen_required') else ''} Proceed safely to scene."""

        coordinator_message = f"""Incident {incident.get('id', 'unknown')}: {incident.get('disaster_type', 'emergency')} in {incident.get('zone', 'unknown zone')}, severity {incident.get('severity', 'unknown')}. Responder {responder} assigned, ETA {eta}. {len(incident.get('volunteers', []))} volunteers matched."""

        return {
            "victim_confirmation": victim_message,
            "responder_instructions": responder_message,
            "coordinator_summary": coordinator_message
        }

    async def translate_message(self, message: str, target_language: str) -> str:
        """Translate a message to target language."""
        if not self.client or target_language.lower() == "english":
            return message

        prompt = f"""
        Translate the following emergency response message to {target_language}.
        Maintain the urgent but calm tone. Keep medical and emergency terms accurate.

        Message: {message}

        Provide only the translated message, no additional text.
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.1
            )

            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Translation error: {e}")
            return message

    async def generate_status_update(self, incident: Dict[str, Any], update_type: str) -> str:
        """Generate status update messages."""
        if update_type == "responder_arrived":
            return f"Emergency responder has arrived at the scene for incident {incident.get('id', 'unknown')}."
        elif update_type == "patient_transported":
            return f"Patient(s) from incident {incident.get('id', 'unknown')} have been transported to medical facility."
        elif update_type == "incident_resolved":
            return f"Incident {incident.get('id', 'unknown')} has been resolved. All emergency responses completed."
        else:
            return f"Status update for incident {incident.get('id', 'unknown')}: {update_type}"

    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages for translation."""
        return [
            "english", "spanish", "french", "german", "italian", "portuguese",
            "chinese", "japanese", "korean", "arabic", "hindi", "russian"
        ]