// 正式環境使用 EC2 Instance Role；只有本機模擬器設定 endpoint。
const options = {
  region: process.env.AWS_REGION || 'ap-northeast-1',
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 }
}
if (process.env.NODE_ENV === 'production' && process.env.AWS_ENDPOINT_URL) {
  throw new Error('正式環境不可設定本機 AWS_ENDPOINT_URL')
}
if (process.env.AWS_ENDPOINT_URL) options.endpoint = process.env.AWS_ENDPOINT_URL
module.exports = options
