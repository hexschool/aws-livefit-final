/**
 * 合約測試共用工具（學生不需要修改、也不需要看懂這個檔案 — 但看懂了會學到東西）
 *
 * 設計原則：
 * 1. 全程黑箱：只透過 HTTP 打你的 API，不碰你的資料庫、不管你的程式怎麼寫
 * 2. 自帶資料：每個測試需要的資料（會員/教練/技能/方案/課程）都用 API 自己造
 * 3. 隨機命名：名稱/Email 都帶亂數，跑幾次都不會撞 unique 限制
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

/** 回傳一個指向受測 server 的 supertest client */
const api = () => request(BASE_URL);

const userTokens = new Map();
const rand = () => Math.random().toString(36).slice(2, 10);
const randEmail = () => `student_${Date.now()}_${rand()}@example.com`;
const randName = (prefix = '測試') => `${prefix}${rand()}`;

/** 符合密碼規則（含大小寫英數、8-16 字）的合法密碼 */
const VALID_PASSWORD = 'Aa12345678';

/** 成功回應合約：2xx + body.status === 'success' */
function expectSuccess(res) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  expect(res.body.status).toBe('success');
}

/** 可預期失敗合約：4xx + body.status === 'failed' */
function expectFailed(res) {
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
  expect(res.body.status).toBe('failed');
}

/** 註冊一個新會員，回傳 { name, email, password, res } */
async function signup(overrides = {}) {
  const user = {
    name: randName('會員'),
    email: randEmail(),
    password: VALID_PASSWORD,
    ...overrides,
  };
  const res = await api().post('/api/users/signup').send(user);
  return { ...user, res };
}

/** 登入，回傳 { token, res } */
async function login(email, password) {
  const res = await api().post('/api/users/login').send({ email, password });
  return { token: res.body?.data?.token, res };
}

/**
 * 註冊 + 登入一條龍，回傳 { token, userId, name, email, password }
 * userId 從 JWT payload 解出來（合約：payload 必含 id 與 role）
 */
async function signupAndLogin(overrides = {}) {
  const user = await signup(overrides);
  expectSuccess(user.res);
  const { token, res } = await login(user.email, user.password);
  expectSuccess(res);
  const payload = jwt.decode(token);
  userTokens.set(payload.id, token);
  return { token, userId: payload.id, ...user, loginRes: res };
}

/** 建一個技能（public 管理端點），回傳 { id, name } */
async function createSkill(name = randName('技能')) {
  const res = await api().post('/api/coaches/skill').send({ name });
  expectSuccess(res);
  return { id: res.body.data.id, name, res };
}

/** 建一個購買方案（public 管理端點），回傳 { id, name, credit_amount, price } */
async function createCreditPackage(overrides = {}) {
  const pkg = {
    name: randName('方案'),
    credit_amount: 7,
    price: 1400,
    ...overrides,
  };
  const res = await api().post('/api/credit-package').send(pkg);
  expectSuccess(res);
  return { id: res.body.data.id, ...pkg, res };
}

/** 以本人登入權限升級成教練（AWS 版） */
async function promoteToCoach(userId, overrides = {}) {
  const body = {
    experience_years: 3,
    description: '一位用 API 生出來的教練',
    ...overrides,
  };
  return api().post(`/api/admin/coaches/${userId}`).set('Authorization', `Bearer ${userTokens.get(userId)}`).send(body);
}

/**
 * 造一個教練一條龍：註冊 → 升級教練 → 重新登入拿新 token
 * （升級後角色變了，照前端的行為重新登入一次最保險）
 * 回傳 { token, userId, coachId, name, email, password }
 */
async function makeCoach(overrides = {}) {
  const user = await signupAndLogin(overrides);
  const promoteRes = await promoteToCoach(user.userId);
  expectSuccess(promoteRes);
  const coachId = promoteRes.body?.data?.coach?.id ?? null;
  const { token } = await login(user.email, user.password);
  return { ...user, token, coachId, promoteRes };
}

/** 未來時間的 UTC ISO 8601 字串（不含毫秒），offsetDays 天後 + offsetHours 小時 */
function futureUtc(offsetDays = 7, offsetHours = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000 + offsetHours * 3600000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 用教練 token 開一堂課，回傳 { id, ...courseBody } */
async function createCourse(coachToken, skillId, overrides = {}) {
  const course = {
    skill_id: skillId,
    name: randName('課程'),
    description: '一堂用 API 生出來的課',
    start_at: futureUtc(7),
    end_at: futureUtc(7, 2),
    max_participants: 10,
    meeting_url: 'https://example.com/meeting',
    ...overrides,
  };
  const res = await api()
    .post('/api/admin/coaches/courses')
    .set('Authorization', `Bearer ${coachToken}`)
    .send(course);
  expectSuccess(res);
  const id = res.body?.data?.course?.id;
  return { id, ...course, res };
}

/** 買方案 */
function buyPackage(token, packageId) {
  return api()
    .post(`/api/credit-package/${packageId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

/** 報名課程 */
function bookCourse(token, courseId) {
  return api()
    .post(`/api/courses/${courseId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

/** 取消報名 */
function cancelBooking(token, courseId) {
  return api()
    .delete(`/api/courses/${courseId}`)
    .set('Authorization', `Bearer ${token}`);
}

module.exports = {
  BASE_URL,
  api,
  rand,
  randEmail,
  randName,
  VALID_PASSWORD,
  expectSuccess,
  expectFailed,
  signup,
  login,
  signupAndLogin,
  createSkill,
  createCreditPackage,
  promoteToCoach,
  makeCoach,
  futureUtc,
  createCourse,
  buyPackage,
  bookCourse,
  cancelBooking,
};
