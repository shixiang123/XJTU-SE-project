# XJTU API

XJTU 教务数据后端服务（非官方，仅用于学习与个人项目）。

当前后端为 `XJTU` 单校模式，核心能力包括：
- 小程序登录令牌下发（本地 token）
- 触发后台爬取西交 `ehall` 课表与成绩
- 对外提供统一的课表/成绩接口

## 环境要求

- Node.js 16+
- 已安装 Chrome（用于 Playwright 连接本地 Chrome）

## 安装与运行

```bash
npm install
npm start
```

默认端口 `3000`，可在 `.env` 中通过 `PORT` 覆盖。

## 关键接口

- `POST /login`
  - 入参：`{ stuId, password }`
  - 返回本地 token（用于小程序接口鉴权）
- `POST /crawl/xjtu/trigger`
  - 入参：`{ stuId, password }`
  - 触发后台爬虫任务
- `GET /crawl/xjtu/status`
  - 查看爬虫执行状态与摘要
- `GET /courses`
  - 获取课表（爬虫映射结果）
- `GET /scores`
  - 获取成绩（聚合结果）
- `GET /raw-scores`
  - 获取成绩明细（含平时/期中/期末等）

## 爬虫输出

默认输出到：

`output/xjtu-ehall.json`

可通过环境变量 `XJTU_OUTPUT` 覆盖路径。

## 注意事项

- 小程序登录与学校教务登录分离：
  - 小程序端 `/login` 仅完成业务鉴权；
  - 实际学校登录由爬虫在触发时使用学号密码自动完成。
- 本项目仅面向 XJTU 场景，未维护其他学校适配逻辑。
