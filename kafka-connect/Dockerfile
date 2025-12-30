FROM debezium/connect:2.4

# Install Confluent Hub client and connectors
USER root

# Download and install Confluent Kafka Connect Avro Converter
RUN mkdir -p /tmp/confluent-hub-components && \
    curl -L -o /tmp/confluent-hub-client.tar.gz https://client.hub.confluent.io/confluent-hub-client-latest.tar.gz && \
    mkdir -p /tmp/confluent-hub && \
    tar -xzf /tmp/confluent-hub-client.tar.gz -C /tmp/confluent-hub && \
    /tmp/confluent-hub/bin/confluent-hub install --no-prompt confluentinc/kafka-connect-avro-converter:7.5.1 --component-dir /kafka/connect --worker-configs /dev/null && \
    rm -rf /tmp/confluent-hub /tmp/confluent-hub-client.tar.gz

# Add missing Guava dependency for Avro converter
RUN cd /kafka/connect/confluentinc-kafka-connect-avro-converter/lib && \
    curl -L -O https://repo1.maven.org/maven2/com/google/guava/guava/32.1.2-jre/guava-32.1.2-jre.jar && \
    curl -L -O https://repo1.maven.org/maven2/com/google/guava/failureaccess/1.0.1/failureaccess-1.0.1.jar

# Download ClickHouse Kafka Connect Sink from GitHub releases
RUN mkdir -p /kafka/connect/clickhouse-kafka-connect && \
    curl -L -o /tmp/clickhouse-kafka-connect.zip https://github.com/ClickHouse/clickhouse-kafka-connect/releases/download/v1.3.5/clickhouse-kafka-connect-v1.3.5.zip && \
    unzip /tmp/clickhouse-kafka-connect.zip -d /kafka/connect/clickhouse-kafka-connect && \
    rm /tmp/clickhouse-kafka-connect.zip

USER kafka
