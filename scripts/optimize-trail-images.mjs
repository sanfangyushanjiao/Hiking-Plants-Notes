/**
 * 从「图片素材」读取首页/环境/轨迹图，压缩为 WebP 写入 public/images/trail/
 * 运行：npm run images:optimize
 */
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const srcRoot = join(root, '图片素材');
const outDir = join(root, 'public', 'images', 'trail');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG']);

/** 环境图素材中需排除的文件（对应原「P2」） */
const EXCLUDE_HUANJING = new Set(['微信图片_20260421150204_1152_4.jpg']);

async function clearHuanjingOutputs() {
	const names = await readdir(outDir).catch(() => []);
	for (const name of names) {
		if (name.startsWith('huanjing-') && name.endsWith('.webp')) {
			await unlink(join(outDir, name));
		}
	}
}

async function listImages(dir) {
	const names = await readdir(dir, { withFileTypes: true });
	return names
		.filter((d) => d.isFile() && IMAGE_EXT.has(extname(d.name)))
		.map((d) => d.name)
		.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

async function toWebp(inputPath, outputPath, { maxWidth, quality }) {
	const img = sharp(inputPath).rotate();
	const meta = await img.metadata();
	const width = meta.width ?? maxWidth;
	if (width > maxWidth) {
		img.resize({ width: maxWidth, withoutEnlargement: true });
	}
	await img.webp({ quality, effort: 6 }).toFile(outputPath);
}

async function main() {
	await mkdir(outDir, { recursive: true });

	const dirs = {
		首页实拍图: { prefix: 'hero', single: true, maxWidth: 1920, quality: 82 },
		轨迹图: { prefix: 'guiji', single: false, maxWidth: 1600, quality: 85 },
		环境图: { prefix: 'huanjing', single: false, maxWidth: 1600, quality: 80 },
	};

	for (const [folder, opts] of Object.entries(dirs)) {
		const dir = join(srcRoot, folder);
		let files;
		try {
			files = await listImages(dir);
		} catch (e) {
			console.warn(`跳过（无法读取）: ${dir}`, e.message);
			continue;
		}
		if (files.length === 0) {
			console.warn(`跳过（无图片）: ${folder}`);
			continue;
		}

		if (opts.single) {
			const first = files[0];
			const inPath = join(dir, first);
			const outPath = join(outDir, 'hero.webp');
			await toWebp(inPath, outPath, opts);
			console.log(`首页主图: ${first} -> hero.webp`);
		} else {
			let filtered = files;
			if (folder === '环境图') {
				await clearHuanjingOutputs();
				filtered = files.filter((n) => !EXCLUDE_HUANJING.has(n));
				const skipped = files.filter((n) => EXCLUDE_HUANJING.has(n));
				for (const n of skipped) {
					console.log(`环境图（已排除 P2）: ${n}`);
				}
			}
			let i = 1;
			for (const name of filtered) {
				const inPath = join(dir, name);
				const outName = `${opts.prefix}-${String(i).padStart(2, '0')}.webp`;
				const outPath = join(outDir, outName);
				await toWebp(inPath, outPath, opts);
				console.log(`${folder}: ${name} -> ${outName}`);
				i++;
			}
		}
	}

	console.log('完成。输出目录:', outDir);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
