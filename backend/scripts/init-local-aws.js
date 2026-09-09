// 僅操作 docker-compose.yml 的本機 Moto，不讀使用者 AWS profile。
const { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutBucketVersioningCommand } = require('@aws-sdk/client-s3')
const { SESClient, VerifyEmailIdentityCommand } = require('@aws-sdk/client-ses')
const options = { region: 'ap-northeast-1', endpoint: 'http://localhost:15000', credentials: { accessKeyId: 'local-test', secretAccessKey: 'local-test' } }
async function main () {
  const s3 = new S3Client({ ...options, forcePathStyle: true })
  const Bucket = 'livefit-local-photos'
  try { await s3.send(new CreateBucketCommand({ Bucket, CreateBucketConfiguration: { LocationConstraint: options.region } })) } catch (error) {
    if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) throw error
  }
  await s3.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: [{ AllowedOrigins: ['http://localhost:3080', 'http://127.0.0.1:3080'], AllowedMethods: ['GET', 'PUT', 'HEAD'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'] }] } }))
  await s3.send(new PutBucketVersioningCommand({ Bucket, VersioningConfiguration: { Status: 'Enabled' } }))
  await new SESClient(options).send(new VerifyEmailIdentityCommand({ EmailAddress: 'teacher@example.com' }))
  console.log('本機模擬 S3 Bucket／版本／CORS 與 SES 寄件身分已建立；未操作 AWS。')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
