# AWS 部署

這個資料夾只放部署需要的設定範本。AWS 配置要求請看課程網站「13. 最終作業 → 課程講義」，以下指令都在 repo 根目錄執行。

## 設定範本

| 檔案 | 需要替換或準備的內容 |
|---|---|
| `.env.aws.example` | 另存為 `.env.aws`，填入自己的 ECR 映像、RDS 帳密、JWT 隨機值、S3 Bucket 與 SES 寄件地址；檔案權限設為 `600` |
| `compose.aws.yml` | 從 ECR 啟動一個容器，僅綁 `127.0.0.1:8080`，連線至 RDS |
| `iam/ec2-trust.json` | EC2 Role 的信任政策 |
| `iam/ecr-pull-policy.json` | EC2 拉取映像的權限；替換帳號與 repository 名稱 |
| `iam/livefit-app-policy.json` | 應用的 S3／SES 權限；替換帳號、Bucket 與寄件身分 |
| `s3-cors.json` | 將 `YOUR_DOMAIN` 換成自己的網站網域；此檔為 AWS CLI CORS 設定格式 |
| `nginx/livefit.conf` | 替換 `YOUR_DOMAIN`，供主機 Nginx 使用，再以 Certbot 設定 HTTPS |

將兩份 IAM 權限政策附加至 EC2 Role，透過 Instance Profile 掛到自己的 EC2；信任政策另行設定。範本不包含操作者推送 ECR 的權限。應用使用 EC2 Role，不在環境檔放固定 AWS key。

## 建置並推送映像

在已具備本次 ECR 推送權限的電腦上，替換帳號、repository 與版本：

```sh
LIVEFIT_REGISTRY=YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
LIVEFIT_IMAGE=${LIVEFIT_REGISTRY}/livefit:aws-v1
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin "$LIVEFIT_REGISTRY"
docker build --platform linux/arm64 -t "$LIVEFIT_IMAGE" .
docker push "$LIVEFIT_IMAGE"
```

新版本使用新 tag，並將 `deploy/.env.aws` 的 `LIVEFIT_IMAGE` 設為同一個完整映像名稱。

## 在 EC2 啟動

EC2 已準備 Docker Compose、AWS CLI、Nginx、Certbot 與部署帳號後，放入 `deploy/`，填好私人設定並準備 RDS CA 憑證：

```sh
cp deploy/.env.aws.example deploy/.env.aws
chmod 600 deploy/.env.aws
# 編輯 deploy/.env.aws，填入自己的設定。
mkdir -p deploy/certs
curl --fail --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  --output deploy/certs/global-bundle.pem
```

在 EC2 使用自己的 `LIVEFIT_REGISTRY` 執行上面的 ECR 登入命令，再拉取映像。只有**全新空資料庫**才執行初始化與 seed：

```sh
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml pull
# 以下兩行只在第一次準備空資料庫時執行。
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml run --rm backend npm run db:init
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml run --rm backend npm run db:seed
docker compose --env-file deploy/.env.aws -f deploy/compose.aws.yml up -d
curl --fail http://127.0.0.1:8080/ready
```

更新版本只需更換映像 tag，再執行 `pull` 與 `up -d`。完成 Nginx、網域與 HTTPS 後，回到 [自查與繳交](../README.md#自查與繳交)。
