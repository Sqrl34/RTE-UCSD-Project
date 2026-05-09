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
  if (n >= 8) return "#dc2626";
  if (n >= 6) return "#f97316";
  if (n === 5) return "#eab308";
  return "#16a34a";
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
    () => mergedCrews.filter((c) => c.riskSource === "pending").length,
    [mergedCrews]
  );

  const highRiskCount = useMemo(
    () =>
      mergedCrews.filter(
        (crew) =>
          crew.riskSource !== "pending" &&
          Number.isFinite(Number(crew.risk_score)) &&
          Number(crew.risk_score) >= 7
      ).length,
    [mergedCrews]
  );

  const staleCrewCount = useMemo(
    () => mergedCrews.filter((crew) => crew.last_seen_minutes > 5).length,
    [mergedCrews]
  );

  const highestRiskCrew = useMemo(() => {
    return [...mergedCrews].sort((a, b) => {
      const sa = Number(a.risk_score);
      const sb = Number(b.risk_score);
      const da = Number.isFinite(sa) ? sa : -1;
      const db = Number.isFinite(sb) ? sb : -1;
      return db - da;
    })[0];
  }, [mergedCrews]);

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

  const cardText = {
    color: "#334155",
    margin: "8px 0",
    lineHeight: 1.35,
    fontSize: "14px",
  };

  const cardStrong = {
    color: "#0f172a",
    fontWeight: 850,
  };

  const panelText = {
    color: "#334155",
    margin: 0,
    lineHeight: 1.4,
  };

  const glassCard = {
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
    backdropFilter: "blur(12px)",
  };

  return (
    <main
      style={{
        height: "100vh",
        background:
          "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 45%, #fefce8 100%)",
        color: "#0f172a",
        fontFamily: '"Inter", "Source Sans Pro", "Segoe UI", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(224,242,254,0.95))",
          color: "#0f172a",
          borderBottom: "1px solid rgba(14, 165, 233, 0.25)",
          padding: "16px 28px",
          flexShrink: 0,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "20px",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                fontWeight: "900",
                color: "#0284c7",
              }}
            >
              CrewTrace Incident Operations Dashboard
            </p>

            <h1
              style={{
                fontSize: "46px",
                lineHeight: 1,
                fontWeight: "950",
                margin: "6px 0 8px 0",
                color: "#0f172a",
                textShadow: "0 6px 18px rgba(15,23,42,0.08)",
              }}
            >
              Crew Trace
            </h1>

            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.35,
                color: "#475569",
                margin: 0,
              }}
            >
              AI-assisted wildfire situational awareness with live crew
              locations, risk scores, weather context, and escape route
              guidance.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 110px)",
              gap: "12px",
            }}
          >
            <MetricCard label="Crews" value={mergedCrews.length} color="#0369a1" />
            <MetricCard label="High Risk" value={highRiskCount} color="#ea580c" />
            <MetricCard label="Stale" value={staleCrewCount} color="#dc2626" />
            <MetricCard
              label="Analyzing"
              value={analysisPendingCount}
              color="#0284c7"
            />
          </div>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.4fr) 430px",
          gap: "20px",
          alignItems: "stretch",
          width: "100%",
          padding: "18px 24px",
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            padding: "14px",
            ...glassCard,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "25px",
                  fontWeight: "950",
                  margin: 0,
                  color: "#0f172a",
                  letterSpacing: "0.2px",
                }}
              >
                Live Field Map
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                SDSU / Mission Valley sector — weather, camera, and crew telemetry
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRiskPanelOpen(true)}
              style={{
                fontSize: "13px",
                fontWeight: "900",
                color: "#0369a1",
                background: "#e0f2fe",
                border: "1px solid rgba(2, 132, 199, 0.35)",
                borderRadius: "999px",
                padding: "9px 13px",
                cursor: "pointer",
              }}
            >
              Risk Descriptions
            </button>
          </div>

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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            <InfoStrip
              label="Priority Unit"
              value={highestRiskCrew?.unit_id ?? "—"}
            />
            <InfoStrip label="Wind" value="W → E / live weather fused" />
            <InfoStrip label="Camera" value="Smoke / visibility monitoring" />
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
              borderRadius: "18px",
              padding: "14px",
              flexShrink: 0,
              ...glassCard,
            }}
          >
            <label
              htmlFor="crew-name-search"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "900",
                color: "#0284c7",
                marginBottom: "8px",
                letterSpacing: "1px",
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
                border: "1px solid rgba(148, 163, 184, 0.65)",
                borderRadius: "12px",
                padding: "11px 12px",
                fontWeight: "800",
                color: "#0f172a",
                background: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            {analysisPendingCount > 0 && (
              <p
                style={{
                  margin: "10px 0 0 0",
                  fontSize: "12px",
                  color: "#0369a1",
                  fontWeight: "700",
                  lineHeight: 1.35,
                }}
              >
                {`Live risk analysis in progress (${analysisPendingCount} ${
                  analysisPendingCount === 1 ? "crew" : "crews"
                })…`}
                <br />
                Weather, camera, and AI fusion typically completes in 2–6s.
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
                background:
                  focusedCrewId === crew.unit_id
                    ? "linear-gradient(135deg, #ffffff, #e0f2fe)"
                    : "rgba(255,255,255,0.94)",
                border:
                  focusedCrewId === crew.unit_id
                    ? "1px solid rgba(2, 132, 199, 0.65)"
                    : "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: "20px",
                padding: "16px",
                boxShadow:
                  focusedCrewId === crew.unit_id
                    ? "0 0 0 1px rgba(2, 132, 199, 0.2), 0 16px 35px rgba(2, 132, 199, 0.16)"
                    : "0 12px 30px rgba(15,23,42,0.10)",
                textAlign: "left",
                cursor: "pointer",
                color: "#0f172a",
                transition:
                  "transform 160ms ease, border 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "23px",
                      fontWeight: "950",
                      margin: 0,
                      color: "#0f172a",
                    }}
                  >
                    {crew.unit_id}
                  </h2>

                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#64748b",
                      fontSize: "13px",
                      fontWeight: 800,
                    }}
                  >
                    {crew.riskSource === "pending"
                      ? "Analyzing live risk"
                      : crew.riskSource === "error"
                      ? getSeverityShortLabel(crew.risk_score)
                      : crew.risk_level ?? getSeverityShortLabel(crew.risk_score)}
                  </p>
                </div>

                {crew.riskSource !== "pending" ? (
                  <span
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "999px",
                      background: getSeverityColor(crew.risk_score),
                      color: "#ffffff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "17px",
                      fontWeight: "950",
                      flexShrink: 0,
                      boxShadow: `0 0 18px ${getSeverityColor(
                        crew.risk_score
                      )}66`,
                      border: "2px solid rgba(255,255,255,0.9)",
                    }}
                  >
                    {Number.isFinite(Number(crew.risk_score))
                      ? crew.risk_score
                      : "?"}
                  </span>
                ) : (
                  <span
                    style={{
                      color: "#0284c7",
                      fontWeight: "900",
                      fontSize: "13px",
                    }}
                  >
                    LIVE
                  </span>
                )}
              </div>

              {crew.riskSource === "error" && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    background: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: "12px",
                    fontSize: "13px",
                    color: "#78350f",
                    lineHeight: 1.35,
                    fontWeight: "700",
                  }}
                >
                  Live analysis unavailable ({crew.riskErrorMessage}). Showing
                  device telemetry only.
                  <br />
                  <strong>Telemetry note:</strong> {crew.primary_reason}
                </div>
              )}

              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gap: "2px",
                }}
              >
                <p style={cardText}>
                  <strong style={cardStrong}>Last seen:</strong>{" "}
                  {crew.last_seen_minutes} min ago
                </p>

                <p style={cardText}>
                  <strong style={cardStrong}>Battery:</strong> {crew.battery}%
                </p>

                <p style={cardText}>
                  <strong style={cardStrong}>Latitude:</strong> {crew.lat}
                </p>

                <p style={cardText}>
                  <strong style={cardStrong}>Longitude:</strong> {crew.lon}
                </p>

                {crew.riskSource === "api" && (
                  <>
                    <p
                      style={{
                        ...cardText,
                        color: "#64748b",
                        fontSize: "13px",
                      }}
                    >
                      <strong style={cardStrong}>AI confidence:</strong>{" "}
                      {crew.confidence ?? "—"}
                      {crew.analyzed_at && (
                        <>
                          {" "}
                          · <strong style={cardStrong}>Analyzed:</strong>{" "}
                          {new Date(crew.analyzed_at).toLocaleString()}
                        </>
                      )}
                    </p>

                    <p style={cardText}>
                      <strong style={cardStrong}>Primary reason:</strong>{" "}
                      {crew.primary_reason}
                    </p>

                    {crew.explanation && (
                      <p style={cardText}>
                        <strong style={cardStrong}>AI summary:</strong>{" "}
                        {crew.explanation}
                      </p>
                    )}

                    {crew.risk_reasons?.length > 0 && (
                      <div style={{ margin: "8px 0" }}>
                        <strong style={cardStrong}>Risk factors:</strong>
                        <ul
                          style={{
                            margin: "6px 0 0 0",
                            paddingLeft: "18px",
                            lineHeight: 1.35,
                            color: "#334155",
                            fontSize: "14px",
                          }}
                        >
                          {crew.risk_reasons.map((reason, idx) => (
                            <li key={`${crew.unit_id}-rr-${idx}`}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {crew.weather && (
                      <p style={cardText}>
                        <strong style={cardStrong}>Weather:</strong>{" "}
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
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "12px",
                          borderRadius: "14px",
                          background: "#f8fafc",
                          border: "1px solid rgba(148, 163, 184, 0.35)",
                        }}
                      >
                        <p style={{ ...cardText, margin: 0 }}>
                          <strong style={cardStrong}>Camera:</strong>{" "}
                          {crew.camera.camera_caption ?? "—"}
                          {crew.camera.camera_risk_level && (
                            <> · risk {crew.camera.camera_risk_level}</>
                          )}
                        </p>

                        <p
                          style={{
                            margin: "8px 0 0",
                            color: "#64748b",
                            fontSize: "13px",
                            lineHeight: 1.35,
                            fontWeight: 700,
                          }}
                        >
                          Available:{" "}
                          {crew.camera.camera_available ? "yes" : "no"} ·
                          Visibility: {crew.camera.visibility_status ?? "—"} ·
                          Hazard: {crew.camera.hazard_detected ? "yes" : "no"}
                        </p>

                        {crew.camera.image_url ? (
                          <a
                            href={crew.camera.image_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: "10px",
                              padding: "9px 12px",
                              borderRadius: "999px",
                              background: "#e0f2fe",
                              border: "1px solid rgba(2, 132, 199, 0.35)",
                              color: "#0369a1",
                              fontWeight: 900,
                              fontSize: "13px",
                              textDecoration: "none",
                            }}
                          >
                            Open camera image
                          </a>
                        ) : (
                          <p
                            style={{
                              margin: "8px 0 0",
                              color: "#64748b",
                              fontSize: "13px",
                              fontStyle: "italic",
                            }}
                          >
                            No camera image available for this crew.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {crew.riskSource === "pending" && (
                  <p
                    style={{
                      margin: "8px 0",
                      fontStyle: "italic",
                      color: "#0284c7",
                      fontWeight: "700",
                    }}
                  >
                    Requesting backend analysis: weather, cameras, and AI…
                  </p>
                )}
              </div>

              {crew.last_seen_minutes > 5 && (
                <p
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    padding: "10px",
                    borderRadius: "12px",
                    fontWeight: "900",
                    textAlign: "center",
                    border: "1px solid #f87171",
                    margin: "12px 0 0",
                  }}
                >
                  Stale location alert. Verify crew status.
                </p>
              )}
            </div>
          ))}
        </aside>
      </section>

      <aside
        aria-hidden={!isRiskPanelOpen}
        style={{
          position: "absolute",
          top: "96px",
          right: "24px",
          width: "460px",
          maxWidth: "calc(100% - 48px)",
          maxHeight: "80vh",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(2, 132, 199, 0.3)",
          boxShadow: "0 20px 70px rgba(15,23,42,0.20)",
          transform: isRiskPanelOpen ? "translateY(0)" : "translateY(-12px)",
          opacity: isRiskPanelOpen ? 1 : 0,
          pointerEvents: isRiskPanelOpen ? "auto" : "none",
          transition: "opacity 180ms ease, transform 180ms ease",
          zIndex: 900,
          borderRadius: "20px",
          overflow: "hidden",
          color: "#0f172a",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
            background: "#f0f9ff",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "19px",
              fontWeight: "950",
              color: "#0f172a",
            }}
          >
            Risk Descriptions
          </p>

          <button
            type="button"
            onClick={() => setIsRiskPanelOpen(false)}
            style={{
              border: "1px solid rgba(2, 132, 199, 0.35)",
              background: "#e0f2fe",
              color: "#0369a1",
              borderRadius: "999px",
              padding: "7px 12px",
              cursor: "pointer",
              fontWeight: "900",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: "12px",
            overflowY: "auto",
            maxHeight: "calc(80vh - 60px)",
            display: "grid",
            gap: "8px",
          }}
        >
          {severityLevels.map((item) => (
            <div
              key={`risk-panel-${item.level}`}
              style={{
                display: "grid",
                gridTemplateColumns: "38px minmax(0, 1fr)",
                alignItems: "center",
                gap: "10px",
                border: "1px solid rgba(148, 163, 184, 0.28)",
                borderRadius: "14px",
                background: "#ffffff",
                padding: "10px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "999px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "950",
                  background: getSeverityColor(item.level),
                }}
              >
                {item.level}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "#334155",
                  lineHeight: 1.25,
                  fontSize: "14px",
                  fontWeight: 700,
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
          width: "540px",
          maxWidth: "100%",
          height: "100vh",
          background: "rgba(255,255,255,0.98)",
          borderLeft: "1px solid rgba(2, 132, 199, 0.35)",
          boxShadow: "-10px 0 40px rgba(15,23,42,0.18)",
          transform: selectedCrew ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          color: "#0f172a",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
            background: "linear-gradient(135deg, #ffffff, #e0f2fe)",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                textTransform: "uppercase",
                color: "#0284c7",
                fontWeight: "900",
                letterSpacing: "1.2px",
              }}
            >
              Crew Detail
            </p>

            <h3
              style={{
                margin: "4px 0 0 0",
                color: "#0f172a",
                fontSize: "30px",
                fontWeight: "950",
              }}
            >
              {selectedCrew ? selectedCrew.unit_id : "Crew"}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCrewId(null)}
            style={{
              border: "1px solid rgba(2, 132, 199, 0.35)",
              background: "#e0f2fe",
              color: "#0369a1",
              borderRadius: "999px",
              padding: "8px 13px",
              cursor: "pointer",
              fontWeight: "900",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: "18px",
            overflowY: "auto",
            display: "grid",
            gap: "14px",
          }}
        >
          {selectedCrew && (
            <>
              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "18px",
                  padding: "16px",
                  background: "#f8fafc",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "#64748b",
                    fontSize: "12px",
                    fontWeight: "900",
                    textTransform: "uppercase",
                  }}
                >
                  Current Risk
                </p>

                <p
                  style={{
                    margin: 0,
                    color: "#0f172a",
                    fontSize: "24px",
                    fontWeight: "950",
                  }}
                >
                  {selectedCrew.riskSource === "pending"
                    ? "Analyzing — score not ready yet"
                    : `${
                        Number.isFinite(Number(selectedCrew.risk_score))
                          ? selectedCrew.risk_score
                          : "?"
                      }/10 — ${
                        selectedCrew.risk_level ??
                        getSeverityShortLabel(selectedCrew.risk_score)
                      }`}
                </p>
              </div>

              {selectedCrew.riskSource === "api" && selectedCrew.confidence && (
                <p style={{ ...panelText, color: "#64748b" }}>
                  <strong style={cardStrong}>Analysis confidence:</strong>{" "}
                  {selectedCrew.confidence}
                  {selectedCrew.analyzed_at && (
                    <> · {new Date(selectedCrew.analyzed_at).toLocaleString()}</>
                  )}
                </p>
              )}

              {selectedCrew.riskSource === "error" && (
                <p style={{ ...panelText, color: "#991b1b" }}>
                  <strong style={cardStrong}>Analysis:</strong> unavailable —{" "}
                  {selectedCrew.riskErrorMessage}
                </p>
              )}

              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "18px",
                  padding: "16px",
                  background: "#f8fafc",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <p style={panelText}>
                  <strong style={cardStrong}>Unit:</strong>{" "}
                  {selectedCrew.unit_id}
                </p>

                <p style={panelText}>
                  <strong style={cardStrong}>Last seen:</strong>{" "}
                  {selectedCrew.last_seen_minutes} min ago
                </p>

                <p style={panelText}>
                  <strong style={cardStrong}>Battery:</strong>{" "}
                  {selectedCrew.battery}%
                </p>

                <p style={panelText}>
                  <strong style={cardStrong}>Latitude:</strong>{" "}
                  {selectedCrew.lat}
                </p>

                <p style={panelText}>
                  <strong style={cardStrong}>Longitude:</strong>{" "}
                  {selectedCrew.lon}
                </p>
              </div>

              {selectedCrew.riskSource === "api" && (
                <>
                  <div
                    style={{
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      borderRadius: "18px",
                      padding: "16px",
                      background: "#f8fafc",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <p style={panelText}>
                      <strong style={cardStrong}>Primary reason:</strong>{" "}
                      {selectedCrew.primary_reason}
                    </p>

                    {selectedCrew.explanation && (
                      <p style={panelText}>
                        <strong style={cardStrong}>AI explanation:</strong>{" "}
                        {selectedCrew.explanation}
                      </p>
                    )}

                    {selectedCrew.risk_reasons?.length > 0 && (
                      <div>
                        <strong style={cardStrong}>Risk factors:</strong>
                        <ul
                          style={{
                            margin: "6px 0 0 0",
                            paddingLeft: "18px",
                            lineHeight: 1.4,
                            color: "#334155",
                          }}
                        >
                          {selectedCrew.risk_reasons.map((reason, idx) => (
                            <li key={`detail-rr-${idx}`}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {selectedCrew.weather && (
                    <DetailBox title="Weather">
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
                    </DetailBox>
                  )}

                  {selectedCrew.camera && (
                    <DetailBox title="Camera">
                      <p style={{ margin: 0 }}>
                        {selectedCrew.camera.camera_caption ?? "—"}
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0 0",
                          fontSize: "13px",
                          color: "#64748b",
                        }}
                      >
                        Available:{" "}
                        {selectedCrew.camera.camera_available ? "yes" : "no"} ·
                        Visibility:{" "}
                        {selectedCrew.camera.visibility_status ?? "—"} · Hazard:{" "}
                        {selectedCrew.camera.hazard_detected ? "yes" : "no"}
                      </p>
                      {selectedCrew.camera.image_url && (
                        <a
                          href={selectedCrew.camera.image_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            width: "fit-content",
                            marginTop: "10px",
                            padding: "9px 12px",
                            borderRadius: "999px",
                            background: "#e0f2fe",
                            border: "1px solid rgba(2, 132, 199, 0.35)",
                            color: "#0369a1",
                            fontWeight: 900,
                            fontSize: "13px",
                            textDecoration: "none",
                          }}
                        >
                          Open camera image
                        </a>
                      )}
                    </DetailBox>
                  )}
                </>
              )}

              {selectedCrew.riskSource === "api" &&
                selectedCrew.recommended_command_review && (
                  <p
                    style={{
                      marginTop: "2px",
                      padding: "14px",
                      background: "#e0f2fe",
                      border: "1px solid rgba(2, 132, 199, 0.25)",
                      borderLeft: "5px solid #0284c7",
                      color: "#0f172a",
                      fontWeight: "800",
                      lineHeight: 1.45,
                      borderRadius: "14px",
                    }}
                  >
                    <strong>Recommended command review:</strong>{" "}
                    {selectedCrew.recommended_command_review}
                  </p>
                )}

              {selectedCrew.riskSource !== "api" && (
                <p
                  style={{
                    marginTop: "2px",
                    padding: "14px",
                    background: "#e0f2fe",
                    border: "1px solid rgba(2, 132, 199, 0.25)",
                    borderLeft: "5px solid #0284c7",
                    color: "#0f172a",
                    fontWeight: "800",
                    lineHeight: 1.45,
                    borderRadius: "14px",
                  }}
                >
                  Full AI briefing appears after backend analysis completes.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </main>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        borderRadius: "16px",
        padding: "12px",
        boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "#64748b",
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: "26px",
          fontWeight: 950,
          color,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function InfoStrip({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid rgba(148, 163, 184, 0.28)",
        borderRadius: "16px",
        padding: "12px",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#64748b",
          fontSize: "12px",
          fontWeight: 850,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          color: "#0f172a",
          fontSize: "16px",
          fontWeight: 950,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function DetailBox({ title, children }) {
  return (
    <div
      style={{
        margin: 0,
        padding: "14px",
        background: "#f8fafc",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: "16px",
        color: "#334155",
        lineHeight: 1.4,
      }}
    >
      <strong style={{ color: "#0f172a" }}>{title}</strong>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
  );
}