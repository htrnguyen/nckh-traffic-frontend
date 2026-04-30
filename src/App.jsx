import React, { useState, useEffect } from "react";
import {
  LuLocateFixed,
  LuX,
  LuCornerUpLeft,
  LuCornerUpRight,
  LuUndo2,
  LuMoveUp,
  LuRuler,
} from "react-icons/lu";
import TopBar from "./components/TopBar";
import ControlPanel from "./components/ControlPanel";
import TrafficMap from "./components/TrafficMap";
import "./index.css";

// Navigation UI Overlay (Mô phỏng Giao diện Lái xe)
function NavigationOverlay({ steps, eta, distance, onExit }) {
  const currentStep =
    steps && steps.length > 0
      ? steps[0]
      : { instruction: "Đi thẳng đến đích", distance: distance };

  const getIcon = (text) => {
    if (text.includes("trái")) return <LuCornerUpLeft size={48} />;
    if (text.includes("phải")) return <LuCornerUpRight size={48} />;
    if (text.includes("quay đầu")) return <LuUndo2 size={48} />;
    return <LuMoveUp size={48} />;
  };

  return (
    <div className="navigation-overlay">
      <div className="nav-header">
        <span className="nav-icon">
          {getIcon(currentStep.instruction)}
        </span>
        <div>
          <div className="nav-main">{currentStep.instruction}</div>
          <div className="nav-sub">
            <LuRuler size={16} />
            {currentStep.distance}
          </div>
        </div>
      </div>

      <div className="nav-footer">
        <div>
          <div className="eta">{eta}</div>
          <div className="meta">{distance} · Sắp tới nơi</div>
        </div>
        <button className="nav-exit-btn" onClick={onExit}>
          <LuX size={18} />
          Thoát
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [sliderValue, setSliderValue] = useState(0);
  const [originObj, setOriginObj] = useState(null);
  const [destObj, setDestObj] = useState(null);
  const [originText, setOriginText] = useState("");
  const [isNavigating, setIsNavigating] = useState(false); // Trạng thái "Đang lái xe"

  const [routeData, setRouteData] = useState({
    segments: [],
    eta: "",
    distance: "",
    trafficLevel: "",
    steps: [], // Turn-by-turn instructions
  });

  // Handler receives route info emitted from TrafficMap (RoutingControl)
  const handleRouteFound = (route) => {
    if (!route) return;
    setRouteData({
      segments:
        route.segments ||
        (route.positions
          ? [{ color: "var(--secondary)", positions: route.positions }]
          : []),
      eta: route.eta || "",
      distance: route.distance || "",
      trafficLevel: route.trafficLevel || "low",
      steps: route.steps || [],
    });
  };

  const handleFloatingGPSClick = () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }
    setOriginText("Đang lấy vị trí...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = await res.json();
          const address = data.display_name.split(",").slice(0, 3).join(",");
          setOriginText(address);
          setOriginObj({ text: address, lat: latitude, lon: longitude });
        } catch (err) {
          console.error("Lỗi lấy vị trí", err);
          setOriginText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setOriginObj({
            text: "Vị trí hiện tại",
            lat: latitude,
            lon: longitude,
          });
        }
      },
      () => {
        alert("Vui lòng cấp quyền truy cập vị trí trong trình duyệt.");
        setOriginText("");
      },
    );
  };

  // User clicks on map to set Destination
  const handleMapClick = async (latlng) => {
    if (isNavigating) return; // Khóa tương tác map khi đang lái xe
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`,
      );
      const data = await res.json();
      const address = data.display_name.split(",").slice(0, 3).join(",");

      const newPoint = { text: address, lat: latlng.lat, lon: latlng.lng };
      if (!originObj) {
        setOriginText(address);
        setOriginObj(newPoint);
      } else {
        setDestObj(newPoint);
      }
    } catch (err) {
      console.error("Lỗi khi reverse geocode điểm click", err);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <TrafficMap
        routeSegments={routeData.segments}
        userLocation={originObj ? [originObj.lat, originObj.lon] : null}
        destLocation={destObj ? [destObj.lat, destObj.lon] : null}
        onMapClick={handleMapClick}
        onRouteFound={handleRouteFound}
      />

      {!isNavigating && (
        <>
          <TopBar />
          <ControlPanel
            originText={originText}
            setOriginText={setOriginText}
            destText={destObj ? destObj.text : ""}
            onOriginSelect={setOriginObj}
            onDestinationSelect={setDestObj}
            sliderValue={sliderValue}
            onSliderChange={setSliderValue}
            eta={routeData.eta}
            distance={routeData.distance}
            trafficLevel={routeData.trafficLevel}
            navigationSteps={routeData.steps}
            onStartNavigation={() => setIsNavigating(true)}
          />

          {/* Nút GPS trôi nổi góc dưới bên phải */}
          <button
            onClick={handleFloatingGPSClick}
            className="floating-gps-button"
            title="Đến vị trí hiện tại"
          >
            <LuLocateFixed size={24} />
          </button>
        </>
      )}

      {isNavigating && (
        <NavigationOverlay
          steps={routeData.steps}
          eta={routeData.eta}
          distance={routeData.distance}
          onExit={() => setIsNavigating(false)}
        />
      )}
    </div>
  );
}
