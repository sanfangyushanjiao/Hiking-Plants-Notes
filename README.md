# 抱财丘徒步 · 植物手记

广西壮族自治区桂林市资源县**抱财丘**一带徒步社会实践用的**静态植物主题网站**：五色自然配色、全站中文与楷体、图文展示 Content Collection 中的植物条目，支持**标签筛选**与**关键词搜索**（Fuse.js）。

## 环境要求

- Node.js **22.12+**（与 `package.json` 中 `engines` 一致）

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

开发地址一般为 `http://localhost:4321`。

### 路线类图片压缩（首页 Hero / 路线页）

将原图放入 `图片素材/` 下三个子文件夹：`首页实拍图`、`轨迹图`、`环境图`。然后执行：

```bash
npm run images:optimize
```

会在 `public/images/trail/` 生成 `hero.webp`、`guiji-*.webp`、`huanjing-*.webp`（首页与路线页已引用这些文件名）。环境图默认会排除素材「P2」`微信图片_20260421150204_1152_4.jpg`，如需调整请编辑 `scripts/optimize-trail-images.mjs` 中的 `EXCLUDE_HUANJING`。

## 目录约定

| 路径 | 用途 |
|------|------|
| `src/content/plants/*.md` | 植物条目： frontmatter + Markdown 正文 |
| `public/images/plants/` | 植物实拍 |
| `public/images/trail/` | 构建用压缩图（由 `npm run images:optimize` 从 `图片素材/` 生成）；勿直接覆盖正在使用的文件名除非同步改页面 |
| `图片素材/` | 原始大图：`首页实拍图`、`轨迹图`、`环境图` |
| `public/decoration/` | 线稿、叶形等装饰素材 |

### 植物条目模板（frontmatter）

```yaml
---
title: 中文植物名
date: 2026-04-20
tags:
  - 药用植物
  - 乔木
location: 资源县抱财丘徒步线 · 具体路段描述
photos:
  - /images/plants/你的文件.jpg
summary: 一行摘要，用于卡片与搜索。
---
```

正文使用二级、三级标题写「形态与生境」「观察记录」等。`draft: true` 时该条不会出现在图鉴与详情路由。

## 部署（静态托管）

`npm run build` 产出在 `dist/`。可部署到 **GitHub Pages**、**Netlify** 或学校静态服务器：上传 `dist` 内全部文件即可。

若使用 GitHub **项目页**（地址形如 `https://用户名.github.io/仓库名/`），需在 `astro.config.mjs` 中设置 `base: '/仓库名/'`。

## 示例数据

仓库内自带两条示例 Markdown 与 SVG 占位图，替换图片路径与正文后即可作为正式内容。
