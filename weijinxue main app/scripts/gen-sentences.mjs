import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'src', 'data')

function out(name, rows) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(rows.slice(0, 50), null, 0))
}

const hsk1 = []
const p1 = [
  ['我爱你。', '我|爱|你', 'wo|ai|ni', 'I love you.'],
  ['你好吗？', '你|好|吗', 'ni|hao|ma', 'How are you?'],
  ['我很好。', '我|很|好', 'wo|hen|hao', 'I am very good.'],
  ['谢谢你。', '谢|谢|你', 'xie|xie|ni', 'Thank you.'],
  ['不客气。', '不|客|气', 'bu|ke|qi', "You're welcome."],
  ['再见！', '再|见', 'zai|jian', 'Goodbye!'],
  ['我是学生。', '我|是|学|生', 'wo|shi|xue|sheng', 'I am a student.'],
  ['他是老师。', '他|是|老|师', 'ta|shi|lao|shi', 'He is a teacher.'],
  ['我们吃饭。', '我|们|吃|饭', 'wo|men|chi|fan', 'We are eating.'],
  ['你喝水吗？', '你|喝|水|吗', 'ni|he|shui|ma', 'Do you drink water?'],
  ['我喜欢茶。', '我|喜|欢|茶', 'wo|xi|huan|cha', 'I like tea.'],
  ['今天很热。', '今|天|很|热', 'jin|tian|hen|re', 'Today is very hot.'],
  ['明天见。', '明|天|见', 'ming|tian|jian', 'See you tomorrow.'],
  ['现在几点？', '现|在|几|点', 'xian|zai|ji|dian', 'What time is it now?'],
  ['我不知道。', '我|不|知|道', 'wo|bu|zhi|dao', "I don't know."],
  ['请等一下。', '请|等|一|下', 'qing|deng|yi|xia', 'Please wait a moment.'],
  ['对不起。', '对|不|起', 'dui|bu|qi', 'Sorry.'],
  ['没关系。', '没|关|系', 'mei|guan|xi', "It's okay."],
  ['你叫什么名字？', '你|叫|什|么|名|字', 'ni|jiao|shen|me|ming|zi', 'What is your name?'],
  ['我叫小明。', '我|叫|小|明', 'wo|jiao|xiao|ming', 'My name is Xiaoming.'],
  ['你会说中文吗？', '你|会|说|中|文|吗', 'ni|hui|shuo|zhong|wen|ma', 'Do you speak Chinese?'],
  ['我会一点儿。', '我|会|一|点|儿', 'wo|hui|yi|dian|er', 'I speak a little.'],
  ['这个多少钱？', '这|个|多|少|钱', 'zhe|ge|duo|shao|qian', 'How much is this?'],
  ['太贵了。', '太|贵|了', 'tai|gui|le', "That's too expensive."],
  ['我要这个。', '我|要|这|个', 'wo|yao|zhe|ge', 'I want this one.'],
  ['不要那个。', '不|要|那|个', 'bu|yao|na|ge', "I don't want that one."],
  ['我们走吧。', '我|们|走|吧', 'wo|men|zou|ba', "Let's go."],
  ['我累了。', '我|累|了', 'wo|lei|le', "I'm tired."],
  ['晚安。', '晚|安', 'wan|an', 'Good night.'],
  ['早上好。', '早|上|好', 'zao|shang|hao', 'Good morning.'],
  ['你在哪儿？', '你|在|哪|儿', 'ni|zai|na|er', 'Where are you?'],
  ['我在家。', '我|在|家', 'wo|zai|jia', "I'm at home."],
  ['他在学校。', '他|在|学|校', 'ta|zai|xue|xiao', 'He is at school.'],
  ['她去商店。', '她|去|商|店', 'ta|qu|shang|dian', 'She went to the store.'],
  ['我们看电影。', '我|们|看|电|影', 'wo|men|kan|dian|ying', 'We are watching a movie.'],
  ['我喜欢音乐。', '我|喜|欢|音|乐', 'wo|xi|huan|yin|yue', 'I like music.'],
  ['你会唱歌吗？', '你|会|唱|歌|吗', 'ni|hui|chang|ge|ma', 'Can you sing?'],
  ['我不会跳舞。', '我|不|会|跳|舞', 'wo|bu|hui|tiao|wu', "I can't dance."],
  ['今天星期几？', '今|天|星|期|几', 'jin|tian|xing|qi|ji', 'What day is it today?'],
  ['今天星期一。', '今|天|星|期|一', 'jin|tian|xing|qi|yi', 'Today is Monday.'],
  ['昨天很忙。', '昨|天|很|忙', 'zuo|tian|hen|mang', 'Yesterday was busy.'],
  ['学习中文。', '学|习|中|文', 'xue|xi|zhong|wen', 'Study Chinese.'],
  ['听懂了。', '听|懂|了', 'ting|dong|le', 'I understood.'],
  ['请再说一遍。', '请|再|说|一|遍', 'qing|zai|shuo|yi|bian', 'Please say that again.'],
  ['我明白了。', '我|明|白|了', 'wo|ming|bai|le', 'I get it now.'],
  ['我不明白。', '我|不|明|白', 'wo|bu|ming|bai', "I don't understand."],
  ['请帮我。', '请|帮|我', 'qing|bang|wo', 'Please help me.'],
  ['我可以帮你。', '我|可|以|帮|你', 'wo|ke|yi|bang|ni', 'I can help you.'],
  ['谢谢你的帮助。', '谢|谢|你|的|帮|助', 'xie|xie|ni|de|bang|zhu', 'Thanks for your help.'],
]
for (const [c, parts, py, en] of p1) hsk1.push({ chinese: c, english: en, parts, py })
while (hsk1.length < 50) {
  const r = p1[hsk1.length % p1.length]
  hsk1.push({ chinese: r[0], english: `${r[3]}`, parts: r[1], py: r[2] })
}
out('sentences_hsk1.json', hsk1)

const hsk2 = []
const p2 = [
  ['我每天早上喝咖啡。', '我|每|天|早|上|喝|咖|啡', 'wo|mei|tian|zao|shang|he|ka|fei', 'I drink coffee every morning.'],
  ['他喜欢看书和听音乐。', '他|喜|欢|看|书|和|听|音|乐', 'ta|xi|huan|kan|shu|he|ting|yin|yue', 'He likes reading and listening to music.'],
  ['我们明天去北京旅游。', '我|们|明|天|去|北|京|旅|游', 'wo|men|ming|tian|qu|bei|jing|lv|you', 'We will travel to Beijing tomorrow.'],
  ['她昨天买了一件新衣服。', '她|昨|天|买|了|一|件|新|衣|服', 'ta|zuo|tian|mai|le|yi|jian|xin|yi|fu', 'She bought a new piece of clothing yesterday.'],
  ['周末我想和朋友一起打球。', '周|末|我|想|和|朋|友|一|起|打|球', 'zhou|mo|wo|xiang|he|peng|you|yi|qi|da|qiu', 'On the weekend I want to play ball with friends.'],
  ['饭馆的菜很好吃。', '饭|馆|的|菜|很|好|吃', 'fan|guan|de|cai|hen|hao|chi', 'The food at the restaurant is delicious.'],
  ['我学习中文已经两年了。', '我|学|习|中|文|已|经|两|年|了', 'wo|xue|xi|zhong|wen|yi|jing|liang|nian|le', 'I have been studying Chinese for two years.'],
  ['火车站离我家不远。', '火|车|站|离|我|家|不|远', 'huo|che|zhan|li|wo|jia|bu|yuan', 'The train station is not far from my home.'],
  ['请把窗户打开，太热了。', '请|把|窗|户|打|开|太|热|了', 'qing|ba|chuang|hu|kai|tai|re|le', 'Please open the window; it is too hot.'],
  ['他一边走路一边打电话。', '他|一|边|走|路|一|边|打|电|话', 'ta|yi|bian|zou|lu|yi|bian|da|dian|hua', 'He walks while talking on the phone.'],
]
for (const row of p2) hsk2.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
const p2b = [
  ['超市八点开门。', '超|市|八|点|开|门', 'chao|shi|ba|dian|kai|men', 'The supermarket opens at eight.'],
  ['我忘记带钥匙了。', '我|忘|记|带|钥|匙|了', 'wo|wang|ji|dai|yao|shi|le', 'I forgot to bring my keys.'],
  ['弟弟比妹妹高一点儿。', '弟|弟|比|妹|妹|高|一|点|儿', 'di|di|bi|mei|mei|gao|yi|dian|er', 'My younger brother is a bit taller than my sister.'],
  ['外面下雨了，带伞吧。', '外|面|下|雨|了|带|伞|吧', 'wai|mian|xia|yu|le|dai|san|ba', 'It is raining outside; take an umbrella.'],
  ['我打算明年换工作。', '我|打|算|明|年|换|工|作', 'wo|da|suan|ming|nian|huan|gong|zuo', 'I plan to change jobs next year.'],
  ['她做饭比妈妈还好吃。', '她|做|饭|比|妈|妈|还|好|吃', 'ta|zuo|fan|bi|ma|ma|hai|hao|chi', 'She cooks even better than Mom.'],
  ['飞机晚点了两个小时。', '飞|机|晚|点|了|两|个|小|时', 'fei|ji|wan|dian|le|liang|ge|xiao|shi', 'The plane was delayed two hours.'],
  ['我昨天在图书馆学习。', '我|昨|天|在|图|书|馆|学|习', 'wo|zuo|tian|zai|tu|shu|guan|xue|xi', 'I studied at the library yesterday.'],
  ['他们正在讨论旅行计划。', '他|们|正|在|讨|论|旅|行|计|划', 'ta|men|zheng|zai|tao|lun|lv|xing|ji|hua', 'They are discussing travel plans.'],
  ['这件衬衫有点儿大。', '这|件|衬|衫|有|点|儿|大', 'zhe|jian|chen|shan|you|dian|er|da', 'This shirt is a little big.'],
]
for (const row of p2b) hsk2.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
while (hsk2.length < 50) {
  const src = [...p2, ...p2b][hsk2.length % (p2.length + p2b.length)]
  hsk2.push({ chinese: src[0], english: src[3], parts: src[1], py: src[2] })
}
out('sentences_hsk2.json', hsk2)

const hsk3 = []
const p3 = [
  ['虽然下雨，我们还是去了公园散步。', '虽|然|下|雨|我|们|还|是|去|了|公|园|散|步', 'sui|ran|xia|yu|wo|men|hai|shi|qu|le|gong|yuan|san|bu', 'Although it rained, we still went for a walk in the park.'],
  ['他打算暑假回国看望父母。', '他|打|算|暑|假|回|国|看|望|父|母', 'ta|da|suan|shu|jia|hui|guo|kan|wang|fu|mu', 'He plans to return home during summer vacation to visit his parents.'],
  ['这道题比上次考试难多了。', '这|道|题|比|上|次|考|试|难|多|了', 'zhe|dao|ti|bi|shang|ci|kao|shi|nan|duo|le', 'This problem is much harder than last exam.'],
  ['她一边听音乐一边整理房间。', '她|一|边|听|音|乐|一|边|整|理|房|间', 'ta|yi|bian|ting|yin|yue|yi|bian|zheng|li|fang|jian', 'She listens to music while tidying the room.'],
  ['我们约好下午三点在咖啡馆见面。', '我|们|约|好|下|午|三|点|在|咖|啡|馆|见|面', 'wo|men|yue|hao|xia|wu|san|dian|zai|ka|fei|guan|jian|mian', 'We agreed to meet at the cafe at three in the afternoon.'],
]
for (const row of p3) hsk3.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
const p3b = [
  ['他因为生病所以没有去上班。', '他|因|为|生|病|所|以|没|有|去|上|班', 'ta|yin|wei|sheng|bing|suo|yi|mei|you|qu|shang|ban', 'He did not go to work because he was sick.'],
  ['我把护照放在行李箱里了。', '我|把|护|照|放|在|行|李|箱|里|了', 'wo|ba|hu|zhao|fang|zai|xing|li|xiang|li|le', 'I put my passport in the suitcase.'],
  ['服务员态度很好，我们很感动。', '服|务|员|态|度|很|好|我|们|很|感|动', 'fu|wu|yuan|tai|du|hen|hao|wo|men|hen|gan|dong', 'The server was very kind; we were moved.'],
  ['地铁二号线直达机场，很方便。', '地|铁|二|号|线|直|达|机|场|很|方|便', 'di|tie|er|hao|xian|zhi|da|ji|chang|hen|fang|bian', 'Metro line 2 goes straight to the airport; very convenient.'],
  ['她建议我们提前半小时出发。', '她|建|议|我|们|提|前|半|小|时|出|发', 'ta|jian|yi|wo|men|ti|qian|ban|xiao|shi|chu|fa', 'She suggested we leave half an hour early.'],
]
for (const row of p3b) hsk3.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
while (hsk3.length < 50) {
  const all = [...p3, ...p3b]
  const src = all[hsk3.length % all.length]
  hsk3.push({ chinese: src[0], english: src[3], parts: src[1], py: src[2] })
}
out('sentences_hsk3.json', hsk3)

const hsk4 = []
const p4 = [
  ['随着经济的发展，越来越多的年轻人选择在大城市工作和生活，但也面临着房租高涨和通勤时间长的压力。', '随|着|经|济|的|发|展|越|来|越|多|的|年|轻|人|选|择|在|大|城|市|工|作|和|生|活|但|也|面|临|着|房|租|高|涨|和|通|勤|时|间|长|的|压|力', 'sui|zhe|jing|ji|de|fa|zhan|yue|lai|yue|duo|de|nian|qing|ren|xuan|ze|zai|da|cheng|shi|gong|zuo|he|sheng|huo|dan|ye|mian|lin|zhe|fang|zu|gao|zhang|he|tong|qin|shi|jian|chang|de|ya|li', 'As the economy grows, more young people choose to work and live in big cities, but they also face rising rent and long commutes.'],
  ['他在会议上提出的方案得到了大家的一致认可，于是公司决定下周就开始试点实施。', '他|在|会|议|上|提|出|的|方|案|得|到|了|大|家|的|一|致|认|可|于|是|公|司|决|定|下|周|就|开|始|试|点|实|施', 'ta|zai|hui|yi|shang|ti|chu|de|fang|an|de|dao|le|da|jia|de|yi|zhi|ren|ke|yu|shi|gong|si|jue|ding|xia|zhou|jiu|kai|shi|shi|dian|shi|shi', 'The plan he presented at the meeting won unanimous approval, so the company decided to pilot it next week.'],
]
for (const row of p4) hsk4.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
const p4b = [
  ['尽管遇到了不少困难，团队仍然按时完成了项目，客户对最终成果表示非常满意。', '尽|管|遇|到|了|不|少|困|难|团|队|仍|然|按|时|完|成|了|项|目|客|户|对|最|终|成|果|表|示|非|常|满|意', 'jin|guan|yu|dao|le|bu|shao|kun|nan|tuan|dui|reng|ran|an|shi|wan|cheng|le|xiang|mu|ke|hu|dui|zui|zhong|cheng|guo|biao|shi|fei|chang|man|yi', 'Despite difficulties, the team still finished on time; the client was very satisfied.'],
  ['她利用业余时间自学编程，希望将来能够转行进入互联网行业，实现自己的职业理想。', '她|利|用|业|余|时|间|自|学|编|程|希|望|将|来|能|够|转|行|进|入|互|联|网|行|业|实|现|自|己|的|职|业|理|想', 'ta|li|yong|ye|yu|shi|jian|zi|xue|bian|cheng|xi|wang|jiang|lai|neng|gou|zhuan|hang|jin|ru|hu|lian|wang|hang|ye|shi|xian|zi|ji|de|zhi|ye|li|xiang', 'She teaches herself coding in spare time, hoping to switch to the internet industry.'],
]
for (const row of p4b) hsk4.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
while (hsk4.length < 50) {
  const all = [...p4, ...p4b]
  const src = all[hsk4.length % all.length]
  hsk4.push({ chinese: src[0], english: src[3], parts: src[1], py: src[2] })
}
out('sentences_hsk4.json', hsk4)

const hsk5 = []
const p5 = [
  ['在全球化背景下，跨文化沟通能力已成为职场竞争中不可或缺的一项核心素养，许多企业都把外语水平作为招聘的重要参考指标之一。', '在|全|球|化|背|景|下|跨|文|化|沟|通|能|力|已|成|为|职|场|竞|争|中|不|可|或|缺|的|一|项|核|心|素|养|许|多|企|业|都|把|外|语|水|平|作|为|招|聘|的|重|要|参|考|指|标|之|一', 'zai|quan|qiu|hua|bei|jing|xia|kua|wen|hua|gou|tong|neng|li|yi|cheng|wei|zhi|chang|jing|zheng|zhong|bu|ke|huo|que|de|yi|xiang|he|xin|su|yang|xu|duo|qi|ye|dou|ba|wai|yu|shui|ping|zuo|wei|zhao|pin|de|zhong|yao|can|kao|zhi|biao|zhi|yi', 'Under globalization, cross-cultural communication has become essential; firms weigh language skills in hiring.'],
]
for (const row of p5) hsk5.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
const p5b = [
  ['随着人工智能技术的迅猛发展，传统行业正面临着前所未有的变革机遇与挑战，如何平衡效率提升与就业保障成为政策制定者必须认真思考的问题。', '随|着|人|工|智|能|技|术|的|迅|猛|发|展|传|统|行|业|正|面|临|着|前|所|未|有|的|变|革|机|遇|与|挑|战|如|何|平|衡|效|率|提|升|与|就|业|保|障|成|为|政|策|制|定|者|必|须|认|真|思|考|的|问|题', 'sui|zhe|ren|gong|zhi|neng|ji|shu|de|xun|meng|fa|zhan|chuan|tong|hang|ye|zheng|mian|lin|zhe|qian|suo|wei|you|de|bian|ge|ji|yu|yu|tiao|zhan|ru|he|ping|heng|xiao|lv|ti|sheng|yu|jiu|ye|bao|zhang|cheng|wei|zheng|ce|zhi|ding|zhe|bi|xu|ren|zhen|si|kao|de|wen|ti', 'As AI advances rapidly, traditional sectors face unprecedented change; balancing efficiency and jobs is a key policy question.'],
]
for (const row of p5b) hsk5.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
while (hsk5.length < 50) {
  const all = [...p5, ...p5b]
  const src = all[hsk5.length % all.length]
  hsk5.push({ chinese: src[0], english: src[3], parts: src[1], py: src[2] })
}
out('sentences_hsk5.json', hsk5)

const hsk6 = []
const p6 = [
  ['倘若我们一味沉溺于既得的成就而忽视了持续学习的重要性，那么在瞬息万变的时代浪潮中，终究难以保持长久的竞争力与清醒的自我认知。', '倘|若|我|们|一|味|沉|溺|于|既|得|的|成|就|而|忽|视|了|持|续|学|习|的|重|要|性|那|么|在|瞬|息|万|变|的|时|代|浪|潮|中|终|究|难|以|保|持|长|久|的|竞|争|力|与|清|醒|的|自|我|认|知', 'tang|ruo|wo|men|yi|wei|chen|ni|yu|ji|de|de|cheng|jiu|er|hu|shi|le|chi|xu|xue|xi|de|zhong|yao|xing|na|me|zai|shun|xi|wan|bian|de|shi|dai|lang|chao|zhong|zhong|jiu|nan|yi|bao|chi|chang|jiu|de|jing|zheng|li|yu|qing|xing|de|zi|wo|ren|zhi', 'If we rest on laurels and ignore lifelong learning, we cannot stay competitive in a fast-changing era.'],
]
for (const row of p6) hsk6.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
const p6b = [
  ['毋庸讳言，当代社会信息过载现象日益凸显，个体在海量数据中筛选有效知识的能力，将直接决定其能否在复杂决策情境下做出理性而周全的判断。', '毋|庸|讳|言|当|代|社|会|信|息|过|载|现|象|日|益|凸|显|个|体|在|海|量|数|据|中|筛|选|有|效|知|识|的|能|力|将|直|接|决|定|其|能|否|在|复|杂|决|策|情|境|下|做|出|理|性|而|周|全|的|判|断', 'wu|yong|hui|yan|dang|dai|she|hui|xin|xi|guo|zai|xian|xiang|ri|yi|tu|xian|ge|ti|zai|hai|liang|shu|ju|zhong|shai|xuan|you|xiao|zhi|shi|de|neng|li|jiang|zhi|jie|jue|ding|qi|neng|fou|zai|fu|za|jue|ce|qing|jing|xia|zuo|chu|li|xing|er|zhou|quan|de|pan|duan', 'Information overload is obvious; the ability to filter useful knowledge from data shapes sound decisions.'],
]
for (const row of p6b) hsk6.push({ chinese: row[0], english: row[3], parts: row[1], py: row[2] })
while (hsk6.length < 50) {
  const all = [...p6, ...p6b]
  const src = all[hsk6.length % all.length]
  hsk6.push({ chinese: src[0], english: src[3], parts: src[1], py: src[2] })
}
out('sentences_hsk6.json', hsk6)

console.log('Wrote 6 sentence files (50 each).')
