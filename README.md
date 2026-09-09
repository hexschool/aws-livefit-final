# LiveFit AWS 最終作業（老師完成版）

從已完成的 Node.js 健身房解答 `solution@ebde8b4` 改造，接上每週 Notion 教的服務。學生使用這份完成程式練習 AWS 設定、部署與驗證。

- [AWS 線上示範](https://13.196.54.138.nip.io)：2026-09-09 部署的老師實機；保留期間才可連線。
- [私密完整解答](https://github.com/hexschool/aws-livefit-final)：需取得 hexschool 存取權；含前後端完成程式，不是待填空的起始版。
- [每週 Notion 對照](docs/notion-alignment.md)：來源段落、實際功能、差異依據。
- [AWS 部署準備](deploy/README.md)：W1～W12 的相依條件與操作入口。
- [驗證結果](docs/validation.md)：本機、真實 AWS 已通過與待驗證分開記錄。
- [瀏覽器操作紀錄](docs/browser-operations.md)：Console、網站與終端操作分開逐筆追加。

## 本機預覽

需要 Docker Compose 與 Node.js 20.19+（正式映像用 Node.js 24）。在專案根目錄：

```sh
npm ci
npm --prefix backend ci
# 僅建立本專案的本機容器；不連線至 AWS。
docker compose up -d --build --wait
node backend/scripts/init-local-aws.js
docker compose exec backend npm run db:seed
```

開啟 <http://localhost:3080>，註冊會員後，可在教練資格管理上傳照片、升級教練，再登入編輯檔案與開課。另一個會員可購買堂數並報名，觸發 SES 通知。

本機 S3／SES 由 Moto 模擬，**不會真的寄出郵件**。照片可用真正 SDK、HTTP PUT／GET 跑完整路徑；IAM／Bucket Policy／SES Sandbox 等 AWS 約束仍須到 AWS 逐項驗證。

```sh
API_BASE_URL=http://localhost:3080 npm run test:contracts
API_BASE_URL=http://localhost:3080 npm run test:aws
```

停止本機環境並保留 PostgreSQL 資料：`docker compose stop`。Moto 的物件／郵件模擬狀態只在記憶體，重建後需重跑初始化與照片測試。

## 功能與保存方式

- 教練照片：私有 S3、預簽名 PUT／GET；DB 保存物件 key，讀取時重新簽名。上傳前登入、限制格式／2 MB、後端檢查檔頭；照片尚未完成不能儲存。
- 資料：PostgreSQL／RDS；正式模式驗證 TLS 憑證，禁止啟動時自動 synchronize。`db:init` 只接受空資料庫，既有資料庫需先規劃 migration。
- 通知：SES SendEmail；報名存檔後寄信，回應分為 accepted／failed／disabled，accepted 不代表信箱已收到。
- 部署：同一個 ARM64 映像包含既有前端與後端，W10 以單一容器運行，W11 主機 Nginx 反代／Certbot。網站 `/api/` 同網域。
- 維運：readiness DB 檢查、JSON 日誌、容器重啟設定；W12 對應 CloudWatch Agent／Dashboard／Alarm／SNS。

原 Node.js 解答與 Notion 講義保留原樣。AWS 版已於東京部署 EC2／S3／RDS／SES／ECR／Nginx HTTPS；CloudWatch／SNS 尚待實機驗收，不把準備範本視為完成。完整狀態見驗證紀錄。

網站的「購買堂數」只寫入教學資料庫，沒有串接金流、不會扣款。SES 在 Sandbox：測試收件地址須完成驗證；本次獨立測試信已送達垃圾郵件，實際報名通知尚待驗證。測試請使用自己的信箱，不填他人的地址。

原題的技能／方案管理端點仍為教學用公開管理方式，不能據此當成對一般客戶公開營運的商用授權模型。AWS 版新增的照片功能必須登入；教練升級改為只能操作本人，原合約測試 helper 已依此調整。課程學生不需重寫這些後端功能。
