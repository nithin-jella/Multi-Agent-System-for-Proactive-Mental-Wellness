---
sidebar_position: 3
id: monitoring
title: Production Monitoring Guide for UGM-AICare
---

# Production Monitoring Guide for UGM-AICare

This document is a conceptual guide (logging/metrics/alerting design). Operational commands for running a bundled ELK/Prometheus/Grafana/Langfuse stack are not included here because the previous Compose-based infra stack has been removed from this repository.

## Table of Contents

1. [Logging Strategy](#1-logging-strategy)
2. [Performance Monitoring](#2-performance-monitoring)
3. [Infrastructure Setup](#3-infrastructure-setup)
4. [Alerting System](#4-alerting-system)
5. [Dashboard Setup](#5-dashboard-setup)
6. [Mental Health Specific Metrics](#6-mental-health-specific-metrics)

---

## 1. Logging Strategy

### **Current State**

- [Done] Using Python's standard `logging` module
- [Done] Logs emitted to stdout (Docker logs)
- [Missing] No structured logging (JSON format)
- [Missing] No centralized log aggregation

### **Recommended: ELK Stack (Elasticsearch, Logstash, Kibana)**

#### **Why ELK?**

- **Elasticsearch**: Powerful search and analytics
- **Logstash**: Log aggregation and parsing
- **Kibana**: Beautiful visualization dashboards
- **Cost**: Free and open-source
- **Scale**: Handles millions of logs/day

#### **Alternative Options:**

1. **Grafana Loki** (Lightweight, integrated with Grafana)
2. **AWS CloudWatch** (If hosting on AWS)
3. **Azure Monitor** (If hosting on Azure)
4. **Google Cloud Logging** (If hosting on GCP)
5. **DataDog** (Premium, but excellent UX)

### **Implementation Steps:**

#### **Step 1: Add Structured Logging**

Create `backend/app/core/logging_config.py`:

```python
"""
Structured logging configuration for production.
"""
import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
 """
 Format logs as JSON for easy parsing by log aggregators.
 """
 
 def format(self, record: logging.LogRecord) -> str:
 log_data: Dict[str, Any] = {
 "timestamp": datetime.utcnow().isoformat(),
 "level": record.levelname,
 "logger": record.name,
 "message": record.getMessage(),
 "module": record.module,
 "function": record.funcName,
 "line": record.lineno,
 }
 
 # Add exception info if present
 if record.exc_info:
 log_data["exception"] = self.formatException(record.exc_info)
 
 # Add extra fields (custom context)
 if hasattr(record, "user_id"):
 log_data["user_id"] = record.user_id
 if hasattr(record, "session_id"):
 log_data["session_id"] = record.session_id
 if hasattr(record, "agent"):
 log_data["agent"] = record.agent
 if hasattr(record, "processing_time_ms"):
 log_data["processing_time_ms"] = record.processing_time_ms
 
 return json.dumps(log_data)


def configure_logging(log_level: str = "INFO") -> None:
 """
 Configure structured logging for production.
 
 Args:
 log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 """
 # Create formatter
 formatter = JSONFormatter()
 
 # Console handler (stdout for Docker)
 console_handler = logging.StreamHandler(sys.stdout)
 console_handler.setFormatter(formatter)
 
 # Root logger
 root_logger = logging.getLogger()
 root_logger.setLevel(log_level)
 root_logger.addHandler(console_handler)
 
 # Silence noisy libraries
 logging.getLogger("urllib3").setLevel(logging.WARNING)
 logging.getLogger("asyncio").setLevel(logging.WARNING)
 logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


class ContextLogger:
 """
 Logger wrapper that adds context to log messages.
 
 Usage:
 logger = ContextLogger(__name__, user_id=123, session_id="abc")
 logger.info("User action", action="create_plan")
 """
 
 def __init__(self, name: str, **context):
 self.logger = logging.getLogger(name)
 self.context = context
 
 def _add_context(self, record: logging.LogRecord) -> None:
 for key, value in self.context.items():
 setattr(record, key, value)
 
 def info(self, msg: str, **extra):
 record = self.logger.makeRecord(
 self.logger.name,
 logging.INFO,
 "(unknown file)",
 0,
 msg,
 (),
 None
 )
 self._add_context(record)
 for key, value in extra.items():
 setattr(record, key, value)
 self.logger.handle(record)
 
 def error(self, msg: str, **extra):
 record = self.logger.makeRecord(
 self.logger.name,
 logging.ERROR,
 "(unknown file)",
 0,
 msg,
 (),
 None
 )
 self._add_context(record)
 for key, value in extra.items():
 setattr(record, key, value)
 self.logger.handle(record)
```

Update `backend/app/main.py`:

```python
from app.core.logging_config import configure_logging
import os

# Configure structured logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
configure_logging(log_level=LOG_LEVEL)
```

#### **Step 2: Deploy ELK Stack**

Operational note: a Compose-based ELK stack previously existed in this repository, but it has been removed.

```yaml
version: '3.8'

services:
 elasticsearch:
 image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
 container_name: elasticsearch
 environment:
 - discovery.type=single-node
 - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
 - xpack.security.enabled=false
 ports:
 - "9200:9200"
 volumes:
 - elasticsearch-data:/usr/share/elasticsearch/data
 networks:
 - elk

 logstash:
 image: docker.elastic.co/logstash/logstash:8.11.0
 container_name: logstash
 volumes:
 -./logstash/pipeline:/usr/share/logstash/pipeline
 -./logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml
 ports:
 - "5000:5000/tcp"
 - "5000:5000/udp"
 - "9600:9600"
 environment:
 LS_JAVA_OPTS: "-Xmx1g -Xms1g"
 depends_on:
 - elasticsearch
 networks:
 - elk

 kibana:
 image: docker.elastic.co/kibana/kibana:8.11.0
 container_name: kibana
 ports:
 - "5601:5601"
 environment:
 ELASTICSEARCH_HOSTS: http://elasticsearch:9200
 depends_on:
 - elasticsearch
 networks:
 - elk

 filebeat:
 image: docker.elastic.co/beats/filebeat:8.11.0
 container_name: filebeat
 user: root
 volumes:
 -./filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
 - /var/lib/docker/containers:/var/lib/docker/containers:ro
 - /var/run/docker.sock:/var/run/docker.sock:ro
 depends_on:
 - logstash
 networks:
 - elk

volumes:
 elasticsearch-data:
 driver: local

networks:
 elk:
 driver: bridge
```

Create the corresponding Filebeat configuration in your observability stack (path is illustrative), e.g. `filebeat/filebeat.yml`:

```yaml
filebeat.inputs:
 - type: container
 paths:
 - '/var/lib/docker/containers/*/*.log'
 processors:
 - add_docker_metadata:
 host: "unix:///var/run/docker.sock"
 - decode_json_fields:
 fields: ["message"]
 target: "json"
 overwrite_keys: true

output.logstash:
 hosts: ["logstash:5000"]
```

Create the corresponding Logstash pipeline configuration in your observability stack (path is illustrative), e.g. `logstash/pipeline/logstash.conf`:

```conf
input {
 beats {
 port => 5000
 }
}

filter {
 # Parse JSON logs from Python
 if [json][message] {
 json {
 source => "[json][message]"
 target => "app"
 }
 }
 
 # Extract agent metrics
 if [app][agent] {
 mutate {
 add_field => { "agent_name" => "%{[app][agent]}" }
 }
 }
 
 # Extract performance metrics
 if [app][processing_time_ms] {
 mutate {
 convert => { "[app][processing_time_ms]" => "float" }
 }
 }
}

output {
 elasticsearch {
 hosts => ["elasticsearch:9200"]
 index => "ugm-aicare-%{+YYYY.MM.dd}"
 }
 
 # Debug output (optional)
 stdout {
 codec => rubydebug
 }
}
```

#### **Step 3: Start ELK Stack**

```bash
Follow your observability stack's deployment procedure to bring up Elasticsearch/Logstash/Kibana.
```

Access Kibana at: `http://localhost:5601`

---

## 2. Performance Monitoring

### **Metrics to Track**

#### **Application Metrics:**

1. **Request Rate**: Requests per second
2. **Response Time**: P50, P95, P99 latencies
3. **Error Rate**: 4xx/5xx errors
4. **Agent Processing Time**: Time taken by each agent (STA, TCA, CMA, IA)
5. **LLM API Latency**: Gemini API response times
6. **Database Query Time**: Slow query detection
7. **Tool Execution Time**: Time for each tool call

#### **Infrastructure Metrics:**

1. **CPU Usage**: Per container
2. **Memory Usage**: Per container
3. **Disk I/O**: Read/write operations
4. **Network Traffic**: Bandwidth usage
5. **Container Health**: Restart count, uptime

#### **Business Metrics (Mental Health Specific):**

1. **Active Users**: Daily/Weekly/Monthly active users
2. **Crisis Escalations**: Count and response time
3. **Intervention Plan Completion**: Success rate
4. **Counselor Response Time**: Average time to respond
5. **User Retention**: 7-day, 30-day retention

### **Recommended: Prometheus + Grafana**

#### **Why Prometheus + Grafana?**

- **Prometheus**: Time-series database for metrics
- **Grafana**: Beautiful, customizable dashboards
- **Integration**: Works seamlessly with FastAPI
- **Alerting**: Built-in alert manager

#### **Implementation:**

Install Prometheus client:

```bash
cd backend
pip install prometheus-client prometheus-fastapi-instrumentator
```

Update `requirements.txt`:

```txt
prometheus-client==0.19.0
prometheus-fastapi-instrumentator==6.1.0
```

Create `backend/app/core/metrics.py`:

```python
"""
Prometheus metrics for production monitoring.
"""
from prometheus_client import Counter, Histogram, Gauge, Info
import time
from functools import wraps
from typing import Callable, Any

# Request metrics
http_requests_total = Counter(
 'http_requests_total',
 'Total HTTP requests',
 ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
 'http_request_duration_seconds',
 'HTTP request duration',
 ['method', 'endpoint']
)

# Agent metrics
agent_processing_time_seconds = Histogram(
 'agent_processing_time_seconds',
 'Agent processing time',
 ['agent_name', 'user_role']
)

agent_invocations_total = Counter(
 'agent_invocations_total',
 'Total agent invocations',
 ['agent_name', 'user_role', 'intent']
)

agent_errors_total = Counter(
 'agent_errors_total',
 'Total agent errors',
 ['agent_name', 'error_type']
)

# LLM metrics
llm_api_calls_total = Counter(
 'llm_api_calls_total',
 'Total LLM API calls',
 ['model', 'success']
)

llm_api_duration_seconds = Histogram(
 'llm_api_duration_seconds',
 'LLM API call duration',
 ['model']
)

llm_token_usage_total = Counter(
 'llm_token_usage_total',
 'Total LLM tokens used',
 ['model', 'type'] # type: prompt_tokens or completion_tokens
)

# Tool execution metrics
tool_execution_time_seconds = Histogram(
 'tool_execution_time_seconds',
 'Tool execution time',
 ['tool_name', 'success']
)

tool_calls_total = Counter(
 'tool_calls_total',
 'Total tool calls',
 ['tool_name', 'success']
)

# Intervention plan metrics
intervention_plans_created_total = Counter(
 'intervention_plans_created_total',
 'Total intervention plans created',
 ['plan_type']
)

intervention_plan_completion_rate = Gauge(
 'intervention_plan_completion_rate',
 'Intervention plan completion rate',
 ['plan_type']
)

# Crisis metrics
crisis_escalations_total = Counter(
 'crisis_escalations_total',
 'Total crisis escalations',
 ['risk_level', 'escalation_type']
)

crisis_response_time_seconds = Histogram(
 'crisis_response_time_seconds',
 'Crisis response time',
 ['risk_level']
)

# User metrics
active_users_gauge = Gauge(
 'active_users',
 'Currently active users'
)

user_sessions_total = Counter(
 'user_sessions_total',
 'Total user sessions',
 ['user_role']
)

# Database metrics
db_query_duration_seconds = Histogram(
 'db_query_duration_seconds',
 'Database query duration',
 ['operation', 'table']
)

db_connection_pool_size = Gauge(
 'db_connection_pool_size',
 'Database connection pool size',
 ['pool_name']
)

# System info
system_info = Info('system_info', 'System information')
system_info.info({
 'application': 'UGM-AICare',
 'version': '1.0.0',
 'environment': 'production'
})


# Decorator for tracking agent metrics
def track_agent_metrics(agent_name: str):
 """
 Decorator to track agent processing metrics.
 
 Usage:
 @track_agent_metrics("STA")
 async def assess_message(...):...
 """
 def decorator(func: Callable) -> Callable:
 @wraps(func)
 async def wrapper(*args, **kwargs):
 start_time = time.time()
 success = True
 error_type = None
 
 try:
 result = await func(*args, **kwargs)
 
 # Extract metadata from result
 user_role = kwargs.get('user_role', 'unknown')
 intent = result.get('intent', 'unknown') if isinstance(result, dict) else 'unknown'
 
 # Increment invocation counter
 agent_invocations_total.labels(
 agent_name=agent_name,
 user_role=user_role,
 intent=intent
 ).inc()
 
 return result
 
 except Exception as e:
 success = False
 error_type = type(e).__name__
 agent_errors_total.labels(
 agent_name=agent_name,
 error_type=error_type
 ).inc()
 raise
 
 finally:
 # Record processing time
 duration = time.time() - start_time
 agent_processing_time_seconds.labels(
 agent_name=agent_name,
 user_role=kwargs.get('user_role', 'unknown')
 ).observe(duration)
 
 return wrapper
 return decorator


# Decorator for tracking tool execution
def track_tool_metrics(tool_name: str):
 """
 Decorator to track tool execution metrics.
 
 Usage:
 @track_tool_metrics("get_user_profile")
 async def get_user_profile(...):...
 """
 def decorator(func: Callable) -> Callable:
 @wraps(func)
 async def wrapper(*args, **kwargs):
 start_time = time.time()
 success = True
 
 try:
 result = await func(*args, **kwargs)
 if isinstance(result, dict) and not result.get('success', True):
 success = False
 return result
 
 except Exception:
 success = False
 raise
 
 finally:
 duration = time.time() - start_time
 tool_execution_time_seconds.labels(
 tool_name=tool_name,
 success=str(success)
 ).observe(duration)
 
 tool_calls_total.labels(
 tool_name=tool_name,
 success=str(success)
 ).inc()
 
 return wrapper
 return decorator
```

Update `backend/app/main.py`:

```python
from prometheus_client import make_asgi_app
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="UGM-AICare API",...)

# Add Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Instrument FastAPI app
Instrumentator().instrument(app).expose(app, endpoint="/metrics/fastapi")
```

Update agent adapters to use metrics:

```python
from app.core.metrics import track_agent_metrics, agent_processing_time_seconds

class SafetyTriageAgent:
 @track_agent_metrics("STA")
 async def assess_message(self,...):
 # Existing code...
```

#### **Deploy Prometheus + Grafana:**

Operational note: a Compose-based monitoring stack previously existed in this repository, but it has been removed.

```yaml
version: '3.8'

services:
 prometheus:
 image: prom/prometheus:latest
 container_name: prometheus
 ports:
 - "9090:9090"
 volumes:
 -./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
 - prometheus-data:/prometheus
 command:
 - '--config.file=/etc/prometheus/prometheus.yml'
 - '--storage.tsdb.path=/prometheus'
 - '--web.console.libraries=/usr/share/prometheus/console_libraries'
 - '--web.console.templates=/usr/share/prometheus/consoles'
 networks:
 - monitoring

 grafana:
 image: grafana/grafana:latest
 container_name: grafana
 ports:
 - "3000:3000"
 environment:
 - GF_SECURITY_ADMIN_PASSWORD=admin123
 - GF_USERS_ALLOW_SIGN_UP=false
 volumes:
 - grafana-data:/var/lib/grafana
 -./grafana/dashboards:/etc/grafana/provisioning/dashboards
 -./grafana/datasources:/etc/grafana/provisioning/datasources
 depends_on:
 - prometheus
 networks:
 - monitoring

 node-exporter:
 image: prom/node-exporter:latest
 container_name: node-exporter
 ports:
 - "9100:9100"
 networks:
 - monitoring

 cadvisor:
 image: gcr.io/cadvisor/cadvisor:latest
 container_name: cadvisor
 ports:
 - "8080:8080"
 volumes:
 - /:/rootfs:ro
 - /var/run:/var/run:ro
 - /sys:/sys:ro
 - /var/lib/docker/:/var/lib/docker:ro
 networks:
 - monitoring

volumes:
 prometheus-data:
 grafana-data:

networks:
 monitoring:
 driver: bridge
```

Create the corresponding Prometheus configuration in your observability stack (path is illustrative), e.g. `prometheus/prometheus.yml`:

```yaml
global:
 scrape_interval: 15s
 evaluation_interval: 15s

scrape_configs:
 # UGM-AICare Backend
 - job_name: 'ugm-aicare-backend'
 static_configs:
 - targets: ['backend:8000']
 metrics_path: '/metrics'
 
 # Node Exporter (System metrics)
 - job_name: 'node-exporter'
 static_configs:
 - targets: ['node-exporter:9100']
 
 # cAdvisor (Container metrics)
 - job_name: 'cadvisor'
 static_configs:
 - targets: ['cadvisor:8080']
 
 # PostgreSQL Exporter
 - job_name: 'postgres'
 static_configs:
 - targets: ['postgres-exporter:9187']
 
 # Redis Exporter
 - job_name: 'redis'
 static_configs:
 - targets: ['redis-exporter:9121']

# Alert rules
rule_files:
 - 'alert_rules.yml'
```

---

## 3. Infrastructure Setup

### **Production Deployment Architecture**

```text
 ┌─────────────────┐
 │ Load Balancer │
 │ (Nginx) │
 └────────┬────────┘
 │
 ┌──────────────────┼──────────────────┐
 │ │ │
 ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
 │ Backend 1 │ │ Backend 2 │ │ Backend 3 │
 │ (FastAPI) │ │ (FastAPI) │ │ (FastAPI) │
 └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
 │ │ │
 └──────────────────┼──────────────────┘
 │
 ┌──────────┴──────────┐
 │ │
 ┌──────▼──────┐ ┌──────▼──────┐
 │ PostgreSQL │ │ Redis │
 │ (Primary) │ │ (Cache) │
 └──────┬──────┘ └─────────────┘
 │
 ┌──────▼──────┐
 │ PostgreSQL │
 │ (Replica) │
 └─────────────┘
```

### **Docker Compose for Production**

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
 nginx:
 image: nginx:alpine
 ports:
 - "80:80"
 - "443:443"
 volumes:
 -./nginx/nginx.conf:/etc/nginx/nginx.conf
 -./nginx/ssl:/etc/nginx/ssl
 depends_on:
 - backend-1
 - backend-2
 networks:
 - prod-network

 backend-1:
 build:./backend
 environment:
 - DATABASE_URL=postgresql+asyncpg://user:pass@db-primary:5432/aicare_db
 - REDIS_URL=redis://redis:6379
 - LOG_LEVEL=INFO
 - WORKERS=4
 depends_on:
 - db-primary
 - redis
 networks:
 - prod-network

 backend-2:
 build:./backend
 environment:
 - DATABASE_URL=postgresql+asyncpg://user:pass@db-primary:5432/aicare_db
 - REDIS_URL=redis://redis:6379
 - LOG_LEVEL=INFO
 - WORKERS=4
 depends_on:
 - db-primary
 - redis
 networks:
 - prod-network

 db-primary:
 image: postgres:15-alpine
 environment:
 POSTGRES_DB: aicare_db
 POSTGRES_USER: user
 POSTGRES_PASSWORD: ${DB_PASSWORD}
 volumes:
 - postgres-data:/var/lib/postgresql/data
 # (Optional) If you use DB init scripts, mount them here.
 networks:
 - prod-network

 db-replica:
 image: postgres:15-alpine
 environment:
 POSTGRES_DB: aicare_db
 POSTGRES_USER: user
 POSTGRES_PASSWORD: ${DB_PASSWORD}
 PGDATA: /var/lib/postgresql/data/replica
 command: |
 bash -c "
 rm -rf /var/lib/postgresql/data/replica/*
 pg_basebackup -h db-primary -D /var/lib/postgresql/data/replica -U replicator -v -P --wal-method=stream
 touch /var/lib/postgresql/data/replica/standby.signal
 postgres
 "
 depends_on:
 - db-primary
 networks:
 - prod-network

 redis:
 image: redis:7-alpine
 command: redis-server --appendonly yes
 volumes:
 - redis-data:/data
 networks:
 - prod-network

volumes:
 postgres-data:
 redis-data:

networks:
 prod-network:
 driver: bridge
```

---

## 4. Alerting System

### **Prometheus Alert Rules**

Create the corresponding Prometheus alert rules in your observability stack (path is illustrative), e.g. `prometheus/alert_rules.yml`:

```yaml
groups:
 - name: ugm_aicare_alerts
 interval: 30s
 rules:
 # High Error Rate
 - alert: HighErrorRate
 expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
 for: 5m
 labels:
 severity: critical
 annotations:
 summary: "High error rate detected"
 description: "Error rate is {{ $value }} per second"

 # Slow Response Time
 - alert: SlowResponseTime
 expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
 for: 5m
 labels:
 severity: warning
 annotations:
 summary: "Slow API response time"
 description: "P95 latency is {{ $value }} seconds"

 # Agent Processing Time
 - alert: SlowAgentProcessing
 expr: histogram_quantile(0.95, rate(agent_processing_time_seconds_bucket[5m])) > 5
 for: 5m
 labels:
 severity: warning
 annotations:
 summary: "Slow agent processing detected"
 description: "{{ $labels.agent_name }} P95 time is {{ $value }} seconds"

 # Crisis Escalation Backlog
 - alert: CrisisEscalationBacklog
 expr: rate(crisis_escalations_total[5m]) > 10
 for: 2m
 labels:
 severity: critical
 annotations:
 summary: "High crisis escalation rate"
 description: "{{ $value }} crisis escalations per second"

 # Database Connection Pool Exhaustion
 - alert: DatabaseConnectionPoolLow
 expr: db_connection_pool_size < 5
 for: 2m
 labels:
 severity: warning
 annotations:
 summary: "Database connection pool running low"
 description: "Only {{ $value }} connections available"

 # High Memory Usage
 - alert: HighMemoryUsage
 expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
 for: 5m
 labels:
 severity: warning
 annotations:
 summary: "High memory usage"
 description: "Memory usage is {{ $value | humanizePercentage }}"

 # Container Down
 - alert: ContainerDown
 expr: up == 0
 for: 1m
 labels:
 severity: critical
 annotations:
 summary: "Container {{ $labels.instance }} is down"
 description: "{{ $labels.job }} has been down for more than 1 minute"
```

### **Alert Manager Configuration**

Create the corresponding Alertmanager configuration in your observability stack (path is illustrative), e.g. `alertmanager/alertmanager.yml`:

```yaml
global:
 resolve_timeout: 5m

route:
 group_by: ['alertname', 'cluster']
 group_wait: 10s
 group_interval: 10s
 repeat_interval: 12h
 receiver: 'team-notifications'
 routes:
 - match:
 severity: critical
 receiver: 'critical-alerts'
 continue: true
 
 - match:
 severity: warning
 receiver: 'warning-alerts'

receivers:
 - name: 'team-notifications'
 slack_configs:
 - api_url: 'YOUR_SLACK_WEBHOOK_URL'
 channel: '#ugm-aicare-alerts'
 title: 'UGM-AICare Alert'
 text: '{{ range.Alerts }}{{.Annotations.description }}{{ end }}'

 - name: 'critical-alerts'
 slack_configs:
 - api_url: 'YOUR_SLACK_WEBHOOK_URL'
 channel: '#ugm-aicare-critical'
 title: '🚨 CRITICAL: UGM-AICare'
 text: '{{ range.Alerts }}{{.Annotations.description }}{{ end }}'
 
 pagerduty_configs:
 - service_key: 'YOUR_PAGERDUTY_KEY'

 - name: 'warning-alerts'
 slack_configs:
 - api_url: 'YOUR_SLACK_WEBHOOK_URL'
 channel: '#ugm-aicare-warnings'
 title: '[Warning] Warning: UGM-AICare'
 text: '{{ range.Alerts }}{{.Annotations.description }}{{ end }}'

inhibit_rules:
 - source_match:
 severity: 'critical'
 target_match:
 severity: 'warning'
 equal: ['alertname', 'cluster']
```

---

## 5. Dashboard Setup

### **Grafana Dashboard JSON**

Save this as a Grafana dashboard JSON in your observability stack (path is illustrative), e.g. `grafana/dashboards/ugm-aicare-overview.json`:

```json
{
 "dashboard": {
 "title": "UGM-AICare Production Overview",
 "panels": [
 {
 "title": "Request Rate",
 "targets": [
 {
 "expr": "rate(http_requests_total[5m])",
 "legendFormat": "{{method}} {{endpoint}}"
 }
 ]
 },
 {
 "title": "Response Time (P95)",
 "targets": [
 {
 "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
 "legendFormat": "P95"
 }
 ]
 },
 {
 "title": "Agent Processing Time",
 "targets": [
 {
 "expr": "rate(agent_processing_time_seconds_sum[5m]) / rate(agent_processing_time_seconds_count[5m])",
 "legendFormat": "{{agent_name}}"
 }
 ]
 },
 {
 "title": "Crisis Escalations",
 "targets": [
 {
 "expr": "rate(crisis_escalations_total[5m])",
 "legendFormat": "{{risk_level}}"
 }
 ]
 },
 {
 "title": "Intervention Plans Created",
 "targets": [
 {
 "expr": "rate(intervention_plans_created_total[1h])",
 "legendFormat": "{{plan_type}}"
 }
 ]
 },
 {
 "title": "Active Users",
 "targets": [
 {
 "expr": "active_users",
 "legendFormat": "Active Users"
 }
 ]
 }
 ]
 }
}
```

Access Grafana:

- URL: `http://your-server:3000`
- Default credentials: `admin / admin123`
- Import dashboard: Upload the JSON file

---

## 6. Mental Health Specific Metrics

### **Custom Metrics for Mental Health Platform**

```python
# Crisis Response Metrics
crisis_response_time_by_counselor = Histogram(
 'crisis_response_time_by_counselor_seconds',
 'Time taken by counselor to respond to crisis',
 ['counselor_id', 'risk_level']
)

# User Engagement Metrics
daily_active_users = Gauge(
 'daily_active_users',
 'Number of daily active users'
)

user_session_duration_seconds = Histogram(
 'user_session_duration_seconds',
 'User session duration',
 ['user_role']
)

# Intervention Effectiveness
intervention_plan_steps_completed = Counter(
 'intervention_plan_steps_completed_total',
 'Total intervention plan steps completed',
 ['plan_type', 'step_number']
)

intervention_plan_abandonment_rate = Gauge(
 'intervention_plan_abandonment_rate',
 'Rate of abandoned intervention plans',
 ['plan_type']
)

# Therapeutic Outcomes
mood_improvement_score = Gauge(
 'mood_improvement_score',
 'Average mood improvement score',
 ['intervention_type']
)

# Safety Metrics
safety_triage_accuracy = Gauge(
 'safety_triage_accuracy',
 'Accuracy of safety triage assessment',
 ['risk_level']
)

false_positive_rate = Gauge(
 'false_positive_crisis_rate',
 'Rate of false positive crisis detections'
)

# Counselor Performance
counselor_case_load = Gauge(
 'counselor_case_load',
 'Number of active cases per counselor',
 ['counselor_id']
)

counselor_response_satisfaction = Gauge(
 'counselor_response_satisfaction_score',
 'User satisfaction with counselor response',
 ['counselor_id']
)
```

---

## 7. Practical Monitoring Commands

### **View Logs in Production**

```bash
# Real-time logs from all containers
docker compose logs -f

# Logs from specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend

# Search logs for errors
docker compose logs backend | grep -i error

# Follow logs with timestamp
docker compose logs -f -t backend

# Export logs to file
docker compose logs --no-color backend > backend-logs.txt
```

### **Query Prometheus Metrics**

```bash
# Check if target is up
curl http://localhost:9090/api/v1/query?query=up

# Get current error rate
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])'

# Get agent processing times
curl 'http://localhost:9090/api/v1/query?query=agent_processing_time_seconds'
```

### **Kibana Log Queries**

```text
# Find all errors
level: ERROR

# Find slow therapeutic-coach processing (TCA path)
app.agent: "aika::sca" AND app.processing_time_ms: >5000

# Find crisis escalations
message: "crisis" AND app.risk_level: "critical"

# Find intervention plan creations
message: "intervention plan created"
```

---

## 8. Cost Estimation

### **Self-Hosted ELK + Prometheus + Grafana**

- **Infrastructure**: $50-200/month (depending on traffic)
- **Storage**: $10-50/month (for logs/metrics retention)
- **Total**: **$60-250/month**

### **Managed Services (DataDog, NewRelic)**

- **Cost**: $300-1000/month
- **Benefit**: Zero maintenance, enterprise support

---

## 9. Quick Start Checklist

- [ ] Enable structured JSON logging
- [ ] Deploy ELK stack for log aggregation
- [ ] Deploy Prometheus + Grafana for metrics
- [ ] Configure alert rules for critical metrics
- [ ] Set up Slack/email notifications
- [ ] Create custom dashboards for mental health metrics
- [ ] Test alerting system with simulated failures
- [ ] Document runbook for common incidents
- [ ] Train team on using Kibana and Grafana
- [ ] Set up automated backups for metrics/logs

---

## 10. Resources

- **ELK Stack Docs**: [https://www.elastic.co/guide/](https://www.elastic.co/guide/)
- **Prometheus Docs**: [https://prometheus.io/docs/](https://prometheus.io/docs/)
- **Grafana Docs**: [https://grafana.com/docs/](https://grafana.com/docs/)
- **FastAPI Metrics**: [https://github.com/trallnag/prometheus-fastapi-instrumentator](https://github.com/trallnag/prometheus-fastapi-instrumentator)
- **Mental Health Metrics**: See `docs/MENTAL_HEALTH_METRICS.md`

---

**For questions or support, contact the DevOps team or check the internal wiki.**
