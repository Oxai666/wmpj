# wmpj

破甲（armor-toggle）插件原包存档。同一个包放了两个文件名，内容逐字节相同：

| 文件 | 用途 |
|---|---|
| `破甲！？强强？！.tar.gz` | 原始文件名，未做任何改动 |
| `armor-toggle-6.0.0.tar.gz` | 同一文件的 ASCII 名副本，方便 wget/curl 直链下载 |

- 大小：88280 字节
- sha256：`1fe858e82011056d09b1581f941d62645633e80379b77fa61e848d782ecbbab3`
- 包内结构：

```
plugins/armor-toggle/
├── client.js          18309 字节   前端标题栏药丸开关
├── cordis.patch.yml    6680 字节   宿主补丁描述
├── index.js          215061 字节   Host 半，系统提示词以常量硬编码在此
└── package.json        1497 字节   版本 6.0.0 / CC-BY-NC-SA-4.0
```

## 下载

```bash
# ASCII 名（推荐，省得处理中文路径编码）
wget https://raw.githubusercontent.com/Oxai666/wmpj/main/armor-toggle-6.0.0.tar.gz

# 原始中文名
wget "https://raw.githubusercontent.com/Oxai666/wmpj/main/%E7%A0%B4%E7%94%B2%EF%BC%81%EF%BC%9F%E5%BC%BA%E5%BC%BA%EF%BC%9F%EF%BC%81.tar.gz"
```

或走 GitHub API（同样给 ASCII 名）：

```bash
wget https://github.com/Oxai666/wmpj/raw/main/armor-toggle-6.0.0.tar.gz
```

## 校验

```bash
sha256sum armor-toggle-6.0.0.tar.gz
# 1fe858e82011056d09b1581f941d62645633e80379b77fa61e848d782ecbbab3
```

## 安装

解压后把 `plugins/armor-toggle/` 整个目录放进 dsh 的 plugins 目录，重启宿主。
插件默认 `enabled=false`，装上不等于开着，要在标题栏点「破甲」药丸开关。

---

## 在 dsh 里装回去

dsh = **DeepSeek Harness**（DeepSeek 官方 agent harness，`@deepseek-ai/dsh`）。安卓上跑它的启动器是
**DSHA**：[DSH-APP/DSHA](https://github.com/DSH-APP/DSHA)（官网 dsha.cc）。

DSHA 的插件契约见其 [`docs/plugins.md`](https://github.com/DSH-APP/DSHA/blob/main/docs/plugins.md)：
插件市场支持粘贴 **GitHub 仓库简写 `owner/repo`**、仓库 URL、SSH 地址、**tree/blob 子目录链接**，
以及 archive / codeload / **Release 附件**；HTTPS 的 ZIP / TAR / TAR.GZ / TGZ 都能解析。
包内 `package.json` 要有合法 npm 名称与版本，并声明有效的 `dsh.bundle.patch` 且补丁文件存在。

本仓库因此有两种装法。

### 一、插件市场粘贴（推荐）

仓库根目录是下载存档，没有 `package.json`，直接粘 `Oxai666/wmpj` 会解析失败。
**要粘子目录的 tree 链接**，插件源码目录是 `armor-toggle/`：

```
https://github.com/Oxai666/wmpj/tree/main/armor-toggle
```

打开 dsh 的插件市场 → 粘贴上面这行 → 应用会解析实际包、核对格式/包名/版本/依赖并提交，
装完按提示重启 Web。

### 二、手动装（市场不认的时候）

```bash
wget https://raw.githubusercontent.com/Oxai666/wmpj/main/armor-toggle-6.0.0.tar.gz
tar -xzf armor-toggle-6.0.0.tar.gz
cp -r plugins/armor-toggle /app/plugins/          # 应用内路径
# 或放进 dsh 的 plugins 目录 / 用 dsha-plugin install 走事务链
```

DSHA 里插件目录的可见路径是 `/app/plugins`（宿主内部安装树另有 `.dsh/node_modules`）。
装完默认 `enabled=false`，标题栏点「破甲」药丸才生效。

### 三、仓库内容一览

```
README.md                       本文件
破甲！？强强？！.tar.gz          原始压缩包（88280 字节）
armor-toggle-6.0.0.tar.gz       同一文件的 ASCII 名副本
armor-toggle/                   解包后的插件源码目录，供插件市场按子目录解析
├── client.js
├── cordis.patch.yml
├── index.js
└── package.json
```
