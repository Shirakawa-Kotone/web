# 添加批次多选筛选功能

## 概述

在高考录取数据查询应用的筛选栏中新增「批次类型」多选筛选，复用已有的省份多选弹窗交互模式。

## 布局调整

| 行 | 左半（half） | 右半（half） |
|---|---|---|
| 4 | 选科要求（picker） | 批次类型（picker，新增） |
| 5 | 专业组名称（input） | 专业组代码（input） |

原布局中选科要求与专业组名称同行、专业组代码独占一行。调整后将专业组名称与专业组代码合并为一行，腾出位置让选科要求与批次同行。

## 批次数据来源

在 `buildMergedCache()` 完成后，调用 `buildBatchList()` 扫描 `state.allData` 中每个记录的 `record[9]`（批次字段），取唯一非空值并按字典序排序，存入 `BATCH_ALL` 数组。

## 交互模式（复用省份多选）

- **触摸点**：`.picker` 元素（显示当前选中状态）
- **弹窗**：模态弹窗，标题「选择批次」，含全选/清空/确定按钮
- **临时状态**：`tempSelectedBatches` / `tempBatchChecked`，确认时才写入正式状态
- **选中标签**：0 个显示「全部批次」，1-2 个显示选中项，超过 2 个显示「{第一个}、{第二个} 等{N}个批次」
- **确认后**：更新标签 → 关闭弹窗 → 触发 `doSearch()`

## 搜索过滤

- **全部模式**：`if (selectedBatches.length && selectedBatches.indexOf(g.batch) === -1) continue`
- **单年模式**：`if (selectedBatches.length && selectedBatches.indexOf(r[9]) === -1) continue`
- 未选中任何批次时不过滤

## 涉及修改的文件

### index.html
- `filter-bar` 中调整两行布局（选科+批次、专业组名称+专业组代码）
- 新增 `#batch-modal` 弹窗（与 `#province-modal` 结构相同）

### app.js
- 新增 `let BATCH_ALL = []`（全局变量，动态填充）
- 新增 state 字段：`selectedBatches`、`batchLabel`、`tempSelectedBatches`、`tempBatchChecked`
- 新增 `buildBatchList()` 函数
- 新增批次弹窗交互函数（与省份弹窗完全相同的模式）
- `doSearch()` 中合并模式与单年模式各加一条 batch 过滤
- `updateFilterUI()` 中更新 `batch-label` 文本
- `doReset()` 中清空批次选择
- `initDOM()` 中添加批次弹窗 DOM 引用
- `bindEvents()` 中绑定批次弹窗事件
- `init()` 中 `buildMergedCache()` 完成后调用 `buildBatchList()`

## 不做的事情

- 不修改后端数据逻辑
- 不改变现有筛选器其他部分的行为
- 不添加 CSS 新样式（复用现有弹窗/选择器样式）
