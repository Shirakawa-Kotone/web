#!/usr/bin/env node
'use strict'

/**
 * 高考录取数据查询脚本 (docs/query.js)
 * ───────────────────────────────────────────
 * 读取 alldata.js 压缩数据，按条件过滤后输出 JSON。
 * 供 Claude Code skill (jx-college-pilot) 本地调用。
 *
 * 用法:
 *   node docs/query.js --score 620 --rank 8000 --sr 物化生 --province 广东 --keyword 计算机
 *
 * 输出: JSON (院校分组 + 专业组 + 历年录取线)
 */

const path = require('path')
const fs = require('fs')

// ============================================================
// 常量
// ============================================================
const SR_RMAP = ['04*05', '04', '04*06', '04*05*06']
const SR_MAP = { '04': '物理', '05': '化学', '06': '生物' }
const YEAR_MAP = ['2024', '2025', '2026']

const DATA_FILE = path.join(__dirname, '..', 'alldata.js')
const SCORE_BUFFER = 10
const RANK_BUFFER_RATIO = 0.30
const DEFAULT_LIMIT = 200

// ============================================================
// SR 解析与宽松匹配
// ============================================================

/**
 * 将选科输入解析为代码数组
 * 支持: "物化生" / "04*05*06" / "物理+化学" / "物理化学"
 */
function parseSrCodes(sr) {
  if (!sr || sr === '不限') return []
  // 代码格式: "04*05*06"
  if (sr.includes('*')) return sr.split('*').filter(Boolean)
  // 文字格式: "物化生" / "物理+化学"
  const map = { '物': '04', '理': '04', '化': '05', '生': '06' }
  const cleaned = sr.replace(/[+\s]/g, '')
  const codes = []
  for (const ch of cleaned) {
    const c = map[ch]
    if (c) codes.push(c)
  }
  return [...new Set(codes)]  // 去重
}

/**
 * 宽松匹配: 考生的选科集合 ⊇ 学校要求的选科集合
 * 例: 考生"物化生" → 匹配学校的"物理""物化""物生""物化生""不限"
 */
function srMatch(userSr, schoolSr) {
  // 学校不限 → 所有人都匹配
  if (!schoolSr) return true
  const userSet = new Set(parseSrCodes(userSr))
  const schoolCodes = parseSrCodes(schoolSr)
  // 学校要求为空（不限）→ 所有人都匹配
  if (schoolCodes.length === 0) return true
  // 学校要求的每一科，考生都要有
  return schoolCodes.every(c => userSet.has(c))
}

function srDisplay(sr) {
  if (!sr) return '不限'
  return sr.split('*').map(s => SR_MAP[s] || s).join(' ')
}

// ============================================================
// 数据加载与展开
// ============================================================

function loadRaw() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`找不到数据文件，预期路径: ${DATA_FILE}\n请确保脚本在 web/ 目录下运行`)
  }
  const text = fs.readFileSync(DATA_FILE, 'utf-8')
  const json = text.replace(/^window\.ALL_DATA_RAW\s*=\s*/, '').replace(/;?\s*$/, '')
  return JSON.parse(json)
}

/**
 * 将压缩格式展开为结构化对象数组
 */
function expandAll(raw) {
  const { a: provincePool, b: schoolNamePool, c: groupNamePool, d: records, e: extra } = raw
  const { b: batchPool, p: planPool, g: gcPool, f: feePool, r: remarkPool } = extra

  const out = new Array(records.length)
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const srCode = SR_RMAP[r[4]] || ''
    out[i] = {
      year: YEAR_MAP[r[0]] || '2024',
      province: provincePool[r[1]] || '',
      schoolCode: String(r[2] || ''),
      schoolName: schoolNamePool[r[3]] || '',
      sr: srCode,
      groupName: groupNamePool[r[5]] || '',
      score: r[6],
      rank: r[7],
      count: r[8],
      batch: batchPool[r[9]] || '',
      planType: planPool[r[10]] || '',
      groupCode: gcPool[r[11]] || '',
      fee: feePool[r[12]] || '',
      remark: remarkPool[r[13]] || '',
      majorCode: r[14] !== undefined ? gcPool[r[14]] || '' : '',
    }
  }
  return out
}

/**
 * 按「院校 + 专业组名称」合并各年数据
 * 返回单个组对象数组，含 history 字段（年 → 成绩/排名/人数）
 */
function buildMerged(records) {
  const groups = new Map()

  for (const r of records) {
    const key = r.schoolName + '\x00' + r.groupName
    let grp = groups.get(key)

    if (!grp) {
      grp = {
        province: r.province,
        schoolCode: r.schoolCode,
        schoolName: r.schoolName,
        sr: r.sr,
        groupName: r.groupName,
        groupCode: r.groupCode,
        batch: r.batch,
        planType: r.planType,
        fee: r.fee,
        remark: r.remark,
        majorCode: r.majorCode,
        history: {},
      }
      groups.set(key, grp)
    }

    // 累积历史数据
    if (!grp.history[r.year]) {
      grp.history[r.year] = { score: r.score, rank: r.rank, count: r.count }
    }

    // 用较新年份的数据覆盖元信息（专业组代码、批次等可能跨年变化）
    if (r.year === '2026') {
      grp.groupCode = r.groupCode
      grp.batch = r.batch
      grp.planType = r.planType
      grp.fee = r.fee
      grp.majorCode = r.majorCode
    }
  }

  return Array.from(groups.values())
}

// ============================================================
// 过滤逻辑
// ============================================================

/**
 * 分数/排名缓冲过滤
 * 有分数: 匹配 ±10 分
 * 有排名: 匹配 ±30%
 * 两者都有: 满足其一即可（OR），给 skill 更多数据做分档
 */
function passesScoreRank(grp, score, rank) {
  const entries = Object.values(grp.history)
  if (entries.length === 0) return true

  if (score != null && rank != null) {
    return entries.some(e =>
      (e.score != null && e.score >= score - SCORE_BUFFER && e.score <= score + SCORE_BUFFER) ||
      (e.rank != null && e.rank > 0 &&
        e.rank >= rank * (1 - RANK_BUFFER_RATIO) && e.rank <= rank * (1 + RANK_BUFFER_RATIO))
    )
  }
  if (score != null) {
    return entries.some(e => e.score != null && Math.abs(e.score - score) <= SCORE_BUFFER)
  }
  if (rank != null) {
    return entries.some(e =>
      e.rank != null && e.rank > 0 &&
      e.rank >= rank * (1 - RANK_BUFFER_RATIO) && e.rank <= rank * (1 + RANK_BUFFER_RATIO)
    )
  }
  return true
}

function filterMerged(merged, params) {
  const { province, batch, sr, keyword, year, score, rank } = params
  const provinceSet = province && province.length ? new Set(province) : null
  const batchSet = batch && batch.length ? new Set(batch) : null

  return merged.filter(grp => {
    if (provinceSet && !provinceSet.has(grp.province)) return false
    if (batchSet && !batchSet.has(grp.batch)) return false
    if (sr && !srMatch(sr, grp.sr)) return false
    if (keyword.length && !keyword.some(k => grp.groupName.indexOf(k) !== -1)) return false
    // 指定年份: 只返回该年有数据的组
    if (year && !grp.history[year]) return false
    if (!passesScoreRank(grp, score, rank)) return false
    return true
  })
}

// ============================================================
// 排名估算模式
// ============================================================

function estimateRank(records, params) {
  const { score, year, sr } = params
  if (score == null || !year) {
    return { error: '排名估算需要 --score 和 --year' }
  }

  const matches = []
  for (const r of records) {
    if (r.year !== year) continue
    if (sr && !srMatch(sr, r.sr)) continue
    if (Math.abs(r.score - score) > 5) continue
    matches.push(r)
  }

  if (matches.length === 0) {
    return { score, year, estimatedRank: null, confidence: 'none', sampleSize: 0 }
  }

  const ranks = matches.map(r => r.rank).filter(r => r != null && r > 0)
  if (ranks.length === 0) {
    return { score, year, estimatedRank: null, confidence: 'none', sampleSize: 0 }
  }

  const avgRank = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)
  const confidence = ranks.length >= 50 ? 'high' : ranks.length >= 20 ? 'medium' : 'low'

  return { score, year, estimatedRank: avgRank, confidence, sampleSize: ranks.length }
}

// ============================================================
// 输出格式化
// ============================================================

function formatRecords(merged, limit) {
  const schoolMap = new Map()

  for (const grp of merged) {
    if (schoolMap.size >= limit) break

    const key = grp.schoolName
    let school = schoolMap.get(key)
    if (!school) {
      school = {
        school: grp.schoolName,
        code: grp.schoolCode,
        province: grp.province,
        nature: grp.planType,
        groups: [],
      }
      schoolMap.set(key, school)
    }

    const group = {
      name: grp.groupName,
      code: grp.groupCode,
      sr: grp.sr ? grp.sr.split('*').join('+') : '不限',
      srDisplay: srDisplay(grp.sr),
      batch: grp.batch,
      fee: grp.fee,
      remark: grp.remark,
      majorCode: grp.majorCode,
      history: {},
    }

    for (const [yr, h] of Object.entries(grp.history)) {
      group.history[yr] = { score: h.score, rank: h.rank, count: h.count }
    }

    school.groups.push(group)
  }

  return Array.from(schoolMap.values())
}

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp()
    process.exit(0)
  }

  const params = {
    score: null,
    rank: null,
    sr: null,
    province: [],
    batch: [],
    keyword: [],
    year: null,
    limit: DEFAULT_LIMIT,
    estimateRank: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = () => args[++i]

    switch (arg) {
      case '--score':
        params.score = parseInt(next())
        if (isNaN(params.score)) { die('--score 需要数字') }
        break
      case '--rank':
        params.rank = parseInt(next())
        if (isNaN(params.rank)) { die('--rank 需要数字') }
        break
      case '--sr':
        params.sr = next()
        if (!params.sr) { die('--sr 需要值') }
        break
      case '--province':
        params.province.push(next())
        break
      case '--batch':
        params.batch.push(next())
        break
      case '--keyword':
        params.keyword.push(next())
        break
      case '--year':
        params.year = next()
        if (!['2024', '2025', '2026'].includes(params.year)) {
          die('--year 只能为 2024|2025|2026')
        }
        break
      case '--limit':
        params.limit = parseInt(next())
        if (isNaN(params.limit) || params.limit < 1) { die('--limit 需要正整数') }
        break
      case '--estimate-rank':
        params.estimateRank = true
        break
      default:
        die(`未知参数: ${arg}\n使用 --help 查看帮助`)
    }
  }

  return params
}

function printHelp() {
  console.log(`
高考录取数据查询脚本
=====================
读取 alldata.js 并按条件过滤，输出 JSON 格式结果。

用法:
  node docs/query.js [选项]

查询选项:
  --score <n>        考生分数 (匹配 ±10 分)
  --rank <n>         考生排名 (匹配 ±30%)
  --sr <str>         选科要求，如: 物化生 / 物理+化学 / 04*05*06
  --province <name>  学校所在省份 (可重复指定多个)
  --batch <name>     批次 (可重复指定多个)
  --keyword <str>    专业组关键词 (可重复, 多关键词 OR 匹配)
  --year <str>       指定年份 2024|2025|2026
  --limit <n>        返回院校数上限 (默认 200)

排名估算模式:
  node docs/query.js --estimate-rank --score 620 --year 2025 --sr 物化生

其他:
  -h, --help         显示本帮助

示例:
  node docs/query.js --score 620 --sr 物化生 --province 广东 --keyword 计算机
  node docs/query.js --rank 8000 --province 北京 --province 上海
  node docs/query.js --score 620 --rank 8000 --year 2025 --limit 30
  node docs/query.js --estimate-rank --score 650 --year 2024
`)
}

function die(msg) {
  console.error(`错误: ${msg}`)
  process.exit(1)
}

// ============================================================
// 主函数
// ============================================================

function main() {
  const params = parseArgs()

  // 加载数据
  let raw
  try {
    raw = loadRaw()
  } catch (e) {
    console.error(`错误: ${e.message}`)
    process.exit(1)
  }

  // 展开
  const expanded = expandAll(raw)

  // 排名估算模式 → 直接输出
  if (params.estimateRank) {
    const result = estimateRank(expanded, params)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  // 标准查询模式：合并 → 过滤 → 格式化输出
  const merged = buildMerged(expanded)
  const filtered = filterMerged(merged, params)
  const records = formatRecords(filtered, params.limit)

  const output = {
    params: {
      score: params.score,
      rank: params.rank,
      sr: params.sr,
      province: params.province.length ? params.province : undefined,
      batch: params.batch.length ? params.batch : undefined,
      keyword: params.keyword.length ? params.keyword : undefined,
      year: params.year,
    },
    total: filtered.length,
    records,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main()
