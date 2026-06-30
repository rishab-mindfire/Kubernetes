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
  /api/* (Port 4001)                                 /aggregator/* (Port 4002)                            |
        |                                                     |                                           |
 [ api-service ]                                     [ aggregator-service ]                               |
        |                                                     |                                           |
         -----------------------> [ Redis ] <------------------------------------------------------------->
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
├── kubernetes/                     # Kubernetes
│   ├── ingress.yaml                # Global Nginx Ingress Routing
│   ├── configmap.yaml              # Global configuration env file for kubernetics
│   ├── api/                        # API Service
│   │   ├── api-deployment.yaml
│   │   └── api-service.yaml
|   |
│   ├── aggregator/                 # Aggregator Service
│   │   ├── aggregator-deployment.yaml
│   │   └── aggregator-service.yaml
|   |
│   ├── worker/                      # Background Worker
│   │   ├── worker-deployment.yaml
│   │   |── worker-service.yaml
|   |   └── worker-hpa.yaml
|   |
│   |── redis/                       # Redis Infrastructure
│   |   ├── redis-deployment.yaml
│   |   |── redis-service.yaml
|   |   └── redis-pvc.yaml
|   |
│   └── monitoring/                   # monitoring services
|       └── service-monitor.yaml
|
├── src/                              # TypeScript & nodeJS Application
│   ├── api.ts                        # Service A
│   ├── aggregator.ts                 # Service B
│   └── worker.ts                     # Service C
├── lib/                              # Shared Libraries
│   ├── metrics.ts                    # metrics scraping end point
│   └── redis.ts
├── util/                             # Shared Utilities & Types
│   ├── errorHandler.ts
│   └── types.ts
├── Dockerfile
├── docker-compose.yml                # Local Development Orchestration
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

# create docker image and inject to kubernetics
docker build -t my-app-service:v1 . --no-cache

# build file
docker compose up --build

# Explicitly push image it into Minikube
minikube image load my-app-service:v1 --overwrite=true

#check image list
minikube image ls --format table

#remove other images if there any extra version of app
minikube image rm docker.io/library/my-app-service:v1
minikube image rm docker.io/library/my-app-service:v2
minikube image rm docker.io/library/my-app-service:v3


# Force kill the pods stuck in ImagePullBackOff loops
kubectl delete pods --all --grace-period=0 --force

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

Deploy everything recursively

```bash
kubectl apply -f kubernetes/ -R
```

# Add the Prometheus community repo

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

# Install the stack

```bash
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

# check monitoring

```bash
kubectl get pods -n monitoring
```

roll back if any pods need to restart for any services

```bash
kubectl rollout restart deployment aggregator-deployment api-deployment redis-deployment worker-deployment
```

stop everything

```bash
Stop-Process -Name kubectl -Force
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
# check for redis PersistentVolumeClaim
kubectl get pvc

# map web port for ngnix ingress
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 80:80

# get monitoring services
kubectl get svc -n monitoring

# for metrics and charts visualization
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# for api service port forward
kubectl port-forward service/api-service 4001:4001

# logs for worker service
kubectl logs -l app=worker -f
kubectl logs -l app=worker -f --max-log-requests=10

# logs for api service
kubectl logs -l app=api -f

# logs for aggregator service
kubectl logs -l app=aggregator -f

# get
kubectl get secrets -n monitoring

# get credentials for grafana
# 1. Fetch the secret and store it in the variable
$secret = kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}"

# 2. Decode the variable
[System.Text.Encoding]::UTF8.GetString([System.Convert]::Frombash64String($secret))

## load tesing ApacheBench command (5000 req on 150 cuncurrency)
ab -n 500 -c 150 -H "Host: my-app.local" http://localhost:4001/api/submit

# or by autocannon can do load test
npx autocannon -c 150 -a 500 -m POST http://my-app.local/api/submit

#log
kubectl logs -f -l app=worker

#get cpu used % for top node
kubectl top nodes
#get based on local node js OS module
npx nodemon --exec node cpu-logger.js

#get HPA (for worker )
kubectl get hpa worker-hpa -w


#delete all and restart
kubectl delete deployments --all
kubectl delete hpa --all
kubectl delete services --all
kubectl rollout restart deployment coredns -n kube-system

```

### 4. Verification Endpoints

Once the tunnel is active and status checks pass, test the deployment using the production ports via Ingress:

- **API Stats Endpoint:** `http://my-app.local/api/stats`
- **Aggregator Metrics Endpoint:** `http://my-app.local/aggregator/metrics`
