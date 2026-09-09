# Notion 各週環節 → AWS 版最終作業對照

這份專案由 Node.js 完成解答 `solution@ebde8b4` 改造。目的是讓原有健身房功能使用課程所教的 AWS 服務。學生沿用完成程式，練習的是設定、部署、驗證與排錯。

**查核範圍**：2026-09-09 讀取本機匯入的 12 份 Notion `learn.md` 實務段落、相關原 AWS 範例程式、現行 `course/decisions.md` 與各週 README；本次另重看 W10 原始整合架構圖。不是線上 Notion 最新版同步，也不是全部 301 個圖位逐張完成複核。

對照表列出來源實務環節與可定位的程式／設定，不能將「有對應檔案」當成「AWS 已驗證」。實測狀態見 [驗證紀錄](validation.md)；瀏覽器逐步紀錄見 [操作紀錄](browser-operations.md)。

| 週次 | Notion 來源環節 | LiveFit 如何承接 | 程式／設定 | 要驗證的結果 |
|---|---|---|---|---|
| [W1 帳號與費用](https://gonsakon.github.io/aws-course-hub/#/weeks/01-account-and-cost/learn) | 預算警示、帳單／Cost Report、付款設定 | 沿用同一帳號的 Tokyo 區域與既定 US$30 預算；費用環節用這份專案建立的資源回查，不在網站增加付款功能。 | 後續 Console 操作與費用紀錄 | 實際與預測門檻、帳單與資源使用可對應；付款不重複設定 |
| [W2 IAM](https://gonsakon.github.io/aws-course-hub/#/weeks/02-iam/learn) | User Group、User、Role、Policy 與套用關係 | 沿用 backend-engineers 群組與個人操作身分；W10 的 EC2 Role 承接 W2 角色概念。 | deploy/iam/ec2-trust.json；deploy/iam/livefit-app-policy.json | 操作身分與 EC2 Role 分開；允許／拒絕案例要由實際權限驗證 |
| [W3 VPC](https://gonsakon.github.io/aws-course-hub/#/weeks/03-vpc/learn) | VPC、跨 AZ Subnet、Public／Private Route Table、IGW | 使用既有 livefit-vpc；EC2 位於 Public Subnet、RDS 位於 Private Subnet，W7 補第二個 Private Subnet。 | deploy/README.md 的網路前置 | Public route 到 IGW；Private route 不直出公網；DB subnet group 跨至少兩個 AZ |
| [W4 SG 與 NACL](https://gonsakon.github.io/aws-course-hub/#/weeks/04-vpc-security/learn) | Web SG、DB SG 來源參照、SSH；原稿另建 NACL 與 EC2 | 沿用 livefit-web-sg／livefit-db-sg；443／80 對外、22 限 My IP，5432 來源只用 web-sg。 | deploy/compose.aws.yml 僅綁定 127.0.0.1:8080；deploy/nginx/livefit.conf | EC2 連 DB 成功；外部不能直連 DB／8080。NACL 依既定決策只看不做 |
| [W5 EC2](https://gonsakon.github.io/aws-course-hub/#/weeks/05-ec2/learn) | Ubuntu、ARM、t4g.micro、SG、Key Pair、EIP、SSH；另有 EBS／AMI／DLM | 部署主機與映像平台配對 linux/arm64；沿用 W3／W4 網路與 SG。 | Dockerfile；deploy/compose.aws.yml | SSH、EIP 與資料保存逐項留證；本次依使用者要求維持開機，stop/start 未做；EBS／AMI／DLM 範圍差異見下表 |
| [W6 S3](https://gonsakon.github.io/aws-course-hub/#/weeks/06-s3/learn) | 私有 Bucket、權限、版本、CLI／Node 列物件、預簽名 GET／PUT | 健身房教練照片使用同一私有 Bucket；資料庫保存 object key，顯示時產生臨時 GET URL；瀏覽器依 PUT URL 上傳。 | backend/services/photos.js；backend/scripts/check-service.js s3；deploy/s3-cors.json | 列物件、PUT 上傳、GET 顯示、未授權被拒絕；practice/ 同名物件覆寫驗證版本 |
| [W7 RDS](https://gonsakon.github.io/aws-course-hub/#/weeks/07-rds/learn) | PostgreSQL 17、t4g.micro、gp3 20 GiB、備份 3 天、SG／Subnet、私有／公有對照 | 健身房會員、教練、課程、堂數與報名存入 Private PostgreSQL 17；獨立 SQL 連線驗證後初始化空 DB。 | backend/config/db.js；backend/scripts/init-db.js；backend/scripts/check-service.js rds | 確認 SQL 查詢、業務寫入與重啟後資料保留；實例與 3 天備份已由 Console 核對，還原尚未實測 |
| [W8 SES](https://gonsakon.github.io/aws-course-hub/#/weeks/08-ses/learn) | Email／Domain Identity、發信權限、Node.js 寄測試信 | 先用獨立 Node.js 命令寄測試信；整合後由健身房報名觸發通知，失敗不取消已成功的報名。 | backend/services/notifications.js；backend/scripts/check-service.js ses | SES 接受請求、信箱實際收到分開驗收；失敗有記錄且報名保留 |
| [W9 ECR](https://gonsakon.github.io/aws-course-hub/#/weeks/09-ecr/learn) | Private Repository、讀寫權限、Docker build/tag/push | 單一 LiveFit 私有儲存庫，應用映像以固定 tag 推送；同一映像帶既有前端與後端。 | Dockerfile；deploy/README.md 的 W9 指令 | 映像平台 ARM64、ECR 有指定 tag／digest；讀取角色不取得 push 權限 |
| [W10 容器部署](https://gonsakon.github.io/aws-course-hub/#/weeks/10-container-deploy/learn) | 部署用 Linux User、EC2 Role、ECR pull、單容器、Compose、環境變數、RDS／S3／SES | 以既有服務容器化流程部署 LiveFit；EC2 Role 提供 SDK 憑證，Compose 只啟動一個 app，資料庫改 RDS。 | deploy/compose.aws.yml；deploy/.env.aws.example；backend/services/aws.js | 在 EC2 內確認 /ready、資料讀寫、S3、SES；Docker 重啟與固定版本回復 |
| [W11 Nginx／HTTPS](https://gonsakon.github.io/aws-course-hub/#/weeks/11-nginx-https/learn) | DNS／nip.io、Nginx 反代、Certbot、HTTPS、續期 | 沿用原稿主機 Nginx／Certbot 路徑，proxy_pass 改為 W10 容器的 localhost:8080；前端與 API 同網域。 | deploy/nginx/livefit.conf；deploy/README.md 的 W11 指令 | 外部瀏覽器登入／報名、HTTP 轉 HTTPS、有效憑證、續期 dry-run；80 保留 ACME 路徑 |
| [W12 CloudWatch](https://gonsakon.github.io/aws-course-hub/#/weeks/12-cloudwatch/learn) | 原課程含 Dashboard、告警、SNS、Agent | **依 2026-09-09 使用者決定，不納入本版最終作業。** | 原參考範本保留但不套用 | 不建立、不列為學生必交、不納入自查腳本 |

## 來源差異有依據，不自行混成新課程

以下沿用 [已確認決策](https://gonsakon.github.io/aws-course-hub/#/decisions)；來源保全檔不修改。

| 原 Notion 或舊範例 | 本專案採用方式與原因 |
|---|---|
| S3 寫 Taipei、示範公開 ACL；Bucket 名稱 test | 全期 Tokyo；私有 Bucket＋Presigned URL。Bucket 使用各帳號自訂唯一名稱；保留「未授權存取會被拒絕」與版本練習。 |
| IAM／ECR／SES 範例建立多個 User 與長期 Key | 沿用已定個人 IAM User／群組權限；EC2 使用 Role。保留讀取／寫入／寄信權限的學習目標。 |
| W4 建 NACL／EC2，W5 掛 DB SG | W4 NACL 只看，EC2 留 W5；主機掛 Web SG，RDS 掛 DB SG，以 SG 來源參照連通。 |
| W5 AMI、EBS 擴容、DLM | EBS 概念留主線，掛載擴容與 AMI 是讀物，DLM 實作依已定決策不做。不為應用額外設計快照系統。 |
| W7 要各建私有／公有 RDS | 使用已決定的 Private RDS。公有 DB 保留為觀念比較，不建立第二個計費資料庫。 |
| W10 舊圖把 Nginx／Certbot 包在容器、W11 文字則安裝在主機 | 依 W10 README「單一 LiveFit Container」及 W11 的 Nginx／Certbot 步驟，先準備主機 Nginx 代理容器版本；沒有建立第二套雲端架構或改寫課程決策。 |
| W11 tar/scp、原生 Node、Zellij | 依 v3 已定不教原生部署；保留 DNS／Nginx／Certbot／nip.io。 |
| W12 原稿 CPU／Agent | 本版最終作業已取消監控範圍；原講義與參考範本保留，沒有追加部署或驗收要求。 |

## 原 AWS 範例沿用關係

- `course-of-aws/src/week5s3/s3.service.js` → 使用相同 SDK v3 的 List／Put／Get＋getSignedUrl，連到教練照片與獨立 W6 練習命令。
- `course-of-aws/src/week7ses/ses.service.js` → 使用相同 SES SendEmailCommand，連到 W8 測試信與實際報名通知。
- `course-of-aws/src/week11containerize/` → 保留 Docker／ECR／Role／env 的部署概念，舊真實帳號、域名與 3000 port 改為填寫欄位／8080。
- S3 key 持久保存、上傳驗證、通知失敗分離與 TLS 驗證，是老師端將既有範例接入真實功能的必要處理，不另列學生必寫的後端作業。

## 本次來源指紋

用於後續發現本機 Notion 匯入內容是否改版；不是完整課程審稿的證明。

| 來源 | SHA-256 |
|---|---|
| weeks/01-account-and-cost/learn.md | `60f00cdcedaa049feb9fb44098709525aa246eed6195be777655ae6b13d1aa03` |
| weeks/02-iam/learn.md | `edf01a4c616a58be2ade5ce37f6fc04ad3bd4b7acf8453c98482b39c7534516d` |
| weeks/03-vpc/learn.md | `00456ec1323b5bd62250aad6f481d4945f557ae3432f9639d0d0e921397fab70` |
| weeks/04-vpc-security/learn.md | `3cf0df1c4ed9e6d7df8839500939d749a0a681056ee63a1215517da0de73d99b` |
| weeks/05-ec2/learn.md | `e39f216f4eb156531fbf3593f9c8ea4d62374873e6767beaf7a2d817e4041eb5` |
| weeks/06-s3/learn.md | `220d543864dfbeaacf5ffaa597889abbcab14fb416369c47f0ebc090d6652488` |
| weeks/07-rds/learn.md | `dba4b9876609be5563e25f3f873b7cce684d6637ab32065a6f9022765369aab1` |
| weeks/08-ses/learn.md | `d9577ec87c92b662ec7dd15e78d2643e264b9988d6b1fb4e6f0e9fd4215f284f` |
| weeks/09-ecr/learn.md | `bdb67db53e4943f54c75f941180cc88414e450324bfea23590cc297752bdefba` |
| weeks/10-container-deploy/learn.md | `7472fb1b1eb200db3170eee3959b369b3821f04e1c77f2fa1d5e1617b187e455` |
| weeks/11-nginx-https/learn.md | `14c037ad619484ce197ed08b484862bb7994ef74747f0d3de55004f5f75cd2a9` |
| weeks/12-cloudwatch/learn.md | `f82d106ae6aadb2ae6fe721377d92a95d132228fb361e88ca81933056c09ba59` |
