# 02 - Image Processing Performance

> Category: **Performance** (`docs/PERFORMANCE/`) &nbsp;|&nbsp; Status: Final (v1 -- measured baseline; production targets open) &nbsp;|&nbsp; Owner: TBD

## Purpose

What one derivative actually costs, measured rather than assumed, and the
encoder settings that follow from it. This document is the evidence behind
`ADR-016`, and it corrects an assumption `ADR-008` and `ADR-015` were both
written on.

---

## Measurement

Run 2026-09-18. The harness was a throwaway spike
(`spikes/image-engine-benchmark/`, deleted after the run); the method is
recorded below in full so it can be rebuilt and re-run, which `P3-01` should
do as a permanent benchmark under `tools/`.

### Environment

| | |
|---|---|
| CPU | Intel Core Ultra 7 255H, 16 logical cores |
| Platform | win32 x64, Node v24.18.0 |
| libvips | 8.17.3 |
| Codecs | libheif 1.20.2, libaom 3.13.1, libwebp 1.6.0, mozjpeg |
| Concurrency | `sharp.concurrency(1)`, `sharp.cache(false)` |
| Iterations | 7 per cell after one warm-up; median reported |

### Method

- **Single-op cost, not throughput.** Concurrency is pinned to 1 and the
  libvips cache disabled, so each figure is the CPU cost of producing *one*
  derivative. Throughput is derived from that at the end. A run with a warm
  cache and default concurrency measures the machine, not the codec.
- **Median of 7 after a warm-up.** Encode time has a long right tail; a mean
  hides it and a single run is noise. The warm-up absorbs one-time libvips
  and codec initialization.
- **Input is a JPEG on disk**, so libvips' shrink-on-load applies exactly as
  in production. Benchmarking from a raw pixel buffer would overstate
  small-output cost by skipping the DCT-scaled decode, which is the largest
  single optimization on the thumbnail path.
- **`fit: inside` with `withoutEnlargement`**, pinning the platform default
  `fit=scale-down` (`ADR-012`). sharp's own default is `cover`, so leaving
  it unset benchmarks a different operation than the one we ship.

### Fixtures

Synthetic, fixed-seed, chosen to **bracket** real traffic rather than
average it. Synthetic content was used because real photographs carry a
licensing question and cannot be committed reproducibly
(`docs/WEBSITE/05-ASSET-SOURCING.md`).

| Fixture | Content | Represents | Source JPEG |
|---|---|---|---|
| `photo-12mp` | layered gradients, grain, soft blobs | a camera photograph | 4000x3000, 2.75 MiB |
| `flat-12mp` | large uniform areas, few hard edges | product-on-white, the dominant e-commerce case | 4000x3000, 0.61 MiB |
| `detail-12mp` | near-uniform high-frequency noise | worst case for every encoder; an upper bound | 4000x3000, 19.95 MiB |

**Limitation, stated plainly:** synthetic content compresses differently
from real content. The *ratios between encoders* transfer well; the
*absolute byte counts* do not, and must be re-measured on the real
photographs before any of them are quoted publicly
(`docs/WEBSITE/03-LANDING-PAGE-COPY.md` PROOF lines).

`detail-12mp` is pure random noise, which no real photograph is. Treat it as
the ceiling, not as a case to optimize for.

---

## Results

Median milliseconds / output KiB, per output width.

### `photo-12mp` -- photographic content

| Encoder | w=320 | w=640 | w=1280 | w=1920 |
|---|---|---|---|---|
| jpeg q78 (mozjpeg) | 71.1 / 3 | 90.4 / 7 | 148 / 19 | 278 / 46 |
| webp q78 effort 4 | 62.4 / 2 | 107 / 4 | 230 / 10 | 474 / 21 |
| webp q78 effort 2 | 67.7 / 2 | 90.1 / 4 | 168 / 10 | 180 / 22 |
| **avif q55 effort 0** | 49.6 / 1 | 66.2 / 3 | 155 / 4 | 277 / 7 |
| **avif q55 effort 1** | 39.4 / 2 | 79.9 / 2 | **120 / 4** | 364 / 7 |
| avif q55 effort 2 | 125 / 2 | 196 / 2 | 231 / 4 | 614 / 7 |
| avif q55 effort 4 | 197 / 1 | 564 / 2 | **1241 / 3** | 1682 / 6 |
| avif q55 effort 6 | 156 / 1 | 372 / 2 | 1245 / 3 | 1902 / 6 |

### `flat-12mp` -- product on white

| Encoder | w=320 | w=640 | w=1280 | w=1920 |
|---|---|---|---|---|
| jpeg q78 | 23.0 / 2 | 54.0 / 4 | 95.5 / 11 | 219 / 21 |
| webp q78 effort 4 | 34.8 / 1 | 56.5 / 2 | 137 / 5 | 238 / 9 |
| webp q78 effort 2 | 17.3 / 1 | 40.7 / 2 | 64.9 / 5 | 137 / 11 |
| avif q55 effort 0 | 20.8 / 1 | 30.1 / 1 | 81.9 / 2 | 151 / 4 |
| avif q55 effort 1 | 28.6 / 1 | 39.9 / 1 | 76.0 / 2 | 204 / 3 |
| avif q55 effort 2 | 35.3 / 1 | 63.6 / 1 | 175 / 2 | 323 / 3 |
| avif q55 effort 4 | 62.9 / 1 | 189 / 1 | 681 / 2 | 1325 / 2 |
| avif q55 effort 6 | 144 / 1 | 395 / 1 | 2113 / 1 | 3696 / 2 |

### `detail-12mp` -- high-frequency noise (ceiling)

| Encoder | w=320 | w=640 | w=1280 | w=1920 |
|---|---|---|---|---|
| jpeg q78 | 336 / 3 | 426 / 31 | 523 / **261** | 1031 / 828 |
| webp q78 effort 4 | 231 / 3 | 296 / 54 | 397 / **408** | 749 / 1173 |
| webp q78 effort 2 | 160 / 3 | 201 / 52 | 376 / 405 | 987 / 1184 |
| avif q55 effort 0 | 317 / 0 | 378 / 66 | 440 / **769** | 1066 / 2346 |
| avif q55 effort 1 | 189 / 0 | 229 / 76 | 593 / 787 | 1198 / 2356 |
| avif q55 effort 2 | 181 / 0 | 305 / 72 | 1152 / 776 | 3481 / 2367 |
| avif q55 effort 4 | 255 / 0 | 2014 / 75 | **19804** / 797 | **24122** / 2395 |
| avif q55 effort 6 | not run | not run | not run | not run |

The `avif effort 6` row on this fixture was **not measured**: the `effort 4`
row had already reached 19.8 s and 24.1 s per operation, the run was
terminated, and the remaining row had no decision value left to add. The
omission is recorded rather than estimated.

The `0 KiB` entries at `w=320` are correct, not an error: downsampling
random noise by 12.5x averages it into near-uniform grey, which every
encoder compresses to under 512 bytes.

---

## Findings

### 1. Effort is the dominant cost variable. Not the format.

| Case | effort 1 | effort 4 | Cost multiple | Byte saving |
|---|---|---|---|---|
| photo @ 1280 | 120 ms | 1241 ms | **10.3x** | 4 KiB -> 3 KiB |
| flat @ 1280 | 76 ms | 681 ms | **9.0x** | no change |
| detail @ 1280 | 593 ms | 19804 ms | **33x** | no change |

Effort 0 and 1 are on one side of a cliff; effort 2 and above are on the
other. Paying 10x to 33x the CPU for at most one kibibyte is never the right
trade for this platform, at any traffic level.

### 2. AVIF at low effort is not expensive. It is cheaper than WebP.

`photo-12mp` at w=1280:

| Encoder | Time | Size | vs JPEG |
|---|---|---|---|
| jpeg q78 | 148 ms | 19 KiB | baseline |
| webp q78 effort 4 | 230 ms | 10 KiB | 1.55x cost, 47% smaller |
| **avif q55 effort 1** | **120 ms** | **4 KiB** | **0.81x cost, 79% smaller** |

AVIF at effort 1 is **faster than JPEG and faster than WebP**, while
producing a file roughly a fifth the size of JPEG. This directly contradicts
the premise that AVIF encoding is inherently an order of magnitude more
expensive -- a premise `ADR-008`'s caveat and `ADR-015`'s entire rationale
were built on, and which the measurement refutes. With libvips 8.17.3 and
libaom 3.13.1, the expensive thing is the *effort setting*, not the codec.

**The library defaults are on the wrong side of the cliff.** sharp defaults
to `effort: 4` for both AVIF and WebP. Shipping the default would multiply
the platform's processing cost by roughly ten for no benefit. This is the
single highest-value finding in the run.

### 3. AVIF is not universally smaller. On noisy content it is worse.

`detail-12mp` at w=1280:

| Encoder | Size |
|---|---|
| jpeg q78 | **261 KiB** |
| webp q78 effort 4 | 408 KiB (+56%) |
| avif q55 effort 0 | **769 KiB (+195%)** |

On high-frequency content AVIF produces a file nearly three times larger
than JPEG, and WebP also loses. This is a known property of AV1's transform:
it is designed for natural images with structure, and near-random detail
defeats it.

So `f=auto` meaning "always AVIF when the client accepts it" is a
**pessimization** for some content -- more expensive to produce *and* larger
to deliver. Pure noise is not real content, so the effect on real
photographs with heavy grain or dense foliage is smaller than this ceiling,
but it is real and it is not rare. `ADR-016` adds a size guard.

### 4. WebP should also run at low effort.

`photo @ 1280`: effort 2 is 168 ms, effort 4 is 230 ms, both 10 KiB. At
w=1920 the gap is wider still (180 ms vs 474 ms, 21-22 KiB). Same cliff,
same conclusion.

### 5. Shrink-on-load is doing substantial work.

`photo-12mp`, jpeg: w=320 is 71 ms, w=1280 is 148 ms. Sixteen times the
output pixels for roughly twice the time, because libjpeg decodes the
4000px source at a reduced DCT scale rather than decoding it fully first.
This is the property that makes the thumbnail path affordable and the reason
the benchmark reads from a JPEG on disk rather than a raw buffer.

---

## Implied capacity

From single-op cost, `photo-12mp` at w=1280:

| Encoder setting | ms | Derivatives / core / s | Cores to sustain 5/s |
|---|---|---|---|
| avif effort 1 | 120 | 8.3 | **0.60** |
| avif effort 0 | 155 | 6.5 | 0.77 |
| jpeg q78 | 148 | 6.8 | 0.74 |
| webp effort 2 | 168 | 6.0 | 0.84 |
| avif effort 4 | 1241 | 0.8 | **6.21** |

At the steady-state transformation rate a 1000 rps delivery workload
implies (roughly 2-5 transforms/s behind a 95-98% edge hit rate), the
correct settings need **well under one core**. The wrong effort setting
needs six. The gap between those two numbers is the entire practical
significance of this benchmark.

The case that still sizes the fleet is burst, not steady state: a catalog
import producing 50,000 cold derivatives at 120 ms each is 6,000
core-seconds of work. That is a queue-and-throughput problem
(`ADR-007`, `P3-09`), not a latency problem.

---

## Production settings

Adopted in `ADR-016`, to be implemented by `P3-01` and `P3-05`:

| Format | Setting | Note |
|---|---|---|
| AVIF | `effort: 1`, quality from the versioned table | Never the library default of 4 |
| WebP | `effort: 2` | Never the library default of 4 |
| JPEG | mozjpeg, progressive | |

Encoder settings are part of the **versioned encoder-settings table** that
participates in `params_hash` (`ADR-014`'s versioned-tables rule): changing
`effort` changes the output bytes for an otherwise identical URL, so it
cannot be changed silently.

## Acceptance Criteria

- [x] Every figure is measured, with the environment, method, iteration
      count, and date recorded.
- [x] The method is recorded in enough detail to rebuild the harness after
      the spike directory was deleted.
- [x] Fixture limitations are stated, including that absolute byte counts do
      not transfer to real content.
- [x] The unmeasured cell is recorded as unmeasured rather than estimated.
- [x] Findings are separated from raw data, and each one names the decision
      it changes.
- [ ] Production targets (p50/p95 transform latency SLOs, per-worker
      concurrency, queue depth thresholds) -- open, owned by `P3-09` and
      `P7-05`.

## Open Questions

- **Re-measure on Linux and on ARM.** This run is Windows x64. Production is
  Linux, and `docs/ENGINEERING/00-CODING-CONTEXT.md` notes ARM as a likely
  price/performance win. The effort cliff will almost certainly hold, but
  the absolute numbers will not.
- **Re-measure with real photographs** once
  `docs/WEBSITE/05-ASSET-SOURCING.md`'s eight images are chosen. Required
  before any byte figure is quoted on the marketing site.
- **Quality sweep not run.** Everything here holds quality constant (JPEG/WebP
  78, AVIF 55). The `q=auto` per-format table (`ADR-014`) needs its own
  sweep against a perceptual metric, not just bytes -- `P3-05`.
- **Effort 0 versus 1 is within noise here** (photo @1280: 155 ms vs 120 ms,
  with effort 1 faster, which is implausible as a true ordering). Both are
  on the cheap side of the cliff; picking between them needs more iterations
  and should not be over-read from this run.
- **Concurrency behaviour unmeasured.** These are single-op figures.
  Per-worker concurrency, libvips thread pool interaction, and
  `UV_THREADPOOL_SIZE` tuning are `P3-09`'s.
- `avif effort 6` on `detail-12mp` remains unmeasured.

## Related Documents

- `docs/PERFORMANCE/00-PERFORMANCE-REQUIREMENTS.md`, `07-CONCURRENCY.md`, `09-LOAD-TESTING.md`
- `docs/IMAGE-PROCESSING/09-QUALITY-CONTROL.md`, `10-FORMAT-CONVERSION.md`, `11-IMAGE-OPTIMIZATION.md`
- `docs/IMAGE-DELIVERY-PROTOCOL/12-FORMAT-NEGOTIATION.md` (the negotiation this informs)
- `docs/ARCHITECTURE/08-IMAGE-PROCESSING-SERVICE.md`, `12-QUEUE-WORKER-ARCHITECTURE.md`
- `docs/WEBSITE/03-LANDING-PAGE-COPY.md` (quotes these numbers, after re-measurement)
- `TASKS/PHASE-3-PROCESSING-TRANSFORMATION.md` (`P3-01`, `P3-05`, `P3-09`)
- `MEMORY/DECISIONS.md` (`ADR-008`, `ADR-014`, `ADR-015`, `ADR-016`)
