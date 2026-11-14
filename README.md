# Sâm Lốc Online

Chơi **Sâm Lốc** realtime với bạn bè qua link chia sẻ. Tối đa **5 người** một bàn.

## Chạy local

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- Server (Socket.IO): http://localhost:3001  

Mở hai trình duyệt (hoặc cửa sổ ẩn danh), tạo phòng ở một bên, dán link `/r/XXXXXX` ở bên kia.

## Luật (rút gọn)

- 2–5 người, mỗi người **10 lá**
- Thứ tự: 3 → … → A → **2 (heo)** lớn nhất; **chất không tính**
- Bộ hợp lệ: rác, đôi, sám, sảnh (≥3), tứ quý
- Tứ quý chặt được heo (2)
- Trước khi đánh có thể **báo Sâm**
- Người hết bài trước thắng; tính điểm theo lá còn lại, thối 2, cóng, Sâm

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Dev server + Vite |
| `npm run build` | Build frontend |
| `npm start` | Chạy server (serve `dist/` nếu đã build) |
