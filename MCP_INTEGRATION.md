# MCP_INTEGRATION.md — 麦当劳 MCP 接入说明

> 本文档说明「麦麦消消乐」实际使用的麦当劳 MCP Server、Tool、调用流程与业务价值。

## 1. 使用的 MCP Server

| 项 | 值 |
|---|---|
| Server 名称 | `mcd-mcp`（麦当劳中国 MCP Server） |
| 接入地址 | `https://mcp.mcd.cn` |
| 传输类型 | `streamablehttp` |
| 认证方式 | `Authorization: Bearer <MCP_TOKEN>`（Token 经环境变量注入，**不在仓库中留存真实值**） |
| 官方使用指南 | https://github.com/M-China/mcd-mcp-server |

客户端配置（官方标准格式，Token 用占位符）：

```json
{
  "mcpServers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://mcp.mcd.cn",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}
```

## 2. 使用的 Tool 清单

| Tool | 用途 | 在本项目中的角色 |
|---|---|---|
| `available-coupons` | 拉取当前用户可领取的优惠券列表 | 开奖前校验奖池券库存/活动有效性，避免发放已结束活动的券 |
| `auto-bind-coupons` | 一键领取「麦麦省」券到当前账号 | **核心发放动作**：玩家通关/开启惊喜盒后，把奖励真实绑定到玩家账号 |
| `query-my-coupons` | 返回我的券列表（含券码） | 将领券结果回写到游戏通关弹窗，玩家可直接看到券码 |
| `create-order` | 积分兑换 / 下单（实体兑换场景） | 传说档「满 30 减 5」等高价值奖励的兑换兜底；未来"游戏积分换周边"场景 |
| `query-nearby-stores` | 查询附近门店 | 弹窗内"查看附近门店"入口，缩短核销路径 |
| `query-meals` | 查询餐品 | "用这张券点一单"场景，衔接游戏与点餐 |
| `calculate-price` | 计算订单价格 | 展示用券后的优惠金额，强化"省钱"感知 |

## 3. 调用流程

### 3.1 主链路：通关 → 真实领券

```
玩家通关 LV.n（达成目标分 + 冰全碎）
   │
   ▼
游戏前端计算本关奖励（固定券 + 惊喜盒档位）
   │
   ▼  ① available-coupons
校验奖池券在当前账号/当前活动下可领
   │
   ▼  ② auto-bind-coupons
按奖励档位一键领取对应「麦麦省」券
   │
   ▼  ③ query-my-coupons
拉取券码，回写到通关弹窗（玩家可见真实券码 + 使用条件 + 有效期）
   │
   ▼  ④ query-nearby-stores / query-meals / calculate-price（可选延伸）
"附近门店" / "顺手点一单"入口 → 用券下单
```

### 3.2 代码级接入点（生产版）

演示版为单文件纯前端，发放的是形如 `MCMD15-2-XXXX` 的**占位券码**（避免演示环境误领真实券）；生产版仅需将 `index.html` 中的 `generateCoupon()` 替换为 MCP 调用：

```js
// 生产版：替换 generateCoupon()（示意，Token 由服务端环境变量注入）
async function generateCoupon(lv){
  const r = await fetch("https://mcp.mcd.cn/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + process.env.MCD_MCP_TOKEN   // 占位符示意，不入库
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "auto-bind-coupons", arguments: { couponId: lv.reward.mcpCouponId } }
    })
  });
  const data = (await r.json()).result.structuredContent.data;
  return data.coupons[0].code;   // query-my-coupons 亦可回写展示
}
```

> 说明：浏览器直连 MCP 会暴露 Token，生产部署时应由 BFF/云函数（如 EdgeOne Makers Cloud Functions）代理 `auto-bind-coupons` 调用，前端只与自有后端交互——这符合参赛声明中"配置文件仅使用环境变量占位符"的信息安全要求。

## 4. 业务价值

| 维度 | 价值说明 |
|---|---|
| **权益精准发放** | 游戏行为（通关/连胜/近失挽回）直接触发 MCP 领券，奖励与运营动作实时挂钩，无需人工发码 |
| **到店核销转化** | 券 3 天有效期 + 弹窗展示使用条件，游戏流量导向门店；`query-nearby-stores` 进一步缩短核销路径 |
| **活动运营灵活性** | 奖池券通过 `available-coupons` 动态校验，官方可随时更换 Behind 活动券，游戏侧零改动 |
| **麦麦送场景延伸** | 通关弹窗接 `query-meals` → `calculate-price`，把游戏互动变成外卖订单入口 |
| **成本可控** | 惊喜盒加权概率（50/25/15/7/3）+ 章节保底，单用户期望成本 = Σ(档位概率 × 面额)，可精确预算 |

## 5. 演示版与生产版差异说明（诚实声明）

| 项 | 本仓库（演示版） | 生产版 |
|---|---|---|
| 券码 | 前端生成的占位码（`MCMD15-2-XXXX` 格式） | `auto-bind-coupons` 领取真实「麦麦省」券 |
| MCP 调用 | 未在演示环境真实调用（避免误领） | 按第 3 节链路接入，建议 BFF 代理 |
| Token | 仓库内仅出现 `YOUR_MCP_TOKEN` 占位符 | 服务端环境变量注入 |
| 惊喜盒"限定周边抽奖资格"档 | 文案占位，标注"待官方活动配置" | 由官方提供抽奖活动配置后生效 |
