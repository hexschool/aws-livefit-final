const { validateConfig, commandError, routeFor, webRulesCorrect, dbRulesCorrect, instanceGroupIds, budgetNotification, makeReporter, runChecks, totals, exitCode, renderHtml, parseArgs, scrub, READS, POLICY_ACTIONS, extraActions, checkCaller } = require('../scripts/check-final')
const { runFlow } = require('../.github/scripts/check-flow')
const { discover, roleResources, validateUrl } = require('../scripts/discover-final')
const c = { url: 'https://class.example.com', region: 'ap-northeast-1', instanceId: 'i-1234567890abcdef0', dbInstanceIdentifier: 'class-db', bucket: 'class-private-photos', practiceKey: 'practice/p.png', repository: 'class-app', imageTag: 'v1', sshCidr: '203.0.113.2/32', sesIdentity: 'student@example.com', budgetName: 'course' }
const rule = (port, ip) => ({ IpProtocol: 'tcp', FromPort: port, ToPort: port, IpRanges: [{ CidrIp: ip }] })
const web = [{ GroupId: 'sg-web', IpPermissions: [rule(22, c.sshCidr), rule(80, '0.0.0.0/0'), rule(443, '0.0.0.0/0')] }]
const dbGroup = [{ IpPermissions: [{ IpProtocol: 'tcp', FromPort: 5432, ToPort: 5432, UserIdGroupPairs: [{ GroupId: 'sg-web' }] }] }]
test('範例不能不改就驗老師機器；URL 不接受秘密或非東京', () => {
  expect(validateConfig(c).url).toBe(c.url)
  for (const override of [{ instanceId: 'i-REPLACE_ME' }, { url: 'https://user:secret@example.com' }, { url: 'https://example.com?token=x' }, { region: 'us-east-1' }, { sshCidr: '0.0.0.0/0' }, { bucket: 'file:///tmp/key' }]) expect(() => validateConfig({ ...c, ...override })).toThrow()
})
test('CLI 參數必須完整；不接受未知選項', () => {
  expect(parseArgs(['--config', 'c.json', '--out', 'r', '--host-report', 'h.json'])).toEqual({ config: 'c.json', out: 'r', 'host-report': 'h.json' })
  expect(() => parseArgs(['--config'])).toThrow()
  expect(() => parseArgs(['--config', 'c.json', '--fix'])).toThrow()
})
test('SG 以合併權限判斷；額外的全開 SG 不能漏掉', () => {
  expect(webRulesCorrect(web, c.sshCidr)).toBe(true)
  expect(webRulesCorrect([...web, { IpPermissions: [{ IpProtocol: '-1', IpRanges: [{ CidrIp: '0.0.0.0/0' }] }] }], c.sshCidr)).toBe(false)
  expect(webRulesCorrect([{ IpPermissions: [rule(22, '0.0.0.0/0'), rule(80, '0.0.0.0/0'), rule(443, '0.0.0.0/0')] }], c.sshCidr)).toBe(false)
  expect(webRulesCorrect([...web, { IpPermissions: [{ ...rule(22, c.sshCidr), Ipv6Ranges: [{ CidrIpv6: '::/0' }] }] }], c.sshCidr)).toBe(false)
})
test('額外 ENI 的 SG 也要合併，重複群組去重', () => {
  expect(instanceGroupIds({ SecurityGroups: [{ GroupId: 'a' }], NetworkInterfaces: [{ Groups: [{ GroupId: 'a' }, { GroupId: 'b' }] }] })).toEqual(['a', 'b'])
})
test('AWS 舊預算省略 ThresholdType 時是百分比，不能接受絕對金額', () => {
  const n = { NotificationType: 'ACTUAL', ComparisonOperator: 'GREATER_THAN', Threshold: 85 }
  expect(budgetNotification([n], 'ACTUAL', 85)).toBe(true)
  expect(budgetNotification([{ ...n, ThresholdType: 'PERCENTAGE' }], 'ACTUAL', 85)).toBe(true)
  expect(budgetNotification([{ ...n, ThresholdType: 'ABSOLUTE_VALUE' }], 'ACTUAL', 85)).toBe(false)
  expect(budgetNotification([n], 'FORECASTED', 85)).toBe(false)
})
test('RDS SG 不接受相同名稱、CIDR、錯 SG 或全通訊協定', () => {
  expect(dbRulesCorrect(dbGroup, ['sg-web'])).toBe(true)
  expect(dbRulesCorrect(dbGroup, ['sg-different'])).toBe(false)
  expect(dbRulesCorrect([...dbGroup, { IpPermissions: [rule(5432, '10.0.0.0/16')] }], ['sg-web'])).toBe(false)
  expect(dbRulesCorrect([{ IpPermissions: [{ ...dbGroup[0].IpPermissions[0], IpProtocol: '-1' }] }], ['sg-web'])).toBe(false)
  expect(dbRulesCorrect([], ['sg-web'])).toBe(false)
})
test('明確子網關聯優先，無關聯才用 main；不能靠 private 名稱', () => {
  const tables = [{ RouteTableId: 'main', Associations: [{ Main: true }] }, { RouteTableId: 'explicit', Associations: [{ SubnetId: 's1' }] }]
  expect(routeFor(tables, 's1').RouteTableId).toBe('explicit')
  expect(routeFor(tables, 's2').RouteTableId).toBe('main')
})
test('AccessDenied、找不到與 timeout 區分，錯誤不外洩 ARN', () => {
  expect(commandError({ stderr: 'An error occurred (AccessDenied) when calling X: arn:aws:iam::123456789012:user/me' }).status).toBe('BLOCKED')
  expect(commandError({ stderr: 'An error occurred (NoSuchBucket) when calling X' }).status).toBe('FAIL')
  expect(commandError({ killed: true }).code).toBe('Timeout')
})
test('報告不把 missing response 當 PASS；空報告沒有通過項目', async () => {
  const r = makeReporter()
  await r.check('a', 1, 'A', 'x', 'y', async () => undefined)
  expect(r.checks[0].status).toBe('BLOCKED')
  expect(exitCode({ checks: r.checks })).toBe(2)
  expect(exitCode({ checks: [{ status: 'FAIL' }, ...r.checks] })).toBe(1)
  expect(totals({ checks: [] })).toEqual({ PASS: 0, FAIL: 0, BLOCKED: 0 })
})
test('權限不足仍完成其他可檢項，所有網站 request 是只讀', async () => {
  const calls = []
  const report = await runChecks(c, {
    aws: async () => { throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' }) },
    request: async (url, options) => { calls.push([url, options]); return { status: url.includes('users/profile') ? 401 : url.includes('final-check-route') ? 404 : url.startsWith('http:') ? 301 : 200,
      headers: { 'content-type': 'text/html', location: c.url + '/login' }, text: 'LiveFit', json: { status: url.includes('/ready') ? 'ready' : 'failed' } } }
  })
  expect(report.checks.filter(x => x.status === 'PASS')).toHaveLength(5)
  expect(report.checks.find(x => x.id === 'network.web-sg').status).toBe('BLOCKED')
  expect(report.checks.find(x => x.id === 'ecr.image').status).toBe('BLOCKED')
  expect(report.checks).toHaveLength(25)
  expect(report.checks.every(x => ['PASS', 'FAIL', 'BLOCKED'].includes(x.status))).toBe(true)
  expect(calls.every(([, options]) => options === undefined)).toBe(true)
})
test('AWS 沒有 Bucket Policy 與讀不到 Policy 必須分開', async () => {
  for (const code of ['NoSuchBucketPolicy', 'AccessDenied']) {
    const report = await runChecks(c, { aws: async (s, op) => {
      if (op === 'get-caller-identity') return { Account: '123456789012', Arn: 'arn:aws:iam::123456789012:user/test' }
      throw Object.assign(new Error(), { code: op === 'get-bucket-policy-status' ? code : 'AccessDenied', status: 'BLOCKED' })
    }, request: async () => ({ status: 503, headers: {}, text: '' }) })
    expect(report.checks.find(x => x.id === 's3.policy').status).toBe(code === 'NoSuchBucketPolicy' ? 'PASS' : 'BLOCKED')
  }
})
test('查詢錯誤與 HTML 報告不洩漏帳號／Email／簽名參數，HTML 做 escape', () => {
  const raw = '123456789012 student@example.com https://bucket.test/photo?X-Amz-Signature=secret'
  expect(scrub(raw)).not.toMatch(/123456789012|student@|secret/)
  const html = renderHtml({ version: '1', checkedAt: 'now', target: { url: '<script>alert(1)</script>' }, checks: [] })
  expect(html).not.toContain('<script>')
  expect(html).toContain('只列本次實際執行的檢查')
  expect(html).not.toContain('待人工驗證')
})
test('AWS CLI 只列明確只讀 operation，不包含寫入、寄信、憑證取得', () => {
  expect([...READS].every(x => /\/(get|describe|list|head)-/.test(x))).toBe(true)
  expect(READS.has('ses/send-email')).toBe(false)
  expect(READS.has('ecr/get-authorization-token')).toBe(false)
})
test('業務流程未 opt-in 時零 request；前置失敗不接著製造資料', async () => {
  const request = jest.fn(async () => ({ status: 503, json: {} }))
  await expect(runFlow(c, { request })).rejects.toThrow('--allow-test-data')
  expect(request).not.toHaveBeenCalled()
  const report = await runFlow(c, { allowTestData: true, request })
  expect(report.checks.find(x => x.id === 'flow.accounts').status).toBe('FAIL')
  expect(report.checks.find(x => x.id === 'flow.photo').status).toBe('BLOCKED')
  expect(request.mock.calls.every(([, opt]) => opt.method === 'GET')).toBe(true)
  expect(report.checks).toHaveLength(4)
  expect(report.checks.every(x => ['PASS', 'FAIL', 'BLOCKED'].includes(x.status))).toBe(true)
})
test.each(['valid', 'other-instance', 'other-db', 'stale'])('主機與 ECR／RDS 證據必須匹配：%s', async variant => {
  const digest = 'sha256:' + 'a'.repeat(64)
  const h = { version: '1.0.0', checkedAt: new Date().toISOString(), instanceId: c.instanceId, region: c.region, imageDigests: [digest],
    runtime: { dbHost: 'class-db.rds.amazonaws.com', bucket: c.bucket, region: c.region },
    checks: ['os', 'user', 'single', 'health', 'binding', 'restart', 'container-user', 'image', 'env-file', 'runtime', 'nginx', 'certbot-timer'].map(x => ({ id: 'host.' + x, status: 'PASS' })) }
  if (variant === 'other-instance') h.instanceId = 'i-fffffffffffffffff'
  if (variant === 'other-db') h.runtime.dbHost = 'another-db.rds.amazonaws.com'
  if (variant === 'stale') h.checkedAt = '2020-01-01T00:00:00Z'
  const ecrInputs = []
  const report = await runChecks(c, { hostReport: h, aws: async (service, op, input) => {
    if (op === 'get-caller-identity') return { Account: '123456789012', Arn: 'arn:aws:iam::123456789012:user/test' }
    if (service === 'ecr') { ecrInputs.push(input); return { imageDetails: [{ imageTags: [c.imageTag], imageDigest: digest }] } }
    if (service === 'rds') return { DBInstances: [{ DBInstanceIdentifier: c.dbInstanceIdentifier, Endpoint: { Address: 'class-db.rds.amazonaws.com' } }] }
    throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' })
  }, request: async () => ({ status: 503, headers: {}, text: '' }) })
  expect(ecrInputs[0]).toEqual({ repositoryName: c.repository, imageIds: [{ imageTag: c.imageTag }], registryId: '123456789012' })
  expect(report.checks.find(x => x.id === 'host.verified').status).toBe(variant === 'valid' ? 'PASS' : variant === 'stale' ? 'BLOCKED' : 'FAIL')
})

test('本版最終作業不呼叫 CloudWatch 或 SNS，不要求監控欄位', async () => {
  expect(validateConfig(c)).toBeTruthy()
  expect([...READS].some(x => /^(cloudwatch|sns)\//.test(x))).toBe(false)
  const report = await runChecks(c, { aws: async (service) => {
    expect(['cloudwatch', 'sns']).not.toContain(service)
    throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' })
  }, request: async () => ({ status: 503, headers: {}, text: '' }) })
  expect(report.checks.some(x => x.week === 'W12' || x.id.startsWith('monitor.'))).toBe(false)
})

test('學生只填 HTTPS 網址；保留老師設定模式，不接受兩個來源', () => {
  expect(parseArgs([c.url])).toEqual({ url: c.url })
  expect(validateUrl(c.url + '/')).toBe(c.url)
  expect(() => parseArgs([c.url, '--config', 'x.json'])).toThrow()
  for (const url of ['https://user:password@example.com', 'https://example.com/?secret=x', 'https://example.com/ready', 'http://example.com']) expect(() => validateUrl(url)).toThrow()
})
test('真正 CLI 載入自動辨識模組，無循環匯入警告，錯誤網址不呼叫 AWS', () => {
  const result = require('node:child_process').spawnSync(process.execPath, [require.resolve('../scripts/check-final'), 'https://example.com/ready'], { encoding: 'utf8' })
  expect(result.status).toBe(2)
  expect(result.stderr).toContain('請只填自己的 HTTPS 網站根網址')
  expect(result.stderr).not.toMatch(/circular dependency|not a function/)
})
const account = '123456789012'
const policy = { Statement: [
  { Effect: 'Allow', Action: 'ecr:GetAuthorizationToken', Resource: '*' },
  { Effect: 'Allow', Action: ['s3:ListBucket', 's3:GetObject'], Resource: ['arn:aws:s3:::class-private-photos', 'arn:aws:s3:::class-private-photos/coaches/*'] },
  { Effect: 'Allow', Action: 'ecr:BatchGetImage', Resource: `arn:aws:ecr:ap-northeast-1:${account}:repository/class-app` },
  { Effect: 'Allow', Action: 'ses:SendEmail', Resource: `arn:aws:ses:ap-northeast-1:${account}:identity/student@example.com` }
] }
function discoveryAws (overrides = {}) {
  const data = {
    'get-caller-identity': { Account: account },
    'describe-instances': { Reservations: [{ Instances: [{ InstanceId: c.instanceId, PublicIpAddress: '203.0.113.10', VpcId: 'vpc-class', SecurityGroups: [{ GroupId: 'sg-web' }], IamInstanceProfile: { Arn: `arn:aws:iam::${account}:instance-profile/runtime` } }] }] },
    'get-instance-profile': { InstanceProfile: { Roles: [{ RoleName: 'runtime' }] } },
    'list-role-policies': { PolicyNames: ['runtime-access'] },
    'get-role-policy': { PolicyDocument: encodeURIComponent(JSON.stringify(policy)) },
    'list-attached-role-policies': { AttachedPolicies: [] },
    'describe-db-instances': { DBInstances: [
      { DBInstanceIdentifier: 'unrelated-db', DBSubnetGroup: { VpcId: 'vpc-other' } },
      { DBInstanceIdentifier: c.dbInstanceIdentifier, DBSubnetGroup: { VpcId: 'vpc-class' } }
    ] },
    'describe-budgets': { Budgets: [{ BudgetName: c.budgetName, BudgetType: 'COST', BudgetLimit: { Amount: '999' } }] },
    'list-object-versions': { Versions: [{ Key: c.practiceKey, VersionId: 'v1' }] },
    'describe-images': { imageDetails: [{ imageTags: ['v1'], imageDigest: 'sha256:' + 'a'.repeat(64) }] },
    'describe-security-groups': { SecurityGroups: web },
    ...overrides
  }
  return jest.fn(async (service, operation, input) => {
    expect(READS.has(`${service}/${operation}`)).toBe(true)
    if (!(operation in data)) throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' })
    const result = data[operation]
    if (result instanceof Error) throw result
    return result
  })
}
test('只靠網址找到對應 EC2 與專用資源；不依通過標準挑預算或物件', async () => {
  const aws = discoveryAws(); const choose = jest.fn()
  const result = await discover(c.url, { aws, resolve4: async () => ['203.0.113.10'], choose })
  expect(result.issues).toEqual({})
  expect(result.config).toMatchObject(c)
  expect(choose).not.toHaveBeenCalled()
  expect(aws.mock.calls.find(([, op]) => op === 'describe-instances')[2]).toEqual({ Filters: [{ Name: 'ip-address', Values: ['203.0.113.10'] }] })
  expect(result.config.budgetName).toBe(c.budgetName) // Amount 999 is still discovered so the check can FAIL.
  expect(result.config.practiceKey).toBe(c.practiceKey) // A single version is not hidden by discovery.
})
test('多個同 VPC 資料庫必須選擇，未選擇不取第一筆', async () => {
  const aws = discoveryAws({ 'describe-db-instances': { DBInstances: ['db-b', 'db-a'].map(DBInstanceIdentifier => ({ DBInstanceIdentifier, DBSubnetGroup: { VpcId: 'vpc-class' } })) } })
  const pending = await discover(c.url, { aws, resolve4: async () => ['203.0.113.10'] })
  expect(pending.config.dbInstanceIdentifier).toBeUndefined()
  expect(pending.issues.dbInstanceIdentifier).toContain('2 個候選')
  const selected = await discover(c.url, { aws, resolve4: async () => ['203.0.113.10'], choose: async (name, labels) => {
    expect(labels).toEqual(['db-a', 'db-b']); return 1
  } })
  expect(selected.config.dbInstanceIdentifier).toBe('db-b')
})
test('萬用權限、Deny、其他帳號／區域不能用來認定唯一網站資源', () => {
  expect(roleResources([policy], 'ecr', c.region, account)).toEqual([c.repository])
  expect(roleResources([{ Statement: [{ Effect: 'Deny', Action: 's3:*', Resource: 'arn:aws:s3:::wrong' }] }], 's3', c.region, account)).toEqual([])
  expect(roleResources([policy], 'ecr', 'us-east-1', account)).toEqual([])
  expect(roleResources([policy], 'ses', c.region, '999999999999')).toEqual([])
  expect(() => roleResources([{ Statement: [{ Effect: 'Allow', Action: 's3:*', Resource: '*' }] }], 's3', c.region, account)).toThrow('萬用')
})
test('多個 DNS IP 不向 AWS 任意查第一台，關聯資源列無法確認', async () => {
  const aws = discoveryAws()
  const result = await discover(c.url, { aws, resolve4: async () => ['203.0.113.10', '203.0.113.11'] })
  expect(result.config.instanceId).toBeUndefined()
  expect(aws.mock.calls.some(([, op]) => op === 'describe-instances')).toBe(false)
  expect(result.issues.instanceId).toContain('多個 DNS')
})
test('Role 查詢被拒絕仍找 RDS，但不掃整個帳號猜 Bucket', async () => {
  const aws = discoveryAws({ 'get-role-policy': Object.assign(new Error(), { code: 'AccessDenied' }) })
  const result = await discover(c.url, { aws, resolve4: async () => ['203.0.113.10'] })
  expect(result.config.dbInstanceIdentifier).toBe(c.dbInstanceIdentifier)
  expect(result.config.bucket).toBeUndefined()
  expect(result.issues.bucket).toContain('AccessDenied')
  expect(aws.mock.calls.some(([s, op]) => s === 's3api' || op === 'list-buckets')).toBe(false)
})
test('未辨識資源不發無範圍查詢，SSH 自動模式不宣稱來源就是自己電腦', async () => {
  const aws = jest.fn(async () => { throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' }) })
  const report = await runChecks({ ...c, discoveryMode: true, bucket: undefined }, { aws, discoveryIssues: { bucket: '有兩個 Bucket，請選擇' }, request: async () => ({ status: 503, headers: {}, text: '' }) })
  expect(aws.mock.calls.some(([s]) => s === 's3api')).toBe(false)
  expect(report.checks.find(x => x.id === 's3.block')).toMatchObject({ status: 'BLOCKED', fix: '有兩個 Bucket，請選擇' })
  expect(report.checks.find(x => x.id === 'network.web-sg').expected).toContain('該 IP 是否為自己的電腦另行確認')
  expect(report.checks.some(x => x.id.startsWith('manual.'))).toBe(false)
})

const template = require('../deploy/iam/final-check-policy.json')
const templateActions = template.Statement.flatMap(x => [].concat(x.Action))
function callerAws (arn, data) {
  return jest.fn(async (service, operation, input) => {
    expect(READS.has(`${service}/${operation}`)).toBe(true)
    if (operation === 'get-caller-identity') return { Account: '123456789012', Arn: arn }
    const key = input?.PolicyArn ? `${operation}:${input.PolicyArn}` : input?.PolicyName ? `${operation}:${input.PolicyName}` : operation
    if (!(key in data) && !(operation in data)) throw Object.assign(new Error(), { code: 'AccessDenied', status: 'BLOCKED' })
    return data[key] ?? data[operation]
  })
}
const templateDoc = { Statement: [{ Effect: 'Allow', Action: templateActions, Resource: '*' }] }
const managed = (arn, document) => ({
  [`get-policy:${arn}`]: { Policy: { DefaultVersionId: 'v1' } },
  [`get-policy-version:${arn}`]: { PolicyVersion: { Document: document } }
})
test('自查專用 policy 範本與程式內清單一致，且全為只讀 action', () => {
  expect(new Set(templateActions.map(x => x.toLowerCase()))).toEqual(POLICY_ACTIONS)
  expect(templateActions.every(x => /^[a-z0-9]+:(Get|List|Describe|View)[A-Za-z]+$/.test(x))).toBe(true)
  expect(template.Statement.every(x => x.Effect === 'Allow')).toBe(true)
})
test('root 身分立即拒絕，不讀任何 policy', async () => {
  const aws = callerAws('arn:aws:iam::123456789012:root', {})
  await expect(checkCaller(aws)).rejects.toMatchObject({ code: 'RootIdentity' })
  expect(aws).toHaveBeenCalledTimes(1)
})
test('AdministratorAccess 或萬用 action 視為 admin 並列出', async () => {
  const aws = callerAws('arn:aws:iam::123456789012:user/me', {
    'list-user-policies': { PolicyNames: [] },
    'list-attached-user-policies': { AttachedPolicies: [{ PolicyName: 'AdministratorAccess', PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess' }] },
    'list-groups-for-user': { Groups: [] },
    ...managed('arn:aws:iam::aws:policy/AdministratorAccess', { Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] })
  })
  await expect(checkCaller(aws)).rejects.toMatchObject({ code: 'AdminIdentity', extra: ['user me/AdministratorAccess: *'] })
})
test('範本以外的 Allow action 拒絕並列出；Deny 與大小寫不影響', async () => {
  const aws = callerAws('arn:aws:iam::123456789012:user/path/me', {
    'list-user-policies': { PolicyNames: ['inline'] },
    'get-user-policy:inline': { PolicyDocument: encodeURIComponent(JSON.stringify({ Statement: [
      { Effect: 'Allow', Action: ['S3:GETBUCKETLOCATION', 's3:PutObject'], Resource: '*' },
      { Effect: 'Deny', Action: 'ec2:TerminateInstances', Resource: '*' }
    ] })) },
    'list-attached-user-policies': { AttachedPolicies: [] },
    'list-groups-for-user': { Groups: [] }
  })
  await expect(checkCaller(aws)).rejects.toMatchObject({ code: 'ExcessPermissions', extra: ['user me/inline: s3:PutObject'] })
  expect(extraActions([{ name: 'p', document: { Statement: [{ Effect: 'Allow', NotAction: 'iam:*', Resource: '*' }, { Effect: 'Allow', Action: 'ec2:Describe*', Resource: '*' }] } }])).toEqual(['p: NotAction', 'p: ec2:Describe*'])
})
test('只掛範本的 IAM User（含 group）與 Role session 可以執行', async () => {
  const user = callerAws('arn:aws:iam::123456789012:user/livefit-checker', {
    'list-user-policies': { PolicyNames: [] },
    'list-attached-user-policies': { AttachedPolicies: [{ PolicyName: 'livefit-final-check', PolicyArn: 'arn:aws:iam::123456789012:policy/livefit-final-check' }] },
    'list-groups-for-user': { Groups: [{ GroupName: 'checkers' }] },
    'list-group-policies': { PolicyNames: ['group-inline'] },
    'get-group-policy:group-inline': { PolicyDocument: templateDoc },
    'list-attached-group-policies': { AttachedPolicies: [] },
    ...managed('arn:aws:iam::123456789012:policy/livefit-final-check', templateDoc)
  })
  await expect(checkCaller(user)).resolves.toEqual({ type: 'IAM User', account: '123456789012', policies: 2 })
  const role = callerAws('arn:aws:sts::123456789012:assumed-role/checker-role/session', {
    'list-role-policies': { PolicyNames: ['inline'] },
    'get-role-policy:inline': { PolicyDocument: templateDoc },
    'list-attached-role-policies': { AttachedPolicies: [] }
  })
  await expect(checkCaller(role)).resolves.toMatchObject({ type: 'Role session', policies: 1 })
})
test('未登入或讀不到 policy 都不放行，錯誤訊息指向專用身分', async () => {
  await expect(checkCaller(async () => { throw Object.assign(new Error(), { code: 'CommandFailed' }) })).rejects.toThrow(/登入/)
  await expect(checkCaller(callerAws('arn:aws:iam::123456789012:user/me', {}))).rejects.toMatchObject({ code: 'AccessDenied' })
  await expect(checkCaller(callerAws('arn:aws:iam::123456789012:federated-user/x', {}))).rejects.toMatchObject({ code: 'UnsupportedIdentity' })
})
