"""
Template Service
CRUD operations for pipeline templates and template application.
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime


class TemplateService:
    """Manage pipeline templates."""

    def __init__(self):
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def create_template(
        self,
        user_id: str,
        name: str,
        transforms: List[Dict[str, Any]],
        anomaly_config: Dict[str, Any],
        description: Optional[str] = None,
        is_default: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new pipeline template

        Args:
            user_id: User ID
            name: Template name
            transforms: List of transformation configurations
            anomaly_config: Anomaly detection threshold configuration
            description: Optional description
            is_default: Whether this is a default template

        Returns:
            Created template dictionary
        """
        from app.db.models import PipelineTemplate, User

        session = self._get_session()
        try:
            # Ensure user exists
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(id=user_id)
                session.add(user)
                session.flush()

            # Generate template ID
            template_id = str(uuid.uuid4())

            # Create template
            template = PipelineTemplate(
                id=template_id,
                user_id=user_id,
                name=name,
                description=description,
                transforms=transforms,
                anomaly_config=anomaly_config,
                is_default=is_default
            )

            session.add(template)
            session.commit()
            session.refresh(template)

            print(f"[TEMPLATE] Created template '{name}' for user {user_id}")
            return template.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_template(self, user_id: str, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific template

        Args:
            user_id: User ID
            template_id: Template ID

        Returns:
            Template dictionary or None if not found
        """
        from app.db.models import PipelineTemplate

        session = self._get_session()
        try:
            template = session.query(PipelineTemplate).filter(
                PipelineTemplate.id == template_id,
                PipelineTemplate.user_id == user_id
            ).first()

            if not template:
                return None

            return template.to_dict()

        finally:
            session.close()

    def list_templates(self, user_id: str) -> List[Dict[str, Any]]:
        """
        List all templates for a user

        Args:
            user_id: User ID

        Returns:
            List of template dictionaries
        """
        from app.db.models import PipelineTemplate

        session = self._get_session()
        try:
            templates = session.query(PipelineTemplate).filter(
                PipelineTemplate.user_id == user_id
            ).order_by(PipelineTemplate.is_default.desc(), PipelineTemplate.created_at.desc()).all()

            return [t.to_dict() for t in templates]

        finally:
            session.close()

    def update_template(
        self,
        user_id: str,
        template_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        transforms: Optional[List[Dict[str, Any]]] = None,
        anomaly_config: Optional[Dict[str, Any]] = None,
        is_default: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update a template

        Args:
            user_id: User ID
            template_id: Template ID
            name: New name (optional)
            description: New description (optional)
            transforms: New transforms list (optional)
            anomaly_config: New anomaly config (optional)
            is_default: New is_default value (optional)

        Returns:
            Updated template dictionary or None if not found
        """
        from app.db.models import PipelineTemplate

        session = self._get_session()
        try:
            template = session.query(PipelineTemplate).filter(
                PipelineTemplate.id == template_id,
                PipelineTemplate.user_id == user_id
            ).first()

            if not template:
                return None

            # Update fields
            if name is not None:
                template.name = name
            if description is not None:
                template.description = description
            if transforms is not None:
                template.transforms = transforms
            if anomaly_config is not None:
                template.anomaly_config = anomaly_config
            if is_default is not None:
                template.is_default = is_default

            template.updated_at = datetime.utcnow()

            session.commit()
            session.refresh(template)

            print(f"[TEMPLATE] Updated template {template_id}")
            return template.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def delete_template(self, user_id: str, template_id: str) -> bool:
        """
        Delete a template

        Args:
            user_id: User ID
            template_id: Template ID

        Returns:
            True if deleted, False if not found
        """
        from app.db.models import PipelineTemplate

        session = self._get_session()
        try:
            template = session.query(PipelineTemplate).filter(
                PipelineTemplate.id == template_id,
                PipelineTemplate.user_id == user_id
            ).first()

            if template:
                session.delete(template)
                session.commit()
                print(f"[TEMPLATE] Deleted template {template_id}")
                return True

            return False

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def apply_template(
        self,
        user_id: str,
        template_id: str,
        credential_id: str
    ) -> Dict[str, Any]:
        """
        Apply a template by running all transforms in sequence

        Args:
            user_id: User ID
            template_id: Template ID to apply
            credential_id: Credential ID to run transforms against

        Returns:
            Results from applying all transforms with anomaly analysis
        """
        from app.services.sample_data_service import sample_data_service
        from app.services.transform_simulator import transform_simulator
        from app.services.anomaly_detector import anomaly_detector

        # Get template
        template = self.get_template(user_id, template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        transforms = template['transforms']
        anomaly_config = template['anomaly_config']

        print(f"[TEMPLATE] Applying template '{template['name']}' with {len(transforms)} transforms")

        # Execute each transform in sequence
        results = []
        previous_data = None

        for idx, transform_config in enumerate(transforms):
            transform_type = transform_config['type']
            transform_params = transform_config.get('params', {})

            print(f"[TEMPLATE] Executing transform {idx+1}/{len(transforms)}: {transform_type}")

            # Fetch original data for first transform
            if idx == 0:
                table_name = transform_params.get('table_name')
                schema_name = transform_params.get('schema', 'public')

                if not table_name:
                    raise ValueError(f"Transform {idx+1} missing required parameter: table_name")

                original_data = sample_data_service.fetch_sample(
                    user_id=user_id,
                    credential_id=credential_id,
                    table_name=table_name,
                    schema_name=schema_name,
                    limit=100
                )
            else:
                # Use previous transform's output as input
                original_data = previous_data

            # Execute transform
            try:
                if transform_type == 'filter':
                    transformed_data = transform_simulator.simulate_filter(
                        user_id=user_id,
                        credential_id=credential_id,
                        table_name=transform_params['table_name'],
                        where_clause=transform_params['where_clause'],
                        schema=transform_params.get('schema', 'public'),
                        limit=100
                    )

                elif transform_type == 'join':
                    transformed_data = transform_simulator.simulate_join(
                        user_id=user_id,
                        credential_id=credential_id,
                        left_table=transform_params['left_table'],
                        right_table=transform_params['right_table'],
                        join_type=transform_params['join_type'],
                        left_key=transform_params['left_key'],
                        right_key=transform_params['right_key'],
                        schema=transform_params.get('schema', 'public'),
                        limit=100
                    )

                elif transform_type == 'aggregation':
                    transformed_data = transform_simulator.simulate_aggregation(
                        user_id=user_id,
                        credential_id=credential_id,
                        table_name=transform_params['table_name'],
                        group_by=transform_params['group_by'],
                        aggregations=transform_params['aggregations'],
                        schema=transform_params.get('schema', 'public'),
                        limit=100
                    )

                else:
                    raise ValueError(f"Unsupported transform type: {transform_type}")

                # Analyze for anomalies
                anomaly_analysis = anomaly_detector.analyze(
                    original_data=original_data,
                    transformed_data=transformed_data,
                    transformation_type=transform_type,
                    config=anomaly_config
                )

                # Store result
                results.append({
                    'transform_index': idx,
                    'transform_type': transform_type,
                    'transform_params': transform_params,
                    'transformed_data': transformed_data,
                    'anomaly_analysis': anomaly_analysis,
                    'success': True
                })

                # Update previous_data for next iteration
                previous_data = transformed_data

                # Stop if critical errors found
                if not anomaly_analysis['can_proceed']:
                    print(f"[TEMPLATE] Stopping at transform {idx+1} due to critical errors")
                    break

            except Exception as e:
                results.append({
                    'transform_index': idx,
                    'transform_type': transform_type,
                    'transform_params': transform_params,
                    'error': str(e),
                    'success': False
                })
                break

        # Calculate overall summary
        total_errors = sum(r.get('anomaly_analysis', {}).get('summary', {}).get('errors', 0) for r in results if r.get('success'))
        total_warnings = sum(r.get('anomaly_analysis', {}).get('summary', {}).get('warnings', 0) for r in results if r.get('success'))

        return {
            'template_id': template_id,
            'template_name': template['name'],
            'credential_id': credential_id,
            'total_transforms': len(transforms),
            'executed_transforms': len(results),
            'results': results,
            'overall_summary': {
                'total_errors': total_errors,
                'total_warnings': total_warnings,
                'can_proceed': total_errors == 0
            },
            'applied_at': datetime.utcnow().isoformat()
        }


# Singleton instance
template_service = TemplateService()
