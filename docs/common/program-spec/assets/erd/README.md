# Sơ đồ quan hệ dữ liệu

Mỗi sơ đồ có hai file:

- `.mmd`: mã Mermaid có thể chỉnh sửa.
- `.svg`: sơ đồ tạo bằng Mermaid 11.12.0, được nhúng trong HTML để mở ngoại tuyến.

Các sơ đồ lấy bảng, cột và khóa từ `chatbot-backend/database/schema.sql`.
Tổng quan hiển thị PK/FK; sơ đồ thành phần hiển thị đầy đủ các cột của nhóm đó.

Để thay đổi sơ đồ, sửa file `.mmd`, dựng lại bằng Mermaid và thay SVG tương ứng trong trang HTML. Sửa file `.mmd` không tự cập nhật SVG đã nhúng.

Cú pháp và cách sử dụng: [Mermaid ER diagrams](https://mermaid.js.org/syntax/entityRelationshipDiagram.html), [Mermaid usage](https://mermaid.js.org/config/usage.html).
