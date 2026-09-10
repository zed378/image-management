# Architecture

Describes the system as a set of independently deployable services with explicit boundaries: API Gateway, Asset Service, Image Processing Service, Storage Service, CDN, Cache, Queue, Search. The platform is designed storage-agnostic and delivery-agnostic: consumer applications talk to a stable API contract, never to a storage backend or a processing engine directly.

## Documents

- [`00-SYSTEM-ARCHITECTURE.md`](./00-SYSTEM-ARCHITECTURE.md) -- System Architecture
- [`01-ARCHITECTURE-PRINCIPLES.md`](./01-ARCHITECTURE-PRINCIPLES.md) -- Architecture Principles
- [`02-SERVICE-BOUNDARIES.md`](./02-SERVICE-BOUNDARIES.md) -- Service Boundaries
- [`03-COMPONENT-ARCHITECTURE.md`](./03-COMPONENT-ARCHITECTURE.md) -- Component Architecture
- [`04-API-GATEWAY.md`](./04-API-GATEWAY.md) -- API Gateway
- [`05-AUTHENTICATION-SERVICE.md`](./05-AUTHENTICATION-SERVICE.md) -- Authentication Service
- [`06-ASSET-SERVICE.md`](./06-ASSET-SERVICE.md) -- Asset Service
- [`07-METADATA-SERVICE.md`](./07-METADATA-SERVICE.md) -- Metadata Service
- [`08-IMAGE-PROCESSING-SERVICE.md`](./08-IMAGE-PROCESSING-SERVICE.md) -- Image Processing Service
- [`09-STORAGE-SERVICE.md`](./09-STORAGE-SERVICE.md) -- Storage Service
- [`10-CDN-ARCHITECTURE.md`](./10-CDN-ARCHITECTURE.md) -- CDN Architecture
- [`11-CACHE-ARCHITECTURE.md`](./11-CACHE-ARCHITECTURE.md) -- Cache Architecture
- [`12-QUEUE-WORKER-ARCHITECTURE.md`](./12-QUEUE-WORKER-ARCHITECTURE.md) -- Queue & Worker Architecture
- [`13-SEARCH-ARCHITECTURE.md`](./13-SEARCH-ARCHITECTURE.md) -- Search Architecture
- [`14-OBSERVABILITY-ARCHITECTURE.md`](./14-OBSERVABILITY-ARCHITECTURE.md) -- Observability Architecture
- [`15-DEPLOYMENT-ARCHITECTURE.md`](./15-DEPLOYMENT-ARCHITECTURE.md) -- Deployment Architecture
- [`16-DISASTER-RECOVERY.md`](./16-DISASTER-RECOVERY.md) -- Disaster Recovery
