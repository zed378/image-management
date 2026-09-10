# Image Delivery Protocol

This is the platform's primary contract, on equal footing with API/ -- not a sub-topic of it. It defines the wire-level protocol that connects asset -> transformation -> cache -> CDN -> consumer: the canonical URL format, every transformation parameter and how they compose, the transformation pipeline order, derivative identity, cache-key derivation, and HTTP-level delivery semantics (caching, conditional requests, range requests, content negotiation). API/10-ASSET-API.md and API/11-UPLOAD-API.md govern how an asset is *managed*; this category governs how an asset is *consumed*. The two must never define the same parameter differently -- where they overlap (e.g. IMAGE-TRANSFORMATION-API.md vs. this category's 03/04), API/13-IMAGE-TRANSFORMATION-API.md defers to this category as the normative source and simply references it.

## Documents

- [`00-PROTOCOL-OVERVIEW.md`](./00-PROTOCOL-OVERVIEW.md) -- Protocol Overview
- [`01-DESIGN-PRINCIPLES.md`](./01-DESIGN-PRINCIPLES.md) -- Design Principles
- [`02-ASSET-URL-SPECIFICATION.md`](./02-ASSET-URL-SPECIFICATION.md) -- Asset URL Specification
- [`03-TRANSFORMATION-URL-SPECIFICATION.md`](./03-TRANSFORMATION-URL-SPECIFICATION.md) -- Transformation URL Specification
- [`04-TRANSFORMATION-PARAMETERS.md`](./04-TRANSFORMATION-PARAMETERS.md) -- Transformation Parameters
- [`05-RESIZE-PROTOCOL.md`](./05-RESIZE-PROTOCOL.md) -- Resize Protocol
- [`06-CROP-PROTOCOL.md`](./06-CROP-PROTOCOL.md) -- Crop Protocol
- [`07-FIT-PROTOCOL.md`](./07-FIT-PROTOCOL.md) -- Fit Protocol
- [`08-POSITION-PROTOCOL.md`](./08-POSITION-PROTOCOL.md) -- Position Protocol
- [`09-FOCAL-POINT-PROTOCOL.md`](./09-FOCAL-POINT-PROTOCOL.md) -- Focal Point Protocol
- [`10-ASPECT-RATIO-PROTOCOL.md`](./10-ASPECT-RATIO-PROTOCOL.md) -- Aspect Ratio Protocol
- [`11-QUALITY-PROTOCOL.md`](./11-QUALITY-PROTOCOL.md) -- Quality Protocol
- [`12-FORMAT-NEGOTIATION.md`](./12-FORMAT-NEGOTIATION.md) -- Format Negotiation
- [`13-DPR-AND-RESPONSIVE-IMAGES.md`](./13-DPR-AND-RESPONSIVE-IMAGES.md) -- DPR & Responsive Images
- [`14-SRCSET-AND-SIZES.md`](./14-SRCSET-AND-SIZES.md) -- Srcset & Sizes
- [`15-IMAGE-NEGOTIATION.md`](./15-IMAGE-NEGOTIATION.md) -- Image Negotiation
- [`16-TRANSFORMATION-PIPELINE.md`](./16-TRANSFORMATION-PIPELINE.md) -- Transformation Pipeline
- [`17-DERIVATIVE-IDENTITY.md`](./17-DERIVATIVE-IDENTITY.md) -- Derivative Identity
- [`18-CACHE-KEY-SPECIFICATION.md`](./18-CACHE-KEY-SPECIFICATION.md) -- Cache Key Specification
- [`19-CACHE-CONTROL.md`](./19-CACHE-CONTROL.md) -- Cache Control
- [`20-CDN-DELIVERY-PROTOCOL.md`](./20-CDN-DELIVERY-PROTOCOL.md) -- CDN Delivery Protocol
- [`21-SIGNED-URL-PROTOCOL.md`](./21-SIGNED-URL-PROTOCOL.md) -- Signed URL Protocol
- [`22-URL-EXPIRATION.md`](./22-URL-EXPIRATION.md) -- URL Expiration
- [`23-PRIVATE-IMAGE-DELIVERY.md`](./23-PRIVATE-IMAGE-DELIVERY.md) -- Private Image Delivery
- [`24-ERROR-AND-FALLBACK.md`](./24-ERROR-AND-FALLBACK.md) -- Error & Fallback
- [`25-IMAGE-HEAD-REQUEST.md`](./25-IMAGE-HEAD-REQUEST.md) -- Image HEAD Request
- [`26-CONTENT-TYPE-RULES.md`](./26-CONTENT-TYPE-RULES.md) -- Content-Type Rules
- [`27-HTTP-CACHING.md`](./27-HTTP-CACHING.md) -- HTTP Caching
- [`28-RANGE-REQUESTS.md`](./28-RANGE-REQUESTS.md) -- Range Requests
- [`29-ETAG-AND-CONDITIONAL-REQUESTS.md`](./29-ETAG-AND-CONDITIONAL-REQUESTS.md) -- ETag & Conditional Requests
- [`30-VERSIONING.md`](./30-VERSIONING.md) -- Protocol Versioning
- [`31-COMPATIBILITY.md`](./31-COMPATIBILITY.md) -- Compatibility
- [`32-SECURITY-CONSTRAINTS.md`](./32-SECURITY-CONSTRAINTS.md) -- Security Constraints
- [`33-RATE-LIMITS.md`](./33-RATE-LIMITS.md) -- Rate Limits
- [`34-ABUSE-PREVENTION.md`](./34-ABUSE-PREVENTION.md) -- Abuse Prevention
- [`35-PERFORMANCE-REQUIREMENTS.md`](./35-PERFORMANCE-REQUIREMENTS.md) -- Performance Requirements
- [`36-OBSERVABILITY.md`](./36-OBSERVABILITY.md) -- Delivery Observability
- [`37-PROTOCOL-TESTING.md`](./37-PROTOCOL-TESTING.md) -- Protocol Conformance Testing
- [`38-REFERENCE-IMPLEMENTATION.md`](./38-REFERENCE-IMPLEMENTATION.md) -- Reference Implementation
- [`39-PROTOCOL-EXAMPLES.md`](./39-PROTOCOL-EXAMPLES.md) -- Protocol Examples
