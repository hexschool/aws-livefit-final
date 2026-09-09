const fs = require('node:fs')
const sslEnabled = process.env.DB_ENABLE_SSL === 'true'
if (process.env.NODE_ENV === 'production' && (!sslEnabled || process.env.DB_SYNCHRONIZE === 'true')) {
  throw new Error('正式環境必須啟用資料庫 TLS，並關閉自動 synchronize')
}
module.exports = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  ssl: sslEnabled ? {
    rejectUnauthorized: true,
    ...(process.env.DB_CA_CERT_PATH ? { ca: fs.readFileSync(process.env.DB_CA_CERT_PATH, 'utf8') } : {})
  } : false
}
