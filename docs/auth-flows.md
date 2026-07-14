# Auth Flows - Task Management System

Tai lieu nay mo ta cac luong xac thuc dang co trong project, dua tren backend FastAPI va frontend React hien tai.

Nguon chinh:
- Backend router: `backend/app/api/v1/auth.py`
- Backend business logic: `backend/app/services/auth_service.py`
- Backend schema/validation: `backend/app/schemas/pydantic_models.py`
- Frontend pages: `frontend/src/pages/LoginPage.jsx`, `ForgotPassword.jsx`, `VerifyEmail.jsx`, `RegisterPage.jsx`, `ResetPassword.jsx`
- Logout UI: `frontend/src/components/layout/MainLayout.jsx`

Luu y hien trang:
- Backend da co API that cho register, verify email, login, logout, forgot password, verify reset code, resend code va reset password.
- Frontend auth hien dang mock phan lon hanh vi: login tu dieu huong theo email, forgot/register cung di qua man nhap email va verify OTP, nhung chua goi API backend.
- Tat ca endpoint backend nam duoi prefix `/api/v1/auth`.

## Quy Tac Chung

### Email

Backend normalize email bang cach `trim()` va chuyen ve lowercase.

Email hop le phai:
- Co do dai tu 3 den 255 ky tu.
- Dung format regex: `^[^@\s]+@[^@\s]+\.[^@\s]+$`.

Neu sai schema, FastAPI/Pydantic tra ve HTTP `422 Unprocessable Entity`.

### OTP / Verification Code

OTP/code phai:
- Co dung 6 ky tu.
- Chi gom chu so.

Backend tao OTP bang `generate_otp()`, dam bao format 6 chu so, vi du `000123`.

Thoi gian hieu luc:
- `OTP_EXPIRE_MINUTES = 15` trong `auth_service.py`.
- Email template doc bien moi truong `OTP_EXPIRE_MINUTES`, mac dinh cung la 15 phut.

Bang `verification_token` luu:
- `email`
- `otp_code`
- `token_type`: `EMAIL_VERIFICATION` hoac `PASSWORD_RESET`
- `expires_at`
- `used_at`
- `resend_count`
- `created_at`

Moi email chi co mot token cho moi `token_type`, do unique constraint tren `(email, token_type)`.

### Password

Password moi khi register/reset password phai:
- Toi thieu 8 ky tu.
- Co it nhat 1 chu in hoa.
- Co it nhat 1 chu thuong.
- Co it nhat 1 chu so.
- Co it nhat 1 ky tu dac biet.

Neu password khong dat yeu cau, schema tra ve HTTP `422`.

### Token Dang Nhap

Khi register/login thanh cong, backend tao:
- `access_token`: JWT type `access`, mac dinh het han sau 30 phut.
- `refresh_token`: JWT type `refresh`, mac dinh het han sau 7 ngay.

Gia tri mac dinh doc tu:
- `ACCESS_TOKEN_EXPIRE_MINUTES`, default `30`.
- `REFRESH_TOKEN_EXPIRE_DAYS`, default `7`.

Token duoc luu vao bang `user_tokens`.

### Error Response

Project co custom exception handler trong `backend/app/main.py`.

Neu service raise:

```json
{"message": "Some error."}
```

Response body se giu format:

```json
{
  "message": "Some error."
}
```

Neu detail la string, response body cung duoc boc thanh:

```json
{
  "message": "Authentication required."
}
```

## 1. Register Flow

Trong backend, register la buoc cuoi sau khi email da duoc verify. De dang ky thanh cong, user phai di qua:

1. Check email va gui OTP.
2. Verify email bang OTP.
3. Register account bang email da verify.

### 1.1 Check Email / Gui OTP Dang Ky

Endpoint:

```http
POST /api/v1/auth/check-email
```

Request:

```json
{
  "email": "user@example.com"
}
```

Happy path:
1. Backend normalize va validate email.
2. Kiem tra email da ton tai trong bang `users` chua.
3. Neu email chua ton tai, tao OTP 6 so.
4. Upsert token `EMAIL_VERIFICATION`:
   - `otp_code` = OTP moi.
   - `expires_at` = now + 15 phut.
   - `resend_count` = 0.
   - `used_at` = null.
   - `created_at` = now.
5. Tao audit log:
   - `CHECK_EMAIL`
   - `SEND_VERIFICATION_CODE`
6. Gui email OTP qua SMTP.
7. Neu gui email thanh cong, commit DB.
8. Tra ve `200`.

Response:

```json
{
  "message": "Verification code has been sent."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 409 | `Email already exists.` | Email da co user trong DB. |
| 500 | `Failed to send verification email. Please try again later.` | Khong gui duoc email SMTP, backend rollback token/audit log. |
| 422 | Pydantic validation error | Email sai format/do dai. |

### 1.2 Verify Email

Endpoint:

```http
POST /api/v1/auth/verify-email
```

Request:

```json
{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

Happy path:
1. Backend validate email va OTP 6 chu so.
2. Lay token `EMAIL_VERIFICATION` theo email.
3. Kiem tra token ton tai.
4. Kiem tra OTP dung.
5. Kiem tra token chua het han.
6. Kiem tra token chua tung duoc dung.
7. Set `used_at = now`.
8. Tao audit log `VERIFY_EMAIL`.
9. Commit DB.
10. Tra ve `200`.

Response:

```json
{
  "verified": true,
  "message": "Email verified successfully."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Verification record not found.` | Chua tung goi `/check-email` hoac token khong ton tai. |
| 400 | `The verification code is incorrect.` | OTP nhap sai. |
| 400 | `The verification code has expired.` | Token qua 15 phut. |
| 400 | `The verification code is no longer valid.` | Token da duoc dung truoc do. |
| 422 | Pydantic validation error | Email/OTP sai format. |

### 1.3 Resend Verification Code

Endpoint:

```http
POST /api/v1/auth/resend-verification
```

Request:

```json
{
  "email": "user@example.com"
}
```

Happy path:
1. Lay token `EMAIL_VERIFICATION`.
2. Kiem tra email chua co user.
3. Neu `created_at` da qua 1 gio, reset `resend_count = 0` va `created_at = now`.
4. Neu `resend_count < 5`, tao OTP moi.
5. Cap nhat token:
   - `otp_code` = OTP moi.
   - `expires_at` = now + 15 phut.
   - `used_at` = null.
   - `resend_count += 1`.
6. Tao audit log `SEND_VERIFICATION_CODE`.
7. Gui email OTP moi.
8. Commit DB.
9. Tra ve `200`.

Response:

```json
{
  "message": "Verification code has been resent."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Verification record not found.` | Chua co token de resend. |
| 409 | `Email already exists.` | Email da duoc register thanh user. |
| 429 | `Too many resend attempts. Please try again later.` | Da resend 5 lan trong cua so 1 gio. |
| 500 | `Failed to send verification email. Please try again later.` | Gui SMTP that bai, DB rollback. |
| 422 | Pydantic validation error | Email sai format. |

### 1.4 Complete Registration

Endpoint:

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "email": "user@example.com",
  "full_name": "Nguyen Van A",
  "password": "Password@123",
  "confirm_password": "Password@123"
}
```

Happy path:
1. Backend validate email, full name va password strength.
2. Kiem tra `password == confirm_password`.
3. Lay token `EMAIL_VERIFICATION`.
4. Token phai ton tai va co `used_at != null`, tuc la email da verify.
5. Token chua het han.
6. Email chua ton tai trong bang `users`.
7. Tao user moi:
   - `status_user = "Active"`
   - `role = "USER"`
   - `is_verified = true`
   - `failed_login_attempts = 0`
   - `locked_until = null`
   - `last_login = null`
8. Hash password bang bcrypt.
9. Tao access token va refresh token.
10. Luu token vao bang `user_tokens`.
11. Tao audit log `REGISTER_USER`.
12. Commit DB.
13. Tra ve `201`.

Response:

```json
{
  "message": "Registration successful.",
  "user": {
    "user_id": "USR...",
    "full_name": "Nguyen Van A",
    "email": "user@example.com",
    "status_user": "Active",
    "role": "USER",
    "avatar_url": null,
    "is_verified": true,
    "failed_login_attempts": 0,
    "locked_until": null,
    "last_login": null,
    "created_at": "2026-07-13T00:00:00",
    "updated_at": "2026-07-13T00:00:00"
  },
  "access_token": "...",
  "refresh_token": "..."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 400 | `Confirm password mismatch.` | `password` va `confirm_password` khong khop. |
| 400 | `Email must be verified before registration.` | Chua verify email hoac token khong co `used_at`. |
| 400 | `OTP expired.` | Token verify da het han truoc khi register. |
| 409 | `Email already exists.` | Email da co user trong DB. |
| 409 | `Duplicate registration.` | Loi unique/integrity khi insert user. |
| 422 | Pydantic validation error | Email/full name/password sai schema. |

Ghi chu nghiep vu:
- Sau khi verify email, token `EMAIL_VERIFICATION.used_at` da duoc set.
- Register van yeu cau token chua het han. Nghia la user phai hoan tat register trong vong 15 phut tu luc OTP duoc tao/resend.
- Backend register thanh cong thi user duoc login ngay bang token tra ve.

## 2. Login Flow

Endpoint:

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

Happy path:
1. Backend validate email va password co do dai toi thieu 1.
2. Tim user theo email.
3. Neu user `status_user = "Locked"` nhung `locked_until <= now`, backend tu mo khoa:
   - `failed_login_attempts = 0`
   - `locked_until = null`
   - `status_user = "Active"`
4. Kiem tra user khong Pending/Inactive/Locked con hieu luc.
5. Verify password bang bcrypt.
6. Reset login failure:
   - `failed_login_attempts = 0`
   - `locked_until = null`
   - `last_login = now`
   - `updated_at = now`
7. Tao JWT access token va refresh token.
8. Luu token vao bang `user_tokens`.
9. Tao audit log `LOGIN`.
10. Commit DB.
11. Tra ve `200`.

Response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "user": {
    "user_id": "USR...",
    "full_name": "Nguyen Van A",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Email does not exist.` | Khong co user theo email. |
| 403 | `Please verify your email first.` | User dang `Pending`. |
| 403 | `Account temporarily locked.` | User dang `Locked` va `locked_until > now`. |
| 403 | `Account has been deactivated.` | User dang `Inactive`. |
| 401 | `Invalid email or password.` | Password sai. |
| 422 | Pydantic validation error | Email sai format hoac password rong. |

Xu ly sai password:
1. Tang `failed_login_attempts` them 1.
2. Cap nhat `updated_at = now`.
3. Neu so lan sai dat `MAX_FAILED_LOGIN_ATTEMPTS`, mac dinh 5:
   - `status_user = "Locked"`
   - `locked_until = now + ACCOUNT_LOCK_MINUTES`, mac dinh 15 phut.
4. Commit DB.
5. Tra ve `401 Invalid email or password.`

Ghi chu:
- Lan sai password lam vuot nguong lock van tra ve `401`, khong tra ngay `403`. Lan login tiep theo trong thoi gian lock moi tra `403 Account temporarily locked.`
- `MAX_FAILED_LOGIN_ATTEMPTS` va `ACCOUNT_LOCK_MINUTES` co the override bang env.

## 3. Logout Flow

Endpoint:

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

Request body:

Khong can body.

Happy path:
1. Router yeu cau Bearer token qua `bearer_scheme`.
2. `get_current_user` decode JWT de lay `user_id`.
3. Neu JWT decode loi, backend fallback tim access token trong bang `user_tokens` va token chua het han.
4. Tim user theo `user_id`.
5. Service xoa record trong `user_tokens` theo `access_token`.
6. Tao audit log `LOGOUT`.
7. Commit DB.
8. Tra ve `200`.

Response:

```json
{
  "message": "Successfully logged out."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 401 | `Authentication required.` | Khong co Authorization header hoac khong dung Bearer scheme. |
| 401 | `Invalid authentication token.` | JWT khong decode duoc va token khong ton tai/het han trong DB. |
| 401 | `Authenticated user not found.` | Token hop le nhung user khong con ton tai. |

Ghi chu:
- Service dang xoa token khoi `user_tokens`, khong set `is_revoked = true`.
- Neu JWT access token van decode duoc sau logout, `get_current_user` hien van tin JWT truoc, nen token co the van duoc chap nhan cho den khi het han neu endpoint chi dua vao JWT decode. Day la hanh vi hien tai cua code.
- Frontend hien tai logout chi `console.log("User logged out")`, navigate ve `/`, va chua goi API logout/clear token that.

## 4. Forgot Password Flow

Forgot password gom 4 buoc backend:

1. Gui reset code.
2. Verify reset code.
3. Co the resend reset code neu can.
4. Reset password bang code da verify.

### 4.1 Forgot Password / Send Reset Code

Endpoint:

```http
POST /api/v1/auth/forgot-password
```

Request:

```json
{
  "email": "user@example.com"
}
```

Happy path:
1. Backend validate email.
2. Tim user theo email.
3. Tao OTP 6 so.
4. Upsert token `PASSWORD_RESET`:
   - `otp_code` = OTP moi.
   - `expires_at` = now + 15 phut.
   - `resend_count` = 0.
   - `used_at` = null.
   - `created_at` = now.
5. Tao audit log `SEND_PASSWORD_RESET_CODE`.
6. Gui email OTP.
7. Commit DB.
8. Tra ve `200`.

Response:

```json
{
  "message": "Verification code sent successfully."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Email does not exist.` | Khong co user theo email. |
| 500 | `Failed to send verification email. Please try again later.` | Gui SMTP that bai, DB rollback. |
| 422 | Pydantic validation error | Email sai format. |

### 4.2 Verify Reset Code

Endpoint:

```http
POST /api/v1/auth/verify-reset-code
```

Request:

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Happy path:
1. Backend validate email va code 6 chu so.
2. Tim user theo email.
3. Lay token `PASSWORD_RESET`.
4. Kiem tra token ton tai.
5. Kiem tra code dung.
6. Kiem tra token chua het han.
7. Kiem tra token chua duoc dung.
8. Set `used_at = now`.
9. Tao audit log `VERIFY_PASSWORD_RESET_CODE`.
10. Commit DB.
11. Tra ve `200`.

Response:

```json
{
  "verified": true,
  "message": "Password reset code verified successfully."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Email does not exist.` | Khong co user theo email. |
| 404 | `Verification record not found.` | Chua co reset token. |
| 400 | `The verification code is incorrect.` | Code sai. |
| 400 | `The verification code has expired.` | Token qua 15 phut. |
| 400 | `The verification code is no longer valid.` | Code da duoc verify truoc do. |
| 422 | Pydantic validation error | Email/code sai format. |

### 4.3 Resend Reset Code

Endpoint:

```http
POST /api/v1/auth/resend-reset-code
```

Request:

```json
{
  "email": "user@example.com"
}
```

Happy path:
1. Tim user theo email.
2. Lay token `PASSWORD_RESET`.
3. Neu `created_at` da qua 1 gio, reset `resend_count = 0` va `created_at = now`.
4. Neu `resend_count < 5`, tao OTP moi.
5. Cap nhat token:
   - `otp_code` = OTP moi.
   - `expires_at` = now + 15 phut.
   - `used_at` = null.
   - `resend_count += 1`.
6. Tao audit log `SEND_PASSWORD_RESET_CODE`.
7. Gui email OTP moi.
8. Commit DB.
9. Tra ve `200`.

Response:

```json
{
  "message": "Verification code has been resent."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Email does not exist.` | Khong co user theo email. |
| 404 | `Verification record not found.` | Chua tung goi `/forgot-password`. |
| 429 | `Too many resend attempts. Please try again later.` | Da resend 5 lan trong 1 gio. |
| 500 | `Failed to send verification email. Please try again later.` | Gui SMTP that bai, DB rollback. |
| 422 | Pydantic validation error | Email sai format. |

### 4.4 Reset Password

Endpoint:

```http
POST /api/v1/auth/reset-password
```

Request:

```json
{
  "email": "user@example.com",
  "password": "NewPassword@123",
  "confirm_password": "NewPassword@123"
}
```

Happy path:
1. Backend validate email, password strength, confirm password.
2. Tim user theo email.
3. Lay token `PASSWORD_RESET`.
4. Token phai ton tai va co `used_at != null`, tuc code da verify.
5. Token chua het han.
6. Hash password moi.
7. Reset lock state:
   - `failed_login_attempts = 0`
   - `locked_until = null`
   - Neu user dang `Locked`, set `status_user = "Active"`.
8. Cap nhat `updated_at = now`.
9. Set `token.expires_at = now` de invalidate token ngay sau khi dung.
10. Tao audit log `RESET_PASSWORD`.
11. Commit DB.
12. Tra ve `200`.

Response:

```json
{
  "message": "Password reset successfully."
}
```

Loi co the xay ra:

| HTTP | Message | Nguyen nhan |
| --- | --- | --- |
| 404 | `Email does not exist.` | Khong co user theo email. |
| 400 | `Password reset code must be verified before resetting password.` | Chua verify reset code hoac token khong ton tai. |
| 400 | `The verification code has expired.` | Reset token da het han. |
| 422 | Pydantic validation error | Password yeu/sai format hoac confirm password khong khop. |

Ghi chu:
- Backend khong yeu cau user nhap lai reset code trong endpoint `/reset-password`; dieu kien la token `PASSWORD_RESET.used_at` da duoc set boi `/verify-reset-code`.
- Sau reset password, token bi invalidate bang cach set `expires_at = now`.
- Reset password co the mo khoa account dang `Locked`.

## 5. Frontend Flow Hien Tai

### LoginPage

File: `frontend/src/pages/LoginPage.jsx`

Hanh vi hien tai:
1. User nhap email/password.
2. Frontend chi check email co ky tu `@`.
3. Khong goi `/api/v1/auth/login`.
4. Gia lap loading 2 giay va redirecting 1 giay.
5. Neu email co `admin`, `alex`, hoac `super`, navigate den `/dashboard`.
6. Nguoc lai navigate den `/dashboard/spaces?role=USER`.

Loi hien tai tren UI:
- Email khong co `@` thi hien `Invalid email format`.
- Password khong duoc backend validate o man nay vi chua goi API.

### Register Entry

Tu LoginPage, link Register hien tro den:

```txt
/forgot-password
state: { flow: "register" }
```

File `ForgotPassword.jsx` dung chung cho forgot va register:
1. User nhap email.
2. Khong goi `/check-email`.
3. Navigate sang `/verify-email` voi `state: { email, flow }`.

### VerifyEmail

File: `frontend/src/pages/VerifyEmail.jsx`

Hanh vi hien tai:
1. User nhap 6 o OTP.
2. Chi cho nhap so.
3. Khong goi `/verify-email` hoac `/verify-reset-code`.
4. Neu `flow === "register"`, navigate den `/register`.
5. Neu flow khac, navigate den `/reset-password`.
6. Nut Resend Code hien thi nhung chua co handler goi API.

### RegisterPage

File: `frontend/src/pages/RegisterPage.jsx`

Hanh vi hien tai:
1. User nhap full name, password, confirm password.
2. UI co checklist password:
   - Minimum 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
   - One special character
3. Khi submit chi check `password !== confirmPassword`.
4. Khong goi `/register`.
5. Gia lap processing 1.5 giay, hien success, roi navigate `/dashboard`.

Luu y:
- Email hien trong badge dang hardcode `user@example.com`, chua lay tu `location.state.email`.

### Forgot Password

File: `frontend/src/pages/ForgotPassword.jsx`

Hanh vi hien tai:
1. User vao tu link Forgot Password cua LoginPage voi `flow: "forgot"`.
2. Nhap email.
3. Khong goi `/forgot-password`.
4. Navigate sang `/verify-email`.

### ResetPassword

File: `frontend/src/pages/ResetPassword.jsx`

Hanh vi hien tai:
1. User nhap new password va confirm password.
2. UI check password strength theo 5 dieu kien.
3. Submit chi check:
   - Password khop confirm password.
   - Password dai toi thieu 8 ky tu.
4. Khong goi `/reset-password`.
5. Alert thanh cong va navigate ve `/`.

Luu y:
- UI hien noi dung "Your new password must be different from your previous password", nhung backend reset-password hien khong check password moi khac password cu.

### Logout UI

File: `frontend/src/components/layout/MainLayout.jsx`

Hanh vi hien tai:
1. Click logout trong AvatarDropdown.
2. Frontend `console.log("User logged out")`.
3. Navigate ve `/`.
4. Dong dropdown.
5. Khong goi `/api/v1/auth/logout`.

## 6. De Xuat Mapping Frontend Voi Backend

Khi noi frontend vao API that, flow nen map nhu sau:

### Register

1. LoginPage Register link -> man nhap email.
2. Submit email:
   - Goi `POST /api/v1/auth/check-email`.
   - Thanh cong -> sang `/verify-email` voi `flow: "register"`.
3. Submit OTP:
   - Goi `POST /api/v1/auth/verify-email`.
   - Thanh cong -> sang `/register` voi email.
4. Submit account:
   - Goi `POST /api/v1/auth/register`.
   - Luu `access_token`, `refresh_token`, user.
   - Navigate dashboard.

### Login

1. Submit LoginPage:
   - Goi `POST /api/v1/auth/login`.
2. Thanh cong:
   - Luu access/refresh token.
   - Navigate theo `user.role`.
3. Loi:
   - Hien `message` tu backend.

### Forgot Password

1. Submit email:
   - Goi `POST /api/v1/auth/forgot-password`.
   - Thanh cong -> sang `/verify-email` voi `flow: "forgot"`.
2. Submit OTP:
   - Goi `POST /api/v1/auth/verify-reset-code`.
   - Thanh cong -> sang `/reset-password`.
3. Submit password moi:
   - Goi `POST /api/v1/auth/reset-password`.
   - Thanh cong -> ve login.

### Logout

1. Click logout:
   - Goi `POST /api/v1/auth/logout` voi `Authorization: Bearer <access_token>`.
2. Thanh cong hoac token da invalid:
   - Clear local auth state.
   - Navigate `/`.

## 7. Bang Tong Hop API

| Flow | Method | Endpoint | Auth | Success |
| --- | --- | --- | --- | --- |
| Check email/register OTP | POST | `/api/v1/auth/check-email` | No | `200 Verification code has been sent.` |
| Verify email | POST | `/api/v1/auth/verify-email` | No | `200 Email verified successfully.` |
| Resend register OTP | POST | `/api/v1/auth/resend-verification` | No | `200 Verification code has been resent.` |
| Register | POST | `/api/v1/auth/register` | No | `201 Registration successful.` |
| Login | POST | `/api/v1/auth/login` | No | `200` + access/refresh token |
| Forgot password | POST | `/api/v1/auth/forgot-password` | No | `200 Verification code sent successfully.` |
| Verify reset code | POST | `/api/v1/auth/verify-reset-code` | No | `200 Password reset code verified successfully.` |
| Resend reset code | POST | `/api/v1/auth/resend-reset-code` | No | `200 Verification code has been resent.` |
| Reset password | POST | `/api/v1/auth/reset-password` | No | `200 Password reset successfully.` |
| Logout | POST | `/api/v1/auth/logout` | Bearer access token | `200 Successfully logged out.` |

## 8. Audit Logs Duoc Tao

| Action | Khi nao |
| --- | --- |
| `CHECK_EMAIL` | Goi `/check-email` thanh cong den buoc tao token. |
| `SEND_VERIFICATION_CODE` | Gui OTP verify email lan dau hoac resend. |
| `VERIFY_EMAIL` | Verify email thanh cong. |
| `REGISTER_USER` | Register user thanh cong. |
| `LOGIN` | Login thanh cong. |
| `SEND_PASSWORD_RESET_CODE` | Gui/resend reset password code. |
| `VERIFY_PASSWORD_RESET_CODE` | Verify reset code thanh cong. |
| `RESET_PASSWORD` | Reset password thanh cong. |
| `LOGOUT` | Logout thanh cong. |

## 9. Cac Diem Can Chu Y Khi Test

- Neu khong cau hinh SMTP (`SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`), cac API gui email se tra `500 Failed to send verification email. Please try again later.`
- Test resend can canh `resend_count` va `created_at`; sau 1 gio thi counter reset.
- Test register can verify email truoc, vi `/register` yeu cau `EMAIL_VERIFICATION.used_at != null`.
- Test reset password can verify reset code truoc, vi `/reset-password` yeu cau `PASSWORD_RESET.used_at != null`.
- Login sai password den lan thu 5 mac dinh se lock account 15 phut.
- Frontend hien chua goi API auth, nen test end-to-end auth that can bo sung API client/local auth state truoc.
