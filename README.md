# Apollonian Zoom

An interactive infinite-zoom explorer for Apollonian circle packings.

## Explore

- Scroll or pinch to zoom, and drag to pan.
- Click a circle for its exact curvature, rational center, and radius; double-click to focus it.
- **Dive deeper** advances through twelve exact Descartes reflections into a smaller gap.
- **Home** returns to the whole packing. Resizing preserves the current view.

Circle data and camera pivots use BigInt rational arithmetic. Only the final pixel projection uses floating-point numbers. Scale has a separate binary exponent, so zoom is not limited by JavaScript's finite numeric range. Ancestor circles become exact local tangent lines when their curvature differs from a line by less than a quarter pixel across the viewport. Full integers wrap into digit rows where they fit; the inspector retains all digits and offers exact-value copying.

The regression suite covers successive dives with curvatures exceeding 500 digits, deep pointer pivots, valley transitions, and overflowing ancestor circles.

Run tests with `node --test test/*.test.js`. Serve this directory with a static HTTP server. Pushes to `main` deploy to the existing GitHub Pages site.

The exact-value inspector typesets LaTeX with vendored KaTeX 0.16.22 (MIT; see `vendor/katex/LICENSE`).
