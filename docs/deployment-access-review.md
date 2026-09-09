# LiveFit W10 存取設定確認

目標只限本次 Tokyo EC2 `livefit-final`（i-05a22fd9a58e62318、13.196.54.138）。
審查時原始狀態：沒有 deployer 帳號、Docker 群組沒有成員、AWS CLI 尚未安裝。使用者已明確批准本文件範圍；2026-09-09 已完成帳號、公鑰、AWS CLI、Role 建立與掛載，詳見 browser-operations.md B033～B034。

## 1. 專用部署帳號

來源：[W10 deployer 與 SSH Key](/Users/gonsakon/Documents/github/My/aws-course-hub/weeks/10-container-deploy/learn.md:826)

- 建立 Linux `deployer`，關閉密碼登入，加入 `docker` 群組（此群組可管理容器，實務上具有高度主機控制能力）；不加入 sudo 群組。
- 本機產生專用 `/Users/gonsakon/.ssh/livefit-deployer` 金鑰，私鑰 mode 600 不上傳；只有公鑰裝入新 deployer 的 authorized_keys。
- 保留既有 ubuntu／livefit-final.pem 登入方式。
- 建立 `/home/deployer/livefit/deploy`，安裝 ECR 指令需要的 AWS CLI。
- 若發現 deployer 或該 key 已由其他用途建立，停止覆寫並查核。

## 2. EC2 Role

來源：[W10 EC2 IAM Role](/Users/gonsakon/Documents/github/My/aws-course-hub/weeks/10-container-deploy/learn.md:898)、W6 S3、W8 SES。

- 名稱：`livefit-final-ec2-role`，只信任 AWS EC2 服務，掛到上述本次主機。
- ECR：沿用講義 PullOnly 的動作集合，資源進一步限於本次 `livefit`；GetAuthorizationToken 依 AWS API 要求使用 Resource=*，不授予 push/delete。
- S3：只允許列出 `livefit-final-5764-tokyo-20260909`，以及讀寫其 `coaches/*`、`practice/*`；沒有刪除或公開 Bucket 權限。
- SES：只允許使用已批准的寄件 identity 發 SendEmail；測試收件仍限同一已批准信箱。
- 使用 EC2 Role 暫時憑證；維持 IMDSv2 required，response hop limit 設 2，讓 bridge 容器能取得 Role。
- 這項確認不包含 CloudWatch 後續授權、不建立新的 IAM User／長期 Access Key，不更動其他主機或既有使用者權限。

## 已完成且不重做

- 本機 CLI 使用者 `gonsakon-course-of-aws` 對單一 `livefit` 的 push/pull 已獲本人批准並套用；ECR 映像 aws-v1 已上傳。
- RDS 已建立，EC2 到私有 endpoint 的 5432 測試成功；RDS 密碼已在本機私有 .env.aws 保存，不放本文件。
