const { validateConfig, commandError, routeFor, webRulesCorrect, dbRulesCorrect, instanceGroupIds, budgetNotification, makeReporter, runChecks, exitCode, renderHtml, parseArgs, scrub, READS } = require('../scripts/check-final')
const { runFlow } = require('../scripts/check-flow')
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
test('報告不把 missing response 當 PASS；人工項不表示已合格', async () => {
  const r = makeReporter()
  await r.check('a', 1, 'A', 'x', 'y', async () => undefined)
  expect(r.checks[0].status).toBe('BLOCKED')
  expect(exitCode({ checks: r.checks })).toBe(2)
  expect(exitCode({ checks: [{ status: 'FAIL' }, ...r.checks] })).toBe(1)
  expect(exitCode({ checks: [{ status: 'MANUAL' }] })).toBe(0)
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
  expect(report.checks.some(x => x.id === 'manual.mail' && x.status === 'MANUAL')).toBe(true)
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
  expect(html).toContain('不是完整合格證明')
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
