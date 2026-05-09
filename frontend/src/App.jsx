import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import FireMap from "./components/FireMap";
import { analyzeCrew, getApiBaseUrl } from "./api/crewTraceApi";
import { applyAnalysisToMock } from "./lib/mergeCrewAnalysis";
import { mockCrews } from "./data/mockCrews";
import {
  hazardZone,
  escapeRoutes,
  cameraLocations,
  windArrows,
} from "./data/mockMapData";

const severityLevels = [
  { level: 1, description: "Minimal risk. Routine monitoring only." },
  { level: 2, description: "Very low risk. Conditions stable." },
  { level: 3, description: "Low risk. Stay alert for changes." },
  { level: 4, description: "Guarded risk. Monitor nearby hazards." },
  { level: 5, description: "Moderate risk. Prepare contingency actions." },
  { level: 6, description: "Elevated risk. Increase check-ins with crew." },
  { level: 7, description: "High risk. Command review recommended." },
  { level: 8, description: "Very high risk. Immediate mitigation advised." },
  { level: 9, description: "Critical risk. Prioritize evacuation planning." },
  { level: 10, description: "Extreme risk. Execute emergency response now." },
];

const getSeverityColor = (level) => {
  const n = Number(level);
  if (!Number.isFinite(n)) return "#94a3b8";
  if (n >= 8) return "#cd2026";
  if (n >= 6) return "#e59323";
  if (n === 5) return "#eab308";
  return "#2e8540";
};

const getSeverityShortLabel = (level) => {
  const n = Number(level);
  if (!Number.isFinite(n)) return "Risk unknown";
  if (n >= 9) return "Critical risk";
  if (n === 8) return "Very high risk";
  if (n === 7) return "High risk";
  if (n === 6) return "Elevated risk";
  if (n === 5) return "Moderate risk";
  if (n === 4) return "Guarded risk";
  return "Low risk";
};

const formatAqi = (aqi) => (aqi == null ? "N/A" : String(aqi));

const initialAnalysisState = () =>
  Object.fromEntries(
    mockCrews.map((c) => [c.unit_id, { status: "pending" }])
  );

export default function App() {
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [focusedCrewId, setFocusedCrewId] = useState(null);
  const [isRiskPanelOpen, setIsRiskPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [analysisByUnitId, setAnalysisByUnitId] = useState(initialAnalysisState);

  const cardRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    const API_BASE = getApiBaseUrl();

    mockCrews.forEach((crew) => {
      analyzeCrew(API_BASE, {
        unit_id: crew.unit_id,
        lat: crew.lat,
        lon: crew.lon,
      })
        .then((data) => {
          if (cancelled) return;
          setAnalysisByUnitId((prev) => ({
            ...prev,
            [crew.unit_id]: { status: "ok", data },
          }));
        })
        .catch((err) => {
          if (cancelled) return;
          setAnalysisByUnitId((prev) => ({
            ...prev,
            [crew.unit_id]: {
              status: "error",
              message: err.message || "Analyze request failed",
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const mergedCrews = useMemo(() => {
    return mockCrews.map((mock) =>
      applyAnalysisToMock(mock, analysisByUnitId[mock.unit_id])
    );
  }, [analysisByUnitId]);

  const selectedCrew =
    mergedCrews.find((crew) => crew.unit_id === selectedCrewId) ?? null;

  const analysisPendingCount = useMemo(
    () =>
      mergedCrews.filter((c) => c.riskSource === "pending").length,
    [mergedCrews]
  );

  const sortedCrews = useMemo(() => {
    return [...mergedCrews].sort((a, b) => {
      const sa = Number(a.risk_score);
      const sb = Number(b.risk_score);
      const da = Number.isFinite(sa) ? sa : -1;
      const db = Number.isFinite(sb) ? sb : -1;
      return db - da || b.last_seen_minutes - a.last_seen_minutes;
    });
  }, [mergedCrews]);

  const filteredCrews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return sortedCrews;

    return sortedCrews.filter((crew) =>
      crew.unit_id.toLowerCase().includes(query)
    );
  }, [searchQuery, sortedCrews]);

  const focusCrewCard = (unitId) => {
    setSelectedCrewId(unitId);
    setFocusedCrewId(unitId);
    setSearchQuery("");

    requestAnimationFrame(() => {
      const cardEl = cardRefs.current[unitId];
      if (!cardEl) return;

      cardEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  return (
    <main
      style={{
        height: "100vh",
        background: "#ffffff",
        fontFamily: '"Source Sans Pro", "Segoe UI", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          background: "#112e51",
          color: "#ffffff",
          borderBottom: "4px solid #205493",
          padding: "16px 24px 20px 24px",
          marginBottom: "16px",
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: "980px", margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontWeight: "700",
              opacity: 0.95,
            }}
          >
            CrewTrace Incident Operations Dashboard
          </p>

          <h1
            style={{
              fontSize: "46px",
              lineHeight: 1.05,
              fontWeight: "700",
              margin: "6px 0 10px 0",
              color: "#ffffff",
            }}
          >
            Crew Trace
          </h1>

          <p
            style={{
              fontSize: "19px",
              lineHeight: 1.35,
              color: "#dce4ef",
              margin: "0 auto",
            }}
          >
            AI-assisted wildfire situational awareness with live crew locations,
            risk scores, and escape route guidance.
          </p>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) 390px",
          gap: "24px",
          alignItems: "stretch",
          width: "100%",
          padding: "0 24px 16px 24px",
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "700",
              margin: "0 0 12px 0",
              color: "#112e51",
              letterSpacing: "0.2px",
            }}
          >
            Live Field Map
          </h2>

          <div style={{ flex: 1, minHeight: 0 }}>
            <FireMap
              crews={mergedCrews}
              hazardZone={hazardZone}
              escapeRoutes={escapeRoutes}
              cameraLocations={cameraLocations}
              windArrows={windArrows}
              selectedCrewId={selectedCrewId}
              onCrewSelect={focusCrewCard}
            />
          </div>
        </div>

        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto",
            minHeight: 0,
            paddingRight: "4px",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              background: "#ffffff",
              border: "1px solid #aeb0b5",
              borderRadius: "4px",
              padding: "10px 12px",
              flexShrink: 0,
            }}
          >
            <label
              htmlFor="crew-name-search"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "700",
                color: "#3d4551",
                marginBottom: "6px",
              }}
            >
              SEARCH CREW
            </label>

            <input
              id="crew-name-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type crew name, e.g. Alpha-3"
              style={{
                width: "100%",
                border: "1px solid #5c5c5c",
                borderRadius: "4px",
                padding: "8px",
                fontWeight: "600",
                color: "#112e51",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            />

            {analysisPendingCount > 0 && (
              <p
                style={{
                  margin: "8px 0 0 0",
                  fontSize: "12px",
                  color: "#205493",
                  fontWeight: "600",
                  lineHeight: 1.35,
                }}
              >
                {`Live risk analysis in progress (${analysisPendingCount} ${
                  analysisPendingCount === 1 ? "crew" : "crews"
                })…`}
                <br />
                Typically 2–6s each.
              </p>
            )}
          </div>

          {filteredCrews.map((crew) => (
            <div
              key={crew.unit_id}
              ref={(el) => {
                cardRefs.current[crew.unit_id] = el;
              }}
              onClick={() => {
                setSelectedCrewId(crew.unit_id);
                setFocusedCrewId(crew.unit_id);
              }}
              style={{
                background: "#ffffff",
                border: "1px solid #aeb0b5",
                borderRadius: "4px",
                padding: "16px",
                boxShadow:
                  focusedCrewId === crew.unit_id
                    ? "0 0 0 2px #205493 inset"
                    : "none",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: "700",
                    margin: 0,
                    color: "#112e51",
                  }}
                >
                  {crew.unit_id}
                </h2>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                    color: "#112e51",
                  }}
                >
                  <span
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      lineHeight: 1.1,
                      fontWeight: "700",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {crew.riskSource === "pending"
                      ? "Analyzing…"
                      : crew.riskSource === "error"
                        ? getSeverityShortLabel(crew.risk_score)
                        : crew.risk_level ?? getSeverityShortLabel(crew.risk_score)}
                  </span>

                  {crew.riskSource !== "pending" && (
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "999px",
                        background: getSeverityColor(crew.risk_score),
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        fontWeight: "800",
                        flexShrink: 0,
                      }}
                    >
                      {Number.isFinite(Number(crew.risk_score))
                        ? crew.risk_score
                        : "?"}
                    </span>
                  )}
                </div>
              </div>

              {crew.riskSource === "error" && (
                <>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      padding: "8px",
                      background: "#fff3cd",
                      border: "1px solid #856404",
                      borderRadius: "4px",
                      fontSize: "13px",
                      color: "#533f03",
                    }}
                  >
                    Live analysis unavailable ({crew.riskErrorMessage}). Showing
                    device telemetry only.
                  </p>
                  <p style={{ margin: "8px 0" }}>
                    <strong>Telemetry note:</strong> {crew.primary_reason}
                  </p>
                </>
              )}

              <p style={{ margin: "8px 0" }}>
                <strong>Last seen:</strong> {crew.last_seen_minutes} min ago
              </p>

              <p style={{ margin: "8px 0" }}>
                <strong>Battery:</strong> {crew.battery}%
              </p>

              <p style={{ margin: "8px 0" }}>
                <strong>Latitude:</strong> {crew.lat}
              </p>

              <p style={{ margin: "8px 0" }}>
                <strong>Longitude:</strong> {crew.lon}
              </p>

              {crew.riskSource === "api" && (
                <>
                  <p style={{ margin: "8px 0", fontSize: "13px", color: "#3d4551" }}>
                    <strong>AI confidence:</strong> {crew.confidence ?? "—"}
                    {crew.analyzed_at && (
                      <>
                        {" "}
                        · <strong>Analyzed:</strong>{" "}
                        {new Date(crew.analyzed_at).toLocaleString()}
                      </>
                    )}
                  </p>

                  <p style={{ margin: "8px 0" }}>
                    <strong>Primary reason:</strong> {crew.primary_reason}
                  </p>

                  {crew.explanation && (
                    <p style={{ margin: "8px 0", lineHeight: 1.35 }}>
                      <strong>AI summary:</strong> {crew.explanation}
                    </p>
                  )}

                  {crew.risk_reasons?.length > 0 && (
                    <div style={{ margin: "8px 0" }}>
                      <strong>Risk factors:</strong>
                      <ul
                        style={{
                          margin: "6px 0 0 0",
                          paddingLeft: "18px",
                          lineHeight: 1.35,
                        }}
                      >
                        {crew.risk_reasons.map((reason, idx) => (
                          <li key={`${crew.unit_id}-rr-${idx}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {crew.weather && (
                    <p style={{ margin: "8px 0", lineHeight: 1.35 }}>
                      <strong>Weather:</strong>{" "}
                      {crew.weather.temperature_f != null
                        ? `${crew.weather.temperature_f}°F`
                        : "—"}
                      , wind {crew.weather.wind_speed ?? "—"} mph{" "}
                      {crew.weather.wind_direction
                        ? `(${crew.weather.wind_direction})`
                        : ""}
                      , humidity {crew.weather.humidity ?? "—"}%, AQI{" "}
                      {formatAqi(crew.weather.aqi)}
                      {crew.weather.confidence && (
                        <> · fusion {crew.weather.confidence}</>
                      )}
                    </p>
                  )}

                  {crew.camera && (
                    <p style={{ margin: "8px 0", lineHeight: 1.35 }}>
                      <strong>Camera:</strong>{" "}
                      {crew.camera.camera_caption ?? "—"}
                      {crew.camera.camera_risk_level && (
                        <> · risk {crew.camera.camera_risk_level}</>
                      )}
                    </p>
                  )}
                </>
              )}

              {crew.riskSource === "pending" && (
                <p
                  style={{
                    margin: "8px 0",
                    fontStyle: "italic",
                    color: "#5c5c5c",
                  }}
                >
                  Requesting full analysis from backend (weather, cameras, AI)…
                </p>
              )}

              {crew.last_seen_minutes > 5 && (
                <p
                  style={{
                    background: "#f9dede",
                    color: "#981b1e",
                    padding: "8px",
                    borderRadius: "2px",
                    fontWeight: "700",
                    textAlign: "center",
                    border: "1px solid #e31c3d",
                  }}
                >
                  Stale location alert. Command should verify status.
                </p>
              )}
            </div>
          ))}
        </aside>
      </section>

      {!isRiskPanelOpen && (
        <button
          type="button"
          onClick={() => setIsRiskPanelOpen(true)}
          style={{
            position: "absolute",
            top: "96px",
            right: "16px",
            zIndex: 901,
            border: "2px solid #205493",
            background: "#ffffff",
            color: "#112e51",
            borderRadius: "999px",
            padding: "8px 12px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Risk Descriptions
        </button>
      )}

      <aside
        aria-hidden={!isRiskPanelOpen}
        style={{
          position: "absolute",
          top: "96px",
          right: "16px",
          width: "460px",
          maxWidth: "calc(100% - 32px)",
          maxHeight: "80vh",
          background: "#ffffff",
          border: "1px solid #9fb3c8",
          boxShadow: "0 10px 24px rgba(17, 46, 81, 0.2)",
          transform: isRiskPanelOpen ? "translateY(0)" : "translateY(-12px)",
          opacity: isRiskPanelOpen ? 1 : 0,
          pointerEvents: isRiskPanelOpen ? "auto" : "none",
          transition: "opacity 180ms ease, transform 180ms ease",
          zIndex: 900,
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 14px",
            borderBottom: "1px solid #c7d2de",
            background: "linear-gradient(180deg, #f5f9fe 0%, #edf3fa 100%)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "700",
              color: "#112e51",
            }}
          >
            Risk Descriptions
          </p>

          <button
            type="button"
            onClick={() => setIsRiskPanelOpen(false)}
            style={{
              border: "1px solid #8aa1ba",
              background: "#ffffff",
              color: "#112e51",
              borderRadius: "4px",
              padding: "5px 10px",
              cursor: "pointer",
              fontWeight: "700",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: "10px 12px",
            overflowY: "auto",
            maxHeight: "calc(80vh - 58px)",
            display: "grid",
            gap: "8px",
            background: "#fcfdff",
          }}
        >
          {severityLevels.map((item) => (
            <div
              key={`risk-panel-${item.level}`}
              style={{
                display: "grid",
                gridTemplateColumns: "34px minmax(0, 1fr)",
                alignItems: "center",
                gap: "10px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                background: "#ffffff",
                padding: "8px 10px",
              }}
            >
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "999px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  background: getSeverityColor(item.level),
                }}
              >
                {item.level}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "#1b1b1b",
                  lineHeight: 1.25,
                  fontSize: "14px",
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </aside>

      <aside
        aria-hidden={selectedCrew === null}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "520px",
          maxWidth: "100%",
          height: "100vh",
          background: "#ffffff",
          borderLeft: "2px solid #205493",
          boxShadow: "-6px 0 18px rgba(0, 0, 0, 0.2)",
          transform: selectedCrew ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px",
            borderBottom: "1px solid #aeb0b5",
            background: "#f0f6fb",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                textTransform: "uppercase",
                color: "#3d4551",
              }}
            >
              Crew Detail
            </p>

            <h3 style={{ margin: "4px 0 0 0", color: "#112e51" }}>
              {selectedCrew ? selectedCrew.unit_id : "Crew"}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCrewId(null)}
            style={{
              border: "1px solid #aeb0b5",
              background: "#ffffff",
              color: "#112e51",
              borderRadius: "2px",
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: "700",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: "14px 16px 20px 16px",
            overflowY: "auto",
            display: "grid",
            gap: "10px",
          }}
        >
          {selectedCrew && (
            <div
              style={{
                border: "1px solid #aeb0b5",
                borderRadius: "4px",
                padding: "12px",
                background: "#f8fbff",
                display: "grid",
                gap: "8px",
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Unit:</strong> {selectedCrew.unit_id}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Risk:</strong>{" "}
                {selectedCrew.riskSource === "pending"
                  ? "Analyzing — score not ready yet"
                  : `${Number.isFinite(Number(selectedCrew.risk_score)) ? selectedCrew.risk_score : "?"}/10 — ${selectedCrew.risk_level ?? getSeverityShortLabel(selectedCrew.risk_score)}`}
              </p>

              {selectedCrew.riskSource === "api" && selectedCrew.confidence && (
                <p style={{ margin: 0, fontSize: "13px", color: "#3d4551" }}>
                  <strong>Analysis confidence:</strong> {selectedCrew.confidence}
                  {selectedCrew.analyzed_at && (
                    <>
                      {" "}
                      · {new Date(selectedCrew.analyzed_at).toLocaleString()}
                    </>
                  )}
                </p>
              )}

              {selectedCrew.riskSource === "error" && (
                <p style={{ margin: 0, color: "#981b1e" }}>
                  <strong>Analysis:</strong> unavailable —{" "}
                  {selectedCrew.riskErrorMessage}
                </p>
              )}

              <p style={{ margin: 0 }}>
                <strong>Last seen:</strong> {selectedCrew.last_seen_minutes}{" "}
                min ago
              </p>

              <p style={{ margin: 0 }}>
                <strong>Battery:</strong> {selectedCrew.battery}%
              </p>

              <p style={{ margin: 0 }}>
                <strong>Latitude:</strong> {selectedCrew.lat}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Longitude:</strong> {selectedCrew.lon}
              </p>

              {selectedCrew.riskSource === "api" && (
                <>
                  <p style={{ margin: 0 }}>
                    <strong>Primary reason:</strong> {selectedCrew.primary_reason}
                  </p>

                  {selectedCrew.explanation && (
                    <p style={{ margin: 0, lineHeight: 1.4 }}>
                      <strong>AI explanation:</strong> {selectedCrew.explanation}
                    </p>
                  )}

                  {selectedCrew.risk_reasons?.length > 0 && (
                    <div style={{ margin: 0 }}>
                      <strong>Risk factors:</strong>
                      <ul
                        style={{
                          margin: "6px 0 0 0",
                          paddingLeft: "18px",
                          lineHeight: 1.4,
                        }}
                      >
                        {selectedCrew.risk_reasons.map((reason, idx) => (
                          <li key={`detail-rr-${idx}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCrew.weather && (
                    <div
                      style={{
                        margin: 0,
                        padding: "10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>Weather</strong>
                      <p style={{ margin: "6px 0 0 0", lineHeight: 1.4 }}>
                        {selectedCrew.weather.temperature_f != null
                          ? `${selectedCrew.weather.temperature_f}°F`
                          : "—"}
                        , wind {selectedCrew.weather.wind_speed ?? "—"} mph{" "}
                        {selectedCrew.weather.wind_direction
                          ? `from ${selectedCrew.weather.wind_direction}`
                          : ""}
                        , humidity {selectedCrew.weather.humidity ?? "—"}%, AQI{" "}
                        {formatAqi(selectedCrew.weather.aqi)}
                        {selectedCrew.weather.confidence && (
                          <> · {selectedCrew.weather.confidence} confidence</>
                        )}
                      </p>
                    </div>
                  )}

                  {selectedCrew.camera && (
                    <div
                      style={{
                        margin: 0,
                        padding: "10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>Camera</strong>
                      <p style={{ margin: "6px 0 0 0", lineHeight: 1.4 }}>
                        {selectedCrew.camera.camera_caption ?? "—"}
                      </p>
                      <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>
                        Available:{" "}
                        {selectedCrew.camera.camera_available ? "yes" : "no"} ·
                        Visibility: {selectedCrew.camera.visibility_status ?? "—"}{" "}
                        · Hazard:{" "}
                        {selectedCrew.camera.hazard_detected ? "yes" : "no"}
                      </p>
                      {selectedCrew.camera.image_url && (
                        <a
                          href={selectedCrew.camera.image_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "13px", fontWeight: "700" }}
                        >
                          Open camera image
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}

              {selectedCrew.riskSource === "api" &&
                selectedCrew.recommended_command_review && (
                  <p
                    style={{
                      marginTop: "8px",
                      padding: "10px",
                      background: "#eef6ff",
                      borderLeft: "4px solid #205493",
                      color: "#112e51",
                      fontWeight: "600",
                    }}
                  >
                    <strong>Recommended command review:</strong>{" "}
                    {selectedCrew.recommended_command_review}
                  </p>
                )}

              {selectedCrew.riskSource !== "api" && (
                <p
                  style={{
                    marginTop: "8px",
                    padding: "10px",
                    background: "#eef6ff",
                    borderLeft: "4px solid #205493",
                    color: "#112e51",
                    fontWeight: "600",
                  }}
                >
                  Full AI briefing appears after backend analysis completes.
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}