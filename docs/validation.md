# AWS 版驗證紀錄

查核日期：2026-09-09。老師示範已部署至 [HTTPS 網站](https://13.196.54.138.nip.io)，[readiness](https://13.196.54.138.nip.io/ready) 會實際查詢 RDS。此文件記錄當次結果，不能保證未來服務持續運行。

## 本機已通過

- Docker 映像建置、前端編譯、ARM64 平台、PostgreSQL 17 啟動。
- 原有合約 66／66；新增 AWS 整合 8／8（Moto），包含 SES 成功與失敗、S3 HTTP 上傳／讀取與授權邊界。
- 真實檔頭與大小檢查；拒絕未登入、他人的 key、未完成上傳；DB 保存 key 而非臨時 URL。
- 預簽名 PUT 的 checksum 與 Content-Type 回歸驗證通過。
- SES 失敗仍保存報名；accepted 不等於實際收到信。
- AWS Compose、IAM／CORS／CloudWatch JSON 可解析；Nginx 設定檢查通過。
- 正式模式要求 RDS TLS 憑證驗證，禁止 DB_SYNCHRONIZE=true。
- 後端正式依賴當次 npm audit：0 vulnerabilities。

## 真實 AWS 已通過

| 範圍 | 當次證據與結果 |
|---|---|
| W3／W4 網路 | 沿用同一 VPC；EC2 Public Subnet／web-sg，RDS Private Subnet／db-sg；5432 的來源是 web-sg，SSH 22 限 My IP /32。外部 8080 連線逾時。 |
| W5 主機 | livefit-final；Ubuntu 24.04.4 ARM64、t4g.micro、8 GiB gp3、CPU credit Standard、EIP 13.196.54.138。SSH、三項 EC2 狀態檢查通過。IMDSv2 Required，hop limit 實際為 2。 |
| W6 照片 | 真實瀏覽器完成登入、照片上傳、儲存、再次讀取；圖片來自本次 S3，naturalWidth=596。Bucket 保持私有、Block Public Access 開啟；CORS 只允許本次 HTTPS Origin。 |
| W6 版本與拒絕 | practice/ 同名物件上傳兩次，VersionId 不同、讀到 revision 2；未簽名讀取該存在物件得到 HTTP 403。 |
| W7 資料庫 | PostgreSQL 17.11、db.t4g.micro、20 GiB gp3、Single-AZ、Public access=No；兩個不同 AZ 的 Private Subnet。SQL 連線的 pg_stat_ssl 顯示 TLSv1.3，客戶端驗證憑證。 |
| W7 備份 | Console 顯示自動備份 3 天，當日自動快照 Available；沒有實際還原資料庫。 |
| W8 寄信 | 一封已獲批准的獨立 SES 測試信獲服務接受；信箱搜尋找到相符內容，位於 SPAM。Console 顯示 Tokyo Sandbox、當日已用 1 封。 |
| W9 映像 | 操作者 push 至 private livefit:aws-v1 成功；Console 與 push 回傳的 digest 相同：sha256:ff3154a915ea1563fe47bf5a9b9dff5e165e4e8f75bc761318e9ea4483a17ffc。 |
| W10 Role | EC2 Role 拉取該映像成功；嘗試 ECR InitiateLayerUpload 被 AccessDenied 拒絕，確認運行角色沒有上傳權限。應用不放長期 AWS Key。 |
| W10 容器 | deployer 專用 SSH、公鑰、Docker 群組，未加入 sudo；單一 app 綁 127.0.0.1:8080。空庫 init／seed 成功，/ready=ready。 |
| W10 業務與持久化 | 瀏覽器註冊／登入、升級本人教練、編輯資料、上傳照片、建立課程、另一會員模擬購買 3 堂成功；容器重啟後 Healthy，教練／照片／課程仍在。當次 SQL：2 users、1 coach、1 course、1 purchase。 |
| W11 HTTPS | 外部 HTTP 301 到 HTTPS、HTTPS 200、TLS 憑證有效；Certbot 憑證到期日 2026-12-08，renew dry-run 成功、timer active。 |

## 未通過或尚待驗證

- 真實網站報名成功後的 SES 通知尚未測；本機合約通過不能代替雲端業務路徑收信。
- W12 CloudWatch Agent／Dashboard／Alarm／SNS 尚未建立驗收；已準備設定與存取範圍，等待使用者回覆。不得寫成已監控或已收到告警。
- S3 在允許前綴以外用不存在物件測試，收到 NoSuchKey；這個探測不足以證明 IAM 拒絕，未記為通過。
- 預簽名 URL 自然到期、RDS 還原、映像回復版本尚未實測。
- W1 預算與費用需於教學前重新回查；不把講義 US$30 預算當成帳號實況已驗證。
- GitHub Actions 的遠端結果另看該次 workflow；上述 66＋8 是本機結果。
- 尚未由克庭獨立部署，也未完成計時彩排／清除驗證，教材不得標 READY。

## 資源保留決策

- 使用者要求「不用停」：EC2 維持 Running，未執行 stop/start；只重啟 app 容器。
- EC2、RDS、EIP、EBS、S3 版本、ECR 持續保留供查看；未刪除其他既有主機或共用網路。
- 當次 RDS Console 建立估算約 US$21.01／月，僅為 RDS 當時估算，不含 EC2、IPv4、儲存、流量等；不保證免費。重新開課需重查即時報價與帳單。
- 清除須在驗收與保留需求結束後，依實際資源清單逐項處理；關閉 EC2 不等於其餘資源停止計費。

操作細節見 [瀏覽器與終端紀錄](browser-operations.md)。紀錄不含密碼、私鑰或預簽名 URL。
