# LiveFit 最終作業自動檢查

這三支腳本對照 2026-09-09 的 LiveFit 東京實機與 [Notion 週次對照](notion-alignment.md)，檢查學生自己的完成版部署。**不是每週小題測試，也不會自動評分。**

1. `check-final.js`：只讀網站與 AWS 設定，產生 HTML／JSON 報告。
2. `check-host.py`：透過自己的 SSH，在指定 EC2 內只讀 Docker、OS、檔案權限與 DB TLS；不需要安裝 Python 套件。
3. `check-flow.js`：明確加上 `--allow-test-data` 後，透過網站 API 實測功能並留下可辨識的測試資料。

預設檢查不修改 IAM／SG／任何 AWS 設定，不建立監控、不重新部署、不重啟、不報名、不寄信。只讀 AWS API／S3／網站請求仍可能計入既有 API 或流量用量；本腳本不新增常駐服務或排程。

## 1. 準備自己的設定

取得老師提供的 [私密完整 repo](https://github.com/hexschool/aws-livefit-final)。需要 Node.js 20.19+ 與 AWS CLI v2；CloudShell 本次實測為 Node.js 20.20.2。執行檢查本身只使用內建函式庫，**不用先 npm install**。

```sh
cp deploy/check-final.example.json deploy/check-final.local.json
```

打開 `deploy/check-final.local.json` 填自己的值。檔案只放資源識別資訊，不放 DB 密碼、JWT secret、AWS key、SSH 私鑰內容。

| 欄位 | 從哪裡取得 |
|---|---|
| url | 自己 HTTPS 網站根網址，不含 `/ready`、帳密、query |
| region | 本課程固定 `ap-northeast-1` |
| instanceId | 今天用來部署的 EC2 instance ID，不是 Name 標籤 |
| dbInstanceIdentifier | 自己 RDS 的 DB identifier，不是 endpoint |
| bucket | 自己私有 S3 Bucket 名稱 |
| practiceKey | W6 已上傳且覆寫過的同名圖片，例如 `practice/people-01.png` |
| repository／imageTag | 自己 ECR 的 private repository 與固定 tag |
| sshCidr | 允許 SSH 的自己電腦公開 IPv4 加 `/32`，不要填 CloudShell IP |
| sesIdentity | 自己已驗證的寄件 Email 或 Domain Identity |
| budgetName | 自己 W1 的月成本預算名稱 |

實例規格、私有網路、三天備份等標準在老師的腳本內。學生改的是自己的資源欄位，不可修改檢查程式降低標準；若講義核准其他部署方案，先由老師調整標準。

## 2. 跑網站與 AWS 設定自查

**方式 A：在自己的電腦執行**。沿用 W2 已設定的 AWS CLI 身分，確認它能讀取本作業資源：

```sh
npm run check:final -- --config deploy/check-final.local.json
# 有命名 profile 時，在結尾加 --profile YOUR_PROFILE
```

**方式 B：使用自己登入的東京 CloudShell**。CloudShell 沿用 Console 身分的 AWS 權限，不需把長期 key 貼進終端。私密 repo 的 GitHub 登入與 AWS 登入是兩件事；最簡單是上傳自己打包的檢查檔：

在本機 repo 根目錄執行：

```sh
tar -czf livefit-selfcheck.tar.gz scripts/check-final.js deploy/check-final.local.json
```

Console → Tokyo → CloudShell → Actions → Upload file，選剛才的壓縮檔。在 CloudShell 執行：

```sh
mkdir -p ~/livefit-selfcheck
tar -xzf ~/livefit-selfcheck.tar.gz -C ~/livefit-selfcheck
cd ~/livefit-selfcheck
node scripts/check-final.js --config deploy/check-final.local.json
```

每項會即時輸出，通常數分鐘內完成；AWS 網路、權限及分頁數會影響時間。單一項目失敗會繼續檢查其餘項目。

報告：`artifacts/final-check/report.html` 與 `report.json`。CloudShell 用 Actions → Download file，填完整路徑 `/home/cloudshell-user/livefit-selfcheck/artifacts/final-check/report.html` 下載。JSON 同樣下載；學生自查用瀏覽器開 HTML，克庭可以查 JSON 的 check ID 與時間。

| 顯示 | 代表什麼 | 學生下一步 |
|---|---|---|
| 通過 | 當次取得的證據符合該項標準 | 保留同次報告及版本 |
| 需修正 | 取得明確反例、指定資源不存在、或網站行為錯誤 | 依報告的預期、實際、修正方向重做 |
| 無法檢查 | AccessDenied、登入過期、查詢 timeout 或前置證據不足 | 先處理登入／查詢權限，不要把它當成部署已通過或設定錯誤 |
| 待人工驗證 | 這個腳本沒有證明的事 | 補錄影、截圖或與克庭現場操作 |

退出碼：`0`＝自動檢查沒有失敗或阻擋，**人工項仍可能未完成**；`1`＝至少一項需修正；`2`＝沒有明確需修正，但有權限／執行阻擋，或命令設定不完整。若同時有需修正與阻擋，回 `1`，兩種原因都保留在報告。

依 2026-09-09 老師決定，本版最終作業不包含 CloudWatch／SNS 監控，腳本也不呼叫相關 API 或要求監控資源欄位。W1 的費用預算保留。

## 3. 補主機內的證據

在自己電腦、repo 根目錄執行。替換私鑰與 EC2 公開 IP，沿用 W10 deployer；先完成 W5 的 SSH 主機指紋核對，不要關閉 host key 檢查。

```sh
mkdir -p artifacts
ssh -i ~/.ssh/YOUR_DEPLOY_KEY -o IdentitiesOnly=yes -o BatchMode=yes \
  deployer@YOUR_EC2_PUBLIC_IP 'python3 -' \
  < scripts/check-host.py > artifacts/host.json

npm run check:final -- --config deploy/check-final.local.json \
  --host-report artifacts/host.json
```

如果環境檔不在 `/home/deployer/livefit/deploy/.env.aws`，SSH 的遠端命令改成 `python3 - /你的實際路徑/.env.aws`。腳本依本作業 Compose label `project=aws-livefit`、`service=backend` 找容器，不掃描其他專案的環境。

主機檢查包含 Ubuntu 24.04 ARM、deployer／Docker 群組、單一 backend、Healthy、僅綁 127.0.0.1:8080、重啟政策、容器 node 使用者、ARM64 映像、環境檔 600、無固定 AWS key 環境變數、synchronize=false、DB 憑證驗證與一次 `BEGIN READ ONLY` SQL TLS 查詢、Nginx 與 Certbot timer。

合併時要求同一 EC2、30 分鐘內的報告，再用 AWS 資料核對正在執行的 digest、RDS endpoint、S3 Bucket／Region。沒有主機報告就保留「待人工驗證」，不會猜測已通過。

要在 CloudShell 合併：把 `artifacts/host.json` 加入上面的 tar 命令，一起上傳，然後加 `--host-report artifacts/host.json`。主機報告只有資源名稱、布林與狀態，沒有環境檔內容或 token；仍屬私密交件，不隨 repo 推送。

## 4. 跑真正網站流程

這個模式只需 Node.js 與自己的 HTTPS 網站，不需要查 AWS 的權限。它會產生應用資料，因此必須加明確旗標：

```sh
npm run check:flow -- --config deploy/check-final.local.json --allow-test-data
```

每次新增兩個 `驗收-日期-亂數` 會員、升級其中一人為教練、上傳一張極小 PNG、儲存 profile key 並再次登入讀回、建立七天後的一堂測試課程、另一會員使用既有方案模擬購買一次。使用 `example.invalid` 測試信箱，不保留帳密或 token；不建立額外技能／方案。

照片會比對真正的圖片 bytes、儲存 key，並確認已存在物件去除簽名後回 403。Node HTTP 測試不執行瀏覽器 CORS，因此仍需要設定檢查與一次真人瀏覽器上傳。

結果在 `artifacts/final-flow/report.html`／`report.json`。JSON 的 `created` 列出本次帳號、照片 key、課程等識別資料，方便老師抽查與日後清除。腳本保留這些資料，不自動刪除；每次重跑會新增一組，勿排程反覆執行。

**不呼叫報名 API，也不觸發 SES。** 報名扣堂、SES accepted 與信箱實收請依學生任務 B4 用自己已驗證且同意收信的 Email 手動完成；測試帳號不可拿去寄信。本腳本的購買是完成版的模擬購買，沒有真實金流。

## 5. 繳交給克庭

- 自己的 HTTPS URL、repo commit、ECR tag／digest。
- 同一次設定報告 HTML＋JSON；有主機報告也一併附上。
- 功能報告 HTML＋JSON，及人工驗證項目的證據連結。
- 列出「需修正／無法檢查」尚未解決的原因與資源保留時段。

報告內有時間與腳本 SHA-256 供版本對照，**不是簽章，也不能防止學生修改報告**。克庭應抽查同一網址、同一資源、同一版本；不能只靠全綠畫面判定完成。

不自動證明：IAM 實際 Allow／Deny、NACL 規則與所有可達性、所有 policy 最小權限、真實報名通知收信、重啟後資料保存、RDS 還原、Certbot 續期 dry-run、學生能否解釋架構。這些仍在最終作業驗收表內。

## 查詢權限與常見問題

檢查者使用的是自己的 CLI／CloudShell 身分，**不要把查詢權限加到 EC2 執行 Role 來讓腳本變綠**。沒有權限時先與老師確認 W2 操作身分；本工具不自動建立或套用 IAM Policy。

| 服務 | 本工具呼叫的只讀 API／需要對應查詢權限 |
|---|---|
| STS | GetCallerIdentity |
| EC2 | DescribeInstances、DescribeImages、DescribeAddresses、DescribeSecurityGroups、DescribeRouteTables |
| RDS | DescribeDBInstances |
| IAM | GetInstanceProfile |
| Budgets | DescribeBudget、DescribeNotificationsForBudget（IAM 動作對應 `budgets:ViewBudget`） |
| S3 | GetBucketLocation、GetBucketPublicAccessBlock、GetBucketOwnershipControls、GetBucketPolicyStatus、GetBucketVersioning、GetBucketCORS、ListBucketVersions、GetObject（HeadObject） |
| SES | GetEmailIdentity |
| ECR | DescribeImages |

AWS CLI 自動處理分頁；資料只存在當次記憶體，報告只取白名單摘要，不寫出原始帳號、ARN、Email、簽名網址、環境變數或 AWS credentials。報表保留自己的網站／資源 ID 供克庭對照，不當作公開作品資料。

- **S3 403 為什麼不直接通過？** 403 也可能是讀不到或不存在的物件。腳本先用查詢身分確認指定物件存在，再檢查未簽名 GET。
- **我部署能用，CLI 卻 AccessDenied？** 網站用 EC2 Role，檢查器用你的操作身分；它們是兩組權限。要補查詢證據，不要擴大網站 Role。
- **為什麼 CI 綠燈不等於上線驗收通過？** GitHub Actions 執行的是本機合約、AWS 模擬與檢查器回歸測試；不持有學生 AWS 憑證，也不連學生正式網站。

## 官方查核來源（2026-09-09）

- [EC2 DescribeInstances](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-instances.html)、[RDS DescribeDBInstances](https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-instances.html)：查指定資源與實際掛載設定。
- [S3 Bucket Policy Status](https://docs.aws.amazon.com/cli/latest/reference/s3api/get-bucket-policy-status.html)：政策公開狀態與查詢權限。
- [IAM Instance Profile](https://docs.aws.amazon.com/cli/latest/reference/iam/get-instance-profile.html)：取得 profile 與實際 Role。
- [CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html)：沿用 Console 登入權限的瀏覽器終端。
