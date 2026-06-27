/**
 * 1-D Kriging — geostatistical statistical prediction.
 *
 * Re-implements the method from the course notebook (Copy_of_EcoModelsLec4_PCA:
 * pykrige OrdinaryKriging / UniversalKriging) in plain JavaScript so the
 * dashboard can produce statistical forecasts *with an uncertainty band*
 * instead of naive monthly averages.
 *
 *   - Ordinary Kriging (drift: 'none')   — constant unknown mean. Used with a
 *     cyclic day-of-year coordinate to estimate a smooth seasonal curve.
 *   - Universal Kriging (drift: 'linear') — linear trend (pykrige's
 *     `regional_linear` drift). Used to extrapolate a near-term NDMI decline.
 *
 * Every prediction returns both a mean and a kriging variance, so callers get
 * a 95% confidence band for free.
 */

// ── distance functions ──────────────────────────────────────────────────────

export const linearDist = (a, b) => Math.abs(a - b)

// Cyclic distance on a period (e.g. 365 days) — Dec 31 and Jan 1 are 1 apart.
export const cyclicDist = (period) => (a, b) => {
  const d = Math.abs(a - b) % period
  return Math.min(d, period - d)
}

// ── linear algebra: solve A x = b (Gaussian elimination, partial pivoting) ──

function solve(A, b) {
  const n = b.length
  // Work on copies so the caller's matrices stay intact.
  const M = A.map((row) => row.slice())
  const x = b.slice()

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the largest magnitude entry in this column.
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (pivot !== col) {
      ;[M[col], M[pivot]] = [M[pivot], M[col]]
      ;[x[col], x[pivot]] = [x[pivot], x[col]]
    }
    const diag = M[col][col] || 1e-12 // guard against a singular pivot
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / diag
      if (factor === 0) continue
      for (let c = col; c < n; c++) M[r][c] -= factor * M[col][c]
      x[r] -= factor * x[col]
    }
  }
  // Back-substitution.
  const out = new Array(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row]
    for (let c = row + 1; c < n; c++) sum -= M[row][c] * out[c]
    out[row] = sum / (M[row][row] || 1e-12)
  }
  return out
}

// ── variogram fitting (exponential model) ───────────────────────────────────

const variance = (vals) => {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  return vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length
}

// Exponential model: γ(h) = nugget + (sill − nugget)·(1 − e^(−3h/range)).
const expModel = ({ nugget, sill, range }) => (h) =>
  h <= 0 ? 0 : nugget + (sill - nugget) * (1 - Math.exp((-3 * h) / range))

/**
 * Bin the empirical semivariance, then grid-search an exponential model
 * (range × nugget) that best fits it. Sill is fixed to the sample variance.
 */
function fitVariogram(samples, distFn) {
  const z = samples.map((s) => s.z)
  const sill = Math.max(variance(z), 1e-6)

  // Empirical semivariance cloud → bins.
  const lags = []
  let maxLag = 0
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const h = distFn(samples[i].x, samples[j].x)
      lags.push({ h, semi: 0.5 * (z[i] - z[j]) ** 2 })
      if (h > maxLag) maxLag = h
    }
  }
  const nBins = 12
  const binW = maxLag / nBins || 1
  const bins = Array.from({ length: nBins }, () => ({ sum: 0, n: 0, hSum: 0 }))
  for (const { h, semi } of lags) {
    const b = Math.min(nBins - 1, Math.floor(h / binW))
    bins[b].sum += semi
    bins[b].n += 1
    bins[b].hSum += h
  }
  const empirical = bins
    .filter((b) => b.n > 0)
    .map((b) => ({ h: b.hSum / b.n, semi: b.sum / b.n, w: b.n }))

  // Grid search over range and nugget fraction; minimise count-weighted SSE.
  // The nugget is floored (>= 0.1·sill) so the model keeps a measurement-noise
  // term: satellite NDVI is not noise-free, so predictions — and the kriging
  // variance that drives the confidence band — should never collapse to zero
  // even where observations are dense.
  let best = { nugget: 0.1 * sill, sill, range: maxLag / 3 }
  let bestErr = Infinity
  const rangeMin = Math.max(maxLag * 0.1, 1e-3)
  for (let ri = 0; ri < 24; ri++) {
    const range = rangeMin + (maxLag - rangeMin) * (ri / 23)
    for (const frac of [0.1, 0.2, 0.3, 0.45]) {
      const params = { nugget: frac * sill, sill, range }
      const g = expModel(params)
      let err = 0
      for (const e of empirical) err += e.w * (g(e.h) - e.semi) ** 2
      if (err < bestErr) {
        bestErr = err
        best = params
      }
    }
  }
  return { ...best, gamma: expModel(best) }
}

// ── kriging predictor ───────────────────────────────────────────────────────

// Drift basis: Ordinary Kriging = [1]; Universal (linear) = [1, x].
const driftBasis = (drift) => (x) => (drift === 'linear' ? [1, x] : [1])

/**
 * Build a kriging predictor from sample points [{ x, z }].
 *
 * @param {Array<{x:number,z:number}>} samples
 * @param {object} [opts]
 * @param {(a:number,b:number)=>number} [opts.distFn]  distance (default linear)
 * @param {'none'|'linear'} [opts.drift]               trend model
 * @returns {{ predict:(x:number)=>{mean:number,variance:number,sd:number},
 *             variogram:object }}
 */
export function krigePredictor(samples, { distFn = linearDist, drift = 'none' } = {}) {
  const n = samples.length

  // Degenerate cases — fall back to a flat mean with the sample spread.
  if (n === 0) {
    return { predict: () => ({ mean: 0, variance: 0, sd: 0 }), variogram: null }
  }
  if (n < 4) {
    const mean = samples.reduce((a, s) => a + s.z, 0) / n
    const sd = Math.sqrt(variance(samples.map((s) => s.z)))
    return { predict: () => ({ mean, variance: sd * sd, sd }), variogram: null }
  }

  const variogram = fitVariogram(samples, distFn)
  const { gamma, sill, nugget } = variogram
  const basis = driftBasis(drift)
  const m = basis(0).length // number of drift terms

  // Assemble the (n+m) kriging system once: [ Γ  F ; Fᵀ 0 ].
  const N = n + m
  const A = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] = gamma(distFn(samples[i].x, samples[j].x))
    }
    A[i][i] += 1e-9 // numerical jitter on the diagonal
    const f = basis(samples[i].x)
    for (let k = 0; k < m; k++) {
      A[i][n + k] = f[k]
      A[n + k][i] = f[k]
    }
  }

  const predict = (x0) => {
    const b = new Array(N).fill(0)
    for (let i = 0; i < n; i++) b[i] = gamma(distFn(samples[i].x, x0))
    const f0 = basis(x0)
    for (let k = 0; k < m; k++) b[n + k] = f0[k]

    const sol = solve(A, b) // weights w (0..n-1) then Lagrange multipliers
    let mean = 0
    for (let i = 0; i < n; i++) mean += sol[i] * samples[i].z

    // Kriging variance: Σ wᵢ·γ(xᵢ,x₀) + Σ μₖ·fₖ(x₀).
    let variance = 0
    for (let i = 0; i < n; i++) variance += sol[i] * b[i]
    for (let k = 0; k < m; k++) variance += sol[n + k] * f0[k]
    // Floor at the nugget: predicting an actual (noisy) measurement, the band
    // never drops below the measurement-noise level — even at a sampled point,
    // where the raw kriging variance would otherwise be exactly zero.
    variance = Math.min(Math.max(variance, nugget), sill * 4)

    return { mean, variance, sd: Math.sqrt(variance) }
  }

  return { predict, variogram }
}
