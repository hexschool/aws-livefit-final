#!/usr/bin/env node
// Explicit opt-in creates a small, identifiable set of application test data. Never books or sends email.
const fs = require('node:fs')
const path = require('node:path')
const { randomBytes, createHash } = require('node:crypto')
const { request, validateConfig, makeReporter, totals, exitCode, renderHtml, VERSION } = require('./check-final')

async function runFlow (c, { allowTestData = false, request: send = request, onResult } = {}) {
  if (!allowTestData) throw new Error('需要 --allow-test-data：會建立兩個會員、一張照片、一堂課及一筆模擬購買；不報名、不寄信、不清除資料。')
  const r = makeReporter(onResult)
  const runId = '驗收-' + new Date().toISOString().slice(0, 10) + '-' + randomBytes(4).toString('hex')
  const created = { runId }
  const user = {}; let skill; let pkg
  const api = async (method, route, body, token) => {
    const result = await send(c.url + route, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (result.status < 200 || result.status >= 300 || result.json?.status !== 'success') throw Object.assign(new Error('API 回應不符'), { code: `${method} ${route.split('?')[0]} HTTP ${result.status}`, status: 'FAIL' })
    return result.json
  }
  await r.check('flow.accounts', 10, '新會員註冊與再次登入', '兩個新會員可登入並重新查詢自己的 profile', '回查 users API、RDS 與 JWT 設定；每次重跑會建立新測試帳號。', async () => {
    const seeds = await Promise.all([api('GET', '/api/coaches/skill'), api('GET', '/api/credit-package')])
    skill = seeds[0].data?.[0]; pkg = seeds[1].data?.find(p => Number(p.credit_amount) > 0)
    if (!skill?.id || !pkg?.id) throw Object.assign(new Error('缺少種子資料'), { code: 'MissingSkillOrPackage', status: 'FAIL' })
    for (const role of ['coach', 'member']) {
      const email = `check-${randomBytes(10).toString('hex')}@example.invalid`
      const password = 'Aa9!' + randomBytes(5).toString('hex')
      const s = await api('POST', '/api/users/signup', { name: `${runId}-${role}`, email, password })
      const login = await api('POST', '/api/users/login', { email, password })
      user[role] = { id: s.data.user.id, token: login.data.token, email, password }
      created[`${role}Id`] = s.data.user.id
      await api('GET', '/api/users/profile', null, login.data.token)
    }
    return { ok: true, actual: `建立兩個 ${runId} 專用會員，登入後 profile 讀回成功；帳密與 token 不寫入報告。` }
  })
  function need (condition) { if (!condition) throw Object.assign(new Error('前置未完成'), { code: 'PreviousStepIncomplete', status: 'BLOCKED' }) }
  await r.check('flow.photo', 6, '上傳私有 S3 照片並重新登入讀回', 'PUT→confirm→升級本人→保存 key→重登讀取相同圖片；未簽名回 403', '回查 EC2 Role 的 S3 權限、Bucket、CORS 與照片 key；CORS 仍由瀏覽器／設定自查補驗。', async () => {
    need(user.coach?.token)
    const u = user.coach
    await api('POST', `/api/admin/coaches/${u.id}`, { experience_years: 1, description: `${runId} 自動驗收教練` }, u.token)
    u.token = (await api('POST', '/api/users/login', { email: u.email, password: u.password })).data.token
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVyoAAAAASUVORK5CYII=', 'base64')
    const ticket = (await api('POST', '/api/upload', { content_type: 'image/png', size: png.length }, u.token)).data
    const expectedPath = '/' + ticket.key
    function s3URL (raw) {
      const url = new URL(raw)
      if (url.protocol !== 'https:' || url.username || url.password || ![`${c.bucket}.s3.${c.region}.amazonaws.com`, `s3.${c.region}.amazonaws.com`].includes(url.hostname) || ![expectedPath, '/' + c.bucket + expectedPath].includes(decodeURIComponent(url.pathname))) throw Object.assign(new Error('簽名目標不符'), { code: 'UnexpectedS3Target', status: 'FAIL' })
      return url
    }
    const upload = await send(s3URL(ticket.upload_url), { method: 'PUT', headers: { 'content-type': 'image/png' }, body: png })
    if (upload.status !== 200) return { ok: false, actual: `S3 PUT HTTP ${upload.status}` }
    created.photoKey = ticket.key
    await api('POST', '/api/upload/confirm', { key: ticket.key }, u.token)
    await api('PUT', '/api/admin/coaches', { experience_years: 1, description: `${runId} 自動驗收`, skill_ids: [skill.id], profile_image_key: ticket.key }, u.token)
    u.token = (await api('POST', '/api/users/login', { email: u.email, password: u.password })).data.token
    const profile = (await api('GET', '/api/admin/coaches', null, u.token)).data
    const signed = s3URL(profile.profile_image_url)
    const downloaded = await send(signed)
    signed.search = ''
    const unsigned = await send(signed)
    return { ok: profile.profile_image_key === ticket.key && downloaded.status === 200 && downloaded.bytes.equals(png) && unsigned.status === 403,
      actual: `重登 key 相同=${profile.profile_image_key === ticket.key}；簽名 GET=${downloaded.status}；圖片 bytes 相同=${downloaded.bytes.equals(png)}；未簽名 GET=${unsigned.status}；完整簽名 URL 未記錄。` }
  })
  await r.check('flow.course', 10, '建立未來課程並讀回', '專用教練建立課程，再查詢相同 course ID', '回查教練角色、技能種子資料、時間格式及 RDS。', async () => {
    need(user.coach?.token && skill?.id)
    const start = Date.now() + 7 * 86400000
    const payload = { skill_id: skill.id, name: runId, description: '自動驗收專用，請勿報名。', start_at: new Date(start).toISOString(), end_at: new Date(start + 3600000).toISOString(), max_participants: 2, meeting_url: 'https://example.com/final-check' }
    const x = await api('POST', '/api/admin/coaches/courses', payload, user.coach.token)
    const id = x.data?.course?.id; need(id); created.courseId = id
    const back = await api('GET', `/api/admin/coaches/courses/${id}`, null, user.coach.token)
    return { ok: back.data?.id === id && back.data.name === runId, actual: `courseId=${id}；建立後從 API 讀回。` }
  })
  await r.check('flow.purchase', 7, '另一會員模擬購買並查詢紀錄', '沿用既有方案，另一會員購買一次，重新查到相同堂數', '回查方案種子資料、購買 API 與會員紀錄；這個完成版沒有真實金流。', async () => {
    need(user.member?.token && pkg?.id)
    await api('POST', `/api/credit-package/${pkg.id}`, {}, user.member.token)
    created.purchase = { memberId: user.member.id, packageId: pkg.id }
    const x = await api('GET', '/api/users/credit-package', null, user.member.token)
    return { ok: x.data?.length === 1 && Number(x.data[0].purchased_credits) === Number(pkg.credit_amount), actual: `查到 ${x.data?.length || 0} 筆購買；預期堂數=${pkg.credit_amount}；未報名、未扣堂、未寄信。` }
  })
  return { version: VERSION, checkedAt: new Date().toISOString(), target: { url: c.url, instanceId: c.instanceId, region: c.region }, created, checks: r.checks }
}
async function main () {
  const args = process.argv.slice(2); const opt = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allow-test-data') opt.allowTestData = true
    else if (['--config', '--out'].includes(args[i]) && args[i + 1]) opt[args[i++].slice(2)] = args[i]
    else throw new Error('使用：node scripts/check-flow.js --config deploy/check-final.local.json --allow-test-data [--out artifacts/final-flow]')
  }
  if (!opt.config || !opt.allowTestData) throw new Error('需要 --config 與 --allow-test-data；此模式會留下專用測試資料。')
  const c = validateConfig(JSON.parse(fs.readFileSync(opt.config, 'utf8')))
  console.log('將建立兩個測試會員、一張照片、一堂課、一筆模擬購買。保留測試資料；不報名、不寄信。')
  const report = await runFlow(c, { allowTestData: true, onResult: x => console.log(`[${x.status}] ${x.title} — ${x.actual}`) })
  report.scriptSha256 = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')
  const out = path.resolve(opt.out || 'artifacts/final-flow'); fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  fs.writeFileSync(path.join(out, 'report.html'), renderHtml(report), { mode: 0o600 })
  console.log(JSON.stringify(totals(report)) + `\n報告：${out}/report.html`)
  process.exitCode = exitCode(report)
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 2 })
module.exports = { runFlow }
