/**
 * Build src/data/sentences_hsk2.json from HSK 2 sample-test style sentences.
 * Run: npm run gen:sentences-hsk2
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildRow } from './lib/sentenceRowBuilder.mjs'
import { SENTENCES } from './data/hsk2-sample-sentences.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')

function loadHsk(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
}

/** @type {Map<string, { pinyin: string }>} */
const hskMap = new Map()
for (const entry of [...loadHsk('hsk1.json'), ...loadHsk('hsk2.json')]) {
  hskMap.set(entry.simplified, entry)
}

/** Tokens used in sentences but not in HSK 1/2 JSON as standalone entries */
const EXTRA = [
  { simplified: '雨', pinyin: 'yǔ' },
  { simplified: '停', pinyin: 'tíng' },
  { simplified: '欢迎', pinyin: 'huānyíng' },
  { simplified: '女朋友', pinyin: 'nǚpéngyou' },
  { simplified: '部', pinyin: 'bù' },
  { simplified: '笑一笑', pinyin: 'xiàoyixiào' },
  { simplified: '这些', pinyin: 'zhèxiē' },
  { simplified: '斤', pinyin: 'jīn' },
  { simplified: '把', pinyin: 'bǎ' },
  { simplified: '杯', pinyin: 'bēi' },
  { simplified: '热', pinyin: 'rè' },
  { simplified: '一百', pinyin: 'yìbǎi' },
  { simplified: '多年前', pinyin: 'duōniánqián' },
  { simplified: '年前', pinyin: 'niánqián' },
  { simplified: '饭', pinyin: 'fàn' },
  { simplified: '桌子', pinyin: 'zhuōzi' },
  { simplified: '椅子', pinyin: 'yǐzi' },
  { simplified: '出去', pinyin: 'chūqù' },
  { simplified: '条', pinyin: 'tiáo' },
  { simplified: '船', pinyin: 'chuán' },
  { simplified: '上海', pinyin: 'Shànghǎi' },
  { simplified: '零下', pinyin: 'língxià' },
  { simplified: '度', pinyin: 'dù' },
  { simplified: '第一次', pinyin: 'dì-yīcì' },
  { simplified: '这儿', pinyin: 'zhèr' },
  { simplified: '有意思', pinyin: 'yǒuyìsi' },
  { simplified: '小猫', pinyin: 'xiǎomāo' },
  { simplified: '后面', pinyin: 'hòumiàn' },
  { simplified: '玩儿', pinyin: 'wánr' },
  { simplified: '刘', pinyin: 'Liú' },
  { simplified: '杨', pinyin: 'Yáng' },
  { simplified: '刘杨', pinyin: 'Liú Yáng' },
  { simplified: '杨笑笑', pinyin: 'Yáng Xiàoxiao' },
  { simplified: '同学们', pinyin: 'tóngxuémen' },
  { simplified: '里面', pinyin: 'lǐmiàn' },
  { simplified: '回来', pinyin: 'huílai' },
  { simplified: '二十', pinyin: 'èrshí' },
  { simplified: '分钟后', pinyin: 'fēnzhōnghòu' },
  { simplified: '快点儿', pinyin: 'kuàidiǎnr' },
  { simplified: '这个', pinyin: 'zhège' },
  { simplified: '那个', pinyin: 'nàge' },
  { simplified: '第一天', pinyin: 'dì-yītiān' },
  { simplified: '房子', pinyin: 'fángzi' },
  { simplified: '这样', pinyin: 'zhèyàng' },
  { simplified: '一会儿', pinyin: 'yíhuìr' },
  { simplified: '只', pinyin: 'zhī' },
  { simplified: '火车', pinyin: 'huǒchē' },
  { simplified: '坐飞机', pinyin: 'zuòfēijī' },
  { simplified: '电影票', pinyin: 'diànyǐngpiào' },
  { simplified: '二十五', pinyin: 'èrshíwǔ' },
  { simplified: '真的', pinyin: 'zhēnde' },
  { simplified: '自行车', pinyin: 'zìxíngchē' },
  { simplified: '白色', pinyin: 'báisè' },
  { simplified: '辆', pinyin: 'liàng' },
  { simplified: '三百', pinyin: 'sānbǎi' },
  { simplified: '元', pinyin: 'yuán' },
  { simplified: '一些', pinyin: 'yìxiē' },
  { simplified: '向前', pinyin: 'xiàngqián' },
  { simplified: '前', pinyin: 'qián' },
  { simplified: '新年', pinyin: 'xīnnián' },
  { simplified: '等一下', pinyin: 'děngyíxià' },
  { simplified: '问问', pinyin: 'wènwen' },
  { simplified: '听说', pinyin: 'tīngshuō' },
  { simplified: '回答', pinyin: 'huídá' },
  { simplified: '给您', pinyin: 'gěinín' },
  { simplified: '李先生', pinyin: 'Lǐ xiānsheng' },
  { simplified: '汉字', pinyin: 'Hànzì' },
  { simplified: '下水', pinyin: 'xiàshuǐ' },
  { simplified: '几千', pinyin: 'jǐqiān' },
  { simplified: '没有', pinyin: 'méiyǒu' },
  { simplified: '九百', pinyin: 'jiǔbǎi' },
  { simplified: '块钱', pinyin: 'kuàiqián' },
  { simplified: '过得', pinyin: 'guòde' },
  { simplified: '五岁', pinyin: 'wǔsuì' },
  { simplified: '七月', pinyin: 'qīyuè' },
  { simplified: '十二', pinyin: 'shíèr' },
  { simplified: '十二日', pinyin: 'shí'èrrì' },
  { simplified: '台', pinyin: 'tái' },
  { simplified: '零七分', pinyin: 'língqīfēn' },
  { simplified: '路上', pinyin: 'lùshang' },
  { simplified: '朋友们', pinyin: 'péngyoumen' },
  { simplified: '外面', pinyin: 'wàimiàn' },
  { simplified: '一晚上', pinyin: 'yíwǎnshang' },
  { simplified: '出租车', pinyin: 'chūzūchē' },
  { simplified: '小狗', pinyin: 'xiǎogǒu' },
  { simplified: '怎么了', pinyin: 'zěnmele' },
  { simplified: '新来的', pinyin: 'xīnláide' },
  { simplified: '汉语', pinyin: 'Hànyǔ' },
  { simplified: '开门', pinyin: 'kāimén' },
  { simplified: '笑着', pinyin: 'xiàozhe' },
  { simplified: '说的话', pinyin: 'shuōdehuà' },
  { simplified: '话', pinyin: 'huà' },
  { simplified: '可能', pinyin: 'kěnéng' },
  { simplified: '王', pinyin: 'Wáng' },
  { simplified: '李', pinyin: 'Lǐ' },
  { simplified: '星期六', pinyin: 'xīngqīliù' },
  { simplified: '每个', pinyin: 'měige' },
  { simplified: '打篮球', pinyin: 'dǎlánqiú' },
  { simplified: '篮球', pinyin: 'lánqiú' },
  { simplified: '天晴', pinyin: 'tiānqíng' },
  { simplified: '下雪', pinyin: 'xiàxuě' },
  { simplified: '看看', pinyin: 'kànkan' },
  { simplified: '生病', pinyin: 'shēngbìng' },
  { simplified: '病了', pinyin: 'bìngle' },
  { simplified: '漂亮', pinyin: 'piàoliang' },
  { simplified: '高兴', pinyin: 'gāoxìng' },
  { simplified: '认识', pinyin: 'rènshi' },
  { simplified: '客气', pinyin: 'kèqi' },
  { simplified: '不客气', pinyin: 'búkèqi' },
]
for (const e of EXTRA) {
  if (!hskMap.has(e.simplified)) hskMap.set(e.simplified, e)
}

const rows = []
const errors = []
for (const [chinese, pinyin, english] of SENTENCES) {
  const norm = chinese.replace(/'/g, "'").replace(/'/g, "'")
  const py = pinyin.replace(/'/g, "'").replace(/'/g, "'")
  try {
    rows.push(buildRow(norm, py, english, hskMap))
  } catch (err) {
    errors.push({ chinese: norm, err: String(err?.message ?? err) })
  }
}

if (errors.length) {
  console.error('Failed to build some rows:')
  for (const e of errors) console.error(`  ${e.chinese}: ${e.err}`)
  process.exit(1)
}

const outPath = path.join(dataDir, 'sentences_hsk2.json')
fs.writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
console.log(`Wrote ${rows.length} sentences to ${outPath}`)
