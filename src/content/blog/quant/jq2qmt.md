---
title: "聚宽策略一键搬进QMT？我写了个工具，试了一下还挺香"
date: 2026-05-18
updated: 2026-05-18
description: jq2qmt 工具：聚宽策略自动转 QMT，含 API 兼容层、定时调度与 GBK 双版本发布。
---

这几天就干了一件事——把自己在聚宽上跑了挺久的策略，搬到了 QMT 里。

起因很朴素：想直接实盘的环境部署。但问题是，聚宽和QMT的代码差异真的很大，手改一遍相当于重写，又懒又容易出错。

于是就索性自己写了个转换工具，叫 **jq2qmt**，专门干这件事。

---

## 为什么不直接手改？

聚宽策略和QMT策略，表面上都是Python，但骨子里差了一大截：

| 差异点 | 聚宽 | QMT |
|---|---|---|
| 入口函数 | `initialize` + `handle_data` | `init` + `handlebar` |
| 定时任务 | `run_daily(func, time='09:31')` | 手写时间判断逻辑 |
| 数据接口 | `get_price`、`attribute_history` | `ContextInfo.get_market_data_ex` |
| 持仓/资金 | `context.portfolio.cash` | `get_trade_detail_data(acc, ...)` |
| 证券代码 | `000001.XSHE` | `000001.SZ` |
| 编码要求 | UTF-8 | GBK（QMT 3.6内置Python） |

每一行涉及数据或下单的代码几乎都要改。手改一遍还好，但改完之后聚宽原版再更新，又要重新改一遍。

---

## jq2qmt 干了什么

这个工具的核心逻辑是：**把聚宽的代码"外科手术式"处理，然后拼上一个兼容层**。

### 1. 源码清洗

自动删掉这些聚宽专有的东西：
- `from jqdata import *`
- `set_option`、`set_slippage`、`set_order_cost`
- `run_daily(...)` 注册语句
- `import numpy`、`import pandas` 这类在QMT里不需要手动导的

只保留从 `def initialize(context):` 开始往后的策略逻辑，就像把包装纸撕掉，留下芯子。

### 2. 自动生成定时调度

聚宽里写 `run_daily(my_func, time='09:31')` 这样的语句，工具会扫描出来，自动生成QMT对应的 `handlebar` 里的时间窗口判断：

```python
def handlebar(ContextInfo):
    ...
    _run_scheduled(ctx, "09:31", "09:41", "my_func", my_func)
```

默认时间窗口10分钟，避免分钟K线只触发一次然后错过。

### 3. API兼容层（shim）

这是最核心的部分——内置了一套聚宽API的QMT映射：

- `get_price` → `ContextInfo.get_market_data_ex`
- `attribute_history` → 包装了get_price的单股多字段版
- `context.portfolio.positions` → `get_trade_detail_data` 拿持仓后转格式
- `get_current_data()` → `get_full_tick` 实时行情
- `order(security, amount)` → `passorder`（带成交校验，失败会打日志）
- 代码格式：`000001.XSHE` ↔ `000001.SZ` 互转

这层shim直接内嵌到生成的文件里，不依赖任何外部包，QMT直接能跑。

### 4. 买入资金校验补丁

这个细节比较实用：QMT回测里，13:10的市价买单实际成交价会比last价高1.5%~3%（滑点+佣金叠加），导致明明算够钱但QMT给你拒单，日志显示"成功"但操作明细里没有委托。

工具会自动把旧的下单逻辑补丁掉，换成用 `get_full_tick` 拿卖一价估算验资单价，向下取整到100股批次，避免这个坑。

### 5. 双版本输出

- `xxx_QMT_dev.py`：UTF-8，在Cursor/VSCode里正常编辑
- `xxx_QMT.py`：GBK，QMT直接读这个
- Emoji自动替换：`✅` → `[Y]`，`❌` → `[N]`（GBK不支持emoji）
- 中文 `record(收益=...)` 参数名自动替换为MD5哈希的ASCII名

---

## 用起来怎样

三步走：

```powershell
# 第一步：首次配置依赖（QMT自带Python没有numpy/pandas）
python qmt/jq2qmt/install_deps.py

# 第二步：转换
python qmt/jq2qmt/convert.py my_strategy.py --name "我的ETF策略"

# 第三步：发布到QMT
python qmt/jq2qmt/deploy.py qmt/my_strategy_QMT_dev.py
```

转换完之后在 `qmt/` 目录下生成两个文件，去QMT里关闭重开策略就能用。

如果改了策略逻辑，改 `_dev.py` 那个，然后重新 `deploy` 就好。

---

## 哪些聚宽API还没支持

目前已支持的主要是：

✅ `get_price` / `attribute_history`  
✅ `get_current_data` / `get_security_info`  
✅ `get_all_securities`（ETF/LOF）  
✅ `get_extras`（基金净值）  
✅ `get_trade_days`  
✅ `order`（按股数买卖）  
✅ `log` / `record` / `g` / `context.portfolio`  

还没做的：

❌ `order_target_value`、`order_target_percent`  
❌ `get_fundamentals`（财务数据）  
❌ `get_index_stocks`、`get_industry_stocks`  
❌ 期货、融资融券相关  

如果策略用到这些，目前还得手改或者扩展shim文件。

---

## 还有一个日志对账问题

这个我踩过坑，记录一下：

QMT回测里，日志上的时间戳是**墙钟时间**（你电脑当前时刻），不是策略模拟的交易日。比如你今天跑2023年的回测，日志里打的是`【2026-05-18 20:30】`，但实际模拟交易日在2023年。

要看真正的成交日，得看操作明细里的时间，或者看日志里 `[YYYY-MM-DD HH:MM]` 格式的括号时间——工具生成的策略里已经在关键日志里加了这个格式。

---

## 适合什么场景

- 聚宽上已经跑通、想搬到QMT接近实盘的策略
- 策略里主要用到价格、ETF净值、持仓、基础下单这些API
- 不想每次更新策略都手改一遍QMT版

不适合：
- 大量依赖财务数据、行业分类的选股策略（shim还不完整）
- 期货策略

---

工具源码在仓库 `qmt/jq2qmt/` 目录，自用为主。[下载 jq2qmt 工具包](jq2qmt.7z)（与本文同路径）。有类似需求的朋友可以参考思路，或在公众号 **尿布与K线 · NappyQuanter** 私信回复 `jq2qmt` 获取说明，再按自己的策略结构改改 shim，应该能省不少力气。

---

*以上内容为个人工具记录，不构成任何投资建议。量化有风险，实盘需谨慎。*
