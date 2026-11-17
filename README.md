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
