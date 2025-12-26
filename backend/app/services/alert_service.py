"""
Alert Service
Handles alert rule management and email notifications via SMTP (Mailhog for development).
"""

import os
import smtplib
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.config import settings


class AlertService:
    """Email alert service using SMTP (Mailhog for dev)"""

    def __init__(self):
        # Use zidans-ai-backend-mailhog-1 on common-local network, or mailhog as fallback
        self.smtp_host = os.getenv("SMTP_HOST", "zidans-ai-backend-mailhog-1")
        self.smtp_port = int(os.getenv("SMTP_PORT", "1025"))
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
        self.from_email = os.getenv("ALERT_FROM_EMAIL", "alerts@dataflow-ai.local")

    def is_alert_day(self, enabled_days: List[int]) -> bool:
        """Check if today is an enabled alert day (0=Monday, 6=Sunday)"""
        current_day = datetime.utcnow().weekday()
        return current_day in enabled_days

    def is_alert_hour(self, enabled_hours: Optional[List[int]]) -> bool:
        """Check if current hour is in enabled hours"""
        if not enabled_hours:
            return True  # No hour restriction
        current_hour = datetime.utcnow().hour
        return current_hour in enabled_hours

    def check_cooldown(self, last_triggered_at: Optional[datetime], cooldown_minutes: int) -> bool:
        """Check if cooldown period has passed. Returns True if can send alert."""
        if not last_triggered_at:
            return True
        elapsed = (datetime.utcnow() - last_triggered_at).total_seconds() / 60
        return elapsed >= cooldown_minutes

    def create_rule(
        self,
        user_id: str,
        name: str,
        rule_type: str,
        threshold_config: Dict[str, Any],
        pipeline_id: Optional[str] = None,
        enabled_days: List[int] = None,
        enabled_hours: List[int] = None,
        cooldown_minutes: int = 30,
        severity: str = "warning",
        recipients: List[str] = None,
        description: str = ""
    ) -> Dict[str, Any]:
        """Create a new alert rule"""
        from app.db.models import AlertRule, Pipeline
        from app.services.db_service import db_service

        # Validate rule_type
        valid_types = ['volume_spike', 'volume_drop', 'gap_detection', 'null_ratio']
        if rule_type not in valid_types:
            raise ValueError(f"Invalid rule_type '{rule_type}'. Valid types: {valid_types}")

        # Validate severity
        valid_severities = ['info', 'warning', 'critical']
        if severity not in valid_severities:
            raise ValueError(f"Invalid severity '{severity}'. Valid: {valid_severities}")

        # Default to Friday only
        if enabled_days is None:
            enabled_days = [4]

        session = db_service._get_session()
        try:
            # Verify pipeline exists if specified
            if pipeline_id:
                pipeline = session.query(Pipeline).filter(
                    Pipeline.id == pipeline_id,
                    Pipeline.user_id == user_id
                ).first()
                if not pipeline:
                    raise ValueError(f"Pipeline '{pipeline_id}' not found")

            rule = AlertRule(
                id=str(uuid.uuid4()),
                user_id=user_id,
                pipeline_id=pipeline_id,
                name=name,
                description=description,
                rule_type=rule_type,
                threshold_config=threshold_config,
                enabled_days=enabled_days,
                enabled_hours=enabled_hours,
                cooldown_minutes=cooldown_minutes,
                severity=severity,
                recipients=recipients or [],
                is_active=True
            )
            session.add(rule)
            session.commit()
            session.refresh(rule)

            print(f"[ALERT_SERVICE] Created alert rule '{name}' (type={rule_type}, days={enabled_days})")
            return rule.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def list_rules(
        self,
        user_id: str,
        pipeline_id: Optional[str] = None,
        active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """List alert rules for a user"""
        from app.db.models import AlertRule
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            query = session.query(AlertRule).filter(AlertRule.user_id == user_id)

            if pipeline_id:
                query = query.filter(AlertRule.pipeline_id == pipeline_id)

            if active_only:
                query = query.filter(AlertRule.is_active == True)

            rules = query.order_by(AlertRule.created_at.desc()).all()
            return [rule.to_dict() for rule in rules]

        finally:
            session.close()

    def get_rule(self, rule_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific alert rule"""
        from app.db.models import AlertRule
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            rule = session.query(AlertRule).filter(
                AlertRule.id == rule_id,
                AlertRule.user_id == user_id
            ).first()
            return rule.to_dict() if rule else None
        finally:
            session.close()

    def update_rule(
        self,
        rule_id: str,
        user_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an alert rule"""
        from app.db.models import AlertRule
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            rule = session.query(AlertRule).filter(
                AlertRule.id == rule_id,
                AlertRule.user_id == user_id
            ).first()

            if not rule:
                raise ValueError(f"Alert rule '{rule_id}' not found")

            # Apply updates
            allowed_fields = [
                'name', 'description', 'threshold_config', 'enabled_days',
                'enabled_hours', 'cooldown_minutes', 'severity', 'recipients', 'is_active'
            ]
            for field in allowed_fields:
                if field in updates:
                    setattr(rule, field, updates[field])

            session.commit()
            session.refresh(rule)
            return rule.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def delete_rule(self, rule_id: str, user_id: str) -> bool:
        """Delete an alert rule"""
        from app.db.models import AlertRule
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            rule = session.query(AlertRule).filter(
                AlertRule.id == rule_id,
                AlertRule.user_id == user_id
            ).first()

            if not rule:
                raise ValueError(f"Alert rule '{rule_id}' not found")

            session.delete(rule)
            session.commit()
            return True

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def send_alert(
        self,
        rule_id: str,
        anomaly: Dict[str, Any],
        bypass_schedule: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Send an alert email and record in history.

        Args:
            rule_id: Alert rule ID
            anomaly: Anomaly details from detector
            bypass_schedule: If True, ignore day/hour restrictions

        Returns:
            AlertHistory dict if alert was sent, None if skipped
        """
        from app.db.models import AlertRule, AlertHistory
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            rule = session.query(AlertRule).filter(AlertRule.id == rule_id).first()
            if not rule:
                raise ValueError(f"Alert rule '{rule_id}' not found")

            if not rule.is_active:
                print(f"[ALERT_SERVICE] Skipping alert - rule '{rule.name}' is inactive")
                return None

            # Check schedule unless bypassed
            if not bypass_schedule:
                if not self.is_alert_day(rule.enabled_days or []):
                    print(f"[ALERT_SERVICE] Skipping alert - not an enabled day")
                    return None

                if not self.is_alert_hour(rule.enabled_hours):
                    print(f"[ALERT_SERVICE] Skipping alert - not an enabled hour")
                    return None

                if not self.check_cooldown(rule.last_triggered_at, rule.cooldown_minutes):
                    print(f"[ALERT_SERVICE] Skipping alert - still in cooldown period")
                    return None

            # Build email content
            title = f"[{rule.severity.upper()}] {anomaly.get('type', 'Anomaly')}: {anomaly.get('message', 'Alert triggered')}"
            message = self._build_email_body(rule, anomaly)
            recipients = rule.recipients or []

            # Create history record
            history = AlertHistory(
                id=str(uuid.uuid4()),
                rule_id=rule_id,
                alert_type=anomaly.get('type', rule.rule_type),
                severity=rule.severity,
                title=title,
                message=message,
                details=anomaly.get('details'),
                email_recipients=recipients
            )

            # Send email
            email_error = None
            if recipients:
                try:
                    self._send_email(recipients, title, message)
                    history.email_sent = True
                    history.email_sent_at = datetime.utcnow()
                    print(f"[ALERT_SERVICE] Email sent to {recipients}")
                except Exception as e:
                    email_error = str(e)
                    history.email_error = email_error
                    print(f"[ALERT_SERVICE] Email failed: {email_error}")

            # Update rule trigger tracking
            rule.last_triggered_at = datetime.utcnow()
            rule.trigger_count = (rule.trigger_count or 0) + 1

            session.add(history)
            session.commit()
            session.refresh(history)

            return history.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def send_test_alert(self, rule_id: str, user_id: str) -> Dict[str, Any]:
        """Send a test alert regardless of schedule"""
        from app.db.models import AlertRule
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            rule = session.query(AlertRule).filter(
                AlertRule.id == rule_id,
                AlertRule.user_id == user_id
            ).first()

            if not rule:
                raise ValueError(f"Alert rule '{rule_id}' not found")

            # Create test anomaly
            test_anomaly = {
                'type': rule.rule_type,
                'severity': rule.severity,
                'message': f'Test alert for rule "{rule.name}"',
                'details': {
                    'test': True,
                    'timestamp': datetime.utcnow().isoformat(),
                    'threshold_config': rule.threshold_config
                }
            }

            result = self.send_alert(rule_id, test_anomaly, bypass_schedule=True)

            if result:
                return {
                    'status': 'success',
                    'message': f'Test alert sent for rule "{rule.name}"',
                    'alert_history_id': result['id'],
                    'recipients': rule.recipients or []
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Failed to send test alert'
                }

        finally:
            session.close()

    def get_history(
        self,
        user_id: str,
        rule_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get alert history"""
        from app.db.models import AlertRule, AlertHistory
        from app.services.db_service import db_service

        session = db_service._get_session()
        try:
            query = session.query(AlertHistory).join(AlertRule).filter(
                AlertRule.user_id == user_id
            )

            if rule_id:
                query = query.filter(AlertHistory.rule_id == rule_id)

            history = query.order_by(AlertHistory.triggered_at.desc()).limit(limit).all()
            return [h.to_dict() for h in history]

        finally:
            session.close()

    def _build_email_body(self, rule, anomaly: Dict[str, Any]) -> str:
        """Build HTML email body"""
        details = anomaly.get('details', {})
        details_html = ""
        if details:
            details_html = "<h3>Details</h3><ul>"
            for key, value in details.items():
                details_html += f"<li><strong>{key}:</strong> {value}</li>"
            details_html += "</ul>"

        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h2 style="color: #dc3545; margin-top: 0;">
                    DataFlow Alert: {anomaly.get('type', 'Anomaly Detected')}
                </h2>

                <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <p><strong>Rule:</strong> {rule.name}</p>
                    <p><strong>Type:</strong> {rule.rule_type}</p>
                    <p><strong>Severity:</strong> <span style="color: {'#dc3545' if rule.severity == 'critical' else '#ffc107' if rule.severity == 'warning' else '#17a2b8'};">{rule.severity.upper()}</span></p>
                    <p><strong>Message:</strong> {anomaly.get('message', 'N/A')}</p>
                </div>

                {details_html}

                <p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
                    This alert was sent by DataFlow AI at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
                </p>
            </div>
        </body>
        </html>
        """

    def _send_email(self, recipients: List[str], subject: str, html_body: str):
        """Send email via SMTP"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.from_email
        msg['To'] = ', '.join(recipients)

        # Plain text version
        text_body = f"DataFlow Alert\n\n{subject}\n\nView the DataFlow dashboard for details."
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        # Connect and send
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_use_tls:
                server.starttls()
            server.sendmail(self.from_email, recipients, msg.as_string())


# Singleton instance
alert_service = AlertService()
