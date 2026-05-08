import "leaflet/dist/leaflet.css";
import FireMap from "./components/FireMap";
import { mockCrews } from "./data/mockCrews";
import {
  hazardZone,
  escapeRoutes,
  cameraLocations,
  windArrows,
} from "./data/mockMapData";

export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        fontFamily: '"Source Sans Pro", "Segoe UI", Arial, sans-serif',
      }}
    >
      <header
        style={{
          background: "#112e51",
          color: "#ffffff",
          borderBottom: "4px solid #205493",
          padding: "16px 24px 20px 24px",
          marginBottom: "24px",
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
          alignItems: "start",
          width: "100%",
          padding: "0 24px 24px 24px",
          boxSizing: "border-box",
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
          />
        </div>

        <aside style={{ display: "grid", gap: "16px" }}>
          {mockCrews.map((crew) => (
            <div
              key={crew.unit_id}
              style={{
                background: "#ffffff",
                border: "1px solid #aeb0b5",
                borderRadius: "4px",
                padding: "16px",
                boxShadow: "none",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "#112e51" }}>
                  {crew.unit_id}
                </h2>

                <span
                  style={{
                    background:
                      crew.risk_score >= 8
                        ? "#cd2026"
                        : crew.risk_score >= 6
                        ? "#e59323"
                        : "#2e8540",
                    color: "#ffffff",
                    borderRadius: "2px",
                    padding: "4px 10px",
                    fontWeight: "700",
                    height: "fit-content",
                  }}
                >
                  {crew.risk_score}/10
                </span>
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
    </main>
  );
}