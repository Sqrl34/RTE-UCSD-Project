const { GoogleGenAI } = require("@google/genai");
const { validateAiRisk, fallbackRiskScore } = require("./riskEngine");

async function generateAiRiskScore({ coordinatePayload, weather, camera }) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackRiskScore({ weather, camera });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
    console.error("Gemini risk scoring failed:", error.message);
    return fallbackRiskScore({ weather, camera });
  }
}

module.exports = {
  generateAiRiskScore
};