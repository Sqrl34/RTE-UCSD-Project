function getRiskLevel(score) {
  if (score >= 8) return "Critical";
  if (score >= 6) return "Elevated";
  if (score >= 4) return "Moderate";
  return "Low";
}

function clampRiskScore(score) {
  const numberScore = Number(score);

  if (!Number.isFinite(numberScore)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(numberScore), 1), 10);
}

function validateAiRisk(aiRisk) {
  const risk_score = clampRiskScore(aiRisk.risk_score);

  return {
    risk_score,
    risk_level: aiRisk.risk_level || getRiskLevel(risk_score),
    primary_reason:
      aiRisk.primary_reason || "AI identified environmental risk factors.",
    risk_reasons: Array.isArray(aiRisk.risk_reasons)
      ? aiRisk.risk_reasons
      : [],
    explanation:
      aiRisk.explanation ||
      "Risk score was generated from weather and camera conditions.",
    recommended_command_review:
      aiRisk.recommended_command_review ||
      "Command staff should review nearby weather and camera indicators.",
    recommended_questions: Array.isArray(aiRisk.recommended_questions)
      ? aiRisk.recommended_questions
      : []
  };
}

function fallbackRiskScore({ weather, camera }) {
  let score = 1;
  const reasons = [];

  if (Number(weather.wind_speed) >= 15) {
    score += 2;
    reasons.push("Wind speed may increase fire or smoke movement.");
  }

  if (Number(weather.aqi) >= 100) {
    score += 1;
    reasons.push("Air quality is elevated or unhealthy.");
  }

  if (camera.smoke_detected) {
    score += 2;
    reasons.push("Camera detected smoke near the area.");
  }

  if (camera.fire_detected) {
    score += 3;
    reasons.push("Camera detected visible fire near the area.");
  }

  if (camera.visibility_status === "reduced" || camera.visibility_status === "poor") {
    score += 1;
    reasons.push("Camera indicates reduced visibility.");
  }

  const risk_score = clampRiskScore(score);

  return {
    risk_score,
    risk_level: getRiskLevel(risk_score),
    primary_reason: reasons[0] || "No major risk factors detected.",
    risk_reasons: reasons,
    explanation: `Fallback score generated from available weather and camera indicators.`,
    recommended_command_review:
      "Command staff should verify conditions using available field and camera information.",
    recommended_questions: [
      "Are smoke or fire conditions worsening near this location?",
      "Are wind conditions increasing exposure risk near these coordinates?"
    ]
  };
}

module.exports = {
  getRiskLevel,
  clampRiskScore,
  validateAiRisk,
  fallbackRiskScore
};