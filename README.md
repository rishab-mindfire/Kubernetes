# Kubernetes Application Demonstration

This project demonstrates a multi-service Kubernetes deployment featuring an API service, an aggregator service, and Redis for storage, exposed via an Nginx Ingress Controller.

---

## Architecture

The application uses path-based routing to expose microservices:

/api/ -> api-service (Port 4001)
/aggregator/ -> aggregator-service (Port 4002)

internal services :
worker (for task performing)
redies (task data, time store)

kube have ingress also wich is adding /api and /aggregator

### Prerequisites

Minikube installed and running.
Ingress addon enabled (minikube addons enable ingress).
kubectl configured.

### file folder structure

kubernetes/
-aggregator/
-deployment.yaml
-service.yaml
-api/
-deployment.yaml
-service.yaml
-worker
-deployment.yaml
-service.yaml
-ingress.yaml
dockerfile
docker-compose.yml
src/
-aggregator.ts
-api.ts
-worker.ts
lib/
-metrics.ts
-redis.ts
util/
-errorHandler.ts
-types.ts

### Deployment Steps

Start the Minikube Tunnel (Required to access Ingress on localhost):

```
minikube tunnel
```

Apply Configurations:

```
kubectl apply -f kubernetes/
```

Verify Deployment:

```
kubectl get pods
kubectl get ingress
```

Once the tunnel is active, access the services via:
API: http://127.0.0.1/api/stats

Aggregator: http://127.0.0.1/aggregator/

#### Available Scripts

start redis server from docker image
or
run docker yamal file wich will inwoke services wich will not disturbe port 3001 and 3002 for express server for local development
redis (port 6379)
redis_insight (port 5540 )
api (port 4001)
worker
aggregator (port 4002)
now we can start local development ports
commands for local set-up nodeJS project
npm run dev or
in 3 terminal run
npm run dev:api (port 3001)
npm run dev:worker
npm run dev:aggregator (port 3002)

following commands for kubernet:

minikube start

### env.example for node app

```
NODE_ENV=development
REDIS_URL=redis://:password@123@redis:6379
# Ports for services
API_PORT=3001
AGGREGATOR_PORT=3002

```
