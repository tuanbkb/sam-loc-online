# Sâm Lốc Online

Chơi **Sâm Lốc** realtime với bạn bè qua link chia sẻ. Tối đa **5 người** một bàn.

## Chạy local

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- Server (Socket.IO): http://localhost:3001  

## Deploy (Vercel + Render)

Socket.IO cần kết nối lâu dài, nên **không chạy được trên Vercel serverless**. Cách khuyến nghị:

| Phần | Nơi deploy |
| --- | --- |
| Frontend (Vite/React) | **Vercel** |
| Backend (Express + Socket.IO) | **Render** (hoặc Railway / Fly.io) |

### 1. Backend trên Render

1. Push repo lên GitHub.
2. [Render](https://render.com) → **New Web Service** → chọn repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npx tsx server/index.ts`
4. Environment:
   - `SERVE_WEB` = `0`
   - `CORS_ORIGIN` = URL Vercel của bạn (sau bước 2), ví dụ `https://sam-loc-online.vercel.app`
5. Deploy → copy URL API, ví dụ `https://sam-loc-api.onrender.com`

(Free tier Render có thể sleep khi không dùng; request đầu có thể chậm ~30–60s.)

### 2. Frontend trên Vercel

1. [Vercel](https://vercel.com) → **Add New Project** → import repo.
2. Framework: Vite (đã có `vercel.json`).
3. Environment Variables:
   - `VITE_SOCKET_URL` = URL backend Render (ví dụ `https://sam-loc-api.onrender.com`) — **không** có dấu `/` cuối.
4. Deploy.
5. Quay lại Render, cập nhật `CORS_ORIGIN` = URL Vercel thật, rồi **Manual Deploy** lại backend nếu cần.

### 3. Kiểm tra

- Mở site Vercel → tạo phòng → share link `/r/XXXXXX`.
- Mở tab ẩn danh / máy khác → vào cùng mã phòng.

## Luật (rút gọn)

- 2–5 người, mỗi người **10 lá**
- Thứ tự: 3 → … → A → **2 (heo)** lớn nhất; **chất không tính**
- Bộ hợp lệ: rác, đôi, sám, sảnh (≥3), tứ quý
- Tứ quý chặt được heo
- Trước khi đánh có thể **báo Sâm**
- Người hết bài trước thắng; tính điểm theo lá còn lại, thối 2, cóng, Sâm, tới trắng

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Dev server + Vite |
| `npm run build` | Build frontend → `dist/` |
| `npm start` | Chạy Socket.IO server |
