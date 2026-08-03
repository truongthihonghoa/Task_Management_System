# Đặc tả API - Task Management System

Ghi chú: Bảng "Thông tin chạy Docker" không phải API, chỉ dùng để ghi môi trường chạy. Các bảng API để copy vào form bắt đầu từ phần `Auth API`.

## Thông tin chạy Docker

| Nội dung | Giá trị |
| --- | --- |
| Lệnh chạy Docker | `docker compose up -d --build` |
| Backend URL | `http://localhost:8001` |
| Frontend URL | `http://localhost:3000` |
| Swagger UI | `http://localhost:8001/docs` |
| OpenAPI JSON | `http://localhost:8001/openapi.json` |
| Health check | `GET http://localhost:8001/health` |
| Xác thực API | `Authorization: Bearer <access_token>` |

## Auth API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Check Email | Gửi mã OTP để xác thực email đăng ký | Body `{ email }` | `{ message }` | POST | `/api/v1/auth/check-email` |
| Verify Email | Xác thực email bằng mã OTP | Body `{ email, otp_code }` | `{ message, verified }` | POST | `/api/v1/auth/verify-email` |
| Resend Verification | Gửi lại mã OTP xác thực email | Body `{ email }` | `{ message }` | POST | `/api/v1/auth/resend-verification` |
| Login | Đăng nhập hệ thống | Body `{ email, password }` | `{ access_token, refresh_token, token_type, user }` | POST | `/api/v1/auth/login` |
| Forgot Password | Gửi mã xác nhận đặt lại mật khẩu | Body `{ email }` | `{ message }` | POST | `/api/v1/auth/forgot-password` |
| Verify Reset Code | Xác thực mã đặt lại mật khẩu | Body `{ email, code }` | `{ message, verified }` | POST | `/api/v1/auth/verify-reset-code` |
| Resend Reset Code | Gửi lại mã đặt lại mật khẩu | Body `{ email }` | `{ message }` | POST | `/api/v1/auth/resend-reset-code` |
| Reset Password | Đặt lại mật khẩu mới | Body `{ email, password, confirm_password }` | `{ message }` | POST | `/api/v1/auth/reset-password` |
| Register | Tạo tài khoản người dùng mới | Body `{ full_name, email, password, confirm_password }` | `{ message, user, access_token, refresh_token }` | POST | `/api/v1/auth/register` |
| Logout | Đăng xuất tài khoản hiện tại | Header `Authorization` | `{ message }` | POST | `/api/v1/auth/logout` |

## User API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Get Users | Lấy danh sách người dùng, dành cho Super Admin | Header `Authorization`, Query `page?, page_size?, search?, status?, sort_by?, sort_order?` | `{ total, page, page_size, items[] }` | GET | `/api/v1/users` |
| Get Profile | Lấy thông tin cá nhân của user đang đăng nhập | Header `Authorization` | `UserProfileResponse` | GET | `/api/v1/users/profile` |
| Update Profile | Cập nhật họ tên user đang đăng nhập | Header `Authorization`, Body `{ full_name }` | `UserProfileResponse` | PUT | `/api/v1/users/profile` |
| Upload Avatar | Cập nhật ảnh đại diện | Header `Authorization`, Form-data `{ file }` | `{ message, avatar_url }` | PUT | `/api/v1/users/profile/avatar` |
| Change Password | Đổi mật khẩu user đang đăng nhập | Header `Authorization`, Body `{ current_password, new_password, confirm_password }` | `{ message }` | PUT | `/api/v1/users/change-password` |
| Get User | Lấy chi tiết một user, dành cho Super Admin | Header `Authorization`, Path `{ user_id }` | `UserManagementResponse` | GET | `/api/v1/users/{user_id}` |
| Update User | Cập nhật thông tin quản trị của user | Header `Authorization`, Path `{ user_id }`, Body `{ status?, is_verified?, failed_login_attempts?, locked_until? }` | `UserManagementResponse` | PATCH | `/api/v1/users/{user_id}` |
| Activate User | Kích hoạt tài khoản user | Header `Authorization`, Path `{ user_id }` | `UserManagementResponse` | PATCH | `/api/v1/users/{user_id}/activate` |
| Deactivate User | Vô hiệu hóa tài khoản user | Header `Authorization`, Path `{ user_id }` | `UserManagementResponse` | PATCH | `/api/v1/users/{user_id}/deactivate` |
| Lock User | Khóa tài khoản user | Header `Authorization`, Path `{ user_id }` | `UserManagementResponse` | PATCH | `/api/v1/users/{user_id}/lock` |
| Unlock User | Mở khóa tài khoản user | Header `Authorization`, Path `{ user_id }` | `UserManagementResponse` | PATCH | `/api/v1/users/{user_id}/unlock` |

## Space API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Create Space | Tạo không gian làm việc mới | Header `Authorization`, Body `{ name_space, space_key, owner_id, description? }` | `SpaceResponse` | POST | `/api/v1/spaces` |
| List Spaces | Lấy danh sách space user có quyền xem | Header `Authorization`, Query `include_deleted?` | `SpaceResponse[]` | GET | `/api/v1/spaces` |
| List Owner Trash | Lấy danh sách space đã xóa của owner | Header `Authorization`, Path `{ owner_id }` | `SpaceResponse[]` | GET | `/api/v1/spaces/owners/{owner_id}/trash` |
| Get Space | Lấy thông tin chi tiết space | Header `Authorization`, Path `{ space_id }` | `SpaceResponse` | GET | `/api/v1/spaces/{space_id}` |
| Update Space | Cập nhật tên, mô tả hoặc trạng thái space | Header `Authorization`, Path `{ space_id }`, Body `{ name_space?, description?, status_space? }` | `SpaceResponse` | PATCH | `/api/v1/spaces/{space_id}` |
| Delete Space | Xóa mềm space | Header `Authorization`, Path `{ space_id }` | `SpaceResponse` | DELETE | `/api/v1/spaces/{space_id}` |
| Archive Space | Lưu trữ space | Header `Authorization`, Path `{ space_id }` | `SpaceResponse` | POST | `/api/v1/spaces/{space_id}/archive` |
| Complete Space | Hoàn tất space | Header `Authorization`, Path `{ space_id }` | `SpaceResponse` | POST | `/api/v1/spaces/{space_id}/complete` |
| Restore Space | Khôi phục space đã xóa hoặc lưu trữ | Header `Authorization`, Path `{ space_id }` | `SpaceResponse` | POST | `/api/v1/spaces/{space_id}/restore` |
| List Space Members | Lấy danh sách thành viên của space | Header `Authorization`, Path `{ space_id }` | `SpaceMemberResponse[]` | GET | `/api/v1/spaces/{space_id}/members` |
| Add People To Space | Thêm hoặc mời người dùng vào space | Header `Authorization`, Path `{ space_id }`, Body `{ user_id?, email?, name? }` | `SpaceAddPeopleResponse` | POST | `/api/v1/spaces/{space_id}/people` |
| Approve Space Member Request | Duyệt yêu cầu tham gia space qua review token | Path `{ review_token }` | `{ message }` | GET | `/api/v1/spaces/member-requests/{review_token}/approve` |
| Reject Space Member Request | Từ chối yêu cầu tham gia space qua review token | Path `{ review_token }` | `{ message }` | GET | `/api/v1/spaces/member-requests/{review_token}/reject` |

## Sprint API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Sprints | Lấy danh sách sprint trong space | Header `Authorization`, Path `{ space_id }`, Query `include_deleted?` | `SprintResponse[]` | GET | `/api/v1/spaces/{space_id}/sprints` |
| Create Sprint | Tạo sprint mới trong space | Header `Authorization`, Path `{ space_id }`, Body `{ goal?, start_date?, end_date?, duration_weeks?, status?, auto_start?, auto_complete? }` | `SprintResponse` | POST | `/api/v1/spaces/{space_id}/sprints` |
| Get Sprint | Lấy chi tiết sprint | Header `Authorization`, Path `{ sprint_id }` | `SprintResponse` | GET | `/api/v1/sprints/{sprint_id}` |
| Update Sprint | Cập nhật thông tin sprint | Header `Authorization`, Path `{ sprint_id }`, Body `{ name?, goal?, start_date?, end_date?, duration_weeks?, status?, auto_start?, auto_complete? }` | `SprintResponse` | PATCH | `/api/v1/sprints/{sprint_id}` |
| Delete Sprint | Xóa mềm sprint | Header `Authorization`, Path `{ sprint_id }` | `SprintResponse` | DELETE | `/api/v1/sprints/{sprint_id}` |
| Activate Sprint | Kích hoạt sprint | Header `Authorization`, Path `{ sprint_id }` | `SprintResponse` | POST | `/api/v1/sprints/{sprint_id}/activate` |
| Complete Sprint | Hoàn thành sprint | Header `Authorization`, Path `{ sprint_id }` | `SprintResponse` | POST | `/api/v1/sprints/{sprint_id}/complete` |

## Task Management API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Create Task | Tạo task mới trong space | Header `Authorization`, Path `{ space_id }`, Body `{ title, description?, sprint_id, priority, task_status?, story_points?, completed_at? }` | `TaskDetailResponse` | POST | `/api/v1/spaces/{space_id}/tasks` |
| List Tasks | Lấy danh sách task trong space | Header `Authorization`, Path `{ space_id }`, Query `page?, page_size?, search?, task_status?, priority?, sort?, active_sprint_only?` | `{ items[], total, page, page_size }` | GET | `/api/v1/spaces/{space_id}/tasks` |
| Create Task With Attachments | Tạo task mới kèm file đính kèm | Header `Authorization`, Path `{ space_id }`, Form-data `{ title, sprint_id, priority, description?, task_status?, story_points?, completed_at?, attachments? }` | `TaskDetailResponse` | POST | `/api/v1/spaces/{space_id}/tasks/with-attachments` |
| List Deleted Tasks | Lấy danh sách task đã xóa mềm trong space | Header `Authorization`, Path `{ space_id }`, Query `page?, page_size?, search?, task_status?, priority?, sort?` | `{ items[], total, page, page_size }` | GET | `/api/v1/spaces/{space_id}/tasks/deleted` |
| Get Task Board | Lấy task theo từng cột trạng thái | Header `Authorization`, Path `{ space_id }` | `{ new[], in_progress[], in_testing[], pending_review[], need_revision[], done[], cancelled[] }` | GET | `/api/v1/spaces/{space_id}/tasks/board` |
| Get Task Detail | Lấy chi tiết task | Header `Authorization`, Path `{ task_id }` | `TaskDetailResponse` | GET | `/api/v1/tasks/{task_id}` |
| Update Task | Cập nhật task | Header `Authorization`, Path `{ task_id }`, Body `{ title?, description?, sprint_id?, priority?, task_status?, story_points?, completed_at? }` | `TaskDetailResponse` | PATCH | `/api/v1/tasks/{task_id}` |
| Delete Task | Xóa mềm task | Header `Authorization`, Path `{ task_id }` | `TaskDetailResponse` | DELETE | `/api/v1/tasks/{task_id}` |
| Restore Task | Khôi phục task đã xóa | Header `Authorization`, Path `{ task_id }` | `TaskDetailResponse` | POST | `/api/v1/tasks/{task_id}/restore` |

## Task Assignee API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Assign Task Assignees | Gán một hoặc nhiều người phụ trách task | Header `Authorization`, Path `{ task_id }`, Body `{ assignee_ids[], reason? }` | `{ assignees[] }` | POST | `/api/v1/tasks/{task_id}/assignees` |
| Get Task Assignees | Lấy danh sách người phụ trách task | Header `Authorization`, Path `{ task_id }` | `{ assignees[] }` | GET | `/api/v1/tasks/{task_id}/assignees` |
| Reassign Task Assignee | Chuyển người phụ trách task | Header `Authorization`, Path `{ task_id }`, Body `{ previous_assignee_id, new_assignee_id?, reason? }` | `{ assignees[] }` | PUT | `/api/v1/tasks/{task_id}/assignees` |
| Remove Task Assignee | Gỡ người phụ trách khỏi task | Header `Authorization`, Path `{ task_id, assignee_id }`, Body `{ reason? }?` | `{ message }` | DELETE | `/api/v1/tasks/{task_id}/assignees/{assignee_id}` |
| Get Assignment History | Lấy lịch sử gán/chuyển người phụ trách task | Header `Authorization`, Path `{ task_id }` | `{ history[] }` | GET | `/api/v1/tasks/{task_id}/assignment-history` |

## Attachment API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Task Attachments | Lấy danh sách file đính kèm của task | Header `Authorization`, Path `{ task_id }`, Query `page?, page_size?, include_deleted?` | `{ items[], total, page, page_size }` | GET | `/api/v1/tasks/{task_id}/attachments` |
| Get Task Attachment | Lấy chi tiết file đính kèm | Header `Authorization`, Path `{ attachment_id }` | `TaskAttachmentResponse` | GET | `/api/v1/attachments/{attachment_id}` |
| Delete Task Attachment | Xóa mềm file đính kèm | Header `Authorization`, Path `{ attachment_id }` | `TaskAttachmentResponse` | DELETE | `/api/v1/attachments/{attachment_id}` |
| Replace Task Attachment | Thay thế file đính kèm | Header `Authorization`, Path `{ attachment_id }`, Form-data `{ file }` | `TaskAttachmentResponse` | PUT | `/api/v1/attachments/{attachment_id}` |

## Comment API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Task Comments | Lấy danh sách bình luận của task | Header `Authorization`, Path `{ task_id }`, Query `page?, page_size?, include_deleted?` | `{ items[], total, page, page_size }` | GET | `/api/v1/tasks/{task_id}/comments` |
| Create Task Comment | Tạo bình luận mới hoặc phản hồi bình luận | Header `Authorization`, Path `{ task_id }`, Body `{ comment, parent_comment_id? }` | `TaskCommentResponse` | POST | `/api/v1/tasks/{task_id}/comments` |
| Get Task Comment | Lấy chi tiết bình luận | Header `Authorization`, Path `{ comment_id }` | `TaskCommentResponse` | GET | `/api/v1/comments/{comment_id}` |
| Update Task Comment | Cập nhật nội dung bình luận | Header `Authorization`, Path `{ comment_id }`, Body `{ comment }` | `TaskCommentResponse` | PATCH | `/api/v1/comments/{comment_id}` |
| Delete Task Comment | Xóa mềm bình luận | Header `Authorization`, Path `{ comment_id }` | `TaskCommentResponse` | DELETE | `/api/v1/comments/{comment_id}` |

## Media API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Upload Task Media | Upload media dùng cho attachment, comment hoặc description | Header `Authorization`, Path `{ task_id }`, Form-data `{ usage, file }` | `MediaUploadResponse` | POST | `/api/v1/tasks/{task_id}/media` |

## Main Layout API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Get Current User Layout | Lấy dữ liệu khởi tạo layout sau khi đăng nhập | Header `Authorization` | `MainLayoutResponse` | GET | `/api/v1/me` |
| Get Current User Sidebar Summary | Lấy số liệu và quyền hiển thị sidebar | Header `Authorization` | `SidebarSummaryResponse` | GET | `/api/v1/me/sidebar-summary` |
| Get Current User Preferences | Lấy cấu hình giao diện của user | Header `Authorization` | `MainLayoutPreferencesResponse` | GET | `/api/v1/me/preferences` |
| Update Current User Language | Cập nhật ngôn ngữ giao diện | Header `Authorization`, Body `{ language }` | `MainLayoutPreferencesResponse` | PUT | `/api/v1/me/preferences/language` |
| Get Current User Profile | Lấy thông tin profile dùng trong layout | Header `Authorization` | `UserProfileResponse` | GET | `/api/v1/me/profile` |
| Update Current User Profile | Cập nhật profile từ layout | Header `Authorization`, Body `{ full_name }` | `UserProfileResponse` | PUT | `/api/v1/me/profile` |
| Get Current User Space Context | Lấy role và quyền của user trong space | Header `Authorization`, Path `{ space_id }` | `SpaceContextResponse` | GET | `/api/v1/me/spaces/{space_id}/context` |

## Search API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Global Search | Tìm kiếm tổng hợp space, task và user | Header `Authorization`, Query `q?, types?, limit_per_type?, space_id?, include_recent?` | `{ query, spaces[], tasks[], users[] }` | GET | `/api/v1/search/global` |

## Notification API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Notifications | Lấy danh sách thông báo của user đang đăng nhập | Header `Authorization`, Query `status?, type?, audience?, search?, task_id?, space_id?, page?, page_size?, sort_order?` | `{ items[], total, page, page_size, total_pages, unread_count }` | GET | `/api/v1/notifications` |
| Bulk Delete Notifications | Xóa nhiều thông báo | Header `Authorization`, Body `{ notification_ids[] }` | `{ message, deleted_count }` | DELETE | `/api/v1/notifications` |
| Get Unread Count | Lấy số lượng thông báo chưa đọc | Header `Authorization` | `{ unread_count }` | GET | `/api/v1/notifications/unread-count` |
| Mark All Read | Đánh dấu tất cả thông báo là đã đọc | Header `Authorization` | `{ updated_count }` | PATCH | `/api/v1/notifications/read-all` |
| Delete Read Notifications | Xóa các thông báo đã đọc | Header `Authorization` | `{ message, deleted_count }` | DELETE | `/api/v1/notifications/read` |
| Bulk Mark Read | Đánh dấu nhiều thông báo là đã đọc | Header `Authorization`, Body `{ notification_ids[] }` | `{ updated_count }` | PATCH | `/api/v1/notifications/read` |
| Get Notification Detail | Lấy chi tiết một thông báo | Header `Authorization`, Path `{ notification_id }` | `NotificationResponse` | GET | `/api/v1/notifications/{notification_id}` |
| Delete Notification | Xóa một thông báo | Header `Authorization`, Path `{ notification_id }` | Không có body, status `204` | DELETE | `/api/v1/notifications/{notification_id}` |
| Mark Notification Read | Đánh dấu một thông báo là đã đọc | Header `Authorization`, Path `{ notification_id }` | `NotificationResponse` | PATCH | `/api/v1/notifications/{notification_id}/read` |
| Mark Notification Unread | Đánh dấu một thông báo là chưa đọc | Header `Authorization`, Path `{ notification_id }` | `NotificationResponse` | PATCH | `/api/v1/notifications/{notification_id}/unread` |

## Notification Preference API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Notification Preferences | Lấy danh sách cấu hình thông báo của user | Header `Authorization` | `{ items[] }` | GET | `/api/v1/notification-preferences` |
| Get Notification Preference | Lấy cấu hình thông báo theo scope | Header `Authorization`, Path `{ scope }` | `NotificationPreferenceResponse` | GET | `/api/v1/notification-preferences/{scope}` |
| Update Notification Preference | Cập nhật toàn bộ cấu hình thông báo theo scope | Header `Authorization`, Path `{ scope }`, Body `{ email_enabled, email_frequency, email_settings, app_settings }` | `NotificationPreferenceResponse` | PUT | `/api/v1/notification-preferences/{scope}` |
| Patch Notification Preference | Cập nhật một phần cấu hình thông báo theo scope | Header `Authorization`, Path `{ scope }`, Body `{ email_enabled?, email_frequency?, email_settings?, app_settings? }` | `NotificationPreferenceResponse` | PATCH | `/api/v1/notification-preferences/{scope}` |
| Reset Notification Preference | Đặt lại cấu hình thông báo về mặc định | Header `Authorization`, Path `{ scope }` | `NotificationPreferenceResponse` | POST | `/api/v1/notification-preferences/{scope}/reset` |

## Help API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| List Help Guides | Lấy danh sách hướng dẫn sử dụng | Header `Authorization` | `{ guides[] }` | GET | `/api/v1/help/guides` |
| Get Help Guide | Lấy nội dung chi tiết hướng dẫn theo slug | Header `Authorization`, Path `{ slug }` | `GuideDetailResponse` | GET | `/api/v1/help/guides/{slug}` |

## Dashboard API

| Tên API | Mô tả | Đầu vào | Đầu ra | Phương thức HTTP | Endpoint |
| --- | --- | --- | --- | --- | --- |
| Get Super Admin Dashboard | Lấy dữ liệu tổng quan dashboard cho Super Admin | Header `Authorization` | `SuperAdminDashboardResponse` | GET | `/api/v1/dashboard/super-admin` |
| Get Space Summary Dashboard | Lấy dữ liệu tổng quan của một space | Header `Authorization`, Path `{ space_id }`, Query `member_id?` | `SpaceSummaryDashboardResponse` | GET | `/api/v1/dashboard/spaces/{space_id}/summary` |
| Get Space Summary Members | Lấy danh sách member phục vụ dashboard space | Header `Authorization`, Path `{ space_id }` | `DashboardSummaryMemberResponse[]` | GET | `/api/v1/dashboard/spaces/{space_id}/summary/members` |
| Get Space Recent Activities | Lấy hoạt động gần đây trong space | Header `Authorization`, Path `{ space_id }`, Query `member_id?, page?, page_size?, search?, status?, date_range?, date_from?, date_to?` | `DashboardActivityListResponse` | GET | `/api/v1/dashboard/spaces/{space_id}/summary/recent-activities` |
| Get Space Recent Tasks | Lấy task gần đây trong space | Header `Authorization`, Path `{ space_id }`, Query `member_id?, tab?, page?, page_size?, search?, status?, date_range?, date_from?, date_to?` | `DashboardActivityListResponse` | GET | `/api/v1/dashboard/spaces/{space_id}/summary/recent-tasks` |
| Get Space Assignment History | Lấy lịch sử phân công task trong space | Header `Authorization`, Path `{ space_id }`, Query `member_id?, page?, page_size?, search?, change_status?, date_from?, date_to?, sort_order?` | `DashboardAssignmentHistoryListResponse` | GET | `/api/v1/dashboard/spaces/{space_id}/summary/assignment-history` |
| Get Super Admin Activity Spaces | Lấy danh sách space có thông tin hoạt động | Header `Authorization` | `DashboardActivitySpaceResponse[]` | GET | `/api/v1/dashboard/super-admin/activity-spaces` |
| Get Super Admin Recent Activities | Lấy hoạt động gần đây toàn hệ thống | Header `Authorization`, Query `tab?, page?, page_size?, space_id?, search?, status?, date_range?, date_from?, date_to?` | `DashboardActivityListResponse` | GET | `/api/v1/dashboard/super-admin/recent-activities` |
| Get Super Admin Audit Logs | Lấy danh sách audit log toàn hệ thống | Header `Authorization`, Query `page?, page_size?, search?, event_type?, label_title?, date_from?, date_to?, sort_order?` | `DashboardAuditLogListResponse` | GET | `/api/v1/dashboard/super-admin/audit-logs` |
| Get Audit Log Filters | Lấy danh sách tùy chọn lọc audit log | Header `Authorization` | `DashboardAuditLogFilterOptionsResponse` | GET | `/api/v1/dashboard/super-admin/audit-logs/filters` |
| Get Audit Log Detail | Lấy chi tiết audit log | Header `Authorization`, Path `{ log_id }` | `DashboardAuditLogItemResponse` | GET | `/api/v1/dashboard/super-admin/audit-logs/{log_id}` |
| Get Super Admin Assignment History | Lấy lịch sử phân công task toàn hệ thống | Header `Authorization`, Query `page?, page_size?, search?, change_status?, space_id?, date_from?, date_to?, sort_order?` | `DashboardAssignmentHistoryListResponse` | GET | `/api/v1/dashboard/super-admin/assignment-history` |

## Bảng tổng hợp thông báo đầu ra

### Tổng hợp theo mã HTTP status

| HTTP status | Loại kết quả | Ý nghĩa trong hệ thống | Dạng đầu ra thường gặp |
| --- | --- | --- | --- |
| 200 OK | Thành công | API xử lý thành công thao tác lấy dữ liệu, cập nhật, đăng nhập, gửi OTP, đánh dấu thông báo | Object dữ liệu hoặc `{ message }`, `{ updated_count }`, `{ deleted_count }` |
| 201 Created | Thành công | Tạo mới tài nguyên thành công | Object vừa tạo, ví dụ `SpaceResponse`, `SprintResponse`, `TaskDetailResponse`, `TaskCommentResponse`, `MediaUploadResponse` |
| 204 No Content | Thành công | Xóa thành công và không trả body | Không có response body |
| 400 Bad Request | Lỗi client | Dữ liệu hợp lệ về cú pháp nhưng sai logic nghiệp vụ | `{ message: "..." }` |
| 401 Unauthorized | Lỗi xác thực | Thiếu token, token sai, user không tồn tại, hoặc sai thông tin đăng nhập | `{ message: "..." }` |
| 403 Forbidden | Lỗi phân quyền | Đã đăng nhập nhưng không có quyền thực hiện thao tác | `{ message: "..." }` |
| 404 Not Found | Lỗi không tìm thấy | Không tìm thấy user, space, sprint, task, comment, attachment, notification hoặc guide | `{ message: "..." }` |
| 409 Conflict | Lỗi xung đột dữ liệu | Dữ liệu đã tồn tại, bị trùng, hoặc request đang pending | `{ message: "..." }` |
| 413 Payload Too Large | Lỗi file quá lớn | File upload vượt giới hạn dung lượng | `{ message: "..." }` |
| 422 Unprocessable Entity | Lỗi validate | Sai kiểu dữ liệu, sai enum, sai format, hoặc cấu hình không hợp lệ | `{ message: "..." }` hoặc lỗi validate Pydantic |
| 429 Too Many Requests | Lỗi giới hạn tần suất | Gửi lại OTP quá nhiều lần | `{ message: "..." }` |
| 500 Internal Server Error | Lỗi server | Gửi email thất bại hoặc lỗi phía server | `{ message: "..." }` |

### Thông báo thành công

| Nhóm API | API áp dụng | Trường đầu ra | HTTP status | Thông báo / Định dạng đầu ra |
| --- | --- | --- | --- | --- |
| Auth | Check Email | `message` | 200 | `Verification code has been sent.` |
| Auth | Verify Email | `message`, `verified` | 200 | `Email verified successfully.`, `verified: true` |
| Auth | Resend Verification | `message` | 200 | `Verification code has been resent.` |
| Auth | Register | `message`, `user`, `access_token`, `refresh_token` | 201 | `Registration successful.` |
| Auth | Login | `access_token`, `refresh_token`, `token_type`, `user` | 200 | Trả token đăng nhập và thông tin user |
| Auth | Logout | `message` | 200 | `Successfully logged out.` |
| Auth | Forgot Password | `message` | 200 | `Verification code sent successfully.` |
| Auth | Verify Reset Code | `message`, `verified` | 200 | `Password reset code verified successfully.`, `verified: true` |
| Auth | Resend Reset Code | `message` | 200 | `Verification code has been resent.` |
| Auth | Reset Password | `message` | 200 | `Password reset successfully.` |
| User | Upload Avatar | `message`, `avatar_url` | 200 | `Avatar updated successfully.` |
| User | Change Password | `message` | 200 | `Password changed successfully. Please log in again.` |
| Space | Add People To Space | `status`, `message`, `member?`, `request?` | 200 | `Invitation email sent. Waiting for the invitee to accept.` |
| Space | Add People To Space | `status`, `message`, `member?`, `request?` | 200 | `Approval request sent to the space owner.` |
| Space | Add People To Space | `status`, `message`, `member?`, `request?` | 200 | `Request created, but email delivery is not configured or failed.` |
| Space | Approve Member Request | `message` | 200 | `Owner approved. Invitation email sent to the invitee.` |
| Space | Approve Member Request | `message` | 200 | `Owner approved, but invitation email delivery failed.` |
| Space | Approve Member Request | `message` | 200 | `Invitation accepted and member added.` |
| Space | Approve Member Request | `message` | 200 | `Invitation accepted. Register with this email to access the space.` |
| Space | Reject Member Request | `message` | 200 | `Request rejected.` |
| Space | Review Member Request | `message` | 200 | `Request was already {status}.` |
| Task Assignee | Remove Task Assignee | `message` | 200 | `Assignee removed successfully.` |
| Notification | Mark All Read | `updated_count` | 200 | Số lượng thông báo đã được đánh dấu đã đọc |
| Notification | Bulk Mark Read | `updated_count` | 200 | Số lượng thông báo đã được đánh dấu đã đọc |
| Notification | Delete Read Notifications | `message`, `deleted_count` | 200 | `Read notifications deleted.` |
| Notification | Bulk Delete Notifications | `message`, `deleted_count` | 200 | `Notifications deleted.` |
| Notification | Delete Notification | Không có body | 204 | Xóa thành công, không trả response body |
| Notification Preference | Update/Patch/Reset Preference | `NotificationPreferenceResponse` | 200 | Trả cấu hình thông báo sau khi cập nhật |
| Main Layout | Logout | `message` | 200 | `Successfully logged out.` |

### Thông báo lỗi thường gặp

| Nhóm API | Trường trả về | HTTP status | Thông báo / Định dạng lỗi |
| --- | --- | --- | --- |
| Chung | `message` | 401 | `Authentication required.` |
| Chung | `message` | 401 | `Invalid authentication token.` |
| Chung | `message` | 401 | `Authenticated user not found.` |
| Chung | `message` | 403 | `Permission denied` hoặc `Permission denied.` |
| Chung | `message` | 422 | Lỗi validate dữ liệu đầu vào của Pydantic |
| Auth | `message` | 409 | `Email already exists.` |
| Auth | `message` | 404 | `Verification record not found.` |
| Auth | `message` | 400 | `The verification code is incorrect.` |
| Auth | `message` | 400 | `The verification code has expired.` |
| Auth | `message` | 400 | `The verification code is no longer valid.` |
| Auth | `message` | 429 | `Too many resend attempts. Please try again later.` |
| Auth | `message` | 500 | `Failed to send verification email. Please try again later.` |
| Auth | `message` | 404 | `Email does not exist.` |
| Auth | `message` | 403 | `Please verify your email first.` |
| Auth | `message` | 400 | `Password reset code must be verified before resetting password.` |
| Auth | `message` | 400 | `Confirm password mismatch.` |
| Auth | `message` | 400 | `Email must be verified before registration.` |
| Auth | `message` | 400 | `OTP expired.` |
| Auth | `message` | 409 | `Duplicate registration.` |
| Auth | `message` | 401 | `Invalid email or password.` |
| Auth | `message` | 403 | `Account temporarily locked.` |
| Auth | `message` | 403 | `Account has been deactivated.` |
| User | `message` | 400 | `Invalid status filter` |
| User | `message` | 400 | `Invalid sort field` |
| User | `message` | 400 | `Invalid sort order` |
| User | `message` | 400 | `At least one field is required` |
| User | `message` | 400 | `Invalid status value` |
| User | `message` | 400 | `File must be an image.` |
| User | `message` | 400 | `Unsupported image format.` |
| User | `message` | 400 | `File size exceeds 5 MB limit.` |
| User | `message` | 401 | `Incorrect current password.` |
| User | `message` | 403 | `SUPER_ADMIN access required.` |
| User | `message` | 404 | `User not found` |
| Space | `message` | 400 | `Space name is required` |
| Space | `message` | 400 | `Owner is not active` |
| Space | `message` | 400 | `Space is archived` |
| Space | `message` | 400 | `Space must be active` |
| Space | `message` | 400 | `Space is deleted` |
| Space | `message` | 409 | `Space name already exists` |
| Space | `message` | 400 | `Space is already archived` |
| Space | `message` | 400 | `Cannot archive deleted space` |
| Space | `message` | 400 | `Space is not deleted` |
| Space | `message` | 400 | `Space restore period has expired` |
| Space | `message` | 409 | `User is already an active member` |
| Space | `message` | 409 | `A pending approval request already exists for this person` |
| Space | `message` | 403 | `Only users can create spaces` |
| Space | `message` | 403 | `Users can only create spaces for themselves` |
| Space | `message` | 404 | `Space not found` |
| Space | `message` | 404 | `Owner user not found` |
| Space | `message` | 404 | `Approval request not found` |
| Sprint | `message` | 400 | `Sprint is deleted` |
| Sprint | `message` | 400 | `Complete the active sprint before activating another sprint` |
| Sprint | `message` | 400 | `End date must be after start date` |
| Sprint | `message` | 400 | `Cannot delete sprint with active tasks` |
| Sprint | `message` | 400 | `Completed sprint cannot be activated` |
| Sprint | `message` | 400 | `Sprint is already completed` |
| Sprint | `message` | 400 | `Only active sprints can be completed` |
| Sprint | `message` | 403 | `SUPER_ADMIN cannot modify sprints` |
| Sprint | `message` | 404 | `Sprint not found` |
| Task | `message` | 400 | `Task is deleted` |
| Task | `message` | 400 | `Task is already deleted` |
| Task | `message` | 400 | `Task is not deleted` |
| Task | `message` | 400 | `Sprint does not belong to this space` |
| Task | `message` | 403 | `SUPER_ADMIN cannot modify tasks` |
| Task | `message` | 403 | `Only the space owner can perform this action` |
| Task | `message` | 404 | `Task not found` |
| Task Assignee | `message` | 409 | `User already assigned: {user_id}` |
| Task Assignee | `message` | 400 | `New assignee must be different from previous assignee.` |
| Task Assignee | `message` | 400 | `Task deleted.` |
| Task Assignee | `message` | 400 | `User is inactive: {user_id}` |
| Task Assignee | `message` | 400 | `User is locked: {user_id}` |
| Task Assignee | `message` | 400 | `User is not an active member of the task space: {user_id}` |
| Task Assignee | `message` | 403 | `SUPER_ADMIN cannot modify task assignments.` |
| Task Assignee | `message` | 404 | `Previous assignee not found.` |
| Task Assignee | `message` | 404 | `User not found: {user_id}` |
| Comment | `message` | 400 | `Comment is deleted` |
| Comment | `message` | 400 | `Comment is already deleted` |
| Comment | `message` | 400 | `Parent comment is deleted` |
| Comment | `message` | 400 | `Parent comment does not belong to this task` |
| Comment | `message` | 403 | `Only the comment author can update it` |
| Comment | `message` | 403 | `Only the comment author can delete it` |
| Comment | `message` | 404 | `Comment not found` |
| Comment | `message` | 404 | `Parent comment not found` |
| Attachment/Media | `message` | 400 | `File type is not allowed` |
| Attachment/Media | `message` | 400 | `File mime type is not allowed` |
| Attachment/Media | `message` | 413 | `File size exceeds 20MB` |
| Attachment/Media | `message` | 400 | `Attachment is deleted` |
| Attachment/Media | `message` | 403 | `Only the attachment uploader can delete it` |
| Attachment/Media | `message` | 403 | `Only the attachment uploader can replace it` |
| Attachment/Media | `message` | 404 | `Attachment not found` |
| Notification | `message` | 404 | `Notification not found.` |
| Notification Preference | `message` | 403 | `Permission denied.` |
| Notification Preference | `message` | 422 | `Settings must be an object.` |
| Notification Preference | `message` | 422 | `Unsupported notification type for scope.` |
| Notification Preference | `message` | 422 | `Setting values must be boolean.` |
| Main Layout/Search | `message` | 422 | `Unsupported language.` |
| Main Layout/Search | `message` | 422 | `Invalid search types.` |
| Help | `message` | 404 | `Guide '{slug}' not found.` |
| Dashboard | `message` | 403 | `Only SUPER_ADMIN, the space owner, or an active space member can access this summary.` |
| Dashboard | `message` | 403 | `Members can only filter their own summary.` |
| Dashboard | `message` | 403 | `Only SUPER_ADMIN or the space owner can access assignment history.` |
| Dashboard | `message` | 422 | `Unsupported date_range. Use all_time, today, yesterday, or last_7_days.` |
| Dashboard | `message` | 404 | `Member not found in this space.` |
| Dashboard | `message` | 404 | `Audit log not found.` |

## Giá trị hợp lệ thường dùng

| Nhóm | Giá trị hợp lệ |
| --- | --- |
| Task Priority | `HIGH`, `MEDIUM`, `LOW` |
| Task Status | `new`, `in_progress`, `in_testing`, `pending_review`, `need_revision`, `done`, `cancelled` |
| Space Status | `Active`, `Archived`, `Deleted` |
| Sprint Status | `Planned`, `Active`, `Completed`, `Deleted` |
| Media Usage | `attachment`, `comment`, `description` |
| Notification Read Status | `read`, `unread` |
| Notification Audience | `USER`, `OWNER`, `SUPER_ADMIN` |
| Notification Preference Scope | `USER_ACCOUNT`, `SUPER_ADMIN` |
| Notification Email Frequency | `INSTANT`, `DAILY_DIGEST`, `WEEKLY_DIGEST`, `OFF` |
| Sort Order | `asc`, `desc` |
