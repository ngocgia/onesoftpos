# Tự triển khai master lên DirectAdmin

Workflow `.github/workflows/deploy.yml` chạy khi push lên `master`, hoặc khi chọn **Actions → Deploy master to DirectAdmin → Run workflow** trên nhánh master. GitHub cài dependencies và chạy kiểm thử trước khi chuyển code qua SSH. Không triển khai nếu kiểm thử thất bại. Các lượt triển khai không chạy đồng thời.

## Thiết lập SSH một lần

Tạo một khóa riêng cho GitHub Actions trên máy tính. Trong PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -C "github-deploy-onesoft" -f "$env:USERPROFILE\.ssh\onesoft_github_deploy"
Get-Content "$env:USERPROFILE\.ssh\onesoft_github_deploy.pub"
```

Chọn tên file khác nếu đã có khóa cùng tên; không ghi đè khóa đang dùng. Với khóa triển khai tự động này, để trống passphrase khi ssh-keygen hỏi. Dán nội dung file `.pub` vào **DirectAdmin → SSH Keys → Paste Authorized Key**, rồi cho phép/Authorize khóa. Không dán private key vào DirectAdmin.

## GitHub Secrets

Trong repository, vào **Settings → Secrets and variables → Actions → New repository secret**:

| Tên | Nội dung |
| --- | --- |
| `SSH_HOST` | Đúng địa chỉ máy chủ/IP đã dùng để đăng nhập SSH thành công |
| `SSH_PORT` | Đúng cổng SSH đang dùng, chẳng hạn `22` nếu nhà cung cấp xác nhận |
| `SSH_USER` | `onesofto6ab3` |
| `SSH_PRIVATE_KEY` | Toàn bộ nội dung file `onesoft_github_deploy`, gồm BEGIN/END; không phải file `.pub` hoặc fingerprint SHA256 |
| `SSH_KNOWN_HOSTS` | Dòng xác thực host trong `%USERPROFILE%\.ssh\known_hosts` tương ứng đúng host/cổng ở trên, sau khi xác minh fingerprint của máy chủ |

Private key chỉ nhập vào GitHub Secrets; không commit hoặc gửi qua chat. Để lấy host key khi cần, chạy `ssh-keyscan -p CONG_SSH DIA_CHI_MAY_CHU` rồi xác minh fingerprint với nhà cung cấp hosting trước khi lưu. Workflow bật StrictHostKeyChecking và không tự tin cậy một host key mới.

## GitHub Variables

Trong cùng trang Settings, tab **Variables**, có thể đặt:

| Tên | Mặc định / ý nghĩa |
| --- | --- |
| `DEPLOY_PATH` | `/home/onesofto6ab3/onesoftpos` — thư mục ứng dụng đang hoạt động |
| `NODE_ACTIVATE` | `/home/onesofto6ab3/nodevenv/onesoftpos/22/bin/activate` |
| `HEALTH_URL` | Không bắt buộc; có thể đặt `https://onesoft.one/api/health` khi HTTPS hoạt động bình thường |

Workflow dùng environment tên `production`; nếu bật quy tắc yêu cầu phê duyệt trong environment này, mỗi lượt triển khai sẽ đợi phê duyệt. Không bật quy tắc đó nếu muốn tự triển khai hoàn toàn.

## Nội dung triển khai

Chỉ chuyển `public/`, `server/src/`, `package.json`, `server/package.json` và `server/package-lock.json`. Không chuyển `.env`, `.htaccess`, `node_modules`, database hoặc `server/data/apks/`. Không xóa file trên hosting không có trong Git. Vì vậy một file bị xóa/đổi tên trong Git có thể vẫn còn trên hosting; kiểm tra và xóa riêng khi thay đổi cần thu hồi file cũ.

Dependencies chỉ được cài lại nếu lockfile đổi hoặc thư viện nền chưa khả dụng. Việc tải/cài dependencies hoàn thành trong thư mục staging bên ngoài application root trước khi sao chép sang ứng dụng. Code được ghi vào thư mục hiện có, không phải chuyển release nguyên tử; triển khai thay đổi lớn nên chọn lúc ít khách và có bản sao lưu. Không tự chạy database reset/init hoặc migration.

Sau khi chép code, script cập nhật `tmp/restart.txt` để Passenger nạp lại ứng dụng khi có request tiếp theo, không chạy `npm start`/`npm dev` trong Node.js Selector. Cách này không giải phóng một khóa Node.js Selector đã tồn tại. Log mỗi lần triển khai nằm trong GitHub Actions; SHA commit cuối được ghi tại `tmp/deployed-commit.txt` trên hosting.

## Bắt đầu sử dụng

1. Thêm public key vào hosting và tạo đủ năm GitHub Secrets.
2. Commit và push workflow, script triển khai cùng các thay đổi ứng dụng lên `master`.
3. Mở tab **Actions** để theo dõi lượt triển khai đầu tiên. Nếu chưa có đủ secret, workflow dừng và chỉ báo tên cấu hình còn thiếu.
4. Các lần push tiếp theo lên master sẽ tự kiểm thử và triển khai. Không cần clone repository hoặc lưu token GitHub trên hosting.
