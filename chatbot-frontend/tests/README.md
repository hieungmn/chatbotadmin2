# Kiểm thử frontend

Chạy trong thư mục `chatbot-frontend` bằng Node.js 24 trở lên:

```bash
npm test
```

Node chạy trực tiếp các hàm TypeScript, không cần cài thêm thư viện kiểm thử.

- Kiểm tra cách chuyển phản hồi API thành dữ liệu hiển thị trong widget.
- Không hiển thị ảnh hoặc liên kết FAQ cũ khi trả thông báo dự phòng.
- Không hiện nút đánh giá khi cần làm rõ câu hỏi hoặc AI gặp lỗi.
- Xóa thông tin đăng nhập khi đăng xuất, giữ dữ liệu khác của trình duyệt.

Các kiểm thử này không mở trình duyệt và không kiểm tra bố cục, sự kiện React hoặc kết nối đến backend thật.
