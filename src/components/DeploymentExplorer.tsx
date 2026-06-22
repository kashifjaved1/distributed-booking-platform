import React, { useState } from 'react';
import { Container, Check, Copy, ChevronRight, Settings } from 'lucide-react';

interface DeployConfig {
  name: string;
  filename: string;
  desc: string;
  language: string;
  content: string;
}

export default function DeploymentExplorer() {
  const [activeConfig, setActiveConfig] = useState<string>('docker-compose');
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const configRegistry: Record<string, DeployConfig> = {
    'dockerfile': {
      name: 'Dockerfile (ASP.NET Core .NET 9)',
      filename: 'Dockerfile',
      desc: 'High-performance multi-stage Docker build utilizing Alpine-based lightweight SDK & ASP.NET runtimes, with non-privileged user access for security hardening.',
      language: 'docker',
      content: `#-----------------------------------------------------------------------------------------------------------------
# Multi-stage container compilation optimizing cold starts and layer caches
#-----------------------------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build-env
WORKDIR /app

# Copy solution files and restore NuGet layers
COPY *.sln ./
COPY Services/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p Services/\${file%.*}/ && mv $file Services/\${file%.*}/; done
RUN dotnet restore

# Copy entire source tree
COPY . ./
WORKDIR /app/Services/BookingService
RUN dotnet publish -c Release -o /app/out --no-restore -r linux-musl-x64 --self-contained false

# Production Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine-composite
WORKDIR /app
COPY --from=build-env /app/out .

# Inject non-root system credentials for container hardened container standards (Security Rule)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health Check constraint
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080
ENTRYPOINT ["dotnet", "BookingService.dll"]`
    },
    'docker-compose': {
      name: 'Docker Compose Topology (Infrastructure)',
      filename: 'docker-compose.yml',
      desc: 'Orchestrates the local network mesh linking PostgreSQL databases, RabbitMQ, and centralized telemetry collectors.',
      language: 'yaml',
      content: `version: '3.8'

services:
  # Message Broker Gateway
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: distributed_rabbitmq
    ports:
      - "5672:5672"   # AMQP protocol
      - "15672:15672" # Management Dashboard portal
    environment:
      RABBITMQ_DEFAULT_USER: enterprise_user
      RABBITMQ_DEFAULT_PASS: saga_secure_pass_9901
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # PostgreSQL Multi-Tenant Database
  postgres_db:
    image: postgres:15-alpine
    container_name: distributed_postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: catalog_administrator
      POSTGRES_PASSWORD: cloud_persistent_secrets
      POSTGRES_MULTIPLE_DATABASES: "BookingDB,SeatDB,PaymentDB,TicketDB"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-multiple-databases.sh:/docker-entrypoint-initdb.d/init-multiple-databases.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U catalog_administrator -d BookingDB"]
      interval: 10s
      timeout: 5s
      retries: 5

  # OpenTelemetry Collector Coordinator
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.82.0
    container_name: otel_collector
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "1888:1888"   # pprof extension
      - "8888:8888"   # Prometheus metrics exporter portal
      - "4317:4317"   # OTLP gRPC receiver endpoint
      - "4318:4318"   # OTLP HTTP receiver endpoint
    depends_on:
      - jaeger

  # Distributed Tracing Endpoint Explorer
  jaeger:
    image: jaegertracing/all-in-one:1.47
    container_name: distributed_jaeger
    ports:
      - "16686:16686" # Web UI portal (Trace viewer)
      - "14250:14250" # OTLP collectors gRPC

  # Metric scraper node
  prometheus:
    image: prom/prometheus:v2.46.0
    container_name: metrics_prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  # Dashboards Renderer
  grafana:
    image: grafana/grafana:10.0.3
    container_name: telemetry_grafana
    ports:
      - "3001:3000" # Mapped to alternative port 3001
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=prometheus_grafana_metrics_portal

volumes:
  rabbitmq_data:
  postgres_data:`
    },
    'k8s': {
      name: 'Kubernetes Scaled Deployment (Production)',
      filename: 'k8s-deployment.yaml',
      desc: 'W3C spec deployments defining state configuration mapping, service discovery routes, and readiness checks.',
      language: 'yaml',
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: booking-service-deployment
  namespace: distributed-booking
  labels:
    component: api-gateway
spec:
  replicas: 3 # Highly resilient active copies
  selector:
    matchLabels:
      app: booking-service
  template:
    metadata:
      labels:
        app: booking-service
    spec:
      containers:
      - name: booking-service
        image: distributedbooking/booking-api:9.0.1
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: saga-configuration-map
        resources:
          limits:
            cpu: "500m"
            memory: "1Gi"
          requests:
            cpu: "250m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: booking-cluster-srv
  namespace: distributed-booking
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
  selector:
    app: booking-service`
    },
    'otel-collector': {
      name: 'OpenTelemetry Collector Config',
      filename: 'otel-collector-config.yaml',
      desc: 'Binds telemetry inputs, sorts namespaces, and exports traces, logs, and metrics pipelines to Jaeger & Prometheus.',
      language: 'yaml',
      content: `#-----------------------------------------------------------------------------------------------------------------
# OpenTelemetry Collector control parameters mapping tracing and scraping parameters
#-----------------------------------------------------------------------------------------------------------------
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 256

  memory_limiter:
    check_interval: 1s
    limit_percentage: 75
    spike_limit_percentage: 15

exporters:
  prometheus:
    endpoint: 0.0.0.0:8888
    namespace: "distributed_booking"

  otlp/jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  logging:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/jaeger, logging]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]`
    }
  };

  const selectedConfig = configRegistry[activeConfig];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="deployment-parameters-view">
      {/* Selector Sidebar */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4" id="deploy-sidebar">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">DevOps Manifest Templates</h3>
        <div className="space-y-1.5" id="deploy-sidebar-list">
          {[
            { id: 'docker-compose', label: 'docker-compose.yml', sub: 'Infrastructure topology' },
            { id: 'dockerfile', label: 'Dockerfile', sub: 'Production container builds' },
            { id: 'k8s', label: 'k8s-deployment.yaml', sub: 'Resilient Kubernetes' },
            { id: 'otel-collector', label: 'otel-collector-config.yaml', sub: 'OTEL Pipeline specs' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveConfig(item.id)}
              className={`w-full text-left p-3.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                activeConfig === item.id 
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400' 
                  : 'border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div>
                <span className="block font-bold">{item.label}</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">{item.sub}</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50 animate-pulse" />
            </button>
          ))}
        </div>
      </div>

      {/* Code Text viewer Window */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900 text-slate-300 rounded-xl overflow-hidden shadow-sm h-[480px]" id="deploy-code-panel">
        <div className="border-b border-slate-800 px-6 py-3 bg-slate-950 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-bold text-xs text-slate-200">{selectedConfig.name}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{selectedConfig.filename}</span>
          </div>
          
          <button
            onClick={() => copyToClipboard(selectedConfig.content)}
            className="p-1 px-2 border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-900 rounded text-[10px] font-bold font-mono text-slate-400 hover:text-white flex items-center gap-1.5 transition-all focus:outline-none"
          >
            {copied ? (
              <>
                <span>COPIED</span>
              </>
            ) : (
              <>
                <span>COPY SPEC</span>
              </>
            )}
          </button>
        </div>

        {/* Short description banner */}
        <div className="bg-slate-950/50 p-4 border-b border-slate-850/40 text-xs leading-relaxed text-slate-450 italic flex items-start gap-2">
          <Settings className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
          <span>{selectedConfig.desc}</span>
        </div>

        <pre className="flex-1 p-6 overflow-auto text-xs font-mono leading-relaxed bg-slate-950 text-slate-350 block select-text focus:outline-none scrollbar-thin overflow-x-auto" id="yaml-spec-screen">
          <code className="block select-text whitespace-pre">
            {selectedConfig.content.split('\n').map((line, idx) => {
              if (line.trim().startsWith('#')) {
                return <span key={idx} className="text-slate-550 italic block">{line}</span>;
              }
              return <span key={idx} className="block min-h-[1.25rem]">{line}</span>;
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
