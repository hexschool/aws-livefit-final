const fs = require('fs')
const path = require('path')

const backendPackagePath = path.join(process.cwd(), 'backend', 'package.json')

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!fs.existsSync(backendPackagePath)) {
  fail('⛔ 找不到 backend/package.json：本機開發時後端可以放在 repo 外面；正式繳交前，請把它搬進本 repo 的 backend/。')
}

let backendPackage
try {
  backendPackage = JSON.parse(fs.readFileSync(backendPackagePath, 'utf8'))
} catch (error) {
  fail('⛔ backend/package.json 不是合法 JSON，請先修正後再重新執行。')
}

if (!backendPackage.scripts || !backendPackage.scripts.start) {
  fail('⛔ backend/package.json 缺少 scripts.start：正式繳交時，根目錄 npm start 會代理執行 npm --prefix backend start。')
}

