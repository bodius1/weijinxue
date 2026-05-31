/* Build sentences_hsk2.json — run: npm run gen:sentences-hsk2 */
const fs = require('fs')
const path = require('path')

const TONE_FROM_MARK = new Map([
  ['ā', 1], ['á', 2], ['ǎ', 3], ['à', 4],
  ['ē', 1], ['é', 2], ['ě', 3], ['è', 4],
  ['ī', 1], ['í', 2], ['ǐ', 3], ['ì', 4],
  ['ō', 1], ['ó', 2], ['ǒ', 3], ['ò', 4],
  ['ū', 1], ['ú', 2], ['ǔ', 3], ['ù', 4],
  ['ǖ', 1], ['ǘ', 2], ['ǚ', 3], ['ǜ', 4],
])
const BASE_VOWEL = new Map([
  ['ā', 'a'], ['á', 'a'], ['ǎ', 'a'], ['à', 'a'],
  ['ē', 'e'], ['é', 'e'], ['ě', 'e'], ['è', 'e'],
  ['ī', 'i'], ['í', 'i'], ['ǐ', 'i'], ['ì', 'i'],
  ['ō', 'o'], ['ó', 'o'], ['ǒ', 'o'], ['ò', 'o'],
  ['ū', 'u'], ['ú', 'u'], ['ǔ', 'u'], ['ù', 'u'],
  ['ǖ', 'ü'], ['ǘ', 'ü'], ['ǚ', 'ü'], ['ǜ', 'ü'],
])
const MARKED_SYLLABLE_RE =
  /[bpmfdtnlgkhjqxrzcsyw]?(?:(?:[aeiouüv]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][aeiouüv]*)|(?:[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+))(?:ng|n)?/gi

function markedSyllableToNumbered(syl) {
  let tone = 5
  let body = ''
  for (const ch of syl) {
    const t = TONE_FROM_MARK.get(ch)
    if (t != null) {
      tone = t
      body += BASE_VOWEL.get(ch) ?? ch
    } else body += ch.toLowerCase()
  }
  body = body.replace(/ü/g, 'v')
  return tone === 5 ? body : body + tone
}

function splitMarkedSyllables(marked) {
  return (String(marked).match(MARKED_SYLLABLE_RE) || []).map((s) => s.trim()).filter(Boolean)
}

function markedToNumberedList(marked) {
  return splitMarkedSyllables(marked).map(markedSyllableToNumbered)
}

function tokenizeHan(text, vocab) {
  const words = [...vocab].sort((a, b) => b.length - a.length)
  const tokens = []
  for (let i = 0; i < text.length; ) {
    const ch = text[i]
    if (!/[\u4e00-\u9fff]/.test(ch)) {
      i += 1
      continue
    }
    let matched = ''
    for (const w of words) {
      if (text.startsWith(w, i)) {
        matched = w
        break
      }
    }
    if (matched) {
      tokens.push(matched)
      i += matched.length
    } else {
      tokens.push(ch)
      i += 1
    }
  }
  return tokens
}

function perCharPyFromEntry(token, entry) {
  const chars = [...token]
  const sylls = markedToNumberedList(entry.pinyin)
  if (sylls.length === chars.length) return sylls
  if (chars.length === 1 && sylls.length >= 1) {
    const tone = sylls[0].match(/[1-5]$/)?.[0] ?? '5'
    return [sylls.map((s) => s.replace(/[1-5]$/, '')).join('') + tone]
  }
  return null
}

function buildRow(chinese, markedPinyin, english, vocabMap) {
  const hanChars = [...chinese].filter((c) => /[\u4e00-\u9fff]/.test(c))
  const vocab = [...vocabMap.keys()]
  const tokens = tokenizeHan(chinese, vocab)
  const pyGroups = markedPinyin
    .replace(/[“”"':]/g, ' ')
    .replace(/[!.?,，。！？、；：]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const pyParts = []
  let gi = 0
  for (const token of tokens) {
    const group = pyGroups[gi] ?? ''
    gi += 1
    const fromVocab = vocabMap.has(token) ? perCharPyFromEntry(token, vocabMap.get(token)) : null
    if (fromVocab) {
      pyParts.push(...fromVocab)
      continue
    }
    const sylls = markedToNumberedList(group)
    const chars = [...token]
    if (sylls.length === chars.length) pyParts.push(...sylls)
    else if (chars.length === 1) pyParts.push(sylls[0] ?? markedSyllableToNumbered(group))
    else throw new Error(`Cannot align "${token}" / "${group}" in: ${chinese}`)
  }

  if (hanChars.length !== pyParts.length) {
    const flat = markedToNumberedList(
      markedPinyin.replace(/[“”"':]/g, ' ').replace(/[!.?,，。！？、；：]/g, ' '),
    )
    if (flat.length === hanChars.length) {
      pyParts.length = 0
      pyParts.push(...flat)
    } else {
      throw new Error(`Mismatch ${hanChars.length} vs ${pyParts.length} (flat ${flat.length}): ${chinese}`)
    }
  }

  return {
    chinese,
    english,
    pinyin: markedPinyin.replace(/\s+/g, ' ').trim(),
    parts: hanChars.join('|'),
    py: pyParts.join('|'),
  }
}

function loadSentences() {
  const src = fs.readFileSync(path.join(__dirname, 'data', 'hsk2-sample-sentences.mjs'), 'utf8')
  const body = src
    .replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
    .replace('export const SENTENCES =', 'const SENTENCES =')
  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return SENTENCES`)()
}

const dataDir = path.join(__dirname, '..', 'src', 'data')
const vocabMap = new Map()
for (const name of ['hsk1.json', 'hsk2.json']) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))) {
    vocabMap.set(entry.simplified, entry)
  }
}
const EXTRA = [
  ['雨', 'yǔ'], ['停', 'tíng'], ['欢迎', 'huānyíng'], ['女朋友', 'nǚpéngyou'], ['部', 'bù'],
  ['这些', 'zhèxiē'], ['斤', 'jīn'], ['把', 'bǎ'], ['杯', 'bēi'], ['热', 'rè'],
  ['一百', 'yìbǎi'], ['饭', 'fàn'], ['桌子', 'zhuōzi'], ['椅子', 'yǐzi'], ['出去', 'chūqù'],
  ['条', 'tiáo'], ['船', 'chuán'], ['上海', 'Shànghǎi'], ['零下', 'língxià'], ['度', 'dù'],
  ['第一次', 'dìyīcì'], ['这儿', 'zhèr'], ['有意思', 'yǒuyìsi'], ['小猫', 'xiǎomāo'],
  ['后面', 'hòumiàn'], ['玩儿', 'wánr'], ['刘', 'Liú'], ['杨', 'Yáng'], ['刘杨', 'Liú Yáng'],
  ['杨笑笑', 'Yáng Xiàoxiao'], ['同学们', 'tóngxuémen'], ['里面', 'lǐmiàn'], ['回来', 'huílai'],
  ['二十', 'èrshí'], ['这个', 'zhège'], ['那个', 'nàge'], ['房子', 'fángzi'], ['这样', 'zhèyàng'],
  ['一会儿', 'yíhuìr'], ['只', 'zhī'], ['火车', 'huǒchē'], ['电影票', 'diànyǐngpiào'],
  ['真的', 'zhēnde'], ['自行车', 'zìxíngchē'], ['白色', 'báisè'], ['辆', 'liàng'],
  ['三百', 'sānbǎi'], ['元', 'yuán'], ['一些', 'yìxiē'], ['向前', 'xiàngqián'], ['前', 'qián'],
  ['新年', 'xīnnián'], ['等一下', 'děngyíxià'], ['问问', 'wènwen'], ['听说', 'tīngshuō'],
  ['回答', 'huídá'], ['汉字', 'Hànzì'], ['下水', 'xiàshuǐ'], ['没有', 'méiyǒu'], ['九百', 'jiǔbǎi'],
  ['块钱', 'kuàiqián'], ['过得', 'guòde'], ['台', 'tái'], ['路上', 'lùshang'],
  ['朋友们', 'péngyoumen'], ['外面', 'wàimiàn'], ['一晚上', 'yíwǎnshang'], ['出租车', 'chūzūchē'],
  ['小狗', 'xiǎogǒu'], ['怎么了', 'zěnmele'], ['新来的', 'xīnláide'], ['汉语', 'Hànyǔ'],
  ['开门', 'kāimén'], ['话', 'huà'], ['王', 'Wáng'], ['李', 'Lǐ'], ['每个', 'měige'],
  ['打篮球', 'dǎlánqiú'], ['看看', 'kànkan'], ['病了', 'bìngle'], ['漂亮', 'piàoliang'],
  ['高兴', 'gāoxìng'], ['认识', 'rènshi'], ['客气', 'kèqi'], ['不客气', 'búkèqi'],
  ['他们', 'tāmen'], ['我们', 'wǒmen'], ['没有', 'méiyǒu'], ['飞机', 'fēijī'], ['汽车', 'qìchē'],
  ['车', 'chē'], ['睡觉', 'shuìjiào'], ['打电话', 'dǎdiànhuà'], ['星期', 'xīngqī'],
  ['星期六', 'xīngqīliù'], ['星期五', 'xīngqīwǔ'], ['星期三', 'xīngqīsān'], ['星期一', 'xīngqīyī'],
  ['北京', 'Běijīng'], ['中国', 'Zhōngguó'], ['商店', 'shāngdiàn'], ['学校', 'xuéxiào'],
  ['老师', 'lǎoshī'], ['同学', 'tóngxué'], ['朋友', 'péngyǒu'], ['妈妈', 'māma'], ['爸爸', 'bàba'],
  ['苹果', 'píngguǒ'], ['水果', 'shuǐguǒ'], ['东西', 'dōngxi'], ['电脑', 'diànnǎo'], ['电视', 'diànshì'],
  ['电影', 'diànyǐng'], ['天气', 'tiānqì'], ['高兴', 'gāoxìng'], ['学习', 'xuéxí'], ['工作', 'gōngzuò'],
  ['喜欢', 'xǐhuan'], ['看见', 'kànjiàn'], ['知道', 'zhīdao'], ['时候', 'shíhou'], ['今天', 'jīntiān'],
  ['明天', 'míngtiān'], ['昨天', 'zuótiān'], ['现在', 'xiànzài'], ['上午', 'shàngwǔ'], ['下午', 'xiàwǔ'],
  ['晚上', 'wǎnshang'], ['分钟', 'fēnzhōng'], ['小时', 'xiǎoshí'], ['年', 'nián'], ['月', 'yuè'],
  ['日', 'rì'], ['号', 'hào'], ['点', 'diǎn'], ['岁', 'suì'], ['多', 'duō'], ['少', 'shǎo'],
  ['很', 'hěn'], ['太', 'tài'], ['都', 'dōu'], ['也', 'yě'], ['还', 'hái'], ['再', 'zài'], ['就', 'jiù'],
  ['因为', 'yīnwèi'], ['所以', 'suǒyǐ'], ['但是', 'dànshì'], ['虽然', 'suīrán'], ['一起', 'yìqǐ'],
  ['已经', 'yǐjīng'], ['正在', 'zhèngzài'], ['可能', 'kěnéng'], ['可以', 'kěyǐ'], ['要', 'yào'],
  ['会', 'huì'], ['能', 'néng'], ['想', 'xiǎng'], ['爱', 'ài'], ['买', 'mǎi'], ['卖', 'mài'],
  ['吃', 'chī'], ['喝', 'hē'], ['看', 'kàn'], ['听', 'tīng'], ['说', 'shuō'], ['读', 'dú'],
  ['写', 'xiě'], ['坐', 'zuò'], ['住', 'zhù'], ['来', 'lái'], ['去', 'qù'], ['回', 'huí'],
  ['开', 'kāi'], ['走', 'zǒu'], ['进', 'jìn'], ['出', 'chū'], ['给', 'gěi'], ['找', 'zhǎo'],
  ['等', 'děng'], ['送', 'sòng'], ['玩', 'wán'], ['完', 'wán'], ['做', 'zuò'], ['帮', 'bāng'],
  ['帮助', 'bāngzhù'], ['准备', 'zhǔnbèi'], ['开始', 'kāishǐ'], ['介绍', 'jièshào'], ['休息', 'xiūxi'],
  ['生病', 'shēngbìng'], ['游泳', 'yóuyǒng'], ['跑步', 'pǎobù'], ['跳舞', 'tiàowǔ'], ['旅游', 'lǚyóu'],
  ['下雨', 'xiàyǔ'], ['雪', 'xuě'], ['冷', 'lěng'], ['热', 'rè'], ['忙', 'máng'], ['累', 'lèi'],
  ['快', 'kuài'], ['慢', 'màn'], ['远', 'yuǎn'], ['近', 'jìn'], ['高', 'gāo'], ['大', 'dà'], ['小', 'xiǎo'],
  ['新', 'xīn'], ['贵', 'guì'], ['便宜', 'piányi'], ['好吃', 'hǎochī'], ['快乐', 'kuàilè'], ['错', 'cuò'],
  ['对', 'duì'], ['真', 'zhēn'], ['最', 'zuì'], ['非常', 'fēicháng'], ['比', 'bǐ'], ['从', 'cóng'],
  ['离', 'lí'], ['在', 'zài'], ['的', 'de'], ['了', 'le'], ['吗', 'ma'], ['呢', 'ne'], ['吧', 'ba'],
  ['过', 'guò'], ['着', 'zhe'], ['得', 'de'], ['别', 'bié'], ['不', 'bù'], ['没', 'méi'], ['和', 'hé'],
  ['是', 'shì'], ['有', 'yǒu'], ['我', 'wǒ'], ['你', 'nǐ'], ['他', 'tā'], ['她', 'tā'], ['它', 'tā'],
  ['您', 'nín'], ['我们', 'wǒmen'], ['你们', 'nǐmen'], ['他们', 'tāmen'], ['大家', 'dàjiā'], ['每', 'měi'],
  ['个', 'gè'], ['本', 'běn'], ['块', 'kuài'], ['件', 'jiàn'], ['两', 'liǎng'], ['百', 'bǎi'], ['千', 'qiān'],
  ['零', 'líng'], ['一', 'yī'], ['二', 'èr'], ['三', 'sān'], ['四', 'sì'], ['五', 'wǔ'], ['六', 'liù'],
  ['七', 'qī'], ['八', 'bā'], ['九', 'jiǔ'], ['十', 'shí'], ['第一', 'dìyī'], ['次', 'cì'], ['为什么', 'wèishénme'],
  ['怎么', 'zěnme'], ['什么', 'shénme'], ['谁', 'shéi'], ['哪儿', 'nǎr'], ['多少', 'duōshao'], ['几', 'jǐ'],
  ['名字', 'míngzi'], ['字', 'zì'], ['书', 'shū'], ['钱', 'qián'], ['水', 'shuǐ'], ['茶', 'chá'],
  ['咖啡', 'kāfēi'], ['菜', 'cài'], ['米饭', 'mǐfàn'], ['鸡蛋', 'jīdàn'], ['西瓜', 'xīguā'],
  ['药', 'yào'], ['手机', 'shǒujī'], ['手表', 'shǒubiǎo'], ['眼睛', 'yǎnjing'], ['门', 'mén'],
  ['题', 'tí'], ['考试', 'kǎoshì'], ['票', 'piào'], ['意思', 'yìsi'], ['房间', 'fángjiān'],
  ['公司', 'gōngsī'], ['火车站', 'huǒchēzhàn'], ['机场', 'jīchǎng'], ['路', 'lù'], ['旁边', 'pángbiān'],
  ['外', 'wài'], ['里', 'lǐ'], ['上', 'shàng'], ['下', 'xià'], ['生日', 'shēngrì'], ['时间', 'shíjiān'],
  ['丈夫', 'zhàngfu'], ['妻子', 'qīzi'], ['孩子', 'háizi'], ['女儿', 'nǚér'], ['儿子', 'érzi'],
  ['哥哥', 'gēge'], ['姐姐', 'jiějie'], ['弟弟', 'dìdi'], ['妹妹', 'mèimei'], ['男人', 'nánrén'],
  ['女人', 'nǚrén'], ['人', 'rén'], ['猫', 'māo'], ['狗', 'gǒu'], ['鱼', 'yú'], ['姓', 'xìng'],
  ['问题', 'wèntí'], ['事情', 'shìqing'], ['希望', 'xīwàng'], ['觉得', 'juéde'], ['告诉', 'gàosù'],
  ['问', 'wèn'], ['懂', 'dǒng'], ['笑', 'xiào'], ['穿', 'chuān'], ['洗', 'xǐ'], ['到', 'dào'],
  ['起床', 'qǐchuáng'], ['唱歌', 'chànggē'], ['运动', 'yùndòng'], ['上班', 'shàngbān'], ['晴', 'qíng'],
  ['阴', 'yīn'], ['红', 'hóng'], ['白', 'bái'], ['黑', 'hēi'], ['颜色', 'yánsè'], ['牛奶', 'niúnǎi'],
  ['羊肉', 'yángròu'], ['面条', 'miàntiáo'], ['报纸', 'bàozhǐ'], ['铅笔', 'qiānbǐ'], ['宾馆', 'bīngguǎn'],
  ['服务员', 'fúwùyuán'], ['公共汽车', 'gōnggòngqìchē'], ['说话', 'shuōhuà'], ['一下', 'yīxià'], ['去年', 'qùnián'],
  ['往', 'wǎng'], ['让', 'ràng'], ['踢足球', 'tīzúqiú'], ['身体', 'shēntǐ'], ['教室', 'jiàoshì'],
  ['左边', 'zuǒbiān'], ['右边', 'yòubiān'], ['课', 'kè'], ['先生', 'xiānsheng'], ['小姐', 'xiǎojiě'],
  ['医生', 'yīshēng'], ['医院', 'yīyuàn'], ['饭店', 'fàndiàn'], ['衣服', 'yīfu'], ['一点儿', 'yīdiǎnr'],
  ['怎么样', 'zěnmeyàng'], ['对不起', 'duìbùqǐ'], ['没关系', 'méiguānxì'], ['谢谢', 'xièxie'], ['再见', 'zàijiàn'],
  ['请', 'qǐng'], ['喂', 'wèi'], ['高兴', 'gāoxìng'], ['漂亮', 'piàoliang'], ['认识', 'rènshi'],
  ['见面', 'jiànmiàn'], ['面条', 'miàntiáo'],
]
for (const [s, p] of EXTRA) {
  if (!vocabMap.has(s)) vocabMap.set(s, { simplified: s, pinyin: p })
}

const SENTENCES = loadSentences()
const rows = []
const errors = []
for (const [c, p, e] of SENTENCES) {
  const chinese = c.replace(/\u2019/g, "'")
  const pinyin = p.replace(/\u2019/g, "'")
  try {
    rows.push(buildRow(chinese, pinyin, e, vocabMap))
  } catch (err) {
    errors.push({ chinese, message: err.message })
  }
}
if (errors.length) {
  console.error('Build errors:')
  for (const x of errors) console.error(`  ${x.chinese}\n    ${x.message}`)
  process.exit(1)
}
fs.writeFileSync(path.join(dataDir, 'sentences_hsk2.json'), JSON.stringify(rows, null, 2) + '\n')
console.log('Wrote', rows.length, 'sentences to src/data/sentences_hsk2.json')
