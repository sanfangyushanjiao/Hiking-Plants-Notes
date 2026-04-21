/**
 * 从 Excel 植物图鉴表格生成 Markdown 内容文件
 * 用法: node scripts/generate-plant-md.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { read, utils } from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const XLSX_PATH = join(ROOT, '植物图鉴分类整理.xlsx');
const OUT_DIR = join(ROOT, 'src', 'content', 'plants');

// 中文名到拼音 slug 的映射
const SLUG_MAP = {
  '柏拉木': 'bai-la-mu',
  '大蓟': 'da-ji',
  '鱼腥草': 'yu-xing-cao',
  '春笋': 'chun-sun',
  '石菖蒲': 'shi-chang-pu',
  '映山红': 'ying-shan-hong',
  '茶树': 'cha-shu',
  '蓬蘽': 'peng-lei',
  '粗叶悬钩子': 'cu-ye-xuan-gou-zi',
  '金樱子': 'jin-ying-zi',
  '枫香树': 'feng-xiang-shu',
  '松果': 'song-guo',
  '杉木球果': 'sha-mu-qiu-guo',
  '卷柏': 'juan-bai',
  '箬竹': 'ruo-zhu',
  '假蒟': 'jia-ju',
  '杏香兔耳风': 'xing-xiang-tu-er-feng',
  '鼠曲草': 'shu-qu-cao',
  '灵芝': 'ling-zhi',
  '蘑菇': 'mo-gu',
  '伞南星': 'san-nan-xing',
  '黄果茄': 'huang-guo-qie',
  '金毛狗蕨': 'jin-mao-gou-jue',
  '虎杖': 'hu-zhang',
  '杉木': 'sha-mu',
  '毛竹': 'mao-zhu',
  '草珊瑚': 'cao-shan-hu',
  '金银花': 'jin-yin-hua',
  '枫杨': 'feng-yang',
  '桂花果': 'gui-hua-guo',
};

// 从中文名称生成合法的文件名 slug
function toSlug(name) {
  // 先尝试精确匹配
  const mainName = name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/，.*/, '')
    .replace(/[，。、\s]/g, '')
    .trim()
    .slice(0, 6);
  // 查找映射
  for (const [key, val] of Object.entries(SLUG_MAP)) {
    if (name.startsWith(key) || name.includes(key)) return val;
  }
  return mainName;
}

// 从名称推断 tags
function inferTags(name, feature, medical, notes) {
  const tags = [];
  const text = name + feature + medical + notes;

  if (/蕨|卷柏|石松/.test(text)) tags.push('蕨类');
  if (/竹|笋/.test(name)) tags.push('竹类');
  if (/乔木|大树|高可达/.test(text)) tags.push('乔木');
  if (/灌木|攀援/.test(text)) tags.push('灌木');
  if (/草本|多年生草/.test(text)) tags.push('草本');
  if (/蘑菇|灵芝|真菌/.test(text)) tags.push('真菌');
  if (/药用|入药|中药|草药/.test(text)) tags.push('药用植物');
  if (/食用|野菜|野果|可食/.test(text)) tags.push('食用植物');
  if (/毒|有毒|不建议食/.test(text)) tags.push('注意辨别');
  if (/溪|水边|湿地|沟边|石生/.test(text)) tags.push('水边湿地');
  if (/林下|阴湿|阴坡/.test(text)) tags.push('林下植物');

  return [...new Set(tags)];
}

// 清理文本：去掉 DISPIMG 公式等，规范化空白
function clean(str) {
  return str
    .replace(/=DISPIMG\([^)]*\)/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

// 将带有 "标题：内容" 格式的段落转为 Markdown
function formatBody(text) {
  if (!text) return '';
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const wb = read(readFileSync(XLSX_PATH));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

// 跳过标题行
const plants = rows.slice(1).filter(row => row[1]);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

for (const row of plants) {
  const rawName = String(row[1]).trim();
  const feature = clean(String(row[3]));
  const medical = clean(String(row[4]));
  const notes   = clean(String(row[5]));

  const slug = toSlug(rawName);
  const tags = inferTags(rawName, feature, medical, notes);

  // 生成摘要：特征文字前80字，去掉各类引号避免 YAML 解析错误
  const summary = feature.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/["\u201c\u201d\u2018\u2019]/g, ' ').slice(0, 80) + (feature.length > 80 ? '……' : '');

  // 构建正文各节
  const sections = [];

  if (feature) {
    sections.push(`## 形态与生境\n\n${formatBody(feature)}`);
  }

  if (medical) {
    sections.push(`## 药用与传统用途\n\n${formatBody(medical)}\n\n> **提示**：以上药用信息仅供科普参考，请勿自行采摘或用药，需遵医嘱。`);
  }

  if (notes) {
    sections.push(`## 备注\n\n${formatBody(notes)}`);
  }

  const frontmatter = [
    '---',
    `title: "${rawName}"`,
    `date: 2026-04-20`,
    tags.length > 0
      ? `tags:\n${tags.map(t => `  - ${t}`).join('\n')}`
      : `tags: []`,
    `location: 资源县抱财丘徒步线`,
    `photos:`,
    `  - /images/plants/placeholder.svg`,
    `summary: "${summary}"`,
    '---',
  ].join('\n');

  const content = `${frontmatter}\n\n${sections.join('\n\n')}\n`;

  const outPath = join(OUT_DIR, `${slug}.md`);
  writeFileSync(outPath, content, 'utf-8');
  console.log(`✓ ${outPath}`);
}

console.log(`\n共生成 ${plants.length} 个植物条目。`);
