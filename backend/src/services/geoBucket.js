/**
 * Shared geographic bucket for deduping weather + camera work across crews.
 * 2 decimals ≈ 1.1 km — tune with ANALYZE_GEO_BUCKET_DECIMALS (e.g. 3 for tighter).
 */
function getAnalyzeGeoBucketDecimals() {
  const n = Number(process.env.ANALYZE_GEO_BUCKET_DECIMALS);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 2;
}

function geoBucketKey(lat, lon) {
  const p = getAnalyzeGeoBucketDecimals();
  return `${Number(lat).toFixed(p)},${Number(lon).toFixed(p)}`;
}

module.exports = {
  geoBucketKey,
  getAnalyzeGeoBucketDecimals,
};
