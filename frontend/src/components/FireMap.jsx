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
  if (score >= 8) return "#dc2626";
  if (score >= 6) return "#f97316";
  return "#16a34a";
};

const createCrewIcon = (crew) =>
  L.divIcon({
    className: "crew-marker",
    html: `
      <div style="
        background:${riskColor(crew.risk_score)};
        color:white;
        border-radius:999px;
        width:36px;
        height:36px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
      ">
        ${crew.risk_score}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
  onCrewSelect = () => {},
}) {
  return (
    <div
      style={{
        height: "600px",
        width: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        border: "2px solid #cbd5e1",
        background: "#e2e8f0",
      }}
    >
      <MapContainer
        center={[38.5816, -121.4944]}
        zoom={13}
        scrollWheelZoom={true}
        style={{
          height: "600px",
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
            icon={createCrewIcon(crew)}
            eventHandlers={{
              click: () => onCrewSelect(crew.unit_id),
            }}
          >
            <Popup>
              <strong>{crew.unit_id}</strong>
              <br />
              Risk: {crew.risk_score}/10
              <br />
              Last seen: {crew.last_seen_minutes} min ago
              <br />
              Battery: {crew.battery}%
              <br />
              Reason: {crew.primary_reason}
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