/**
 * Merge PINHOK HSK1 sentences into src/data/sentences_hsk1.json.
 * Run: node scripts/merge-pinhok-hsk1-sentences.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildRow, tokenizeHan } from './lib/sentenceRowBuilder.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')
const existingPath = path.join(dataDir, 'sentences_hsk1.json')
const pinhokPath = path.join(__dirname, 'data', 'pinhok-hsk1-sentences.json')

/** @param {string} s */
function dedupeKey(s) {
  return String(s).replace(/[。！？?!.,，、；：\s]/g, '')
}

/** HSK1 compounds — space-separated pinyin for multi-char tokens the aligner can't split */
const EXTRA = [
  { simplified: '你好', pinyin: 'nǐ hǎo' },
  { simplified: '没有', pinyin: 'méi yǒu' },
  { simplified: '一杯', pinyin: 'yì bēi' },
  { simplified: '开水', pinyin: 'kāi shuǐ' },
  { simplified: '好吃', pinyin: 'hǎo chī' },
  { simplified: '大学', pinyin: 'dà xué' },
  { simplified: '北京大学', pinyin: 'Běijīng Dàxué' },
  { simplified: '看书', pinyin: 'kàn shū' },
  { simplified: '做饭', pinyin: 'zuò fàn' },
  { simplified: '汉字', pinyin: 'hàn zì' },
  { simplified: '中国人', pinyin: 'Zhōngguó rén' },
  { simplified: '三十四', pinyin: 'sān shí sì' },
  { simplified: '星期六', pinyin: 'xīng qī liù' },
  { simplified: '星期天', pinyin: 'xīng qī tiān' },
  { simplified: '哪里', pinyin: 'nǎ lǐ' },
  { simplified: '坐一下', pinyin: 'zuò yí xià' },
  { simplified: '哪个', pinyin: 'nǎ ge' },
  { simplified: '这些', pinyin: 'zhè xiē' },
  { simplified: '那些', pinyin: 'nà xiē' },
  { simplified: '医生', pinyin: 'yī shēng' },
  { simplified: '喝茶', pinyin: 'hē chá' },
  { simplified: '吃饭', pinyin: 'chī fàn' },
  { simplified: '买东西', pinyin: 'mǎi dōng xi' },
  { simplified: '星期五', pinyin: 'xīng qī wǔ' },
  { simplified: '星期一', pinyin: 'xīng qī yī' },
  { simplified: '星期二', pinyin: 'xīng qī èr' },
  { simplified: '星期三', pinyin: 'xīng qī sān' },
  { simplified: '星期四', pinyin: 'xīng qī sì' },
  { simplified: '星期日', pinyin: 'xīng qī rì' },
  { simplified: '火车站', pinyin: 'huǒ chē zhàn' },
  { simplified: '火车', pinyin: 'huǒ chē' },
  { simplified: '碗', pinyin: 'wǎn' },
  { simplified: '爸爸', pinyin: 'bà ba' },
  { simplified: '杯子', pinyin: 'bēi zi' },
  { simplified: '这个', pinyin: 'zhè ge' },
  { simplified: '那个', pinyin: 'nà ge' },
  { simplified: '漂亮', pinyin: 'piào liang' },
  { simplified: '东西', pinyin: 'dōng xi' },
  { simplified: '衣服', pinyin: 'yī fu' },
  { simplified: '朋友们', pinyin: 'péng you men' },
  { simplified: '我们', pinyin: 'wǒ men' },
  { simplified: '你们', pinyin: 'nǐ men' },
  { simplified: '他们', pinyin: 'tā men' },
  { simplified: '她们', pinyin: 'tā men' },
  { simplified: '认识', pinyin: 'rèn shi' },
  { simplified: '儿子', pinyin: 'ér zi' },
  { simplified: '女儿', pinyin: 'nǚ ér' },
  { simplified: '妈妈', pinyin: 'mā ma' },
  { simplified: '什么', pinyin: 'shén me' },
  { simplified: '怎么', pinyin: 'zěn me' },
  { simplified: '怎么样', pinyin: 'zěn me yàng' },
  { simplified: '谢谢', pinyin: 'xiè xie' },
  { simplified: '桌子', pinyin: 'zhuō zi' },
  { simplified: '哪儿', pinyin: 'nǎr' },
  { simplified: '这儿', pinyin: 'zhèr' },
  { simplified: '那儿', pinyin: 'nàr' },
  { simplified: '点儿', pinyin: 'diǎnr' },
  { simplified: '一点儿', pinyin: 'yī diǎnr' },
  { simplified: '店', pinyin: 'diàn' },
  { simplified: '学', pinyin: 'xué' },
  { simplified: '们', pinyin: 'men' },
  // Remaining multi-char HSK1 tokens (override condensed hsk1.json pinyin)
  { simplified: '喜欢', pinyin: 'xǐ huan' },
  { simplified: '高兴', pinyin: 'gāo xìng' },
  { simplified: '学习', pinyin: 'xué xí' },
  { simplified: '工作', pinyin: 'gōng zuò' },
  { simplified: '下雨', pinyin: 'xià yǔ' },
  { simplified: '看见', pinyin: 'kàn jiàn' },
  { simplified: '睡觉', pinyin: 'shuì jiào' },
  { simplified: '打电话', pinyin: 'dǎ diàn huà' },
  { simplified: '不客气', pinyin: 'bú kè qi' },
  { simplified: '没关系', pinyin: 'méi guān xi' },
  { simplified: '对不起', pinyin: 'duì bu qǐ' },
  { simplified: '再见', pinyin: 'zài jiàn' },
  { simplified: '多少', pinyin: 'duō shao' },
  { simplified: '学校', pinyin: 'xué xiào' },
  { simplified: '饭店', pinyin: 'fàn diàn' },
  { simplified: '商店', pinyin: 'shāng diàn' },
  { simplified: '医院', pinyin: 'yī yuàn' },
  { simplified: '中国', pinyin: 'Zhōng guó' },
  { simplified: '北京', pinyin: 'Běi jīng' },
  { simplified: '前面', pinyin: 'qián miàn' },
  { simplified: '后面', pinyin: 'hòu miàn' },
  { simplified: '今天', pinyin: 'jīn tiān' },
  { simplified: '明天', pinyin: 'míng tiān' },
  { simplified: '昨天', pinyin: 'zuó tiān' },
  { simplified: '星期', pinyin: 'xīng qī' },
  { simplified: '现在', pinyin: 'xiàn zài' },
  { simplified: '时候', pinyin: 'shí hou' },
  { simplified: '老师', pinyin: 'lǎo shī' },
  { simplified: '学生', pinyin: 'xué shēng' },
  { simplified: '同学', pinyin: 'tóng xué' },
  { simplified: '朋友', pinyin: 'péng you' },
  { simplified: '小姐', pinyin: 'xiǎo jiě' },
  { simplified: '米饭', pinyin: 'mǐ fàn' },
  { simplified: '水果', pinyin: 'shuǐ guǒ' },
  { simplified: '苹果', pinyin: 'píng guǒ' },
  { simplified: '飞机', pinyin: 'fēi jī' },
  { simplified: '出租车', pinyin: 'chū zū chē' },
  { simplified: '电视', pinyin: 'diàn shì' },
  { simplified: '电脑', pinyin: 'diàn nǎo' },
  { simplified: '电影', pinyin: 'diàn yǐng' },
  { simplified: '天气', pinyin: 'tiān qì' },
  { simplified: '名字', pinyin: 'míng zi' },
  { simplified: '汉语', pinyin: 'hàn yǔ' },
  { simplified: '椅子', pinyin: 'yǐ zi' },
  { simplified: '小', pinyin: 'xiǎo' },
]

/**
 * @param {string} chinese
 * @param {Map<string, { pinyin: string }>} hskMap
 */
function autoMarkedPinyin(chinese, hskMap) {
  const vocab = [...hskMap.keys()]
  const tokens = tokenizeHan(chinese, vocab)
  /** @type {string[]} */
  const groups = []
  for (const token of tokens) {
    const entry = hskMap.get(token)
    if (entry) {
      groups.push(entry.pinyin)
      continue
    }
    for (const ch of [...token]) {
      const ce = hskMap.get(ch)
      if (!ce) throw new Error(`Missing pinyin for "${ch}" in "${chinese}"`)
      groups.push(ce.pinyin)
    }
  }
  let marked = groups.join(' ')
  if (marked.length) marked = marked.charAt(0).toUpperCase() + marked.slice(1)
  const trail = chinese.match(/[！？?!.,，。、；：]+/g)
  if (trail?.length) marked += trail.join('')
  return marked
}

/** @param {string} chinese @param {string} english */
function buildFallbackRow(chinese, english) {
  return {
    chinese,
    english,
    pinyin: '',
    parts: [],
    py: [],
  }
}

const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
const beforeCount = existing.length
const existingKeys = new Set(existing.map((r) => dedupeKey(r.chinese)))

const pinhok = JSON.parse(fs.readFileSync(pinhokPath, 'utf8'))
const hsk1 = JSON.parse(fs.readFileSync(path.join(dataDir, 'hsk1.json'), 'utf8'))
/** @type {Map<string, { pinyin: string }>} */
const hskMap = new Map(hsk1.map((e) => [e.simplified, e]))
for (const e of EXTRA) {
  hskMap.set(e.simplified, e)
}

/** @type {typeof existing} */
const merged = [...existing]
let added = 0
let addedWithoutParts = 0
let skipped = 0

for (const { hanzi, english } of pinhok) {
  const chinese = String(hanzi).trim()
  const key = dedupeKey(chinese)
  if (existingKeys.has(key)) {
    skipped += 1
    continue
  }
  try {
    const marked = autoMarkedPinyin(chinese, hskMap)
    const row = buildRow(chinese, marked, english, hskMap)
    merged.push(row)
    existingKeys.add(key)
    added += 1
  } catch (err) {
    console.log(`Added without parts: ${chinese}`)
    merged.push(buildFallbackRow(chinese, english))
    existingKeys.add(key)
    added += 1
    addedWithoutParts += 1
  }
}

const allKeys = merged.map((r) => dedupeKey(r.chinese))
if (new Set(allKeys).size !== allKeys.length) {
  const dupes = allKeys.filter((k, i) => allKeys.indexOf(k) !== i)
  console.error('Duplicate keys in final file:', [...new Set(dupes)].slice(0, 10))
  process.exit(1)
}

fs.writeFileSync(existingPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

const report = [
  `Before: ${beforeCount} sentences`,
  `After: ${merged.length} sentences`,
  `Added ${added} new sentences, skipped ${skipped} duplicates`,
  `Added without parts: ${addedWithoutParts}`,
  `Failed: 0`,
  `Unique dedupe keys in final file: ${new Set(allKeys).size}`,
]
for (const line of report) console.log(line)
fs.writeFileSync(
  path.join(__dirname, 'merge-pinhok-report.txt'),
  `${report.join('\n')}\n`,
  'utf8',
)
