# 出行清单

一份足够全、分类足够好的出行清单。**买不漏，装不漏，该办的事不过期。**

纯前端、纯本地、完全离线。没有后端，没有账号，数据只存在用户自己的浏览器里。

---

## 这是什么

痛点：出门前要去小红书搜十几篇帖子，还是不全，然后一条条手打进备忘录。

所以核心价值是 **「打开就能浏览一份分类足够好的全清单」**，打勾是附加能力，不是打开它的理由。

两层：

| 层 | 是什么 | 在哪 |
|---|---|---|
| 知识库（供给侧） | 决定「清单里该有哪些条目」 | `data/` 里的 JSON，程序自带，只读 |
| 执行层（主线） | 决定「现在该勾哪几条」 | 用户的 localStorage |

两层永不混存：更新知识库内容不会碰用户的勾选进度。

---

## 跑起来

```bash
python3 -m http.server 8777     # 或任意静态服务器
open http://localhost:8777/
```

必须用 http 打开，不能直接双击 `index.html`（`fetch()` 加载 JSON 会被 file:// 协议挡掉）。

---

## 项目结构

```
index.html              外壳（GitHub Pages 从根目录发布，开箱即用）
assets/style.css        样式，CSS 变量在 :root，深色模式自动适配
assets/app.js           全部逻辑，无框架无依赖，原生 JS
data/tree.json          分类树：8 个物品一级 + 68 个二级
data/items.json         条目池：369 条
sw.js                   Service Worker，离线缓存
manifest.webmanifest    PWA 配置，「添加到主屏幕」用
tools/build_items.py    内容构建脚本（见下）
tools/items_raw.json    重构前的 339 条原始数据，留作对照
PRD.md                  需求文档
需求提问清单.md          需求的原始来源，49 个问题和用户的回答
legacy/                 重构前的旧版本，仅存档
```

---

## 数据格式

### `data/tree.json`

```jsonc
{ "id":"wash", "n":"洗漱个护", "icon":"🧴", "kind":"goods", "sub":[
    { "id":"wash.oral", "n":"口腔清洁" },
    { "id":"wash.makeup", "n":"彩妆", "fold":true, "cond":"makeup" }
]}
```

- `kind`: `goods` 物品 / `task` 要办的事 / `avoid` 别带
- `fold`: 默认折叠。给「用不上就整块跳过」的准备（男生跳过彩妆、生理用品）

### `data/items.json`

```jsonc
{
  "id":"wash.oral.01",     // 稳定语义 id，见下面的「⚠️ 重要」
  "p":"wash.oral",         // 挂在哪个二级分类
  "t":"牙刷",               // 标题，只留品名，不带数量不带牌子
  "n":"说明",
  "kind":"buy",            // buy 要买 / do 要办 / know 只需知道 / avoid 别带
  "carry":"checked",       // cabin 随身 / checked 托运 / '' 非实体
  "qty":"2",               // 建议数量，从标题里抽出来的
  "pack":"base",           // base 通用 / sg-ntu 新加坡-NTU 专属
  "where":"cn",            // cn 国内买 / sg 到当地买 / '' 没定
  "due":"", "cond":[]
}
```

**`kind` 决定条目出现在哪、算不算进度：**

| kind | 进度 | 出现在 |
|---|---|---|
| `buy` | ✅ | 购物模式 + 打包模式 |
| `do` | ✅ | 要办的事 |
| `know` | ❌ 分子分母都不算 | 只在浏览时显示 |
| `avoid` | ✅ 单独算 | 「别带」区 |

**`carry` 决定能不能装箱，和买不买无关。** 护照不是买的，但必须装进随身包。

### ⚠️ 重要：id 绝不能按位置生成

旧版用 `id = 分类 + 数组下标`。往数组中间插一条内容，后面所有条目的 id 全部位移，
用户标「已买」的洗发水会**静默变成**标在某个药品上 —— 不是丢数据，是看不出来的错位。

现在 id 一经生成就写死在 `items.json` 里，**手工维护，绝不重算**。
新增条目请手动给一个没用过的 id。

---

## 改内容

直接编辑 `data/items.json`，改完刷新即可，不需要构建。

`tools/build_items.py` 只用于「从旧版 339 条重新生成」这一次性迁移，
规则表和精确覆盖表都在脚本里。重跑会**覆盖** `data/items.json`，慎用。

---

## 部署

任何静态托管都行。GitHub Pages 最省事：

```bash
gh repo create <名字> --public --source=. --push
# 然后到 Settings → Pages → Source 选 main 分支 / 根目录
```

上线后手机 Safari 打开 → 分享 → **添加到主屏幕**，就能离线用了。

改了内容要让已安装的手机更新，把 `sw.js` 里的 `const V='travelkit-v1'` 版本号 +1。

---

## 已知边界

- **没有推送通知**。PWA 做不到，只有主动打开才看得到提醒。
- **数据存在浏览器里**，清缓存 / Safari 自动清理站点数据 / 换手机都会丢。
  所以有「我的 → 导出备份」和每次改动的自动快照（留最近 10 份，可回滚）。
- **无痕模式下存不了**，首页会给警告。
