# Image Processing

Specifies the deterministic pipeline that turns an original asset plus a set of requested parameters (width, height, fit, position, quality, format, DPR) into a derivative image. Determinism matters: the same asset + the same parameter set must always produce a byte-identical (or acceptably equivalent, for lossy re-encodes) result, because that identity is the cache key.

## Documents

- [`00-IMAGE-PROCESSING-OVERVIEW.md`](./00-IMAGE-PROCESSING-OVERVIEW.md) -- Image Processing Overview
- [`01-SUPPORTED-FORMATS.md`](./01-SUPPORTED-FORMATS.md) -- Supported Formats
- [`02-IMAGE-VALIDATION.md`](./02-IMAGE-VALIDATION.md) -- Image Validation
- [`03-IMAGE-RESIZE.md`](./03-IMAGE-RESIZE.md) -- Image Resize
- [`04-IMAGE-CROP.md`](./04-IMAGE-CROP.md) -- Image Crop
- [`05-IMAGE-FIT-MODES.md`](./05-IMAGE-FIT-MODES.md) -- Image Fit Modes
- [`06-IMAGE-POSITION.md`](./06-IMAGE-POSITION.md) -- Image Position
- [`07-FOCAL-POINT.md`](./07-FOCAL-POINT.md) -- Focal Point
- [`08-AUTO-CROP.md`](./08-AUTO-CROP.md) -- Auto Crop
- [`09-QUALITY-CONTROL.md`](./09-QUALITY-CONTROL.md) -- Quality Control
- [`10-FORMAT-CONVERSION.md`](./10-FORMAT-CONVERSION.md) -- Format Conversion
- [`11-IMAGE-OPTIMIZATION.md`](./11-IMAGE-OPTIMIZATION.md) -- Image Optimization
- [`12-METADATA-EXIF.md`](./12-METADATA-EXIF.md) -- Metadata & EXIF
- [`13-ORIENTATION.md`](./13-ORIENTATION.md) -- Orientation
- [`14-COLOR-PROFILE.md`](./14-COLOR-PROFILE.md) -- Color Profile
- [`15-THUMBNAIL-GENERATION.md`](./15-THUMBNAIL-GENERATION.md) -- Thumbnail Generation
- [`16-PROCESSING-FAILURE.md`](./16-PROCESSING-FAILURE.md) -- Processing Failure Handling
