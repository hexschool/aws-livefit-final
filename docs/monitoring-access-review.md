# W12 與最終通知驗收範圍

目標只限本次 livefit-final EC2、livefit-final-db RDS 與 LiveFit 示範資料。原 W10 批准未含 CloudWatch；以下是本次要追加確認的具體範圍。

## CloudWatch 與 Agent

來源：W12 learn.md:576／594 的 CloudWatchAgentServerPolicy、:757 實務環節；README 以單一 Alarm＋SNS 為主線。

- 在 livefit-final-ec2-role 附加 Notion 指定的 AWS managed CloudWatchAgentServerPolicy。此政策的 CloudWatch／Logs／X-Ray 動作使用 Resource=*，並可讀 AmazonCloudWatch-* 的 SSM 參數；不是只限單一 log group 的自訂政策。政策詳情：https://docs.aws.amazon.com/aws-managed-policy/latest/reference/CloudWatchAgentServerPolicy.html
- 只在本次 EC2 安裝 ARM64 CloudWatch Agent。設定只上傳 mem_used_percent、根磁碟 disk_used_percent 與本次 Nginx access/error 日誌，日誌群組只用 /livefit-final/nginx/access 與 /livefit-final/nginx/error，retention_in_days=7；不收 .env、私鑰或其他主機資料。
- 建立 livefit-final Dashboard，查看本次 EC2 CPU／網路／EBS、本次 RDS CPU／網路／磁碟／記憶體／連線，加上本機 Agent 指標。
- 建立唯一 livefit-final-ec2-cpu-high Alarm，CPU Average >=70%，300 秒、5 點中 3 點；符合 basic monitoring 的解析度。保持主機運行，不用停機或壓力測試觸發。

## SNS 與通知測試

- 建立只供這次的 SNS Standard topic livefit-final-alerts，將 gonsakon@gmail.com 設為 email 訂閱；會寄一封訂閱確認信。
- 讀取並完成該次訂閱確認；只連到本次 topic。先用暫時測試閾值讓 Alarm 真正進 ALARM 並寄一封測試通知，驗證收到後還原正式 70% 閾值。測試會記錄，不假稱 CPU 異常。
- 額外驗收 LiveFit 報名流程：使用 gonsakon@gmail.com 作為本次示範會員收件地址，觸發一封真正的 SES 報名通知。前一封 W8 連線測試已收到（在垃圾郵件），此封是另一封，需本次同意。
- 不寄給其他人，不建立週期性測試信，不建立計費告警／其他專案 Alarm，不開 Detailed Monitoring，不清除部署資源。

目前：待使用者確認；以上權限與通知尚未套用。
