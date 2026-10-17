/**
 * Bilingual string table. Arabic is the default so the shell opens in the
 * language the spec was written in; the toggle flips `dir` instantly.
 */

export const LANGS = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

const EN = {
  'boot.tag': 'COMPANY BOOT SEQUENCE',
  'boot.log': 'loading module',
  'g.cash': 'CASH',
  'g.flow': 'FLOW / SEC',
  'g.worth': 'NET WORTH',
  'g.hit': 'PER CLICK',
  'g.shares': 'SHARES',
  'g.combo': 'COMBO',
  'oc.tag': 'OVERCLOCK',
  'oc.on': 'ALL PRODUCTION DOUBLED',
  'nav.floor': 'OPERATIONS FLOOR',
  'nav.arcade': 'ARCADE WORK HUB',
  'nav.ipo': 'IPO / PRESTIGE',
  'nav.sys': 'SYSTEM',
  'floor.term': 'DEAL TERMINAL',
  'floor.run': 'RUN MERGER',
  'floor.runSub': 'CLICK TO COMMIT CODE',
  'floor.flow': 'REVENUE DIVISIONS',
  'floor.gear': 'WORKSTATION GEAR',
  'floor.exec': 'EXECUTIVE HIRE',
  'arc.title': 'SELECT A CABINET',
  'arc.note': 'Every cabinet pays Instant Cash at your current production rate and arms a five minute Company Overclock on the whole company. Beat a personal best to keep it.',
  'ipo.hd': 'GOING PUBLIC',
  'ipo.worth': 'NET WORTH',
  'ipo.shares': 'SHARES ON HAND',
  'ipo.mult': 'GLOBAL MULTIPLIER',
  'ipo.next': 'NEXT SHARE',
  'ipo.count': 'TIMES LISTED',
  'ipo.btn': 'FILE FOR IPO',
  'ipo.btnSub': 'RESET ALL ASSETS FOR PERMANENT YIELD',
  'ipo.lore': 'An IPO wipes the company down to an empty garage and hands you Executive Shares. Each share is worth +10% on every dollar the company will ever earn, arcade included, forever.',
  'sys.save': 'SAVE DATA',
  'sys.sub': 'SUB-STEPS',
  'sys.updated': 'LAST WRITE',
  'sys.version': 'SAVE VERSION',
  'sys.runs': 'SESSIONS',
  'sys.points': 'LIFETIME SCORE',
  'sys.export': 'EXPORT',
  'sys.import': 'IMPORT',
  'sys.wipe': 'WIPE',
  'sys.top': 'TOP CABINET SCORES',
  'sys.doc': 'ABOUT THIS BUILD',
  'sys.docBody': 'One company, twenty cabinets, no engine downloads. Idle revenue runs on an exponential cost curve with doubling milestones, executives automate the buying, and the arcade pays out straight into the same balance. Progress is stored in this browser only.',
  'sys.dt': 'FRAME CLAMP',
  'sys.canv': 'SUB-STEPS',
  'sys.plane': 'GAME PLANE',
  'ov.score': 'SCORE',
  'ov.best': 'BEST',
  'ov.cash': 'PAID OUT',
  'ov.again': 'RUN AGAIN',
  'ov.out': 'BACK TO HUB',
  'term.idle': 'ready.',
  'term.hit': 'code committed.',
  'term.deal': 'deal closed.',
  'term.combo': 'streak holding.',
  'ov.title': 'CABINET CLOSED',
  'ov.over': 'RUN ENDED',
  'toast.bought': 'bought',
  'toast.need': 'not enough cash',
  'toast.maxed': 'already at maximum',
  'toast.hired': 'hired',
  'toast.ipo': 'IPO complete',
  'toast.oc': 'Overclock armed',
  'toast.saved': 'saved',
  'toast.exported': 'save copied to clipboard',
  'toast.imported': 'save loaded',
  'toast.importFail': 'that save string is not valid',
  'toast.wiped': 'company wiped',
  'toast.milestone': 'milestone doubled',
  'modal.welcome': 'WELCOME BACK, CEO',
  'modal.welcomeBody': 'The machines kept running while you were away.',
  'modal.claim': 'COLLECT',
  'modal.ipoTitle': 'IPO COMPLETE',
  'modal.ipoBody': 'The company is public. Shares are permanent.',
  'modal.ipoOk': 'CONTINUE',
  'modal.wipeTitle': 'WIPE THE COMPANY?',
  'modal.wipeBody': 'Cash, divisions, gear and executives are destroyed. Executive Shares are kept. This cannot be undone.',
  'modal.wipeOk': 'WIPE IT',
  'modal.cancel': 'CANCEL',
  'modal.importTitle': 'LOAD A SAVE',
  'modal.importBody': 'Paste the save string you exported earlier.',
  'modal.importOk': 'LOAD',
  'modal.placeholder': 'paste save string',
  'floor.execOn': 'ACTIVE',
  'sys.never': 'never',
  'sys.noScores': 'no runs logged yet',
  'toast.locked': 'Cabinet locked — bank $10K',
  'toast.autonomous': 'FULLY AUTONOMOUS',
  'toast.ipoLocked': 'Net worth must exceed $1M',
  'toast.capped': 'Offline window capped at 8 hours',
  'boot.log.core': 'core modules nominal',
  'boot.log.save': 'save channel linked',
  'boot.log.ledger': 'ledger balanced',
  'boot.log.games': 'loading cabinet ROMs',
  'boot.log.ready': 'ops deck online',
  'boot.log.fail': 'boot fault — check console',
  'sb.dept': 'DEPTS {n}',
  'sb.gear': 'GEAR {n}',
  'sb.exec': 'EXECS {n}',
  'sb.autonomous': 'AUTOPILOT ENGAGED',
  'sb.frame': 'CLAMP {ms} ms · PLANE {plane}',
};
const AR = {
  'boot.tag': 'تسلسل إقلاع الشركة',
  'boot.log': 'تحميل وحدة',
  'g.cash': 'النقد',
  'g.flow': 'التدفق / ثانية',
  'g.worth': 'القيمة السوقية',
  'g.hit': 'قيمة النقرة',
  'g.shares': 'أسهم التنفيذ',
  'g.combo': 'النسق',
  'oc.tag': 'كسر الأداء',
  'oc.on': 'الكسر مفعّل',
  'nav.floor': 'غرفة العمليات',
  'nav.arcade': 'الخزائن',
  'nav.ipo': 'الطرح',
  'nav.sys': 'النظام',
  'floor.term': 'طرفية العمل',
  'floor.run': 'اكتب كود · أغلق صفقة',
  'floor.runSub': 'انقر لبدء دفعة',
  'floor.flow': 'الأقسام السلبيّة',
  'floor.gear': 'تجهيزات النقر',
  'floor.exec': 'المديرون التنفيذيون',
  'arc.title': 'مركز الأعمال والألعاب',
  'arc.note': 'كل خزانة تحوّل نقاطها إلى نقد فوري وتمنحك كسر أداء لخمس دقائق. افتح أول خزانة، ثم اجمع عشرة آلاف لتفتح البقية.',
  'ipo.hd': 'الطرح العام',
  'ipo.worth': 'القيمة السوقية',
  'ipo.shares': 'أسهم تنفيذ جديدة',
  'ipo.mult': 'المضاعف الدائم',
  'ipo.next': 'السهم التالي عند',
  'ipo.count': 'مرات الطرح',
  'ipo.btn': 'اطرح Shares'.replace('Shares','الأسهم'),
  'ipo.btnSub': 'صفِّر الشركة مقابل أسهم دائمة',
  'ipo.lore': 'الطرح يصفّر النقد والأقسام والتجهيزات والمديرين. ما يبقى هو أسهم التنفيذ: كل سهم يمنحك زيادة دائمة بنسبة عشرة بالمئة على كل دخل وكل مكافأة ألعاب.',
  'sys.save': 'بيانات الحفظ',
  'sys.updated': 'آخر حفظ',
  'sys.version': 'الإصدار',
  'sys.runs': 'الجولات',
  'sys.points': 'النقاط',
  'sys.export': 'تصدير',
  'sys.import': 'استيراد',
  'sys.wipe': 'محو',
  'sys.top': 'أفضل أرقام الخزائن',
  'sys.doc': 'عن هذه النسخة',
  'sys.docBody': 'غرفة العمليات الغلافية. نواة فيزياء مشتركة لكل الخزائن: تثبيت زمن الإطار عند 0.033 ثانية، أربع خطوات فرعية لأي جسم يتجاوز 400 بكسل في الثانية مع تقييد مستمر عند الحدود، ودوال تصادم مختبَرة تدفع الأجسام خارج التداخل قبل انعكاس السرعة. صوت مولّد بالكامل عبر Web Audio بدون أي ملفات صوت خارجية.',
  'sys.dt': 'تثبيت الإطار',
  'sys.sub': 'خطوات فرعية',
  'sys.canv': 'مستوى اللعب',
  'sys.plane': '480 × 360',
  'ov.score': 'النقاط',
  'ov.best': 'الأفضل',
  'ov.cash': 'النقد المكتسب',
  'ov.again': 'إعادة',
  'ov.out': 'الخروج',
  'term.idle': 'جاهز',
  'term.hit': 'تم',
  'term.deal': 'صفقة',
  'term.combo': 'نسق',
  'ov.title': 'انتهت الجولة',
  'ov.over': 'أُنهيت',
  'toast.bought': 'اشتريت {name} · المستوى {level}',
  'toast.need': 'النقد غير كافٍ',
  'toast.maxed': 'بلغت الحد الأقصى',
  'toast.hired': 'وُظّف {name}',
  'toast.ipo': 'اكتمل الطرح · +{n} سهم تنفيذ',
  'toast.oc': 'كسر أداء مفعّل',
  'toast.saved': 'تم الحفظ',
  'toast.exported': 'تم التصدير',
  'toast.imported': 'تم الاستيراد',
  'toast.importFail': 'تعذّر الاستيراد',
  'toast.wiped': 'مُحيت الشركة',
  'toast.milestone': 'مضاعف ٢× عند المستوى {level}',
  'modal.welcome': 'أهلاً بعودتك يا الرئيس',
  'modal.welcomeBody': 'جاهزتك الأوتوماتيكية تخطت غيابه {time}. عائد الغياب يُحتسب بنصف المعدل وخلال ثماني ساعات كحد أقصى.',
  'modal.claim': 'استلم الأرباح',
  'modal.ipoTitle': 'اكتمل الطرح',
  'modal.ipoBody': 'الشركة الآن عامة. أسهم التنفيذ دائمة ولا تفقدها.',
  'modal.ipoOk': 'اطرح الآن',
  'modal.wipeTitle': 'محو الشركة؟',
  'modal.wipeBody': 'النقد والأقسام والتجهيزات والمديرون يُدمَّرون. أسهم التنفيذ تبقى. لا يمكن التراجع.',
  'modal.wipeOk': 'امحُها',
  'modal.cancel': 'إلغاء',
  'modal.importTitle': 'تحميل حفظ',
  'modal.importBody': 'الصق نص الحفظ الذي صدّرته سابقاً.',
  'modal.importOk': 'حمّل',
  'modal.placeholder': 'الصق نص الحفظ',
  'floor.execOn': 'نشط',
  'sys.never': 'لم يُحفظ بعد',
  'sys.noScores': 'لا توجد جولات مسجلة',
  'toast.locked': 'الخزانة مقفلة — رصيدك عشرة آلاف',
  'toast.autonomous': 'الآلية تعمل بالكامل',
  'toast.ipoLocked': 'يجب أن تتجاوز القيمة السوقية مليون دولار',
  'toast.capped': 'توقفت فترة الغياب عند ثماني ساعات',
  'boot.log.core': 'الوحدات الأساسية جاهزة',
  'boot.log.save': 'قناة الحفظ متصلة',
  'boot.log.ledger': 'الدفتر متوازن',
  'boot.log.games': 'تحميل برامج الخزائن',
  'boot.log.ready': 'غرفة العمليات تعمل',
  'boot.log.fail': 'عطل في الإقلاع — راجع الطرفية',
  'sb.dept': 'الأقسام {n}',
  'sb.gear': 'التجهيزات {n}',
  'sb.exec': 'المديرون {n}',
  'sb.autonomous': 'الطيار الآلي يعمل',
  'sb.frame': 'تثبيت {ms} مللي · المستوى {plane}',
};

const TABLES = { ar: AR, en: EN };

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
}

export function t(key, vars) {
  const row = TABLES[lang] || TABLES[DEFAULT_LANG];
  const en = TABLES.en;
  const value = row[key] !== undefined ? row[key] : en[key];
  if (value === undefined) return key;
  return interpolate(value, vars);
}

export function pick(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  const value = row[lang] !== undefined ? row[lang] : row[DEFAULT_LANG] !== undefined ? row[DEFAULT_LANG] : row.en;
  return value === undefined ? '' : value;
}

let lang = DEFAULT_LANG;

export function getLang() { return lang; }

export function isRTL() { return lang === 'ar'; }

export function setLang(next) {
  lang = LANGS.indexOf(next) === -1 ? DEFAULT_LANG : next;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = isRTL() ? 'rtl' : 'ltr';
  return lang;
}

export function toggleLang() {
  return setLang(lang === 'ar' ? 'en' : 'ar');
}

export function applyDom(root) {
  const scope = root || document;
  const list = [
    ['data-i18n', 'textContent'],
    ['data-i18n-ph', 'placeholder'],
    ['data-i18n-title', 'title'],
  ];
  for (const [attr, prop] of list) {
    for (const node of scope.querySelectorAll('[' + attr + ']')) {
      node[prop] = t(node.getAttribute(attr));
    }
  }
}

export function missingKeys() {
  const en = TABLES.en;
  const ar = TABLES.ar;
  const out = [];
  for (const key of Object.keys(en)) if (ar[key] === undefined) out.push(key);
  for (const key of Object.keys(ar)) if (en[key] === undefined) out.push(key);
  return out;
}

export default { t, pick, applyDom, setLang, getLang, isRTL, toggleLang, missingKeys, LANGS, DEFAULT_LANG };
