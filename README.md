# 想吃清单

一个纯静态网页，用来记录想吃的菜和想去的餐厅，设置计划日期与优先级，并标记已经吃过的项目。

## 使用方式

- 打开 `index.html` 即可使用，不需要安装依赖、后端或 GPT。
- 清单使用浏览器 `localStorage` 保存，只在当前浏览器和设备可见。
- 页面提供 JSON 导入和导出，方便自行备份或迁移数据。
- GitHub Pages 发布的是网页代码，不会包含浏览器里的清单数据。

## 发布到 GitHub Pages

仓库的 GitHub Actions 工作流会在 `main` 分支更新时部署仓库根目录。首次发布时，在仓库的 **Settings → Pages** 中将 **Build and deployment → Source** 设为 **GitHub Actions**。
