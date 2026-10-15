# LiveFit AWS 最終作業

這份 repo 提供完整的前端與 Node.js API。請將它部署到自己的 AWS，完成課程網站「13. 最終作業」的配置需求，再提交自查結果截圖。

功能包含會員登入、教練照片上傳、課程與堂數管理，以及報名通知。使用東京 `ap-northeast-1`，串接 EC2、RDS、S3、SES、ECR 與 Nginx HTTPS。

## 專案內容

| 位置 | 用途 |
|---|---|
| `frontend/`、`backend/` | 已完成的網站與 API |
| `Dockerfile` | 將前後端建成一個部署映像 |
| `deploy/` | AWS 部署需要的環境、Compose、Nginx、IAM 與 S3 CORS 範本 |
| `scripts/` | 依網站網址執行自查 |
| `docker-compose.yml` | 本機預覽環境 |
| `test/`、`.github/` | 程式與檢查器的自動測試；學生不需修改 |

AWS 部署方式見 [部署說明](deploy/README.md)。配置需求、示意圖與情境講解請看課程網站。

## 本機預覽（選用）

需要 Docker Compose 與 Node.js 20.19+；正式映像使用 Node.js 24。在 repo 根目錄執行：

```sh
npm ci
npm --prefix backend ci
docker compose up -d --build --wait
node backend/scripts/init-local-aws.js
docker compose exec backend npm run db:seed
```

開啟 <http://localhost:3080>。本機使用 PostgreSQL 與 AWS 模擬器，不會建立 AWS 資源或真的寄信。

停止：`docker compose stop`。重建模擬器後，需重新執行初始化；本機圖片不會永久保存。

## 自查與繳交

自查只能用**自查專用的唯讀身分**執行。root、admin，或任何權限超出範本的身分都會在第一步被拒絕。先建立這個身分：

1. IAM → Policies → Create policy → JSON，貼上 [deploy/iam/final-check-policy.json](deploy/iam/final-check-policy.json)，把所有 `YOUR_ACCOUNT_ID` 換成自己的 12 碼帳號 ID（Console 右上角帳號選單），其餘不要改，命名 `livefit-final-check`。範本只有唯讀查詢加上開啟自己 CloudShell 與上傳檔案的權限。依 AWS 文件，[EC2 的 Describe 動作不支援 resource-level 權限](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-policy-structure.html#ec2-supported-iam-actions-resources)、[CloudShell 的 CreateEnvironment 只接受 `Resource: *`](https://docs.aws.amazon.com/cloudshell/latest/userguide/sec-auth-with-identities.html)、[STS GetCallerIdentity 沒有資源型別](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awssecuritytokenservice.html)，所以這三類保留 `*`；其餘都限在自己帳號（ARN 帳號段，S3 用 [`aws:ResourceAccount`](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-resourceaccount) 條件），符合 [IAM 最小權限原則](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)，自查會檢查這一點。
2. IAM → Users → Create user，命名 `livefit-checker`，勾選 Console 存取；權限只附加 `livefit-final-check`，不加入任何 group、不附加其他 policy。Console 為「下次登入須重設密碼」自動附加的 [`IAMUserChangePassword`](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/IAMUserChangePassword.html) 是唯一例外（只允許改自己的密碼），自查會略過它。
3. 登出 Console，改用 `livefit-checker` 登入，再開 CloudShell 或設定本機 CLI profile。

接著在該身分已登入的終端、repo 根目錄執行：

```sh
npm run check:final -- https://你的網站
```

需要 Node.js 20.19+ 與 AWS CLI v2。執行自查不需 `npm install`，不需填 JSON；有多個資源候選時，依提示選擇。使用命名 profile 時可加 `--profile 你的設定名稱`。

自查啟動時會讀取目前身分掛的所有 policy，只要出現範本以外的 Allow 就列出並中止；終端第一行 `[身分]` 會顯示身分類型與 policy 數量。自查只讀取網站與 AWS 設定，不建立資源或寄信。它檢查 HTTPS、readiness、網路、EC2、RDS、S3、SES 寄件身分、ECR 與預算；不包含監控，也不代表所有網站功能都已實測。

完成後只提交一張終端截圖，包含：

- 執行指令與自己的 HTTPS 網址。
- **通過 25／需修正 0／無法檢查 0** 的最後統計。

「需修正」請依提示調整；「無法檢查」先確認登入、查詢權限或網路，再重跑。詳細報告在 `artifacts/final-check/report.html`，留作排錯，不需交件。

### 使用東京 CloudShell

先在本機 repo 根目錄打包自查程式：

```sh
tar -czf livefit-selfcheck.tar.gz scripts/check-final.js scripts/discover-final.js
```

到東京 CloudShell 的 **Actions → Upload file** 上傳，再執行：

```sh
mkdir -p ~/livefit-selfcheck
tar -xzf ~/livefit-selfcheck.tar.gz -C ~/livefit-selfcheck
cd ~/livefit-selfcheck
node scripts/check-final.js https://你的網站
```

之後只需重跑最後一行；更新程式時換一個壓縮檔名重新上傳，並使用相同的新檔名解壓。CloudShell 沿用 Console 身分，無須貼上 AWS key；因此 Console 必須是 `livefit-checker` 登入，用 admin 或 root 登入的 CloudShell 會被拒絕。

## 使用範圍

本版為教學示範，請使用測試資料；購買堂數沒有串接金流。原技能／方案管理 API 保留公開管理方式，不能直接作為商用網站。SES Sandbox 的寄件與收件地址都需完成驗證；AWS key、密碼與 `.env.aws` 不提交 Git。
