# Kubernetes Multi-Service Application

This repository demonstrates a production-ready, multi-service Kubernetes deployment. The architecture features an API service, a data aggregator service, a background worker, and a Redis instance for data storage and caching—all exposed externally via an Nginx Ingress Controller.

---

##Project Architecture Overview

The application utilizes **path-based routing** through an Ingress Controller to expose specific microservices to the outside world, while keeping backend workers and databases securely isolated within the cluster network.

```
                    [ Ingress Controller (Port 80) ]
                                   |
         -------------------------------------------------------------------------------------------------
        |                                                     |                                           |
  /api/* (Port 4001)                                 /aggregator/* (Port 4002)
        |                                                     |
 [ api-service ]                                     [ aggregator-service ]
        |                                                     |
         -----------------------> [ Redis ] <-----------------
                                     ^
                                     |
                              [ worker-service ]

```

### Routing Table

- **External API Entrypoint:** `http://localhost/api/` $\rightarrow$ Forwarded to `api-service` (Port 4001)
- **External Aggregator Entrypoint:** `http://localhost/aggregator/` $\rightarrow$ Forwarded to `aggregator-service` (Port 4002)
- **Internal Services:** `worker` and `redis` (Cluster-private, not exposed via Ingress)

---

## File Structure

To keep the repository clean and scalable, the Kubernetes manifests have been organized into dedicated subdirectories per service, separating configuration (`ingress.yaml`) from workloads.

```text
.
├── kubernetes/                  # Kubernetes Manifests
│   ├── ingress.yaml             # Global Nginx Ingress Routing
│   ├── api/                     # API Service Manifests
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── aggregator/              # Aggregator Service Manifests
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── worker/                  # Background Worker Manifests
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── redis/                   # Redis Infrastructure (Recommended Addition)
│       ├── deployment.yaml
│       └── service.yaml
├── src/                         # TypeScript Application Source
│   ├── api.ts
│   ├── aggregator.ts
│   └── worker.ts
├── lib/                         # Shared Libraries
│   ├── metrics.ts
│   └── redis.ts
├── util/                        # Shared Utilities & Types
│   ├── errorHandler.ts
│   └── types.ts
├── Dockerfile
├── docker-compose.yml           # Local Development Orchestration
├── package.json
└── .env.example

```

---

## Local Development Setup

You can run the entire infrastructure locally using Docker Compose, allowing you to develop code on your local machine while interacting with containerized backing services.

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
NODE_ENV=development
REDIS_URL=redis://:password123@localhost:6379

# Local Express Server Ports
API_PORT=3001
AGGREGATOR_PORT=3002
WORKER_METRICS_PORT=3003

```

### 2. Spin Up Infrastructure Containers

Run the following command to start Redis, Redis Insight, and default configurations without binding conflicts on ports `3001` and `3002` and `3003`:

```bash
docker-compose up -d

```

- **Redis:** `localhost:6379`
- **Redis Insight UI:** `http://localhost:5540`

### 3. Start Local Node.js Services

Open three separate terminal windows to run your microservices in development mode:

```bash
# Terminal 1: API Service (Runs on Port 3001)
npm run dev:api

# Terminal 2: Aggregator Service (Runs on Port 3002)
npm run dev:aggregator

# Terminal 3: Background Worker
npm run dev:worker

```

_Alternatively, if configured in your `package.json`, run all simultaneously:_ `npm run dev`

---

### Kubernetes Deployment Steps

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed and running.
- `kubectl` CLI configured to point to your Minikube cluster.
- Ingress addon enabled inside Minikube.

```bash
# Start Minikube cluster
minikube start

# Enable Nginx Ingress Controller
minikube addons enable ingress

```

### 1. Start the Minikube Tunnel

Because Ingress controllers rely on cloud load balancers, you **must** keep a routing tunnel open in a dedicated terminal window to route traffic to `localhost`:

```bash
minikube tunnel

```

### 2. Apply Configurations

Deploy all manifests recursively from the structured `kubernetes/` folder:

```bash
kubectl apply -f kubernetes/

```

### 3. Verify the Cluster Status

Ensure all resources are spawned successfully and the Ingress resource has been assigned an IP address:

```bash
# Check Pod status
kubectl get pods

# Check Services configuration
kubectl get svc

# Check Ingress routing rules
kubectl get ingress

# map web port for ngnix
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 80:80

# for metrics and charts visualization
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090 -n monitoring
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring

# logs for worker service
kubectl logs -l app=worker -f

#get credentials for grafana
 $secret = kubectl get secret monitoring-grafana -n monitoring -o jsonpath="{.data.admin-password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secret))

# load tesing through file
.\load_test.ps1


```

### 4. Verification Endpoints

Once the tunnel is active and status checks pass, test the deployment using the production ports via Ingress:

- **API Stats Endpoint:** `http://my-app.local/api/stats`
- **Aggregator Metrics Endpoint:** `http://my-app.local/aggregator/metrics`
