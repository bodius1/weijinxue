/**
 * Build src/data/sentences_hsk1.json from HSK 1 sample-test style sentences.
 * Run: node scripts/build-hsk1-sample-sentences.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')

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

/** @param {string} marked */
function splitMarkedSyllables(marked) {
  return String(marked ?? '')
    .match(MARKED_SYLLABLE_RE)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? []
}

/** @param {string} syl */
function markedSyllableToNumbered(syl) {
  let tone = 5
  let body = ''
  for (const ch of syl) {
    const t = TONE_FROM_MARK.get(ch)
    if (t != null) {
      tone = t
      body += BASE_VOWEL.get(ch) ?? ch
    } else {
      body += ch.toLowerCase()
    }
  }
  body = body.replace(/ü/g, 'v')
  return tone === 5 ? body : `${body}${tone}`
}

/** @param {string} marked */
function markedToNumberedList(marked) {
  return splitMarkedSyllables(marked).map(markedSyllableToNumbered)
}

/** @param {string} text @param {string[]} vocab */
function tokenizeHan(text, vocab) {
  const words = [...vocab].sort((a, b) => b.length - a.length)
  /** @type {string[]} */
  const tokens = []
  for (let i = 0; i < text.length; ) {
    const ch = text[i]
    if (!/[\u4e00-\u9fff]/u.test(ch)) {
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

/** @param {string} token @param {Map<string, { pinyin: string }>} hskMap */
function perCharPyFromHsk(token, hskMap) {
  const entry = hskMap.get(token)
  if (!entry) return null
  const chars = [...token]
  const sylls = markedToNumberedList(entry.pinyin)
  if (sylls.length === chars.length) return sylls
  if (chars.length === 1 && sylls.length >= 1) return [sylls.join('').replace(/[1-5]$/g, '') + (sylls[0].match(/[1-5]$/)?.[0] ?? '5')]
  return null
}

/**
 * @param {string} chinese
 * @param {string} markedPinyin
 * @param {Map<string, { pinyin: string }>} hskMap
 */
function buildRow(chinese, markedPinyin, english) {
  const vocab = [...hskMap.keys()]
  const tokens = tokenizeHan(chinese, vocab)
  const pyGroups = markedPinyin
    .replace(/[!.?,，。！？、；：]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  /** @type {string[]} */
  const pyParts = []
  let gi = 0
  for (const token of tokens) {
    const group = pyGroups[gi] ?? ''
    gi += 1
    const fromHsk = perCharPyFromHsk(token, hskMap)
    if (fromHsk) {
      pyParts.push(...fromHsk)
      continue
    }
    const sylls = markedToNumberedList(group)
    const chars = [...token]
    if (sylls.length === chars.length) {
      pyParts.push(...sylls)
    } else if (chars.length === 1) {
      pyParts.push(sylls[0] ?? markedSyllableToNumbered(group))
    } else {
      throw new Error(`Cannot align "${token}" / "${group}" in: ${chinese}`)
    }
  }

  const hanChars = [...chinese].filter((c) => /[\u4e00-\u9fff]/u.test(c))
  if (hanChars.length !== pyParts.length) {
    throw new Error(`Han/py mismatch (${hanChars.length} vs ${pyParts.length}): ${chinese}`)
  }

  return {
    chinese,
    english,
    pinyin: markedPinyin.replace(/\s+/g, ' ').trim(),
    parts: hanChars.join('|'),
    py: pyParts.join('|'),
  }
}

const hsk1 = JSON.parse(fs.readFileSync(path.join(dataDir, 'hsk1.json'), 'utf8'))
/** @type {Map<string, { pinyin: string }>} */
const hskMap = new Map(hsk1.map((e) => [e.simplified, e]))

/** [chinese, markedPinyin, english] */
const SENTENCES = [
  ['你好！很高兴认识你。', 'Nǐ hǎo! Hěn gāoxìng rènshi nǐ.', 'Hello! Nice to meet you.'],
  ['下午我去商店买水果。', 'Xiàwǔ wǒ qù shāngdiàn mǎi shuǐguǒ.', 'This afternoon I am going to the store to buy fruit.'],
  ['她下午去学校。', 'Tā xiàwǔ qù xuéxiào.', 'She is going to school this afternoon.'],
  ['桌子上有一个杯子。', 'Zhuōzi shang yǒu yí ge bēizi.', 'There is a cup on the table.'],
  ['椅子上没有书。', 'Yǐzi shang méiyǒu shū.', 'There is no book on the chair.'],
  ['电脑在桌子后面。', 'Diànnǎo zài zhuōzi hòumiàn.', 'The computer is behind the desk.'],
  ['我家有一只猫。', 'Wǒ jiā yǒu yì zhī māo.', 'My family has a cat.'],
  ['他家有一只狗。', 'Tā jiā yǒu yì zhī gǒu.', 'His family has a dog.'],
  ['我喜欢猫和狗。', 'Wǒ xǐhuan māo hé gǒu.', 'I like cats and dogs.'],
  ['我今年二十岁。', 'Wǒ jīnnián èrshí suì.', 'I am twenty years old this year.'],
  ['他女儿八岁。', 'Tā nǚ’ér bā suì.', 'His daughter is eight years old.'],
  ['李老师在打电话。', 'Lǐ lǎoshī zài dǎ diànhuà.', 'Teacher Li is on the phone.'],
  ['家里有很多苹果。', 'Jiā lǐ yǒu hěn duō píngguǒ.', 'There are many apples at home.'],
  ['我们去前面的饭店吃饭，怎么样？', 'Wǒmen qù qiánmiàn de fàndiàn chī fàn, zěnmeyàng?', 'Shall we eat at the restaurant up ahead?'],
  ['我和妈妈都喜欢看电影。', 'Wǒ hé māma dōu xǐhuan kàn diànyǐng.', 'My mom and I both like watching movies.'],
  ['不客气，请坐。', 'Bú kèqi, qǐng zuò.', "You're welcome. Please sit down."],
  ['哪个是你的同学？', 'Nǎge shì nǐ de tóngxué?', 'Which one is your classmate?'],
  ['你的汉语怎么样？', 'Nǐ de Hànyǔ zěnmeyàng?', 'How is your Chinese?'],
  ['我会说一点儿汉语。', 'Wǒ huì shuō yìdiǎnr Hànyǔ.', 'I can speak a little Chinese.'],
  ['你看见王小姐了吗？', 'Nǐ kànjiàn Wáng xiǎojiě le ma?', 'Did you see Miss Wang?'],
  ['我没看见她。', 'Wǒ méi kànjiàn tā.', "I didn't see her."],
  ['对不起，他们是谁？', 'Duìbuqǐ, tāmen shì shéi?', 'Sorry, who are they?'],
  ['他们是我爸爸妈妈。', 'Tāmen shì wǒ bàba māma.', 'They are my father and mother.'],
  ['你现在住在哪儿？', 'Nǐ xiànzài zhù zài nǎr?', 'Where do you live now?'],
  ['我住在学校里。', 'Wǒ zhù zài xuéxiào lǐ.', 'I live at school.'],
  ['中国人喜欢喝茶。', 'Zhōngguórén xǐhuan hē chá.', 'Chinese people like drinking tea.'],
  ['中午你买什么东西了？', 'Zhōngwǔ nǐ mǎi shénme dōngxi le?', 'What did you buy at noon?'],
  ['他少写了一个字。', 'Tā shǎo xiě le yí ge zì.', 'He wrote one character too few.'],
  ['你开车几年了？', 'Nǐ kāi chē jǐ nián le?', 'How many years have you been driving?'],
  ['我开车六年了。', 'Wǒ kāi chē liù nián le.', 'I have been driving for six years.'],
  ['昨天北京天气很冷。', 'Zuótiān Běijīng tiānqì hěn lěng.', 'Yesterday the weather in Beijing was very cold.'],
  ['今天太热了。', 'Jīntiān tài rè le.', 'Today is too hot.'],
  ['你好，我能吃一块儿吗？', 'Nǐ hǎo, wǒ néng chī yí kuàir ma?', 'Hello, can I have a piece?'],
  ['他们在买衣服呢。', 'Tāmen zài mǎi yīfu ne.', 'They are buying clothes.'],
  ['天气很热，多喝水。', 'Tiānqì hěn rè, duō hē shuǐ.', 'The weather is hot; drink more water.'],
  ['来，我们看看里面有什么。', 'Lái, wǒmen kànkan lǐmiàn yǒu shénme.', "Come on, let's see what's inside."],
  ['喂，你睡觉了吗？', 'Wéi, nǐ shuìjiào le ma?', 'Hello, are you asleep?'],
  ['那个人是谁？', 'Nàge rén shì shéi?', 'Who is that person?'],
  ['我不认识那个人。', 'Wǒ bú rènshi nàge rén.', "I don't know that person."],
  ['你的同学在哪儿工作？', 'Nǐ de tóngxué zài nǎr gōngzuò?', 'Where does your classmate work?'],
  ['他在医院工作。', 'Tā zài yīyuàn gōngzuò.', 'He works at the hospital.'],
  ['昨天上午下雨了。', 'Zuótiān shàngwǔ xià yǔ le.', 'It rained yesterday morning.'],
  ['爸爸什么时候来北京？', 'Bàba shénme shíhou lái Běijīng?', 'When is Dad coming to Beijing?'],
  ['他下个月来北京。', 'Tā xià ge yuè lái Běijīng.', 'He is coming to Beijing next month.'],
  ['昨天是八月十九日。', 'Zuótiān shì bā yuè shíjiǔ rì.', 'Yesterday was August 19th.'],
  ['那个饭店在火车站前面。', 'Nàge fàndiàn zài huǒchēzhàn qiánmiàn.', 'That restaurant is in front of the train station.'],
  ['你会说汉语吗？', 'Nǐ huì shuō Hànyǔ ma?', 'Can you speak Chinese?'],
  ['王先生在吗？', 'Wáng xiānsheng zài ma?', 'Is Mr. Wang in?'],
  ['他在，请坐。', 'Tā zài, qǐng zuò.', "He's here. Please sit down."],
  ['对不起，我不会做饭。', 'Duìbuqǐ, wǒ bú huì zuò fàn.', "Sorry, I can't cook."],
  ['没关系，我会做饭。', 'Méi guānxi, wǒ huì zuò fàn.', "It's okay, I can cook."],
  ['这个杯子多少钱？', 'Zhège bēizi duōshao qián?', 'How much is this cup?'],
  ['这个苹果八块钱。', 'Zhège píngguǒ bā kuài qián.', 'This apple is eight yuan.'],
  ['我今天在朋友家吃饭。', 'Wǒ jīntiān zài péngyou jiā chī fàn.', "I'm eating at a friend's house today."],
  ['他在家里看电视。', 'Tā zài jiā lǐ kàn diànshì.', 'He is watching TV at home.'],
  ['星期五我们去学校。', 'Xīngqīwǔ wǒmen qù xuéxiào.', 'On Friday we go to school.'],
  ['星期六我想看电影。', 'Xīngqīliù wǒ xiǎng kàn diànyǐng.', 'On Saturday I want to watch a movie.'],
  ['我们坐火车去北京。', 'Wǒmen zuò huǒchē qù Běijīng.', 'We take the train to Beijing.'],
  ['他坐飞机来中国。', 'Tā zuò fēijī lái Zhōngguó.', 'He takes a plane to China.'],
  ['我想回家。', 'Wǒ xiǎng huí jiā.', 'I want to go home.'],
  ['这本书是我的。', 'Zhè běn shū shì wǒ de.', 'This book is mine.'],
  ['那个杯子是他的。', 'Nàge bēizi shì tā de.', 'That cup is his.'],
  ['今天星期三。', 'Jīntiān xīngqīsān.', 'Today is Wednesday.'],
  ['我有十五个苹果。', 'Wǒ yǒu shíwǔ ge píngguǒ.', 'I have fifteen apples.'],
  ['她很漂亮。', 'Tā hěn piàoliang.', 'She is very beautiful.'],
  ['他很爱学习。', 'Tā hěn ài xuéxí.', 'He really loves studying.'],
  ['我想买茶。', 'Wǒ xiǎng mǎi chá.', 'I want to buy tea.'],
  ['你叫什么名字？', 'Nǐ jiào shénme míngzi?', 'What is your name?'],
  ['我叫王明。', 'Wǒ jiào Wáng Míng.', 'My name is Wang Ming.'],
  ['这是我的老师。', 'Zhè shì wǒ de lǎoshī.', 'This is my teacher.'],
]

// Extra HSK1 tokens used in sentences but missing as standalone entries
const EXTRA = [
  { simplified: '你好', pinyin: 'nǐhǎo' },
  { simplified: '没有', pinyin: 'méiyǒu' },
  { simplified: '吃饭', pinyin: 'chīfàn' },
  { simplified: '饭', pinyin: 'fàn' },
  { simplified: '桌子', pinyin: 'zhuōzi' },
  { simplified: '椅子', pinyin: 'yǐzi' },
  { simplified: '里面', pinyin: 'lǐmiàn' },
  { simplified: '看看', pinyin: 'kànkan' },
  { simplified: '火车站', pinyin: 'huǒchēzhàn' },
  { simplified: '火车', pinyin: 'huǒchē' },
  { simplified: '汽车', pinyin: 'qìchē' },
  { simplified: '车', pinyin: 'chē' },
  { simplified: '只', pinyin: 'zhī' },
  { simplified: '支', pinyin: 'zhī' },
  { simplified: '日', pinyin: 'rì' },
  { simplified: '十九', pinyin: 'shíjiǔ' },
  { simplified: '十五', pinyin: 'shíwǔ' },
  { simplified: '二十', pinyin: 'èrshí' },
  { simplified: '客气', pinyin: 'kèqi' },
  { simplified: '哪个', pinyin: 'nǎge' },
  { simplified: '那个', pinyin: 'nàge' },
  { simplified: '这个', pinyin: 'zhège' },
  { simplified: '他们', pinyin: 'tāmen' },
  { simplified: '我们', pinyin: 'wǒmen' },
  { simplified: '中国人', pinyin: 'Zhōngguórén' },
  { simplified: '下雨', pinyin: 'xiàyǔ' },
  { simplified: '雨', pinyin: 'yǔ' },
  { simplified: '一块儿', pinyin: 'yíkuàir' },
  { simplified: '块钱', pinyin: 'kuàiqián' },
  { simplified: '星期五', pinyin: 'xīngqīwǔ' },
  { simplified: '星期六', pinyin: 'xīngqīliù' },
  { simplified: '星期三', pinyin: 'xīngqīsān' },
  { simplified: '八月', pinyin: 'bāyuè' },
  { simplified: '李', pinyin: 'Lǐ' },
  { simplified: '王', pinyin: 'Wáng' },
  { simplified: '明', pinyin: 'Míng' },
  { simplified: '王明', pinyin: 'Wáng Míng' },
]
for (const e of EXTRA) {
  if (!hskMap.has(e.simplified)) hskMap.set(e.simplified, e)
}

const rows = []
for (const [chinese, pinyin, english] of SENTENCES) {
  const norm = chinese.replace(/’/g, "'")
  rows.push(buildRow(norm, pinyin.replace(/’/g, "'"), english))
}

const outPath = path.join(dataDir, 'sentences_hsk1.json')
fs.writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
console.log(`Wrote ${rows.length} sentences to ${outPath}`)
