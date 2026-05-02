# 🚦 TrafficFlow AI - Điều hướng thông minh (Frontend)

Đây là mã nguồn Frontend (Web App & PWA) cho dự án NCKH: **Hệ thống Dự đoán và Điều hướng Giao thông thông minh tại TP.HCM**. Ứng dụng cung cấp giao diện trực quan bản đồ, tối ưu hoá cho thiết bị di động (Mobile PWA), hiển thị mật độ giao thông và tìm đường thông minh đi qua các trạm camera phân tích AI.

## 🌟 Tính năng nổi bật
- **Bản đồ Tương tác & Định vị (Google Maps Style):** Giao diện UI/UX được tối ưu hóa mượt mà, hỗ trợ định vị GPS thời gian thực.
- **AI-Aware Routing (Chỉ đường tránh kẹt xe):** Tính toán lộ trình thông minh dựa trên dự đoán mật độ giao thông từ mô hình Deep Learning.
- **Progressive Web App (PWA):** Sẵn sàng cài đặt trên iOS/Android từ trình duyệt (Add to Home Screen) và dễ dàng đóng gói thành APK.
- **Trực quan hoá Dữ liệu AI:** Hiển thị popup camera trực tiếp, mật độ giao thông 4 cấp độ (Thông thoáng, Đông vừa, Kẹt xe, Kẹt cứng).

## 🚀 Backend & Mô hình AI
Dự án sử dụng mô hình học sâu **ConvNeXt + ZIP (Zero-shot Image Prior)** để dự đoán mật độ phương tiện từ camera giao thông.

Toàn bộ Backend Service và Inference API đang được host trực tiếp trên **Hugging Face Spaces**.
- **🔗 Backend API & Document:** [TrafficFlow AI Backend on Hugging Face](https://huggingface.co/spaces/YOUR_HF_USERNAME/trafficflow-api)
- API Gateway hỗ trợ Swagger UI (`/docs`) và bypass CORS cho Vercel.

## 🛠 Cài đặt & Chạy Local
Dự án được xây dựng với React + Vite + Leaflet.

```bash
# Cài đặt thư viện
npm install

# Chạy server phát triển (Hot-reload)
npm run dev

# Build sản phẩm
npm run build
```

## 🌐 Triển khai (Deployment)
Dự án được cấu hình để triển khai một cú nhấp chuột lên **Vercel**.
1. Push mã nguồn này lên GitHub.
2. Đăng nhập Vercel, chọn Import Repository.
3. Không cần cấu hình thêm, Vercel sẽ tự động build với framework Vite.

---
## 📄 Bản quyền (Copyright & License)
© 2026 Nguyễn (htrnguyen). Đề tài Nghiên cứu Khoa học.
Mã nguồn này được phát triển phục vụ mục đích nghiên cứu học thuật. Vui lòng không sao chép hoặc tái sử dụng cho mục đích thương mại khi chưa có sự cho phép.
