#!/usr/bin/env node
// LiveFit 最終作業：只讀雲端設定與網站；不安裝服務、不重啟、不寄信。
const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { createHash } = require('node:crypto')
const dns = require('node:dns').promises
const http = require('node:http')
const https = require('node:https')
const exec = promisify(execFile)
const VERSION = '1.2.0'
const LABELS = { PASS: '通過', FAIL: '需修正', BLOCKED: '無法檢查', MANUAL: '待人工驗證' }
const WEEKS = ['01-account-and-cost', '02-iam', '03-vpc', '04-vpc-security', '05-ec2', '06-s3', '07-rds', '08-ses', '09-ecr', '10-container-deploy', '11-nginx-https']
const READS = new Set([
  'sts/get-caller-identity', 'ec2/describe-instances', 'ec2/describe-addresses',
  'ec2/describe-images', 'ec2/describe-security-groups', 'ec2/describe-route-tables',
  'rds/describe-db-instances', 'iam/get-instance-profile',
  'iam/list-role-policies', 'iam/get-role-policy', 'iam/list-attached-role-policies', 'iam/get-policy', 'iam/get-policy-version',
  's3api/get-bucket-location', 's3api/get-public-access-block', 's3api/get-bucket-ownership-controls',
  's3api/get-bucket-policy-status', 's3api/get-bucket-versioning', 's3api/get-bucket-cors',
  's3api/list-object-versions', 's3api/head-object',
  'sesv2/get-email-identity', 'ecr/describe-images',
  'budgets/describe-budget', 'budgets/describe-budgets', 'budgets/describe-notifications-for-budget'
])
function scrub (value) {
  return String(value).replace(/arn:aws[^\s"<>]*/g, '[ARN 已遮蔽]')
    .replace(/\b\d{12}\b/g, '[帳號已遮蔽]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[Email 已遮蔽]')
    .replace(/https?:\/\/[^\s"<>]*\?[^\s"<>]*/g, '[含查詢參數的網址已遮蔽]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[Access Key 已遮蔽]')
}
function problem (code, status = 'BLOCKED') { return Object.assign(new Error(code), { code, status }) }
function commandError (error) {
  const match = String(error.stderr || '').match(/An error occurred \(([^)]+)\)/)
  const code = match?.[1] || (error.killed ? 'Timeout' : error.code === 'ENOENT' ? 'MissingCommand' : 'CommandFailed')
  const missing = /^(NoSuchBucket|NoSuchKey|NoSuchBucketPolicy|NoSuchPublicAccessBlockConfiguration|NoSuchCORSConfiguration|OwnershipControlsNotFoundError|DBInstanceNotFound|ImageNotFoundException|RepositoryNotFoundException|ResourceNotFound|ResourceNotFoundException|NotFound|NotFoundException|NoSuchEntity|InvalidInstanceID.NotFound|404)$/.test(code)
  return problem(code, missing ? 'FAIL' : 'BLOCKED')
}
function validateConfig (c) {
  const u = new URL(c.url)
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' || u.port) throw new Error('url 必須是沒有帳密、路徑或 query 的 HTTPS 網站根網址。')
  if (c.region !== 'ap-northeast-1') throw new Error('本課程使用東京 ap-northeast-1。')
  if (!/^i-[a-f0-9]{8,17}$/.test(c.instanceId)) throw new Error('請填入自己的 EC2 instanceId。')
  for (const key of ['bucket', 'dbInstanceIdentifier', 'repository', 'imageTag', 'sesIdentity', 'budgetName', 'practiceKey']) {
    if (typeof c[key] !== 'string' || !c[key].trim() || /YOUR_|REPLACE|[\r\n\0]/.test(c[key]) || c[key].startsWith('-') || /^fileb?:/.test(c[key])) throw new Error(`請填入有效的 ${key}。`)
  }
  const ip = c.sshCidr?.split('/')[0]?.split('.')
  if (!c.sshCidr?.endsWith('/32') || ip?.length !== 4 || ip.some(n => !/^\d{1,3}$/.test(n) || Number(n) > 255)) throw new Error('sshCidr 請填自己的公開 IPv4/32；不是 CloudShell 的 IP。')
  if (!c.practiceKey.startsWith('practice/')) throw new Error('practiceKey 必須是自己的 practice/ 既有練習物件。')
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(c.bucket)) throw new Error('bucket 格式不正確。')
  return { ...c, url: u.origin }
}
function makeAws (config, profile) {
  return async (service, operation, input = {}) => {
    if (!READS.has(`${service}/${operation}`)) throw problem('ReadOnlyCommandRequired')
    try {
      const args = [service, operation, '--cli-input-json', JSON.stringify(input), '--region', config.region,
        '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '8', '--cli-read-timeout', '15']
      if (profile) args.push('--profile', profile)
      const { stdout } = await exec('aws', args, { timeout: 45000, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off', AWS_MAX_ATTEMPTS: '2', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true' } })
      return JSON.parse(stdout)
    } catch (e) { throw commandError(e) }
  }
}
function request (url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return reject(problem('InvalidURL'))
    const req = (u.protocol === 'https:' ? https : http).request(u, { ...options, rejectUnauthorized: true }, res => {
      const chunks = []; let size = 0
      res.on('data', chunk => { size += chunk.length; if (size > 3 * 1024 * 1024) req.destroy(problem('ResponseTooLarge')); else chunks.push(chunk) })
      res.on('error', reject)
      res.on('end', () => {
        clearTimeout(deadline)
        const text = Buffer.concat(chunks).toString('utf8')
        let json; try { json = JSON.parse(text) } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, bytes: Buffer.concat(chunks) })
      })
    })
    const deadline = setTimeout(() => req.destroy(problem('HTTPTimeout')), 15000)
    req.on('error', e => { clearTimeout(deadline); reject(problem(e.code || 'HTTPError', 'FAIL')) })
    req.end(options.body)
  })
}
function routeFor (tables, subnet) {
  return tables.find(t => t.Associations?.some(a => a.SubnetId === subnet)) || tables.find(t => t.Associations?.some(a => a.Main))
}
function sources (rule) {
  return [...(rule.IpRanges || []).map(x => ['ipv4', x.CidrIp]), ...(rule.Ipv6Ranges || []).map(x => ['ipv6', x.CidrIpv6]),
    ...(rule.UserIdGroupPairs || []).map(x => ['sg', x.GroupId]), ...(rule.PrefixListIds || []).map(x => ['prefix', x.PrefixListId])]
}
function instanceGroupIds (instance) {
  return [...new Set([...(instance.SecurityGroups || []), ...(instance.NetworkInterfaces || []).flatMap(n => n.Groups || [])].map(g => g.GroupId))]
}
function budgetNotification (notifications, type, threshold) {
  // AWS omits ThresholdType for legacy percentage notifications; the Console still displays %.
  return notifications.some(x => x.NotificationType === type && (x.ThresholdType === undefined || x.ThresholdType === 'PERCENTAGE') && x.ComparisonOperator === 'GREATER_THAN' && x.Threshold === threshold)
}
function webRulesCorrect (groups, sshCidr) {
  const rules = groups.flatMap(g => g.IpPermissions || [])
  const tcp = r => ['tcp', '6'].includes(r.IpProtocol)
  return [80, 443].every(p => rules.some(r => tcp(r) && r.FromPort === p && r.ToPort === p && sources(r).some(([t, s]) => t === 'ipv4' && s === '0.0.0.0/0'))) &&
    rules.some(r => tcp(r) && r.FromPort === 22 && r.ToPort === 22 && sources(r).some(([t, s]) => t === 'ipv4' && s === sshCidr)) &&
    rules.every(r => tcp(r) && r.FromPort === r.ToPort && [22, 80, 443].includes(r.FromPort) && sources(r).length > 0 &&
      sources(r).every(([t, s]) => r.FromPort === 22 ? t === 'ipv4' && s === sshCidr : (t === 'ipv4' && s === '0.0.0.0/0') || (t === 'ipv6' && s === '::/0')))
}
function dbRulesCorrect (groups, webIds) {
  const rules = groups.flatMap(g => g.IpPermissions || [])
  return rules.length > 0 && rules.every(r => ['tcp', '6'].includes(r.IpProtocol) && r.FromPort === 5432 && r.ToPort === 5432 &&
    sources(r).length > 0 && sources(r).every(([t, s]) => t === 'sg' && webIds.includes(s)))
}
function makeReporter (onResult = () => {}) {
  const checks = []
  async function check (id, week, title, expected, fix, action) {
    let status = 'PASS'; let actual; let nextStep
    try {
      const result = await action()
      if (!result || typeof result.ok !== 'boolean') throw problem('IncompleteEvidence')
      status = result.ok ? 'PASS' : 'FAIL'; actual = result.actual
    } catch (e) { status = e.status || 'BLOCKED'; actual = `${e.code || 'CheckError'}；本項未取得足夠證據。`; nextStep = e.fix }
    const row = { id, week: `W${week}`, title, status, expected, actual: scrub(actual), fix,
      lesson: `https://gonsakon.github.io/aws-course-hub/#/weeks/${WEEKS[week - 1]}/learn` }
    if (status === 'BLOCKED') row.fix = nextStep || '先確認 AWS 登入、查詢權限及網路，再重跑；不要為通過檢查而擴大 EC2 執行角色。原檢查：' + fix
    checks.push(row); onResult(row)
  }
  function manual (id, week, title, expected, fix) {
    const row = { id, week: `W${week}`, title, status: 'MANUAL', expected, actual: '本腳本未驗證。', fix,
      lesson: `https://gonsakon.github.io/aws-course-hub/#/weeks/${WEEKS[week - 1]}/learn` }
    checks.push(row); onResult(row)
  }
  return { checks, check, manual }
}
async function runChecks (c, deps = {}) {
  const aws = deps.aws || makeAws(c, deps.profile)
  const get = deps.request || request
  const resolve4 = deps.resolve4 || dns.resolve4
  const now = deps.now || new Date()
  const r = makeReporter(deps.onResult)
  const check = (id, week, title, expected, fix, action) => r.check(id, week, title, expected, fix, async () => {
    const issue = deps.discoveryIssues && require('./discover-final').discoveryIssue(id, deps.discoveryIssues)
    if (issue) throw Object.assign(problem('ResourceNotIdentified'), { fix: issue })
    return action()
  })
  const cache = new Map()
  function cached (key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key) }
  const identity = () => cached('identity', () => aws('sts', 'get-caller-identity'))
  const ec2 = () => cached('ec2', async () => {
    const x = (await aws('ec2', 'describe-instances', { InstanceIds: [c.instanceId] })).Reservations?.flatMap(x => x.Instances || []).find(x => x.InstanceId === c.instanceId)
    if (!x) throw problem('InstanceNotFound', 'FAIL'); return x
  })
  const db = () => cached('db', async () => {
    const x = (await aws('rds', 'describe-db-instances', { DBInstanceIdentifier: c.dbInstanceIdentifier })).DBInstances?.find(x => x.DBInstanceIdentifier === c.dbInstanceIdentifier)
    if (!x) throw problem('DatabaseNotFound', 'FAIL'); return x
  })
  const tables = vpc => cached(`route:${vpc}`, () => aws('ec2', 'describe-route-tables', { Filters: [{ Name: 'vpc-id', Values: [vpc] }] }).then(x => x.RouteTables))
  const groups = ids => cached(`sg:${ids.join(',')}`, async () => {
    const list = (await aws('ec2', 'describe-security-groups', { GroupIds: ids })).SecurityGroups
    if (!list || list.length !== ids.length) throw problem('IncompleteSecurityGroups'); return list
  })
  await check('web.https', 11, 'HTTPS 首頁', '有效 TLS 憑證，HTTP 200 且為 LiveFit HTML', '回查 DNS、443 SG、Nginx、憑證及映像內的前端檔案。', async () => {
    const x = await get(c.url); return { ok: x.status === 200 && /text\/html/.test(x.headers['content-type']) && /LiveFit/i.test(x.text), actual: `HTTP ${x.status}；TLS 驗證保持開啟。` }
  })
  await check('web.redirect', 11, 'HTTP 轉 HTTPS', '301 或 308 轉到同網域 HTTPS，保留 /login 路徑', '回查 Nginx 80 server 區塊的轉址。', async () => {
    const x = await get(c.url.replace('https:', 'http:') + '/login')
    return { ok: [301, 308].includes(x.status) && new URL(x.headers.location || '/', c.url).href === c.url + '/login', actual: `HTTP ${x.status}；Location=${scrub(x.headers.location || '沒有轉址')}` }
  })
  await check('web.ready', 7, '後端資料庫查詢', '/ready HTTP 200 且 status=ready', '回查容器日誌、RDS SG、DB 環境變數及 TLS CA。這不能單獨證明 DB 為私有。', async () => {
    const x = await get(c.url + '/ready'); return { ok: x.status === 200 && x.json?.status === 'ready', actual: `HTTP ${x.status}；status=${x.json?.status || '非預期 JSON'}` }
  })
  await check('web.routing', 10, '前端重整與 API 404', '/coach/profile 是 HTML，未知 /api 路徑回 404', '回查映像內前端路由回退；API 不可回退成首頁。', async () => {
    const [a, b] = await Promise.all([get(c.url + '/coach/profile'), get(c.url + '/api/final-check-route-does-not-exist')])
    return { ok: a.status === 200 && /text\/html/.test(a.headers['content-type']) && /LiveFit/i.test(a.text) && b.status === 404 && b.json?.status === 'failed', actual: `前端 HTTP ${a.status}；未知 API HTTP ${b.status}` }
  })
  await check('web.auth', 10, '會員資料需要登入', '/api/users/profile 未登入回 401', '回查部署版本與 auth middleware，不能公開會員資料。', async () => {
    const x = await get(c.url + '/api/users/profile'); return { ok: x.status === 401 && x.json?.status === 'failed', actual: `HTTP ${x.status}` }
  })
  await check('aws.identity', 2, 'AWS 查詢身分', '取得當次 AWS 登入身分', '在自己的 AWS CloudShell 或已登入的 CLI 執行。', async () => {
    const x = await identity(); return { ok: Boolean(x.Account && x.Arn), actual: `登入身分類型：${x.Arn?.includes(':assumed-role/') ? 'Role session' : x.Arn?.includes(':user/') ? 'IAM User' : '其他'}；只保存帳號末四碼 ${x.Account?.slice(-4)}` }
  })
  await check('cost.budget', 1, '月預算與通知門檻', 'USD 30 月成本預算；實際 85%／100%、預測 100%', '依 W1 回查自己的既有預算；預算不會自動封頂或關機。', async () => {
    const input = { AccountId: (await identity()).Account, BudgetName: c.budgetName }
    const b = (await aws('budgets', 'describe-budget', input)).Budget
    const n = (await aws('budgets', 'describe-notifications-for-budget', input)).Notifications || []
    const has = (type, threshold) => budgetNotification(n, type, threshold)
    return { ok: b?.BudgetType === 'COST' && b.TimeUnit === 'MONTHLY' && b.BudgetLimit?.Unit === 'USD' && Number(b.BudgetLimit.Amount) === 30 && has('ACTUAL', 85) && has('ACTUAL', 100) && has('FORECASTED', 100), actual: `月期=${b?.TimeUnit}；金額=${b?.BudgetLimit?.Amount} ${b?.BudgetLimit?.Unit}；通知門檻 ${n.length} 個；未讀取帳單或收件人。` }
  })
  await check('ec2.machine', 5, '指定 EC2 規格與狀態', '東京、running、t4g.micro、arm64', '核對 instanceId、Region、實例狀態與 ARM64 映像。', async () => {
    const x = await ec2(); return { ok: x.State?.Name === 'running' && x.InstanceType === 't4g.micro' && x.Architecture === 'arm64' && x.Placement?.AvailabilityZone?.startsWith(c.region), actual: `${x.InstanceId}；${x.State?.Name}；${x.InstanceType}；${x.Architecture}；${x.Placement?.AvailabilityZone}` }
  })
  await check('ec2.ubuntu', 5, 'EC2 Ubuntu AMI', 'AMI 名稱標示 Ubuntu 24.04 ARM64', '核對 W5 使用的 Ubuntu 24.04 ARM64；AMI 名稱不能取代主機內版本查詢。', async () => {
    const x = await ec2(); const a = (await aws('ec2', 'describe-images', { ImageIds: [x.ImageId] })).Images?.[0]
    return { ok: a?.OwnerId === '099720109477' && /ubuntu/i.test(a.Name) && /24.04/.test(a.Name) && a.Architecture === 'arm64', actual: `AMI ${x.ImageId}；官方 Ubuntu 24.04 ARM64=${Boolean(a?.OwnerId === '099720109477' && /ubuntu.*24.04/i.test(a.Name || '') && a.Architecture === 'arm64')}` }
  })
  await check('ec2.eip', 5, '網站確實指向本次 EC2', 'EIP 關聯指定 EC2，網域 A 記錄只指向此 EIP', '回查 EIP association 與 DNS／nip.io；本課程是直接連 EC2。', async () => {
    const x = await ec2()
    const a = (await aws('ec2', 'describe-addresses', { Filters: [{ Name: 'instance-id', Values: [c.instanceId] }] })).Addresses || []
    const ips = await resolve4(new URL(c.url).hostname)
    return { ok: a.some(a => a.InstanceId === c.instanceId && a.PublicIp === x.PublicIpAddress && a.AllocationId) && ips.length > 0 && ips.every(ip => ip === x.PublicIpAddress), actual: `EC2 公開 IP=${x.PublicIpAddress}；DNS=${ips.join(', ')}；EIP 關聯 ${a.length} 個` }
  })
  await check('network.public', 3, 'EC2 Public Subnet 的實際路由', '有效關聯 Route Table 有 active 0.0.0.0/0 → IGW', '從 EC2 的 subnet 回查明確關聯或 main route table，不以名稱判斷。', async () => {
    const x = await ec2(); const t = routeFor(await tables(x.VpcId), x.SubnetId)
    return { ok: Boolean(t?.Routes?.some(x => x.DestinationCidrBlock === '0.0.0.0/0' && x.GatewayId?.startsWith('igw-') && x.State === 'active')), actual: `Subnet=${x.SubnetId}；有效 Route Table=${t?.RouteTableId || '找不到'}` }
  })
  await check('network.web-sg', 4, 'EC2 全部掛載 SG 的合併入站規則', c.discoveryMode ? '只開 80／443 公網與 22 單一 IPv4/32；該 IP 是否為自己的電腦另行確認' : '只開 80／443 公網與 22 指定 My IP/32', '移除額外 SG 或過寬規則；確認 22 的 IP 是自己的電腦，不是 CloudShell IP。', async () => {
    const ids = instanceGroupIds(await ec2())
    const gs = await groups(ids)
    return { ok: webRulesCorrect(gs, c.sshCidr), actual: `實際 SG=${ids.join(', ')}；共 ${gs.reduce((n, x) => n + (x.IpPermissions?.length || 0), 0)} 條入站規則，包含所有附加 SG。` }
  })
  await check('rds.settings', 7, '指定 RDS 狀態與儲存', 'available、PostgreSQL 17、db.t4g.micro、20 GiB gp3、加密、Single-AZ、備份 3 天', '回查 W7 RDS 設定；腳本不會調整規格、建立或還原資料庫。', async () => {
    const x = await db(); return { ok: x.DBInstanceStatus === 'available' && x.Engine === 'postgres' && x.EngineVersion?.startsWith('17.') && x.DBInstanceClass === 'db.t4g.micro' && x.AllocatedStorage === 20 && x.StorageType === 'gp3' && x.StorageEncrypted === true && x.MultiAZ === false && x.BackupRetentionPeriod === 3,
      actual: `${x.DBInstanceStatus}；${x.Engine} ${x.EngineVersion}；${x.DBInstanceClass}；${x.AllocatedStorage} GiB ${x.StorageType}；encrypted=${x.StorageEncrypted}；MultiAZ=${x.MultiAZ}；備份=${x.BackupRetentionPeriod} 天` }
  })
  await check('rds.private', 7, 'RDS 私有與跨 AZ Subnet Group', 'PubliclyAccessible=false、與 EC2 同 VPC、至少兩 AZ，所有 DB 子網只有 local route', '回查實際 DB Subnet Group 的每個子網與路由；不可讓 DB 接 Public Route Table。', async () => {
    const x = await db(); const e = await ec2(); const subnets = x.DBSubnetGroup?.Subnets || []
    const ts = await tables(x.DBSubnetGroup?.VpcId)
    const privateAll = subnets.length >= 2 && subnets.every(s => { const t = routeFor(ts, s.SubnetIdentifier); return t?.Routes?.length > 0 && t.Routes.every(r => r.GatewayId === 'local' && r.State === 'active') })
    return { ok: x.PubliclyAccessible === false && x.DBSubnetGroup?.VpcId === e.VpcId && new Set(subnets.map(s => s.SubnetAvailabilityZone?.Name).filter(Boolean)).size >= 2 && privateAll,
      actual: `PubliclyAccessible=${x.PubliclyAccessible}；同 VPC=${x.DBSubnetGroup?.VpcId === e.VpcId}；DB 子網 ${subnets.length} 個；所有有效路由僅 local=${privateAll}` }
  })
  await check('network.db-sg', 4, 'RDS 全部 SG 的合併入站規則', '僅 TCP 5432，source 只能是本次 EC2 掛載的 Web SG', '移除 0.0.0.0/0、IPv6、CIDR、其他 SG 或全通訊協定規則，使用 Web SG ID。', async () => {
    const d = await db(); const e = await ec2(); const ids = d.VpcSecurityGroups.map(x => x.VpcSecurityGroupId)
    return { ok: dbRulesCorrect(await groups(ids), instanceGroupIds(e)), actual: `RDS SG=${ids.join(', ')}；逐條核對協定、埠與 SG source。` }
  })
  await check('iam.runtime-role', 10, 'EC2 Instance Profile 的實際 Role', '掛載含一個 EC2 trust Role 的 Instance Profile；IMDSv2 required，hop limit 2', '回查 W2／W10 的 EC2 Role、trust 與 Metadata options；不把 User Access Key 填進容器。', async () => {
    const x = await ec2(); if (!x.IamInstanceProfile?.Arn) return { ok: false, actual: 'EC2 未掛 Instance Profile。' }
    const name = x.IamInstanceProfile.Arn.split('/').pop()
    const p = (await aws('iam', 'get-instance-profile', { InstanceProfileName: name })).InstanceProfile
    const role = p?.Roles?.[0]; let trust = role?.AssumeRolePolicyDocument
    if (typeof trust === 'string') trust = JSON.parse(decodeURIComponent(trust))
    const statements = [].concat(trust?.Statement || [])
    const trusted = statements.some(s => s.Effect === 'Allow' && [].concat(s.Principal?.Service || []).includes('ec2.amazonaws.com') && [].concat(s.Action || []).includes('sts:AssumeRole'))
    return { ok: p?.Roles?.length === 1 && trusted && x.MetadataOptions?.HttpEndpoint === 'enabled' && x.MetadataOptions?.HttpTokens === 'required' && x.MetadataOptions?.HttpPutResponseHopLimit === 2,
      actual: `Profile=${name}；Role=${role?.RoleName || '無'}；EC2 trust=${trusted}；HttpTokens=${x.MetadataOptions?.HttpTokens}；hop=${x.MetadataOptions?.HttpPutResponseHopLimit}；未據此宣稱 IAM Allow／Deny 實測通過。` }
  })
  const bucketInput = async () => ({ Bucket: c.bucket, ExpectedBucketOwner: (await identity()).Account })
  for (const [id, title, operation, expected, evaluate] of [
    ['region', 'S3 區域', 'get-bucket-location', 'Bucket 位於東京', x => [x.LocationConstraint === c.region, `Region=${x.LocationConstraint || 'us-east-1'}`]],
    ['block', 'S3 Block Public Access', 'get-public-access-block', '四個 Block Public Access 全開', x => { const b = x.PublicAccessBlockConfiguration; return [b && ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(k => b[k] === true), `四項設定=${JSON.stringify(b)}`] }],
    ['ownership', 'S3 物件擁有權', 'get-bucket-ownership-controls', 'BucketOwnerEnforced，ACL 停用', x => [x.OwnershipControls?.Rules?.some(r => r.ObjectOwnership === 'BucketOwnerEnforced') === true, `Ownership=${x.OwnershipControls?.Rules?.[0]?.ObjectOwnership}`]],
    ['version', 'S3 版本控制', 'get-bucket-versioning', 'Versioning=Enabled', x => [x.Status === 'Enabled', `Versioning=${x.Status || '未啟用'}`]],
    ['cors', 'S3 瀏覽器 CORS', 'get-bucket-cors', '僅本次 HTTPS origin；允許 PUT／GET／HEAD 與 content-type', x => {
      const rules = x.CORSRules || []; const covers = method => rules.some(r => r.AllowedOrigins?.includes(c.url) && r.AllowedMethods?.includes(method) && (method !== 'PUT' || r.AllowedHeaders?.some(h => ['*', 'content-type'].includes(h.toLowerCase()))))
      return [rules.length > 0 && rules.every(r => r.AllowedOrigins?.length > 0 && r.AllowedOrigins.every(o => o === c.url)) && ['PUT', 'GET', 'HEAD'].every(covers), `CORS 規則 ${rules.length} 條；只核對 origin／methods／上傳 header，不代替瀏覽器上傳實測。`]
    }]
  ]) await check(`s3.${id}`, 6, title, expected, '依 W6 回查自己的 Bucket 設定，保持私有，網站 origin 不含路徑。', async () => {
    const x = await aws('s3api', operation, await bucketInput()); const [ok, actual] = evaluate(x); return { ok: Boolean(ok), actual }
  })
  await check('s3.policy', 6, 'S3 Bucket Policy 公開狀態', 'PolicyStatus.IsPublic=false 或確定沒有 Bucket Policy', '回查 Bucket Policy；AccessDenied 不是沒有 Policy。', async () => {
    try { const x = await aws('s3api', 'get-bucket-policy-status', await bucketInput()); return { ok: x.PolicyStatus?.IsPublic === false, actual: `Policy IsPublic=${x.PolicyStatus?.IsPublic}` } }
    catch (e) { if (e.code === 'NoSuchBucketPolicy') return { ok: true, actual: 'AWS 明確回 NoSuchBucketPolicy；沒有 Bucket Policy。' }; throw e }
  })
  await check('s3.practice', 6, '同名物件版本與未簽名存取', '指定 practice/ 物件存在，有至少兩個不同 VersionId；未簽名 GET 回 403', '先完成 W6 同 key 覆寫練習；不存在物件或查詢權限不足不能當作私有通過。', async () => {
    const input = await bucketInput()
    await aws('s3api', 'head-object', { ...input, Key: c.practiceKey })
    const v = await aws('s3api', 'list-object-versions', { ...input, Prefix: c.practiceKey })
    const count = new Set((v.Versions || []).filter(x => x.Key === c.practiceKey && x.VersionId && x.VersionId !== 'null').map(x => x.VersionId)).size
    const unsigned = await get(`https://s3.${c.region}.amazonaws.com/${c.bucket}/${c.practiceKey.split('/').map(encodeURIComponent).join('/')}`)
    return { ok: count >= 2 && unsigned.status === 403, actual: `HeadObject 確認存在；同 key 版本=${count}；未簽名 GET HTTP ${unsigned.status}` }
  })
  await check('ses.identity', 8, 'SES 寄件身分', '東京的指定 Identity 已驗證並可寄送', '回查東京 SES Verified Identity；此項只讀設定，不寄測試信。', async () => {
    const x = await aws('sesv2', 'get-email-identity', { EmailIdentity: c.sesIdentity })
    return { ok: x.VerifiedForSendingStatus === true && x.VerificationStatus === 'SUCCESS', actual: `VerifiedForSendingStatus=${x.VerifiedForSendingStatus}；VerificationStatus=${x.VerificationStatus}；寄件身分已遮蔽。` }
  })
  await check('ecr.image', 9, 'ECR 指定映像版本', '自己帳號的 private ECR repository 有指定 tag 與 digest', '核對 W9 build／tag／push 的 repository、Region 與 tag，保存 commit 對照。', async () => {
    const x = await aws('ecr', 'describe-images', { repositoryName: c.repository, imageIds: [{ imageTag: c.imageTag }], registryId: (await identity()).Account })
    const i = x.imageDetails?.find(x => x.imageTags?.includes(c.imageTag))
    return { ok: /^sha256:[0-9a-f]{64}$/.test(i?.imageDigest || ''), actual: `repository=${c.repository}；tag=${c.imageTag}；digest=${i?.imageDigest || '找不到'}` }
  })
  if (deps.hostReport) {
    await check('host.verified', 10, '主機報告與雲端資源對照', '同 EC2、30 分鐘內、主機檢查全數通過，DB／S3／執行 digest 相符', '依 docs/final-check.md 重跑 SSH 主機檢查並附 --host-report；不能借用別人的報告。', async () => {
      const h = deps.hostReport
      const ids = ['host.os', 'host.user', 'host.single', 'host.health', 'host.binding', 'host.restart', 'host.container-user', 'host.image', 'host.env-file', 'host.runtime', 'host.nginx', 'host.certbot-timer']
      const age = now.getTime() - Date.parse(h.checkedAt)
      if (!Number.isFinite(age) || age < -60000 || age > 1800000) throw problem('StaleHostReport')
      if (h.error || h.checks?.some(x => x.status === 'BLOCKED')) throw problem('HostCheckBlocked')
      const d = await db(); const img = await aws('ecr', 'describe-images', { repositoryName: c.repository, imageIds: [{ imageTag: c.imageTag }], registryId: (await identity()).Account })
      const digest = img.imageDetails?.find(i => i.imageTags?.includes(c.imageTag))?.imageDigest
      const match = h.instanceId === c.instanceId && h.region === c.region && h.runtime?.dbHost === d.Endpoint?.Address && h.runtime?.bucket === c.bucket && h.runtime?.region === c.region && digest && h.imageDigests?.includes(digest)
      const all = ids.every(id => h.checks?.filter(x => x.id === id).length === 1 && h.checks.find(x => x.id === id).status === 'PASS')
      return { ok: Boolean(match && all), actual: `同組資源／映像=${Boolean(match)}；主機 ${ids.length} 項全通過=${all}；未通過=${(h.checks || []).filter(x => x.status !== 'PASS').map(x => x.id).join(', ') || '無'}；報告為學生自查證據，仍需克庭抽查。` }
    })
  } else r.manual('manual.runtime', 10, '主機內 Compose／環境與版本對照', 'deployer、Healthy、單容器、127.0.0.1:8080、DB TLS、執行 digest 對上 ECR', '使用 docs/final-check.md 的主機檢查命令，再以 --host-report 加入同次報告。')
  if (c.discoveryMode) r.manual('manual.ssh-owner', 4, 'SSH 來源是自己的電腦', '22 限制的單一 /32 與自己電腦的公開 IP 一致', 'CloudShell 的來源 IP 無法代表自己的電腦；現場 SSH 成功並核對 My IP。')
  r.manual('manual.permissions', 2, '實際 IAM Allow／Deny', '以 EC2 Role 正確資源證明 pull 成功、push 拒絕', '依 W2／W9／W10 提供受控實測。User 查得到設定不代表 EC2 Role 有權限。')
  r.manual('manual.flow', 10, '網站功能與 S3 照片', '註冊登入、照片上傳並重登讀回、建立課程、模擬購買', '可用 npm run check:flow -- --config deploy/check-final.local.json --allow-test-data；會建立專用測試資料，詳見操作文件。')
  r.manual('manual.mail', 8, '報名、堂數與通知實收', '報名記錄與扣堂正確，SES accepted 與實際信箱收到分開留證', '使用自己已驗證且同意收信的信箱現場操作；不要將 accepted 當成實收。老師端仍待補整合驗證。')
  r.manual('manual.persistence', 7, '重啟保存與還原', '重啟 app 後資料與照片仍在；備份存在與還原成功分開記錄', '依驗收時段手動重啟及留證；腳本不重啟、不停機、不做還原。')
  r.manual('manual.renewal', 11, 'HTTPS 續期維護', 'certbot renew --dry-run 通過且 timer active', '依 W11 手動執行並留證；有效的現行憑證不能證明續期成功。')
  r.manual('manual.explanation', 1, '設計解釋、費用與保留決定', '依最終作業四題用自己的話說明，附保留／清除時間', '自查報告是可修改的證據，克庭仍須抽查同一資源與版本；不據此自動評分。')
  return { version: VERSION, checkedAt: now.toISOString(), target: { url: c.url, region: c.region, instanceId: c.instanceId, dbInstanceIdentifier: c.dbInstanceIdentifier, repository: c.repository, imageTag: c.imageTag }, checks: r.checks }
}
function totals (report) { return Object.fromEntries(Object.keys(LABELS).map(s => [s, report.checks.filter(x => x.status === s).length])) }
function exitCode (report) { const t = totals(report); return t.FAIL ? 1 : t.BLOCKED ? 2 : 0 }
function renderHtml (report) {
  const escape = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]))
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LiveFit 最終作業自查</title><style>body{font:16px/1.7 system-ui,sans-serif;background:#f5f7fa;color:#17283a;margin:0;padding:24px}main{max-width:960px;margin:auto}h1{font-size:28px}article{background:white;border:1px solid #d7e0e9;border-left:5px solid #65758b;padding:18px;margin:16px 0;border-radius:8px;overflow-wrap:anywhere}article.PASS{border-left-color:#24804c}article.FAIL{border-left-color:#bc3535}article.BLOCKED{border-left-color:#b47700}h2{font-size:19px;margin:0}p{margin:8px 0}.meta{font-size:14px;color:#496078}.counts{display:flex;flex-wrap:wrap;gap:12px}.counts span{padding:8px 14px;background:#e4ebf2;border-radius:6px}a{color:#176087}@media print{body{padding:0;background:white}article{break-inside:avoid}}</style><main><h1>LiveFit 最終作業自查報告</h1><p>這是部署快照，供學生修正與克庭抽查；不是完整合格證明。權限不足會列「無法檢查」。本版不含監控；報名通知實收等人工項仍須補證據。</p><p class="meta">時間 ${escape(report.checkedAt)} · checker ${escape(report.version)}<br>網站 ${escape(report.target.url)}<br>EC2 ${escape(report.target.instanceId)} · ${escape(report.target.region)}<br>程式 SHA-256 ${escape(report.scriptSha256 || '')}</p><div class="counts">${Object.entries(totals(report)).map(([k, v]) => `<span>${LABELS[k]} ${v}</span>`).join('')}</div>${report.checks.map(x => `<article class="${x.status}"><h2>${LABELS[x.status]} · ${escape(x.week)} ${escape(x.title)}</h2><p class="meta">${escape(x.id)}</p><p><b>預期：</b>${escape(x.expected)}</p><p><b>實際：</b>${escape(x.actual)}</p>${x.status === 'PASS' ? '' : `<p><b>下一步：</b>${escape(x.fix)}</p>`}<a href="${escape(x.lesson)}">對照講義</a></article>`).join('')}</main></html>`
}
function parseArgs (args) {
  const result = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') result.help = true
    else if (['--config', '--out', '--profile', '--host-report'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) result[args[i++].slice(2)] = args[i]
    else if (args[i].startsWith('https://') && !result.url) result.url = args[i]
    else throw new Error(`未知或缺少值的參數：${args[i]}`)
  }
  if (!result.help && !result.config && !result.url) throw new Error('請在指令後面填自己的 HTTPS 網址：npm run check:final -- https://你的網址')
  if (result.config && result.url) throw new Error('網址與 --config 請擇一使用。')
  return result
}
async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) return console.log('npm run check:final -- https://你的網站\n自動找東京的對應 AWS 資源，有多個候選才詢問。只讀；需 Node.js 20.19+ 與已登入的 AWS CLI v2。\n老師進階：--config FILE、--profile NAME、--host-report FILE、--out DIR。')
  let c; let discovery
  if (args.url) {
    console.log('正在依網站網址尋找東京的 AWS 資源；不需填 JSON。')
    const { discover, terminalChoose } = require('./discover-final')
    discovery = await discover(args.url, { profile: args.profile, choose: terminalChoose })
    c = discovery.config
    for (const issue of Object.values(discovery.issues)) console.log('待確認：' + issue)
  } else c = validateConfig(JSON.parse(fs.readFileSync(args.config, 'utf8')))
  console.log('LiveFit 最終作業自查：只讀 AWS 設定與網站，不重啟、不寄信。')
  const hostReport = args['host-report'] ? JSON.parse(fs.readFileSync(args['host-report'], 'utf8')) : undefined
  const report = await runChecks(c, { profile: args.profile, hostReport, discoveryIssues: discovery?.issues, onResult: x => console.log(`[${LABELS[x.status]}] ${x.week} ${x.title} — ${x.actual}`) })
  if (discovery) {
    report.discovery = { notes: discovery.notes, unresolved: discovery.issues }
    report.discoverySha256 = createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'discover-final.js'))).digest('hex')
  }
  report.scriptSha256 = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')
  report.configSha256 = createHash('sha256').update(JSON.stringify(c)).digest('hex')
  const out = path.resolve(args.out || 'artifacts/final-check')
  fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  if (discovery && Object.keys(discovery.issues).length === 0) fs.writeFileSync(path.join(out, 'resources.local.json'), JSON.stringify(c, null, 2) + '\n', { mode: 0o600 })
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  fs.writeFileSync(path.join(out, 'report.html'), renderHtml(report), { mode: 0o600 })
  console.log(`\n${Object.entries(totals(report)).map(([s, n]) => `${LABELS[s]} ${n}`).join(' / ')}\n報告：${out}/report.html\n退出碼 0 也不代表人工項已完成。`)
  process.exitCode = exitCode(report)
}
module.exports = { VERSION, READS, scrub, commandError, validateConfig, makeAws, request, routeFor, webRulesCorrect, dbRulesCorrect, instanceGroupIds, budgetNotification, makeReporter, runChecks, totals, exitCode, renderHtml, parseArgs }
if (require.main === module) main().catch(e => { console.error(scrub(e.message)); process.exitCode = 2 })
