/**
 * 把 jest 的 JSON 結果轉成 GitHub Actions Job Summary 表格
 * 用法：node .github/scripts/summary.js "標題" jest-result.json
 */
const fs = require('fs');

const title = process.argv[2] || '驗收';
const file = process.argv[3] || 'jest-result.json';
const out = process.env.GITHUB_STEP_SUMMARY;

const stripAnsi = (s) => String(s).replace(/\[[0-9;]*m/g, '');

let md = '';

if (!fs.existsSync(file)) {
  md = [
    `## 🛑 ${title}：測試沒有執行`,
    '',
    '通常是 server 沒起來（公約①～④哪裡破了）。往上看「啟動你的後端」步驟印出的 server log，',
    '最常見原因：`npm start` 沒換成自己的啟動指令、沒聽 `PORT` 環境變數、資料表沒建出來。',
    '',
  ].join('\n');
} else {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = [];
  const fails = [];
  for (const suite of r.testResults || []) {
    for (const t of suite.assertionResults || suite.testResults || []) {
      const ok = t.status === 'passed';
      const name = t.fullName || t.title;
      rows.push(`| ${ok ? '✅' : '❌'} | ${name} |`);
      if (t.status === 'failed') fails.push(t);
    }
  }
  const icon = r.numFailedTests === 0 && r.numTotalTests > 0 ? '✅' : '❌';
  md = [
    `## ${icon} ${title}：${r.numPassedTests}/${r.numTotalTests} 通過`,
    '',
    '| 結果 | 行為合約 |',
    '|---|---|',
    ...rows,
    '',
  ].join('\n');

  if (fails.length) {
    md += `\n### 沒過的 ${fails.length} 條，失敗原因在這\n`;
    for (const t of fails) {
      const msg = stripAnsi((t.failureMessages || []).join('\n'))
        .split('\n')
        .slice(0, 25)
        .join('\n');
      md += `\n<details><summary>❌ ${t.fullName || t.title}</summary>\n\n\`\`\`\n${msg}\n\`\`\`\n\n</details>\n`;
    }
    md += '\n> 三步自救：讀上面的行為描述 → 開 Swagger 文件（localhost:8081）對照該 API 規格 → 本機 `npm run test:m{N}` 重現。\n';
  }
}

fs.appendFileSync(out, md + '\n');
console.log('summary written');
