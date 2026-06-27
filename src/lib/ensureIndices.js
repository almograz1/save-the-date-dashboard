/**
 * Guarantee every record carries `savi_mean` and `bsi_mean`.
 *
 * The real Naama 3 export (timeseries.json) includes SAVI (soil-adjusted
 * vegetation index — the canopy-correct index for sparsely-spaced palms) and
 * BSI (bare-soil index — a salt-crust / exposed-ground proxy). The three
 * synthetic blocks don't, and `extendToToday` appends modeled points without
 * them. This fills the gaps deterministically from NDVI so the SAVI/BSI views
 * work for every block; where the real fields exist they are left untouched.
 *
 * Relationships are fitted to the real Naama 3 series:
 *   SAVI ≈ 0.80·NDVI            (SAVI reads below NDVI on sparse arid canopy)
 *   BSI  ≈ 0.411 − 1.40·NDVI    (more bare/dry soil when vegetation is sparse)
 */
export function ensureIndices(data) {
  return data.map((d) => {
    if (typeof d.savi_mean === 'number' && typeof d.bsi_mean === 'number') return d
    const out = { ...d }
    if (typeof out.savi_mean !== 'number') {
      out.savi_mean = +(d.ndvi_mean * 0.8).toFixed(4)
    }
    if (typeof out.bsi_mean !== 'number') {
      out.bsi_mean = +(0.411 - 1.4 * d.ndvi_mean).toFixed(4)
    }
    return out
  })
}
