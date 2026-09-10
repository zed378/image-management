# CDN & Cache

Every distinct combination of transformation parameters is a distinct derivative and therefore a distinct cache entry. These documents define the cache key strategy, TTLs, invalidation, edge delivery topology, and failover so that the platform can serve derivatives at CDN speed without regenerating them per request.

## Documents

- [`00-CDN-ARCHITECTURE.md`](./00-CDN-ARCHITECTURE.md) -- CDN Architecture
- [`01-CACHE-KEY.md`](./01-CACHE-KEY.md) -- Cache Key Strategy
- [`02-CACHE-CONTROL.md`](./02-CACHE-CONTROL.md) -- Cache-Control Headers
- [`03-CACHE-INVALIDATION.md`](./03-CACHE-INVALIDATION.md) -- Cache Invalidation
- [`04-CACHE-TTL.md`](./04-CACHE-TTL.md) -- Cache TTL Policy
- [`05-EDGE-DELIVERY.md`](./05-EDGE-DELIVERY.md) -- Edge Delivery
- [`06-SIGNED-URL-CACHE.md`](./06-SIGNED-URL-CACHE.md) -- Signed URL Caching
- [`07-BANDWIDTH-OPTIMIZATION.md`](./07-BANDWIDTH-OPTIMIZATION.md) -- Bandwidth Optimization
- [`08-CDN-FAILOVER.md`](./08-CDN-FAILOVER.md) -- CDN Failover
