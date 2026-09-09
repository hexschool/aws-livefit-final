const { dataSource } = require('../db/data-source')
async function main () {
  await dataSource.initialize()
  try {
    const skills = dataSource.getRepository('Skill')
    for (const name of ['肌力訓練', '瑜珈', '有氧訓練']) {
      if (!await skills.findOneBy({ name })) await skills.save(skills.create({ name }))
    }
    const packages = dataSource.getRepository('CreditPackage')
    for (const item of [{ name: '體驗 3 堂', credit_amount: 3, price: 900 }, { name: '健身 10 堂', credit_amount: 10, price: 2500 }]) {
      if (!await packages.findOneBy({ name: item.name })) await packages.save(packages.create(item))
    }
    console.log('示範技能與堂數方案已就緒；帳號請從網站註冊')
  } finally { await dataSource.destroy() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
