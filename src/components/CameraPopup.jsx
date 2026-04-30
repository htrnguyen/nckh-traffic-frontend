import React, { useState, useEffect } from 'react';
import { getCameraImageUrl } from '../data/cameras';
import {
  LuScanSearch,
  LuClock,
  LuCar,
  LuBike,
  LuActivity,
  LuTally5,
} from 'react-icons/lu';

const DENSITY_CONFIG = {
  low: { label: 'Thông thoáng', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  moderate: { label: 'Đông vừa', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  heavy: { label: 'Kẹt xe', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  severe: { label: 'Kẹt cứng', color: '#991b1b', bg: 'rgba(153,27,27,0.12)' },
};

export default function CameraPopup({ camera }) {
  const [imageUrl, setImageUrl] = useState(getCameraImageUrl(camera.id));
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-refresh image every 5 seconds to simulate real-time feed
  useEffect(() => {
    const interval = setInterval(() => {
      setImageUrl(getCameraImageUrl(camera.id));
    }, 5000);
    return () => clearInterval(interval);
  }, [camera.id]);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Tải ảnh từ HCMC bằng mạng Việt Nam (qua Vite Proxy để né CORS)
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error('Không thể lấy ảnh từ HCMC');
      const imageBlob = await imageResponse.blob();

      // 2. Upload thẳng ảnh đó lên Hugging Face (tránh việc HF bị chặn IP)
      const formData = new FormData();
      formData.append('file', imageBlob, 'camera.jpg');

      const apiUrl = import.meta.env.VITE_API_URL || 'https://htrnguyen-trafficflow-api.hf.space/api';
      const predictResponse = await fetch(`${apiUrl}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!predictResponse.ok) throw new Error('AI Model phân tích thất bại');
      const data = await predictResponse.json();
      setPrediction(data.prediction);
    } catch (err) {
      console.error(err);
      setError('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const density = prediction ? DENSITY_CONFIG[prediction.density_level] || DENSITY_CONFIG.low : null;

  return (
    <div className="camera-popup">
      <div className="camera-popup__img-wrap">
        <img
          src={imageUrl}
          alt={`Camera ${camera.name}`}
          loading="lazy"
          onError={(e) => {
            e.target.src = `https://placehold.co/400x300/e2e8f0/64748b?text=Camera+Offline`;
          }}
        />
        <div className="camera-popup__live-badge">
          <span className="camera-popup__live-dot" />
          Live
        </div>
      </div>
      <div className="camera-popup__info">
        <div className="camera-popup__title">{camera.name}</div>
        <div className="camera-popup__subtitle">{camera.district}</div>
        
        <div style={{ marginTop: '10px' }}>
          {prediction ? (
            <div className="prediction-result">
              {/* Vehicle counts row */}
              <div className="prediction-result__counts">
                <div className="prediction-result__count-item">
                  <LuCar size={16} color="#3b82f6" />
                  <span className="prediction-result__count-value">{prediction.car_count}</span>
                  <span className="prediction-result__count-label">Ô tô</span>
                </div>
                <div className="prediction-result__divider" />
                <div className="prediction-result__count-item">
                  <LuBike size={16} color="#8b5cf6" />
                  <span className="prediction-result__count-value">{prediction.motorbike_count}</span>
                  <span className="prediction-result__count-label">Xe máy</span>
                </div>
                <div className="prediction-result__divider" />
                <div className="prediction-result__count-item">
                  <LuTally5 size={16} color="#0f172a" />
                  <span className="prediction-result__count-value">{prediction.total_count}</span>
                  <span className="prediction-result__count-label">Tổng</span>
                </div>
              </div>

              {/* Status row */}
              <div className="prediction-result__status">
                <span
                  className="prediction-result__badge"
                  style={{ color: density.color, background: density.bg }}
                >
                  <LuActivity size={12} />
                  {density.label}
                </span>
                <span className="prediction-result__time">
                  <LuClock size={11} />
                  {prediction.inference_time_ms}ms
                </span>
              </div>
            </div>
          ) : (
            <button 
              onClick={handlePredict} 
              disabled={loading}
              className="predict-button"
            >
              <LuScanSearch size={16} />
              {loading ? 'Đang phân tích...' : 'Đếm xe (ZIP AI)'}
            </button>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
