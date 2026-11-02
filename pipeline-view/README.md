# Pipeline View: view pipeline kiểu Meegle cho Lark Base

Đây là extension dạng **Table view** (Data Table View) cho Lark Base. Nó hiển thị các bản ghi của bảng thành một quy trình gồm nhiều bước nối với nhau, giống luồng node trong Meegle:

- **Các bước lấy từ một trường Single select** (gọi là *trường Giai đoạn*). Mỗi tùy chọn là một bước. Số bước không bị giới hạn, khác với trường Flow vốn chỉ cho tối đa 10 bước.
- **Có thể rẽ nhánh và hợp nhánh.** Một bước có thể có nhiều bước kế tiếp. Khi hoàn thành bước đó, người dùng chọn đi tiếp sang nhánh nào.
- **Một trường Single select thứ hai làm trạng thái** (gọi là *trường Trạng thái*), cho biết bản ghi đang ở tình trạng nào tại bước hiện tại. Mỗi lựa chọn được xếp vào một nhóm: *Chưa bắt đầu*, *Đang làm*, *Hoàn thành* hoặc *Bị chặn*. Màu của chấm trên node đổi theo nhóm này.
- **Mỗi bước tự chọn các trường cần nhập**, kèm cờ *bắt buộc*. Nếu còn trường bắt buộc chưa điền (checkbox chưa tick), bản ghi không thể rời bước.
- Phần đầu của bản ghi giống Meegle: chip vai trò lấy từ các trường User, dãy checklist lấy từ các trường Checkbox, và thời gian bản ghi đã nằm ở bước hiện tại.
- Có thể **gửi lại một bước trước**. Khi chuyển bước, view có thể tự ghi lại thời điểm vào bước và lịch sử chuyển bước vào các trường riêng (tùy chọn).
- Màn hình tổng quan cho biết mỗi bước đang có bao nhiêu bản ghi. Bấm vào một node để lọc danh sách theo bước đó.
- Giao diện có tiếng Việt và tiếng Anh, theo theme sáng hoặc tối của Lark, và cập nhật ngay khi người khác sửa dữ liệu.

Thiết kế chi tiết nằm trong [DESIGN.md](DESIGN.md).

## 1. Chạy thử ngay, không cần tài khoản Lark

Bản demo chạy với một bảng giả lập: 12 bước, có nhánh, và khoảng 16 bản ghi mẫu.

```bash
npm install
npm run demo
```

Sau đó mở <http://localhost:5180/>. Có thể thêm tham số vào URL:

| Tham số | Ý nghĩa |
|---|---|
| `?preset=none&reset=1` | Bắt đầu từ trạng thái chưa cấu hình, để thử màn hình hướng dẫn ban đầu |
| `?readonly=1` | Xem với quyền chỉ đọc |
| `?theme=dark` | Dùng theme tối |
| `?lang=en` | Dùng tiếng Anh |
| `?reset=1` | Xóa cấu hình demo đã lưu trong trình duyệt |

## 2. Đưa lên Lark Base

1. Vào [Lark Developer Console](https://open.larksuite.com/app) và mở app tự xây dựng của bạn (hoặc tạo app mới).
2. Chọn **Add features → Base extensions → Data Table View**, rồi bấm **+Add**. Ghi lại **BlockTypeID** (dạng `blk_…`) và **App ID** (dạng `cli_…`, xem ở mục *Credentials & Basic Info*).
3. Điền App ID vào `../app.json` (thư mục cha của thư mục này) và BlockTypeID vào `block.json`. Trường `url` trong `block.json` là Base sẽ được mở khi debug.
   > Đừng dùng lại BlockTypeID của một extension khác: `npm run upload` sẽ ghi đè lên extension đó.
4. Đăng nhập CLI một lần: `opdev login`, chọn **Lark**, rồi quét mã QR.
5. Debug trên Base thật: chạy `npm run dev`. Base sẽ mở với tham số `debugPort`. Bấm **+ New view**, chọn **Add more extensions**, chọn block `blk_…` đang chạy ở máy bạn và bấm **Add**.
6. Phát hành:
   1. Chạy `npm run upload` và nhập phiên bản (ví dụ `0.1.0`, lần sau phải lớn hơn lần trước).
   2. Trong Developer Console, mở **Data Table View**, chọn *Widget version* vừa upload, đặt tên, mô tả và icon, rồi bấm **Save**.
   3. Vào **Version Management & Release**, tạo phiên bản và gửi duyệt.
   4. Sau khi admin duyệt, mọi người trong phạm vi được cấp quyền sẽ thêm được view này từ **+ New view**.

## 3. Cấu hình (⚙ Cài đặt)

| Tab | Nội dung |
|---|---|
| **Trường dữ liệu** | Trường tiêu đề; trường **Giai đoạn** (Single select, bắt buộc); trường **Trạng thái** (Single select); trường *Thời điểm vào bước* (DateTime); trường *Lịch sử quy trình* (Text); view nguồn để dùng bộ lọc của một Grid view. Trường nào chưa có thì có nút tạo nhanh. |
| **Quy trình** | Xem trước sơ đồ; thêm bước mới (bước mới được thêm thành một tùy chọn của trường Giai đoạn); với từng bước, chọn *bước kế tiếp*, *trường người phụ trách*, *các trường cần nhập* (đánh dấu bắt buộc và sắp xếp thứ tự), *trạng thái khi vào bước* và *hướng dẫn*. Nút "Đặt lại tuyến tính" đưa quy trình về một đường thẳng theo thứ tự tùy chọn. Nếu các nhánh tạo thành vòng lặp thì không lưu được. |
| **Trạng thái** | Xếp từng trạng thái vào nhóm Chưa bắt đầu, Đang làm, Hoàn thành hoặc Bị chặn; chọn trạng thái mặc định khi vào bước; bật hoặc tắt "Phải ở trạng thái Hoàn thành mới được chuyển bước" và "Cho phép gửi lại bước trước". |
| **Hiển thị** | Các trường User hiện thành chip vai trò, các trường Checkbox hiện thành checklist, và các trường phụ hiện trong danh sách bên trái. |

Cấu hình được lưu riêng cho từng view (qua `bitable.bridge.setData`). Vì vậy một bảng có thể có nhiều view Pipeline với cấu hình khác nhau.

## 4. Giới hạn đã biết

- Trường Single select chỉ chứa được một giá trị, nên tại một thời điểm mỗi bản ghi chỉ đứng ở **một** bước. Các nhánh là các đường đi thay thế nhau, không chạy song song. Muốn chạy song song thật như Meegle thì cần một trường Multi select (xem phần đề xuất tiếp theo).
- Nếu sửa trường Giai đoạn trực tiếp trong Grid view, việc kiểm tra trường bắt buộc sẽ bị bỏ qua. View này chỉ kiểm tra những lần chuyển bước thực hiện qua nó. Muốn chặn hoàn toàn thì cần thêm một automation phía Base.
- Lịch sử được ghi vào một trường Text. Khi một tên bước bị đổi, các dòng lịch sử cũ vẫn mang tên cũ, nên trạng thái "đã đi qua" của bước đó có thể hiển thị sai.

## 5. Phát triển

```bash
npm run demo        # chạy với dữ liệu giả lập, cổng 5180
npm run dev         # debug trên Base thật (cần opdev login, app.json, block.json)
npm test            # chạy unit test (vitest)
npm run typecheck   # kiểm tra kiểu với TypeScript
npm run build       # build production vào dist/
npm run upload      # build rồi upload lên Developer Console
```

| Thư mục | Nội dung |
|---|---|
| `src/core` | Logic thuần, có unit test: đồ thị, bố cục node, cấu hình, giá trị ô, lịch sử, chuyển bước |
| `src/sdk` | Adapter cho Lark SDK và adapter giả lập dùng cho demo |
| `src/components` | Giao diện React (Semi UI) |
