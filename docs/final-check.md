# LiveFit 最終作業自動檢查

輸入自己的 HTTPS 網址，就能檢查東京 LiveFit 的網站與 AWS 設定。檢查範圍對照 [Notion 週次](notion-alignment.md)，本版不含監控。

## 1. 只輸入自己的網站網址

在已取得的 repo 資料夾、已登入自己 AWS 的終端執行：

```sh
npm run check:final -- https://你的網站
```

**不需要建立 JSON，也不需要自己查 EC2 ID、RDS 名稱、Bucket、ECR、寄件信箱或預算名稱。** 腳本固定查東京，先從網址找到 EC2，再讀它的 VPC 與 Role 來找對應資源。有多個候選才顯示選單，輸入編號即可；無法確認的項目會保留「無法檢查」，不會任選一個。

需要 Node.js 20.19+ 與 AWS CLI v2，執行本腳本不用 npm install。若使用命名 profile，可在指令最後加 `--profile 你的設定名稱`。

## 2. 如果使用東京 CloudShell

CloudShell 沿用你已登入的 AWS Console 權限。本機 CLI 權限不足時可用這個方式，不用另外貼 AWS key。

第一次在本機 repo 資料夾打包兩個腳本（更新版本時換一個壓縮檔名，CloudShell 不覆蓋同名檔）：

```sh
tar -czf livefit-selfcheck.tar.gz scripts/check-final.js scripts/discover-final.js
```

CloudShell → Actions → Upload file，選這個檔案。貼上：

```sh
mkdir -p ~/livefit-selfcheck
tar -xzf ~/livefit-selfcheck.tar.gz -C ~/livefit-selfcheck
cd ~/livefit-selfcheck
node scripts/check-final.js https://你的網站
```

之後只要重新執行最後一行，改自己的網址即可。這個打包檔只有程式，沒有設定表或憑證。

每項會即時輸出，通常數分鐘內完成；AWS 網路、權限及分頁數會影響時間。單一項目失敗會繼續檢查其餘項目。

報告：`artifacts/final-check/report.html` 與 `report.json`。CloudShell 用 Actions → Download file，填完整路徑 `/home/cloudshell-user/livefit-selfcheck/artifacts/final-check/report.html` 下載。學生先下載 HTML 查看結果；JSON 留作克庭需要時的詳細核對。

| 顯示 | 代表什麼 | 學生下一步 |
|---|---|---|
| 通過 | 當次取得的證據符合該項標準 | 保留同次報告及版本 |
| 需修正 | 取得明確反例、指定資源不存在、或網站行為錯誤 | 依報告的預期、實際、修正方向重做 |
| 無法檢查 | AccessDenied、登入過期、查詢 timeout 或前置證據不足 | 先處理登入／查詢權限，不要把它當成部署已通過或設定錯誤 |
| 待人工驗證 | 這個腳本沒有證明的事 | 補錄影、截圖或與克庭現場操作 |

退出碼：`0`＝自動檢查沒有失敗或阻擋，**人工項仍可能未完成**；`1`＝至少一項需修正；`2`＝沒有明確需修正，但有權限／執行阻擋，或命令設定不完整。若同時有需修正與阻擋，回 `1`，兩種原因都保留在報告。

依 2026-09-09 老師決定，本版最終作業不包含 CloudWatch／SNS 監控，腳本也不呼叫相關 API 或要求監控資源欄位。W1 的費用預算保留。

## 3. 進階：需要查主機內部時

在自己電腦、repo 根目錄執行。替換私鑰與 EC2 公開 IP，沿用 W10 deployer；先完成 W5 的 SSH 主機指紋核對，不要關閉 host key 檢查。

```sh
mkdir -p artifacts
ssh -i ~/.ssh/YOUR_DEPLOY_KEY -o IdentitiesOnly=yes -o BatchMode=yes \
  deployer@YOUR_EC2_PUBLIC_IP 'python3 -' \
  < scripts/check-host.py > artifacts/host.json

npm run check:final -- https://你的網站 \
  --host-report artifacts/host.json
```

如果環境檔不在 `/home/deployer/livefit/deploy/.env.aws`，SSH 的遠端命令改成 `python3 - /你的實際路徑/.env.aws`。腳本依本作業 Compose label `project=aws-livefit`、`service=backend` 找容器，不掃描其他專案的環境。

主機檢查包含 Ubuntu 24.04 ARM、deployer／Docker 群組、單一 backend、Healthy、僅綁 127.0.0.1:8080、重啟政策、容器 node 使用者、ARM64 映像、環境檔 600、無固定 AWS key 環境變數、synchronize=false、DB 憑證驗證與一次 `BEGIN READ ONLY` SQL TLS 查詢、Nginx 與 Certbot timer。

合併時要求同一 EC2、30 分鐘內的報告，再用 AWS 資料核對正在執行的 digest、RDS endpoint、S3 Bucket／Region。沒有主機報告就保留「待人工驗證」，不會猜測已通過。

要在 CloudShell 合併：把 `artifacts/host.json` 加入上面的 tar 命令，一起上傳，然後加 `--host-report artifacts/host.json`。主機報告只有資源名稱、布林與狀態，沒有環境檔內容或 token；仍屬私密交件，不隨 repo 推送。

## 4. 進階：需要實測網站功能時

網址自查完成且資源都已找到時，會自動產生 `artifacts/final-check/resources.local.json`。這份設定只供腳本後續使用，含自己資源名稱與寄件身分，留在本機且不進 Git；學生不用編輯；若自查在 CloudShell 跑，先下載這份檔案放回本機相同位置。

功能模式只需 Node.js，沿用這份自動設定；會建立測試資料，所以必須明確加旗標：

```sh
npm run check:flow -- --config artifacts/final-check/resources.local.json --allow-test-data
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

## 自動辨識的範圍

- 本作業的網址直接指向單一 EC2；CloudFront／ALB 或多個 DNS IP 會列無法辨識。
- RDS 依同 VPC 找候選；S3／ECR／SES 依 EC2 Role 明列的資源找候選。這只是確認要查哪個資源，實際容器是否使用它們仍由主機檢查或現場抽查核對。
- 共用 Role／萬用資源權限不足以判定唯一 Bucket；不掃整個帳號猜測，也不自動增加權限。
- SSH 可自動檢查是否只開單一 IPv4 `/32`；無法從 CloudShell 判定它是不是你電腦的 IP，這一點現場核對。
- 多個候選要在互動終端選擇；直接 Enter 可暫略，該項保持無法檢查。無人操作的 CI 也不會自動選第一個。
- 老師處理特殊部署時仍可使用 `--config deploy/check-final.local.json` 與範例設定；一般學生從網址入口開始即可。

## 查詢權限與常見問題

檢查者使用的是自己的 CLI／CloudShell 身分，**不要把查詢權限加到 EC2 執行 Role 來讓腳本變綠**。沒有權限時先與老師確認 W2 操作身分；本工具不自動建立或套用 IAM Policy。

| 服務 | 本工具呼叫的只讀 API／需要對應查詢權限 |
|---|---|
| STS | GetCallerIdentity |
| EC2 | DescribeInstances、DescribeImages、DescribeAddresses、DescribeSecurityGroups、DescribeRouteTables |
| RDS | DescribeDBInstances |
| IAM | GetInstanceProfile、ListRolePolicies、GetRolePolicy、ListAttachedRolePolicies、GetPolicy、GetPolicyVersion；僅查網站 EC2 掛載的 Role |
| Budgets | DescribeBudgets、DescribeBudget、DescribeNotificationsForBudget（IAM 動作對應 `budgets:ViewBudget`） |
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

- [IAM GetRolePolicy](https://docs.aws.amazon.com/cli/latest/reference/iam/get-role-policy.html)、[Budgets DescribeBudgets](https://docs.aws.amazon.com/cli/latest/reference/budgets/describe-budgets.html)：網址入口的唯讀資源辨識。
