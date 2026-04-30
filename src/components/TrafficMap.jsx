import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
const CameraPopup = React.lazy(() => import("./CameraPopup"));
import "leaflet/dist/leaflet.css";

// Leaflet Routing Machine is optional. We'll dynamically import it in RoutingControl.

// Fix Leaflet default icon issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createCameraIcon() {
  // Inline Lucide "Video" SVG — avoids Material Symbols font dependency in Leaflet HTML markers
  const videoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="camera-marker">${videoSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}


function createUserIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width: 16px; height: 16px; background: #4285F4; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function createDestIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width: 16px; height: 16px; background: #EA4335; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const MAP_CENTER = [10.7769, 106.7009];
const MAP_ZOOM = 12;

const CAMERA_ICON = createCameraIcon();
const USER_ICON = createUserIcon();
const DEST_ICON = createDestIcon();

// Component phụ để điều khiển Map Camera
function MapController({ userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.flyTo(userLocation, 15, { animate: true, duration: 1.5 });
    }
  }, [userLocation, map]);
  return null;
}

// Bắt sự kiện Click trên bản đồ
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
}

// Routing control component (creates L.Routing.Control and emits route data via onRouteFound)
function RoutingControl({ from, to, onRouteFound }) {
  const map = useMap();
  useEffect(() => {
    if (!from || !to || !map) return;

    let control = null;
    let cancelled = false;

    const onRoutesFound = (r) => {
      if (!r) return;
      // r may be in different shapes depending on source
      const coords = (r.coordinates || r.positions || [])
        .map((c) => {
          // coordinates might be [{lat, lng}] or [lat,lng]
          if (Array.isArray(c)) return [c[0], c[1]];
          if (c.lat !== undefined && c.lng !== undefined) return [c.lat, c.lng];
          return null;
        })
        .filter(Boolean);

      const distanceKm =
        r.summary && r.summary.totalDistance
          ? (r.summary.totalDistance / 1000).toFixed(1)
          : r.distance || "";
      const durationMin =
        r.summary && r.summary.totalTime
          ? Math.round(r.summary.totalTime / 60)
          : r.duration || "";

      const steps = (r.steps || r.instructions || []).map((ins) => {
        if (!ins) return { instruction: "", distance: "" };
        if (ins.text)
          return {
            instruction: ins.text,
            distance: ins.distance
              ? ins.distance > 1000
                ? `${(ins.distance / 1000).toFixed(1)}km`
                : `${Math.round(ins.distance)}m`
              : "",
          };
        // OSRM REST steps structure
        return {
          instruction:
            ins.maneuver && ins.maneuver.instruction
              ? ins.maneuver.instruction
              : ins.name || "",
          distance: ins.distance
            ? ins.distance > 1000
              ? `${(ins.distance / 1000).toFixed(1)}km`
              : `${Math.round(ins.distance)}m`
            : "",
        };
      });

      onRouteFound?.({
        segments: [{ color: "var(--secondary)", positions: coords }],
        positions: coords,
        eta: durationMin ? `${durationMin} phút` : r.eta || "",
        distance: distanceKm ? `${distanceKm} km` : r.distance || "",
        steps,
      });
    };

    (async () => {
      try {
        // Try dynamic import of leaflet-routing-machine
        await import("leaflet-routing-machine");
        try {
          await import("leaflet-routing-machine/dist/leaflet-routing-machine.css");
        } catch (e) {
          /* ignore css import failure */
        }

        if (cancelled) return;
        if (L.Routing) {
          const waypoints = [
            L.latLng(from[0], from[1]),
            L.latLng(to[0], to[1]),
          ];
          control = L.Routing.control({
            waypoints,
            lineOptions: {
              styles: [{ color: "#1A73E8", weight: 6, opacity: 0.9 }],
            },
            show: false,
            addWaypoints: false,
            draggableWaypoints: false,
            collapsible: false,
            createMarker: () => null,
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
            }),
          }).addTo(map);

          control.on("routesfound", (e) => {
            const r = e.routes && e.routes[0];
            if (!r) return;
            onRoutesFound({
              coordinates: r.coordinates,
              summary: r.summary,
              instructions: r.instructions,
            });
          });

          return;
        }
      } catch (err) {
        console.warn(
          "leaflet-routing-machine not available or failed to import — falling back to OSRM REST",
          err,
        );
      }

      // Fallback: call OSRM public REST API
      try {
        const fromLon = from[1];
        const fromLat = from[0];
        const toLon = to[1];
        const toLat = to[0];
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords =
            route.geometry && route.geometry.coordinates
              ? route.geometry.coordinates.map((c) => [c[1], c[0]])
              : [];

          // Extract steps from legs
          let steps = [];
          if (route.legs && route.legs[0] && route.legs[0].steps) {
            steps = route.legs[0].steps.map((step) => {
              let direction = "Đi thẳng";
              if (step.maneuver && step.maneuver.modifier) {
                if ((step.maneuver.modifier || "").includes("left"))
                  direction = "Rẽ trái";
                else if ((step.maneuver.modifier || "").includes("right"))
                  direction = "Rẽ phải";
                else if ((step.maneuver.modifier || "").includes("uturn"))
                  direction = "Quay đầu";
              }
              const street = step.name ? `vào ${step.name}` : "tiếp tục";
              return {
                instruction: `${direction} ${street}`,
                distance:
                  step.distance > 1000
                    ? `${(step.distance / 1000).toFixed(1)}km`
                    : `${Math.round(step.distance)}m`,
              };
            });
          }

          onRoutesFound({
            coordinates: coords.map((c) => ({ lat: c[0], lng: c[1] })),
            summary: {
              totalDistance: route.distance,
              totalTime: route.duration,
            },
            instructions: [],
            steps,
          });
        }
      } catch (err) {
        console.error("OSRM REST fallback failed", err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (control) {
          control.remove();
        }
      } catch (e) {}
    };
  }, [from, to, map, onRouteFound]);

  return null;
}

export default function TrafficMap({
  routeSegments,
  userLocation,
  destLocation,
  onMapClick,
  onRouteFound,
}) {
  const [liveCameras, setLiveCameras] = React.useState([]);

  React.useEffect(() => {
    const fetchCameras = async () => {
      try {
        const apiUrl =
          import.meta.env.VITE_API_URL ||
          "https://htrnguyen-trafficflow-api.hf.space/api";
        const res = await fetch(`${apiUrl}/cameras`);
        const data = await res.json();
        if (data && data.cameras) {
          setLiveCameras(data.cameras);
        }
      } catch (err) {
        console.error("Failed to load live cameras", err);
      }
    };
    fetchCameras();
  }, []);

  const renderedMarkers = React.useMemo(() => {
    return liveCameras.map((cam) => (
      <Marker key={cam.id} position={[cam.lat, cam.lng]} icon={CAMERA_ICON}>
        <Popup maxWidth={280} minWidth={200} closeButton={true}>
          <React.Suspense
            fallback={
              <div
                style={{
                  width: 220,
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Đang tải...
              </div>
            }
          >
            <CameraPopup camera={cam} />
          </React.Suspense>
        </Popup>
      </Marker>
    ));
  }, [liveCameras]);

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      zoomControl={true}
      style={{ width: "100%", height: "100%" }}
      id="traffic-map"
    >
      <MapController userLocation={userLocation} />
      <ClickHandler onMapClick={onMapClick} />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {userLocation && (
        <Marker position={userLocation} icon={USER_ICON} zIndexOffset={1000} />
      )}

      {destLocation && (
        <Marker position={destLocation} icon={DEST_ICON} zIndexOffset={1000} />
      )}

      {routeSegments?.map((segment, idx) => (
        <Polyline
          key={idx}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 6,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ))}

      {/* If both locations set, create a routing control to compute route and fire onRouteFound */}
      {userLocation && destLocation && (
        <RoutingControl
          from={userLocation}
          to={destLocation}
          onRouteFound={onRouteFound}
        />
      )}

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={false}
      >
        {renderedMarkers}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
