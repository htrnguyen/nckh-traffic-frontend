import React, { useState, useEffect, useRef } from "react";
import {
  LuRoute,
  LuChevronUp,
  LuChevronDown,
  LuLocateFixed,
  LuMapPin,
  LuClock,
  LuCar,
  LuNavigation,
  LuCornerUpLeft,
  LuCornerUpRight,
  LuUndo2,
  LuMoveUp,
} from "react-icons/lu";

const SLIDER_LABELS = ["Hiện tại", "+1 giờ", "+2 giờ", "+4 giờ"];

export default function ControlPanel({
  originText,
  setOriginText,
  destText,
  onOriginSelect,
  onDestinationSelect,
  sliderValue,
  onSliderChange,
  eta,
  distance,
  trafficLevel,
  navigationSteps,
  onStartNavigation,
}) {
  const [localDestText, setLocalDestText] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Store raw data to find coordinates when user selects a datalist option
  const rawOriginData = useRef([]);
  const rawDestData = useRef([]);

  // Sync prop destText to local state when map is clicked
  useEffect(() => {
    if (destText) {
      setLocalDestText(destText);
    }
  }, [destText]);

  const fetchSuggestions = async (query, setSuggestions, rawRef) => {
    if (!query || query.length < 3) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=vn&limit=5`,
      );
      const data = await res.json();
      rawRef.current = data;
      setSuggestions(data.map((item) => item.display_name));
    } catch (err) {
      console.error("Lỗi khi tìm kiếm địa điểm", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(
      () => fetchSuggestions(originText, setOriginSuggestions, rawOriginData),
      600,
    );
    return () => clearTimeout(timer);
  }, [originText]);

  useEffect(() => {
    const timer = setTimeout(
      () => fetchSuggestions(localDestText, setDestSuggestions, rawDestData),
      600,
    );
    return () => clearTimeout(timer);
  }, [localDestText]);

  // Handle Datalist selection
  const handleOriginChange = (e) => {
    const val = e.target.value;
    setOriginText(val);
    const match = rawOriginData.current.find(
      (item) => item.display_name === val,
    );
    if (match) {
      onOriginSelect?.({
        text: val,
        lat: parseFloat(match.lat),
        lon: parseFloat(match.lon),
      });
    }
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setLocalDestText(val);
    const match = rawDestData.current.find((item) => item.display_name === val);
    if (match) {
      onDestinationSelect?.({
        text: val,
        lat: parseFloat(match.lat),
        lon: parseFloat(match.lon),
      });
    }
  };

  const getTrafficVietnamese = (level) => {
    if (!level) return "Đang tính...";
    if (level === "low") return "Thông thoáng";
    if (level === "moderate") return "Đông vừa";
    if (level === "heavy") return "Kẹt xe";
    if (level === "severe") return "Kẹt cứng";
    return level;
  };

  const isHeavy =
    trafficLevel === "Kẹt nặng" ||
    trafficLevel === "Kẹt cứng" ||
    trafficLevel === "heavy" ||
    trafficLevel === "severe";
  const trafficColor = isHeavy
    ? "var(--error)"
    : trafficLevel === "moderate"
      ? "var(--warning)"
      : "var(--secondary)";
  const trafficText = getTrafficVietnamese(trafficLevel);

  const getLabelFromValue = (val) => {
    if (val <= 5) return "Bây giờ";
    if (val <= 35) return "+1 giờ";
    if (val <= 65) return "+2 giờ";
    return "+4 giờ";
  };

  const getStepIcon = (instruction) => {
    if (instruction.includes("trái")) return <LuCornerUpLeft size={18} />;
    if (instruction.includes("phải")) return <LuCornerUpRight size={18} />;
    if (instruction.includes("quay đầu")) return <LuUndo2 size={18} />;
    return <LuMoveUp size={18} />;
  };

  return (
    <div
      className="control-panel"
      id="control-panel"
      style={{
        height: isExpanded ? "auto" : "60px",
        overflow: "hidden",
        cursor: isExpanded ? "default" : "pointer",
      }}
    >
      {/* Header Panel */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "white",
        }}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <LuRoute size={20} color="var(--primary)" />
          <span className="font-headline-md" style={{ fontSize: "16px" }}>
            Tra cứu lộ trình
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--on-surface-variant)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {isExpanded ? <LuChevronUp size={22} /> : <LuChevronDown size={22} />}
        </button>
      </div>

      <div
        className="control-panel__body"
        style={{ display: isExpanded ? "flex" : "none", paddingTop: 0 }}
      >
        {/* Route Inputs */}
        <div className="route-inputs">
          <div className="route-inputs__line" />
          <div className="route-input">
            <LuLocateFixed size={18} className="icon-origin" />
            <input
              type="text"
              list="origin-suggestions"
              placeholder="Điểm đi (Ví dụ: Chợ Bến Thành)"
              value={originText}
              onChange={handleOriginChange}
            />
            <datalist id="origin-suggestions">
              {originSuggestions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>
          <div className="route-input">
            <LuMapPin size={18} className="icon-dest" />
            <input
              type="text"
              list="dest-suggestions"
              placeholder="Điểm đến (Ví dụ: Đại học Tôn Đức Thắng)"
              value={localDestText}
              onChange={handleDestChange}
            />
            <datalist id="dest-suggestions">
              {destSuggestions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="divider" />

        {/* Predict Traffic Slider */}
        <div className="predict-slider">
          <div className="predict-slider__header">
            <label className="predict-slider__label font-label-md">
              <LuClock size={14} />
              Dự đoán giao thông
            </label>
            <span className="predict-slider__value font-label-md">
              {getLabelFromValue(sliderValue)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={(e) => onSliderChange?.(Number(e.target.value))}
          />
          <div className="predict-slider__marks font-label-sm">
            {SLIDER_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        {/* Summary Panel */}
        {distance && (
          <>
            <div
              className="summary-panel"
              style={{
                marginBottom: navigationSteps?.length > 0 ? "12px" : "0",
              }}
            >
              <div className="summary-left">
                <div className="summary-icon">
                  <LuCar size={20} />
                </div>
                <div>
                  <div
                    className="summary-eta font-headline-md"
                    style={{ fontSize: 18 }}
                  >
                    {eta}
                  </div>
                  <div className="summary-label font-label-sm">
                    Tuyến đường nhanh nhất
                  </div>
                </div>
              </div>
              <div className="summary-right">
                <span className="summary-distance font-body-md">
                  {distance}
                </span>
                <span
                  className="summary-traffic font-label-sm"
                  style={{ color: trafficColor }}
                >
                  <span
                    className="summary-traffic__dot"
                    style={{ background: trafficColor }}
                  />
                  {trafficText}
                </span>
              </div>
            </div>

            {/* Navigation Steps */}
            {navigationSteps && navigationSteps.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    maxHeight: "160px",
                    overflowY: "auto",
                    background: "#F8FAFC",
                    borderRadius: "12px",
                    padding: "12px",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div
                    className="font-label-md"
                    style={{
                      marginBottom: "8px",
                      color: "var(--on-surface-variant)",
                    }}
                  >
                    Chỉ đường chi tiết:
                  </div>
                  {navigationSteps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        marginBottom: "8px",
                        borderBottom:
                          idx !== navigationSteps.length - 1
                            ? "1px solid #E2E8F0"
                            : "none",
                        paddingBottom: "8px",
                      }}
                    >
                      <span style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }}>
                        {getStepIcon(step.instruction)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          className="font-body-md"
                          style={{ fontSize: "13px" }}
                        >
                          {step.instruction}
                        </div>
                        <div
                          className="font-label-sm"
                          style={{ color: "var(--on-surface-variant)" }}
                        >
                          {step.distance}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nút Bắt đầu Điều Hướng */}
                <button onClick={onStartNavigation} className="start-button">
                  <LuNavigation size={18} />
                  Bắt đầu
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
