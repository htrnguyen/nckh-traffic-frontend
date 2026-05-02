# TrafficFlow AI - Hệ thống Điều phối & Dự báo Giao thông Thông minh (NCKH)

TrafficFlow AI là một hệ thống toàn diện kết hợp **Thị giác Máy tính (Computer Vision)**, **Trí tuệ Nhân tạo (AI)**, và **Thuật toán Đồ thị** nhằm giải quyết bài toán ách tắc giao thông đô thị. Hệ thống tự động thu thập hình ảnh từ các camera giao thông công cộng, phân tích mật độ phương tiện theo thời gian thực và đề xuất lộ trình tối ưu (Dynamic Routing) cho người tham gia giao thông.

Tài liệu này đóng vai trò là **Tài liệu Thiết kế Hệ thống Chi tiết**, hỗ trợ trực tiếp cho quá trình viết báo cáo Nghiên cứu Khoa học (NCKH).

---

## 1. Kiến trúc Hệ thống Tổng thể (System Architecture)

![Kiến trúc Hệ thống Tổng thể](./docs/nckh_master_diagram.png)

Hệ thống được thiết kế theo kiến trúc Microservices / Decoupled Architecture, bao gồm ba khối chính: **Client (Frontend Routing)**, **Inference Engine (FastAPI + ONNX)**, và **Data Crawler (Node.js)**.

```mermaid
graph TD
    %% Định nghĩa các node chi tiết
    subgraph Frontend [Traffic App - React.js]
        UI(["Giao diện Người dùng (Map & Routing UI)"])
        OSRM_FE["Gọi API OSRM (Lấy 3 Lộ trình)"]
        ExtractCam["Lọc Camera bán kính 500m (Haversine)"]
        ApplyPen["Áp dụng Time Penalty (1.0x - 3.0x)"]
        Popup_UI["Lazy Load Camera Popup (Hiển thị Heatmap Base64)"]
    end

    subgraph Backend [TrafficFlow API - FastAPI]
        API_Route["Endpoints: POST /predict/batch & GET /predict/camera"]
        Sem["asyncio.Semaphore(15) (Giới hạn tải)"]
        Proxy["httpx.AsyncClient (Auto-Retry 5x)"]
        Cache[("In-Memory LRU Cache (Fault Tolerance)")]
        Thread["ThreadPoolExecutor (CPU-bound)"]
    end

    subgraph AI_Engine [AI Inference - ONNX Runtime]
        Preprocess["Resize 320x320 & Normalize (Mean/Std)"]
        ONNX_Model["CLIP-EBC (ConvNeXt Backbone) - INT8 Quantization"]
        Heatmap_Gen["Sinh ảnh Heatmap Base64 (OpenCV cv2.COLORMAP_JET)"]
        Postprocess["Trích xuất Count & Gắn nhãn Mật độ"]
    end

    subgraph External [Dich vu Ngoai vi]
        OSRM_API["OSRM Routing Engine API"]
        HCM_API["Cổng Giao thông TP.HCM (Camera Stream)"]
    end

    subgraph Crawler [Data Crawler - Node.js]
        Master["Master Process (index.js)"]
        Worker["Worker Processes (crawl.js)"]
        Hash["MD5 Hash Deduplication"]
        Disk[("Local Storage Dataset")]
    end

    %% Luồng Frontend
    UI -->|1. Nhập Điểm A & B| OSRM_FE
    OSRM_FE -->|2. Fetch Route| OSRM_API
    OSRM_API -->|3. Trả về GeoJSON| OSRM_FE
    OSRM_FE --> ExtractCam
    ExtractCam -->|4. Gửi danh sách Camera_IDs| API_Route
    
    %% Luồng Backend
    API_Route --> Sem
    Sem --> Proxy
    Proxy -->|5. HTTP GET (Retry 5 lần)| HCM_API
    HCM_API -- Lỗi đứt kết nối / Timeout --> Cache
    HCM_API -- Thành công --> Proxy
    Proxy -->|Lưu ảnh Backup| Cache
    Proxy --> Thread
    Cache -.->|Fallback Image| Thread

    %% Luồng AI
    Thread --> Preprocess
    Preprocess --> ONNX_Model
    ONNX_Model -->|AVX2 CPU Instructions| Postprocess
    Postprocess --> Heatmap_Gen
    Postprocess -->|6. JSON Density Array| ApplyPen
    Heatmap_Gen -->|Trả về Base64 String| Popup_UI

    %% Trả về UI
    ApplyPen -->|7. ETA Mới| UI
    Popup_UI -->|Tương tác người dùng| UI

    %% Luồng Crawler (Độc lập)
    Master -->|Fork mỗi 8 giây| Worker
    Worker -->|Spoof Headers| HCM_API
    Worker --> Hash
    Hash -->|Nếu ảnh mới| Disk

    %% Styling
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef backend fill:#10b981,stroke:#047857,color:#fff;
    classDef ai fill:#8b5cf6,stroke:#6d28d9,color:#fff;
    classDef external fill:#f59e0b,stroke:#b45309,color:#fff;
    classDef crawler fill:#ec4899,stroke:#be185d,color:#fff;
    classDef database fill:#64748b,stroke:#334155,color:#fff;

    class UI,OSRM_FE,ExtractCam,ApplyPen,Popup_UI frontend;
    class API_Route,Sem,Proxy,Thread backend;
    class Preprocess,ONNX_Model,Postprocess,Heatmap_Gen ai;
    class OSRM_API,HCM_API external;
    class Master,Worker crawler;
    class Cache,Disk database;
```

**Mô tả luồng hoạt động (Data Flow):**
1. **Frontend** hiển thị bản đồ Leaflet. Khi người dùng click vào một Camera, hệ thống sẽ **Lazy Load** giao diện Popup và gửi yêu cầu `GET /predict/camera/{id}?heatmap=true` đến Backend.
2. **Backend (Proxy Controller)** khởi tạo kết nối thông qua `httpx.AsyncClient` tích hợp cơ chế **Auto-Retry (5 lần)**. Nếu Cổng Giao thông TP.HCM bị lỗi rớt gói tin hoặc ngắt kết nối đột ngột (`RemoteProtocolError`), Backend sẽ tự động kết nối lại dưới nền mà không báo lỗi ngay lập tức.
3. Khi tải ảnh thô thành công, dữ liệu được truyền qua **AI Inference Engine (ONNX)**. Mô hình CLIP-EBC đếm lượng xe, phân loại mức độ ùn tắc, đồng thời **OpenCV** sử dụng ma trận mật độ (Density Tensor) để nội suy và sinh ra bức ảnh **Heatmap Base64** nhuộm phổ màu `JET`.
4. Nếu cả 5 lần Retry đều thất bại (Sở GTVT sập hoàn toàn), Backend kích hoạt **Fault Tolerance**, truy xuất ảnh gần nhất từ **In-Memory LRU Cache** để dự báo, đảm bảo UI Frontend không bao giờ bị lỗi hiển thị. Dữ liệu sau đó trả về cho React để Toggle linh hoạt giữa ảnh thật và ảnh AI.

---

## 2. Frontend: Web App & Giao diện Điều hướng (Navigation)

### Công nghệ sử dụng
* **Core:** React.js, Vite.
* **Bản đồ & Không gian (Geospatial):** Leaflet, `react-leaflet`, `react-leaflet-cluster` để tối ưu render hàng ngàn marker camera cùng lúc.
* **Định tuyến (Routing):** Tích hợp OSRM (Open Source Routing Machine) API và các thuật toán nội bộ.
* **Giao diện (UI/UX):** Vanilla CSS thuần, tối ưu hóa CSS Variables, thiết kế theo ngôn ngữ Material Design / Google Maps UX (Card-based Control Panel, Floating Navigation).

### Thuật toán AI-Aware Dynamic Routing (Định tuyến thông minh)
Chức năng điều hướng của ứng dụng không chỉ đơn thuần dùng thuật toán đường đi ngắn nhất (Dijkstra) cơ bản, mà sử dụng **Dijkstra kết hợp Trọng số Mật độ (Density-Penalized Routing)**.

![Thuật toán Định tuyến Thông minh AI](./docs/ai_routing_pipeline.png)

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend Map
    participant Routing as Routing Engine (OSRM)
    participant AI as TrafficFlow API
    
    User->>FE: Nhập Điểm đi (A) & Điểm đến (B)
    FE->>Routing: Tính toán các lộ trình thay thế (Alternatives)
    Routing-->>FE: Trả về 3 lộ trình (Toạ độ GPS)
    
    FE->>AI: Gửi danh sách Camera xung quanh lộ trình (Batch Predict)
    AI-->>FE: Trả về { camera_id, density_level, speed_penalty }
    
    Note over FE,AI: Áp dụng Công thức Phạt Thời gian (Time Penalty)
    
    FE->>FE: Tính toán ETA mới: ETA_AI = ETA_OSRM * (1 + Average_Penalty)
    FE-->>User: Hiển thị Lộ trình Tối ưu nhất (Xanh, Vàng, Đỏ)
```

**Cơ chế Tính toán Trọng số:**
Hệ thống lấy các camera dọc theo tuyến đường, đánh giá mức độ kẹt xe để áp đặt hệ số phạt thời gian ($P$):
* `Low (Thông thoáng)`: $P = 1.0$ (Tốc độ tối đa).
* `Moderate (Đông vừa)`: $P = 1.25$ (Chậm lại 25%).
* `Heavy (Kẹt xe)`: $P = 1.8$ (Tốn gần gấp đôi thời gian).
* `Severe (Kẹt cứng)`: $P = 3.0$ (Tránh đi vào đường này).

**Mô hình Toán học (Mathematical Formulation):**
Gọi đồ thị mạng lưới giao thông là $G = (V, E)$, với $e \in E$ là một đoạn đường đi kèm thời gian di chuyển cơ bản lấy từ OSRM là $T_{base}(e)$.
Gọi $C_e$ là tập hợp các camera AI bao phủ hoặc nằm gần đoạn đường $e$. Hệ số phạt $P(c)$ của camera $c \in C_e$ là đầu ra của AI Inference Engine.
Thời gian dự kiến thực tế $T_{AI}(e)$ đi qua đoạn đường $e$ được chuẩn hoá bằng công thức:
$$ T_{AI}(e) = T_{base}(e) \times \max_{c \in C_e} \left( P(c) \right) $$

Hệ thống sẽ tìm kiếm lộ trình tối ưu $p^*$ từ điểm $A$ đến $B$ nhằm cực tiểu hoá tổng thời gian di chuyển:
$$ p^* = \arg\min_{p} \sum_{e \in p} T_{AI}(e) $$

Nhờ vậy, thuật toán có thể chủ động né các tuyến đường tuy có khoảng cách ngắn nhưng lại có camera đang báo "Severe" (Kẹt cứng, $P=3.0$).

---

## 3. Backend: Inference Service & Proxy (FastAPI)

### Công nghệ sử dụng
* **Core Framework:** Python 3.11+, FastAPI (Tối ưu hiệu năng I/O bất đồng bộ bằng `asyncio`).
* **HTTP Client:** `httpx` (Hỗ trợ Async/Await để gọi API ngoại vi không block thread).
* **AI Runtime:** `onnxruntime` cho tốc độ xử lý mạng Neural Network cực nhanh trên kiến trúc CPU thuần (Deploy production-friendly).
* **WSGI/ASGI Server:** Uvicorn.

### Xử lý Đồng thời (Concurrency) & Batch Inference
Việc dự đoán mật độ giao thông trên diện rộng (Ví dụ: Toàn bộ Quận 1) đòi hỏi phải fetch và chạy AI trên hàng chục camera cùng lúc. Backend giải quyết bằng cơ chế Semaphore và ThreadPool:

```mermaid
flowchart TD
    Start(["Client gọi /api/predict/batch"]) --> GetCameras["Truy xuất danh sách Camera"]
    GetCameras --> AsyncSem["Khởi tạo asyncio.Semaphore(15)"]
    AsyncSem --> Fetch["Tải ảnh đồng thời (Async HTTP)"]
    Fetch --> ThreadPool["Đưa ảnh vào CPU ThreadPoolExecutor"]
    ThreadPool --> ONNX["ONNX Runtime Inference"]
    ONNX --> Aggregate["Tổng hợp kết quả"]
    Aggregate --> End(["Trả về JSON Response"])
    
    subgraph Fail_Safe_Mechanism [Fail-Safe Mechanism]
        Fetch -- Lỗi mạng --> FallbackCache[("Lấy ảnh từ LRU Cache")]
        FallbackCache --> ThreadPool
    end
```

**Tại sao dùng ThreadPool cho ONNX?**
AI Model Inference là tác vụ giới hạn bởi CPU (CPU-bound). Nếu chạy trực tiếp trên luồng chính của FastAPI, nó sẽ block toàn bộ server, khiến các request khác bị treo. Bằng cách dùng `run_in_threadpool`, FastAPI chuyển tác vụ tính toán toán học nặng nề sang một luồng (thread) riêng biệt.

**Mô hình Toán học Thông lượng (Queueing Theory):**
Dựa trên **Định lý Little (Little's Law)**, số lượng luồng đồng thời $L$ được cấu hình thông qua `asyncio.Semaphore(15)` nhằm tối ưu hóa thông lượng $\lambda$ và thời gian xử lý trung bình $W$:
$$ L = \lambda \times W $$
Với $L = 15$, hệ thống giới hạn chính xác số lượng Tensor được nạp vào RAM tại bất kỳ thời điểm nào, ngăn ngừa hiện tượng cạn kiệt bộ nhớ (OOM - Out of Memory) trên máy chủ cấu hình thấp, đồng thời giữ cho $\lambda$ đạt ngưỡng tối đa giới hạn bởi CPU.

---

## 4. Mô hình Trí tuệ Nhân tạo (Computer Vision Pipeline)

### Quá trình tiền xử lý và Kiến trúc Mô hình
Mô hình đếm số lượng xe (Crowd/Vehicle Counting) ban đầu được train trên PyTorch với kiến trúc cơ sở là **ConvNeXt Base** (Phiên bản được tối ưu hoá từ ResNet cho tốc độ và độ chính xác của Vision Transformer).

Để đạt chuẩn Deploy Production với độ trễ (Latency) dưới `200ms`, toàn bộ Pipeline AI đã được nâng cấp như sau:

1. **Fixed Resolution (Độ phân giải cố định):** Kích thước đầu vào của mạng Convolution được lock cứng ở `320x320` pixel (thay vì 448x448) giúp giảm 50% số lượng phép tính (FLOPs).
2. **ONNX Export (Đóng gói mô hình):** Biến đổi file Pytorch (`.pth`) có dung lượng lớn thành Đồ thị tính toán tĩnh (Static Computation Graph) thông qua `torch.onnx.export`. 
3. **INT8 Quantization (Lượng tử hóa):** Trọng số mạng (Weights) từ `Float32` (32-bit) được chuyển xuống `INT8` (8-bit).
    - Giảm dung lượng model trên RAM/VRAM gấp 4 lần.
    - Giúp CPU có thể xử lý các phép nhân ma trận song song bằng tập lệnh AVX2.

**Mô hình Toán học Lượng tử hoá (Affine Quantization Mapping):**
Để chuyển đổi từ không gian số thực `Float32` sang số nguyên `INT8` mà không làm mất mát quá nhiều đặc trưng hình ảnh, dự án áp dụng phương trình ánh xạ tuyến tính (Affine Mapping):
$$ x_{int8} = \text{round} \left( \frac{x_{f32}}{S} + Z \right) $$
Trong đó:
* $S$ (Scale factor): Hệ số co giãn miền giá trị.
* $Z$ (Zero-point): Điểm dịch chuyển bù trừ (thường là 0 đối với Symmetric Quantization).
Các tham số $S$ và $Z$ được tính toán trên tập dữ liệu kiểm thử (Calibration Dataset) thông qua quá trình Post-Training Quantization (PTQ). Nhờ công thức này, miền giá trị liên tục được ép xuống miền rời rạc $[-128, 127]$, giảm gánh nặng tính toán ma trận về mức tối thiểu.

### Luồng nội suy hình ảnh (Inference Pipeline)

![Luồng Nội suy AI Thị giác Máy tính](./docs/cv_inference_pipeline.png)

```mermaid
graph LR
    Img["Ảnh JPEQ từ Sở GTVT"] --> Resize["Resize 320x320, Normalize (Mean/Std)"]
    Resize --> Tensor["Float Tensor [1, 3, 320, 320]"]
    Tensor --> ONNX["ONNX Runtime (convnext_base_w_320)"]
    ONNX --> Output["Heatmap / Count Array"]
    Output --> Post["Tổng hợp số đếm & Gắn nhãn"]
    Post --> Label(("Low / Moderate / Heavy"))
```

---

## 5. Quy trình Thu thập và Xử lý Dữ liệu Thực tế (Data Crawling Operations)

Để có dữ liệu huấn luyện mô hình (Training Dataset) và vận hành hệ thống, một Microservice độc lập mang tên **CrawlCamera** đã được xây dựng và triển khai trên nền tảng đám mây **Fly.io** (Region: Singapore).

### 5.1. Kiến trúc Thu thập Dữ liệu Đa luồng (Multi-Processing Crawler)

![Kiến trúc Thu thập Dữ liệu Đa luồng Crawler](./docs/crawler_architecture.png)

Hệ thống Crawler được viết bằng **Node.js**, áp dụng kiến trúc Master-Worker nhằm tối đa hóa hiệu năng:
- **Master Process (`index.js`)**: Đóng vai trò điều phối. Nó đọc danh sách hàng trăm camera từ file JSON (đã qua bước phân giải toạ độ OpenCage để gom nhóm theo Quận), sau đó `fork()` ra các Child Process. Nếu một Child Process bị crash (do timeout hoặc lỗi mạng), Master sẽ chờ 2 giây và tự động khởi động lại tiến trình đó (Cơ chế Self-Healing).
- **Worker Process (`crawl.js`)**: Mỗi camera được gán một tiến trình con chạy độc lập. Cứ mỗi **8 giây** (8000ms), Worker gọi API của Sở GTVT TP.HCM để kéo ảnh dạng `arraybuffer`. Nó được cấu hình chỉ tự huỷ (exit) nếu gặp quá 10 lỗi kết nối liên tiếp.

### 5.2. Các Kỹ thuật Tránh Cấm tải (Anti-Ban) và Tối ưu Lưu trữ
* **Header Spoofing:** Sử dụng thư viện `header-generator` để liên tục thay đổi `User-Agent` ở mỗi Request (giả lập ngẫu nhiên trình duyệt Chrome/Firefox/Safari trên Windows/Mac) nhằm vượt qua các cơ chế Rate-Limit hoặc chặn IP của Cổng Giao thông.
* **Chống trùng lặp bằng MD5 Hashing:** Thực tế, không phải lúc nào camera cũng cập nhật khung hình mới sau đúng 8 giây. Để tiết kiệm dung lượng đĩa và tránh việc lưu hàng ngàn bức ảnh giống hệt nhau gây nhiễu Dataset, mỗi bức ảnh tải về đều được băm (hash) bằng thuật toán **MD5**. Hệ thống so sánh chuỗi hash với khung hình trước đó; nếu giống nhau (ảnh chưa cập nhật), nó sẽ bỏ qua thao tác ghi file ổ cứng.

**Định thức Toán học Khử trùng lặp (Deduplication Logic):**
Hàm băm tạo ra một chữ ký số $H$ đại diện cho mảng byte của ảnh tại thời điểm $t$:
$$ H_t = \text{MD5}(\text{Image\_Buffer}_t) $$
Điều kiện lưu trữ: $\text{Save\_To\_Disk} = \text{True} \iff H_t \neq H_{t-1}$. 
Xác suất đụng độ (Collision Probability) của thuật toán MD5 là $\frac{1}{2^{128}}$, biến đây trở thành một cơ chế an toàn và tiết kiệm tài nguyên tuyệt đối để lọc nhiễu khung hình tĩnh.

### 5.3. Tiền xử lý và Nén Mô hình (Backend Optimization)
Trong quá trình vận hành, một thách thức lớn là chi phí duy trì GPU cho Inference. Để giải quyết, dự án áp dụng chiến lược **Quantization (Lượng tử hoá)** để chạy AI hoàn toàn trên CPU:
- **Post-Training Quantization (PTQ) INT8:** Trọng số (Weights) của mạng Neural Network `convnext_base_w_320` được nén từ `Float32` (32-bit) xuống `INT8` (8-bit). Quá trình này giúp **giảm 4 lần dung lượng bộ nhớ RAM** (từ khoảng 350MB xuống dưới 90MB).
- **CPU AVX2 Vectorization:** Môi trường Backend (Hugging Face Spaces) chạy trên vi kiến trúc CPU x86_64. Mô hình ONNX INT8 sẽ tự động kích hoạt tập lệnh **AVX2**, cho phép thực hiện hàng chục phép nhân ma trận (Matrix Multiplication) cùng lúc trong một chu kỳ xung nhịp.
- **Kết quả Thực tế (Statistics):** Dữ liệu thu thập từ logs cho thấy Backend có thể Batch Processing lên đến 15 camera đồng thời. Hệ thống xử lý mượt mà ảnh đầu vào `320x320` với độ trễ phân tích (Inference Latency) dao động rất thấp: **~150ms - 250ms/ảnh** hoàn toàn trên CPU. Điều này đảm bảo tính Real-time cho hàng trăm luồng xe cùng lúc.

---

## 6. Tổng kết Các Điểm Nhấn Kỹ thuật cho NCKH
1. **Thiết kế Microservices thực tiễn:** Tách bạch hệ thống hiển thị dữ liệu không gian (Geospatial), hệ thống xử lý toán học ma trận (FastAPI AI) và hệ thống thu thập dữ liệu (Node.js Crawler).
2. **Cơ chế Chống chịu lỗi đứt gãy (Fault-Resilient / Graceful Degradation):** Tự xây dựng in-memory fallback cache khi đối mặt với dữ liệu ngoại vi kém ổn định (Third-party API disconnects).
3. **Tối ưu hóa Mô hình Cạnh (Edge Computing Optimization):** Chứng minh tính khả thi của việc chạy mô hình Computer Vision phức tạp hoàn toàn trên môi trường máy chủ nghèo nàn tài nguyên (CPU-only) thông qua kỹ thuật ONNX INT8 Quantization.
4. **Định tuyến ngữ cảnh (Context-Aware Routing):** Nâng cấp hệ thống bản đồ tĩnh thành bản đồ thông minh (Live-map), tự động phạt trọng số các đoạn đường nghẽn.

---

## 7. Hướng dẫn Chạy Dự Án (Local Development)

### Chạy Frontend (Web App)
Yêu cầu: Node.js (v18+)
```bash
cd traffic-app
npm install
npm run dev
```
Truy cập: `http://localhost:5173`

### Chạy Backend (AI API)
Yêu cầu: Python 3.11+
```bash
cd trafficflow-api
python -m venv venv
source venv/bin/activate  # (Với Windows: venv\Scripts\activate)
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
```
API Docs: `http://localhost:7860/docs`

> **Lưu ý LFS:** Kho lưu trữ Backend yêu cầu cài đặt Git LFS (Large File Storage) để kéo file ONNX model.
