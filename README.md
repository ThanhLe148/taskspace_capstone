# TaskSpace

Yêu cầu Node.js 22.13 trở lên.

## Chạy local

Cài thư viện:

```sh
npm install
```

Sao chép `.env.example` thành `.env.local`. Nếu dùng đăng nhập Google, điền Client ID và Client Secret:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_URL=http://localhost:3000
```

Callback trong Google Cloud phải là `http://localhost:3000/api/auth/google/callback`. Có thể bỏ qua cấu hình Google nếu chỉ đăng nhập bằng email và mật khẩu.

Chạy dự án:

```sh
npm run dev
```

Mở [localhost:3000](http://localhost:3000). Database được tạo tự động, không cần cài thêm.
