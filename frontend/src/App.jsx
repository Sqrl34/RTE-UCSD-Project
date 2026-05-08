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
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px" }}>
      <div style={{ marginBottom: "24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "42px", fontWeight: "800", marginBottom: "8px" }}>
          Fireline Breadcrumb Command Dashboard
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#64748b",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          AI-assisted wildfire situational awareness for dismounted crews. This
          dashboard shows crew locations, risk scores, hazard zones, wind
          conditions, camera summaries, and escape route options for incident
          command review.
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) 390px",
          gap: "24px",
          alignItems: "start",
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "12px" }}>
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
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
                  {crew.unit_id}
                </h2>

                <span
                  style={{
                    background:
                      crew.risk_score >= 8
                        ? "#dc2626"
                        : crew.risk_score >= 6
                        ? "#f97316"
                        : "#16a34a",
                    color: "white",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    fontWeight: "800",
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
                    background: "#fef2f2",
                    color: "#b91c1c",
                    padding: "8px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    textAlign: "center",
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