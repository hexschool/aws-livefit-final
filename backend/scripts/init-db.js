// W7：只初始化全新、專供 LiveFit 使用的空資料庫。
const { dataSource } = require('../db/data-source')
async function main () {
  dataSource.setOptions({ synchronize: false })
  await dataSource.initialize()
  try {
    const tables = await dataSource.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    if (tables.length) throw new Error('資料庫已有資料表；停止初始化，請先評估資料遷移')
    await dataSource.synchronize()
    console.log('LiveFit 資料表建立完成')
  } finally { await dataSource.destroy() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
