# XJTUhub

XJTUhub 是一个面向西安交通大学学习场景的校园便捷平台项目，包含：

- `XJTUhub-main`：微信小程序前端
- `XJTU-API-main`：Node.js 后端与爬虫服务
- 根目录学术主页：静态网站（`index.html + static/`）

项目目标是把高频校园学习任务整合到统一入口，覆盖课表、成绩、考勤、待办与资料共享。

## 项目主页

- 仓库地址：[XJTU-SE-project](https://github.com/shixiang123/XJTU-SE-project)
- `final` 分支主页源文件：根目录 `index.html`
- 主页特性：
  - 中英文切换
  - 顶部 Demo 视频展示
  - 功能截图区（课表 / 成绩 / 考勤 / 待办事项 / 共享文件）
  - 系统贡献点说明（含团队分工、AI+人工协作流程）
  - 访客统计

## 功能概览

### 已实现功能

1. 成绩查询与均分计算
- 支持按学期查看成绩。
- 支持成绩明细展示与均分分析。

2. 考勤查询与预警
- 统计正常/迟到/缺勤。
- 按风险强度分级提示缺勤风险。

3. 课表与待办导出
- 支持课表信息查看与导出。
- 支持学校系统待办任务同步与导出。

4. 共享资料数据库
- 支持学习资料上传、检索、下载与复用。

### 规划功能

1. 后端迁移到微信云平台，准备线上发布。
2. 课表接入地图 API，实现教室导航。
3. 建设论坛发帖与互动能力，支持学生协作与师生科研/竞赛对接。

## 系统贡献点（开发方式）

本项目采用 **vibe-coding + 人类审查** 协作模式，不是“完全自主 AI 开发”。

关键实践：

1. 明确分工并协同联调
- Zhiyuan Jiang：项目统筹、baseline 调研、AI skills 调研与流程设计、功能测试统筹。
- Yuexin Chen / Yuyang Xie：前端页面与交互开发，结合 UI 设计经验完成小程序落地。
- Xiang Shi：后端爬虫与数据同步链路。
- Yifan Shan：数据库与资源数据层。

2. 先需求分析，再分派 Agent
- 在分派任务前完成需求拆解、技术选型、成本评估。
- 通过详细说明文档和长期人工审核，降低 AI 幻觉风险。

3. 成本与质量双控制
- 项目成本控制在 100 RMB 以内（低于预期 200 RMB）。
- 各功能上线前经过团队联合测试与检查。

## 仓库结构

```text
XJTU-SE-project-main/
├── index.html                 # 学术主页（静态）
├── static/                    # 学术主页资源
├── XJTUhub-main/              # 微信小程序前端
├── XJTU-API-main/             # Node.js 后端 + 爬虫
└── README.md
```

## 本地运行

### A. 学术主页（静态站）

不需要 build，直接本地起静态服务：

```bash
cd /path/to/XJTU-SE-project-main
python3 -m http.server 8080
```

浏览器打开：`http://127.0.0.1:8080`

### B. 后端服务（XJTU-API-main）

```bash
cd XJTU-API-main
npm install
npm start
```

默认端口通常为 `3000`（以项目内实际配置为准）。

### C. 微信小程序（XJTUhub-main）

1. 使用微信开发者工具导入 `XJTUhub-main`。
2. 构建 npm（如项目依赖需要）。
3. 配置请求后端地址，联调后端接口。

## 部署说明（GitHub Pages）

学术主页属于静态页面，通常不需要构建流水线。

1. 将主页改动推送到目标分支（例如 `final`）。
2. 在 GitHub 仓库 `Settings -> Pages` 选择：
- Source: `Deploy from a branch`
- Branch: `final`
- Folder: `/ (root)`
3. 等待 Pages 自动发布。

默认地址通常为：
`https://<owner>.github.io/<repo>/`

例如本仓库：
`https://shixiang123.github.io/XJTU-SE-project/`

## 说明

- 本项目为课程/学习用途，非学校官方系统。
- 爬虫相关逻辑依赖目标站点页面结构，若目标系统变更需同步维护。
- 仓库中若存在 `.DS_Store` 等系统文件，建议不要纳入版本管理。
