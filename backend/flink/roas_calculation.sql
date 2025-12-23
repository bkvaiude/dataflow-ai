-- DataFlow AI - Flink SQL for ROAS Calculation
-- This job runs on Confluent Cloud Flink

-- Source Table: Raw Google Ads data from Kafka
CREATE TABLE raw_google_ads (
    campaign_id STRING,
    campaign_name STRING,
    spend DOUBLE,
    clicks BIGINT,
    impressions BIGINT,
    conversions DOUBLE,
    conversion_value DOUBLE,
    event_time TIMESTAMP(3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'raw_google_ads',
    'properties.bootstrap.servers' = '${KAFKA_BOOTSTRAP_SERVERS}',
    'properties.security.protocol' = 'SASL_SSL',
    'properties.sasl.mechanism' = 'PLAIN',
    'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
    'format' = 'json',
    'scan.startup.mode' = 'earliest-offset'
);

-- Sink Table: Processed metrics to Kafka
CREATE TABLE processed_metrics (
    campaign_id STRING,
    campaign_name STRING,
    window_start TIMESTAMP(3),
    window_end TIMESTAMP(3),
    total_spend DOUBLE,
    total_clicks BIGINT,
    total_impressions BIGINT,
    total_conversions DOUBLE,
    total_revenue DOUBLE,
    roas DOUBLE,
    cpc DOUBLE,
    ctr DOUBLE
) WITH (
    'connector' = 'kafka',
    'topic' = 'processed_metrics',
    'properties.bootstrap.servers' = '${KAFKA_BOOTSTRAP_SERVERS}',
    'properties.security.protocol' = 'SASL_SSL',
    'properties.sasl.mechanism' = 'PLAIN',
    'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
    'format' = 'json'
);

-- ROAS Calculation Job with Tumbling Window (1 hour)
INSERT INTO processed_metrics
SELECT
    campaign_id,
    campaign_name,
    TUMBLE_START(event_time, INTERVAL '1' HOUR) as window_start,
    TUMBLE_END(event_time, INTERVAL '1' HOUR) as window_end,
    SUM(spend) as total_spend,
    SUM(clicks) as total_clicks,
    SUM(impressions) as total_impressions,
    SUM(conversions) as total_conversions,
    SUM(conversion_value) as total_revenue,
    -- ROAS = Revenue / Spend
    CASE
        WHEN SUM(spend) > 0 THEN ROUND(SUM(conversion_value) / SUM(spend), 2)
        ELSE 0
    END as roas,
    -- CPC = Spend / Clicks
    CASE
        WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2)
        ELSE 0
    END as cpc,
    -- CTR = (Clicks / Impressions) * 100
    CASE
        WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS DOUBLE) / SUM(impressions) * 100, 2)
        ELSE 0
    END as ctr
FROM raw_google_ads
GROUP BY
    campaign_id,
    campaign_name,
    TUMBLE(event_time, INTERVAL '1' HOUR);
