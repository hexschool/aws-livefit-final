# W12：沿用 Notion 的 Dashboard、Alarm、SNS 與 Agent

來源：`weeks/12-cloudwatch/learn.md:757` 實務環節，以及 `:524` 收集策略。
目前是準備範本；尚未建立 Dashboard、送出指標或觸發告警。

- Dashboard：EC2 CPU／網路／磁碟、RDS CPU／網路／磁碟用 Line；RDS FreeableMemory 用 Gauge（上限填實際 DB 記憶體位元組）；DatabaseConnections 用 Number。
- EC2 磁碟不能假定有 instance-store DiskReadBytes；本課 EBS 主機應使用 EBS VolumeReadBytes／VolumeWriteBytes，磁碟使用率由 Agent 的 disk_used_percent 提供。
- Agent：使用 `agent.json`，收集 mem_used_percent 與根目錄 disk_used_percent；分別放 Line 與 Gauge。
- Role 沿用 W10 Instance Role，再附加 Notion 指定的 CloudWatchAgentServerPolicy，不另放金鑰。
- 原稿 CPU 告警寫 30 秒；套用前需確認指標解析度。EC2 基本監控以 300 秒，Detailed Monitoring 才是 60 秒，不能把標準 CPU 指標當高解析度 30 秒資料。
- 原稿 RDS「可用記憶體 < 15%」必須換算成 FreeableMemory 的位元組值；連線數 >=30、60 秒、3 點中 2 點可沿用。閾值先按實際選用規格核對。
- SNS Email 訂閱需在信箱確認。驗收包含進入 ALARM 與收到通知；不只看資源建立成功。
- 本期 README 將 Agent／多組告警列時間許可項；這份老師版保留對應，沒有把它們自行改為每週必交項。

Ubuntu ARM 安裝沿用 Notion 流程，但下載架構改為 arm64（原稿安裝片段是 amd64）：

```sh
curl -O https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/livefit/deploy/cloudwatch/agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

App 的 stdout 保持 JSON，由 Docker json-file 保留（10 MB ×3）。課堂若要將 App 日誌送到 CloudWatch，先用 `docker inspect --format '{{.LogPath}}' <容器名稱>` 取得該容器的實際檔案，再在 Agent collect_list 加入該路徑，Log Group `/livefit/backend`。容器重建後路徑會改變，需重新確認與載入設定；不要把其他專案的所有容器一起收走。目前範本只直接收主機 Nginx 日誌。
