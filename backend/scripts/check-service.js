// 每次只驗證一項，對應 Notion W6／W7／W8，無須啟動整個網站。
require('dotenv').config()
const { readFile } = require('node:fs/promises')
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')
const options = require('../services/aws')
async function main () {
  const [service, action, key, file] = process.argv.slice(2)
  if (service === 's3') {
    if (!process.env.S3_BUCKET) throw new Error('請設定 S3_BUCKET')
    const client = new S3Client({ ...options, requestChecksumCalculation: 'WHEN_REQUIRED', forcePathStyle: Boolean(options.endpoint) })
    const args = { Bucket: process.env.S3_BUCKET, Key: key }
    if (action === 'list') {
      const result = await client.send(new ListObjectsV2Command({ Bucket: args.Bucket, Prefix: 'practice/', MaxKeys: 50 }))
      console.log(JSON.stringify(result.Contents?.map(({ Key, Size }) => ({ Key, Size })) || [], null, 2))
    } else {
      if (!key || !key.startsWith('practice/')) throw new Error('練習物件 key 必須以 practice/ 開頭')
      if (action === 'upload' && file) {
        await client.send(new PutObjectCommand({ ...args, Body: await readFile(file), ContentType: 'image/png' }))
        console.log('S3 上傳完成')
      } else if (action === 'get-url' || action === 'put-url') {
        const command = action === 'get-url' ? new GetObjectCommand(args) : new PutObjectCommand({ ...args, ContentType: 'image/png' })
        console.log(await getSignedUrl(client, command, { expiresIn: 180 }))
        // 此網址是臨時存取憑證：只供當下測試，勿複製到教學操作紀錄。
      } else throw new Error('s3 支援 list、upload KEY FILE、get-url KEY、put-url KEY')
    }
  } else if (service === 'rds') {
    const { dataSource } = require('../db/data-source')
    dataSource.setOptions({ synchronize: false })
    await dataSource.initialize()
    try {
      const result = await dataSource.query('SELECT current_database() AS database, version() AS version')
      console.log(JSON.stringify(result, null, 2))
    } finally { await dataSource.destroy() }
  } else if (service === 'ses') {
    if (!process.env.SES_FROM_EMAIL || !process.env.SES_TEST_TO) throw new Error('請設定已驗證的 SES_FROM_EMAIL 與 SES_TEST_TO')
    const result = await new SESClient(options).send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [process.env.SES_TEST_TO] },
      Message: {
        Subject: { Data: 'LiveFit｜W8 SES 測試', Charset: 'UTF-8' },
        Body: { Text: { Data: '這是 AWS 最終作業的 SES 連線測試，請在信箱確認實際收信。', Charset: 'UTF-8' } }
      }
    }))
    console.log('SES 已接受寄送請求，請至收件匣驗證。MessageId:', result.MessageId)
  } else throw new Error('請指定 s3、rds 或 ses')
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1 })
