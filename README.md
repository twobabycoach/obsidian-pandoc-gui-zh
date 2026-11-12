# 笔记导出助手

把 Obsidian 笔记导出为 Word、PDF、网页，也能把 Word 文档导入为笔记。简体中文界面，常用操作在窗口里点选。

## 安装

在 [发布页](https://github.com/twobabycoach/obsidian-pandoc-gui-zh/releases/latest) 下载 **pandoc-gui-zh.zip**。解压后，把 `pandoc-gui-zh` 文件夹放进笔记库的 `.obsidian/plugins`，重启 Obsidian，再到「设置 → 第三方插件」启用「笔记导出助手」。需要 Obsidian **1.13.0** 或更新版本。[完整安装说明](docs/INSTALL_ZH.md)

## 使用

打开笔记，点左侧「导出笔记」，选 **Word、PDF 或网页**。文件默认保存在笔记所在文件夹。展开「文件名、目录与样式」可以更换保存位置、生成目录、套用 Word 样式，或把封面和附件合进同一个 Word 文件。

点左侧「把文档导入为笔记」，选择 Word 文件即可导入。图片默认随文档保存。首次需要安装转换组件或 PDF 中文字体时，窗口里会出现安装按钮。[中文使用指南](docs/USER_GUIDE_ZH.md)

## 从源码构建

使用 Node.js 24，在项目目录运行 `npm ci` 和 `npm run build`。将生成的 `main.js` 与 `manifest.json`、`styles.css` 放入同一个插件文件夹。

## 来源与许可

基于 [pan4ratte/obsidian-pandoc-gui](https://github.com/pan4ratte/obsidian-pandoc-gui) 3.1.2 开发，保留上游提交历史和 [MIT 许可证](LICENSE)。中文版的插件标识是 `pandoc-gui-zh`，可与原版并存。

[上游功能与处理规则目录（英文）](docs/README_UPSTREAM.md)
