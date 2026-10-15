// Discover only from the website's EC2 and its attached role; never choose the first account resource.
const dns = require('node:dns').promises
const net = require('node:net')
const { makeAws, instanceGroupIds, scrub, policyDocument } = require('./check-final')
const FIELDS = {
  instanceId: ['ec2.', 'network.', 'rds.private', 'iam.', 'host.'],
  dbInstanceIdentifier: ['rds.', 'network.db-sg', 'host.'],
  bucket: ['s3.', 'host.'], practiceKey: ['s3.practice'],
  repository: ['ecr.', 'host.'], imageTag: ['ecr.', 'host.'],
  sesIdentity: ['ses.'], budgetName: ['cost.']
}
function validateUrl (raw) {
  const u = new URL(raw)
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' || u.port) throw new Error('請只填自己的 HTTPS 網站根網址。')
  return u.origin
}
function roleResources (documents, service, region, account) {
  const values = new Set(); let broad = false
  for (const document of documents) {
    const statements = document?.Statement
    for (const s of Array.isArray(statements) ? statements : statements ? [statements] : []) {
      if (s.Effect !== 'Allow') continue
      const actions = [s.Action].flat().filter(Boolean).map(a => a.toLowerCase()).filter(a => !['ecr:getauthorizationtoken', 's3:listallmybuckets', 's3:getaccountpublicaccessblock'].includes(a))
      if (!actions.some(a => a === '*' || a.startsWith(service + ':'))) continue
      for (const resource of [s.Resource].flat().filter(Boolean)) {
        if (resource === '*') { broad = true; continue }
        const m = resource.match(/^arn:aws:([^:]+):([^:]*):([^:]*):(.*)$/)
        if (!m || m[1] !== service || (service !== 's3' && (m[2] !== region || m[3] !== account))) continue
        const value = service === 's3' ? m[4].split('/')[0] : m[4].replace(/^(repository|identity)\//, '')
        if (/[?*]/.test(value)) broad = true
        else if (value) values.add(value)
      }
    }
  }
  if (broad) throw new Error('EC2 Role 使用共用或萬用資源權限，無法據此確定這個網站使用哪個資源；請回查本次網站的部署設定。')
  return [...values].sort()
}
async function discover (raw, deps = {}) {
  const c = { url: validateUrl(raw), region: 'ap-northeast-1', discoveryMode: true }
  const aws = deps.aws || makeAws(c, deps.profile)
  const issues = {}; const notes = []
  const choose = deps.choose || (async () => undefined)
  async function select (name, items, label = x => String(x)) {
    if (!items.length) throw new Error(`找不到${name}；請確認部署完成且登入正確的 AWS 帳號。`)
    if (items.length === 1) return items[0]
    const labels = items.map(label)
    const index = await choose(name, labels)
    if (!Number.isInteger(index) || index < 0 || index >= items.length) throw new Error(`${name}有 ${items.length} 個候選，尚未選擇。請在 CloudShell 互動終端重新執行，再選擇自己的資源。`)
    return items[index]
  }
  async function field (key, fn) {
    try { c[key] = await fn(); return c[key] }
    catch (e) { issues[key] = scrub(e.code ? `${key}：${e.code}；請確認 AWS 查詢權限後重跑。` : e.message) }
  }
  const identity = await aws('sts', 'get-caller-identity').catch(e => {
    notes.push(`AWS 登入未確認：${e.code || 'LoginUnavailable'}。網站項目仍會繼續檢查。`)
    return undefined
  })
  let ec2
  await field('instanceId', async () => {
    const host = new URL(c.url).hostname
    const ips = net.isIP(host) === 4 ? [host] : await (deps.resolve4 || dns.resolve4)(host)
    if (ips.length !== 1) throw new Error('網站必須直接指向一個 EC2 公開 IPv4；多個 DNS 結果不能自行挑選。')
    const result = await aws('ec2', 'describe-instances', { Filters: [{ Name: 'ip-address', Values: ips }] })
    ec2 = await select('網站對應的 EC2', (result.Reservations || []).flatMap(r => r.Instances || []).filter(i => i.PublicIpAddress === ips[0]), i => i.InstanceId)
    return ec2.InstanceId
  })
  let documents
  try {
    if (!ec2?.IamInstanceProfile?.Arn || !identity?.Account) throw new Error('尚未找到網站 EC2 的 Role 或 AWS 帳號，無法確認 S3／ECR／SES。')
    const profile = await aws('iam', 'get-instance-profile', { InstanceProfileName: ec2.IamInstanceProfile.Arn.split('/').pop() })
    if (profile.InstanceProfile?.Roles?.length !== 1) throw new Error('EC2 Instance Profile 沒有唯一 Role。')
    const RoleName = profile.InstanceProfile.Roles[0].RoleName
    documents = []
    const inline = await aws('iam', 'list-role-policies', { RoleName })
    for (const PolicyName of inline.PolicyNames || []) documents.push(policyDocument((await aws('iam', 'get-role-policy', { RoleName, PolicyName })).PolicyDocument))
    const attached = await aws('iam', 'list-attached-role-policies', { RoleName })
    for (const p of attached.AttachedPolicies || []) {
      const policy = await aws('iam', 'get-policy', { PolicyArn: p.PolicyArn })
      documents.push(policyDocument((await aws('iam', 'get-policy-version', { PolicyArn: p.PolicyArn, VersionId: policy.Policy.DefaultVersionId })).PolicyVersion.Document))
    }
  } catch (e) {
    documents = undefined
    for (const key of ['bucket', 'repository', 'sesIdentity']) issues[key] = scrub(`無法從 EC2 Role 找資源：${e.code || e.message}`)
  }
  if (documents) {
    for (const [key, service, name] of [['bucket', 's3', '圖片 Bucket'], ['repository', 'ecr', '映像 Repository'], ['sesIdentity', 'ses', 'SES 寄件身分']]) {
      await field(key, async () => select(name, roleResources(documents, service, c.region, identity.Account), value => service === 'ses' ? value.replace(/^(.{1,2}).*(@.*)$/, '$1…$2') : value))
    }
    notes.push('S3／ECR／SES 依 EC2 Role 明列的資源找到；仍需主機抽查確認應用實際使用它們，這不等於 IAM 權限驗證通過。')
  }
  await field('dbInstanceIdentifier', async () => {
    if (!ec2?.VpcId) throw new Error('EC2 尚未確認，無法找同 VPC 的 RDS。')
    const dbs = (await aws('rds', 'describe-db-instances')).DBInstances || []
    return (await select('同 VPC 的 RDS', dbs.filter(d => d.DBSubnetGroup?.VpcId === ec2.VpcId).sort((a, b) => a.DBInstanceIdentifier.localeCompare(b.DBInstanceIdentifier)), d => d.DBInstanceIdentifier)).DBInstanceIdentifier
  })
  await field('budgetName', async () => {
    if (!identity?.Account) throw new Error('AWS 登入身分尚未確認，無法讀取費用預算。')
    const budgets = (await aws('budgets', 'describe-budgets', { AccountId: identity.Account })).Budgets || []
    return (await select('費用預算', budgets.filter(b => b.BudgetType === 'COST').sort((a, b) => a.BudgetName.localeCompare(b.BudgetName)), b => b.BudgetName)).BudgetName
  })
  await field('practiceKey', async () => {
    if (!c.bucket) throw new Error('圖片 Bucket 尚未確認，無法找 W6 練習物件。')
    const result = await aws('s3api', 'list-object-versions', { Bucket: c.bucket, ExpectedBucketOwner: identity.Account, Prefix: 'practice/' })
    const keys = [...new Set([...(result.Versions || []), ...(result.DeleteMarkers || [])].map(v => v.Key).filter(k => k && !k.endsWith('/')))].sort()
    return select('W6 同名覆寫圖片', keys)
  })
  await field('imageTag', async () => {
    if (!c.repository) throw new Error('ECR Repository 尚未確認，無法查映像版本。')
    const images = (await aws('ecr', 'describe-images', { repositoryName: c.repository, registryId: identity.Account })).imageDetails || []
    const chosen = await select('部署的映像版本', images.sort((a, b) => a.imageDigest.localeCompare(b.imageDigest)), i => (i.imageTags || ['未標 tag']).join(', ') + ' · ' + i.imageDigest.slice(0, 19))
    if (!chosen.imageTags?.length) throw new Error('選定映像未標 tag，請依 W9 核對部署版本。')
    return [...chosen.imageTags].sort()[0]
  })
  // Detect narrowness, never use the detected value to claim it belongs to the student's current computer.
  try {
    if (ec2) {
      const ids = instanceGroupIds(ec2)
      const groups = (await aws('ec2', 'describe-security-groups', { GroupIds: ids })).SecurityGroups || []
      const sources = groups.flatMap(g => (g.IpPermissions || []).filter(r => ['tcp', '6'].includes(r.IpProtocol) && r.FromPort === 22 && r.ToPort === 22).flatMap(r => (r.IpRanges || []).map(x => x.CidrIp)))
      c.sshCidr = [...new Set(sources)].length === 1 && /^\d{1,3}(\.\d{1,3}){3}\/32$/.test(sources[0]) ? sources[0] : '未限單一 IPv4/32'
    }
  } catch { /* The original SG check will report its own query failure. */ }
  return { config: c, issues, notes }
}
function discoveryIssue (id, issues = {}) {
  return Object.entries(issues).find(([key]) => FIELDS[key]?.some(prefix => id.startsWith(prefix)))?.[1]
}
async function terminalChoose (name, labels) {
  if (!process.stdin.isTTY) return undefined
  const rl = require('node:readline/promises').createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log(`\n找到多個${name}，請選自己的：`)
    labels.forEach((label, index) => console.log(`${index + 1}. ${scrub(label)}`))
    const answer = (await rl.question('輸入編號（直接 Enter 暫略此項）：')).trim()
    return /^\d+$/.test(answer) ? Number(answer) - 1 : undefined
  } finally { rl.close() }
}
module.exports = { discover, discoveryIssue, validateUrl, roleResources, terminalChoose }
