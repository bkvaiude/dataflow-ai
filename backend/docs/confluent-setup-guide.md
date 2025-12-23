# Confluent Cloud Setup Guide - DataFlow AI

## Overview

This guide covers setting up a production-grade Kafka infrastructure with:
- Schema Registry for data contracts
- Avro schemas for type safety
- Topic configuration with schema validation
- Flink SQL for stream processing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONFLUENT CLOUD SETUP                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ENVIRONMENT: dataflow-dev                  │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              KAFKA CLUSTER: dataflow-kafka              │ │   │
│  │  │              (Basic Tier - GCP us-central1)             │ │   │
│  │  │                                                         │ │   │
│  │  │  Topics:                                                │ │   │
│  │  │  ┌─────────────────┐    ┌─────────────────────────┐    │ │   │
│  │  │  │ raw_google_ads  │───▶│   processed_metrics     │    │ │   │
│  │  │  │ (6 partitions)  │    │   (6 partitions)        │    │ │   │
│  │  │  │ Schema: Avro    │    │   Schema: Avro          │    │ │   │
│  │  │  └─────────────────┘    └─────────────────────────┘    │ │   │
│  │  │           │                        ▲                    │ │   │
│  │  │           │      ┌─────────────────┘                    │ │   │
│  │  │           ▼      │                                      │ │   │
│  │  │  ┌─────────────────────────────────────────────────┐   │ │   │
│  │  │  │              FLINK SQL COMPUTE POOL              │   │ │   │
│  │  │  │  - ROAS Calculation                              │   │ │   │
│  │  │  │  - CPC/CTR Aggregation                           │   │ │   │
│  │  │  │  - Tumbling Window (1 minute for demo)           │   │ │   │
│  │  │  └─────────────────────────────────────────────────┘   │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              SCHEMA REGISTRY (Essentials)               │ │   │
│  │  │                                                         │ │   │
│  │  │  Schemas:                                               │ │   │
│  │  │  - raw_google_ads-value (Avro)                         │ │   │
│  │  │  - processed_metrics-value (Avro)                      │ │   │
│  │  │                                                         │ │   │
│  │  │  Compatibility: BACKWARD                                │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### Step 1: Create Confluent Cloud Account

1. Go to https://confluent.cloud/signup
2. Sign up with Google (fastest) or email
3. New accounts get **$400 free credits** for 30 days

---

### Step 2: Create Environment

1. After login, click **"Add environment"**
2. Name: `dataflow-dev`
3. Select **"Essentials"** stream governance package (includes Schema Registry)
4. Click **"Create"**

---

### Step 3: Create Kafka Cluster

1. Inside `dataflow-dev` environment, click **"Create cluster"**
2. Select **"Basic"** (free tier eligible)
3. Configuration:
   - **Cloud Provider:** Google Cloud
   - **Region:** us-central1 (Iowa)
   - **Cluster name:** `dataflow-kafka`
4. Click **"Launch cluster"**
5. Wait ~2 minutes for provisioning

---

### Step 4: Set Up Schema Registry

Schema Registry is automatically provisioned with Essentials package.

1. Go to **Schema Registry** in left sidebar
2. Note the **Schema Registry endpoint URL**
3. Create Schema Registry API key:
   - Click **"Create key"**
   - Save the Key and Secret

---

### Step 5: Create Data Contracts (Schemas)

#### Schema 1: raw_google_ads-value

Go to **Schema Registry → Schemas → Create schema**

```json
{
  "type": "record",
  "name": "RawGoogleAdsEvent",
  "namespace": "ai.dataflow.ads",
  "doc": "Raw campaign data from Google Ads API",
  "fields": [
    {
      "name": "campaign_id",
      "type": "string",
      "doc": "Unique campaign identifier from Google Ads"
    },
    {
      "name": "campaign_name",
      "type": "string",
      "doc": "Human-readable campaign name"
    },
    {
      "name": "spend",
      "type": "double",
      "doc": "Total spend in USD (cost_micros / 1,000,000)"
    },
    {
      "name": "clicks",
      "type": "long",
      "doc": "Total number of clicks"
    },
    {
      "name": "impressions",
      "type": "long",
      "doc": "Total number of impressions"
    },
    {
      "name": "conversions",
      "type": "double",
      "doc": "Total number of conversions"
    },
    {
      "name": "conversion_value",
      "type": "double",
      "doc": "Total conversion value in USD"
    },
    {
      "name": "user_id",
      "type": "string",
      "doc": "DataFlow user ID who owns this data"
    },
    {
      "name": "event_time",
      "type": {
        "type": "long",
        "logicalType": "timestamp-millis"
      },
      "doc": "Timestamp when this data was captured"
    }
  ]
}
```

#### Schema 2: processed_metrics-value

```json
{
  "type": "record",
  "name": "ProcessedMetrics",
  "namespace": "ai.dataflow.metrics",
  "doc": "Flink-processed marketing metrics with ROAS, CPC, CTR",
  "fields": [
    {
      "name": "campaign_id",
      "type": "string",
      "doc": "Unique campaign identifier"
    },
    {
      "name": "campaign_name",
      "type": "string",
      "doc": "Human-readable campaign name"
    },
    {
      "name": "window_start",
      "type": {
        "type": "long",
        "logicalType": "timestamp-millis"
      },
      "doc": "Start of aggregation window"
    },
    {
      "name": "window_end",
      "type": {
        "type": "long",
        "logicalType": "timestamp-millis"
      },
      "doc": "End of aggregation window"
    },
    {
      "name": "total_spend",
      "type": "double",
      "doc": "Total spend in window (USD)"
    },
    {
      "name": "total_clicks",
      "type": "long",
      "doc": "Total clicks in window"
    },
    {
      "name": "total_impressions",
      "type": "long",
      "doc": "Total impressions in window"
    },
    {
      "name": "total_conversions",
      "type": "double",
      "doc": "Total conversions in window"
    },
    {
      "name": "total_revenue",
      "type": "double",
      "doc": "Total conversion value in window (USD)"
    },
    {
      "name": "roas",
      "type": "double",
      "doc": "Return on Ad Spend = revenue / spend"
    },
    {
      "name": "cpc",
      "type": "double",
      "doc": "Cost Per Click = spend / clicks"
    },
    {
      "name": "ctr",
      "type": "double",
      "doc": "Click-Through Rate = (clicks / impressions) * 100"
    },
    {
      "name": "user_id",
      "type": "string",
      "doc": "DataFlow user ID"
    }
  ]
}
```

---

### Step 6: Create Topics with Schema Validation

1. Go to **Topics** → **Create topic**

#### Topic 1: raw_google_ads

| Setting | Value |
|---------|-------|
| Topic name | `raw_google_ads` |
| Partitions | 6 |
| Retention | 7 days |
| Schema | `raw_google_ads-value` (Avro) |
| Schema validation | Enabled |

#### Topic 2: processed_metrics

| Setting | Value |
|---------|-------|
| Topic name | `processed_metrics` |
| Partitions | 6 |
| Retention | 7 days |
| Schema | `processed_metrics-value` (Avro) |
| Schema validation | Enabled |

---

### Step 7: Generate API Keys

#### Kafka Cluster API Keys

1. Go to **Cluster → API keys → Create key**
2. Select **"Global access"**
3. Download/save credentials:
   - API Key: `XXXXXXXXXX`
   - API Secret: `XXXXXXXXXXXXXXXXXXXXX`

#### Schema Registry API Keys

1. Go to **Schema Registry → API credentials → Create key**
2. Save credentials separately

---

### Step 8: Collect All Configuration

After setup, you should have:

```env
# Kafka Cluster
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.us-central1.gcp.confluent.cloud:9092
KAFKA_API_KEY=your_cluster_api_key
KAFKA_API_SECRET=your_cluster_api_secret

# Schema Registry
SCHEMA_REGISTRY_URL=https://psrc-xxxxx.us-central1.gcp.confluent.cloud
SCHEMA_REGISTRY_API_KEY=your_sr_api_key
SCHEMA_REGISTRY_API_SECRET=your_sr_api_secret
```

---

## Flink SQL Setup (Day 5)

### Create Flink Compute Pool

1. Go to **Flink** in left sidebar
2. Click **"Create compute pool"**
3. Configuration:
   - **Name:** `dataflow-flink`
   - **Cloud:** Google Cloud
   - **Region:** us-central1 (same as Kafka)
   - **CFU:** 5 (minimum)
4. Click **"Create"**

### Deploy ROAS Calculation Job

See `backend/flink/roas_calculation.sql` for the complete Flink SQL job.

---

## Cost Estimate (Hackathon)

| Resource | Free Tier | Estimated Cost |
|----------|-----------|----------------|
| Kafka Basic Cluster | 400MB/month free | $0-10 |
| Schema Registry | Included | $0 |
| Flink (5 CFU) | ~$0.11/hr | ~$20/week |
| **Total** | | **~$30/week** |

---

## Quick Reference

### Endpoints to Collect

| Endpoint | Where to Find |
|----------|---------------|
| Bootstrap Server | Cluster → Settings → Endpoints |
| Schema Registry URL | Schema Registry → Settings |
| Flink REST Endpoint | Flink → Compute pool → Settings |

### Required API Keys

| Key Type | Purpose |
|----------|---------|
| Kafka API Key | Producer/Consumer auth |
| Schema Registry Key | Schema read/write |
| Flink API Key | SQL statement submission |

---

## Troubleshooting

### "Schema validation failed"
- Check schema is registered for topic
- Verify field names and types match

### "Authentication failed"
- Verify API key/secret are correct
- Check key has appropriate permissions

### "Topic not found"
- Ensure topic name matches exactly (case-sensitive)
- Check you're connected to correct cluster
