#!/usr/bin/env node
'use strict'

/**
 * 高考录取数据构建脚本 (docs/build-data.js)
 * ───────────────────────────────────────────────
 * 读取 alldata.js → 合并各年数据 → 输出 schools.json
 *
 * 用法: node docs/build-data.js
 * 输出: skills/jx-college-pilot/schools.json
 */

const fs = require('fs')
const path = require('path')

// ===== 常量 =====
const SR_RMAP = ['04*05', '04', '04*06', '04*05*06']
const SR_MAP = { '04': '物理', '05': '化学', '06': '生物' }
const YEAR_MAP = ['2024', '2025', '2026']
const DATA_FILE = path.join(__dirname, '..', 'alldata.js')
const OUT_FILE = path.join(__dirname, '..', 'skills', 'jx-college-pilot', 'schools.json')

// ===== 数据加载与展开 =====

function loadRaw() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`错误: 找不到数据文件 ${DATA_FILE}`)
    process.exit(1)
  }
  const text = fs.readFileSync(DATA_FILE, 'utf-8')
  const json = text.replace(/^window\.ALL_DATA_RAW\s*=\s*/, '').replace(/;?\s*$/, '')
  return JSON.parse(json)
}

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
        srDisplay: r.sr ? r.sr.split('*').map(s => SR_MAP[s] || s).join(' ') : '不限',
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

    if (!grp.history[r.year]) {
      grp.history[r.year] = { score: r.score, rank: r.rank, count: r.count }
    }

    if (r.year === '2026') {
      grp.groupCode = r.groupCode
      grp.batch = r.batch
      grp.planType = r.planType
      grp.fee = r.fee
      grp.majorCode = r.majorCode
    }
  }

  // 按院校分组
  const schoolMap = new Map()
  for (const grp of groups.values()) {
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
    school.groups.push({
      name: grp.groupName,
      code: grp.groupCode,
      sr: grp.sr || '',
      srDisplay: grp.srDisplay,
      batch: grp.batch,
      fee: grp.fee,
      remark: grp.remark,
      majorCode: grp.majorCode,
      history: grp.history,
    })
  }

  // 按院校名称排序
  return Array.from(schoolMap.values()).sort((a, b) => a.school.localeCompare(b.school, 'zh'))
}

// ===== 统计 =====

function stats(schools) {
  let totalGroups = 0
  let totalHistory = 0
  for (const s of schools) {
    totalGroups += s.groups.length
    for (const g of s.groups) {
      totalHistory += Object.keys(g.history).length
    }
  }
  return { schools: schools.length, groups: totalGroups, records: totalHistory }
}

// ===== 主流程 =====

function main() {
  console.log('正在加载数据...')
  const raw = loadRaw()
  console.log('正在展开记录...')
  const expanded = expandAll(raw)
  console.log(`共 ${expanded.length} 条记录`)
  console.log('正在合并数据...')
  const schools = buildMerged(expanded)
  const s = stats(schools)
  console.log(`合并完成: ${s.schools} 所院校, ${s.groups} 个专业组, ${s.records} 条历史记录`)

  const output = {
    version: '1.0',
    builtAt: new Date().toISOString().slice(0, 10),
    stats: s,
    schools,
  }

  const json = JSON.stringify(output)
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, json, 'utf-8')
  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1)
  console.log(`写入完成: ${OUT_FILE} (${sizeMB}MB)`)
}

main()
