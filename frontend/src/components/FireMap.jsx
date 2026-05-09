import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const riskColor = (score) => {
  const n = Number(score);
  if (!Number.isFinite(n)) return "#94a3b8";
  if (n >= 8) return "#cd2026";
  if (n >= 6) return "#e59323";
  if (n === 5) return "#eab308";
  return "#2e8540";
};

const riskScoreLabel = (score) => {
  const n = Number(score);
  return Number.isFinite(n) ? String(Math.round(n)) : "?";
};

const markerBackgroundForCrew = (crew) => {
  if (crew.riskSource === "pending") return "#94a3b8";
  return riskColor(crew.risk_score);
};

const markerLabelForCrew = (crew) => {
  if (crew.riskSource === "pending") return "";
  return riskScoreLabel(crew.risk_score);
};

const createCrewIcon = (crew, isSelected = false) =>
  L.divIcon({
    className: "crew-marker",
    html: `
      <div style="
        background:${markerBackgroundForCrew(crew)};
        color:white;
        border-radius:999px;
        width:${isSelected ? "44px" : "36px"};
        height:${isSelected ? "44px" : "36px"};
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
        border:${isSelected ? "3px solid #205493" : "2px solid white"};
        box-shadow:${isSelected ? "0 0 0 4px rgba(32,84,147,0.25), 0 4px 10px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.35)"};
      ">
        ${markerLabelForCrew(crew)}
      </div>
    `,
    iconSize: isSelected ? [44, 44] : [36, 36],
    iconAnchor: isSelected ? [22, 22] : [18, 18],
  });

const cameraIcon = L.divIcon({
  className: "camera-marker",
  html: `
    <div style="
      background:#1e293b;
      color:white;
      border-radius:999px;
      width:32px;
      height:32px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:16px;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
    ">
      📷
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const createWindIcon = (wind) =>
  L.divIcon({
    className: "wind-marker",
    html: `
      <div style="
        background:white;
        color:#1e293b;
        border-radius:12px;
        padding:4px 8px;
        font-weight:700;
        border:1px solid #cbd5e1;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        white-space:nowrap;
      ">
        ➜ ${wind.speed}
      </div>
    `,
    iconSize: [80, 30],
    iconAnchor: [40, 15],
  });

export default function FireMap({
  crews = [],
  hazardZone = [],
  escapeRoutes = [],
  cameraLocations = [],
  windArrows = [],
  selectedCrewId = null,
  onCrewSelect = () => {},
}) {
  return (
    <div
  style={{
    height: "100%",
    minHeight: "560px",
    width: "100%",
    borderRadius: "18px",
    overflow: "hidden",
    border: "1px solid rgba(125, 211, 252, 0.35)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
    background: "#0f172a",
  }}
>
      <MapContainer
  center={[32.7757, -117.0719]}
  zoom={14}
  scrollWheelZoom={true}
  style={{
    height: "100%",
    width: "100%",
  }}
>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polygon
          positions={hazardZone}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#dc2626",
            fillOpacity: 0.25,
            weight: 2,
          }}
        />

        {escapeRoutes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.path}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
              dashArray: "8 8",
            }}
          >
            <Popup>
              <strong>{route.name}</strong>
              <br />
              Suggested escape route option
            </Popup>
          </Polyline>
        ))}

        {crews.map((crew) => (
          <Marker
            key={crew.unit_id}
            position={[crew.lat, crew.lon]}
            icon={createCrewIcon(crew, selectedCrewId === crew.unit_id)}
            eventHandlers={{
              click: () => onCrewSelect(crew.unit_id),
            }}
          >
            <Popup>
              <strong>{crew.unit_id}</strong>
              <br />
              {crew.riskSource === "pending" && <>Analyzing…</>}
              {crew.riskSource === "error" && (
                <>
                  Risk (telemetry): {riskScoreLabel(crew.risk_score)}/10
                  <br />
                </>
              )}
              {crew.riskSource === "api" && (
                <>
                  Risk: {riskScoreLabel(crew.risk_score)}/10 — {crew.risk_level ?? ""}
                  <br />
                  {crew.primary_reason && crew.primary_reason !== "—" && (
                    <>
                      {crew.primary_reason}
                      <br />
                    </>
                  )}
                </>
              )}
              {!crew.riskSource && (
                <>
                  Risk: {riskScoreLabel(crew.risk_score)}/10
                  <br />
                  Reason: {crew.primary_reason}
                  <br />
                </>
              )}
              Last seen: {crew.last_seen_minutes} min ago
              <br />
              Battery: {crew.battery}%
            </Popup>
          </Marker>
        ))}

        {cameraLocations.map((camera) => (
          <Marker
            key={camera.id}
            position={[camera.lat, camera.lon]}
            icon={cameraIcon}
          >
            <Popup>
              <strong>{camera.name}</strong>
              <br />
              {camera.summary}
            </Popup>
          </Marker>
        ))}

        {windArrows.map((wind) => (
          <Marker
            key={wind.id}
            position={[wind.lat, wind.lon]}
            icon={createWindIcon(wind)}
          >
            <Popup>
              <strong>Wind</strong>
              <br />
              Direction: {wind.direction}
              <br />
              Speed: {wind.speed}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}