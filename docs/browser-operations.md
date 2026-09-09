# AWS 最終作業：瀏覽器操作紀錄

這是本專案瀏覽器操作的持續紀錄，供回查與整理教學步驟。時間採 Asia/Taipei（UTC+08:00）。

## 記錄方式

- 每次讀取頁面、切換分頁、點擊、填寫、送出、下載或截圖，都依實際執行順序追加紀錄；同一流程的連續操作逐步列出。
- 每筆包含時間、頁面／服務、目的、步驟與非機密設定值、結果與驗證方式。失敗、重試、取消與待確認也要保留。
- 會更動 AWS 資源的送出動作，先記下預定變更，操作後補上結果；「已填寫」不等於「已建立」。
- 密碼、Access Key、Secret Key、Session Token、Cookie、驗證碼、簽名網址與其他認證資訊不寫入。網址移除敏感參數；若有截圖，分享前先確認不含機密。
- 使用者提供的狀態與我親自讀取的頁面分開標示。只補記有證據的舊操作，不推測點擊步驟。
- 本檔由我在每次操作時更新；目前不是能側錄使用者滑鼠或其他代理操作的背景程式。

## 起始狀態

- 建立時間：2026-09-09T06:57:46+08:00
- 使用者表示已開啟 IAM；尚未由我讀取該分頁，因此登入身分、權限、頁面內容與資源狀態都未確認。
- 目前工作：將 Node.js 解答專案改為涵蓋 Notion 課程服務的 AWS 版本。AWS 實際操作依後續指定步驟進行。
- 本紀錄建立前的瀏覽器歷史尚未逐筆整理，不視為完整操作軌跡。

## 操作紀錄



<!-- 每筆追加格式：
### B001｜ISO 8601 時間｜簡短操作名稱
- 頁面／服務：頁名與去除敏感資訊的網址
- 目的：這一步要完成什麼
- 操作：依序列出真實點擊／輸入／讀取；敏感輸入只記欄位名稱
- 結果：成功／失敗／待確認；實際看到的狀態
- 驗證／證據：頁面提示、資源狀態或經檢查的截圖路徑
-->

### B001｜2026-09-09T07:15:42+08:00｜開啟 AWS 版本機預覽
- 頁面／服務：LiveFit，http://localhost:3080
- 目的：以瀏覽器檢查打包後的前端與登入／照片流程。
- 操作：使用 Codex 內建瀏覽器開啟新的本機預覽分頁。
- 結果：成功，已開啟分頁 12，標題 LiveFit+。
- 驗證／證據：頁面顯示首頁、導覽與註冊入口。

### B002｜2026-09-09T07:17:02+08:00｜展開首頁選單
- 頁面／服務：http://localhost:3080/
- 目的：確認小視窗的導覽入口可操作。
- 操作：選取本機分頁 12；點擊 Toggle menu；讀取頁面結構。
- 結果：成功，出現「尋找教練」「健身方案」「立即加入」。
- 驗證／證據：「立即加入」連結指向 /login。

### B003｜2026-09-09T07:18:02+08:00｜開啟登入表單
- 頁面／服務：http://localhost:3080/login
- 目的：驗證原有會員入口。
- 操作：點擊導覽「立即加入」，讀取登入頁面。
- 結果／驗證：成功；看見電子郵件、密碼與登入按鈕。

### B004｜2026-09-09T07:18:02+08:00｜開啟註冊表單
- 頁面／服務：http://localhost:3080/signup
- 目的：驗證原有會員入口。
- 操作：點擊「立即註冊」，讀取表單。
- 結果／驗證：成功；看見電子郵件、密碼、再次輸入密碼、暱稱。

### B005｜2026-09-09T07:18:02+08:00｜註冊本機測試會員
- 頁面／服務：http://localhost:3080/signup
- 目的：驗證同網域 API 可完成註冊，準備教練照片瀏覽器測試。
- 預定操作：電子郵件填本機測試信箱；密碼與確認密碼填測試值（不記錄）；暱稱填「AWS 示範教練」；點擊註冊。
- 實際操作：依上述順序填寫並送出。
- 結果：成功，畫面顯示「註冊成功」，隨後自動轉至 /login。

### B006｜2026-09-09T07:19:21+08:00｜登入並查看會員導覽
- 頁面／服務：http://localhost:3080/login → /user/dashboard
- 目的：驗證註冊後可正常登入與讀取 DB 資料。
- 操作：重取分頁 12 控制與登入頁；填入本機測試會員信箱、測試密碼（值省略）；點擊登入；讀取會員專區；點擊 Toggle menu。
- 結果：成功，看到「AWS 示範教練」、會員介面與 0 堂課資訊。
- 驗證／證據：頁面路徑 /user/dashboard。導覽未提供教練資格連結，下一步使用既有程式路由進入測試。

### B007｜2026-09-09T07:21:08+08:00｜進入教練資格頁並上傳照片
- 頁面／服務：http://localhost:3080/admin/promote-trainer
- 目的：實測 W6 的預簽名 PUT 上傳與 GET 預覽。
- 操作：依既有程式路由開啟教練資格管理；點擊「上傳教練照片」；檔案選擇器選取專案原有 `frontend/public/people-01.png`；讀取上傳狀態。
- 結果：成功，從「照片上傳中」轉為「照片已上傳，請儲存資料」，並顯示教練照片預覽。
- 驗證／證據：本機 Moto 儲存路徑，未上傳到真實 AWS；簽名 URL 不記入。

### B008｜2026-09-09T07:21:08+08:00｜填寫並準備保存教練資料
- 頁面／服務：http://localhost:3080/admin/promote-trainer
- 目的：確認圖片可連到既有教練資料。
- 操作：教學經驗填 3；簡介填「這是 AWS 最終作業的教練示範，照片使用課程的 S3 預簽名上傳流程。」
- 結果：已填寫；下一步點擊「立即升級為教練」，送出結果待確認。

### B009｜2026-09-09T07:23:16+08:00｜確認照片載入並保存
- 頁面／服務：http://localhost:3080/admin/promote-trainer
- 目的：區分上傳 API 成功、瀏覽器真正顯示圖片、DB 關聯保存三件事。
- 操作：讀取照片元素的載入狀態；擷取目前表單畫面；點擊「立即升級為教練」；讀取結果。
- 結果：圖片已載入（596×363）；送出成功，出現「您已成功升級為教練」提示，要求重新登入。
- 驗證／證據：本次工具回傳的表單截圖與成功提示；截圖沒有密碼或金鑰。

### B010｜2026-09-09T07:25:47+08:00｜重新登入教練並更新資料
- 頁面／服務：http://localhost:3080/login → /coach/profile
- 目的：驗證重新登入後，照片物件關聯與教練資料仍可從資料庫讀回。
- 操作：確認返回登入頁；填入相同本機測試帳密（密碼省略）；點擊登入；讀取教練管理頁；勾選「肌力訓練」；點擊「儲存」。
- 結果：成功，自動進入 /coach/profile，資歷與簡介保留、照片顯示；儲存後出現「已成功更新資料」。
- 驗證／證據：教練頁與成功提示。測試產生的隨機技能仍在本機 DB，交付預覽前會清理此次測試資料。

## 實際 AWS 操作（使用者已釐清要進帳號開機實作）

### B011｜2026-09-09T07:30:02+08:00｜接上使用者的 AWS Console
- 目的：依使用者最新指示，進 AWS 開機實作；本機穩定性測試只是前置工作。
- 操作：讀取已啟用瀏覽器分頁清單；找到 Chrome 原有 AWS 分頁；讀取該分頁；將瀏覽器工作命名為「AWS 最終作業實作」；點擊左側 Instances。
- 頁面／服務：https://ap-northeast-1.console.aws.amazon.com/ec2/home?region=ap-northeast-1#Instances:
- 結果：已登入東京 EC2 Console，IAM User 為 gonsakon-aws（帳號僅記末四碼 5764）；原先使用者提到的 IAM 分頁已切到 EC2。Instances 列表正在載入。
- 已更動資源：無，目前只有讀取與切換頁面。
- 後續：先盤點既有 EC2、VPC、SG，再依 Notion 建立主機；每次送出前記錄設定，送出後核對實際資源狀態。

### B012｜2026-09-09T07:32:20+08:00｜盤點 EC2 與課程安全群組
- 頁面／服務：東京 EC2 → Instances → Security Groups。
- 目的：承接既有課程環境，避免誤動舊專案或重建相同資源。
- 操作：讀取 Instances 清單；點擊左側 Security Groups；讀取群組表格；點擊 livefit-web-sg 的 ID 進入詳情。
- 結果：3 台舊主機 hexschool／hexschool-docker／shop 皆為 Stopped、t3.micro；本次未啟動它們。找到 livefit-web-sg（sg-0c8a35d000d5706e9）與 livefit-db-sg（sg-03aeea55a26897a1f），共同 VPC 為 vpc-0531c11092d194d44。
- 已更動資源：無。Web SG 有 3 條 inbound、DB SG 有 1 條 inbound，規則內容待詳情頁核對。

### B013｜2026-09-09T07:38:05+08:00｜W4 → W5：將 SSH 範例來源改為 My IP
- 頁面／服務：東京 EC2 → livefit-web-sg → Edit inbound rules。
- 操作：讀取 inbound；點擊 Edit inbound rules；展開第 1 條 SSH Source；選取 My IP；等候 Console 回填並讀取設定。
- 原值：SSH TCP 22 來源 203.0.113.10/32（文件範例）。
- 預定送出：只將 SSH 來源改成目前 My IP /32（實際 IP 遮蔽）；HTTP 80、HTTPS 443 均維持 0.0.0.0/0。
- 結果：表單已正確回填，尚未儲存；下一步 Save rules 後重新讀回驗證。

- 送出與驗證（2026-09-09T07:38:55+08:00）：點擊 Save rules；AWS 顯示 Inbound security group rules successfully modified。重新讀取 3 條規則，確認 SSH 是目前 My IP /32、HTTP 與 HTTPS 原值保留。

### B014｜2026-09-09T07:41:08+08:00｜W3 網路核對
- 操作：點擊 Web SG 的 VPC 連結（另開 VPC 分頁）；讀取 livefit-vpc 列表；第一次點詳情及勾選未生效，截圖發現 split panel 擋住資料列；點 Close panel 後重新點 VPC ID；勾選 Show all details；點 public subnet 節點；讀取 Resource map；回原 EC2 分頁點 Instances。
- 結果：livefit-vpc 10.0.0.0/16、DNS resolution Enabled；public-1a 10.0.0.0/24 與 private-1c 10.0.254.0/24。livefit-public-rt 有 1 subnet association／2 routes；livefit-igw 顯示 Internet routes to 1 public subnet，0 private subnets route to the Internet。
- 已更動資源：無。承接 W3 既有公有網路，無新增 NAT Gateway。

### B015｜2026-09-09T07:45:32+08:00｜W5 開機草稿：AMI 與名稱
- 操作：Instances → Launch instances；填 Name=livefit-final；點 Ubuntu；預設出現 26.04，依 weeks/05-ec2/learn.md:955 改選 Ubuntu Server 24.04 LTS；確認 AMI 變更提示（只覆寫未送出的表單 SG／volume 草稿）；展開 Architecture 選 64-bit (Arm)。
- 介面狀況：載入開機表單、AMI 切換及 ARM 選擇偶有 CUA/CDP timeout；每次先重新讀取頁面確認已生效才續做，沒有重複建立資源。
- 結果：仍是未送出的開機草稿；規格／金鑰／網路尚待完成，不代表主機已建立。

### B016｜2026-09-09T07:46:37+08:00｜W5 專用 Key Pair
- 操作：確認 ARM AMI 變更提示後，讀回 Ubuntu 24.04 ARM AMI ami-0fc0576e40d95c647；規格自動符合 t4g.micro。點 Create new key pair，填名稱 livefit-final，保留 RSA／.pem。
- 預定送出：建立此次主機專用 SSH 金鑰，下載到本機後限制檔案權限；不記錄私鑰內容、不納入 Git。
- 結果：已填表，待 Create key pair。

### B017｜2026-09-09T07:53:38+08:00｜金鑰確認與開機設定完成
- 操作：Create key pair 後 Console 自動選 livefit-final；本機 Downloads 未找到檔案。嘗試開下載紀錄頁遭瀏覽器 URL 安全政策拒絕，未繞過限制。曾本機產生替代 key 並開 Key Pairs 頁準備匯入，但使用者截圖指出原檔在 /Users/gonsakon/work/livefit-final.pem，隨即停止替代方案，沒有匯入第二組。
- 本機處理：驗證原下載私鑰格式，原檔與 ~/.ssh/livefit-final.pem 複本皆 mode 600；刪除僅本次生成、尚未使用的替代 key。未讀出／記錄私鑰內容。
- 開機表單操作：Edit network → 選 livefit-vpc；Console 自動選到 livefit-public-1a；選 Select existing security group → livefit-web-sg；重填 Name=livefit-final、Number=1；展開 Advanced details，Credit specification 改 Standard；確認 IMDSv2 required。
- 預定建立：Tokyo ap-northeast-1；Ubuntu 24.04 ARM ami-0fc0576e40d95c647；t4g.micro；key=livefit-final；VPC=vpc-0531c11092d194d44；subnet=subnet-0d3afd4c878470534（public-1a，10.0.0.0/24）；公有 IP Enable；僅 web SG sg-0c8a35d000d5706e9；1 顆 8 GiB gp3 系統碟；無 User data、無 IAM profile（Role 留 W10）。
- 費用讀值：Console Linux base 0.0108 USD/hour；未假定帳號免費資格。CPU Standard 是此次成本設定：用完累積點數會受限，不購買額外 CPU 點數。
- 狀態：主機設定完成，下一步 Launch instance。

### B018｜2026-09-09T07:54:53+08:00｜開機自動審核拒絕與來源釐清
- 操作：點 Launch instance 前被自動審核阻止，未真正送出。拒絕理由為「只套 Web SG，不符合原講義同時掛 DB SG」。沒有改走 CLI 或其他途徑繞過。
- 新增查核證據：aws-course-hub/weeks/04-vpc-security/README.md:21 明定「W5 主機掛 livefit-web-sg，W7 RDS 掛 livefit-db-sg」；同檔 :17–18 明定 DB inbound 5432 來源 web SG。course/decisions.md:35,42 記錄 v3 裁切與分別配置。原 learn.md 是保全的舊來源，該句已被新版定案取代。
- 官方交叉核對：https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/tutorial-connect-ec2-instance-to-rds-database.html 亦採 EC2 與 RDS 分別掛 SG、RDS inbound 參照 EC2 SG。
- 判斷：目前只掛 livefit-web-sg 符合最新版使用者定案；不為通過審核而多掛 DB SG。將依新增證據再次送出相同 Console 動作。

### B019｜2026-09-09T07:56:39+08:00｜W5 EC2 實際建立成功
- 操作：依新版課程證據重新點 Launch instance，本次通過審核；讀取 AWS 回應；點新主機 ID。
- 結果：AWS 顯示 Successfully initiated launch of instance，Instance ID=i-05a22fd9a58e62318。
- 已更動資源：實際建立 1 台 LiveFit EC2 及其系統 EBS；Running／status checks／EIP／SSH 待接續驗證。

### B020｜2026-09-09T07:59:40+08:00｜Running 驗證與固定 IP 配置草稿
- 操作：切到新主機詳情分頁，讀取 Running、t4g.micro、Ubuntu 24.04 arm64 AMI、standard CPU credit、IMDSv2 Required、專用 Key Pair、LiveFit public subnet。
- 讀回：private IPv4=10.0.0.160；初始自動公有 IP=52.193.45.62，尚無 EIP。
- EIP 操作：另一 EC2 分頁點 Elastic IPs，列表確定本區無 EIP；點 Allocate Elastic IP address；Add new tag，填 Name=livefit-final-eip；截圖核對 Amazon pool／network border group=ap-northeast-1。
- 預定送出：配置 1 個 Tokyo EIP，隨後只關聯本次 i-05a22fd9a58e62318。此為 course/decisions.md:35 的 W5 主線固定 IP 環節。

### B021｜2026-09-09T08:02:07+08:00｜EIP 配置成功與關聯草稿
- 操作：點 Allocate；讀取 allocated successfully；點 Associate this Elastic IP address；Instance 搜尋並選取 i-05a22fd9a58e62318 (livefit-final) - running；Private IP 選 10.0.0.160。
- 結果：EIP=13.196.54.138；Allocation ID=eipalloc-077ae063c1320d040；名稱=livefit-final-eip。
- 預定送出：關聯上述新 EIP → 本次 EC2／10.0.0.160；Allow reassociation 保持未勾選。未動其他機器。

### B022｜2026-09-09T08:04:06+08:00｜EIP／健康檢查／SSH 成功
- 操作：点 Associate；讀回 associated successfully；重新整理新主機詳情；點 Status and alarms。
- 結果：13.196.54.138 已關聯 i-05a22fd9a58e62318／10.0.0.160，Association ID=eipassoc-0a723221138f9a29d。System／Instance／EBS status 均 Check passed。
- 終端實作（非瀏覽器）：用 ~/.ssh/livefit-final.pem 連 ubuntu@13.196.54.138；uname -m=aarch64；Ubuntu 24.04.4 LTS；cloud-init status=done；根磁碟剩餘約 4.9 GiB。
- W5 生命週期驗證準備：SSH 寫入 /home/ubuntu/livefit-w5-persistence.txt，內容 livefit-w5-2026-09-09，先確認檔案不存在才建立。下一步只停止這次新主機，再啟動並驗證 EIP／檔案仍在。

### B023｜2026-09-09T08:05:49+08:00｜停開機測試審核與低風險查核
- 操作：主機詳情 Instance state → Stop instance，送出前被自動審核拒絕（服務中斷／未單獨授權停機）。仍為 Running，未改走 CLI 或 SSH shutdown。
- 新增證據：course/decisions.md:35 明定 W5 主線包含 stop/start 生命週期，使用者要求實作須與每週既定環節相扣。此目標是本次 07:55 才新建的空白練習主機。
- SSH 唯讀查核：ss -ltnp 僅 SSH 22 與本機 DNS 53；nginx／docker／postgresql 都 inactive；uptime 9 分鐘，沒有正在提供的應用網站或資料庫，也無他人既有工作負載。
- 風險界定：只暫停本次新建空白主機再立即啟動，保留 EBS 和 EIP，驗證本次測試檔；不影響三台舊專案。將附上述證據重試一次 Console stop 流程。

### B024｜2026-09-09T08:08:26+08:00｜停開機測試待使用者確認
- 結果：附上無應用負載證據後，第二次 Stop instance 仍被自動審核阻止，理由是需要使用者本人明確批准，不能以課程文件代替。沒有執行停止，也未改其他工具繞過。
- 已向使用者發出停後立即啟動的簡短確認；未回覆前保持 Running。其餘 EC2／EIP／SSH 成功結果不受影響。

### B025｜2026-09-09T08:09:38+08:00｜主機設定讀回與交付狀態
- 操作：收起 Instance state 選單，點 Security，等規則載入後讀回；再點 Storage；保留主機詳情分頁供使用者查看。
- Security 驗證：只有 sg-0c8a35d000d5706e9 (livefit-web-sg)；inbound 22 My IP /32、80／443 0.0.0.0/0；outbound All → 0.0.0.0/0。
- Storage 驗證：vol-0cd01a39df0b399a4，/dev/sda1，8 GiB，In-use／Attached，Delete on termination=Yes，未加密（此次 AMI 預設）。
- 當前狀態：主機 Running／EIP 關聯／SSH 成功；尚未安裝或部署完整 LiveFit 網站。stop/start 等待明確回覆，不以等待時間當同意；沒有進一步建立 S3、RDS、SES、ECR 或其他服務。

### B026｜2026-09-09T08:11:20+08:00｜使用者要求完成上線並維持開機
- 使用者最新指示：完成上線並提供可操作網址；「你不用停啦」。取消 W5 stop/start 測試，主機持續 Running。
- 接續範圍：依 W6 S3、W7 RDS、W8 SES、W9 ECR、W10 容器、W11 HTTPS、W12 監控完成實際部署與驗證。
- 操作：重新取得原 AWS 主機分頁，AWS Search 輸入 S3。

### B027｜2026-09-09T08:13:49+08:00｜W6 S3 私有 Bucket 草稿
- 操作：AWS Search 輸入 S3 → 服務 S3；列表原有 baoquan、myapp-prods-assets；Create bucket；填 livefit-final-5764-tokyo-20260909；Bucket Versioning 選 Enable。
- 預定建立：Tokyo、General purpose／Global namespace；ACL disabled／Bucket owner enforced；Block all public access 四項保持开启；SSE-S3；版本管理 Enabled。
- 相關終端操作：SSH 安裝 Ubuntu 套件 docker.io、docker-compose-v2、nginx、certbot、python3-certbot-nginx、unzip，對應 W10／W11，進行中。
- CLI 身分核對：本機已有 AWS CLI default profile，STS 證實同帳號（末四碼 5764）的 gonsakon-course-of-aws；Console 是 gonsakon-aws。後續 CLI 操作另列紀錄，未新增或匯出 Access Key。

### B028｜2026-09-09T08:29:58+08:00｜W6 已建立、W7 流程修正
- S3 結果：AWS 顯示 Successfully created bucket livefit-final-5764-tokyo-20260909；物件列表為 0。建立時設定為 Tokyo、ACL disabled、Block all public access、SSE-S3、Versioning Enabled。
- 終端操作（非瀏覽器）：EC2 安裝 docker.io、docker-compose-v2、nginx、certbot、python3-certbot-nginx、unzip 已成功結束；尚未部署應用容器。
- CLI 唯讀查核：本機既有 IAM User 無 RDS／SES／EC2 Subnet／ECR Describe 權限，未擴大該身分權限。
- 瀏覽器操作：開 CloudShell 面板；第一次以 fill 輸入未送入 terminal，改 typeText 後完成唯讀 inventory。確認本區 RDS 清單為空、PostgreSQL 17.11 可用、private route 只有 local、DB SG 的 5432 來源為既有 Web SG。沒有在 CloudShell 建立或修改資源。
- SES：讀到既有 email identity 驗證成功；使用者已同意沿用該信箱並寄一封測試到同信箱。尚未寄出。
- 撤回額外流程：曾準備含新密碼的本機建庫 JSON，點 CloudShell Upload file 後，檔案選取被自動審核拒絕；沒有上傳。使用者質疑是否符合 Notion，確認此上傳方式是額外自動化，不在講義流程。取消檔案選取並關閉 CloudShell；已刪除該未使用暫存 JSON，不記錄其內容。
- 回到來源：重新閱讀 W7 learn.md:98 的 Standard create／帳密／VPC／DB subnet group／Public access，以及 :1045 私有 PostgreSQL 實務要求。接續從 VPC／RDS Console 操作；本機部署 .env.aws 保持 Git ignored 與 mode 600。

### B029｜2026-09-09T08:32:43+08:00｜W7 第二個 Private Subnet 完成
- Console 操作：AWS Search → VPC → Subnets → Create subnet；選 livefit-vpc；Name=livefit-private-1a、AZ=ap-northeast-1a、CIDR=10.0.253.0/24；點 Create subnet。
- 結果：AWS 顯示 Successfully created 1 subnet，ID=subnet-0c5a38a6ad50f419c、Available、auto-assign public IPv4=No。
- 接續：選新子網 → Actions → Edit route table association → livefit-private-rt → Save；AWS 顯示已成功關聯 rtb-007611a5642b4b575，讀回確認。沿用 private route 只有 10.0.0.0/16 → local。
- 來源：course/decisions.md:39 明列第二個 Private Subnet 留 W7；沒有新增公有路由或 NAT。
- 下一步：AWS Search → Aurora and RDS，準備 DB subnet group。

### B030｜2026-09-09T08:43:11+08:00｜W7 DB Subnet Group 完成及 RDS 建庫表單
- RDS Console → Subnet groups → Create DB subnet group；名稱 livefit-final-db-subnets；VPC=livefit-vpc；只加入 private-1a 10.0.253.0/24 與 private-1c 10.0.254.0/24。點 Create 後讀到 Successfully created／Complete。
- Databases → Create database → Full configuration（新版入口，表單實際值為 standard，對應講義 Standard create）。選 PostgreSQL、Dev/Test、Single-AZ、17.11-R1、db.t4g.micro、gp3 20 GiB，關閉 storage autoscaling。
- 設定 livefit-final-db；master username／initial DB=livefit；Self managed＋Password authentication。沿用 livefit-vpc／livefit-final-db-subnets、Public access=No、只掛 livefit-db-sg、AZ=1a、5432、預設 RDS CA。
- Database Insights Standard／7 days、Enhanced Monitoring 關閉；加密開啟；自動備份 3 days；auto minor upgrade 開啟；無 Proxy、DevOps Guru、跨區備份或 Multi-AZ；Deletion protection 關閉以供課程清理。
- 帳密輸入：新密碼直接填入 RDS Console 的兩個密碼欄位；瀏覽器虛擬剪貼簿第一次貼上無資料，改原生 Chrome 貼上成功，畫面顯示遮蔽值與 Very strong。本機暫存剪貼簿已清除，不記錄密碼、不上傳設定檔到 CloudShell。
- 表单核對：DOM 密碼／帳號欄位讀值會遮蔽，改以畫面確認 master username=livefit。原先重複輸入造成 livefitlivefit 已更正為 livefit。
- 成本：Console 估算 DB 18.25＋storage 2.76＝21.01 USD/月；已告知使用者這只含 RDS，不含 EC2 等其他服務，亦未宣稱免費。
- 使用者詢問是否最低規格及密碼依據；回覆 micro 是該 RDS 最低級距，EC2 另有 nano；重新引用 W7 learn.md:202／497 的 Self managed 與 Password authentication。
- 狀態：表單設定已完成，尚未送出建立。

### B031｜2026-09-09T08:44:47+08:00｜W7 RDS 建立請求成功
- 操作：核對兩個密碼欄位保持遮蔽且 Very strong 後，點 Create database。
- AWS 回應：Creating database livefit-final-db；列表出現 1 instance、Status=Creating、PostgreSQL、db.t4g.micro、ap-northeast-1a、livefit-vpc、Multi-AZ=No。
- 本步已實際建立 RDS 請求；endpoint／Available／SQL 連線待驗證，不能稱資料庫整合完成。

### B032｜2026-09-09T09:00:42+08:00｜W9 ECR 映像上傳完成
- Console：AWS Search → ECR → Create repository；name=livefit、Private、Immutable、AES-256；讀到 Successfully created private repository。
- 終端：既有本機 CLI GetAuthorizationToken 與 Docker login 成功，未輸出 token；Image ID f8c574726a4f、arm64。首次 push 因 InitiateLayerUpload 未允許失敗，ECR 尚無 image。
- 來源核對：W9 learn.md:416 的 Repository policy，及 AWS repository-policy-examples。只對本次 livefit 設定既有 CLI 使用者 gonsakon-course-of-aws 的 7 個 push/pull actions，無 delete 或 repository 管理。
- 第一次 Save 被自動審核拒絕，要求本人批准。使用者明確回覆「可以，只授權 livefit 儲存庫」後才重試。API 隨後拒絕 Resource 指定 ARN 的 repository policy 格式；改成套於當前單一 repository 的政策（省略 Resource 欄，不擴大範圍），Save 後讀到 Successfully updated repository policy。
- 第二次 docker push 成功，aws-v1 digest=sha256:ff3154a915ea1563fe47bf5a9b9dff5e165e4e8f75bc761318e9ea4483a17ffc。Console Images 起初快取為 0，reload 後 1 image、aws-v1、84.74 MB、同 digest，完成雙重確認。

### B033｜2026-09-09T09:00:42+08:00｜W7 RDS Available 與 W10 存取批准
- RDS Console：新分頁開 livefit-final-db；先 Backing-up，再 Available。Configuration 確認 17.11、db.t4g.micro、2 vCPU／1 GB、livefit、Single-AZ、20 GiB gp3、加密開啟、autoscaling 關閉、Database Insights Standard 7 days、Enhanced Monitoring 關閉。
- 連線：RDS 顯示 endpoint=livefit-final-db.c3i6mi6cktx2.ap-northeast-1.rds.amazonaws.com；EC2 nc 5432 成功，解析至 private 10.0.253.54。SG 規則顯示 inbound 來源 Web SG；沒有公有 DB 連線。SQL 查詢尚待應用映像拉取。
- W10 第一個建立 deployer 指令被自動審核阻止，未執行。唯讀確認本次 EC2 無 deployer、Docker 群組無成員、未裝 AWS CLI。建立 docs/deployment-access-review.md 列明 Linux 帳號／公鑰／Docker 管理能力，以及限定 ECR／S3／SES 的 EC2 Role。
- 使用者明確回覆「可以，依這份 W10 範圍執行」。批准後才產生專用本機金鑰（私鑰 mode 600）、建立 deployer、停用密碼登入、加入 docker 群組、安裝公鑰與專用目錄；不加入 sudo。
- 安裝狀況：Ubuntu apt 無 awscli candidate；帳號與公鑰已完成，改官方 Linux ARM64 AWS CLI 安裝包，進行中；未重新建立帳號或覆寫金鑰。
- IAM Console：Search IAM → Roles，讀到原有 7 個 role，無 livefit-final-ec2-role；Create role，準備僅信任 EC2。

### B034｜2026-09-09T09:15:58+08:00｜W10 EC2 Role 與部署目錄
- 終端（非瀏覽器）：官方 ARM64 AWS CLI 2.36.41 安裝完成；deployer SSH／Docker 指令成功，未加入 sudo。
- IAM Console：Create role → AWS service EC2；建立 livefit-final-ec2-role 與 Inline Policy LiveFitRuntimeAccess，只含已批准的單一 ECR pull、本次 S3 路徑讀寫、SES 寄件身分；看到 Role created 成功。
- EC2 Console：本次 i-05a22fd9a58e62318 → Actions → Security → Modify IAM role → 選 livefit-final-ec2-role → Update。讀到 Successfully attached；主機 STS 驗證為 livefit-final-ec2-role／本次 instance。
- EC2 → Actions → Instance settings → Modify instance metadata options：實際讀回 IMDSv2 Required、hop limit 已為 2，未修改，按 Cancel。先前預期 hop=1 未獲實機支持，以此讀回為準。
- 傳檔首次失敗：新建 certs 的上層 livefit／deploy 被 install 的預設擁有者 root 擁有，SCP Permission denied，沒有傳入環境檔。唯讀確認後只將這兩層本次目錄改為 deployer／mode 700，再重試。
- 正式部署設定透過 SSH 傳往本次 EC2 的私人 deploy 目錄；不使用 CloudShell，不記錄環境檔內容。映像拉取結果待下一筆核對。

### B035｜2026-09-09T09:24:21+08:00｜W6～W11 雲端整合驗證
- 終端（非瀏覽器）：修正目錄後 Compose／私有 .env.aws 傳送成功，環境檔 mode 600。下載官方 RDS CA bundle；EC2 Role 執行 ECR login/pull aws-v1 成功。
- RDS：db:init 僅對新空庫建表成功；seed 建立 3 項技能與 2 項方案；SELECT current_database()/version() 確認 livefit、PostgreSQL 17.11。Compose up --wait 回報 Healthy，/ready=ready；TLS 使用官方 CA 且 rejectUnauthorized=true。
- SSH heredoc 第一批在 docker compose run 後被 stdin 消費，後續未執行；改 ssh -n 搭配命令參數重跑未完成的 seed／SQL／up，不重跑 init。
- S3 Console：本次 Bucket → Permissions → 最後一個 Edit（CORS）；填入只允許 https://13.196.54.138.nip.io 的 PUT／GET／HEAD、content-type／x-amz-*、ETag、300 秒。Save changes 後讀回 Successfully edited，Block all public access 保持 On。
- EC2 容器 S3 ListObjectsV2 實測成功，當時回傳空清單。
- W11：nip.io DNS 實測解析到 EIP；新增本次 Nginx site 反代 127.0.0.1:8080；nginx -t 通過，外部 HTTP 200。
- Certbot 首次執行被自動審核拒絕，原因是將私人信箱提供給 Let's Encrypt 尚未獲明確批准。使用者回覆「可以，使用這個信箱完成 HTTPS」後才執行，憑證成功，效期至 2026-12-08；自動續期排程由 Certbot 建立，dry-run 進行中。
- 正式瀏覽器：打開 https://13.196.54.138.nip.io 顯示 LiveFit+ 首頁；示範帳號註冊成功並跳登入。其他操作待後續驗證。
- SES：依已批准範圍寄出唯一一封 W8 測試信，SES 已接受。Gmail 只搜尋當天 LiveFit 自寄信，找到同主旨同內容，標籤為 SPAM；已送達垃圾郵件，不能宣稱送達收件匣。未替使用者更改 Gmail 標籤。


### B036｜2026-09-09｜W6～W11 實機驗收與新增交付
- 終端：外部 HTTP 301／HTTPS 200／TLS 驗證成功；Certbot renew dry-run 成功，timer active。
- 網站瀏覽器：新增測試教練帳號、登入、從「教練資格管理」選圖上傳 S3、升級本人教練；再次登入編輯 profile、儲存並讀回照片，圖片實際解碼寬度 596。建立示範課程；另一測試會員模擬購買 3 堂，無金流扣款。尚未點報名，避免超出目前已批准寄信範圍。
- 終端：重啟本次 app 容器後 Healthy；瀏覽器仍讀到教練、照片與課程；沒有停止或重新啟動 EC2。SQL 確認 TLSv1.3、2 users／1 coach／1 course／1 purchase。
- RDS Console：Maintenance & backups 顯示自動備份 Enabled（3 days）與當日 Available 自動快照；未測還原。
- 終端：practice/ 同名 S3 物件兩次上傳得到不同版本，取回 revision 2 與原始 bytes 相符；對該存在物件的未簽名 GET=403。另一個不存在且位於前綴外的 key 回 NoSuchKey，無法作為 IAM 拒絕證據。
- 終端：EC2 Role 的 ECR InitiateLayerUpload 被 AccessDenied 拒絕；拉取權限仍可用。
- SES Console：Tokyo Sandbox／Healthy，當日發信使用量 1。IAM Console 開啟本次 Role 查看，尚未新增 CloudWatch 權限。
- 已準備 monitoring-access-review.md，詢問 W12 指標／日誌／單一告警、SNS 收信與確認，以及一封真實報名通知；尚待回覆，不以其他新訊息視為批准。
- 使用者要求課程左側增加「13. 最終作業」及六份分頁、改「克庭驗收」；另外明確要求 hexschool 私密 AWS 解答 repo。CLI 已建立 hexschool/aws-livefit-final（Private）；準備上傳前掃描工作檔與 Git 歷史，未命中 AWS Key、私鑰、正式 DB／JWT 秘密或完整帳號識別碼。程式與教材進度另記後續紀錄。


### B037｜2026-09-09T10:09:14+08:00｜私密解答 repo 與最終作業教材
- GitHub CLI：建立 hexschool/aws-livefit-final，Private；新增 origin，將程式提交 734c176 推送 main。再讀回 isPrivate=true／defaultBranch=main；GitHub Actions run 34300991490 的合約與 AWS 模擬測試通過。
- 機密檢查：掃描待提交檔案與原 Git 歷史，不輸出秘密值；正式 .env.aws／SSH key 不進 Git。保留原前端 CRLF 換行，不為 whitespace 警示改寫整批既有檔案。
- 本機課程程式：保留十二週課程地圖，增加 13 最終作業的六份 Markdown；共用驗收分頁改名克庭驗收。老師先學／講義包含實際改造、Console 欄位、部署命令、排錯與 W1～W12 對應；學生任務以自己的 URL、版本、設定與功能證據提交。
- 瀏覽器：沿用 in-app 本機課程分頁。窄視窗左側選單原先收合，先展開再點 13 最終作業，路由成功；依序點自學／講義／講稿／任務／驗收，六份都能讀取，Console 無 error。
- 視覺檢查：預設 366px 視窗，頁寬與 viewport 同為 366，分頁採橫向捲動；未額外改尺寸。檢查原 course-map 仍為 W1～W12。
- 終端：課程 typecheck／Vite build 通過，Markdown 連結與 code fence 檢查通過；正式 HTTPS /ready 再次回 ready。
- 狀態：新私密解答已推送；本次課程變更留本機，未發布 GitHub Pages。W12 權限／SNS 與額外報名通知仍待先前詢問回覆，未新增雲端監控、未再寄信；示範 EC2 持續 Running。


### B038｜2026-09-09｜預算與 S3 到期補查
- IAM Console：本次 EC2 Role 仍只有 LiveFitRuntimeAccess；未掛 CloudWatchAgentServerPolicy。
- Console 搜尋 Budgets → aws-course-budget → Alerts／Additional budget parameters；Monthly US$30、Healthy，September MTD Actual US$1.09／Forecast US$4.33。Included filters=None，排除 Credit／Refund；屬帳號範圍的當次快照，不是 LiveFit 專案月費或最終應付帳單。
- 三個既有門檻 Actual >85%、Actual >100%、Forecasted >100% 均 Not exceeded；沒有變更預算、通知地址或主動觸發通知。
- 本機檔案：發現監控範本漏了明確保留天數，補 retention_in_days=7，改本次專用 /livefit-final/nginx/access 與 /livefit-final/nginx/error；JSON 與欄位檢查通過，未套到雲端。
- 終端唯讀驗證：首次用 nip.io SSH 名稱因沒有對應已知 host key 而停止；改用先前驗證過的 EIP，未關 host key 檢查。從已部署容器以 Role 簽發五秒 GET URL；既有圖片先回 200，八秒後同一 URL 回 403／Request has expired。沒有輸出簽名 URL、修改網站設定或寫新 S3 物件。
- W12 與真實報名通知仍等待先前的明確授權，沒有新增監控或寄信。


### B039｜2026-09-09｜最終作業自動檢查腳本實機驗證
- 使用者明確要求針對今天的機器寫學生自查腳本。新增只讀設定檢查、SSH 主機檢查與需明確旗標的功能測試；沒有改應用程式、監控權限或原 Notion。
- 終端：既有本機 CLI 身分缺少 ec2:DescribeInstances，未擴大其權限；檢查器把 AccessDenied 列為無法檢查。以已授權 deployer SSH 在同一 EC2 執行只讀 Python 檢查，12 項通過；結果不含 AWS token、DB 密碼、環境檔值或私鑰。
- 瀏覽器：既有 AWS Console → CloudShell → 東京完整頁；關閉 Welcome modal；Actions → Upload file，透過檔案選擇器上傳自查程式、非秘密的本次資源欄位與主機布林報告之壓縮包。沒有傳 RDS 建庫密碼、私鑰或 .env。
- CloudShell：解壓到本次專用 livefit-selfcheck 目錄，以現有 Console 權限執行 AWS 只讀查詢及 HTTP。第一輪發現 ECR 參數大小寫與舊 Budget 省略百分比型別，修正檢查器後透過相同 Upload 流程重跑。最終 28 PASS／3 FAIL（W12 缺項）／0 BLOCKED／7 MANUAL。
- CloudShell Download file 嘗試未能取得下載事件／本機檔案，改將已遮蔽的 report.json 壓縮分段印到可見終端，以 DOM 讀回並保存；比對原始 JSON 的 scriptSha256 與本機程式一致。沒有用隱藏瀏覽器 API 或匯出登入憑證。
- 終端：明確開啟 allow-test-data，對真正 HTTPS 網站跑兩名測試會員、S3 照片、教練開課與模擬購買，4 項通過；這不是瀏覽器點擊驗證，CORS 真人操作仍另行驗收。測試資料保留並在報告列識別資訊。
- 未呼叫報名 API、未寄送額外信件、未重啟／停止主機、未改 AWS 設定。W12 與額外通知沿用先前待回覆的授權狀態。
