/**
 * 将 public/images/plants/*.webp 压缩为两个尺寸：
 *   - {name}.webp        → 详情页用，900px 宽，质量 82
 *   - {name}_thumb.webp  → 卡片缩略图，480px 宽，质量 72
 *
 * 运行：npm run images:plants
 * 注意：会直接覆盖原文件，请先备份或确认图片素材已保留在「图片素材」目录。
 */
import { readdir, mkdir, unlink, rename } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const plantsDir = join(__dirname, '..', 'public', 'images', 'plants');
const tmpDir = join(plantsDir, '_tmp');
await mkdir(tmpDir, { recursive: true });

async function run() {
  const files = (await readdir(plantsDir))
    .filter(f => f.endsWith('.webp') && !f.endsWith('_thumb.webp') && f !== 'placeholder.svg');

  console.log(`共 ${files.length} 张图片，开始压缩…`);

  for (const file of files) {
    const src = join(plantsDir, file);
    const name = basename(file, extname(file));
    const destDetail = join(plantsDir, `${name}_detail.webp`);
    const destThumb = join(plantsDir, `${name}_thumb.webp`);

    // 详情页：900px 宽，质量 82
    await sharp(src)
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(destDetail);

    // 缩略图：480px 宽，质量 72
    await sharp(src)
      .rotate()
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 })
      .toFile(destThumb);

    const { stat } = await import('node:fs/promises');
    const d = await stat(destDetail);
    const t = await stat(destThumb);
    console.log(`  ${file}: 详情 ${Math.round(d.size/1024)}KB  缩略 ${Math.round(t.size/1024)}KB`);
  }

  console.log('✓ 压缩完成');
}

run().catch(e => { console.error(e); process.exit(1); });
