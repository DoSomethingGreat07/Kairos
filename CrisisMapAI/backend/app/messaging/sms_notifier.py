from twilio.rest import Client
from typing import Dict, Any, Optional
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class SMSNotifier:
    """
    SMS notification fallback using Twilio.
    Provides backup communication when WebSocket/real-time fails.
    """

    def __init__(self):
        self.client = None
        if settings.twilio_account_sid and settings.twilio_auth_token:
            self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            self.from_number = settings.twilio_from_number
        else:
            logger.warning("Twilio credentials not configured - SMS notifications disabled")

    async def send_victim_notification(self, phone: str, message: str) -> bool:
        """
        Send SMS notification to victim.
        Returns True if sent successfully, False otherwise.
        """
        return await self._send_sms(phone, message, "victim")

    async def send_responder_notification(self, phone: str, message: str) -> bool:
        """
        Send SMS notification to responder.
        Returns True if sent successfully, False otherwise.
        """
        return await self._send_sms(phone, message, "responder")

    async def send_coordinator_notification(self, phone: str, message: str) -> bool:
        """
        Send SMS notification to coordinator.
        Returns True if sent successfully, False otherwise.
        """
        return await self._send_sms(phone, message, "coordinator")

    async def _send_sms(self, to_number: str, message: str, recipient_type: str) -> bool:
        """
        Internal SMS sending method.
        """
        if not self.client:
            logger.warning(f"SMS not sent to {recipient_type} ({to_number}): Twilio not configured")
            return False

        try:
            # Ensure phone number has country code
            formatted_number = self._format_phone_number(to_number)

            # Truncate message if too long (Twilio limit is 1600 chars)
            if len(message) > 1600:
                message = message[:1597] + "..."
                logger.warning(f"Message truncated for SMS to {recipient_type}")

            # Send SMS
            message_obj = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=formatted_number
            )

            logger.info(f"SMS sent to {recipient_type} ({formatted_number}): SID {message_obj.sid}")
            return True

        except Exception as e:
            logger.error(f"Failed to send SMS to {recipient_type} ({to_number}): {e}")
            return False

    def _format_phone_number(self, phone: str) -> str:
        """
        Format phone number to E.164 format.
        Assumes US numbers if no country code provided.
        """
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, phone))

        # If it starts with country code, assume it's already formatted
        if len(digits) > 10 and digits.startswith(('1', '44', '33', '49', '39', '351', '34', '31')):
            return f"+{digits}"

        # Assume US number and add +1
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith('1'):
            return f"+{digits}"

        # Return as-is if we can't determine format
        logger.warning(f"Could not format phone number: {phone}")
        return phone

    async def send_bulk_notifications(self, notifications: list) -> Dict[str, int]:
        """
        Send multiple SMS notifications.
        notifications: list of dicts with keys: 'phone', 'message', 'type'
        Returns dict with success/failure counts.
        """
        success_count = 0
        failure_count = 0

        for notification in notifications:
            phone = notification.get('phone')
            message = notification.get('message')
            notif_type = notification.get('type', 'general')

            if not phone or not message:
                logger.warning("Skipping notification: missing phone or message")
                failure_count += 1
                continue

            success = await self._send_sms(phone, message, notif_type)
            if success:
                success_count += 1
            else:
                failure_count += 1

        return {
            "success": success_count,
            "failure": failure_count,
            "total": len(notifications)
        }

    async def send_emergency_broadcast(self, phones: list, message: str) -> Dict[str, int]:
        """
        Send emergency broadcast to multiple recipients.
        """
        notifications = [
            {"phone": phone, "message": message, "type": "emergency_broadcast"}
            for phone in phones
        ]

        return await self.send_bulk_notifications(notifications)

    def is_configured(self) -> bool:
        """Check if SMS service is properly configured."""
        return self.client is not None

    async def get_delivery_status(self, message_sid: str) -> Optional[str]:
        """
        Get delivery status of a sent message.
        Returns status string or None if not found.
        """
        if not self.client:
            return None

        try:
            message = self.client.messages(message_sid).fetch()
            return message.status
        except Exception as e:
            logger.error(f"Failed to get delivery status for {message_sid}: {e}")
            return None

    async def validate_phone_number(self, phone: str) -> bool:
        """
        Validate phone number format and carrier info using Twilio.
        Returns True if valid, False otherwise.
        """
        if not self.client:
            # Basic validation if Twilio not configured
            digits = ''.join(filter(str.isdigit, phone))
            return len(digits) >= 10

        try:
            formatted_number = self._format_phone_number(phone)
            # Note: In production, you'd use Twilio's Lookup API here
            # For demo purposes, we do basic validation
            return len(formatted_number) >= 12  # +country code + 10 digits
        except Exception:
            return False