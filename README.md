# Money Manage

个人财务管理系统原型，使用 Next.js 单服务运行页面和 API。

## 环境

项目运行基线为 Node.js 20，不强制使用 Node.js 14。使用 nvm 切换环境：

```bash
nvm install 20
nvm use 20
node --version
```

## 启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run start
```

测试：

```bash
npm test
```

测试范围包括税费与到卡工资、五险一金与赡养老人扣除隔离、统一支出、分期年月换算、未来快照风险确认、场景对比和 autosave 基础流程。资产约束、完整 CRUD、百分比滑条转换和长期走势在生产接口补齐后继续扩展。

项目生成的构建产物和 TypeScript 增量文件已忽略：`.next/`、`dist/`、`*.tsbuildinfo`。

页面和后续 API 由同一个 Next.js 服务管理，不需要额外启动数据服务。
