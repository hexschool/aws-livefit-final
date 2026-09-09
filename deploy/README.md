# 按 Notion 週次準備 AWS 部署

這是老師版專案操作入口，尚非已完成彩排的學生講義。逐項來源見 [Notion 對照表](../docs/notion-alignment.md)。下面提供可重做的指令；老師於 2026-09-09 已完成 W5～W11 主要部署，實測與未完成項目見 [驗證紀錄](../docs/validation.md)。學生須換成自己帳號的資源，不能照抄老師的 IP、Bucket 或身分。

## W1～W5：沿用同一個帳號與網路

| 週次 | 本專案需要的既有成果 |
|---|---|
| W1 | Tokyo ap-northeast-1；沿用已定 US$30 Budget，Actual／Forecasted 100%；費用由本專案資源回查。 |
| W2 | 個人 IAM User → backend-engineers → 當週 Policy；EC2 Role 留到 W10 附加。 |
| W3 | livefit-vpc 10.0.0.0/16；Public Subnet 與通向 IGW 的路由；Private Subnet 只有 local 路由。 |
| W4 | livefit-web-sg：80／443 對外、22 My IP；livefit-db-sg：5432 來源 web-sg。 |
| W5 | Ubuntu ARM／t4g.micro、Key Pair、SSH、EIP；沿用 Public Subnet／web-sg。映像選 linux/arm64，不混用 amd64。 |

停機與清除依課程既定成本紀律逐週做。EIP／EBS／快照與 S3 版本都要另查，不能把關閉 EC2 當作資源全部不計費。

## W6：S3 獨立操作，再連到教練照片

依 Notion 建立唯一名稱的私有 Bucket，Region 改用已定 Tokyo；保持 Block Public Access，Object Ownership 採 Bucket owner enforced。開啟版本管理，以 `practice/` 同名檔案重複上傳觀察版本；不把 Bucket 改公開。

原 AWS 範例的 List／GET／PUT 已保留為獨立 Node 命令。在 backend 目錄設定 S3_BUCKET、AWS_REGION，使用已授權的暫時憑證／EC2 Role。正式測試移除 AWS_ENDPOINT_URL 與本機假憑證。

```sh
node scripts/check-service.js s3 list
node scripts/check-service.js s3 upload practice/photo.png /PATH/TO/photo.png
node scripts/check-service.js s3 get-url practice/photo.png
node scripts/check-service.js s3 put-url practice/photo.png
```

PUT URL 可依 Notion 交給 Postman：PUT、Content-Type image/png、Body 選 binary。讀取／寫入權限分別驗證，CLI 不支援的能力不能誤解成 S3 不支援。簽名 URL 是臨時存取憑證，不寫入瀏覽器操作紀錄。

網站整合時，把 `s3-cors.json` 中 YOUR_DOMAIN 換成實際網站來源，再套用 Bucket CORS。CORS 允許瀏覽器跨來源，不會賦予 IAM 權限。尚未啟用 HTTPS 前，測試用 Origin 需是當下實際網址；完成後移除舊測試 Origin。

## W7：Private PostgreSQL 17

依原實務環節核對 PostgreSQL 17、db.t4g.micro、gp3／20 GiB、自動備份 3 天、Database Insights Standard；最後可用版本與費用需在當下 Console 核對。採既定 Private／Single-AZ，Public access=No，套用 db-sg。DB Subnet Group 需要不同 AZ 的兩個 Private Subnet，W7 補第二個，無須建立 NAT Gateway。

建庫後使用 EC2 到 RDS 的連線，不開放公網 5432。DB_DATABASE 是自己建立的 LiveFit database，與 RDS instance identifier 不同；建立 RDS 時填 initial database name `livefit`，或由 DB 用戶端建立。

- 網路：EC2 `nc -zv YOUR_RDS_ENDPOINT 5432`。
- SQL：設定環境後 `node scripts/check-service.js rds`；成功需真正查到 PostgreSQL。
- 初始化：W10 拉到映像後，以一次性命令 `npm run db:init` 只對空 DB 建表，再 `npm run db:seed` 建立技能與方案。
- TLS：下載官方 CA bundle 到 `deploy/certs/global-bundle.pem`，後端 `rejectUnauthorized=true`；以正確 RDS endpoint 驗證主機名稱，不用 IP 或關閉驗證來排錯。

```sh
mkdir -p deploy/certs
curl --fail --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  --output deploy/certs/global-bundle.pem
```

## W8：SES Identity 與測試信

在 Tokyo 驗證寄件 Email，Sandbox 也驗證收件 Email。沿用原 AWS 範例的 SES SDK SendEmailCommand；SMTP／Domain 是來源觀念，不另要求新 IAM User 或 Route 53。

在 backend 目錄使用已授權環境：

```sh
# SES_FROM_EMAIL、SES_TEST_TO 設為本人的已驗證信箱。
node scripts/check-service.js ses
```

先核對服務接受請求，再到信箱核對收到。W10 啟動後，會員以已驗證 Email 註冊、買堂數、報名課程，測相同模組的真實通知路徑。失敗時報名仍存在，請看 notification 欄位與日誌。

## W9：同一份 ARM Image → 一個 Private ECR Repository

先依 Notion 建立私有 `livefit` repository；操作者取得 push 權限，EC2 Role 只 pull。以下在有 Docker 與 AWS CLI 暫時登入環境的電腦執行。YOUR_ACCOUNT_ID 與 tag 請替換。

```sh
LIVEFIT_REGISTRY=YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
LIVEFIT_TAG=aws-v1
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin "$LIVEFIT_REGISTRY"
docker build --platform linux/arm64 -t "${LIVEFIT_REGISTRY}/livefit:${LIVEFIT_TAG}" .
docker push "${LIVEFIT_REGISTRY}/livefit:${LIVEFIT_TAG}"
```

核對 ECR 的 tag、digest、架構；下一版用新 tag，留下前一版供回復。老師本次已完成 push 與 EC2 Role pull，digest 記於驗證紀錄。

## W10：部署帳號、EC2 Role、單一 Container

1. 沿用 Notion 安裝 Docker／Compose、建立 Linux 部署 User 與 SSH key 的步驟；Linux User 和 AWS IAM User 是不同身分。
2. EC2 Role 使用 `iam/ec2-trust.json`。原 Notion 使用 AmazonEC2ContainerRegistryPullOnly；本次經批准將 ECR 拉取限制為單一 livefit repo，範本為 `iam/ecr-pull-policy.json`。把該範本與 `iam/livefit-app-policy.json` 的 Statement 合併為運行政策，替換 YOUR_ACCOUNT_ID／Bucket／Identity 後再套用；不要同時附加較廣的 ECR managed policy。
3. EC2 啟用 IMDSv2。Bridge 容器取用 Instance Role 時，確認 metadata response hop limit=2；不要以寫入長期 Key 取代。應用使用 SDK 預設 credential provider chain。
4. 準備本資料夾與 CA bundle。`.env.aws.example` 另存 `.env.aws`，填好值並 `chmod 600 deploy/.env.aws`；不保存 Git。
5. 以 ECR 登入命令登入主機 Docker，再從專案根目錄執行：

```sh
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml pull
# 以下初始化僅對全新空的 livefit 資料庫執行一次。
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml run --rm backend npm run db:init
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml run --rm backend npm run db:seed
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml up -d
curl --fail http://127.0.0.1:8080/ready
```

本次部署選擇主機內 curl，與現有 SG 開口相容；是否在 W10 對學生開臨時外部 8080 仍是課程待決策，這裡不改 SG。要先看畫面，可用 SSH tunnel 將本機 3080 轉到主機 localhost:8080。

驗證：註冊／登入／資料讀寫；分別測圖片與通知；`docker compose ... restart backend` 後資料仍在 RDS。回復版本用前一個 LIVEFIT_IMAGE tag 再 pull/up；應用回復不等於可安全回復 DB schema。

## W11：Nginx 反代、nip.io、Certbot

依 W11 原稿 Ubuntu Nginx／Certbot 步驟，代理目標改為 W10 容器 port。單一 app image 帶既有前端，瀏覽器不再指向使用者電腦的 localhost API。

1. 以 EIP 組出 `YOUR_EIP.nip.io` 或自己的網域，DNS 必須解析到該 EC2。
2. 安裝 Nginx、Certbot、python3-certbot-nginx。
3. 將 `nginx/livefit.conf` 的 YOUR_DOMAIN 改成實際域名，放至 `/etc/nginx/sites-available/livefit`，連結到 `sites-enabled`，先跑 `sudo nginx -t` 再 reload。
4. 確認外部 HTTP 可達後，依原稿 `sudo certbot --nginx -d YOUR_DOMAIN --redirect` 完成憑證與轉址；Email／條款由實際操作者填答。
5. `sudo certbot renew --dry-run` 驗證續期，確認主機 Certbot timer 的運行狀態。80 保持可達供 HTTP-01 與轉址。

正式外部瀏覽器驗收：首頁、登入、教練照片、購買堂數、報名、HTTP→HTTPS 與憑證。主機 curl 不能替代這一步。

## W12：監控、告警、恢復與清除

[CloudWatch 準備](cloudwatch/README.md) 對應原稿的 EC2／RDS Dashboard、SNS、CPU／DB 告警與 Agent 指標。先記下實際 InstanceId／DB identifier，依範本核對指標解析度與單位，不直接套原稿錯誤值。

最後按實際建立清單回查 EC2、EIP、EBS、RDS 與快照、S3 物件所有版本、ECR images、CloudWatch logs／alarms、SNS，依課程要求逐項清除與確認費用。不要刪除其他專案共用資源；這次沒有執行清除命令。

## 技術校正依據

- [AWS SDK v3 預設憑證](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)
- [EC2 Metadata options 與容器 hop limit](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html)
- [RDS VPC／DB Subnet Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html)
- [S3 預簽名 URL 與到期](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [EC2 CloudWatch 原生指標解析度](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/viewing_metrics_with_cloudwatch.html)
