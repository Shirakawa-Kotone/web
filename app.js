/* ============================================================
   App: 高考录取数据查询 - Web版
   移植自微信小程序，适配移动端浏览器 + GitHub Pages
   ============================================================ */

// ============================================================
// 常量
// ============================================================
const SR_RMAP = ['04*05', '04', '04*06', '04*05*06']
const SR_MAP = { '04': '物理', '05': '化学', '06': '生物' }

const PROVINCES_ALL = [
  '安徽', '北京', '重庆', '福建', '甘肃', '广东', '广西', '贵州',
  '海南', '河北', '河南', '黑龙江', '湖北', '湖南', '吉林', '江苏', '江西',
  '辽宁', '内蒙古', '宁夏', '青海', '山东', '山西', '陕西', '上海', '四川',
  '天津', '西藏', '香港', '新疆', '云南', '浙江'
]

const SR_LIST = ['不限', '物理', '物理+化学', '物理+生物', '物理+化学+生物']
const SR_CODES = ['', '04', '04*05', '04*06', '04*05*06']
let BATCH_ALL = []  // 动态填充：从展开数据中提取的唯一批次列表
const PAGE_SIZE = 30
const SEARCH_DEBOUNCE = 200

const MOON_SVG = '<svg viewBox="0 0 24 24" width="1.2em" height="1.2em"><path fill="currentColor" d="M7.5 2c-1.79 1.15-3 3.18-3 5.5s1.21 4.35 3.03 5.5C4.46 13 2 10.54 2 7.5A5.5 5.5 0 0 1 7.5 2m11.57 1.5l1.43 1.43L4.93 20.5L3.5 19.07zm-6.18 2.43L11.41 5L9.97 6l.42-1.7L9 3.24l1.75-.12l.58-1.65L12 3.1l1.73.03l-1.35 1.13zm-3.3 3.61l-1.16-.73l-1.12.78l.34-1.32l-1.09-.83l1.36-.09l.45-1.29l.51 1.27l1.36.03l-1.05.87zM19 13.5a5.5 5.5 0 0 1-5.5 5.5c-1.22 0-2.35-.4-3.26-1.07l7.69-7.69c.67.91 1.07 2.04 1.07 3.26m-4.4 6.58l2.77-1.15l-.24 3.35zm4.33-2.7l1.15-2.77l2.2 2.54zm1.15-4.96l-1.14-2.78l3.34.24zM9.63 18.93l2.77 1.15l-2.53 2.19z"></path></svg>'

// ============================================================
// 志愿填报辅助 — 地区定义
// ============================================================
const REGIONS = {
  '全部省份': null,
  '东部沿海': ['辽宁','河北','天津','山东','江苏','上海','浙江','福建','广东'],
  '长三角': ['上海','江苏','浙江'],
  '珠三角': ['广东'],
  '京津冀': ['北京','天津','河北'],
  '江浙沪': ['江苏','浙江','上海'],
  '北上广': ['北京','上海','广东'],
  '长江以南': ['上海','江苏','浙江','安徽','福建','江西','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏'],
  '长江以北': ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','山东','河南','陕西','甘肃','青海','宁夏','新疆'],
  '华中': ['河南','湖北','湖南'],
  '东北': ['辽宁','吉林','黑龙江'],
  '西北': ['陕西','甘肃','青海','宁夏','新疆'],
  '西南': ['重庆','四川','贵州','云南','西藏'],
  '本省': ['江西'],
  '除了本省': ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港'],
}
const REGION_NAMES = Object.keys(REGIONS)

// 辅助面板选科选项（3+1+2 实际组合）
const AS_SR_LIST = ['物化生', '物化政', '物化地', '物政生', '物政地', '物生地']
const AS_SR_CODES = ['04*05*06', '04*05', '04*05', '04*06', '04', '04*06']

// ============================================================
// 应用状态
// ============================================================
const state = {
  // Data
  allData: [],          // 全量展开数据
  allData2024: [],
  allData2025: [],
  allData2026: [],
  mergedCache: null,    // 合并缓存（全部模式）
  searchCache: [],      // 搜索结果缓存
  searchIsGrouped: false,

  // Filters
  year: '',
  selectedProvinces: [],
  provinceLabel: '全部省份',
  selectedBatches: [],
  batchLabel: '全部批次',
  code: '',
  name: '',
  srIdx: 0,
  groupName: '',
  groupCode: '',
  minScore: '',
  maxRank: '',
  only2026: false,
  hideSports: false,
  hideCoop: false,
  darkMode: false,

  // UI
  loaded: false,
  filterHidden: false,
  displayList: [],
  page: 0,
  totalCount: 0,
  hasMore: false,
  loadTime: 0,
  remarkExpanded: {},

  // Province picker temp state
  tempSelectedProvinces: [],
  tempChecked: [],

  // Batch picker temp state
  tempSelectedBatches: [],
  tempBatchChecked: [],

  // Tutorial
  tutorialMode: 'merged',
  tutorialStep: 0,
  tutorialSteps: [],
  tutorialDemo: null,
  tutorialRemarkExpanded: false,
}

// DOM references (set once on init)
let DOM = {}

// ============================================================
// 数据加载 & 展开（分块处理，支持进度更新）
// ============================================================
function expandAllData(callback) {
  if (!window.ALL_DATA_RAW) {
    updateProgress(100, '数据文件未加载，请刷新重试')
    if (callback) callback(false)
    return
  }

  updateProgress(25, '正在展开2024年数据...')

  const raw = window.ALL_DATA_RAW
  const { a: provincePool, b: schoolNamePool, c: groupNamePool, d: records, e: extra } = raw
  const { b: batchPool, p: planPool, g: gcPool, f: feePool, r: remarkPool, sl: schoolLinkPool } = extra
  const out = new Array(records.length)
  const yearMap = ['2024', '2025', '2026']
  const TOTAL = records.length

  // 按年份分三段处理：2024(0-22472), 2025(22472-47184), 2026(47184-74163)
  const yearRanges = [
    { start: 0, end: 22471, label: '2024', pct: 35 },
    { start: 22472, end: 47183, label: '2025', pct: 45 },
    { start: 47184, end: TOTAL - 1, label: '2026', pct: 55 },
  ]

  let rangeIdx = 0

  function processRange() {
    if (rangeIdx >= yearRanges.length) {
      // 全部展开完成
      state.allData = out
      updateProgress(62, '数据展开完成，正在构建索引...')

      setTimeout(() => {
        updateProgress(68, '正在按年份拆分数据...')
        // 这里数据已经就绪，但 splitByYear 被延迟到用户点击年份时触发
        // 直接继续构建缓存
        setTimeout(() => {
          if (callback) callback(true)
        }, 50)
      }, 50)
      return
    }

    const range = yearRanges[rangeIdx]
    updateProgress(range.pct, '正在展开' + range.label + '年数据...')

    // 每次处理约 1/3 的数据（约 2.2~2.7万条），分多步执行避免长时间阻塞
    const CHUNK_SIZE = 5000
    let pos = range.start
    const end = range.end

    function processChunk() {
      const chunkEnd = Math.min(pos + CHUNK_SIZE, end + 1)
      for (let i = pos; i < chunkEnd; i++) {
        const r = records[i]
        const srCode = SR_RMAP[r[4]] || ''
        out[i] = [
          yearMap[r[0]] || '2024',
          provincePool[r[1]] || '',
          String(r[2] || ''),
          schoolNamePool[r[3]] || '',
          srCode,
          groupNamePool[r[5]] || '',
          r[6], r[7], r[8],
          batchPool[r[9]] || '',
          planPool[r[10]] || '',
          gcPool[r[11]] || '',
          feePool[r[12]] || '',
          remarkPool[r[13]] || '',
          srCode ? srCode.split('*').map(s => SR_MAP[s] || s).join(' ') : '不限',
          r[14] !== undefined ? gcPool[r[14]] || '' : '',
          schoolLinkPool ? schoolLinkPool[r[3]] || '' : '',
        ]
      }
      pos = chunkEnd

      if (pos <= end) {
        // 同一范围内继续分块
        const pctInRange = range.pct + Math.floor((pos - range.start) / (end - range.start + 1) * 8)
        updateProgress(pctInRange, '正在展开' + range.label + '年数据... (' + (pos - range.start + 1) + '条)')
        setTimeout(processChunk, 16)
      } else {
        // 当前年份完成，进入下一年份
        rangeIdx++
        setTimeout(processRange, 16)
      }
    }

    processChunk()
  }

  // 从 DOM 初始化回调开始
  processRange()
}

// ============================================================
// 进度条更新
// ============================================================
function updateProgress(pct, stage) {
  const el = document.getElementById('progress-fill')
  const pctEl = document.getElementById('load-pct')
  const stageEl = document.getElementById('load-stage')
  if (el) el.style.width = pct + '%'
  if (pctEl) pctEl.textContent = pct + '%'
  if (stageEl) stageEl.textContent = stage || ''
}

// ============================================================
// 合并缓存（全部模式）
// ============================================================
function buildMergedCache() {
  if (state.mergedCache) return
  const groups = new Map()
  const data = state.allData
  for (let i = 0; i < data.length; i++) {
    const r = data[i]
    const key = r[3] + '\x00' + r[5]
    let grp = groups.get(key)
    if (!grp) {
      grp = {
        p: r[1], c: r[2], n: r[3], s: r[4], g: r[5],
        a: null, b: null, d: null,
        batch: r[9], plan: r[10], gc: r[11], fee: r[12],
        remark: r[13], _sd: r[14],
        _vr: {},
        _diffs: null,
      }
      groups.set(key, grp)
    }
    const yr = r[0]
    if (!grp._vr[yr]) grp._vr[yr] = {}
    grp._vr[yr].gc = r[11]
    grp._vr[yr].batch = r[9]
    grp._vr[yr].plan = r[10]
    grp._vr[yr].fee = r[12]

    if (yr === '2024') {
      if (!grp.a) grp.a = { s: r[6], r: r[7], e: r[8] }
    } else if (yr === '2025') {
      if (!grp.b) grp.b = { s: r[6], r: r[7], e: r[8] }
    } else {
      if (!grp.d) grp.d = { s: r[6], r: r[7], e: r[8], code: r[15], link: r[16] || '' }
      grp.c = r[2]; grp.gc = r[11]; grp.batch = r[9]
      grp.plan = r[10]; grp.fee = r[12]
    }
  }
  state.mergedCache = Array.from(groups.values())
}

function buildBatchList() {
  const set = new Set()
  for (let i = 0; i < state.allData.length; i++) {
    const v = state.allData[i][9]
    if (v) set.add(v)
  }
  BATCH_ALL = Array.from(set).sort()
}

// ============================================================
// 工具函数
// ============================================================
function parseSR(sr) {
  if (!sr) return ['不限']
  return sr.split('*').map(s => SR_MAP[s] || s)
}

function getProvinceLabel(arr) {
  if (!arr || !arr.length) return '全部省份'
  if (arr.length <= 2) return arr.join('、')
  return arr.slice(0, 2).join('、') + ' 等' + arr.length + '个省份'
}

function getBatchLabel(arr) {
  if (!arr || !arr.length) return '全部批次'
  if (arr.length <= 2) return arr.join('、')
  return arr.slice(0, 2).join('、') + ' 等' + arr.length + '个批次'
}

function computeDiffs(g, vr) {
  const yrs = []
  if (g.a) yrs.push('2024')
  if (g.b) yrs.push('2025')
  if (g.d) yrs.push('2026')
  if (yrs.length < 2) return null
  const diffs = []
  const fields = [
    { key: 'gc', label: '专业组代码' },
    { key: 'batch', label: '批次' },
    { key: 'plan', label: '性质' },
    { key: 'fee', label: '收费标准' },
  ]
  for (const f of fields) {
    const vals = {}
    for (const y of yrs) {
      const yr = vr[y]
      if (!yr) continue
      const v = yr[f.key]
      if (v === undefined || v === null) continue
      if (!vals[v]) vals[v] = []
      vals[v].push(y)
    }
    if (Object.keys(vals).length > 1) {
      const entries = Object.entries(vals).map(([v, ys]) => ({
        years: ys.join('、') + '年',
        value: String(v),
      }))
      diffs.push({ field: f.label, entries })
    }
  }
  return diffs.length ? diffs : null
}

// ============================================================
// 核心搜索
// ============================================================
function doSearch() {
  if (!state.loaded) return

  // 若处于志愿推荐模式，退出并执行常规搜索
  if (DOM.assistantResults.style.display !== 'none') {
    exitAssistant()
  }

  const t0 = Date.now()

  const { year, selectedProvinces, selectedBatches, code, name, srIdx, groupName, groupCode, minScore, maxRank, only2026, hideSports, hideCoop } = state
  const sr = srIdx > 0 ? SR_CODES[srIdx] : ''
  const ms = parseInt(minScore) || 0
  const mr = parseInt(maxRank) || 0

  // 输入校验：最低分和最低排名不能为负数或非数字
  const rawMinScore = String(minScore).trim()
  const rawMaxRank = String(maxRank).trim()
  const parsedMin = parseInt(rawMinScore)
  const parsedMax = parseInt(rawMaxRank)
  const minInvalid = rawMinScore !== '' && (isNaN(parsedMin) || parsedMin < 0)
  const maxInvalid = rawMaxRank !== '' && (isNaN(parsedMax) || parsedMax < 0)
  if (minInvalid || maxInvalid) {
    state.searchCache = []
    state.displayList = []
    state.page = 0
    state.totalCount = 0
    state.hasMore = false
    state.loadTime = 0
    DOM.resultCards.innerHTML = ''
    DOM.totalCount.textContent = '0'
    DOM.loadTime.textContent = ''
    DOM.loadingMore.style.display = 'none'
    DOM.emptyMsg.style.display = 'block'
    DOM.emptyMsg.textContent = '请检查输入内容'
    return
  }
  const provinceSet = selectedProvinces.length ? new Set(selectedProvinces) : null
  const codeStr = String(code).trim()
  const nameStr = String(name).trim()
  const groupStr = String(groupName).trim()
  const groupCodeStr = String(groupCode).trim()

  if (!year) {
    // 全部模式
    if (!state.mergedCache) return
    const results = []

    for (let i = 0; i < state.mergedCache.length; i++) {
      const g = state.mergedCache[i]
      if (provinceSet && !provinceSet.has(g.p)) continue
      if (codeStr && String(g.c).indexOf(codeStr) === -1) continue
      if (nameStr && g.n.indexOf(nameStr) === -1) continue
      if (sr && g.s !== sr) continue
      if (groupStr && g.g.indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(g.gc).indexOf(groupCodeStr) === -1) continue
      if (hideSports && (g.g.indexOf('体育') !== -1 || g.n.indexOf('体育') !== -1)) continue
      if (hideCoop && (g.g.indexOf('中外合作') !== -1 || (g.remark && g.remark.indexOf('中外合作') !== -1))) continue
      if (only2026 && !g.d) continue
      if (selectedBatches.length && selectedBatches.indexOf(g.batch) === -1) continue

      let needClone = false
      if (ms || mr) {
        let anyPass = false
        if (g.a) {
          const pass = (!ms || Number(g.a.s) >= ms) && (!mr || Number(g.a.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        if (g.b) {
          const pass = (!ms || Number(g.b.s) >= ms) && (!mr || Number(g.b.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        // 仅2026招生模式下，2026年为计划招生数据可能无有效分数排名，不纳入筛选
        if (g.d && !only2026) {
          const pass = (!ms || Number(g.d.s) >= ms) && (!mr || Number(g.d.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        if (!anyPass) continue
      }

      if (needClone) {
        const c = { ...g, _vr: g._vr, remarkExpanded: false }
        if (ms) {
          if (c.a && Number(c.a.s) < ms) c.a = null
          if (c.b && Number(c.b.s) < ms) c.b = null
          // 仅2026招生模式下保留2026数据行，不因分数排名过滤而清除
          if (c.d && Number(c.d.s) < ms && !only2026) c.d = null
        }
        if (mr) {
          if (c.a && Number(c.a.r) > mr) c.a = null
          if (c.b && Number(c.b.r) > mr) c.b = null
          if (c.d && Number(c.d.r) > mr && !only2026) c.d = null
        }
        c._diffs = computeDiffs(c, c._vr)
        results.push(c)
      } else {
        results.push(g)
      }
    }

    results.sort((a, b) => {
      const hasScoreA = !!(a.a || a.b)
      const hasScoreB = !!(b.a || b.b)
      if (hasScoreA && !hasScoreB) return -1
      if (!hasScoreA && hasScoreB) return 1
      const sa = Number((a.b || a.a || a.d || {}).s || 0)
      const sb = Number((b.b || b.a || b.d || {}).s || 0)
      return (ms || mr) ? sa - sb : sb - sa
    })

    state.searchCache = results
    state.searchIsGrouped = true
    state.page = 0
    state.displayList = []
    state.totalCount = results.length
    state.hasMore = results.length > PAGE_SIZE
    state.loadTime = Date.now() - t0
    state.remarkExpanded = {}
  } else {
    // 单年份模式
    const data = year === '2024' ? state.allData2024 : year === '2025' ? state.allData2025 : state.allData2026
    const result = []
    for (let i = 0, len = data.length; i < len; i++) {
      const r = data[i]
      if (ms && r[6] < ms) continue
      if (mr && r[7] > mr) continue
      if (provinceSet && !provinceSet.has(r[1])) continue
      if (sr && r[4] !== sr) continue
      if (codeStr && r[2].indexOf(codeStr) === -1) continue
      if (nameStr && r[3].indexOf(nameStr) === -1) continue
      if (groupStr && r[5].indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(r[11]).indexOf(groupCodeStr) === -1) continue
      if (only2026 && r[0] !== '2026') continue
      if (selectedBatches.length && selectedBatches.indexOf(r[9]) === -1) continue
      if (hideSports && (r[5].indexOf('体育') !== -1 || r[3].indexOf('体育') !== -1)) continue
      if (hideCoop && (r[5].indexOf('中外合作') !== -1 || r[13].indexOf('中外合作') !== -1)) continue
      result.push(r)
    }
    if (ms || mr) {
      result.sort((a, b) => a[6] - b[6])
    } else {
      result.sort((a, b) => b[6] - a[6])
    }
    state.searchCache = result
    state.searchIsGrouped = false
    state.page = 0
    state.displayList = []
    state.totalCount = result.length
    state.hasMore = result.length > PAGE_SIZE
    state.loadTime = Date.now() - t0
    state.remarkExpanded = {}
  }
  renderResults()
}

// ============================================================
// 分页加载
// ============================================================
function loadMore() {
  const start = state.page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, state.searchCache.length)
  const chunk = state.searchCache.slice(start, end)
  if (!chunk.length) {
    state.hasMore = false
    renderMore()
    return
  }
  if (state.searchIsGrouped) {
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]
      if (item._diffs === null && item._vr) {
        item._diffs = computeDiffs(item, item._vr)
      }
    }
  }
  state.displayList = state.displayList.concat(chunk)
  state.page++
  state.hasMore = end < state.searchCache.length
  renderMore()
}

// ============================================================
// 渲染：结果列表
// ============================================================
function renderResults() {
  loadMore() // 从 page 0 开始加载
  DOM.totalCount.textContent = state.totalCount
  DOM.loadTime.textContent = state.loadTime ? '(' + state.loadTime + 'ms)' : ''
  DOM.emptyMsg.textContent = '无匹配结果'

  if (state.totalCount === 0) {
    DOM.emptyMsg.style.display = 'block'
  } else {
    DOM.emptyMsg.style.display = 'none'
  }
}

function renderMore() {
  const container = DOM.resultCards
  const fragment = document.createDocumentFragment()

  for (let i = 0; i < state.displayList.length; i++) {
    const item = state.displayList[i]
    const card = state.searchIsGrouped ? renderCardGrouped(item, i) : renderCardSingle(item, i)
    fragment.appendChild(card)
  }

  container.innerHTML = ''
  container.appendChild(fragment)

  DOM.totalCount.textContent = state.totalCount
  DOM.loadingMore.style.display = state.hasMore ? 'block' : 'none'
  DOM.emptyMsg.style.display = state.totalCount === 0 ? 'block' : 'none'
}

function renderCardGrouped(item, idx) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  // Header
  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-name">' + escHtml(item.n) + '</span>' +
    '<span class="card-code">' + escHtml(item.c) + '</span>' +
    (item.d && !item.a && !item.b ? '<span class="tag-new">新</span>' : '')
  card.appendChild(header)

  // Body
  const body = document.createElement('div')
  body.className = 'card-body'

  // Province
  body.appendChild(makeRow('省份', item.p))
  // Batch
  if (item.batch) body.appendChild(makeRow('批次', item.batch, 'badge'))
  // Subject
  body.appendChild(makeRow('选科', item._sd, 'tag'))
  // Plan type
  if (item.plan) body.appendChild(makeRow('性质', item.plan))
  // Group name
  if (item.g) body.appendChild(makeRow('专业名称', item.g, 'full'))
  // Group code
  if (item.gc) body.appendChild(makeRow('专业组代码', item.gc))

  // 2024 row
  if (item.a) {
    body.appendChild(makeYearRow('2024',
      '<span class="card-value highlight">' + item.a.s + '分</span>' +
      '<span class="card-value highlight">最低排名 ' + item.a.r + '</span>' +
      '<span class="card-value">录取' + item.a.e + '人</span>'))
  }
  // 2025 row
  if (item.b) {
    body.appendChild(makeYearRow('2025',
      '<span class="card-value highlight">' + item.b.s + '分</span>' +
      '<span class="card-value highlight">最低排名 ' + item.b.r + '</span>' +
      '<span class="card-value">录取' + item.b.e + '人</span>'))
  }
  // 2026 row
  if (item.d) {
    body.appendChild(make2026Row(
      '<span class="card-value">专业代号 ' + escHtml(item.d.code) + '</span>' +
      '<span class="card-value">计划录取' + item.d.e + '人</span>'))
    // 招生简章链接
    if (item.d.link) {
      body.appendChild(makeLinkRow(item.d.link))
    }
  }

  // Remark
  if (item.remark) {
    const isOpen = state.remarkExpanded[idx]
    body.appendChild(makeRemarkToggle(idx, isOpen))
    if (isOpen) {
      body.appendChild(makeRemarkBody(item.remark))
    }
  }

  // Diffs
  if (item._diffs) {
    const diffSection = renderDiffs(item._diffs)
    if (diffSection) body.appendChild(diffSection)
  }

  card.appendChild(body)
  return card
}

function renderCardSingle(record, idx) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-year">' + escHtml(record[0]) + '</span>' +
    '<span class="card-name">' + escHtml(record[3]) + '</span>' +
    '<span class="card-code">' + escHtml(record[2]) + '</span>'
  card.appendChild(header)

  const body = document.createElement('div')
  body.className = 'card-body'

  body.appendChild(makeRow('省份', record[1]))
  if (record[9]) body.appendChild(makeRow('批次', record[9], 'badge'))
  body.appendChild(makeRow('选科', record[14], 'tag'))
  if (record[10]) body.appendChild(makeRow('性质', record[10]))
  if (record[5]) body.appendChild(makeRow('专业名称', record[5], 'full'))
  if (record[11]) body.appendChild(makeRow('专业组代码', record[11]))
  // 2026年记录显示专业代号
  if (record[0] === '2026' && record[15]) body.appendChild(makeRow('专业代号', record[15]))

  if (record[0] !== '2026') {
    body.appendChild(makeRow('最低分', String(record[6]), 'highlight'))
    body.appendChild(makeRow('最低排名', String(record[7]), 'highlight'))
    body.appendChild(makeRow('录取', record[8] + '人'))
  } else {
    body.appendChild(makeRow('计划录取', record[8] + '人', 'highlight'))
    // 招生简章链接
    if (record[16]) {
      body.appendChild(makeLinkRow(record[16]))
    }
  }
  if (record[12]) body.appendChild(makeRow('收费标准', record[12] + '元/年'))

  if (record[13]) {
    const isOpen = state.remarkExpanded[idx]
    body.appendChild(makeRemarkToggle(idx, isOpen))
    if (isOpen) {
      body.appendChild(makeRemarkBody(record[13]))
    }
  }

  card.appendChild(body)
  return card
}

// Helper: simple row
function makeRow(label, value, cls) {
  const row = document.createElement('div')
  row.className = 'card-row'
  row.innerHTML = '<span class="card-label">' + escHtml(label) + '</span>' +
    '<span class="card-value' + (cls ? ' ' + cls : '') + '">' + escHtml(value) + '</span>'
  return row
}

// Helper: year data row (grouped)
function makeYearRow(year, html) {
  const row = document.createElement('div')
  row.className = 'card-row'
  row.innerHTML = '<span class="gp-label">' + year + '</span>' + html
  return row
}

function make2026Row(html) {
  const row = document.createElement('div')
  row.className = 'card-row gp-year'
  row.innerHTML = '<span class="gp-label">2026</span>' + html
  return row
}

// Helper: link row (招生简章)
function makeLinkRow(url) {
  const row = document.createElement('div')
  row.className = 'card-row card-link-row'
  row.innerHTML = '<span class="card-label">招生简章</span>' +
    '<a class="card-link" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">查看招生章程 ↗</a>'
  return row
}

// Helper: remark toggle
function makeRemarkToggle(idx, isOpen) {
  const row = document.createElement('div')
  row.className = 'card-row card-remark-header'
  row.dataset.remarkIdx = idx
  row.innerHTML = '<span class="card-label">备注</span>' +
    '<span class="card-remark-toggle">' + (isOpen ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span>'
  row.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleRemark(parseInt(this.dataset.remarkIdx))
  })
  return row
}

function makeRemarkBody(text) {
  const row = document.createElement('div')
  row.className = 'card-row card-remark-body'
  row.innerHTML = '<span class="card-value full">' + escHtml(text) + '</span>'
  return row
}

// Diffs rendering
function renderDiffs(diffs) {
  if (!diffs || !diffs.length) return null
  const section = document.createElement('div')
  section.className = 'diff-section'
  for (const diff of diffs) {
    const group = document.createElement('div')
    group.className = 'diff-group'
    const label = diff.field === '专业组代码' ? '专业组代码变动' : diff.field + '差异'
    group.innerHTML = '<span class="diff-field">' + label + '</span>'
    for (const entry of diff.entries) {
      const e = document.createElement('div')
      e.className = 'diff-entry'
      e.innerHTML = '<span class="diff-years">' + escHtml(entry.years) + '</span>' +
        '<span class="diff-arrow">→</span>' +
        '<span class="diff-val">' + escHtml(entry.value) + '</span>'
      group.appendChild(e)
    }
    section.appendChild(group)
  }
  return section
}

// ============================================================
// 事件处理：状态变更 → 重新搜索
// ============================================================

function onYearChange(year) {
  if (year === '2026') {
    state.minScore = ''
    state.maxRank = ''
    DOM.inputMinScore.value = ''
    DOM.inputMaxRank.value = ''
  }
  state.year = year
  updateFilterUI()
  if (year) splitByYear()
  doSearch()
}

function splitByYear() {
  if (state.allData2024.length) return
  state.allData2024 = state.allData.filter(r => r[0] === '2024')
  state.allData2025 = state.allData.filter(r => r[0] === '2025')
  state.allData2026 = state.allData.filter(r => r[0] === '2026')
}

function toggleRemark(idx) {
  state.remarkExpanded[idx] = !state.remarkExpanded[idx]
  renderMore()
}

function onToggleOnly2026() {
  state.only2026 = !state.only2026
  updateFilterUI()
  doSearch()
}

function onToggleHideSports() {
  state.hideSports = !state.hideSports
  updateFilterUI()
  doSearch()
}

function onToggleHideCoop() {
  state.hideCoop = !state.hideCoop
  updateFilterUI()
  doSearch()
}

function onToggleDarkMode() {
  state.darkMode = !state.darkMode
  document.documentElement.classList.toggle('dark-mode', state.darkMode)
  try { localStorage.setItem('dark_mode', String(state.darkMode)) } catch (e) {}
}

function doReset() {
  state.year = ''
  state.selectedProvinces = []
  state.provinceLabel = '全部省份'
  state.selectedBatches = []
  state.batchLabel = '全部批次'
  state.code = ''
  state.name = ''
  state.srIdx = 0
  state.groupName = ''
  state.groupCode = ''
  state.minScore = ''
  state.maxRank = ''
  state.only2026 = false
  state.hideSports = false
  state.hideCoop = false
  syncInputsFromState()
  updateFilterUI()
  doSearch()
}

function scrollToTop() {
  if (_mobileAssistantActive) {
    // 志愿推荐模式 → 滚动活跃列到顶部
    const activeBody = DOM.asColumns.querySelector('.as-column.active .as-column-body')
    if (activeBody) {
      activeBody.scrollTop = 0
    } else {
      DOM.asColumns.scrollTop = 0
    }
  } else {
    // 正常搜索模式
    state.filterHidden = false
    updateFilterUI()
    DOM.resultList.scrollTop = 0
    DOM.resultList.querySelector('#result-top').scrollIntoView()
  }
}

// ============================================================
// 省市多选弹窗
// ============================================================
function openProvincePicker() {
  state.tempSelectedProvinces = [...state.selectedProvinces]
  state.tempChecked = PROVINCES_ALL.map(p => state.selectedProvinces.indexOf(p) !== -1)
  renderProvincePicker()
  DOM.provinceModal.style.display = 'flex'
}

function closeProvincePicker() {
  DOM.provinceModal.style.display = 'none'
}

function toggleProvince(idx) {
  const item = PROVINCES_ALL[idx]
  if (state.tempChecked[idx]) {
    const i = state.tempSelectedProvinces.indexOf(item)
    if (i !== -1) state.tempSelectedProvinces.splice(i, 1)
  } else {
    state.tempSelectedProvinces.push(item)
  }
  state.tempChecked[idx] = !state.tempChecked[idx]
  renderProvincePicker()
}

function selectAllProvinces() {
  state.tempSelectedProvinces = [...PROVINCES_ALL]
  state.tempChecked = PROVINCES_ALL.map(() => true)
  renderProvincePicker()
}

function clearProvinces() {
  state.tempSelectedProvinces = []
  state.tempChecked = PROVINCES_ALL.map(() => false)
  renderProvincePicker()
}

function confirmProvincePicker() {
  state.selectedProvinces = [...state.tempSelectedProvinces]
  state.provinceLabel = getProvinceLabel(state.selectedProvinces)
  DOM.provinceModal.style.display = 'none'
  DOM.provinceLabel.textContent = state.provinceLabel
  DOM.provinceLabel.className = state.selectedProvinces.length ? '' : 'placeholder-text'
  doSearch()
}

function renderProvincePicker() {
  const list = DOM.provinceList
  list.innerHTML = ''
  for (let i = 0; i < PROVINCES_ALL.length; i++) {
    const item = document.createElement('div')
    item.className = 'modal-item'
    item.dataset.idx = i
    item.innerHTML = '<div class="check-box' + (state.tempChecked[i] ? ' checked' : '') + '">' +
      (state.tempChecked[i] ? '<span class="check-mark">✓</span>' : '') +
      '</div><span class="modal-item-text">' + PROVINCES_ALL[i] + '</span>'
    item.addEventListener('click', function () {
      toggleProvince(parseInt(this.dataset.idx))
    })
    list.appendChild(item)
  }
}

// ============================================================
// 批次多选弹窗
// ============================================================
function openBatchPicker() {
  state.tempSelectedBatches = [...state.selectedBatches]
  state.tempBatchChecked = BATCH_ALL.map(b => state.selectedBatches.indexOf(b) !== -1)
  renderBatchPicker()
  DOM.batchModal.style.display = 'flex'
}

function closeBatchPicker() {
  DOM.batchModal.style.display = 'none'
}

function toggleBatch(idx) {
  const item = BATCH_ALL[idx]
  if (state.tempBatchChecked[idx]) {
    const i = state.tempSelectedBatches.indexOf(item)
    if (i !== -1) state.tempSelectedBatches.splice(i, 1)
  } else {
    state.tempSelectedBatches.push(item)
  }
  state.tempBatchChecked[idx] = !state.tempBatchChecked[idx]
  renderBatchPicker()
}

function selectAllBatches() {
  state.tempSelectedBatches = [...BATCH_ALL]
  state.tempBatchChecked = BATCH_ALL.map(() => true)
  renderBatchPicker()
}

function clearBatches() {
  state.tempSelectedBatches = []
  state.tempBatchChecked = BATCH_ALL.map(() => false)
  renderBatchPicker()
}

function confirmBatchPicker() {
  state.selectedBatches = [...state.tempSelectedBatches]
  state.batchLabel = getBatchLabel(state.selectedBatches)
  DOM.batchModal.style.display = 'none'
  DOM.batchLabel.textContent = state.batchLabel
  DOM.batchLabel.className = state.selectedBatches.length ? '' : 'placeholder-text'
  doSearch()
}

function renderBatchPicker() {
  const list = DOM.batchList
  list.innerHTML = ''
  for (let i = 0; i < BATCH_ALL.length; i++) {
    const item = document.createElement('div')
    item.className = 'modal-item'
    item.dataset.idx = i
    item.innerHTML = '<div class="check-box' + (state.tempBatchChecked[i] ? ' checked' : '') + '">' +
      (state.tempBatchChecked[i] ? '<span class="check-mark">✓</span>' : '') +
      '</div><span class="modal-item-text">' + BATCH_ALL[i] + '</span>'
    item.addEventListener('click', function () {
      toggleBatch(parseInt(this.dataset.idx))
    })
    list.appendChild(item)
  }
}

// ============================================================
// 选科选择弹窗
// ============================================================
function openSRPicker() {
  renderSRList()
  DOM.srModal.style.display = 'flex'
}

function closeSRPicker() {
  DOM.srModal.style.display = 'none'
}

function confirmSR() {
  DOM.srModal.style.display = 'none'
  DOM.srLabel.textContent = SR_LIST[state.srIdx]
  DOM.srLabel.className = state.srIdx === 0 ? 'placeholder-text' : ''
  doSearch()
}

function renderSRList() {
  const list = DOM.srList
  list.innerHTML = ''
  for (let i = 0; i < SR_LIST.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (state.srIdx === i ? ' selected' : '')
    item.textContent = SR_LIST[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      state.srIdx = parseInt(this.dataset.idx)
      renderSRList()
    })
    list.appendChild(item)
  }
}

// ============================================================
// UI 状态同步
// ============================================================
function updateFilterUI() {
  // Year tabs
  const tabs = DOM.yearTabs.querySelectorAll('.tab')
  tabs.forEach(t => t.classList.toggle('active', t.dataset.year === state.year))

  // Province label
  DOM.provinceLabel.textContent = state.provinceLabel
  DOM.provinceLabel.className = state.selectedProvinces.length ? '' : 'placeholder-text'

  // SR label
  DOM.srLabel.textContent = SR_LIST[state.srIdx]
  DOM.srLabel.className = state.srIdx === 0 ? 'placeholder-text' : ''

  // Batch label
  DOM.batchLabel.textContent = state.batchLabel
  DOM.batchLabel.className = state.selectedBatches.length ? '' : 'placeholder-text'

  // Toggle switches
  updateToggleUI('toggle-only2026', state.only2026)
  updateToggleUI('toggle-hide-sports', state.hideSports)
  updateToggleUI('toggle-hide-coop', state.hideCoop)

  // Score/rank row visibility: 仅在选择2026单年份时隐藏
  // 在「全部」模式中即使勾选「仅2026招生」也保持可见，因为分组数据仍有2024/2025的分数排名
  DOM.scoreRow.style.display = state.year === '2026' ? 'none' : 'flex'
}

function updateToggleUI(id, isOn) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.toggle('on', isOn)
  el.querySelector('.toggle-box').classList.toggle('checked', isOn)
}

function syncInputsFromState() {
  DOM.inputCode.value = state.code
  DOM.inputName.value = state.name
  DOM.inputGroupName.value = state.groupName
  DOM.inputGroupCode.value = state.groupCode
  DOM.inputMinScore.value = state.minScore
  DOM.inputMaxRank.value = state.maxRank
}

function syncStateFromInputs() {
  state.code = DOM.inputCode.value
  state.name = DOM.inputName.value
  state.groupName = DOM.inputGroupName.value
  state.groupCode = DOM.inputGroupCode.value
  state.minScore = DOM.inputMinScore.value
  state.maxRank = DOM.inputMaxRank.value
}

function escHtml(str) {
  if (str === null || str === undefined) return ''
  const d = document.createElement('div')
  d.textContent = String(str)
  return d.innerHTML
}

// ============================================================
// 引导教程
// ============================================================
const TUTORIAL = {
  merged: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。在「全部」模式中显示的院校代号为2026年的编号，其他年份若不同可在下方差异对比中查看。' },
      { title: '「新」标签', desc: '标注有红色「新」字的专业组为2026年新增招生专业，暂无2024、2025年实际录取数据可供参考。选择此类专业时需结合其他信息综合评估录取难度。' },
      { title: '省市', desc: '院校所在的省份/直辖市，反映学校的地理位置和城市资源。' },
      { title: '批次', desc: '录取批次类型，如「本科」指普通本科批次、「提前本科」指提前批。不同批次录取时间、政策不同，需根据成绩定位选择合适的批次。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求，只有选科符合的考生才能报考。「不限选科」即所有考生均可报考。本示范要求「物理+化学」。' },
      { title: '性质', desc: '招生计划的性质。「非定向」为普通招生；「定向」面向特定地区/单位就业。' },
      { title: '专业名称', desc: '该专业组包含的具体招生专业。每个专业组可能包含一个或多个相关专业。' },
      { title: '专业组代码', desc: '院校将招生专业按选科要求等条件划分为不同专业组。同一院校不同专业组的录取分数可能差异很大。' },
      { title: '2024年录取数据', desc: '2024年该专业录取的最低高考分数（600分）、最低全省排名（10000名）和实际录取人数（35人）。分数和排名越高录取难度越大，建议优先参考排名。' },
      { title: '2025年录取数据', desc: '2025年录取数据（580分，15000名，38人）。可与2024年对比观察分数和排名的涨跌趋势。' },
      { title: '2026年计划数据', desc: '2026年该专业的计划招生名额（40人）。实际录取人数可能会有微调。2026年为志愿填报参考数据，非最终录取结果。' },
      { title: '备注', desc: '该专业的特殊说明，包括外语要求、性别限制、身体条件、政治面貌要求等。点击可展开查看完整内容。' },
      { title: '年份差异对比', desc: '当同一院校+专业在不同年份间存在差异时，卡片底部会展示对比信息。例如专业组代码变动、收费标准调整等。' },
    ],
    demo: {
      n: '赣江大学（仅供示范）', c: '8888', p: '江西',
      batch: '本科', plan: '非定向',
      s: '物理+化学', g: '人工智能', gc: '501',
      _sd: '物理 化学',
      a: { s: 600, r: 10000, e: 35 },
      b: { s: 580, r: 15000, e: 38 },
      d: { e: 40, code: 'A01' },
      remark: '本数据仅供示范用途，并非真实录取信息。',
      _newLabel: true,
      _diffs: [
        {
          field: '专业组代码',
          entries: [
            { years: '2024年、2025年', value: 'G01' },
            { years: '2026年', value: 'A01' },
          ],
        },
        {
          field: '收费标准',
          entries: [
            { years: '2024年、2025年', value: '5250' },
            { years: '2026年', value: '5800' },
          ],
        },
      ],
    },
  },
  single2025: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。' },
      { title: '省市', desc: '院校所在的省份/直辖市。可配合省份筛选快速定位特定地区的院校。' },
      { title: '批次', desc: '录取批次类型。不同批次录取时间、政策不同，需根据成绩定位选择。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求。本示范中为「物理」，即选考物理的考生方可报考。' },
      { title: '性质', desc: '招生计划的性质。非定向为普通招生，定向面向特定地区就业。' },
      { title: '专业名称', desc: '该专业组包含的专业名称。本示范为南昌大学「经济学」专业。' },
      { title: '专业组代码', desc: '该专业的组代码，用于标识不同的专业组。' },
      { title: '最低分', desc: '该专业录取的最低高考分数（574分），是评估录取难度最直接的指标。' },
      { title: '最低排名', desc: '该专业录取的最低全省排名（19639名）。相比分数，排名能更准确地反映录取难度。' },
      { title: '录取人数', desc: '该专业实际录取的学生人数（17人），反映招生规模。' },
      { title: '收费标准', desc: '每学年的学费标准（4950元/年）。不同学校和专业的学费差异较大。' },
      { title: '备注', desc: '该专业的特殊说明，可点击展开查看完整内容。' },
    ],
    demo: {
      year: '2025', p: '江西', c: '8101', n: '南昌大学',
      sr: '物理', g: '经济学', gc: '020101', batch: '本科',
      plan: '非定向',
      score: 574, rank: 19639, enrolled: 17, fee: '4950',
      remark: '不招单色不能识别的考生。',
    },
  },
  single2026: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。2026年为志愿填报参考数据。' },
      { title: '省市', desc: '院校所在的省份/直辖市。' },
      { title: '批次', desc: '录取批次类型。2026年招生计划延续了之前的批次划分。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求。本示范为「物理+生物」，需同时选考这两科方可报考。显示为「物理 生物」。' },
      { title: '性质', desc: '招生计划的性质。2026年计划数据中的性质分类与往年一致。' },
      { title: '专业名称', desc: '该专业组包含的专业名称。本示范为南昌大学「法学」专业。' },
      { title: '专业组代码', desc: '该专业的组代码。2026年法学专业组代码为502。' },
      { title: '专业代号', desc: '2026年新增的专业唯一代号（如A0、A1），用于精确标识该专业。' },
      { title: '计划录取', desc: '2026年该专业的计划招生名额（7人）。实际录取人数可能会有微调。' },
      { title: '收费标准', desc: '每学年的学费标准（4950元/年）。不同专业学费可能不同。' },
      { title: '备注', desc: '该专业的特殊说明，可点击展开查看完整内容。' },
    ],
    demo: {
      year: '2026', p: '江西', c: '8101', n: '南昌大学',
      sr: '物理 生物', g: '法学', gc: '502', batch: '本科',
      plan: '非定向',
      planCount: 7, fee: '4950', majorCode: 'A0',
      remark: '不招单色不能识别的考生。',
    },
  },
}

const MODE_CYCLE = ['merged', 'single2025', 'single2026']

function openTutorial(fromHelp) {
  state.tutorialMode = 'merged'
  state.tutorialStep = 0
  state.tutorialSteps = TUTORIAL.merged.steps
  state.tutorialDemo = TUTORIAL.merged.demo
  state.tutorialRemarkExpanded = false
  DOM.tutorialSkip.style.display = fromHelp ? 'none' : ''
  DOM.tutorialOverlay.style.display = 'flex'
  renderTutorial()
}

function closeTutorial() {
  DOM.tutorialOverlay.style.display = 'none'
}

function switchTutorialMode(mode) {
  state.tutorialMode = mode
  state.tutorialStep = 0
  state.tutorialSteps = TUTORIAL[mode].steps
  state.tutorialDemo = TUTORIAL[mode].demo
  state.tutorialRemarkExpanded = false
  renderTutorial()
  // Update tabs
  DOM.tutorialTabs.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode)
  })
}

function tutorialNext() {
  const nextIdx = state.tutorialStep + 1
  if (nextIdx < state.tutorialSteps.length) {
    const isRemarkStep = state.tutorialSteps[nextIdx].title.indexOf('备注') !== -1
    state.tutorialStep = nextIdx
    state.tutorialRemarkExpanded = isRemarkStep
    renderTutorial()
  } else {
    if (state.tutorialMode === 'single2026') {
      finishTutorial()
    } else {
      const curIdx = MODE_CYCLE.indexOf(state.tutorialMode)
      switchTutorialMode(MODE_CYCLE[curIdx + 1])
    }
  }
}

function tutorialPrev() {
  // 全部对比第一步，按钮显示为"跳过"，点击直接退出引导
  if (state.tutorialMode === 'merged' && state.tutorialStep === 0) {
    finishTutorialAndStart()
    return
  }
  if (state.tutorialStep > 0) {
    const prevIdx = state.tutorialStep - 1
    const isRemarkStep = state.tutorialSteps[prevIdx].title.indexOf('备注') !== -1
    state.tutorialStep = prevIdx
    state.tutorialRemarkExpanded = isRemarkStep
    renderTutorial()
  }
}

function toggleDemoRemark() {
  state.tutorialRemarkExpanded = !state.tutorialRemarkExpanded
  const card = DOM.tutorialCard.querySelector('.demo-card')
  if (card) {
    const remarkBody = card.querySelector('.card-remark-body')
    const toggleEl = card.querySelector('.card-remark-toggle')
    if (remarkBody) {
      remarkBody.style.display = state.tutorialRemarkExpanded ? '' : 'none'
    }
    if (toggleEl) {
      toggleEl.innerHTML = state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼'
    }
  }
}

function finishTutorial() {
  try { localStorage.setItem('tutorial_done', '1') } catch (e) {}
  closeTutorial()
}

function finishTutorialAndStart() {
  try { localStorage.setItem('tutorial_done', '1') } catch (e) {}
  closeTutorial()
}

function renderTutorial() {
  const demo = state.tutorialDemo
  const steps = state.tutorialSteps
  const stepIdx = state.tutorialStep

  // Card rendering
  DOM.tutorialCard.innerHTML = renderTutorialCard(demo, state.tutorialMode, stepIdx)

  // Step progress
  DOM.stepCount.textContent = '第 ' + (stepIdx + 1) + '/' + steps.length + ' 步'
  DOM.stepBarFill.style.width = ((stepIdx + 1) / steps.length * 100) + '%'

  // Step content
  DOM.stepTitle.textContent = steps[stepIdx].title
  DOM.stepDesc.textContent = steps[stepIdx].desc

  // Nav buttons
  if (state.tutorialMode === 'merged' && stepIdx === 0) {
    DOM.btnPrev.textContent = '跳过'
    DOM.btnPrev.classList.remove('disabled')
  } else {
    DOM.btnPrev.textContent = '← 上一步'
    DOM.btnPrev.classList.toggle('disabled', stepIdx === 0)
  }
  const isLast = stepIdx === steps.length - 1
  if (isLast) {
    if (state.tutorialMode === 'single2026') {
      DOM.btnNext.textContent = '完成'
    } else {
      DOM.btnNext.textContent = '下一模式 →'
    }
  } else {
    DOM.btnNext.textContent = '下一步 →'
  }

  // Scroll to highlighted row
  setTimeout(() => {
    const hlEl = DOM.tutorialCard.querySelector('.row-current')
    if (hlEl) {
      hlEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, 100)
}

function renderTutorialCard(demo, mode, stepIdx) {
  if (mode === 'merged') {
    return renderTutorialMerged(demo, stepIdx)
  } else if (mode === 'single2025') {
    return renderTutorialSingle2025(demo, stepIdx)
  } else {
    return renderTutorialSingle2026(demo, stepIdx)
  }
}

function renderTutorialMerged(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 || stepIdx === 1 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
      (d._newLabel ? '<span class="tag-new">新</span>' : '') +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d._sd) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      (d.a ? '<div class="card-row row-highlight' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="gp-label">2024</span><span class="card-value highlight">' + d.a.s + '分</span><span class="card-value highlight">最低排名 ' + d.a.r + '</span><span class="card-value">录取' + d.a.e + '人</span></div>' : '') +
      (d.b ? '<div class="card-row row-highlight' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="gp-label">2025</span><span class="card-value highlight">' + d.b.s + '分</span><span class="card-value highlight">最低排名 ' + d.b.r + '</span><span class="card-value">录取' + d.b.e + '人</span></div>' : '') +
      (d.d ? '<div class="card-row gp-year' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="gp-label">2026</span><span class="card-value">专业代号 ' + escHtml(d.d.code) + '</span><span class="card-value">计划录取' + d.d.e + '人</span></div>' : '') +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
      (d._diffs ? '<div class="diff-section' + (stepIdx === 12 ? ' row-current' : '') + '" id="hl-12">' + renderTutorialDiffs(d._diffs) + '</div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2025(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row row-highlight' + ((stepIdx === 7 || stepIdx === 8) ? ' row-current' : '') + '" id="hl-7"><span class="card-label">最低分</span><span class="card-value highlight">' + d.score + '</span><span class="card-label">最低排名</span><span class="card-value highlight">' + d.rank + '</span></div>' +
      '<div class="card-row' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="card-label">录取</span><span class="card-value">' + d.enrolled + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2026(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">专业代号</span><span class="card-value">' + escHtml(d.majorCode) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="card-label">计划录取</span><span class="card-value highlight">' + d.planCount + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 10 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialDiffs(diffs) {
  let html = ''
  for (const diff of diffs) {
    const label = diff.field === '专业组代码' ? '专业组代码变动' : diff.field + '差异'
    html += '<div class="diff-group"><span class="diff-field">' + label + '</span>'
    for (const entry of diff.entries) {
      html += '<div class="diff-entry"><span class="diff-years">' + escHtml(entry.years) + '</span><span class="diff-arrow">→</span><span class="diff-val">' + escHtml(entry.value) + '</span></div>'
    }
    html += '</div>'
  }
  return html
}

// ============================================================
// 志愿填报辅助
// ============================================================

// Assistant SR and region state
let asSrIdx = -1  // -1 = 未选择
let asRegionIdx = 0
let _mobileAssistantActive = false  // 手机端志愿推荐模式是否激活

function openAssistantSR() {
  renderASSRList()
  DOM.asSrModal.style.display = 'flex'
}

function renderASSRList() {
  const list = DOM.asSrList
  list.innerHTML = ''
  for (let i = 0; i < AS_SR_LIST.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (asSrIdx === i ? ' selected' : '')
    item.textContent = AS_SR_LIST[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      asSrIdx = parseInt(this.dataset.idx)
      renderASSRList()
    })
    list.appendChild(item)
  }
  // 分隔 + 历史方向提示
  const divider = document.createElement('div')
  divider.className = 'scroll-select-item disabled'
  divider.textContent = '─ 历史方向暂不支持 ─'
  divider.style.cssText = 'color:var(--text-muted);font-size:11px;text-align:center;pointer-events:none;'
  list.appendChild(divider)
}

function confirmASSR() {
  DOM.asSrModal.style.display = 'none'
  if (asSrIdx >= 0) {
    DOM.asSrLabel.textContent = AS_SR_LIST[asSrIdx]
    DOM.asSrLabel.className = ''
  }
}

function openAssistantRegion() {
  renderRegionList()
  DOM.regionModal.style.display = 'flex'
}

function renderRegionList() {
  const list = DOM.regionList
  list.innerHTML = ''
  for (let i = 0; i < REGION_NAMES.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (asRegionIdx === i ? ' selected' : '')
    item.textContent = REGION_NAMES[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      asRegionIdx = parseInt(this.dataset.idx)
      renderRegionList()
    })
    list.appendChild(item)
  }
}

function confirmRegionPicker() {
  DOM.regionModal.style.display = 'none'
  DOM.asRegionLabel.textContent = REGION_NAMES[asRegionIdx]
  DOM.asRegionLabel.className = asRegionIdx === 0 ? 'placeholder-text' : ''
}

function getBestScore(group) {
  const scores = []
  if (group.d && group.d.s) scores.push(group.d.s)
  if (group.a && group.a.s) scores.push(group.a.s)
  if (group.b && group.b.s) scores.push(group.b.s)
  return scores.length ? Math.max(...scores) : null
}

function calculateTier(userScore, userRank, group) {
  // Priority 1: 2026 estimated rank, with deviation check
  if (userRank && group.d && group.d.r) {
    const rankOk = Math.abs(group.d.r - userRank) / userRank <= 0.15
    let deviationOk
    if (userScore && group.d.s) {
      deviationOk = Math.abs(group.d.s - userScore) <= 20 && rankOk
    } else {
      deviationOk = rankOk
    }
    if (deviationOk) {
      const ratio = group.d.r / userRank
      if (ratio < 0.92) return '冲'
      if (ratio <= 1.08) return '稳'
      // 保双重熔断：分数 > userScore-15 且 排名 ≤ max(userRank×130%, userRank+3000)
      const rankCap = Math.max(userRank * 1.30, userRank + 3000)
      if (group.d.r > rankCap) return null
      if (userScore) {
        const bestScore = getBestScore(group)
        if (bestScore !== null && bestScore < userScore - 15) return null
      }
      return '保'
    }
  }

  // Priority 2: 2024/2025 average rank
  if (userRank) {
    const ranks = []
    if (group.a && group.a.r) ranks.push(group.a.r)
    if (group.b && group.b.r) ranks.push(group.b.r)
    if (ranks.length > 0) {
      const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length
      const ratio = avgRank / userRank
      if (ratio < 0.92) return '冲'
      if (ratio <= 1.08) return '稳'
      // 保双重熔断
      const rankCap = Math.max(userRank * 1.30, userRank + 3000)
      if (avgRank > rankCap) return null
      if (userScore) {
        const bestScore = getBestScore(group)
        if (bestScore !== null && bestScore < userScore - 15) return null
      }
      return '保'
    }
  }

  // Priority 3: Score-based fallback
  if (userScore) {
    const scores = []
    if (group.d && group.d.s) scores.push(group.d.s)
    if (group.a && group.a.s) scores.push(group.a.s)
    if (group.b && group.b.s) scores.push(group.b.s)
    if (scores.length > 0) {
      const bestScore = Math.max(...scores)
      if (bestScore > userScore + 5) return '冲'
      if (bestScore >= userScore - 5) return '稳'
      return '保'
    }
  }

  return null
}

function subjectMatch(userSr, groupSr) {
  if (!groupSr) return true
  const userCodes = new Set(parseSrCodes(userSr))
  const groupCodes = parseSrCodes(groupSr)
  if (groupCodes.length === 0) return true
  return groupCodes.every(c => userCodes.has(c))
}

function parseSrCodes(sr) {
  if (!sr || sr === '不限') return []
  if (sr.includes('*')) return sr.split('*').filter(Boolean)
  const map = { '物': '04', '理': '04', '化': '05', '生': '06' }
  const chars = sr.replace(/[+\s]/g, '')
  const codes = []
  for (const ch of chars) {
    const c = map[ch]
    if (c) codes.push(c)
  }
  return [...new Set(codes)]
}

function startAssistant() {
  // Guard: data not loaded
  if (!state.loaded || !state.mergedCache) {
    DOM.asColumns.innerHTML = '<div class="as-empty">数据加载中，请稍候...</div>'
    showAssistantMode()
    return
  }
  // Read inputs
  const score = parseInt(DOM.asScore.value) || 0
  const rank = parseInt(DOM.asRank.value) || 0
  const srCode = asSrIdx >= 0 ? AS_SR_CODES[asSrIdx] : ''
  const regionProvinces = REGIONS[REGION_NAMES[asRegionIdx]]
  const keyword = String(DOM.asKeyword.value).trim()

  if (!score && !rank) {
    DOM.asColumns.innerHTML = '<div class="as-empty">请输入高考分数或全省排名</div>'
    showAssistantMode()
    return
  }

  // 过滤 mergedCache（仅推荐 2026 年有招生计划的专业组）
  const results = { '冲': [], '稳': [], '保': [] }
  const data = state.mergedCache || []

  for (let i = 0; i < data.length; i++) {
    const g = data[i]

    // 仅推荐 2026 年有招生计划的专业组
    if (!g.d) continue

    // Region filter
    if (regionProvinces && regionProvinces.indexOf(g.p) === -1) continue

    // Subject filter (减量匹配：考生选科 ⊇ 专业要求)
    if (srCode && !subjectMatch(srCode, g.s)) continue

    // 专业名搜索（多项用空格分隔，OR 匹配）
    if (keyword) {
      const kws = keyword.split(/\s+/).filter(Boolean)
      const matchAny = kws.some(function(kw) { return g.g.indexOf(kw) !== -1 })
      if (!matchAny) continue
    }

    // Skip sports/coop based on existing filters
    if (state.hideSports && (g.g.indexOf('体育') !== -1 || g.n.indexOf('体育') !== -1)) continue
    if (state.hideCoop && (g.g.indexOf('中外合作') !== -1 || (g.remark && g.remark.indexOf('中外合作') !== -1))) continue

    // Calculate tier
    const tier = calculateTier(score, rank, g)
    if (tier && results[tier]) {
      results[tier].push(g)
    }
  }

  // Sort within each tier（保：从高到低，冲/稳：从低到高）
  for (const t of ['冲', '稳', '保']) {
    const order = t === '保' ? -1 : 1
    results[t].sort((a, b) => {
      const sa = Number((b.d || b.b || b.a || {}).s || 0)
      const sb = Number((a.d || a.b || a.a || {}).s || 0)
      return order * (sb - sa)
    })
  }

  renderAssistantResults(results, score, rank)
  showAssistantMode()
}

function renderAssistantResults(results, userScore, userRank) {
  const container = DOM.asColumns
  const tiers = ['冲', '稳', '保']
  const labels = { '冲': '冲', '稳': '稳', '保': '保' }
  const classes = { '冲': 'reach', '稳': 'safe', '保': 'fallback' }

  const total = tiers.reduce((s, t) => s + results[t].length, 0)

  if (total === 0) {
    container.innerHTML = '<div class="as-empty">未找到匹配的院校和专业，请调整输入条件后重试</div>'
    return
  }

  container.innerHTML = ''
  const oldRemarkExpanded = state.remarkExpanded
  state.remarkExpanded = {}

  // Build tab bar
  const tabBar = document.createElement('div')
  tabBar.className = 'as-tab-bar'
  tabBar.id = 'as-tab-bar'
  for (const t of tiers) {
    const count = results[t].length
    const tab = document.createElement('span')
    tab.className = 'as-tab ' + classes[t] + (t === '冲' ? ' active' : '')
    tab.dataset.tier = t
    tab.textContent = labels[t] + ' (' + count + ')'
    tabBar.appendChild(tab)
  }
  container.appendChild(tabBar)

  // Build columns
  for (const t of tiers) {
    const items = results[t]
    const isActive = t === '冲'

    const col = document.createElement('div')
    col.className = 'as-column' + (isActive ? ' active' : '')
    col.dataset.tier = t

    const header = document.createElement('div')
    header.className = 'as-column-header ' + classes[t]
    header.innerHTML = labels[t] + ' <span style="font-weight:normal;font-size:12px">' + items.length + '个专业组</span>'
    col.appendChild(header)

    const body = document.createElement('div')
    body.className = 'as-column-body'
    // 列体滚动 → 显示/隐藏返回顶部按钮
    body.addEventListener('scroll', function () {
      if (_mobileAssistantActive) {
        DOM.floatBtn.style.display = this.scrollTop > 300 ? 'flex' : 'none'
      }
    })

    for (let i = 0; i < items.length; i++) {
      const g = items[i]
      // 复用标准卡片渲染
      const card = renderCardGrouped(g, 'as-' + t + '-' + i)
      body.appendChild(card)
    }

    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'as-empty'
      empty.style.padding = '20px 0'
      empty.textContent = '该档暂无推荐'
      body.appendChild(empty)
    }

    col.appendChild(body)
    container.appendChild(col)
  }

  state.remarkExpanded = oldRemarkExpanded
  updateAssistantLayout()

  // Bind tab switching
  const tabs = container.querySelectorAll('.as-tab')
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const tier = this.dataset.tier
      container.querySelectorAll('.as-tab').forEach(function (t) { t.classList.remove('active') })
      this.classList.add('active')
      container.querySelectorAll('.as-column').forEach(function (c) {
        c.classList.toggle('active', c.dataset.tier === tier)
      })
      // 切换列时检查新列的滚动位置
      const activeBody = container.querySelector('.as-column.active .as-column-body')
      if (activeBody) {
        DOM.floatBtn.style.display = activeBody.scrollTop > 300 ? 'flex' : 'none'
      }
    })
  })
}

function updateAssistantLayout() {
  const container = DOM.asColumns
  if (!container) return
  // If right-col width < 500px, add tab-mode class
  const rightCol = container.closest('.right-col')
  if (rightCol) {
    const w = rightCol.offsetWidth
    container.classList.toggle('tab-mode', w < 500)
  }
}

function showAssistantMode() {
  DOM.resultBar.style.display = 'none'
  DOM.resultList.style.display = 'none'
  DOM.assistantResults.style.display = 'flex'
  DOM.assistantResults.style.flex = '1'
}

function exitAssistant() {
  DOM.resultBar.style.display = ''
  DOM.resultList.style.display = ''
  DOM.assistantResults.style.display = 'none'
  // 重置切换按钮文字
  DOM.btnAsToggle.textContent = '志愿推荐'
  _mobileAssistantActive = false
  // 手机端：恢复被隐藏的筛选行和年份选项卡
  if (window.innerWidth < 860) {
    DOM.assistantSection.style.display = ''
    const rows = DOM.filterFields.querySelectorAll('.filter-row')
    for (let i = 1; i < rows.length; i++) {
      rows[i].style.display = ''
    }
    DOM.yearTabs.style.display = ''
  }
}

function toggleMobileAssistant() {
  if (_mobileAssistantActive) {
    exitAssistant()
    return
  }
  // 进入志愿推荐模式
  _mobileAssistantActive = true
  DOM.btnAsToggle.textContent = '返回搜索'
  // 手机端专有布局调整
  if (window.innerWidth < 860) {
    // 确保筛选栏展开
    DOM.filterBar.classList.remove('hidden')
    state.filterHidden = false
    DOM.toggleFilter.textContent = '收起筛选'
    // 隐藏其他筛选行，保留年份选项卡行
    const rows = DOM.filterFields.querySelectorAll('.filter-row')
    for (let i = 1; i < rows.length; i++) {
      rows[i].style.display = 'none'
    }
    // 隐藏年份选项卡中的全部和年份
    DOM.yearTabs.style.display = 'none'
    DOM.assistantSection.style.display = 'block'
  }
  // 切换右侧结果区到志愿推荐模式
  startAssistant()
}

// ============================================================
// 志愿填报辅助 — 桌面端折叠/展开
// ============================================================
function toggleAssistantCollapse() {
  DOM.assistantSection.classList.toggle('collapsed')
}

function checkAssistantOverflow() {
  // 仅在桌面端生效
  if (window.innerWidth < 860) return
  const fb = DOM.filterBar
  // 如果内容溢出且当前未折叠，自动折叠
  if (fb.scrollHeight > fb.clientHeight && !DOM.assistantSection.classList.contains('collapsed')) {
    DOM.assistantSection.classList.add('collapsed')
  }
}

// ============================================================
// 初始化与事件绑定
// ============================================================
function initDOM() {
  DOM = {
    // Loading
    progressFill: document.getElementById('progress-fill'),
    loadPct: document.getElementById('load-pct'),
    loadStage: document.getElementById('load-stage'),
    pageLoading: document.getElementById('page-loading'),
    pageIndex: document.getElementById('page-index'),

    // Filter bar
    filterBar: document.getElementById('filter-bar'),
    filterFields: document.getElementById('filter-fields'),
    yearTabs: document.getElementById('year-tabs'),
    inputCode: document.getElementById('input-code'),
    inputName: document.getElementById('input-name'),
    inputGroupName: document.getElementById('input-group-name'),
    inputGroupCode: document.getElementById('input-group-code'),
    inputMinScore: document.getElementById('input-min-score'),
    inputMaxRank: document.getElementById('input-max-rank'),
    scoreRow: document.getElementById('filter-score-row'),
    btnSearch: document.getElementById('btn-search'),
    btnReset: document.getElementById('btn-reset'),
    toggleFilter: document.getElementById('toggle-filter'),

    // Province
    provinceModal: document.getElementById('province-modal'),
    provinceList: document.getElementById('province-list'),
    provinceLabel: document.getElementById('province-label'),
    btnProvinces: document.getElementById('btn-provinces'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnConfirmProvince: document.getElementById('btn-confirm-province'),

    // SR
    srModal: document.getElementById('sr-modal'),
    srList: document.getElementById('sr-list'),
    srLabel: document.getElementById('sr-label'),
    btnSR: document.getElementById('btn-sr'),
    btnConfirmSR: document.getElementById('btn-confirm-sr'),

    // Batch
    batchModal: document.getElementById('batch-modal'),
    batchList: document.getElementById('batch-list'),
    batchLabel: document.getElementById('batch-label'),
    btnBatches: document.getElementById('btn-batches'),
    btnSelectAllBatch: document.getElementById('btn-select-all-batch'),
    btnClearAllBatch: document.getElementById('btn-clear-all-batch'),
    btnConfirmBatch: document.getElementById('btn-confirm-batch'),

    // Results
    resultList: document.getElementById('result-list'),
    resultCards: document.getElementById('result-cards'),
    totalCount: document.getElementById('total-count'),
    loadTime: document.getElementById('load-time'),
    emptyMsg: document.getElementById('empty-msg'),
    loadingMore: document.getElementById('loading-more'),
    floatBtn: document.getElementById('float-btn'),

    // Tutorial
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialCard: document.getElementById('tutorial-card'),
    tutorialTabs: document.getElementById('tutorial-tabs'),
    tutorialSkip: document.getElementById('tutorial-skip'),
    stepCount: document.getElementById('step-count'),
    stepBarFill: document.getElementById('step-bar-fill'),
    stepTitle: document.getElementById('step-title'),
    stepDesc: document.getElementById('step-desc'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),

    // Mobile assistant toggle
    btnAsToggle: document.getElementById('btn-as-toggle'),

    // Help
    btnDarkMode: document.getElementById('btn-dark-mode'),
    btnHelp: document.getElementById('btn-help'),
    btnFeedback: document.getElementById('btn-feedback'),
    btnHelpBar: document.getElementById('btn-help-bar'),
    btnFeedbackBar: document.getElementById('btn-feedback-bar'),
    btnDarkModeBar: document.getElementById('btn-dark-mode-bar'),

    // Assistant SR picker
    asSrModal: document.getElementById('as-sr-modal'),
    asSrList: document.getElementById('as-sr-list'),
    btnConfirmASSR: document.getElementById('btn-confirm-as-sr'),

    // Region picker
    regionModal: document.getElementById('region-modal'),
    regionList: document.getElementById('region-list'),
    btnConfirmRegion: document.getElementById('btn-confirm-region'),

    // Assistant section (filter bar)
    assistantSection: document.getElementById('assistant-section'),
    asToggleRow: document.getElementById('as-toggle-row'),
    asBody: document.getElementById('as-body'),
    // Assistant
    asScore: document.getElementById('as-score'),
    asRank: document.getElementById('as-rank'),
    asSrLabel: document.getElementById('as-sr-label'),
    asSr: document.getElementById('as-sr'),
    asRegionLabel: document.getElementById('as-region-label'),
    asRegion: document.getElementById('as-region'),
    asKeyword: document.getElementById('as-keyword'),
    btnAssistant: document.getElementById('btn-assistant'),
    btnExitAssistant: document.getElementById('btn-exit-assistant'),
    assistantResults: document.getElementById('assistant-results'),
    asColumns: document.getElementById('as-columns'),
    resultBar: document.getElementById('result-bar'),
  }
}

function bindEvents() {
  // Year tabs (event delegation)
  DOM.yearTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.tab')
    if (!tab || tab.dataset.year === undefined) return
    onYearChange(tab.dataset.year)
  })

  // Input fields (debounced)
  const inputFields = [
    DOM.inputCode, DOM.inputName, DOM.inputGroupName,
    DOM.inputGroupCode, DOM.inputMinScore, DOM.inputMaxRank
  ]
  let searchTimer = null
  inputFields.forEach(el => {
    el.addEventListener('input', function () {
      syncStateFromInputs()
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(doSearch, SEARCH_DEBOUNCE)
    })
  })

  // Province picker
  DOM.btnProvinces.addEventListener('click', openProvincePicker)
  DOM.provinceModal.addEventListener('click', function (e) {
    if (e.target === this) closeProvincePicker()
  })
  DOM.btnSelectAll.addEventListener('click', selectAllProvinces)
  DOM.btnClearAll.addEventListener('click', clearProvinces)
  DOM.btnConfirmProvince.addEventListener('click', confirmProvincePicker)

  // SR picker
  DOM.btnSR.addEventListener('click', openSRPicker)
  DOM.srModal.addEventListener('click', function (e) {
    if (e.target === this) closeSRPicker()
  })
  DOM.btnConfirmSR.addEventListener('click', confirmSR)

  // Batch picker
  DOM.btnBatches.addEventListener('click', openBatchPicker)
  DOM.batchModal.addEventListener('click', function (e) {
    if (e.target === this) closeBatchPicker()
  })
  DOM.btnSelectAllBatch.addEventListener('click', selectAllBatches)
  DOM.btnClearAllBatch.addEventListener('click', clearBatches)
  DOM.btnConfirmBatch.addEventListener('click', confirmBatchPicker)

  // Toggle switches
  document.getElementById('toggle-only2026').addEventListener('click', onToggleOnly2026)
  document.getElementById('toggle-hide-sports').addEventListener('click', onToggleHideSports)
  document.getElementById('toggle-hide-coop').addEventListener('click', onToggleHideCoop)
  DOM.btnDarkMode.addEventListener('click', onToggleDarkMode)

  // Mobile assistant toggle
  DOM.btnAsToggle.addEventListener('click', toggleMobileAssistant)

  // Search / Reset
  DOM.btnSearch.addEventListener('click', function () {
    syncStateFromInputs()
    doSearch()
  })
  DOM.btnReset.addEventListener('click', doReset)

  // Filter toggle
  DOM.toggleFilter.addEventListener('click', function () {
    state.filterHidden = !state.filterHidden
    DOM.filterBar.classList.toggle('hidden', state.filterHidden)
    DOM.toggleFilter.textContent = state.filterHidden ? '展开筛选' : '收起筛选'
    DOM.floatBtn.style.display = state.filterHidden ? 'flex' : 'none'
  })

  // Float button (scroll to top)
  DOM.floatBtn.addEventListener('click', scrollToTop)

  // Scroll to load more
  let lastScrollTop = 0
  DOM.resultList.addEventListener('scroll', function () {
    const { scrollTop, scrollHeight, clientHeight } = this
    if (scrollHeight - scrollTop - clientHeight < 100 && state.hasMore) {
      loadMore()
    }
    // Show float btn when scrolled past filter
    DOM.floatBtn.style.display = scrollTop > 300 ? 'flex' : 'none'
    lastScrollTop = scrollTop
  })

  // 志愿推荐模式滚动 → 显示/隐藏返回顶部按钮（通过列体直接绑定）
  // 实际绑定在 renderAssistantResults 中创建列体时完成

  // Help button
  DOM.btnHelp.addEventListener('click', function () {
    openTutorial(true)
  })

  // Feedback button → GitHub Issues
  DOM.btnFeedback.addEventListener('click', function () {
    window.open('https://github.com/Shirakawa-Kotone/miniprogram-web/issues/new', '_blank')
  })

  // Result bar action buttons
  DOM.btnHelpBar.addEventListener('click', function () { openTutorial(true) })
  DOM.btnFeedbackBar.addEventListener('click', function () {
    window.open('https://github.com/Shirakawa-Kotone/miniprogram-web/issues/new', '_blank')
  })
  DOM.btnDarkModeBar.addEventListener('click', onToggleDarkMode)

  // Tutorial events
  DOM.tutorialSkip.addEventListener('click', finishTutorialAndStart)

  // Tutorial tabs
  DOM.tutorialTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.mode-tab')
    if (!tab || !tab.dataset.mode) return
    switchTutorialMode(tab.dataset.mode)
  })

  DOM.btnNext.addEventListener('click', tutorialNext)
  DOM.btnPrev.addEventListener('click', tutorialPrev)

  // Click overlay to close tutorial
  DOM.tutorialOverlay.addEventListener('click', function (e) {
    if (e.target === this) finishTutorialAndStart()
  })

  // Assistant — SR picker (独立弹窗)
  DOM.asSr.addEventListener('click', openAssistantSR)
  DOM.asSrModal.addEventListener('click', function (e) {
    if (e.target === this) DOM.asSrModal.style.display = 'none'
  })
  DOM.btnConfirmASSR.addEventListener('click', confirmASSR)
  // Assistant — region picker modal
  DOM.asRegion.addEventListener('click', openAssistantRegion)
  DOM.regionModal.addEventListener('click', function (e) {
    if (e.target === this) DOM.regionModal.style.display = 'none'
  })
  DOM.btnConfirmRegion.addEventListener('click', confirmRegionPicker)
  // Assistant — start recommendation
  DOM.btnAssistant.addEventListener('click', startAssistant)
  // Assistant — exit
  DOM.btnExitAssistant.addEventListener('click', exitAssistant)
  // Assistant — Enter key triggers search
  DOM.asKeyword.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })
  DOM.asScore.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })
  DOM.asRank.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })

  // Assistant section collapse toggle
  DOM.asToggleRow.addEventListener('click', toggleAssistantCollapse)

  // Resize handlers
  window.addEventListener('resize', function () {
    if (DOM.assistantResults.style.display !== 'none') {
      updateAssistantLayout()
    }
    checkAssistantOverflow()
  })
}

// ============================================================
// 启动
// ============================================================
function init() {
  updateProgress(10, '正在加载数据文件...')

  // 延迟执行确保 DOM 已渲染
  setTimeout(() => {
    initDOM()
    bindEvents()

    updateProgress(20, '加载完成，正在初始化界面...')

    // 展开数据（分块异步，带进度）
    setTimeout(() => {
      expandAllData(function (success) {
        if (!success) {
          updateProgress(100, '数据加载失败，请刷新页面重试')
          return
        }

        updateProgress(75, '正在构建查询缓存...')

        setTimeout(() => {
          buildMergedCache()
          buildBatchList()

          updateProgress(82, '正在优化搜索结果排序...')

          setTimeout(() => {
            updateProgress(90, '准备就绪...')

            // 切换到主页面
            setTimeout(() => {
              DOM.pageLoading.style.display = 'none'
              DOM.pageIndex.style.display = ''

              state.loaded = true
              state.darkMode = document.documentElement.classList.contains('dark-mode')

              // 首访引导
              let tutorialDone = false
              try { tutorialDone = localStorage.getItem('tutorial_done') } catch (e) {}
              if (!tutorialDone) {
                openTutorial(false)
              }

              // 初始搜索
              doSearch()
              // 桌面端检测助手区是否溢出
              setTimeout(checkAssistantOverflow, 300)
            }, 200)
          }, 80)
        }, 80)
      })
    }, 80)
  }, 50)
}

// 页面加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
