# TaskSpace — Google và SQLite authentication

Demo đăng ký, đăng nhập bằng email/mật khẩu hoặc tài khoản Google và đăng xuất bằng SQLite, chạy trực tiếp trên máy.

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

## Thiết lập đăng nhập bằng Google

1. Mở [Google Auth Platform](https://console.cloud.google.com/auth/overview), chọn hoặc tạo project.
2. Thiết lập **Branding**: tên ứng dụng TaskSpace, email hỗ trợ và email liên hệ. Trong **Audience**, chọn **External** cho tài khoản Google cá nhân; nếu ứng dụng ở chế độ **Testing**, thêm email dùng thử vào **Test users** khi Google yêu cầu.
3. Vào **Clients → Create client → Web application**. Thêm **Authorized redirect URI** chính xác:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

   Luồng này chuyển hướng qua máy chủ nên không cần cấu hình Authorized JavaScript origins. Ứng dụng chỉ xin `openid email profile` để đăng nhập.
4. Sao chép `.env.example` thành `.env.local`, điền **Client ID** và **Client secret** của client vừa tạo:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   APP_URL=http://localhost:3000
   ```

   `.env.local` đã được Git bỏ qua. Không đưa secret lên repository hoặc đặt tên với tiền tố `NEXT_PUBLIC_`.
5. Khởi động lại `npm run dev`, mở `http://localhost:3000/sign-in` và chọn **Continue with Google**. Dùng trình duyệt thông thường để mở màn hình đăng nhập Google.

Đăng nhập Google lần đầu tự tạo tài khoản và chuyển đến `/dashboard`; các lần sau dùng Google ID (`sub`) để tìm cùng tài khoản. Tài khoản chỉ dùng Google không có mật khẩu đăng nhập cục bộ. Nếu email đã được đăng ký bằng mật khẩu, ứng dụng yêu cầu đăng nhập bằng mật khẩu, không tự ghép hai tài khoản theo email chưa xác minh.

Khi đổi cổng, domain hoặc dùng `127.0.0.1`, cập nhật **APP_URL** và đăng ký URI callback tương ứng trong Google Cloud. Trình duyệt phải mở đúng origin của APP_URL để cookie quay lại được. Production yêu cầu `APP_URL=https://your-domain.example` và callback `https://your-domain.example/api/auth/google/callback`. Lỗi `redirect_uri_mismatch` nghĩa là URI chưa khớp; `access_denied` có thể do người dùng hủy, tài khoản chưa được thêm vào danh sách test hoặc chính sách Google Workspace.

Luồng OAuth dùng state gắn với cookie HttpOnly, PKCE S256, nonce, thời hạn 10 phút và callback chỉ dùng một lần. ID token được thư viện chính thức `google-auth-library` xác minh chữ ký, issuer, audience và hạn dùng. Google token chỉ dùng trên máy chủ để xác minh đăng nhập, không lưu trong database và không trả về trình duyệt.

Tham khảo: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) và [OAuth cho ứng dụng web](https://developers.google.com/identity/protocols/oauth2/web-server).

## Database và phiên đăng nhập

File **`data/taskspace.sqlite`** tự tạo khi đăng ký hoặc đăng nhập lần đầu. Có thể mở file bằng DB Browser for SQLite hoặc một tiện ích SQLite trong trình soạn thảo. Thư mục `data/` được bỏ qua bởi Git để không đưa tài khoản vào repository.

- Bảng `users`: tên, email, mật khẩu đã băm bằng scrypt với salt riêng cho từng tài khoản.
- Bảng `sessions`: mã phiên đã băm SHA-256, tài khoản liên kết và thời điểm hết hạn.
- Bảng `google_accounts`: Google ID liên kết với tài khoản; `google_oauth_requests` lưu yêu cầu OAuth tạm thời và được dọn khi bắt đầu đăng nhập.
- Cookie phiên có HttpOnly, SameSite=Lax, thời hạn 7 ngày và Secure ở chế độ production. Production dùng HTTPS.
- Đăng xuất xóa phiên trong database và cookie. Mã phiên cũ không thể dùng lại.
- Database nằm trên đĩa nên tài khoản còn sau khi tắt/chạy lại ứng dụng.

Để đổi vị trí database, đặt `DATABASE_PATH` trong `.env.local`. Đăng nhập email/mật khẩu chạy được khi chưa cấu hình Google.

## Kiểm tra

```sh
npm run lint
npm run test:auth:google
npx tsc --noEmit
npm run build
npm run start -- --port 3100 --hostname 127.0.0.1
```

Ở terminal khác, cùng thư mục dự án:

```sh
npm run test:auth
```

Bản hiện tại dùng Next.js 16.4.3 và đã được kiểm tra build production bằng Turbopack mặc định. Dashboard có giao diện chờ tải riêng khi xác minh phiên đăng nhập.

Bộ kiểm tra sử dụng `http://127.0.0.1:3100` mặc định; có thể đổi bằng `AUTH_TEST_URL`. Chỉ chạy với localhost. Kiểm tra đăng ký, chuẩn hóa email, email trùng, dữ liệu sai, sai mật khẩu, phiên đăng nhập, trang được bảo vệ, yêu cầu khác nguồn, đăng xuất, đổi mã phiên và phiên hết hạn. Tài khoản tạm do bộ kiểm tra tạo sẽ được xóa khi kết thúc. Nếu đổi `DATABASE_PATH`, dùng cùng giá trị cho máy chủ và bộ kiểm tra.

Đây là demo chạy cục bộ trên một máy, cần đĩa lưu trữ bền vững. Trước khi dùng công khai, cần bổ sung giới hạn lần đăng nhập, xác minh email và khôi phục mật khẩu; SQLite dạng file này không phù hợp để lưu dữ liệu trực tiếp trên môi trường serverless có đĩa tạm.

`npm run test:auth:google` chạy độc lập, dùng database tạm và JWT ký bằng khóa thử nghiệm để kiểm tra xác minh token, state/cookie, PKCE, nonce, callback một lần, hết hạn, email trùng và phiên đăng nhập. Không gọi Google và không cần Client ID/Secret thật. Để xác nhận end-to-end với Google, vẫn cần cấu hình client thật theo hướng dẫn ở trên và đăng nhập trong trình duyệt.
