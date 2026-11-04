# Pipeline View: view pipeline kiểu Meegle cho Lark Base

Đây là extension dạng **Table view** (Data Table View) cho Lark Base. Nó hiển thị các bản ghi của bảng thành một quy trình gồm nhiều bước nối với nhau, giống luồng node trong Meegle:

- **Các bước lấy từ một trường Single select** (gọi là *trường Giai đoạn*). Mỗi tùy chọn là một bước. Số bước không bị giới hạn, khác với trường Flow vốn chỉ cho tối đa 10 bước.
- **Có thể rẽ nhánh và hợp nhánh.** Một bước có thể có nhiều bước kế tiếp. Khi hoàn thành bước đó, người dùng chọn đi tiếp sang nhánh nào.
- **Một trường Single select thứ hai làm trạng thái** (gọi là *trường Trạng thái*), cho biết bản ghi đang ở tình trạng nào tại bước hiện tại. Mỗi lựa chọn được xếp vào một nhóm: *Chưa bắt đầu*, *Đang làm*, *Hoàn thành* hoặc *Bị chặn*. Màu của chấm trên node đổi theo nhóm này.
- **Mỗi bước tự chọn các trường cần nhập**, kèm cờ *bắt buộc*. Nếu còn trường bắt buộc chưa điền (checkbox chưa tick), bản ghi không thể rời bước.
- Phần đầu của bản ghi giống Meegle: chip vai trò lấy từ các trường User, dãy checklist lấy từ các trường Checkbox, và thời gian bản ghi đã nằm ở bước hiện tại.
- Có thể **gửi lại một bước trước**. Khi chuyển bước, view có thể tự ghi lại thời điểm vào bước và lịch sử chuyển bước vào các trường riêng (tùy chọn).
- **Biết chính xác bản ghi đã đi nhánh nào** nhờ trường Multi select *Các bước đã qua* (tùy chọn, xem mục 3.1). Khi không có thông tin này, các bước thuộc nhánh không chắc chắn hiện là *Không rõ* thay vì tô xanh tất cả.
- Màn hình tổng quan cho biết mỗi bước đang có bao nhiêu bản ghi. Bấm vào một node để lọc danh sách theo bước đó.
- Giao diện có tiếng Việt và tiếng Anh, theo theme sáng hoặc tối của Lark, và cập nhật ngay khi người khác sửa dữ liệu.

Thiết kế chi tiết nằm trong [DESIGN.md](DESIGN.md).

## 1. Chạy thử ngay, không cần tài khoản Lark

Bản demo chạy với một bảng giả lập: 12 bước, có nhánh, và 19 bản ghi mẫu (hai bản ghi "nhập từ hệ thống cũ" không có lịch sử, để thấy các bước *Không rõ*).

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
| **Trường dữ liệu** | Trường tiêu đề; trường **Giai đoạn** (Single select, bắt buộc); trường **Trạng thái** (Single select); trường *Thời điểm vào bước* (DateTime); trường *Lịch sử quy trình* (Text); trường *Các bước đã qua* (Multi select, xem mục 3.1); view nguồn để dùng bộ lọc của một Grid view. Trường nào chưa có thì có nút tạo nhanh. |
| **Quy trình** | Xem trước sơ đồ; thêm bước mới (bước mới được thêm thành một tùy chọn của trường Giai đoạn); với từng bước, chọn *bước kế tiếp*, *trường người phụ trách*, *các trường cần nhập* (đánh dấu bắt buộc và sắp xếp thứ tự), *trạng thái khi vào bước* và *hướng dẫn*. Nút "Đặt lại tuyến tính" đưa quy trình về một đường thẳng theo thứ tự tùy chọn. Nếu các nhánh tạo thành vòng lặp thì không lưu được. |
| **Trạng thái** | Xếp từng trạng thái vào nhóm Chưa bắt đầu, Đang làm, Hoàn thành hoặc Bị chặn; chọn trạng thái mặc định khi vào bước; bật hoặc tắt "Phải ở trạng thái Hoàn thành mới được chuyển bước" và "Cho phép gửi lại bước trước". |
| **Hiển thị** | Các trường User hiện thành chip vai trò, các trường Checkbox hiện thành checklist, và các trường phụ hiện trong danh sách bên trái. |

Cấu hình được lưu riêng cho từng view (qua `bitable.bridge.setData`). Vì vậy một bảng có thể có nhiều view Pipeline với cấu hình khác nhau.

### 3.1. Trường *Các bước đã qua*: biết bản ghi đã đi nhánh nào

Trường Giai đoạn chỉ cho biết bản ghi **đang** ở đâu. Với quy trình rẽ nhánh, ví dụ

```
Soạn HĐ → { Chờ ký | Đã ký/Hiệu lực | Hoàn thành/Thanh lý } → Hủy
```

một bản ghi đang ở *Hủy* có thể đã đi qua bất kỳ nhánh nào trong ba nhánh giữa. Trường *Các bước đã qua* ghi lại điều đó.

- **Cách tạo:** trong ⚙ Cài đặt → Trường, ở dòng *Các bước đã qua*, bấm **Tạo trường mới**. View tạo một trường Multi select tên "Các bước đã qua", có sẵn một tùy chọn cho mỗi bước (cùng tên, cùng màu, cùng thứ tự). Cũng có thể chọn một trường Multi select có sẵn. Tùy chọn được ghép với bước **theo tên** (bỏ khoảng trắng đầu/cuối). Nếu trường còn thiếu tùy chọn cho một số bước, view hiện cảnh báo "Thiếu N bước" kèm nút **Thêm tùy chọn còn thiếu**.
- **Tự động ghi:** mỗi lần chuyển bước qua view, trường được cập nhật trong cùng một lần ghi với trường Giai đoạn:
  - *Bắt đầu*: chỉ tích bước bắt đầu.
  - *Hoàn thành & chuyển tới*: tích thêm bước hiện tại và bước mới (bỏ tích những bước không dẫn tới bước hiện tại, ví dụ khi Giai đoạn đã bị đổi trong Grid view).
  - *Trả về*: tích bước được trả về và bỏ tích mọi bước sau nó (các bước đó sẽ được đi lại).
  - *Hoàn thành quy trình*: tích thêm bước cuối.

  Nếu trường chưa có tùy chọn cho một bước, view tự thêm tùy chọn đó trước khi ghi. Các tùy chọn không trùng tên bước nào (ví dụ "Gấp") là dữ liệu của bạn và luôn được giữ nguyên.

  Với bản ghi chưa tích bước nào, lần chuyển bước đầu tiên tích những gì đã biết chắc: các bước mà nhật ký *Lịch sử quy trình* cho thấy thuộc lần đi hiện tại (không tính nhánh đã bị *Trả về*), cùng các bước nằm trên mọi đường đi. Nhánh chưa rõ thì không được tích và vẫn hiện *Không rõ*.
- **Bản ghi cũ:** tích tay các bước bản ghi đã đi, trong Grid view hoặc qua liên kết **Tích các bước đã qua** ngay dưới sơ đồ. Chỉ cần tích bước của nhánh đã đi (ví dụ *Đã ký/Hiệu lực*) là đủ: các bước nằm trên mọi đường đi (ví dụ *Soạn HĐ*) luôn hiện *Đã xong*.

**Cách view đọc ô *Các bước đã qua*.** View lần ngược từ bước hiện tại, đi qua các bước được tích nối tiếp nhau trên sơ đồ:

- Bước được tích, và bước nằm trên mọi đường đi tới một bước đã qua, hiện *Đã xong*.
- Bước không được tích trên đoạn đã lần được hiện *Đã bỏ qua*: bản ghi đã đi nhánh khác. Ví dụ bản ghi đang ở *Hủy*, có tích *Soạn HĐ* và *Đã ký/Hiệu lực*, thì *Chờ ký* và *Hoàn thành/Thanh lý* hiện *Đã bỏ qua*.
- Nếu lần tới một bước mà không bước nào ngay trước nó được tích, thì ô không cho biết bản ghi đã tới đó bằng đường nào. Các bước phía trước hiện *Không rõ* chứ không phải *Đã bỏ qua*. Trường hợp này xảy ra khi Giai đoạn bị đổi trực tiếp trong Grid view, hoặc khi mới tích một vài bước. Ví dụ bản ghi đang ở *Hủy* mà chỉ tích *Soạn HĐ* thì ba nhánh giữa hiện *Không rõ*.
- Bước chưa có tùy chọn trong trường (bước mới thêm, bước vừa đổi tên, hoặc tạo tùy chọn thất bại) cũng hiện *Không rõ*, vì trường không ghi lại được bước đó.

Mọi bước *Không rõ* đều có trong nút *Trả về…*.

**View lấy thông tin "đã đi qua bước nào" theo thứ tự ưu tiên:**

1. Trường *Các bước đã qua*, khi ô của bản ghi có ít nhất một bước được tích.
2. Trường *Lịch sử quy trình*. Nếu nhật ký không có dòng bắt đầu "▶" (trường lịch sử được thêm khi bản ghi đã đi được nửa đường, hoặc các dòng cũ đã bị cắt), nhật ký chỉ có giá trị từ bước đầu tiên được ghi trở đi.
3. **Suy luận từ sơ đồ** khi không có hai nguồn trên: bước nằm trên **mọi** đường đi tới bước hiện tại chắc chắn đã qua và hiện *Đã xong* (ví dụ *Soạn HĐ*). Các bước thuộc nhánh còn lại hiện **Không rõ** (chấm rỗng viền đứt, chữ bình thường), vì không biết bản ghi đã đi nhánh nào. Với quy trình tuyến tính, mọi bước trước đều nằm trên mọi đường đi nên vẫn hiện *Đã xong* như trước. Khi có bước *Không rõ*, chú thích có thêm mục "Không rõ" và người có quyền sửa thấy một dòng gợi ý ngay dưới sơ đồ.

Khi bản ghi còn bước *Không rõ*, view vẫn ghi trường *Các bước đã qua* mỗi lần chuyển bước, nên các nhánh được chọn qua view từ đó về sau vẫn được ghi lại. Nhánh chưa rõ phía trước vẫn hiện *Không rõ* cho tới khi bạn tích nó. Nút *Trả về…* luôn cho chọn mọi bước trước không bị chứng minh là đã bỏ qua, nên bản ghi không bao giờ bị kẹt.

Chú thích cạnh tiêu đề *Quy trình* có thêm mục *Đã bỏ qua* hoặc *Không rõ* khi sơ đồ có bước ở trạng thái đó. Rê chuột lên một bước để xem giải thích.

## 4. Giới hạn đã biết

- Trường Single select chỉ chứa được một giá trị, nên tại một thời điểm mỗi bản ghi chỉ đứng ở **một** bước. Các nhánh là các đường đi thay thế nhau, không chạy song song. Muốn chạy song song thật như Meegle thì cần một trường Multi select (xem phần đề xuất tiếp theo).
- Nếu sửa trường Giai đoạn trực tiếp trong Grid view, việc kiểm tra trường bắt buộc sẽ bị bỏ qua. View này chỉ kiểm tra những lần chuyển bước thực hiện qua nó. Muốn chặn hoàn toàn thì cần thêm một automation phía Base.
- Lịch sử được ghi vào một trường Text. Khi một tên bước bị đổi, các dòng lịch sử cũ vẫn mang tên cũ. Khi đó view vẫn dùng các dòng còn khớp tên để biết bước nào đã qua, nhưng không dựa vào nhật ký để đánh dấu bước nào là *Đã bỏ qua*.
- Trường *Các bước đã qua* ghép tùy chọn với bước theo tên. Khi đổi tên một bước, hãy đổi tên tùy chọn tương ứng trong trường này. Nếu không, bước đó hiện *Không rõ* với các bản ghi đã tích tên cũ, và lần chuyển bước tiếp theo (hoặc nút *Thêm tùy chọn còn thiếu*) sẽ thêm một tùy chọn mới mang tên mới thay vì đổi tên tùy chọn cũ.
- Nếu sơ đồ có cạnh "đi tắt" (ví dụ *Soạn HĐ → Hủy* bên cạnh *Soạn HĐ → Đã ký/Hiệu lực → Hủy*) và Giai đoạn bị đổi trực tiếp trong Grid view, ô *Các bước đã qua* có thể trông như bản ghi đã đi đường tắt, nên các bước ở giữa hiện *Đã bỏ qua*. Hãy chuyển bước qua view, hoặc tích lại các bước, để ô luôn đúng.

- Ô Text có @mention hoặc link, và ô URL có tên hiển thị khác với đường link, sẽ được mở bằng trình sửa gốc của Lark (nút "Sửa trong Lark"). Lý do là trình sửa trong view chỉ xử lý văn bản thuần; sửa trực tiếp sẽ làm mất mention hoặc link.
- Mỗi lần chuyển bước, view đọc lại bản ghi mới nhất từ Base trước khi kiểm tra và ghi, nên phát sinh thêm một lần gọi API. Nếu có chọn view nguồn, mọi thay đổi sẽ khiến view tải lại toàn bộ danh sách.

## 5. Xử lý sự cố

- Nếu `npm run build` báo `Cannot find module '@bdeefe/feishu-devtools-core/...'`: lỗi này xảy ra sau một lần `npm install <gói>`, vì npm đã dọn mất các module mà `@lark-opdev/cli` tự chép vào lúc cài. Cách sửa: xóa thư mục `node_modules/@lark-opdev/cli` rồi chạy lại `npm install`.
- Nếu upload báo lỗi: chạy `opdev whoami` để kiểm tra tài khoản đang đăng nhập. Tài khoản đó phải sở hữu App ID trong `app.json`, và app phải có đúng block Table View có BlockTypeID trong `block.json`.

## 6. Phát triển

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
