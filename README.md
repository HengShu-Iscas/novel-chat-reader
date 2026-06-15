# NovelChat Reader

[English](README.en.md)

NovelChat Reader 是一个本地优先的开源阅读工具，用网页中的 AI 对话界面来呈现本地 TXT/EPUB 小说内容。它提供 Chrome/Edge Manifest V3 扩展版，也提供 Windows 浏览器启动型桌面版。

本项目是独立、实验性、非商业项目，不隶属于 OpenAI、Google、DeepSeek、字节跳动、豆包、火山方舟或任何模型服务商。仓库不包含官方截图、官方 logo 图片资产、私有小说或 API key。

## 主要功能

- 在浏览器标签页中打开类似 AI 对话站点的阅读界面。
- 默认空书库；导入后侧栏显示项目生成的办公/研究/开发类伪装话题。
- 真实书名默认隐藏，仅当鼠标移入侧栏时显示，避免截图或空闲状态暴露阅读内容。
- 支持 TXT 和 EPUB。
- 支持顶部上传按钮、更多菜单、拖拽、文件选择器、Windows “打开方式” 和本地文件夹书库。
- Windows 安装版可指定本地书库文件夹，自动扫描顶层 `.txt` / `.epub` 文件；添加或删除文件会同步更新侧栏。
- 每本书右侧的 `...` 菜单用于章节浏览和章节切换。
- 支持左右方向键切换章节，也支持在输入框中发送后进入下一章。
- 切换章节后自动回到正文顶部。
- 小说正文按自然句末断句，中文引号对话会优先在下引号后断开。
- 用户插话使用本地模板池生成，避免过短、重复或机械。
- 支持 ChatGPT、Gemini、DeepSeek、豆包四套视觉皮肤。
- 支持 10 类内置伪装话题主题；可选 API 生成入口保留为后续扩展。
- API key 只保存在当前会话状态中，不写入 IndexedDB、扩展存储或本地服务状态。
- `Alt+B` 老板键会跳转到当前皮肤对应的公开 AI 站点；配套扩展可优先聚焦已有标签页。

## 下载与运行

普通用户应从 GitHub Releases 下载发行资产。`release/` 是本地构建输出目录，不会随 git 提交上传。

Windows 发行版包含两个文件：

- `NovelChat Reader-0.1.0-win-x64.exe`：安装版。
- `NovelChat Reader-0.1.0-win-x64-portable.exe`：便携版，无需安装。

启动 Windows 版后，程序会驻留托盘，启动本地服务，并在默认浏览器中打开阅读页面。默认优先使用：

```text
http://127.0.0.1:17661/
```

如果端口被占用，会自动尝试附近的 `176xx` 端口。

## 文件夹书库

Windows local-web / EXE 模式支持“文件夹书库”。它适合希望用文件管理器维护书库的用户：

1. 在隐藏设置中选择“书库文件夹”。
2. 推荐默认路径：`%USERPROFILE%\Documents\NovelChat Books`。
3. 把 `.txt` 或 `.epub` 文件放入该文件夹。
4. 刷新或重新扫描后，侧栏会出现对应的伪装话题。
5. 删除文件后，侧栏会同步移除；如果以后把同一路径文件放回，进度缓存会尽量恢复。

首版只扫描指定目录的顶层文件，不递归子文件夹。损坏的单本文件会在隐藏设置中显示错误，不会影响其他书籍。

浏览器扩展版不能直接扫描本地目录，因此仍使用手动导入和 IndexedDB。

## 手动导入

可用导入入口：

- 顶部上传图标。
- 更多菜单中的导入操作。
- 拖拽 `.txt` / `.epub` 到页面。
- 浏览器文件选择器。
- Windows 安装版的 “打开方式”。

输入框里的纸夹仅作为视觉伪装，不承担导入功能。

## 章节与阅读

- 侧栏每本书右侧的 `...` 打开章节菜单。
- 章节菜单中可以选择任意章节，也可以上一章/下一章。
- 左右方向键可切换章节；当输入框正在编辑文字时不会误触。
- 输入框发送一条内容后，会进入下一章，用于模拟真实对话推进。
- 切换章节后正文滚动到顶部，避免从上一章位置继续阅读造成混乱。

## 老板键

- 网页有焦点时按 `Alt+B`，会打开当前皮肤对应的公开 AI 站点。
- Windows 版托盘进程也会注册 `Alt+B` 作为全局兜底。
- 配套扩展安装后，会优先激活已经打开的目标站点标签页；未安装扩展时会用默认浏览器打开目标站点。

桌面版不控制用户浏览器中的已有会话内容，只负责打开或切换到公开站点。

## 扩展版

加载 Chrome/Edge 扩展：

1. 运行 `npm.cmd run build`。
2. 打开 Chrome 或 Edge 的扩展管理页面。
3. 开启开发者模式。
4. 选择“加载已解压的扩展程序”。
5. 选择生成的 `dist/` 目录。

扩展版可以独立使用，也可以作为 Windows local-web 模式的增强层。

权限说明：

- `storage`：保存本地阅读状态和设置。
- `tabs`：实现老板键的标签页激活/跳转。
- `http://127.0.0.1/*` 和 `http://localhost/*`：让扩展发现本地启动器服务。

扩展不会向模型服务商网站注入脚本。

## 开发

安装依赖：

```powershell
npm.cmd install
```

运行测试和构建：

```powershell
npm.cmd test
npm.cmd run build
```

普通网页预览：

```powershell
npm.cmd run dev
```

浏览器启动型桌面开发模式：

```powershell
npm.cmd run desktop:dev
```

构建 Electron 主进程和预加载脚本：

```powershell
npm.cmd run desktop:build
```

打包 Windows 安装版和便携版：

```powershell
npm.cmd run dist:win
```

`dist:win` 会构建 Web UI、打包 Electron 启动器脚本，并把安装包写入 `release/`。该目录被 `.gitignore` 忽略，不应提交到仓库。打包脚本默认设置 Electron 下载镜像；如需自定义，可在运行前设置 `ELECTRON_MIRROR` 或 `ELECTRON_BUILDER_BINARIES_MIRROR`。

发布前检查：

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run desktop:build
npm.cmd run scan:release
git diff --check
```

## 隐私

- 所有书籍默认只保存在本机。
- 扩展/静态模式使用浏览器 IndexedDB。
- Windows local-web 模式使用本地服务状态；文件夹书库按路径读取本地文件，并用稳定路径 ID 保存进度缓存。
- 可选 API polish 默认关闭。
- API key 只保存在当前会话内，刷新或会话结束后需要重新输入。
- 不要把私有小说、截图、API key 或发行产物提交到公开仓库。

## 品牌与下架声明

四套皮肤是用本项目自己的 HTML/CSS/通用图标实现的视觉近似，仅用于个人非商业实验。本仓库不包含官方截图、官方 logo 图片或服务商专有源码。

如果任何权利方认为某个皮肤、名称或视觉处理不合适，请通过 issue 或其他方式联系维护者。维护者会及时移除或修改相关内容。

## 许可证

MIT。详见 [LICENSE](LICENSE)。
