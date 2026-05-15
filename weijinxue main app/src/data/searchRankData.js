/**
 * IME-style ranking helpers (not a full HSK corpus — boosts common pedagogy targets).
 * Per-syllable lists: earlier = higher priority for that reading.
 */
export const SYLLABLE_PRIORITY = {
  ni: '你我妳呢尼泥逆拟腻匿霓昵坭倪铌溺您妮',
  wo: '我握卧沃涡蜗倭斡渥硪涴喔窝挝',
  ta: '他她它塔踏榻鳎铊塌沓獭挞蹋趿',
  shi: '是时事十实使式世示室试食史石始施湿诗师狮尸失匙',
  de: '的地得德底锝',
  bu: '不部布步捕怖卜簿埠醭钚哺卟',
  you: '有友又右由油游诱幼忧酉呦佑铀疣',
  he: '和何合河喝核盒贺荷赫褐涸禾阂盍',
  ma: '吗妈马嘛麻骂抹玛蟆蚂',
  men: '们门闷扪焖懑',
  shei: '谁',
  nv: '女钕',
  zhe: '这着者折哲浙辄鹧蔗锗',
  zai: '在再载灾栽宰哉崽',
  yao: '要药摇腰咬邀耀姚窑谣舀鹞',
  hui: '会回挥汇灰悔惠毁慧贿晦秽',
  neng: '能',
  kan: '看刊堪砍坎侃槛',
  dao: '到道倒刀岛盗导蹈祷稻',
  xiang: '想向像项象香乡箱详湘祥橡',
  jiu: '就九酒久救纠舅旧臼疚',
  ye: '也业夜叶页爷野液冶掖',
  ren: '人认任忍刃壬饪',
  le: '了乐勒肋仂叻泐鳓',
  ge: '个各合歌革阁格隔割葛蛤',
  zhi: '之只知直值制指纸支枝汁织',
  yu: '与于语雨玉育余遇预宇羽鱼',
  yi: '一以已意义议易医衣依移乙',
  er: '而二儿耳尔饵贰',
  san: '三散伞叁糁',
  zhong: '中种重众终钟忠仲',
  guo: '国过果锅裹馘',
  xue: '学雪血靴谑削穴',
  sheng: '生声省升胜圣牲笙甥',
  hao: '好号毫豪耗浩郝皓',
  mei: '没每美妹梅媒煤眉魅霉',
  lai: '来莱赖徕睐',
  qu: '去取区曲趣渠屈驱躯',
  shang: '上商伤尚裳晌',
  xia: '下夏吓峡狭霞瞎辖',
}

// Broader “HSK-like” pool: union of priority chars + common classroom / function words
const EXTRA_HSK_LIKE =
  '的一是不了在有人我他这中为个大上们来到说国和时要也出动吃地得都上对还好过子那就下看天行学时小么儿多己自好过开美日年月东西车辆飞机父母男女孩子老师大学问题工作没几万零等会能可以个么之没还样很最再被所从以于把让该请已经如果因为所以虽然但是然后'

export const HSK13_SET = new Set([
  ...EXTRA_HSK_LIKE,
  ...Object.values(SYLLABLE_PRIORITY).join(''),
])
