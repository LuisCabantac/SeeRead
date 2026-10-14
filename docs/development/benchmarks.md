# Performance goals and benchmarks

## Goals

| Area                             | Goal                                                          | How it is checked                                         |
| -------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Voice tracker update             | p95 < 5 ms on a 10,000-word script (one partial result)       | `tests/integration/performance.test.ts`                   |
| Lost-position global search      | p95 < 50 ms on a 10,000-word script                           | same                                                      |
| Parse + tokenize + display model | < 100 ms for 10,000 words (runs on edit, not per frame)       | same                                                      |
| Auto-scroll frame computation    | p95 < 0.5 ms                                                  | same                                                      |
| Idle CPU                         | No animation frames or timers while not playing               | Code review: rAF loops stop when idle; manual check below |
| Speech recognition               | Faster than real time on a laptop CPU                         | `recognizes_recorded_speech` timing                       |
| UI responsiveness                | Recognition runs on a Rust worker thread, never the UI thread | Architecture (see `speech.rs`)                            |

The tests assert the budgets generously so they hold on slow CI runners; the numbers below are what
was measured.

## Methodology

- **Logic benchmarks:** `npm run bench` runs `tests/integration/performance.test.ts` under Node
  (Vitest). Each operation is timed with `performance.now()` over many iterations; the median and 95th
  percentile are reported. The script is synthetic: 200 paragraphs × 4 sentences with a stage direction
  in each paragraph (9,600 speech tokens).
- **Speech:** `cargo test recognizes_recorded_speech -- --ignored` decodes ~25 s of LibriSpeech audio
  with the bundled int8 model on 2 threads and reports wall time.
- **Idle CPU (manual):** open SeeRead with the teleprompter visible and paused, wait 30 s, and read the
  process CPU in Task Manager / Activity Monitor / `top`.

Results depend on hardware; please include your machine when adding numbers.

## Results

Measured 2026-10-14 on Windows 11, Node 25, debug-free Vitest run (developer laptop):

| Benchmark                        | Median     | p95        |
| -------------------------------- | ---------- | ---------- |
| Parse + tokenize + display model | 4.9 ms     | 10.7 ms    |
| Voice tracker update             | 0.13 ms    | 0.18 ms    |
| Lost-position global search      | 6.3 ms     | 7.7 ms     |
| Auto-scroll frame step           | < 0.001 ms | < 0.001 ms |

Speech recognition (same machine, debug build of the test binary): ~25 s of audio decoded in 1.3 s
(about 19× faster than real time), word accuracy 94% and 96% on the two recordings.

History: the first implementation of the lost-position search took ~157 ms per update on this
script; memoizing fuzzy word similarity brought it to ~6 ms. Note the synthetic script has a small
vocabulary, so a real script's first lost-mode search is slower until the cache warms.
