# TaskSpace — SQLite authentication demo

Demo đăng ký, đăng nhập và đăng xuất bằng SQLite, chạy trực tiếp trên máy.

## Chạy dự án

Yêu cầu Node.js **22.13 trở lên** (máy hiện tại đã đáp ứng). Dự án sử dụng `node:sqlite` tích hợp trong Node.js, không cần cài máy chủ database. Module này có thể hiện cảnh báo experimental tùy phiên bản Node.js.

```sh
npm install
npm run dev
```

Mở http://localhost:3000/sign-up, nhập tên, email và mật khẩu từ 8 đến 128 ký tự. Đăng ký thành công sẽ tự đăng nhập và chuyển đến dashboard. Chọn **Log out**, rồi mở `/sign-in` để đăng nhập lại với tài khoản vừa tạo.

- `/sign-up`: đăng ký tài khoản.
- `/sign-in`: đăng nhập bằng email và mật khẩu.
- `/dashboard`: yêu cầu phiên đăng nhập hợp lệ; hiển thị tên và email.
- Email được bỏ khoảng trắng đầu/cuối và chuyển về chữ thường; không thể đăng ký trùng email.
- Form hiển thị lỗi khi dữ liệu không hợp lệ hoặc đăng nhập thất bại.

## Database và phiên đăng nhập

File **`data/taskspace.sqlite`** tự tạo khi đăng ký hoặc đăng nhập lần đầu. Có thể mở file bằng DB Browser for SQLite hoặc một tiện ích SQLite trong trình soạn thảo. Thư mục `data/` được bỏ qua bởi Git để không đưa tài khoản vào repository.

- Bảng `users`: tên, email, mật khẩu đã băm bằng scrypt với salt riêng cho từng tài khoản.
- Bảng `sessions`: mã phiên đã băm SHA-256, tài khoản liên kết và thời điểm hết hạn.
- Cookie phiên có HttpOnly, SameSite=Lax, thời hạn 7 ngày và Secure ở chế độ production. Production dùng HTTPS.
- Đăng xuất xóa phiên trong database và cookie. Mã phiên cũ không thể dùng lại.
- Database nằm trên đĩa nên tài khoản còn sau khi tắt/chạy lại ứng dụng.

Để đổi vị trí database, đặt `DATABASE_PATH` trong `.env.local`. Không cần cấu hình biến môi trường để chạy demo mặc định.

## Kiểm tra

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run start -- --port 3100 --hostname 127.0.0.1
```

Ở terminal khác, cùng thư mục dự án:

```sh
npm run test:auth
```

Bộ kiểm tra sử dụng `http://127.0.0.1:3100` mặc định; có thể đổi bằng `AUTH_TEST_URL`. Chỉ chạy với localhost. Kiểm tra đăng ký, chuẩn hóa email, email trùng, dữ liệu sai, sai mật khẩu, phiên đăng nhập, trang được bảo vệ, yêu cầu khác nguồn, đăng xuất, đổi mã phiên và phiên hết hạn. Tài khoản tạm do bộ kiểm tra tạo sẽ được xóa khi kết thúc. Nếu đổi `DATABASE_PATH`, dùng cùng giá trị cho máy chủ và bộ kiểm tra.

Đây là demo chạy cục bộ trên một máy, cần đĩa lưu trữ bền vững. Trước khi dùng công khai, cần bổ sung giới hạn lần đăng nhập, xác minh email và khôi phục mật khẩu; SQLite dạng file này không phù hợp để lưu dữ liệu trực tiếp trên môi trường serverless có đĩa tạm.
