import { useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import FireMap from "./components/FireMap";
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
  if (level >= 8) return "#cd2026";
  if (level >= 6) return "#e59323";
  return "#2e8540";
};

export default function App() {
  const [expandedSeverityCrew, setExpandedSeverityCrew] = useState(null);
  const [focusedCrewId, setFocusedCrewId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCrew = mockCrews.find((crew) => crew.unit_id === expandedSeverityCrew) ?? null;
  const cardRefs = useRef({});
  const sortedCrews = useMemo(() => {
    const crews = [...mockCrews];

    crews.sort((a, b) => b.risk_score - a.risk_score || b.last_seen_minutes - a.last_seen_minutes);

    return crews;
  }, []);
  const filteredCrews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedCrews;
    return sortedCrews.filter((crew) => crew.unit_id.toLowerCase().includes(query));
  }, [searchQuery, sortedCrews]);

  const focusCrewCard = (unitId) => {
    setFocusedCrewId(unitId);
    setSearchQuery("");
    requestAnimationFrame(() => {
      const cardEl = cardRefs.current[unitId];
      if (!cardEl) return;
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
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
              color: "#fff",
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
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "700",
              marginBottom: "12px",
              color: "#112e51",
              letterSpacing: "0.2px",
            }}
          >
            Live Field Map
          </h2>

          <FireMap
            crews={mockCrews}
            hazardZone={hazardZone}
            escapeRoutes={escapeRoutes}
            cameraLocations={cameraLocations}
            windArrows={windArrows}
            onCrewSelect={focusCrewCard}
          />
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
              style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#3d4551", marginBottom: "6px" }}
            >
              SEARCH CREW
            </label>
            <input
              id="crew-name-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type crew name (e.g. Alpha-3)"
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
          </div>
          {filteredCrews.map((crew) => (
            <div
              key={crew.unit_id}
              ref={(el) => {
                cardRefs.current[crew.unit_id] = el;
              }}
              style={{
                background: "#ffffff",
                border: "1px solid #aeb0b5",
                borderRadius: "4px",
                padding: "16px",
                boxShadow: focusedCrewId === crew.unit_id ? "0 0 0 2px #205493 inset" : "none",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#112e51" }}>
                  {crew.unit_id}
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedSeverityCrew((current) =>
                      current === crew.unit_id ? null : crew.unit_id
                    )
                  }
                  aria-expanded={expandedSeverityCrew === crew.unit_id}
                  aria-label={`Severity ${crew.risk_score} out of 10. Click to view all levels.`}
                  style={{
                    background: "#ffffff",
                    color: "#112e51",
                    borderRadius: "999px",
                    padding: "4px 8px 4px 10px",
                    fontWeight: "700",
                    height: "fit-content",
                    border: "2px solid #205493",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 0 0 2px rgba(32, 84, 147, 0.15)",
                  }}
                >
                  <span style={{ fontSize: "12px", letterSpacing: "0.2px" }}>Risk:</span>
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "999px",
                      background: getSeverityColor(crew.risk_score),
                      color: "#ffffff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: "800",
                    }}
                  >
                    {crew.risk_score}
                  </span>
                </button>
              </div>

              <p><strong>Last seen:</strong> {crew.last_seen_minutes} min ago</p>
              <p><strong>Battery:</strong> {crew.battery}%</p>
              <p><strong>Primary reason:</strong> {crew.primary_reason}</p>
              <p><strong>Comms summary:</strong> {crew.transcript}</p>

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
            <p style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", color: "#3d4551" }}>
              Severity Scale
            </p>
            <h3 style={{ margin: "4px 0 0 0", color: "#112e51" }}>
              {selectedCrew ? selectedCrew.unit_id : "Crew"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setExpandedSeverityCrew(null)}
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

        <div style={{ padding: "14px 16px 20px 16px", overflowY: "auto", display: "grid", gap: "10px" }}>
          {severityLevels.map((item) => {
            const color = getSeverityColor(item.level);
            const active = selectedCrew?.risk_score === item.level;

            return (
              <div
                key={item.level}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 8px",
                  borderBottom: "1px solid #e6e6e6",
                  background: active ? "#eaf4ff" : "#ffffff",
                  borderLeft: active ? "4px solid #205493" : "4px solid transparent",
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "999px",
                    border: `2px solid ${color}`,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    background: color,
                  }}
                >
                  {item.level}
                </div>
                <p
                  style={{
                    margin: 0,
                    color: active ? "#112e51" : "#1b1b1b",
                    fontWeight: active ? "700" : "400",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.25,
                  }}
                >
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </aside>
    </main>
  );
}