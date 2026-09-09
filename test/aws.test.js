const { api, signupAndLogin, makeCoach, createSkill, createCourse, createCreditPackage, buyPackage, bookCourse, expectSuccess } = require('./helpers')
const { SESClient, DeleteIdentityCommand, VerifyEmailIdentityCommand } = require('../backend/node_modules/@aws-sdk/client-ses')
const { Client } = require('../backend/node_modules/pg')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVyoAAAAASUVORK5CYII=', 'base64')
const auth = user => ({ Authorization: `Bearer ${user.token}` })
// 這組測試會暫時修改本機 SES 模擬身分；禁止指向真實 AWS 或其他網站。
beforeAll(() => {
  if (process.env.API_BASE_URL !== 'http://localhost:3080') throw new Error('AWS 整合測試只允許 localhost:3080')
})
async function upload(user, bytes = png) {
  const ticket = await api().post('/api/upload').set(auth(user)).send({ content_type: 'image/png', size: bytes.length })
  expect(ticket.status).toBe(201)
  const params = new URL(ticket.body.data.upload_url).searchParams
  expect(params.has('x-amz-checksum-crc32')).toBe(false)
  expect(params.get('X-Amz-SignedHeaders')).toContain('content-type')
  const sent = await fetch(ticket.body.data.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: bytes })
  expect(sent.ok).toBe(true)
  return ticket.body.data.key
}
test('未登入者不能取得 S3 上傳權限', async () => {
  expect((await api().post('/api/upload').send({ content_type: 'image/png', size: png.length })).status).toBe(401)
})
test('拒絕超大檔案與不支援的格式', async () => {
  const user = await signupAndLogin()
  for (const body of [{ content_type: 'image/svg+xml', size: 20 }, { content_type: 'image/png', size: 2097153 }]) {
    expect((await api().post('/api/upload').set(auth(user)).send(body)).status).toBe(400)
  }
})
test('PUT→驗證→儲存→再次讀取照片；DB 保存 key 而非簽名網址', async () => {
  const user = await makeCoach()
  const skill = await createSkill()
  const key = await upload(user)
  const confirmed = await api().post('/api/upload/confirm').set(auth(user)).send({ key })
  expectSuccess(confirmed)
  expect(Buffer.from(await (await fetch(confirmed.body.data.image_url)).arrayBuffer())).toEqual(png)
  const saved = await api().put('/api/admin/coaches').set(auth(user)).send({ experience_years: 3, description: 'S3 圖片整合測試', skill_ids: [skill.id], profile_image_key: key })
  expectSuccess(saved)
  const reread = await api().get('/api/admin/coaches').set(auth(user))
  expect(reread.body.data.profile_image_key).toBe(key)
  expect(reread.body.data.profile_image_url).toContain('X-Amz-Signature')
  const publicProfile = await api().get(`/api/coaches/${user.coachId}`)
  expect((await fetch(publicProfile.body.data.coach.profile_image_url)).ok).toBe(true)
  const db = new Client({ host: 'localhost', port: 15439, user: 'livefit', password: 'local-only-demo', database: 'livefit' })
  await db.connect()
  try {
    const { rows } = await db.query('SELECT profile_image_key, profile_image_url FROM "COACH" WHERE user_id=$1', [user.userId])
    expect(rows[0]).toEqual({ profile_image_key: key, profile_image_url: null })
  } finally { await db.end() }
})
test('不能使用別人的 S3 key 或替別人升級教練', async () => {
  const owner = await signupAndLogin(), other = await signupAndLogin()
  const key = await upload(owner)
  expect((await api().post('/api/upload/confirm').set(auth(other)).send({ key })).status).toBe(403)
  expect((await api().post(`/api/admin/coaches/${owner.userId}`).set(auth(other)).send({ experience_years: 1, description: '不應成功' })).status).toBe(403)
})
test('不能將非圖片內容假冒成 PNG', async () => {
  const user = await signupAndLogin()
  const key = await upload(user, Buffer.from('<script>alert(1)</script>'))
  expect((await api().post('/api/upload/confirm').set(auth(user)).send({ key })).status).toBe(400)
})
test('照片未上傳完成不能儲存', async () => {
  const user = await signupAndLogin()
  const ticket = await api().post('/api/upload').set(auth(user)).send({ content_type: 'image/png', size: png.length })
  expect((await api().post('/api/upload/confirm').set(auth(user)).send({ key: ticket.body.data.key })).status).toBe(400)
})
test('SES 接受報名通知；寄信失敗仍保留報名，回應明確標示失敗', async () => {
  const coach = await makeCoach(), user = await signupAndLogin(), skill = await createSkill(), pkg = await createCreditPackage()
  expectSuccess(await buyPackage(user.token, pkg.id))
  const c1 = await createCourse(coach.token, skill.id)
  const accepted = await bookCourse(user.token, c1.id)
  expectSuccess(accepted)
  expect(accepted.body.notification.status).toBe('accepted')
  const ses = new SESClient({ region: 'ap-northeast-1', endpoint: 'http://localhost:15000', credentials: { accessKeyId: 'local-test', secretAccessKey: 'local-test' } })
  await ses.send(new DeleteIdentityCommand({ Identity: 'teacher@example.com' }))
  try {
    const c2 = await createCourse(coach.token, skill.id)
    const failed = await bookCourse(user.token, c2.id)
    expectSuccess(failed)
    expect(failed.body.notification.status).toBe('failed')
    const repeated = await bookCourse(user.token, c2.id)
    expect(repeated.status).toBe(400)
    expect(repeated.body.message).toBe('已經報名過此課程')
  } finally {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: 'teacher@example.com' }))
    ses.destroy()
  }
})
test('前端路由可重新整理，未知 API 不會錯誤回傳 HTML', async () => {
  expect((await api().get('/coach/profile')).headers['content-type']).toContain('text/html')
  expect((await api().get('/api/not-a-route')).status).toBe(404)
  expect((await api().get('/ready')).body.status).toBe('ready')
})
