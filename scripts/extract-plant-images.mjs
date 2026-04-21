/**
 * 从 Excel 提取植物图片，压缩为 WebP，并更新 Markdown photos 字段
 * 用法: node scripts/extract-plant-images.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import sharp from 'sharp';
import { read, utils } from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const XLSX_PATH = join(ROOT, '植物图鉴分类整理.xlsx');
const OUT_IMG_DIR = join(ROOT, 'public', 'images', 'plants');
const MD_DIR = join(ROOT, 'src', 'content', 'plants');

if (!existsSync(OUT_IMG_DIR)) mkdirSync(OUT_IMG_DIR, { recursive: true });

// ── 1. 解压 ZIP (xlsx) 中的指定文件 ──────────────────────────────────────────
const xlsxBuf = readFileSync(XLSX_PATH);

function extractZipEntry(buf, targetName) {
  let offset = 0;
  while (offset < buf.length - 4) {
    if (
      buf[offset] === 0x50 && buf[offset + 1] === 0x4b &&
      buf[offset + 2] === 0x03 && buf[offset + 3] === 0x04
    ) {
      const compression = buf.readUInt16LE(offset + 8);
      const compressedSize = buf.readUInt32LE(offset + 18);
      const fnLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const name = buf.slice(offset + 30, offset + 30 + fnLen).toString('utf8');
      const dataStart = offset + 30 + fnLen + extraLen;
      const data = buf.slice(dataStart, dataStart + compressedSize);
      if (name === targetName) {
        return compression === 8 ? zlib.inflateRawSync(data) : data;
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

// ── 2. 解析 cellimages.xml 建立 DISPIMG name → rId 的映射 ───────────────────
const cellimagesXml = extractZipEntry(xlsxBuf, 'xl/cellimages.xml').toString('utf8');
// <xdr:cNvPr ... name="ID_xxx" .../> ... <a:blip r:embed="rIdN"/>
const nameToRid = {};
const picRegex = /<xdr:cNvPr[^>]+name="(ID_[0-9A-F]+)"[^/]*/gi;
const blipRegex = /<a:blip[^>]+r:embed="(rId\d+)"/gi;

// Match them in document order - each pic block has exactly one cNvPr and one blip
const picBlocks = cellimagesXml.split('</etc:cellImage>');
for (const block of picBlocks) {
  const nameMatch = block.match(/name="(ID_[0-9A-F]+)"/i);
  const ridMatch = block.match(/r:embed="(rId\d+)"/i);
  if (nameMatch && ridMatch) {
    nameToRid[nameMatch[1]] = ridMatch[1];
  }
}
console.log(`Found ${Object.keys(nameToRid).length} DISPIMG entries`);

// ── 3. 解析 cellimages.xml.rels 建立 rId → 图片文件名的映射 ─────────────────
const relsXml = extractZipEntry(xlsxBuf, 'xl/_rels/cellimages.xml.rels').toString('utf8');
const ridToFile = {};
const relRegex = /Id="(rId\d+)"[^>]+Target="(media\/[^"]+)"/g;
let relMatch;
while ((relMatch = relRegex.exec(relsXml)) !== null) {
  ridToFile[relMatch[1]] = relMatch[2]; // e.g. "media/image1.jpeg"
}

// ── 4. 读取 Excel 表格，建立植物名 → DISPIMG ID 的映射 ───────────────────────
const wb = read(xlsxBuf);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

// slug map (same as generate-plant-md.mjs)
const SLUG_MAP = {
  '柏拉木': 'bai-la-mu', '大蓟': 'da-ji', '鱼腥草': 'yu-xing-cao',
  '春笋': 'chun-sun', '石菖蒲': 'shi-chang-pu', '映山红': 'ying-shan-hong',
  '茶树': 'cha-shu', '蓬蘽': 'peng-lei', '粗叶悬钩子': 'cu-ye-xuan-gou-zi',
  '金樱子': 'jin-ying-zi', '枫香树': 'feng-xiang-shu', '松果': 'song-guo',
  '杉木球果': 'sha-mu-qiu-guo', '卷柏': 'juan-bai', '箬竹': 'ruo-zhu',
  '假蒟': 'jia-ju', '杏香兔耳风': 'xing-xiang-tu-er-feng',
  '鼠曲草': 'shu-qu-cao', '灵芝': 'ling-zhi', '蘑菇': 'mo-gu',
  '伞南星': 'san-nan-xing', '黄果茄': 'huang-guo-qie',
  '金毛狗蕨': 'jin-mao-gou-jue', '虎杖': 'hu-zhang', '杉木': 'sha-mu',
  '毛竹': 'mao-zhu', '草珊瑚': 'cao-shan-hu', '金银花': 'jin-yin-hua',
  '枫杨': 'feng-yang', '桂花果': 'gui-hua-guo', '箬': 'ruo-zhu',
};

function getSlug(name) {
  for (const [key, val] of Object.entries(SLUG_MAP)) {
    if (name.startsWith(key) || name.includes(key)) return val;
  }
  return null;
}

// ── 5. 逐行提取图片，压缩保存，更新 MD ──────────────────────────────────────
const results = [];

for (const row of rows.slice(1)) {
  const name = String(row[1]).trim();
  const imgCell = String(row[2]).trim();
  if (!name || !imgCell) continue;

  // Extract DISPIMG ID from formula  =DISPIMG("ID_xxx",1)
  const idMatch = imgCell.match(/DISPIMG\("(ID_[0-9A-F]+)"/i);
  if (!idMatch) {
    console.warn(`  No DISPIMG in row for ${name}`);
    continue;
  }
  const dispId = idMatch[1];
  const slug = getSlug(name);
  if (!slug) { console.warn(`  No slug for ${name}`); continue; }

  const rId = nameToRid[dispId];
  if (!rId) { console.warn(`  No rId for ${dispId} (${name})`); continue; }

  const mediaPath = ridToFile[rId]; // "media/image3.jpeg"
  if (!mediaPath) { console.warn(`  No media file for ${rId} (${name})`); continue; }

  const imgBuf = extractZipEntry(xlsxBuf, `xl/${mediaPath}`);
  if (!imgBuf) { console.warn(`  Could not extract xl/${mediaPath}`); continue; }

  // Compress to WebP (max width 1200px, quality 82)
  const outFileName = `${slug}.webp`;
  const outPath = join(OUT_IMG_DIR, outFileName);
  try {
    await sharp(imgBuf)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);

    const sizeBefore = imgBuf.length;
    const { size: sizeAfter } = await sharp(outPath).metadata();
    console.log(`✓ ${name} → ${outFileName} (${(sizeBefore/1024).toFixed(0)}KB → ~${((await import('fs')).statSync(outPath).size/1024).toFixed(0)}KB)`);
  } catch (e) {
    console.error(`  Error processing ${name}: ${e.message}`);
    continue;
  }

  results.push({ slug, photoPath: `/images/plants/${outFileName}` });
}

// ── 6. 更新每个 Markdown 文件的 photos 字段 ──────────────────────────────────
let updated = 0;
for (const { slug, photoPath } of results) {
  const mdPath = join(MD_DIR, `${slug}.md`);
  if (!existsSync(mdPath)) { console.warn(`  MD not found: ${mdPath}`); continue; }

  let content = readFileSync(mdPath, 'utf8');
  // Replace placeholder photos array
  content = content.replace(
    /^photos:\n(?:  - .*\n)+/m,
    `photos:\n  - ${photoPath}\n`
  );
  writeFileSync(mdPath, content, 'utf8');
  updated++;
}

console.log(`\n图片提取完成，共处理 ${results.length} 张，更新 ${updated} 个 MD 文件。`);
