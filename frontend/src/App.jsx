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
import mockCameraFire from "./assets/mockfire.png";

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
  if (!Number.isFinite(n)) return "#71767a";
  if (n >= 8) return "#b50909";
  if (n >= 6) return "#c05600";
  if (n === 5) return "#a26700";
  return "#2e7044";
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
    mockCrews.map((crew) => [crew.unit_id, { status: "pending" }])
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
    return mockCrews.map((mock) => {
      const crew = applyAnalysisToMock(mock, analysisByUnitId[mock.unit_id]);

      if (crew.unit_id === "Alpha-3") {
        return {
          ...crew,
          risk_score: Math.max(Number(crew.risk_score) || 0, 9),
          risk_level: "Critical risk",
          primary_reason:
            "Mock camera feed shows visible flame activity near Alpha-3 position.",
          explanation:
            "Alpha-3 is near the camera sector where the mock fire image indicates visible flames and smoke. Combined with stale check-in timing, this crew should be prioritized for command review.",
          risk_reasons: [
            ...(crew.risk_reasons ?? []),
            "Mock camera image shows visible flames near Alpha-3.",
            "Smoke and flame activity may affect visibility and escape route safety.",
          ],
          camera: {
            ...(crew.camera ?? {}),
            camera_available: true,
            camera_caption:
              "Mock camera view detects visible flames and smoke near Alpha-3.",
            camera_risk_level: "high",
            visibility_status: "reduced",
            hazard_detected: true,
            image_url: mockCameraFire,
            is_mock: true,
          },
        };
      }

      return crew;
    });
  }, [analysisByUnitId]);

  const selectedCrew =
    mergedCrews.find((crew) => crew.unit_id === selectedCrewId) ?? null;

  const analysisPendingCount = useMemo(
    () => mergedCrews.filter((crew) => crew.riskSource === "pending").length,
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
    color: "#1b1b1b",
    margin: "8px 0",
    lineHeight: 1.4,
    fontSize: "14px",
  };

  const cardStrong = {
    color: "#111827",
    fontWeight: 800,
  };

  const panelText = {
    color: "#1b1b1b",
    margin: 0,
    lineHeight: 1.45,
  };

  const officialCard = {
    background: "#ffffff",
    border: "1px solid #c9c9c9",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)",
  };

  return (
    <main
      style={{
        height: "100vh",
        background: "#f5f5f5",
        color: "#1b1b1b",
        fontFamily: '"Source Sans Pro", "Segoe UI", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          background: "#112f4e",
          color: "#ffffff",
          borderBottom: "6px solid #005ea8",
          padding: "14px 28px 16px 28px",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.16)",
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
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                fontWeight: "800",
                color: "#d9e8f6",
              }}
            >
              CrewTrace Incident Operations Dashboard
            </p>

            <h1
              style={{
                fontSize: "44px",
                lineHeight: 1,
                fontWeight: "900",
                margin: "6px 0 8px 0",
                color: "#ffffff",
              }}
            >
              Crew Trace
            </h1>

            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.35,
                color: "#d9e8f6",
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
            <MetricCard label="Crews" value={mergedCrews.length} color="#005ea8" />
            <MetricCard label="High Risk" value={highRiskCount} color="#c05600" />
            <MetricCard label="Stale" value={staleCrewCount} color="#b50909" />
            <MetricCard
              label="Analyzing"
              value={analysisPendingCount}
              color="#005ea8"
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
            borderRadius: "4px",
            padding: "14px",
            ...officialCard,
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
                  fontSize: "24px",
                  fontWeight: "900",
                  margin: 0,
                  color: "#112f4e",
                  letterSpacing: "0.2px",
                }}
              >
                Live Field Map
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#565c65",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                SDSU / Mission Valley sector — weather, camera, and crew
                telemetry
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRiskPanelOpen(true)}
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#ffffff",
                background: "#005ea8",
                border: "1px solid #005ea8",
                borderRadius: "4px",
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
              borderRadius: "4px",
              padding: "14px",
              flexShrink: 0,
              ...officialCard,
            }}
          >
            <label
              htmlFor="crew-name-search"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "800",
                color: "#112f4e",
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
                border: "1px solid #71767a",
                borderRadius: "4px",
                padding: "10px 12px",
                fontWeight: "700",
                color: "#1b1b1b",
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
                  color: "#005ea8",
                  fontWeight: "700",
                  lineHeight: 1.35,
                }}
              >
                {`Live risk analysis in progress (${analysisPendingCount} ${
                  analysisPendingCount === 1 ? "crew" : "crews"
                })...`}
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
                background: focusedCrewId === crew.unit_id ? "#eef7ff" : "#ffffff",
                border:
                  focusedCrewId === crew.unit_id
                    ? "2px solid #005ea8"
                    : "1px solid #c9c9c9",
                borderRadius: "4px",
                padding: "16px",
                boxShadow:
                  focusedCrewId === crew.unit_id
                    ? "0 0 0 3px rgba(0, 94, 168, 0.14)"
                    : "0 2px 8px rgba(0, 0, 0, 0.06)",
                textAlign: "left",
                cursor: "pointer",
                color: "#1b1b1b",
                transition: "border 160ms ease, box-shadow 160ms ease",
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
                      fontWeight: "900",
                      margin: 0,
                      color: "#112f4e",
                    }}
                  >
                    {crew.unit_id}
                  </h2>

                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#565c65",
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
                      minWidth: "42px",
                      height: "34px",
                      borderRadius: "4px",
                      background: getSeverityColor(crew.risk_score),
                      color: "#ffffff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      fontWeight: "800",
                      flexShrink: 0,
                      border: "1px solid rgba(0,0,0,0.2)",
                    }}
                  >
                    {Number.isFinite(Number(crew.risk_score))
                      ? crew.risk_score
                      : "?"}
                  </span>
                ) : (
                  <span
                    style={{
                      color: "#005ea8",
                      fontWeight: "800",
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
                    background: "#fff4ce",
                    border: "1px solid #ffbe2e",
                    borderRadius: "4px",
                    fontSize: "13px",
                    color: "#7d4600",
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
                        color: "#565c65",
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
                            lineHeight: 1.4,
                            color: "#1b1b1b",
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
                  </>
                )}

                {crew.camera && (
                  <CameraCard crew={crew} mockCameraFire={mockCameraFire} />
                )}

                {crew.riskSource === "pending" && (
                  <p
                    style={{
                      margin: "8px 0",
                      fontStyle: "italic",
                      color: "#005ea8",
                      fontWeight: "700",
                    }}
                  >
                    Requesting backend analysis: weather, cameras, and AI...
                  </p>
                )}
              </div>

              {crew.last_seen_minutes > 5 && (
                <p
                  style={{
                    background: "#f8dfe2",
                    color: "#8b0a03",
                    padding: "10px",
                    borderRadius: "4px",
                    fontWeight: "800",
                    textAlign: "center",
                    border: "1px solid #d54309",
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
          background: "#ffffff",
          border: "1px solid #c9c9c9",
          boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
          transform: isRiskPanelOpen ? "translateY(0)" : "translateY(-12px)",
          opacity: isRiskPanelOpen ? 1 : 0,
          pointerEvents: isRiskPanelOpen ? "auto" : "none",
          transition: "opacity 180ms ease, transform 180ms ease",
          zIndex: 900,
          borderRadius: "4px",
          overflow: "hidden",
          color: "#1b1b1b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid #c9c9c9",
            background: "#f7f9fa",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "19px",
              fontWeight: "900",
              color: "#112f4e",
            }}
          >
            Risk Descriptions
          </p>

          <button
            type="button"
            onClick={() => setIsRiskPanelOpen(false)}
            style={{
              border: "1px solid #005ea8",
              background: "#005ea8",
              color: "#ffffff",
              borderRadius: "4px",
              padding: "7px 12px",
              cursor: "pointer",
              fontWeight: "700",
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
                gridTemplateColumns: "42px minmax(0, 1fr)",
                alignItems: "center",
                gap: "10px",
                border: "1px solid #c9c9c9",
                borderRadius: "4px",
                background: "#ffffff",
                padding: "10px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "4px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "800",
                  background: getSeverityColor(item.level),
                }}
              >
                {item.level}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "#1b1b1b",
                  lineHeight: 1.35,
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
          background: "#ffffff",
          borderLeft: "4px solid #005ea8",
          boxShadow: "-10px 0 35px rgba(0,0,0,0.2)",
          transform: selectedCrew ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          color: "#1b1b1b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px",
            borderBottom: "1px solid #c9c9c9",
            background: "#f7f9fa",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                textTransform: "uppercase",
                color: "#005ea8",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              Crew Detail
            </p>

            <h3
              style={{
                margin: "4px 0 0 0",
                color: "#112f4e",
                fontSize: "30px",
                fontWeight: "900",
              }}
            >
              {selectedCrew ? selectedCrew.unit_id : "Crew"}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCrewId(null)}
            style={{
              border: "1px solid #005ea8",
              background: "#005ea8",
              color: "#ffffff",
              borderRadius: "4px",
              padding: "8px 13px",
              cursor: "pointer",
              fontWeight: "700",
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
              <DetailBox title="Current Risk">
                <p
                  style={{
                    margin: 0,
                    color: "#112f4e",
                    fontSize: "24px",
                    fontWeight: "900",
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
              </DetailBox>

              {selectedCrew.riskSource === "api" && selectedCrew.confidence && (
                <p style={{ ...panelText, color: "#565c65" }}>
                  <strong style={cardStrong}>Analysis confidence:</strong>{" "}
                  {selectedCrew.confidence}
                  {selectedCrew.analyzed_at && (
                    <> · {new Date(selectedCrew.analyzed_at).toLocaleString()}</>
                  )}
                </p>
              )}

              {selectedCrew.riskSource === "error" && (
                <p style={{ ...panelText, color: "#8b0a03" }}>
                  <strong style={cardStrong}>Analysis:</strong> unavailable —{" "}
                  {selectedCrew.riskErrorMessage}
                </p>
              )}

              <DetailBox title="Crew Telemetry">
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
              </DetailBox>

              {selectedCrew.riskSource === "api" && (
                <>
                  <DetailBox title="AI Summary">
                    <p style={panelText}>
                      <strong style={cardStrong}>Primary reason:</strong>{" "}
                      {selectedCrew.primary_reason}
                    </p>

                    {selectedCrew.explanation && (
                      <p style={{ ...panelText, marginTop: "8px" }}>
                        <strong style={cardStrong}>AI explanation:</strong>{" "}
                        {selectedCrew.explanation}
                      </p>
                    )}

                    {selectedCrew.risk_reasons?.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <strong style={cardStrong}>Risk factors:</strong>
                        <ul
                          style={{
                            margin: "6px 0 0 0",
                            paddingLeft: "18px",
                            lineHeight: 1.4,
                            color: "#1b1b1b",
                          }}
                        >
                          {selectedCrew.risk_reasons.map((reason, idx) => (
                            <li key={`detail-rr-${idx}`}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </DetailBox>

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
                </>
              )}

              {selectedCrew.camera && (
                <DetailBox title="Camera">
                  <p style={{ margin: 0 }}>
                    {selectedCrew.camera.camera_caption ??
                      "Camera feed available for review."}
                  </p>

                  {selectedCrew.camera.is_mock && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#7d4600",
                        background: "#fff4ce",
                        border: "1px solid #ffbe2e",
                        borderRadius: "4px",
                        padding: "8px",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      Mock camera feed for demo purposes
                    </p>
                  )}

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "13px",
                      color: "#565c65",
                    }}
                  >
                    Available:{" "}
                    {selectedCrew.camera.camera_available ? "yes" : "no"} ·
                    Visibility:{" "}
                    {selectedCrew.camera.visibility_status ?? "reduced"} · Hazard:{" "}
                    {selectedCrew.camera.hazard_detected ? "yes" : "no"}
                  </p>

                  <img
                    src={selectedCrew.camera.image_url || mockCameraFire}
                    alt={`${selectedCrew.unit_id} camera feed`}
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      borderRadius: "4px",
                      border: "1px solid #c9c9c9",
                      objectFit: "cover",
                      maxHeight: "220px",
                      display: "block",
                    }}
                  />

                  <a
                    href={selectedCrew.camera.image_url || mockCameraFire}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      width: "fit-content",
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      background: "#005ea8",
                      border: "1px solid #005ea8",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "13px",
                      textDecoration: "none",
                    }}
                  >
                    Open camera image
                  </a>
                </DetailBox>
              )}

              {selectedCrew.riskSource === "api" &&
                selectedCrew.recommended_command_review && (
                  <p
                    style={{
                      marginTop: "2px",
                      padding: "14px",
                      background: "#eef7ff",
                      border: "1px solid #005ea8",
                      borderLeft: "5px solid #005ea8",
                      color: "#112f4e",
                      fontWeight: "800",
                      lineHeight: 1.45,
                      borderRadius: "4px",
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
                    background: "#eef7ff",
                    border: "1px solid #005ea8",
                    borderLeft: "5px solid #005ea8",
                    color: "#112f4e",
                    fontWeight: "800",
                    lineHeight: 1.45,
                    borderRadius: "4px",
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

function CameraCard({ crew, mockCameraFire }) {
  return (
    <div
      style={{
        marginTop: "10px",
        padding: "12px",
        borderRadius: "4px",
        background: "#f7f9fa",
        border: "1px solid #c9c9c9",
      }}
    >
      <p style={{ color: "#1b1b1b", margin: 0, lineHeight: 1.4, fontSize: "14px" }}>
        <strong style={{ color: "#111827", fontWeight: 800 }}>Camera:</strong>{" "}
        {crew.camera.camera_caption ?? "Camera feed available for review."}
        {crew.camera.camera_risk_level && (
          <> · risk {crew.camera.camera_risk_level}</>
        )}
      </p>

      {crew.camera.is_mock && (
        <p
          style={{
            margin: "8px 0 0",
            color: "#7d4600",
            background: "#fff4ce",
            border: "1px solid #ffbe2e",
            borderRadius: "4px",
            padding: "8px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          Mock camera feed for demo purposes
        </p>
      )}

      <p
        style={{
          margin: "8px 0 0",
          color: "#565c65",
          fontSize: "13px",
          lineHeight: 1.35,
          fontWeight: 700,
        }}
      >
        Available: {crew.camera.camera_available ? "yes" : "no"} · Visibility:{" "}
        {crew.camera.visibility_status ?? "reduced"} · Hazard:{" "}
        {crew.camera.hazard_detected ? "yes" : "no"}
      </p>

      <img
        src={crew.camera.image_url || mockCameraFire}
        alt={`${crew.unit_id} camera feed`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          marginTop: "10px",
          borderRadius: "4px",
          border: "1px solid #c9c9c9",
          objectFit: "cover",
          maxHeight: "180px",
          display: "block",
        }}
      />

      <a
        href={crew.camera.image_url || mockCameraFire}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "10px",
          padding: "8px 12px",
          borderRadius: "4px",
          background: "#005ea8",
          border: "1px solid #005ea8",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "13px",
          textDecoration: "none",
        }}
      >
        Open camera image
      </a>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(255, 255, 255, 0.35)",
        borderRadius: "4px",
        padding: "10px 12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "#565c65",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: "26px",
          fontWeight: 900,
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
        background: "#f7f9fa",
        border: "1px solid #c9c9c9",
        borderRadius: "4px",
        padding: "12px",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#565c65",
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          color: "#1b1b1b",
          fontSize: "16px",
          fontWeight: 900,
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
        background: "#f7f9fa",
        border: "1px solid #c9c9c9",
        borderRadius: "4px",
        color: "#1b1b1b",
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: "#112f4e", fontWeight: 900 }}>{title}</strong>
      <div style={{ marginTop: "8px" }}>{children}</div>
    </div>
  );
}