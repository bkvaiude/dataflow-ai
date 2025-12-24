"""
Pipeline Visibility API
Provides endpoints to monitor the real-time data pipeline status.
"""

from fastapi import APIRouter
from typing import Dict, Any, List
from app.config import settings
from app.services.kafka_producer import kafka_producer
from app.services.kafka_consumer import kafka_consumer
from app.services.metrics_processor import metrics_processor

router = APIRouter()


@router.get("/status")
async def get_pipeline_status() -> Dict[str, Any]:
    """Get overall pipeline status and service modes"""
    return {
        "services": {
            "gemini": {
                "mode": "mock" if settings.use_mock_gemini else "real",
                "configured": settings.has_gemini_api_key,
            },
            "kafka": {
                "mode": "mock" if settings.use_mock_kafka else "real",
                "configured": settings.has_kafka_credentials,
                "bootstrap_servers": settings.kafka_bootstrap_servers[:30] + "..." if settings.kafka_bootstrap_servers else None,
            },
            "schema_registry": {
                "configured": settings.has_schema_registry_credentials,
                "url": settings.schema_registry_url[:40] + "..." if settings.schema_registry_url else None,
            },
            "oauth": {
                "mode": "mock" if settings.use_mock_oauth else "real",
                "configured": settings.has_google_oauth_credentials,
            },
            "google_ads_data": {
                "mode": "mock",
                "reason": "No developer token" if not settings.has_google_ads_developer_token else "ready",
            },
            "processor": metrics_processor.get_status(),
        },
        "environment": settings.environment,
    }


@router.get("/kafka/producer/messages")
async def get_producer_messages() -> Dict[str, Any]:
    """Get messages produced to Kafka (mock mode only shows in-memory messages)"""
    if kafka_producer.is_mock:
        messages = kafka_producer.get_mock_messages()
        return {
            "mode": "mock",
            "message_count": len(messages),
            "messages": messages[-20:],  # Last 20 messages
        }
    return {
        "mode": "real",
        "message": "Producer is connected to real Kafka - messages are sent to Confluent Cloud",
        "is_connected": kafka_producer.producer is not None,
    }


@router.get("/kafka/consumer/metrics")
async def get_consumer_metrics() -> Dict[str, Any]:
    """Get processed metrics from Kafka consumer"""
    if kafka_consumer.is_mock:
        metrics = kafka_consumer.consume_processed_metrics(limit=20)
        return {
            "mode": "mock",
            "metrics_count": len(metrics),
            "metrics": metrics,
        }

    # Real mode - try to consume from processed_metrics topic
    try:
        metrics = kafka_consumer.consume_processed_metrics(limit=20)
        return {
            "mode": "real",
            "metrics_count": len(metrics),
            "metrics": metrics,
        }
    except Exception as e:
        return {
            "mode": "real",
            "error": str(e),
            "metrics": [],
        }


@router.get("/processor/status")
async def get_processor_status() -> Dict[str, Any]:
    """Get metrics processor status"""
    return metrics_processor.get_status()


@router.get("/processor/metrics")
async def get_processed_metrics(limit: int = 10) -> Dict[str, Any]:
    """Get recently processed metrics from the processor"""
    return {
        "metrics": metrics_processor.get_recent_metrics(limit),
        "status": metrics_processor.get_status(),
    }


@router.post("/processor/start")
async def start_processor() -> Dict[str, Any]:
    """Start the metrics processor"""
    if settings.use_mock_kafka:
        return {
            "success": False,
            "message": "Cannot start processor - Kafka is in mock mode",
        }

    metrics_processor.start()
    return {
        "success": True,
        "message": "Metrics processor started",
        "status": metrics_processor.get_status(),
    }


@router.post("/processor/stop")
async def stop_processor() -> Dict[str, Any]:
    """Stop the metrics processor"""
    metrics_processor.stop()
    return {
        "success": True,
        "message": "Metrics processor stopped",
        "status": metrics_processor.get_status(),
    }


@router.post("/test/produce")
async def test_produce_message() -> Dict[str, Any]:
    """Test producing a message to Kafka with mock campaign data"""
    from app.tools.agent_tools import MOCK_CAMPAIGNS

    results = []
    for campaign in MOCK_CAMPAIGNS:
        try:
            kafka_producer.produce_google_ads_data(campaign, user_id="test-user")
            results.append({
                "campaign": campaign.get("name"),
                "status": "produced",
            })
        except Exception as e:
            results.append({
                "campaign": campaign.get("name"),
                "status": "error",
                "error": str(e),
            })

    kafka_producer.flush()

    return {
        "mode": "mock" if kafka_producer.is_mock else "real",
        "results": results,
        "message": f"Produced {len(results)} campaigns to Kafka",
    }
