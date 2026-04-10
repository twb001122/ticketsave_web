# XYSG Web

XYSG Web 是 XYSG / TicketSave 的公开展览端和单管理员管理端。

- 公开端：`/` 票根墙，`/shows/:id` 演出详情。
- 管理端：`/admin`，使用 `ADMIN_PASSWORD` 登录。
- 存储：SQLite 文件和封面图都放在 `DATA_DIR`。
- 备份：导入/导出格式兼容 iOS 的 schema v2 ZIP。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

默认前端开发地址是 `http://localhost:5173`，API 服务端口由 `.env` 的 `PORT` 控制。

## 生产构建

```bash
npm install
npm run build
npm run start
```

`npm run start` 会启动一个 Express 服务，同时提供 API、封面图和构建后的前端页面。

## 1Panel 手动 Git 部署

第一次在服务器准备仓库：

```bash
cd /opt
git clone https://github.com/twb001122/ticketsave_web.git ticketsave_web
cd /opt/ticketsave_web
cp .env.example .env
```

编辑 `/opt/ticketsave_web/.env`：

```env
PORT=3008
DATA_DIR=/app/data
ADMIN_PASSWORD=换成你的管理密码
SESSION_SECRET=换成随机长字符串
UPLOAD_LIMIT_MB=256
```

安装并构建：

```bash
npm ci
npm run build
```

然后在 1Panel 里把 Node.js 运行环境指向：

```text
/opt/ticketsave_web
```

启动命令使用：

```bash
npm run start
```

以后每次更新：

```bash
cd /opt/ticketsave_web
git fetch origin
git checkout main
git pull --ff-only origin main
docker exec xysg-web sh -lc 'cd /app && npm ci && npm run build'
docker restart xysg-web
```

## 宝塔 Linux 部署

1. 在宝塔「Node项目」里添加项目，项目目录指向当前仓库目录。
2. 在项目目录创建 `.env`：

```env
PORT=3008
DATA_DIR=./data
ADMIN_PASSWORD=换成你的管理密码
SESSION_SECRET=换成随机长字符串
UPLOAD_LIMIT_MB=256
```

3. 在宝塔终端或 Node 项目目录执行：

```bash
npm install
npm run build
```

4. Node 项目启动命令填写：

```bash
npm run start
```

5. 宝塔里绑定域名，并把访问转发到 Node 项目的端口。若宝塔 Node 项目面板自动处理反代，就直接使用面板生成的配置。
6. 确认 `/www/wwwroot/xysg-data` 存在且 Node 运行用户可写：

```bash
mkdir -p /www/wwwroot/xysg-data
chmod -R 755 /www/wwwroot/xysg-data
```

## 数据目录

`DATA_DIR` 中会生成：

- `xysg.sqlite`：服务器 SQLite 数据库。
- `covers/`：上传和 ZIP 导入的封面图。

这两个内容必须持久化备份。重启 Node 服务不会清空数据。

## 上传大小

默认上传限制是 `256MB`，由 `.env` 的 `UPLOAD_LIMIT_MB` 控制。
如果 iOS ZIP 备份更大，可以把它调高，例如：

```env
UPLOAD_LIMIT_MB=512
```

## iOS ZIP 兼容

Web 管理端导入和导出的 ZIP 包含：

- `manifest.json`
- `shows.json`
- `performers.json`
- `brands.json`
- `venues.json`
- `covers/*`

Web 独有的 `notesPublic` 不写入 ZIP，避免破坏 iOS 恢复。
