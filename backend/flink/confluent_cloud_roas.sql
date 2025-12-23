-- DataFlow AI - Flink SQL for ROAS Calculation
-- Optimized for Confluent Cloud Flink (1-minute window for demo)

-- Note: In Confluent Cloud Flink, tables are automatically created from Kafka topics
-- You just need to run the INSERT statement after creating the topics with schemas

-- ROAS Calculation Job with Tumbling Window (1 minute for demo, change to 1 HOUR for production)
INSERT INTO processed_metrics
SELECT
    campaign_id,
    campaign_name,
    window_start,
    window_end,
    total_spend,
    total_clicks,
    total_impressions,
    total_conversions,
    total_revenue,
    -- ROAS = Revenue / Spend
    CASE
        WHEN total_spend > 0 THEN ROUND(total_revenue / total_spend, 2)
        ELSE 0
    END as roas,
    -- CPC = Spend / Clicks
    CASE
        WHEN total_clicks > 0 THEN ROUND(total_spend / total_clicks, 2)
        ELSE 0
    END as cpc,
    -- CTR = (Clicks / Impressions) * 100
    CASE
        WHEN total_impressions > 0 THEN ROUND(CAST(total_clicks AS DOUBLE) / total_impressions * 100, 2)
        ELSE 0
    END as ctr,
    user_id
FROM (
    SELECT
        campaign_id,
        campaign_name,
        TUMBLE_START(event_time, INTERVAL '1' MINUTE) as window_start,
        TUMBLE_END(event_time, INTERVAL '1' MINUTE) as window_end,
        SUM(spend) as total_spend,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        SUM(conversions) as total_conversions,
        SUM(conversion_value) as total_revenue,
        user_id
    FROM raw_google_ads
    GROUP BY
        campaign_id,
        campaign_name,
        user_id,
        TUMBLE(event_time, INTERVAL '1' MINUTE)
);
