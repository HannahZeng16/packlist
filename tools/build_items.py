# -*- coding: utf-8 -*-
"""
把旧工作台 ntu-workbench.html 里的 339 条内容，重构成新的条目池 data/items.json。

做四件事：
  1. 重挂到 data/tree.json 的多级分类树
  2. 拆物品类的合并条目（「牙刷+牙膏+牙线」→ 3 条），事务类不拆
  3. 标题里写死的数量挪到 qty 字段
  4. 打 kind（do/buy/know/avoid）、carry（cabin/checked）、pack（包）标签

id 一经生成就写死在 items.json 里，之后手工维护，绝不重算 —— 这是为了避免旧版
「id = 分类 + 数组下标」导致的静默错位（插一条，后面所有进度都挂到别的条目上）。

用法: python3 tools/build_items.py
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW  = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', 'items_raw.json')

# ── 1. 精确覆盖：标题 → 二级分类 id（优先于关键词规则）────────────────
OVERRIDE = {
 '螺丝刀套装':'home.tool', '正装 1 套（西装/衬衫 + 西裤/裙）':'wear.formal',
 '相机 + 备用电池 + 存储卡':'elec.audio', '晴雨两用折叠伞 ×2':'wear.acc',
 '压缩袋 / 收纳袋 按品类分装':'home.luggage', '遮光眼罩':'home.bed', '耳塞':'home.bed',
 '素火锅底料':'food.season', '密封袋 大中小各一批':'home.luggage',
 '28 寸托运箱 ×1–2':'home.luggage', '20 寸登机箱':'home.luggage', '行李秤':'home.luggage',
 '行李箱绑带 / 密码锁':'home.luggage', '确认行李箱三边和 ≤158cm':'home.luggage',
 '托运件里所有液体套密封袋':'home.luggage', '充电宝只能随身，不可托运':'home.luggage',
 '真空压缩袋':'home.luggage', '衣物收纳箱 / 收纳袋':'home.storage',
 '订机票，重点比行李额':'todo.arrive',
 '文件夹 / 资料册':'study.book', 'A4 文件夹 / 资料册':'study.book',
 '完成在线注册 Matriculation':'todo.school', '领学生证 Matriculation Card':'todo.school',
 '选课（GSCRS），提前查开放时间':'todo.school', '看清培养方案和毕业学分要求':'todo.school',
 '参加 O-Week / 迎新':'todo.school', '加项目群、学长学姐群':'todo.school',
 '逛一次图书馆：Lee Wee Nam、Business Library':'todo.school',
 '装学校正版软件：Office / MATLAB / SPSS 等':'todo.school',
 '了解 Career Portal 和实习政策':'todo.school',
 '中国驻新加坡大使馆地址和电话记下来':'doc.backup',
 '紧急联系人纸质卡，放钱包':'doc.id', '电子设备保修卡收好':'doc.backup',
}

# ── 2. 关键词规则：(原分类, 正则) → 二级分类 id。顺序即优先级 ──────────
RULES=[
 ('wash',r'牙刷|牙膏|牙线|漱口|冲牙','wash.oral'),('wash',r'洗面奶|洁面|洗脸巾|卸妆','wash.face'),
 ('wash',r'水乳|精华|面霜|眼霜|面膜|泥膜|痘|唇膏','wash.skin'),('wash',r'防晒','wash.sun'),
 ('wash',r'彩妆|化妆刷|化妆包|美瞳|刷包','wash.makeup'),
 ('wash',r'沐浴|香皂|身体乳|润肤|护手霜|香水','wash.body'),
 ('wash',r'洗发|护发|梳子|头绳|发饰','wash.hair'),('wash',r'剃须|脱毛|鼻毛','wash.shave'),
 ('wash',r'隐形眼镜|护理液|双联盒','wash.lens'),('wash',r'卫生巾|棉条','wash.period'),
 ('wash',r'指甲刀|小剪刀','wash.nail'),('wash',r'分装|洗漱包|收纳袋','wash.pack'),
 ('med',r'眼药水|人工泪液|眼镜|OK 镜','med.eye'),('med',r'驱蚊|登革热|无比滴','med.bug'),
 ('med',r'体温计|牙套','med.device'),('med',r'处方|长期用药|总原则|自查|英文说明书','med.rx'),
 ('med',r'创可贴|碘伏|软膏|凝胶贴|气雾剂|喷鼻|发烧贴|贴膏','med.topical'),
 ('med',r'卫生巾|棉条','wash.period'),('med',r'看牙|洗牙|Medical|Fullerton','todo.health'),
 ('med',r'.','med.oral'),
 ('bed',r'床单|被套|枕套|床垫|凉被|枕头','home.bed'),('bed',r'毛巾|浴巾','home.towel'),
 ('bed',r'晾衣|裤架|晾衣夹','home.hang'),('bed',r'除湿|干燥剂|防霉|樟脑|蚊香|驱蚊','home.dry'),
 ('bed',r'收纳|压缩袋|挂钩|挂架|置物架','home.storage'),('bed',r'台灯|风扇','home.appliance'),
 ('bed',r'眼罩|耳塞|镜子|化妆镜|桌板','home.storage'),
 ('clean',r'洗衣液|凝珠|柔顺剂|洗衣袋','home.laundry'),('clean',r'.','home.clean'),
 ('food',r'保温杯|水杯|随行杯|焖烧杯','food.cup'),
 ('food',r'筷子|勺子|叉子|饭盒|保鲜盒','food.tableware'),
 ('food',r'削皮刀|菜刀|砧板|锅','food.cookware'),
 ('food',r'底料|辣椒|老干妈|花椒|八角|香料|孜然|十三香','food.season'),
 ('food',r'螺蛳粉|方便食品','food.emergency'),('food',r'入境规定','avoid.red'),
 ('food',r'超市采买|食堂|外卖 App|巴刹|食阁','todo.arrive'),
 ('elec',r'笔记本电脑|平板|触控笔','elec.computer'),
 ('elec',r'^手机$|手机壳|钢化膜|取卡针','elec.phone'),
 ('elec',r'转换插头|插排|充电宝|充电头|充电线|电池','elec.power'),
 ('elec',r'耳机|相机|存储卡','elec.audio'),('elec',r'U 盘|移动硬盘','elec.storage'),
 ('elec',r'吹风机|电动牙刷|剃须刀|脱毛刀|卷发棒|直板夹','elec.personal'),
 ('elec',r'电脑支架|鼠标|内胆包|便携包|计算器|保修卡','elec.desk'),
 ('wear',r'T 恤|衬衫|Polo','wear.top'),('wear',r'长裤|短裤|裙子','wear.bottom'),
 ('wear',r'外套|防晒衣|冲锋衣','wear.outer'),('wear',r'内裤|袜子|文胸|背心','wear.under'),
 ('wear',r'睡衣','wear.sleep'),('wear',r'鞋','wear.shoes'),('wear',r'包|伞','wear.bag'),
 ('wear',r'帽子|墨镜|皮带','wear.acc'),('wear',r'正装|西装','wear.formal'),
 ('wear',r'泳衣','wear.sport'),
 ('study',r'.','study.stationery'),
 ('doc',r'证件照|白底|绒面','doc.photo'),
 ('doc',r'毕业证|学位证|成绩单|雅思|托福|公证|录取|学历','doc.edu'),
 ('doc',r'云盘|电子版存|备份|扫描','doc.backup'),('doc',r'保险','doc.ins'),
 ('doc',r'SOLAR|eForm|缴|预约|e-Appointment|Arrival Card|ICA|Singpass|体检|生物识别','todo.visa'),
 ('doc',r'.','doc.id'),
 ('money',r'现金|钱包|外币|换汇|零钱|信用卡|借记卡|银行卡|Visa|Mastercard|卡套','doc.money'),
 ('money',r'.','todo.bank'),
 ('rent',r'.','todo.rent'),('tech',r'.','todo.tel'),('cnwrap',r'.','todo.cnwrap'),
 ('land',r'.','todo.arrive'),('red',r'.','avoid.red'),('nope',r'.','avoid.nope'),
 ('move',r'行李箱|托运箱|登机箱|行李额|行李秤|绑带|密码锁|密封袋|压缩','home.luggage'),
 ('move',r'背包|腰包|收纳','wear.bag'),('move',r'.','todo.arrive'),
]

# ── 3. 拆分：只拆物品类，事务类保持一条 ──────────────────────────────
SPLIT = {
 '牙刷 + 牙膏 + 牙线':['牙刷','牙膏','牙线'],
 '卸妆水 + 眼唇卸':['卸妆水','眼唇卸妆'],
 '痘痘贴 + 祛痘药膏':['痘痘贴','祛痘药膏'],
 '化妆包 + 常用彩妆 + 备货':['化妆包','常用彩妆'],
 '化妆刷 + 刷包':['化妆刷','刷包'],
 '小剪刀 + 修鼻毛器':['小剪刀','修鼻毛器'],
 '隐形眼镜（日抛/月抛）+ 护理液 + 双联盒':['隐形眼镜（日抛/月抛）','隐形眼镜护理液','双联盒'],
 '笔记本电脑 + 充电线 ×2 根':['笔记本电脑','笔记本充电线'],
 '平板 + 触控笔 / 键盘':['平板','触控笔 / 平板键盘'],
 '相机 + 备用电池 + 存储卡':['相机','相机备用电池','存储卡'],
 '电动牙刷 + 备用刷头':['电动牙刷','电动牙刷备用刷头'],
 '鼠标 + 鼠标垫':['鼠标','鼠标垫'],
 '手机壳 + 钢化膜备用':['手机壳','钢化膜'],
 '纸巾：大包 + 随身小包纸':['抽纸 / 大包纸巾','随身小包纸'],
 '洁厕剂 + 马桶刷':['洁厕剂','马桶刷'],
 '扫把 + 拖把 + 簸箕':['扫把','拖把','簸箕'],
 '筷子 + 勺子 + 叉子':['筷子','勺子','叉子'],
 '菜刀 + 砧板':['菜刀','砧板'],
 '尺子、橡皮、笔袋':['尺子','橡皮','笔袋'],
 '笔 ×4 + 笔记本 ×2':['笔','笔记本'],
 '活页本 ×3 + 活页纸':['活页本','活页纸'],
 '小钱包 + 大钱包':['小钱包','大钱包'],
 '面霜、眼霜':['面霜','眼霜'],
 '行李箱绑带 / 密码锁':['行李箱绑带','行李箱密码锁'],
}

# ── 4. kind：know（只是要知道）/ do（要办的事）在物品树里的例外 ────────
KNOW = ['确认行李箱三边和 ≤158cm','托运件里所有液体套密封袋','充电宝只能随身，不可托运',
        '总原则：带原包装 + 英文说明书，数量不超 3 个月用量',
        '⚠️ 先自查：含麻黄碱 / 可待因 / 吗啡成分的药属管制',
        '⚠️ 先自查：含麝香、羚羊角等濒危成分的中成药会被没收',
        '中国驻新加坡大使馆地址和电话记下来','记下 NTU Medical Centre / Fullerton Health @NTU 位置和电话',
        '登革热防护：驱蚊 + 家里不留积水','⚠️ 先搞清食品入境规定']
DO_IN_GOODS = ['护照电子版存云盘 + 手机相册','所有证件扫描件存三处：手机、云盘、邮箱',
        '打印机票行程单','打印住宿证明 / 租约','电子设备保修卡收好','出国前看牙 + 洗牙',
        '配备用眼镜 1–2 副','量一下床的尺寸再买床品']

# ── 5. carry：必须随身的（漏了当场出事，不是落地补买能解决的）─────────
CABIN = ['护照','IPA','身份证','录取通知书','学位证','毕业证','成绩单','证件照','保险单',
         '现金','信用卡','银联卡','钱包','卡套','充电宝','笔记本电脑','平板','手机','耳机',
         '取卡针','隐形眼镜','眼镜','处方','长期用药','卫生巾','棉条','雨伞','折叠伞',
         '紧急联系人','疫苗接种','行程单','住宿证明','文件袋','U 盘','移动硬盘','相机']

def qty_of(t):
    """把标题末尾写死的数量抽到 qty，标题只留品名。
    只对 kind=buy 调用。三个坑：
      - 尺寸不是数量：「证件照（35×45mm）」的 ×45 不能抠
      - 时长不是数量：「带 1–2 个月过渡量」的 1–2 个不能抠
      - 事务类不抠：「各复印 5 份」抠掉就不成句了
    """
    pats=[r'(?<![0-9a-zA-Z])\s*[*xX\u00d7]\s*(\d+(?:\s*[\u2013\-~]\s*\d+)?)\s*(\u6839|\u4ef6|\u6761|\u53cc|\u526f|\u4e2a|\u5f20|\u4efd|\u672c|\u5957|\u53f0)?(?![a-zA-Z\u6708])',
          r'(?<![0-9a-zA-Z])\s*(\d+\s*[\u2013\-~]\s*\d+)\s*(\u4ef6|\u6761|\u53cc|\u526f|\u5f20|\u4efd|\u672c|\u5957)(?!\u6708)',
          r'(?<![0-9a-zA-Z])\s*(\d+)\s*(\u4ef6|\u6761|\u53cc|\u526f|\u5f20|\u4efd|\u672c|\u5957)(?!\u6708)(?=$|\s|\uff08)']
    q=''
    for p_ in pats:
        m=re.search(p_,t)
        if m:
            q=re.sub(r'^[*xX\u00d7\s]+','',m.group(0)).strip()
            t=(t[:m.start()]+' '+t[m.end():])
            break
    t=re.sub(r'\s{2,}',' ',t)
    t=re.sub(r'\s+([\uff08\uff0c\u3001,])',r'\1',t)   # 「插排 （小巧」→「插排（小巧」
    t=re.sub(r'([\uff08])\s+',r'\1',t)
    return t.strip(' \uff0c,\u3001/'), q

def dest_of(it):
    if it['t'] in OVERRIDE: return OVERRIDE[it['t']]
    for c,pat,dst in RULES:
        if it['c']==c and re.search(pat,it['t']): return dst
    return None

def main():
    arr=json.load(open(RAW,encoding='utf-8'))
    tree=json.load(open(os.path.join(ROOT,'data','tree.json'),encoding='utf-8'))
    VALID={s['id'] for x in tree['tree'] for s in x['sub']}
    TOP={s['id']:x for x in tree['tree'] for s in x['sub']}
    out=[]; seen=set(); counter={}; bad=[]
    for it in arr:
        pid=dest_of(it)
        if pid not in VALID: bad.append((it['t'],pid)); continue
        top=TOP[pid]
        titles = SPLIT.get(it['t'], [it['t']])
        for ti,title in enumerate(titles):
            key=re.sub(r'[\s·/、，,（）()：:—\-]+','',title)
            if key in seen: continue          # 去重（A4 文件夹 / 资料册）
            seen.add(key)
            # kind
            if top['kind']=='avoid': kind='avoid'
            elif top['kind']=='task': kind='do'
            elif it['t'] in KNOW: kind='know'
            elif it['t'] in DO_IN_GOODS: kind='do'
            # 证件与钱：只有真正「要买的实物」算 buy，其余都是「要办/要准备」
            elif pid in ('doc.id','doc.edu','doc.money','doc.ins','doc.backup'):
                kind='buy' if re.search(r'文件袋|文件夹|资料册|卡套|钱包', title) else 'do'
            else: kind='buy'
            q=''
            if kind=='buy': title,q = qty_of(title)
            # carry
            carry=''
            if kind=='buy':
                carry='cabin' if any(k in title for k in CABIN) else 'checked'
            elif kind=='do' and pid.startswith('doc.') and not re.search(
                    r'存云盘|扫描|存三处|记下|开通|调高|预约|办理', title):
                carry='cabin'   # 证件材料是实体纸，必须随身 —— 不是买的，但一定要装进包里
            # pack：新加坡/NTU 专属的挑出来，其余归通用
            txt=title+' '+it.get('n','')
            if re.search(r'NTU|Singpass|STP|ICA|SOLAR|IPA|Fullerton|新加坡|坡|英标|EZ-Link|巴刹|食阁|组屋|HDB|Pioneer|Boon Lay|Jurong|登革热|DBS|POSB|OCBC|UOB|PayNow|PayLah|Singtel|StarHub|GrabFood|foodpanda|Matriculation|GSCRS|O-Week|NTUlearn|GSLink',txt):
                pack='sg-ntu'
            else: pack='base'
            counter[pid]=counter.get(pid,0)+1
            out.append({
              'id':'%s.%02d'%(pid,counter[pid]), 'p':pid, 't':title,
              'n':it.get('n',''), 'kind':kind, 'carry':carry, 'qty':q,
              'pack':pack, 'where':it.get('b',''), 'due':'', 'cond':[],
            })
    json.dump({'version':1,'items':out}, open(os.path.join(ROOT,'data','items.json'),'w',encoding='utf-8'),
              ensure_ascii=False, indent=1)
    from collections import Counter
    print('原始 %d 条 → 输出 %d 条（拆分 +%d，去重 -%d）'%(len(arr),len(out),
          sum(len(v)-1 for v in SPLIT.values()), len(arr)+sum(len(v)-1 for v in SPLIT.values())-len(out)))
    print('kind :',dict(Counter(x['kind'] for x in out)))
    print('carry:',dict(Counter(x['carry'] for x in out if x['carry'])))
    print('pack :',dict(Counter(x['pack'] for x in out)))
    print('带数量:',sum(1 for x in out if x['qty']),'条')
    empty=[s['id'] for x in tree['tree'] for s in x['sub'] if s['id'] not in counter]
    if empty: print('⚠️  空分类:',empty)
    if bad: print('❌ 映射失败:',bad)

if __name__=='__main__': main()
