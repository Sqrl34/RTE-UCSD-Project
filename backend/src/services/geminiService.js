const { GoogleGenAI } = require("@google/genai");
const { validateAiRisk, fallbackRiskScore } = require("./riskEngine");
const { sanitizeForLogs } = require("../lib/sanitizeForLogs");

/**
 * One Gemini request for the whole dashboard batch (saves free-tier quota).
 * @param {Array<{ coordinatePayload: object, weather: object, camera: object }>} crewAnalyses
 * @returns {Promise<Array<object>>} same length & order as input — each item is validateAiRisk-shaped
 */
async function generateAiRiskScoreBatch(crewAnalyses) {
  if (!crewAnalyses?.length) {
    return [];
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log(
      `[gemini] batch: skipped API (no GEMINI_API_KEY) — ${crewAnalyses.length} local fallback score(s), 0 Gemini calls`
    );
    return crewAnalyses.map((c) =>
      fallbackRiskScore({ weather: c.weather, camera: c.camera })
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    console.log(
      `[gemini] batch: invoking 1× generateContent (model=${model}, crews=${crewAnalyses.length})`
    );

    const payload = crewAnalyses.map((c) => ({
      unit_id: c.coordinatePayload.unit_id,
      lat: c.coordinatePayload.lat,
      lon: c.coordinatePayload.lon,
      weather: c.weather,
      camera: c.camera,
    }));

    const prompt = `
You are an AI wildfire risk analyst for incident command decision support.

Do not directly command firefighters.
Only produce decision-support information for trained command staff.

You will receive multiple crew units. For EACH unit, assign a wildfire risk score from 1 to 10 based on THAT unit's coordinates, weather, and camera data.

Input (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON with this shape (same number of entries as input, same order):
{
  "analyses": [
    {
      "unit_id": "must match input unit_id exactly",
      "risk_score": number,
      "risk_level": "Low | Moderate | Elevated | Critical",
      "primary_reason": "main reason for the score",
      "risk_reasons": ["reason 1", "reason 2"],
      "explanation": "plain-English explanation for this unit",
      "recommended_command_review": "what command staff should review for this unit",
      "confidence": "low | medium | high"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const cleaned = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const arr = parsed.analyses;

    if (!Array.isArray(arr) || arr.length !== crewAnalyses.length) {
      throw new Error("Gemini batch: analyses length mismatch");
    }

    let fallbackRowCount = 0;
    const out = crewAnalyses.map((c, i) => {
      const row = arr[i];
      if (!row || row.unit_id !== c.coordinatePayload.unit_id) {
        fallbackRowCount += 1;
        return fallbackRiskScore({
          weather: c.weather,
          camera: c.camera,
        });
      }
      return validateAiRisk(row);
    });

    console.log(
      `[gemini] batch: 1× generateContent completed → ${out.length} row(s)${
        fallbackRowCount
          ? ` (${fallbackRowCount} row(s) used local fallback)`
          : ""
      }`
    );

    return out;
  } catch (error) {
    console.error("Gemini batch risk scoring failed:", sanitizeForLogs(error.message));
    console.log(
      `[gemini] batch: 0 successful API parse — ${crewAnalyses.length} local fallback score(s) after error`
    );
    return crewAnalyses.map((c) =>
      fallbackRiskScore({ weather: c.weather, camera: c.camera })
    );
  }
}

async function generateAiRiskScore({ coordinatePayload, weather, camera }) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackRiskScore({ weather, camera });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    console.log(
      `[gemini] single: 1× generateContent for unit ${coordinatePayload.unit_id} (model=${model})`
    );

    const prompt = `
You are an AI wildfire risk analyst for incident command decision support.

Do not directly command firefighters.
Only produce decision-support information for trained command staff.

Analyze this data and return a wildfire risk score from 1 to 10.

Coordinates:
${JSON.stringify(coordinatePayload, null, 2)}

Weather:
${JSON.stringify(weather, null, 2)}

Camera:
${JSON.stringify(camera, null, 2)}

Return ONLY valid JSON:
{
  "risk_score": number,
  "risk_level": "Low | Moderate | Elevated | Critical",
  "primary_reason": "main reason for the score",
  "risk_reasons": ["reason 1", "reason 2", "reason 3"],
  "explanation": "plain-English explanation",
  "recommended_command_review": "what command staff should review",
  "recommended_questions": ["question 1", "question 2"],
  "confidence": "low | medium | high"
}
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    const cleaned = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return validateAiRisk(parsed);
  } catch (error) {
    console.error("Gemini risk scoring failed:", sanitizeForLogs(error.message));
    return fallbackRiskScore({ weather, camera });
  }
}

module.exports = {
  generateAiRiskScore,
  generateAiRiskScoreBatch,
};