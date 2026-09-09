const { randomUUID } = require('node:crypto')
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const options = require('./aws')
const client = new S3Client({ ...options, requestChecksumCalculation: 'WHEN_REQUIRED', forcePathStyle: Boolean(options.endpoint) })
const signingClient = process.env.S3_BROWSER_ENDPOINT
  ? new S3Client({ ...options, requestChecksumCalculation: 'WHEN_REQUIRED', endpoint: process.env.S3_BROWSER_ENDPOINT, forcePathStyle: true })
  : client
const MAX_BYTES = 2 * 1024 * 1024
const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
function fail (message, status = 400) { throw Object.assign(new Error(message), { status }) }
function bucket () {
  if (!process.env.S3_BUCKET) fail('尚未設定圖片儲存服務', 503)
  return process.env.S3_BUCKET
}
function assertOwner (key, userId) {
  if (typeof key !== 'string' || !key.startsWith(`coaches/${userId}/`) ||
      !/^coaches\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) {
    fail('只能使用自己上傳的教練照片', 403)
  }
}
async function createUpload (userId, contentType, size) {
  if (!types[contentType] || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) {
    fail('請選擇 2 MB 以下的 PNG、JPEG 或 WebP 圖片')
  }
  const key = `coaches/${userId}/${randomUUID()}.${types[contentType]}`
  const command = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size })
  const url = await getSignedUrl(signingClient, command, { expiresIn: 120, signableHeaders: new Set(['content-type']) })
  return { key, upload_url: url, content_type: contentType, expires_in: 120 }
}
async function validatePhoto (key, userId) {
  assertOwner(key, userId)
  let metadata
  try {
    metadata = await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) fail('照片尚未上傳完成')
    throw error
  }
  if (!types[metadata.ContentType] || metadata.ContentLength < 1 || metadata.ContentLength > MAX_BYTES) {
    fail('照片格式或大小不符，請重新上傳')
  }
  // 以檔頭檢查格式，避免只信任瀏覽器送來的 MIME type。
  const object = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: 'bytes=0-11' }))
  const header = Buffer.from(await object.Body.transformToByteArray())
  const isImage = metadata.ContentType === 'image/png' ? header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : metadata.ContentType === 'image/jpeg' ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
  if (!isImage) fail('檔案內容不是支援的圖片格式')
}
async function imageUrl (key, fallback = null) {
  if (!key) return fallback
  return getSignedUrl(signingClient, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 900 })
}
module.exports = { createUpload, validatePhoto, imageUrl }
