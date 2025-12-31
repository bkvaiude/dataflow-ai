# DataFlow AI

Real-time data pipeline platform with Kafka, ksqlDB, and ClickHouse.

## Prerequisites

- Docker & Docker Compose
- Confluent Cloud account (for Kafka, Schema Registry)
- Firebase project (for authentication)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/dataflow-ai.git
cd dataflow-ai
```

### 2. Setup environment variables

Copy the example env file and update with your credentials:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your values:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=development

# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json

# Gemini AI
GOOGLE_API_KEY=your_gemini_api_key

# Confluent Kafka
KAFKA_BOOTSTRAP_SERVERS=your-cluster.confluent.cloud:9092
KAFKA_API_KEY=your_kafka_api_key
KAFKA_API_SECRET=your_kafka_api_secret

# Schema Registry
SCHEMA_REGISTRY_URL=https://your-schema-registry.confluent.cloud
SCHEMA_REGISTRY_API_KEY=your_sr_api_key
SCHEMA_REGISTRY_API_SECRET=your_sr_api_secret

# JWT Authentication
JWT_SECRET_KEY=your_jwt_secret_key
```

### 3. Create root .env file

Create `.env` in the project root for docker compose:

```bash
cp backend/.env .env
```

### 4. Run with Docker

```bash
docker compose up -d
```

### 5. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **ClickHouse**: http://localhost:8123
- **Kafka Connect**: http://localhost:8083
- **ksqlDB**: http://localhost:8088

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js web application |
| Backend | 8000 | FastAPI backend |
| ClickHouse | 8123, 9000 | Analytics database |
| Kafka Connect | 8083 | CDC connectors |
| ksqlDB | 8088 | Stream processing |

## Stopping the services

```bash
docker compose down
```

To remove volumes:

```bash
docker compose down -v
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
