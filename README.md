# Chi Tiêu — ứng dụng quản lý chi tiêu

Ứng dụng ghi chép thu chi cá nhân cho Android (và iOS sau này), viết bằng Expo / React Native + TypeScript.
Dữ liệu lưu offline trên điện thoại bằng SQLite, không cần tài khoản hay internet.

## Tính năng

- **Tổng quan**: tổng số dư các ví; thu, chi và chênh lệch trong tháng; biểu đồ tròn theo danh mục; biểu đồ cột chi tiêu theo ngày; giao dịch gần đây
- **Giao dịch**: thêm, sửa, xóa khoản thu/chi; danh sách nhóm theo ngày; tìm kiếm không dấu ("an sang" tìm ra "Ăn sáng"); lọc theo loại hoặc danh mục
- **Ngân sách**: hạn mức hằng tháng cho từng danh mục; thanh tiến độ chuyển vàng khi tiêu tới 80% và đỏ khi vượt
- **Ví**: nhiều ví (tiền mặt, ngân hàng…), mỗi ví có số dư ban đầu
- **Danh mục**: 14 danh mục mặc định, tự tạo thêm với biểu tượng và màu riêng
- **Quét ảnh chuyển khoản**: chọn ảnh chụp màn hình chuyển khoản/ví điện tử, app tự đọc số tiền, ngày, người nhận, nội dung và gợi ý danh mục rồi đính kèm ảnh vào giao dịch. Đọc chữ ngay trên điện thoại (ML Kit), ảnh không gửi đi đâu
- **Khóa ứng dụng**: mã PIN 4 hoặc 6 số, mở khóa bằng vân tay/khuôn mặt, tự khóa khi rời app quá 30 giây
- **Xuất CSV**: mở được bằng Excel, hiển thị đúng tiếng Việt
- **Ngôn ngữ**: Tiếng Việt (mặc định), English, 한국어, 中文（简体）, 日本語 hoặc theo ngôn ngữ máy; chọn trong Cài đặt → Ngôn ngữ. Số tiền luôn là đồng (₫), chỉ cách ghi số đổi theo ngôn ngữ. Bản dịch nằm trong `src/i18n/`
- **Bản web cho iPhone**: https://chi-tieu.levantung-work.workers.dev (Safari → Thêm vào Màn hình chính), dùng được khi không có mạng
- Chế độ sáng/tối theo hệ thống

## Chạy thử trên điện thoại Android

1. Cài app **Expo Go** từ Google Play.
2. Trên máy tính, trong thư mục này:
   ```bash
   npm install
   npx expo start
   ```
3. Mở Expo Go và quét mã QR hiện trong terminal. Điện thoại và máy tính phải dùng chung một mạng Wi-Fi.
   Nếu không kết nối được, chạy `npx expo start --tunnel`.

Expo Go không có module đọc chữ (ML Kit) nên khi quét ảnh chỉ đính kèm ảnh, không tự điền. Muốn thử đầy đủ thì cài bản APK bên dưới.

## Build file cài đặt (APK) và bản iOS

Dùng EAS Build trên cloud, không cần Android Studio hay máy Mac:

```bash
npx eas-cli@latest login            # cần tài khoản expo.dev (miễn phí)
npx eas-cli@latest build:configure
npx eas-cli@latest build -p android --profile preview   # ra file .apk để cài trực tiếp
npx eas-cli@latest build -p ios                         # cần tài khoản Apple Developer
```

Để `--profile preview` ra file `.apk` thay vì `.aab`, trong `eas.json` thêm `"android": { "buildType": "apk" }` vào profile `preview`.

## Phát triển

```bash
npm test             # unit test (logic + SQL chạy trên SQLite thật qua node:sqlite)
npx tsc --noEmit     # kiểm tra kiểu
npx expo lint        # lint
```

Cấu trúc thư mục:

```
src/
  app/            Các màn hình (Expo Router — mỗi file là một route)
    (tabs)/       4 tab: Tổng quan, Giao dịch, Ngân sách, Cài đặt
    transaction/  Form thêm/sửa giao dịch
    budget/       Form đặt hạn mức
    category/ wallet/  Form danh mục, ví
  components/     Component giao diện dùng chung (biểu đồ, form…)
  db/             Schema SQLite, migration, các câu truy vấn
  lib/            Logic thuần: định dạng tiền VND, ngày tháng, CSV, tìm kiếm
```

Tiền được lưu dưới dạng số nguyên (đồng), ngày dưới dạng chuỗi `YYYY-MM-DD`.
Khi đổi schema, thêm một bước migration mới trong `src/db/schema.ts` và tăng `DATABASE_VERSION`.
