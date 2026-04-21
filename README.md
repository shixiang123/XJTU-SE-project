# XJTUhub

XJTUhub 是一个面向西安交通大学场景的微信小程序 + Node.js 后端项目，核心目标是把教务与学习常用信息整合到一个统一入口中。

当前版本已完成：
- 账号登录与会话鉴权
- 课表查询、成绩查询（含原始小分明细）
- DDL 抓取与勾选管理
- 考勤抓取与分维度展示（本周/本月/本学期）
- 课程资料共享（上传/列表/下载/删除）
- MongoDB 数据源接入（支持 JSON 与 Mongo 双模式）

## 项目结构

```text
XJTUhub-main/     微信小程序前端
XJTU-API-main/    Node.js 后端 API + 爬虫
README.md         项目总说明（本文件）
```

## 核心功能

1. 登录与鉴权
- 前端输入学号和密码，调用 `POST /login` 获取本地 token。
- token 格式为 `xjtu-<stuId>-...`，后端通过请求头 `token` 完成业务鉴权与用户隔离。

2. 课表与成绩
- 支持分别触发课表爬虫、成绩爬虫，避免耦合。
- 成绩包含有效成绩与原始分项（平时/期中/期末/综合等），支持按学分加权均分计算。

3. DDL
- 可触发 LMS（SYXT）DDL 抓取。
- 支持前端勾选完成状态。
- 在 Mongo 模式下，DDL 勾选状态可持久化。

4. 考勤
- 支持触发考勤系统（BKKQ）抓取。
- 展示本周/本月/本学期分类数据与汇总指标。

5. 资料共享
- 支持文件上传到后端公共目录、分页列表、下载。
- 仅发布者可删除自己上传的文件。
- 支持常见课件/压缩包/文档格式。

## 数据库接入与数据管线（Pipeline）

### 1) 数据源模式

后端通过环境变量 `DATA_SOURCE` 控制数据源：
- `json`：读取本地 `output/*.json` 文件（默认）
- `mongo`：优先读写 MongoDB（不可用时回退到本地）

关键实现位于：
- `XJTU-API-main/db/mongo.js`
- `XJTU-API-main/services/crawlerDataService.js`

### 2) Mongo 连接与索引初始化

后端启动时会尝试连接 Mongo，并自动创建索引：
- `crawler_data`（课表/成绩聚合数据）
- `ddls`（DDL 列表与勾选状态）
- `resources`（资料元信息索引预留）

对应代码：
- `XJTU-API-main/app.js`
- `XJTU-API-main/repositories/*.js`

### 3) 课表/成绩爬取与入库链路

链路如下：
1. 前端点击刷新（课表页或成绩页）
2. 调用：
   - `POST /crawl/xjtu/course/trigger`（仅课表）
   - `POST /crawl/xjtu/score/trigger`（仅成绩）
3. 后端子进程运行 `scripts/xjtu-ehall-crawler.js`
4. 爬虫输出到 `output/xjtu-ehall.json`
5. 后端在任务成功后调用 `syncLatestCrawlerOutputToMongo(stuId)`，将映射后的 `courseList/scoreList/rawScoreList` 写入 Mongo
6. 前端轮询 `GET /crawl/xjtu/status`，任务结束后请求 `GET /courses`、`GET /scores`、`GET /raw-scores`

说明：
- Mongo 模式下，`/courses` 和 `/scores` 会按 token 中 `stuId` 读取各自数据。
- JSON 模式下，读取本地 output 文件映射结果。

### 4) DDL 链路

1. 前端触发 `POST /crawl/syxt/ddl/trigger`
2. 爬虫脚本 `scripts/xjtu-syxt-ddl-crawler.js` 生成 `output/xjtu-syxt-ddl-<stuId>.json`
3. `GET /ddl` 优先读取 Mongo（若启用）；没有则读 output 文件并可回写 Mongo
4. `PATCH /ddl/:id` 更新 done 状态（Mongo 模式持久化，否则内存态）

### 5) 考勤链路

1. 前端触发 `POST /crawl/xjtu/attendance/trigger`
2. 爬虫脚本 `scripts/xjtu-bkkq-crawler.js` 生成 `output/xjtu-bkkq-attendance-<stuId>.json`
3. `GET /attendance` 返回标准化后的：
   - `list`
   - `byTab`（week/month/term）
   - `summary`
   - `rawTables`

### 6) 资料共享链路

1. 前端 `wx.uploadFile` 到 `POST /resources/upload`
2. 后端保存到 `XJTU-API-main/public/materials/`
3. 元信息写入 `.meta.json`（显示名、上传者等）
4. `GET /resources` 分页返回列表
5. `DELETE /resources/:id` 仅允许上传者删除
6. 通过 `/materials/*` 下载（后端设置附件下载头）

## 项目特点

1. 面向单校场景深度适配
- 围绕 XJTU 的 ehall、LMS、BKKQ 业务流程做了专门爬取适配。

2. 模块化爬取触发
- 课表和成绩已拆分为独立触发接口，刷新互不影响，链路更稳定。

3. 数据源可切换
- 支持 JSON 与 Mongo 双模式；Mongo 不可用时可平滑回退，保证基本可用性。

4. 用户维度数据隔离
- token 中携带 `stuId`，课表/成绩/DDL/考勤按用户维度读取对应数据快照。

5. 前后端协同加载体验
- 前端有本地缓存、刷新状态与轮询机制；爬取过程中可持续显示加载状态。

## 快速启动

### 1) 启动后端

```bash
cd XJTU-API-main
npm install
npm start
```

默认监听 `0.0.0.0:3000`。

### 2) （可选）启用 Mongo

在 `XJTU-API-main/.env` 配置：

```env
DATA_SOURCE=mongo
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=xjtuhub
```

如需把现有 JSON 快照迁移到 Mongo：

```bash
npm run migrate:mongo
```

### 3) 启动前端（微信开发者工具）

1. 导入 `XJTUhub-main`
2. 构建 npm
3. 确认 `XJTUhub-main/config.js` 的后端地址可访问
4. 真机调试时可设置：
   - `wx.setStorageSync('lanBaseUrl', 'http://<你的局域网IP>:3000')`

## 常用接口一览

- `POST /login`
- `GET /courses`
- `GET /scores`
- `GET /raw-scores`
- `GET /attendance`
- `GET /ddl`
- `PATCH /ddl/:id`
- `GET /resources`
- `POST /resources/upload`
- `DELETE /resources/:id`
- `POST /crawl/xjtu/course/trigger`
- `POST /crawl/xjtu/score/trigger`
- `GET /crawl/xjtu/status`
- `POST /crawl/xjtu/attendance/trigger`
- `GET /crawl/xjtu/attendance/status`
- `POST /crawl/syxt/ddl/trigger`
- `GET /crawl/syxt/ddl/status`

## 说明

- 本项目为学习与个人项目用途，非学校官方系统。
- 爬虫能力依赖目标网站页面结构，目标系统变更后需同步维护脚本。

