/**
 * Combines static mock telemetry with backend analyze payload.
 * Per backend readme: frontend sends coordinates only; risk comes from API.
 */
export function applyAnalysisToMock(mock, analysisState) {
  if (!analysisState || analysisState.status === "pending") {
    return {
      ...mock,
      riskSource: "pending",
    };
  }

  if (analysisState.status === "error") {
    return {
      ...mock,
      riskSource: "error",
      riskErrorMessage: analysisState.message ?? "Request failed",
    };
  }

  const r = analysisState.data;
  if (!r || typeof r !== "object") {
    return {
      ...mock,
      riskSource: "error",
      riskErrorMessage: "Invalid or empty analyze response",
    };
  }

  const score = Number(r.risk_score);
  const risk_score = Number.isFinite(score) ? score : mock.risk_score;

  const reasons = Array.isArray(r.risk_reasons)
    ? r.risk_reasons.filter((x) => x != null && String(x).trim() !== "")
    : [];

  const questions = Array.isArray(r.recommended_questions)
    ? r.recommended_questions.filter((x) => x != null && String(x).trim() !== "")
    : [];

  return {
    ...mock,
    riskSource: "api",
    lat: Number.isFinite(Number(r.lat)) ? Number(r.lat) : mock.lat,
    lon: Number.isFinite(Number(r.lon)) ? Number(r.lon) : mock.lon,
    risk_score,
    risk_level: r.risk_level ?? null,
    primary_reason: r.primary_reason ?? "—",
    explanation: r.explanation,
    risk_reasons: reasons,
    weather: r.weather && typeof r.weather === "object" ? r.weather : null,
    camera: r.camera && typeof r.camera === "object" ? r.camera : null,
    recommended_command_review: r.recommended_command_review,
    recommended_questions: questions,
    confidence: r.confidence,
    analyzed_at: r.analyzed_at,
  };
}
