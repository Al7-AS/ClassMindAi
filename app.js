const EMPTY={students:[],groups:[],attendance:[],payments:[],grades:[],expenses:[],followUps:[],auditLogs:[],staff:[],staffAttendance:[],settings:{teacherName:'',centerName:'',centerCode:'',teacherWhatsapp:'',subject:'',notes:'',language:'ar'},nextSerial:1};
let db={...EMPTY};let page='dashboard';let language='ar';let editing=null;let searchValue='';let activeStudent=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(n)||0)+' ج.م';
// Offline QR generator (QR Code Model 2, Version 1-L, numeric mode) — no external libraries.
function qrMatrixNumeric(value){
 const str=String(value); if(!/^\d{1,10}$/.test(str)) return null;
 let bits='0001'+str.length.toString(2).padStart(10,'0');
 for(let i=0;i<str.length;){const n=Math.min(3,str.length-i),chunk=str.slice(i,i+n);bits+=Number(chunk).toString(2).padStart(n===3?10:n===2?7:4,'0');i+=n;}
 bits+= '0'.repeat(Math.min(4,152-bits.length)); while(bits.length%8)bits+='0';
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8),2));let pad=0;while(data.length<19)data.push(pad++%2?0x11:0xec);
 const exp=Array(512).fill(0),log=Array(256).fill(0);let x=1;for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x<<=1;if(x&256)x^=0x11d;}for(let i=255;i<512;i++)exp[i]=exp[i-255];
 const mul=(a,b)=>a&&b?exp[log[a]+log[b]]:0;let gen=[1];for(let i=0;i<7;i++){const next=Array(gen.length+1).fill(0);gen.forEach((v,j)=>{next[j]^=v;next[j+1]^=mul(v,exp[i]);});gen=next;}
 const rem=Array(7).fill(0);for(const byte of data){const factor=byte^rem[0];rem.shift();rem.push(0);for(let i=0;i<7;i++)rem[i]^=mul(gen[i+1],factor);}const codewords=data.concat(rem);const matrix=Array.from({length:21},()=>Array(21).fill(null));
 const set=(x,y,v)=>{if(x>=0&&x<21&&y>=0&&y<21)matrix[y][x]=!!v};
 function finder(ox,oy){for(let y=-1;y<=7;y++)for(let x=-1;x<=7;x++){const xx=ox+x,yy=oy+y;if(xx<0||xx>=21||yy<0||yy>=21)continue;const inside=x>=0&&x<=6&&y>=0&&y<=6;set(xx,yy,inside&&(x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4)));}}
 finder(0,0);finder(14,0);finder(0,14);for(let i=8;i<13;i++){set(i,6,i%2===0);set(6,i,i%2===0);}set(8,13,true);
 // Reserve format-information cells.
 for(let i=0;i<9;i++){if(i!==6){set(8,i,false);set(i,8,false)}}for(let i=0;i<8;i++){set(20-i,8,false);set(8,20-i,false)}
 let raw='';codewords.forEach(b=>raw+=b.toString(2).padStart(8,'0'));let bit=0,up=true;
 for(let right=20;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<21;vert++){const y=up?20-vert:vert;for(let j=0;j<2;j++){const xx=right-j;if(matrix[y][xx]!==null)continue;let v=bit<raw.length?raw[bit++]==='1':false;if((xx+y)%2===0)v=!v;set(xx,y,v);}}up=!up;}
 // Format bits: error correction level L (01), mask 0, BCH + XOR mask 0x5412.
 const d=(1<<3)|0;let remf=d;for(let i=0;i<10;i++)remf=(remf<<1)^(((remf>>>9)&1)?0x537:0);const fmt=((d<<10)|remf)^0x5412;
 const f=(i)=>((fmt>>>i)&1)!==0;
 for(let i=0;i<=5;i++)set(8,i,f(i));set(8,7,f(6));set(8,8,f(7));set(7,8,f(8));for(let i=9;i<15;i++)set(14-i,8,f(i));
 for(let i=0;i<8;i++)set(20-i,8,f(i));for(let i=8;i<15;i++)set(8,6+i,f(i));set(8,13,true);
 return matrix.map(row=>row.map(Boolean));
}
function qrSvg(value,scale=5){const m=qrMatrixNumeric(value);if(!m)return '';const quiet=4,n=m.length+quiet*2;let rects='';m.forEach((row,y)=>row.forEach((v,x)=>{if(v)rects+=`<rect x="${x+quiet}" y="${y+quiet}" width="1" height="1"/>`}));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n*scale}" height="${n*scale}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects}</g></svg>`}
function studentCardMarkup(s,compact=false){
 const qr=qrSvg(s.serial,4),settings=db.settings||{};
 return `<article class="cm-student-card"><div class="cm-card-top"><div class="cm-card-brand"><span class="cm-card-logo">ع</span><div><b>CLASSMIND AI</b><small>${esc(settings.centerName||'السنتر التعليمي')}</small></div></div><span class="cm-card-chip">STUDENT ID</span></div><div class="cm-card-body"><div class="cm-card-details"><div class="cm-card-label">بطاقة الطالب</div><h2>${esc(s.name||'—')}</h2><div class="cm-card-field"><span>الرقم التسلسلي</span><b>${esc(s.serial||'—')}</b></div><div class="cm-card-field"><span>المجموعة</span><b>${esc(groupLabel(s.groupId))}</b></div><div class="cm-card-field"><span>الصف الدراسي</span><b>${esc(s.grade||'غير محدد')}</b></div><div class="cm-card-teacher">المدرس: ${esc(settings.teacherName||'—')}</div></div><div class="cm-card-qr">${qr}<small>امسح لتسجيل الحضور</small></div></div><div class="cm-card-footer"><span>SMART CENTER MANAGEMENT</span><span>DESIGNED BY ALI ASHRAF</span></div></article>`;
}
function studentCardsPrintDocument(cards,title='بطاقات الطلاب'){
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>
 *{box-sizing:border-box}body{margin:0;padding:18px;background:#eef2f7;font-family:Tahoma,Arial,sans-serif;color:#f8fafc}.cm-card-sheet{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}.cm-student-card{width:350px;height:218px;overflow:hidden;position:relative;border-radius:16px;padding:14px 16px;background:radial-gradient(circle at 90% 0%,#49391b55,transparent 34%),linear-gradient(135deg,#090b10,#17191f 62%,#08090d);border:1px solid #c8a85a;box-shadow:0 5px 15px #0b122022;break-inside:avoid;page-break-inside:avoid}.cm-student-card:before{content:"";position:absolute;width:170px;height:170px;border:1px solid #d8b55a22;border-radius:50%;left:-60px;top:50px}.cm-card-top,.cm-card-brand,.cm-card-body,.cm-card-field,.cm-card-footer{display:flex}.cm-card-top{justify-content:space-between;align-items:center;border-bottom:1px solid #d6b45b55;padding-bottom:8px}.cm-card-brand{align-items:center;gap:8px}.cm-card-logo{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#f4dc92,#b68b32);color:#17120a;font-weight:bold;font-size:20px}.cm-card-brand b{display:block;font-size:12px;letter-spacing:1px}.cm-card-brand small{display:block;color:#c5b88e;font-size:10px;margin-top:3px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-card-chip{font-size:8px;letter-spacing:1px;border:1px solid #d6b66a;border-radius:20px;padding:5px 7px;color:#f1d48c}.cm-card-body{align-items:center;justify-content:space-between;gap:10px;padding-top:9px}.cm-card-details{min-width:0;flex:1}.cm-card-label{font-size:10px;color:#e2c36d}.cm-card-details h2{font-size:18px;line-height:1.2;margin:4px 0 7px;overflow-wrap:anywhere}.cm-card-field{align-items:center;justify-content:space-between;gap:6px;font-size:10px;margin:4px 0;color:#c9c5b9}.cm-card-field b{color:#fff;font-size:11px;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cm-card-teacher{font-size:9px;color:#f1d48c;margin-top:6px}.cm-card-qr{flex:0 0 100px;background:#fff;border-radius:8px;padding:5px;text-align:center;color:#142235}.cm-card-qr svg{display:block;width:90px;height:90px}.cm-card-qr small{display:block;font-size:8px;margin-top:3px;white-space:nowrap}.cm-card-footer{position:absolute;bottom:0;left:0;right:0;justify-content:space-between;padding:6px 12px;background:#050609;color:#d4bd7c;font-size:7px;letter-spacing:.6px}.cm-print-actions{margin:16px 0;color:#111}.cm-print-actions button{padding:10px 18px;border:0;border-radius:8px;background:#9e792c;color:#fff8df;font-weight:bold;cursor:pointer}@page{size:auto;margin:8mm}@media print{body{padding:0;background:white}.cm-card-sheet{gap:8mm}.cm-student-card{box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.cm-print-actions{display:none}}
 </style></head><body><div class="cm-card-sheet">${cards}</div><div class="cm-print-actions"><button onclick="window.print()">🖨 طباعة البطاقات</button></div></body></html>`;
}
function printStudentCard(sid){const s=student(sid);if(!s)return;const w=window.open('','_blank');if(!w){say('اسمح بفتح نافذة الطباعة لبطاقة الطالب.',true);return;}w.document.open();w.document.write(studentCardsPrintDocument(studentCardMarkup(s),'بطاقة الطالب'));w.document.close();}

const pageNames={dashboard:'لوحة التحكم',students:'الطلاب وملفاتهم',archive:'أرشيف الطلاب',groups:'المجموعات والأسعار',attendance:'تسجيل الحضور',payments:'المدفوعات الشهرية',grades:'الدرجات والامتحانات',reports:'التقارير والتحليل',insights:'رؤى ClassMind',topStudents:'الأوائل',treasury:'الخزينة',notifications:'التنبيهات',activity:'سجل العمليات',settings:'الإعدادات',staff:'الموظفين'};
const pageNamesEn={dashboard:'Dashboard',students:'Students & Profiles',archive:'Student Archive',groups:'Groups & Pricing',attendance:'Attendance',payments:'Monthly Payments',grades:'Grades & Exams',reports:'Reports & Analytics',insights:'ClassMind Insights',topStudents:'Top Students',treasury:'Treasury',notifications:'Notifications',activity:'Activity Log',settings:'Settings',staff:'Staff'};
const uiEn={'لوحة التحكم':'Dashboard','الطلاب وملفاتهم':'Students & Profiles','المجموعات والأسعار':'Groups & Pricing','تسجيل الحضور':'Attendance','المدفوعات الشهرية':'Monthly Payments','الدرجات والامتحانات':'Grades & Exams','التقارير والتحليل':'Reports & Analytics','الأوائل':'Top Students','الإعدادات':'Settings','إدارة السنتر التعليمي':'Education Center Management','تصدير نسخة احتياطية':'Export Backup','أهلًا بك في العقل الذكي 🧠':'Welcome to ClassMind AI 🧠','إجمالي الطلاب':'Total Students','المجموعات':'Groups','حضور اليوم':'Today Attendance','إجمالي المدفوعات':'Total Payments','أحدث الطلاب':'Latest Students','عرض الطلاب':'View Students','إجراءات سريعة':'Quick Actions','＋ إضافة طالب':'＋ Add Student','▤ إضافة مجموعة':'▤ Add Group','✓ تسجيل حضور':'✓ Record Attendance','₪ تسجيل دفعة':'₪ Record Payment','إعدادات المدرس والسنتر':'Teacher & Center Settings','بيانات التعريف والدخول':'Identity & Access','حفظ الإعدادات':'Save Settings','اسم المدرس / المستر *':'Teacher Name *','اسم السنتر *':'Center Name *','رمز السنتر *':'Center Access Code *','ملاحظات المدرس اليومية':'Teacher Daily Notes','رقم واتساب المدرس':'Teacher WhatsApp Number','العربية / English':'Language','اللغة':'Language','حفظ البيانات':'Save Data','إلغاء':'Cancel','ملاحظات':'Notes','إرسال ملخص لولي الأمر':'Send Summary to Parent','الملف الشخصي للطالب':'Student Profile','طباعة ملف الطالب':'Print Student File','حذف الطالب':'Delete Student','مستحق':'Due','مسدد / غير محدد':'Paid / Not specified','المادة':'Subject','المدرس':'Teacher','الصف':'Grade','المواعيد':'Schedule','الحالة':'Status','الطالب':'Student','المبلغ':'Amount','طريقة الدفع':'Payment Method','التاريخ':'Date','الامتحان':'Exam','الدرجة':'Score','النسبة':'Percentage'};
function t(ar,en){return language==='en'?(en||uiEn[ar]||ar):ar;}
function translateRenderedUI(){if(language!=='en')return;document.querySelectorAll('*').forEach(el=>{if(el.children.length===0){const v=el.textContent.trim();if(uiEn[v])el.textContent=uiEn[v];}});document.documentElement.lang='en';document.documentElement.dir='ltr';} 

// Theme preference is stored separately from center data so changing appearance never alters student records.
function applyTheme(theme, persist=true){
  const selected=theme==='light'?'light':'dark';
  document.body.dataset.theme=selected;
  const button=document.querySelector('#themeToggle');
  if(button){
    button.textContent=selected==='dark'?'🌿 الوضع الفاتح':'🌙 الوضع الداكن';
    button.setAttribute('aria-label',selected==='dark'?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن');
    button.title=selected==='dark'?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن';
  }
  if(persist){try{localStorage.setItem('classmind-theme',selected)}catch(_){}}
}
function initTheme(){
  let saved='dark';try{saved=localStorage.getItem('classmind-theme')||'dark'}catch(_){}
  applyTheme(saved,false);
}

function say(msg,error=false){const n=$('#notice');n.textContent=msg;n.classList.remove('hidden','error');if(error)n.classList.add('error');clearTimeout(say.t);say.t=setTimeout(()=>n.classList.add('hidden'),5000)}
async function save(){
  try{
    if(window.classMindDesktop) await window.classMindDesktop.writeData(db);
    else localStorage.setItem('classmind-v2-demo',JSON.stringify(db));
    return true;
  }catch(e){say('فشل حفظ البيانات: '+(e.message||e),true);return false}
}
async function load(){
  try{
    if(window.classMindDesktop) db={...EMPTY,...await window.classMindDesktop.readData()};
    else {const raw=localStorage.getItem('classmind-v2-demo');if(raw)db={...EMPTY,...JSON.parse(raw)}}
    db.settings={...EMPTY.settings,...(db.settings||{})};
    for(const key of ['students','groups','attendance','payments','grades','expenses','followUps','auditLogs','staff','staffAttendance']) if(!Array.isArray(db[key])) db[key]=[];
    language=db.settings.language==='en'?'en':'ar';
    normalizeSerials();
db.nextSerial=Math.max(0,...[...usedSerials])+1;
    ensureStaffCodes();
  }catch(e){say('تعذر فتح البيانات: '+(e.message||e),true)}
}
// Automatically mark students absent after their group's scheduled class time has passed.
// Only runs for schedules that clearly contain an Arabic weekday and an explicit AM/PM marker.
function autoMarkMissedAttendance(){
 const now=new Date();
 const dayNames=[['الأحد','الاحد','حد'],['الإثنين','الاثنين','الاتنين','اثنين'],['الثلاثاء','ثلاثاء'],['الأربعاء','الاربعاء','أربعاء','اربعاء'],['الخميس','خميس'],['الجمعة','جمعه','جمعة'],['السبت','سبت']];
 const textNorm=v=>String(v||'').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 let changed=0;
 for(const g of db.groups){
  const raw=textNorm(g.schedule||'');
  const dayIndex=dayNames.findIndex(names=>names.some(n=>raw.includes(n)));
  if(dayIndex<0||dayIndex!==now.getDay())continue;
  const timeMatch=raw.match(/(\d{1,2})(?::(\d{2}))?\s*(صباحًا|صباحا|صباح|مساءً|مساءا|مساء|am|pm)/i);
  if(!timeMatch)continue;
  let hour=Number(timeMatch[1]),minute=Number(timeMatch[2]||0),period=timeMatch[3].toLowerCase();
  if(hour<1||hour>12||minute>59)continue;
  if(['مساءً','مساءا','مساء','pm'].includes(period))hour=hour%12+12;else hour=hour%12;
  const classTime=new Date(now);classTime.setHours(hour,minute,0,0);
  classTime.setMinutes(classTime.getMinutes()+30);
  if(now<classTime)continue;
  for(const st of db.students.filter(x=>!x.archived&&x.groupId===g.id)){
   const existing=db.attendance.find(a=>a.studentId===st.id&&a.date===today());
   if(!existing){db.attendance.push({id:uid(),studentId:st.id,date:today(),status:'absent',autoMarked:true,notes:'غياب تلقائي بعد مرور 30 دقيقة على موعد الحصة'});changed++;}
  }
 }
 if(changed){save().then(ok=>{if(ok)logAction('تسجيل غياب تلقائي',`تم تسجيل ${changed} حالة غياب بعد مرور 30 دقيقة على موعد الحصة`);});}
 return changed;
}
// الترقيم لكل مجموعة على حدة: يبدأ من 1 وبالترتيب.
// الطالب المحذوف (المؤرشف) لا يحجز رقمه، فيبقى المكان فارغًا حتى يُضاف طالب جديد فيأخذه.
const SERIAL_SCHEME='per-group-v2';
function normalizeSerials(){
 const groups=new Map();
 for(const s of db.students){const key=String(s.groupId||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)}
 const byOrder=(a,b)=>(Number.parseInt(a.serial,10)||1e9)-(Number.parseInt(b.serial,10)||1e9)||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
 const legacy=db.settings?.serialScheme!==SERIAL_SCHEME;
 for(const list of groups.values()){
  const active=list.filter(s=>!s.archived).sort(byOrder);
  if(legacy){
   // بيانات قديمة كان الترقيم فيها عامًا لكل السنتر: نعيد ترقيم كل مجموعة من 1 بحسب الترتيب الحالي
   active.forEach((s,i)=>{s.serial=String(i+1)});
   continue;
  }
  // الترقيم محفوظ مسبقًا: نُبقي الأرقام الصحيحة الفريدة كما هي (والفراغات تبقى فارغة)،
  // ونعطي من رقمه غير صالح أو مكرر أصغر رقم فارغ داخل مجموعته
  const taken=new Set();const pending=[];
  for(const s of active){const n=Number.parseInt(String(s.serial||''),10);if(Number.isInteger(n)&&n>0&&!taken.has(n)){s.serial=String(n);taken.add(n)}else pending.push(s)}
  for(const s of pending){let n=1;while(taken.has(n))n++;s.serial=String(n);taken.add(n)}
 }
 if(db.settings)db.settings.serialScheme=SERIAL_SCHEME;
 db.nextSerial=Math.max(1,...db.students.map(s=>Number.parseInt(s.serial,10)||0))+1;
}
// عند استرجاع طالب من الأرشيف: يحتفظ برقمه إن كان فارغًا، وإلا يأخذ أصغر رقم فارغ في مجموعته
function reserveSerialForStudent(st){
 const key=String(st.groupId||'');
 const taken=new Set(db.students.filter(x=>x!==st&&!x.archived&&String(x.groupId||'')===key).map(x=>Number.parseInt(x.serial,10)));
 const current=Number.parseInt(String(st.serial||''),10);
 if(Number.isInteger(current)&&current>0&&!taken.has(current))return;
 let n=1;while(taken.has(n))n++;st.serial=String(n);
}
function student(id){return db.students.find(s=>s.id===id)}
function group(id){return db.groups.find(g=>g.id===id)}
function groupLabel(id){return group(id)?.name||'—'}
function studentLabel(id){return student(id)?.name||'—'}
function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(month){if(!month)return '—';const [y,m]=String(month).split('-');return m&&y?new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1)):month}
function monthlyFee(sid){const s=student(sid),g=s&&group(s.groupId);return Number(g?.price||0)}
function monthlyPaidAmount(sid,month=currentMonth()){
 return db.payments.filter(p=>p.studentId===sid&&p.month===month&&['paid','partial'].includes(p.status))
   .reduce((a,p)=>a+Number(p.amount||0),0);
}
function monthlyPaymentStatus(sid,month=currentMonth()){
 const fee=monthlyFee(sid),paid=monthlyPaidAmount(sid,month);
 if(fee<=0)return {status:'no-fee',fee:0,paid,remaining:0};
 if(paid>=fee)return {status:'paid',fee,paid,remaining:0};
 if(paid>0)return {status:'partial',fee,paid,remaining:Math.max(0,fee-paid)};
 return {status:'unpaid',fee,paid,remaining:fee};
}
function paymentStatusText(x){
 return x.status==='paid'?'مدفوع بالكامل':x.status==='partial'?`مدفوع جزئيًا — متبقي ${cash(x.remaining)}`:x.status==='unpaid'?`لم يدفع — ${cash(x.fee)}`:'لا يوجد سعر محدد';
}
function totalPaid(sid){return db.payments.filter(p=>p.studentId===sid&&p.status==='paid').reduce((a,p)=>a+Number(p.amount||0),0)}
function studentDue(sid){return monthlyPaymentStatus(sid).remaining}

// يسجل المبلغ المتبقي فقط لاشتراك الشهر الحالي، دون إعادة تسجيل المبلغ المدفوع سابقًا.
async function settleStudentRemainder(sid){
 const s=student(sid);if(!s)return;
 const status=monthlyPaymentStatus(sid,currentMonth());
 if(status.remaining<=0){say('لا يوجد مبلغ متبقٍ على الطالب لهذا الشهر.',true);return;}
 const amount=Math.round(status.remaining*100)/100;
 db.payments.push({id:uid(),studentId:sid,month:currentMonth(),amount,status:'paid',method:'سداد المتبقي',notes:'تسجيل تلقائي للمبلغ المتبقي فقط',createdAt:new Date().toISOString()});
 logAction('سداد المتبقي من الاشتراك',`${s.name} — ${cash(amount)} — ${currentMonth()}`);
 if(await save()){openProfile(sid);say(`تم تسجيل سداد المتبقي فقط: ${cash(amount)} للطالب ${s.name}.`);}
}

function warmUpSpeech(){
 try{if('speechSynthesis' in window){window.speechSynthesis.getVoices();window.speechSynthesis.onvoiceschanged=()=>window.speechSynthesis.getVoices();}}catch(_){}
}
function pickVoice(patterns){
 const voices=(('speechSynthesis' in window)&&window.speechSynthesis.getVoices())||[];
 for(const re of patterns){const v=voices.find(x=>re.test(x.lang));if(v)return v}
 return null;
}
function pickArabicVoice(){return pickVoice([/^ar[-_]EG/i,/^ar/i])}
function pickEnglishVoice(){return pickVoice([/^en[-_]US/i,/^en[-_]GB/i,/^en/i])}

// صفارة حكم: نغمة تتصاعد مع اهتزاز سريع (تشبه صافرة الملعب)، ومدتها نحو ثانية.
function playRefereeWhistle(){
 return new Promise(resolve=>{
  const dur=0.9;
  try{
   const AudioCtx=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtx){resolve();return}
   const ctx=new AudioCtx();
   if(ctx.state==='suspended')ctx.resume().catch(()=>{});
   const t0=ctx.currentTime+0.02;
   const master=ctx.createGain();
   master.gain.setValueAtTime(0.0001,t0);
   master.gain.exponentialRampToValueAtTime(1.6,t0+0.03);
   master.gain.setValueAtTime(1.6,t0+dur-0.15);
   master.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=0.002;limiter.release.value=0.1;
   master.connect(limiter);limiter.connect(ctx.destination);
   // الاهتزاز (Warble): تعديل سريع لمستوى الصوت يعطي إحساس الصافرة الحقيقية.
   const warble=ctx.createGain();
   warble.gain.value=0.6;
   warble.connect(master);
   const lfo=ctx.createOscillator(),lfoDepth=ctx.createGain();
   lfo.frequency.value=34;lfoDepth.gain.value=0.4;
   lfo.connect(lfoDepth);lfoDepth.connect(warble.gain);
   const voice=(type,mult,level)=>{
     const osc=ctx.createOscillator(),g=ctx.createGain();
     osc.type=type;g.gain.value=level;
     osc.connect(g);g.connect(warble);
     osc.frequency.setValueAtTime(2300*mult,t0);
     osc.frequency.linearRampToValueAtTime(2950*mult,t0+0.22);
     osc.frequency.linearRampToValueAtTime(2800*mult,t0+dur);
     osc.start(t0);osc.stop(t0+dur);
   };
   voice('sine',1,1);
   voice('triangle',2,0.18);
   lfo.start(t0);lfo.stop(t0+dur);
   setTimeout(()=>ctx.close().catch(()=>{}),(dur+0.3)*1000);
   setTimeout(resolve,dur*1000);
  }catch(err){console.warn('Whistle unavailable',err);resolve();}
 });
}
// ينطق النص بلغة محددة ويفضل الصوت المثبت لتلك اللغة، وينتظر انتهاءه.
function speakLine(text,pickVoiceFn,fallbackLang){
 return new Promise(resolve=>{
  try{
   if(!('speechSynthesis' in window)){resolve(false);return}
   const synth=window.speechSynthesis;
   const u=new SpeechSynthesisUtterance(text);
   const voice=pickVoiceFn();
   u.lang=voice?voice.lang:fallbackLang;
   if(voice)u.voice=voice;
   u.rate=0.95;u.pitch=1;u.volume=1;
   window.__cmLastUtterance=u; // يمنع إيقاف النطق بسبب جمع المهملات
   let settled=false;
   const done=ok=>{if(!settled){settled=true;resolve(ok)}};
   u.onend=()=>done(true);
   u.onerror=()=>done(false);
   setTimeout(()=>done(false),9000);
   synth.speak(u);
   if(synth.paused)synth.resume();
  }catch(err){console.warn('Speech unavailable',err);resolve(false)}
 });
}
function speakArabic(text){return speakLine(text,pickArabicVoice,'ar-EG')}
function speakEnglish(text){return speakLine(text,pickEnglishVoice,'en-US')}
function stopSpeech(){try{if('speechSynthesis' in window)window.speechSynthesis.cancel()}catch(_){}}
// كل تسجيل جديد يلغي الصفارة والنطق المتبقيين من التسجيل السابق
let attendanceSpeechToken=0;
// الصفارة ثم النطق بالعربية (اسم الطالب) ثم بالإنجليزية (الحالة)
async function attendanceFeedback(s,status){
 if(status!=='present'&&status!=='late')return;
 const token=++attendanceSpeechToken;
 stopSpeech();
 await playRefereeWhistle();
 if(token!==attendanceSpeechToken)return;
 await speakArabic(`${status==='late'?'تأخير':'حضور'} الطالب ${s.name}`);
 if(token!==attendanceSpeechToken)return;
 await speakEnglish(status==='late'?'Late arrival':'Present');
}

// بطاقة الطالب تظهر بعد كل تسجيل حضور ناجح، وتختفي تلقائيًا دون أن تعطل قارئ USB.
function showAttendanceCardPopup(s,status){
 document.querySelector('#attendanceCardPopup')?.remove();
 clearTimeout(showAttendanceCardPopup.timer);
 const p=monthlyPaymentStatus(s.id);
 const noVoice=!pickArabicVoice();
 const box=document.createElement('div');
 box.id='attendanceCardPopup';
 box.className='attendance-pop-backdrop';
 box.innerHTML=`<div class="attendance-pop student-profile-card" role="status" aria-live="polite"><div class="attendance-pop-badge ${status==='late'?'late':'present'}">${status==='late'?'⏰ متأخر':'✓ حاضر'}</div>${studentCardMarkup(s)}<div class="payment-check ${p.status}"><div class="payment-check-main"><div><b>${esc(s.name)}</b><span>${esc(groupLabel(s.groupId))}</span></div><strong>${esc(paymentStatusText(p))}</strong></div></div>${noVoice?'<p class="muted attendance-pop-hint">⚠️ لا يوجد صوت عربي مثبت على الجهاز، لذلك لن يُنطق الاسم. ثبّت حزمة اللغة العربية من إعدادات ويندوز لتفعيل النطق.</p>':''}<button type="button" class="secondary" id="closeAttendancePop">إغلاق</button></div>`;
 box.addEventListener('click',e=>{if(e.target.closest('#closeAttendancePop'))box.remove()});
 document.body.appendChild(box);
 showAttendanceCardPopup.timer=setTimeout(()=>box.remove(),12000);
}
function logAction(action,detail=''){
  if(!Array.isArray(db.auditLogs))db.auditLogs=[];
  db.auditLogs.unshift({id:uid(),at:new Date().toISOString(),action,detail,user:db.settings?.teacherName||'مدير السنتر'});
  db.auditLogs=db.auditLogs.slice(0,500);
}
function monthDelta(month){const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthAttendanceAverage(month){const rows=monthAttendanceStats(month).filter(x=>x.total);return rows.length?rows.reduce((a,x)=>a+x.rate,0)/rows.length:0}
function monthGradeAverage(month){const rows=monthGradeStats(month).filter(x=>x.avg!==null);return rows.length?rows.reduce((a,x)=>a+x.avg,0)/rows.length:0}
function topStudents(month=currentMonth(),limit=8){return monthGradeStats(month).filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg).slice(0,limit)}
function topStudentsByGrade(month=currentMonth(),limit=10){
 const gradeMap=new Map();
 db.students.forEach(s=>{
   const grade=String(s.grade||'غير محدد').trim()||'غير محدد';
   const g=monthGradeStats(month).find(x=>x.s.id===s.id)||{avg:null};
   const a=monthAttendanceStats(month).find(x=>x.s.id===s.id)||{rate:0,total:0};
   const gradeScore=Number.isFinite(g.avg)?g.avg:0;
   const attendanceScore=a.total?Number(a.rate):0;
   // الدرجة النهائية للأوائل: 70% درجات + 30% حضور، مع الحضور كعامل كسر تعادل.
   const rankingScore=gradeScore*0.7+attendanceScore*0.3;
   const row={s,grade,avg:g.avg,attendance:a.rate,attendanceTotal:a.total,rankingScore};
   if(!gradeMap.has(grade))gradeMap.set(grade,[]);
   gradeMap.get(grade).push(row);
 });
 return [...gradeMap.entries()].map(([grade,rows])=>({grade,rows:rows.sort((a,b)=>b.rankingScore-a.rankingScore||Number(b.avg||0)-Number(a.avg||0)||b.attendance-a.attendance||a.s.name.localeCompare(b.s.name,'ar')).slice(0,limit)})).sort((a,b)=>a.grade.localeCompare(b.grade,'ar'));
}
function topStudentsByGroup(month=currentMonth(),limit=10){
 // ترتيب الأوائل من سجلات الدرجات الفعلية فقط؛ لا تُنشأ درجات افتراضية ولا يدخل الحضور بدلًا من الدرجة.
 // تُعاد قراءة db.grades في كل استدعاء، لذلك يتحدث الترتيب بعد إضافة/تعديل/حذف أي درجة ثم إعادة العرض.
 const gradeRows=monthGradeStats(month), attendanceRows=monthAttendanceStats(month);
 return db.groups.map(g=>{
   const rows=db.students.filter(st=>!st.archived&&st.groupId===g.id).map(st=>{
     const gr=gradeRows.find(x=>x.s.id===st.id)||{avg:null,count:0};
     const at=attendanceRows.find(x=>x.s.id===st.id)||{rate:0,total:0};
     const avg=gr.avg, attendance=Number(at.rate)||0;
     return {s:st,avg,gradeCount:gr.count||0,attendance,attendanceTotal:at.total||0,rankingScore:avg===null?null:avg};
   })
    // لا يظهر في قائمة الأوائل إلا الطالب الذي لديه درجات مسجلة فعلًا في الشهر المحدد.
    .filter(x=>x.avg!==null&&x.gradeCount>0)
    .sort((a,b)=>b.avg-a.avg||b.attendance-a.attendance||a.s.name.localeCompare(b.s.name,'ar')).slice(0,limit);
   return {g,rows};
 }).filter(x=>x.rows.length).sort((a,b)=>String(a.g.name||'').localeCompare(String(b.g.name||''),'ar'));
}
function topStudentsPage(){
 const month=window.topStudentsMonth||currentMonth();
 const groups=topStudentsByGrade(month,10);
 const totalRanked=groups.reduce((n,g)=>n+g.rows.length,0);
 return `<div class="section-head"><div><h2>🏆 أوائل الطلاب</h2><p>العشرة الأوائل من كل صف دراسي، مرتبين حسب 70% درجات + 30% حضور.</p></div><div class="report-actions"><input id="topStudentsMonth" type="month" value="${esc(month)}"><button class="secondary" data-go="students">👨‍🎓 إدارة الطلاب</button></div></div>
 <div class="top-students-hero"><div><span>CLASSMIND TOP STUDENTS</span><h2>🏆 لوحة المتفوقين</h2><p>يتم احتساب ترتيب كل طالب من متوسط درجاته الشهرية وحضوره، مع استخدام الحضور لكسر التعادل.</p></div><div class="top-students-count"><b>${totalRanked}</b><span>طالبًا مصنفًا</span></div></div>
 ${groups.length?groups.map((groupBlock,groupIndex)=>`<section class="top-grade-block"><div class="top-grade-head"><div><span>الصف الدراسي</span><h3>${esc(groupBlock.grade)}</h3></div><strong>أفضل ${groupBlock.rows.length} طلاب</strong></div><div class="table-wrap"><table class="top-students-table"><thead><tr><th>الترتيب</th><th>الطالب</th><th>المجموعة</th><th>متوسط الدرجات</th><th>الحضور</th><th>التقييم النهائي</th><th></th></tr></thead><tbody>${groupBlock.rows.map((x,i)=>{const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;return `<tr class="${i<3?'top-medal-row':''}"><td><b class="rank-badge">${medal}</b></td><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button><small class="rank-sub">رقم ${esc(x.s.serial)}</small></td><td>${esc(groupLabel(x.s.groupId))}</td><td>${x.avg!==null?`<b>${Math.round(x.avg)}%</b>`:'—'}</td><td>${x.attendanceTotal?`${x.attendance}%`:'—'}</td><td><strong class="ranking-score">${Math.round(x.rankingScore)}%</strong></td><td><button class="tiny" data-profile="${x.s.id}">فتح الملف</button></td></tr>`}).join('')}</tbody></table></div></section>`).join(''):'<div class="panel empty">لا توجد بيانات كافية لعرض أوائل الصفوف. أضف درجات وحضورًا للطلاب أولًا.</div>'}
 ${(()=>{const groupLeaders=topStudentsByGroup(month,10);return `<div class="section-head"><div><h2>👥 أوائل المجموعات</h2><p>أفضل الطلاب داخل كل مجموعة حسب متوسط الدرجات المسجلة فعليًا للشهر المحدد. يتم تحديث القائمة تلقائيًا عند حفظ درجات جديدة؛ الحضور عامل لكسر التعادل فقط.</p></div></div>${groupLeaders.length?groupLeaders.map(block=>`<section class="top-grade-block"><div class="top-grade-head"><div><span>المجموعة</span><h3>${esc(block.g.name||'مجموعة')}</h3></div><strong>أفضل ${block.rows.length} طلاب</strong></div><div class="table-wrap"><table class="top-students-table"><thead><tr><th>الترتيب</th><th>الطالب</th><th>الصف الدراسي</th><th>متوسط الدرجات</th><th>الحضور</th><th>التقييم النهائي</th></tr></thead><tbody>${block.rows.map((x,i)=>`<tr class="${i<3?'top-medal-row':''}"><td><b class="rank-badge">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</b></td><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button><small class="rank-sub">رقم ${esc(x.s.serial)}</small></td><td>${esc(x.s.grade||'غير محدد')}</td><td>${x.avg!==null?`<b>${Math.round(x.avg)}%</b>`:'—'}</td><td>${x.attendanceTotal?`${x.attendance}%`:'—'}</td><td><strong class="ranking-score">${Math.round(x.rankingScore)}%</strong></td></tr>`).join('')}</tbody></table></div></section>`).join(''):'<div class="panel empty">لا توجد بيانات كافية لعرض أوائل المجموعات.</div>'}`})()}
 <div class="panel top-students-note"><b>💡 طريقة الترتيب</b><p>أوائل المجموعات: الترتيب حسب متوسط الدرجات الفعلية المسجلة في الشهر المختار، دون درجات افتراضية. يُستخدم الحضور لكسر التعادل فقط. تُحدّث النتائج عند إعادة عرض الصفحة بعد حفظ أي درجة جديدة.</p></div>`;
}

function riskStudents(month=currentMonth()){return smartAnalysisData(month).candidates}
function notificationItems(month=currentMonth()){
 const out=[]; const low=riskStudents(month); const lowAtt=monthAttendanceStats(month).filter(x=>x.total&&x.rate<70);
 if(lowAtt.length)out.push({level:'danger',title:`${lowAtt.length} طالب يحتاجون متابعة حضور`,body:'الحضور أقل من 70% هذا الشهر.',count:lowAtt.length});
 const falling=monthGradeStats(month).filter(x=>x.avg!==null&&x.avg<60);
 if(falling.length)out.push({level:'warn',title:`${falling.length} طالب درجاتهم منخفضة`,body:'متوسط الدرجات أقل من 60%.',count:falling.length});
 const finance=monthlyFinance(month); if(finance.unpaidCount+finance.partialCount)out.push({level:'gold',title:`${finance.unpaidCount+finance.partialCount} اشتراك غير مكتمل`,body:'راجع المدفوعات الشهرية.',count:finance.unpaidCount+finance.partialCount});
 const dueFollowUps=(db.followUps||[]).filter(x=>x.status!=='done'&&String(x.dueDate||'')<=today()&&student(x.studentId)&&!student(x.studentId).archived); if(dueFollowUps.length)out.push({level:'danger',title:`${dueFollowUps.length} متابعة مستحقة`,body:'توجد متابعات مفتوحة حان موعدها أو تأخرت. افتح ملفات الطلاب لإنهائها.',count:dueFollowUps.length});
 const best=topStudents(month,1)[0]; if(best)out.push({level:'good',title:`⭐ ${best.s.name} ضمن المتفوقين`,body:`متوسط ${Math.round(best.avg)}% هذا الشهر.`,count:1});
 const prevMonth=(()=>{const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();
 const currentGrades=monthGradeStats(month),previousGrades=monthGradeStats(prevMonth);
 const newlyOutstanding=currentGrades.filter(x=>x.avg!==null&&x.avg>=80&&((previousGrades.find(p=>p.s.id===x.s.id)?.avg??0)<80));
 if(newlyOutstanding.length)out.push({level:'good',type:'newTop',title:`🌟 ${newlyOutstanding.length} متفوق جديد`,body:'طلاب وصل متوسط درجاتهم إلى 80% أو أكثر هذا الشهر.',count:newlyOutstanding.length});
 if(low.length)out.push({level:'danger',type:'priority',title:`🎯 ${low.length} طالب أولوية متابعة`,body:'اضغط لعرض الطلاب وأسباب أولوية المتابعة وفتح ملفاتهم.',count:low.length});
 return out;
}
function notificationStudents(type,month){
 const active=db.students.filter(s=>!s.archived&&includedInMonth(s,month));
 if(type==='lowGrades')return monthGradeStats(month).filter(x=>x.avg!==null&&x.avg<60).sort((a,b)=>a.avg-b.avg).map(x=>({s:x.s,reason:`متوسط الدرجات ${Math.round(x.avg)}%`}));
 if(type==='incompleteSubs')return active.map(s=>({s,pay:monthlyPaymentStatus(s.id,month)})).filter(x=>x.pay.status!=='paid').map(x=>({s:x.s,reason:`${paymentStatusText(x.pay)} — المتبقي ${cash(x.pay.remaining)}`}));
 if(type==='newTop'){const prevMonth=(()=>{const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();const prev=monthGradeStats(prevMonth);return monthGradeStats(month).filter(x=>x.avg!==null&&x.avg>=80&&(prev.find(p=>p.s.id===x.s.id)?.avg??0)<80).sort((a,b)=>b.avg-a.avg).map(x=>({s:x.s,reason:`متوسط الدرجات ${Math.round(x.avg)}%`}));}
 if(type==='priority')return smartAnalysisData(month).candidates.map(x=>({s:x.s,reason:[x.a.total&&x.a.rate<70?`حضور ${x.a.rate}%`:'',x.g.avg!==null&&x.g.avg<60?`درجات ${Math.round(x.g.avg)}%`:'',x.pay.status!=='paid'?`اشتراك ${paymentStatusText(x.pay)}`:''].filter(Boolean).join(' · '),a:x.a,g:x.g,pay:x.pay}));
 if(type==='attendance')return monthAttendanceStats(month).filter(x=>x.total&&x.rate<70).sort((a,b)=>a.rate-b.rate).map(x=>({s:x.s,reason:`الحضور ${x.rate}% (${x.absent} غياب)`}));
 return [];
}
function expensesForMonth(month=currentMonth()){return (db.expenses||[]).filter(x=>x.month===month)}
function treasuryData(month=currentMonth()){
 const income=monthlyFinance(month).collected, expenses=expensesForMonth(month).reduce((a,x)=>a+Number(x.amount||0),0); return {income,expenses,net:income-expenses,rows:expensesForMonth(month)};
}
function includedInMonth(s,month){return !s.archived||String(s.archivedAt||'').slice(0,7)>=String(month||currentMonth()).slice(0,7)}
function monthlyFinance(month=currentMonth()){
 const rows=db.students.filter(s=>includedInMonth(s,month)).map(s=>({s,payment:monthlyPaymentStatus(s.id,month),fee:monthlyFee(s.id),paid:monthlyPaidAmount(s.id,month)}));
 const expected=rows.reduce((a,x)=>a+x.fee,0);
 const collected=rows.reduce((a,x)=>a+x.paid,0);
 const paidCount=rows.filter(x=>x.payment.status==='paid').length;
 const unpaidCount=rows.filter(x=>x.payment.status==='unpaid').length;
 const partialCount=rows.filter(x=>x.payment.status==='partial').length;
 return {rows,expected,collected,outstanding:Math.max(0,expected-collected),paidCount,unpaidCount,partialCount};
}
function stat(label,value,icon,note){return `<div class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${note}</div></div>`}
function dashboard(){
 const income=db.payments.filter(p=>p.status==='paid').reduce((a,p)=>a+Number(p.amount||0),0);
 const expenses=db.payments.filter(p=>p.kind==='expense').reduce((a,p)=>a+Number(p.amount||0),0);
 const todayRows=db.attendance.filter(a=>a.date===today());
 const present=todayRows.filter(a=>a.status==='present'||a.status==='late').length;
 const activeStudents=db.students.filter(s=>!s.archived);
 const groups=db.groups.slice(0,7),max=Math.max(1,...groups.map(g=>activeStudents.filter(s=>s.groupId===g.id).length));
 return `<div class="hero"><div><h2>أهلًا بك في العقل الذكي 🧠</h2><p>ملف مستقل لكل طالب، متابعة الاشتراكات والدرجات، وتسجيل الحضور بالرقم التسلسلي.</p></div><div class="spark">✦</div></div>
 <div class="stats">${stat('إجمالي الطلاب',activeStudents.length,'♙','الملفات النشطة')}${stat('المجموعات',db.groups.length,'▤','المجموعات والأسعار')}${stat('حضور اليوم',`${present} / ${todayRows.length}`,'✓','حاضر أو متأخر / سجلات اليوم')}${stat('إجمالي المدفوعات',cash(income),'₪','كل المدفوعات المسجلة')}</div>
 <div class="cols"><div class="panel"><div class="panel-head"><h3>عدد الطلاب بكل مجموعة</h3><span class="muted">ملخص</span></div>${groups.length?`<div class="mini-bars">${groups.map(g=>`<div class="bar-col"><div class="bar" style="height:${Math.max(4,activeStudents.filter(s=>s.groupId===g.id).length/max*100)}%"></div><span>${esc(g.name.slice(0,9))}</span></div>`).join('')}</div>`:'<div class="empty">أضف مجموعة وطلابًا لعرض الرسم.</div>'}</div>
 <div class="panel"><div class="panel-head"><h3>إجراءات سريعة</h3></div><div class="quick-grid"><button class="quick" data-go="students"><b>＋ إضافة طالب</b><small>إنشاء ملف طالب</small></button><button class="quick" data-go="groups"><b>▤ إضافة مجموعة</b><small>تحديد السعر الشهري</small></button><button class="quick" data-go="attendance"><b>✓ تسجيل حضور</b><small>الرقم التسلسلي</small></button><button class="quick" data-go="payments"><b>₪ تسجيل دفعة</b><small>متابعة الاشتراك الشهري</small></button><button class="quick" data-go="reports"><b>📊 اشتراكات الشهر</b><small>من دفع؟ ومن لم يدفع؟</small></button><button class="quick" data-go="topStudents"><b>🏆 أوائل الطلاب</b><small>العشرة الأوائل من كل صف</small></button></div></div></div>
 <div class="panel dashboard-notes" style="margin-top:15px"><div class="panel-head"><h3>${t('ملاحظات المدرس اليومية','Teacher Daily Notes')}</h3><span class="muted">${new Intl.DateTimeFormat(language==='en'?'en-US':'ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span></div><div class="notes-display">${esc(db.settings?.notes||t('لا توجد ملاحظات لليوم. اذهب إلى الإعدادات لكتابة مواعيدك ومهامك.','No notes for today. Open Settings to add your schedule and tasks.')).replace(/\n/g,'<br>')}</div></div>
 <div class="panel dashboard-smart-strip" style="margin-top:15px"><div class="panel-head"><div><h3>🧠 قراءة ClassMind لهذا الشهر</h3><span class="muted">تحليل آلي من الحضور والدرجات والمصروفات</span></div><button class="smart-analysis-btn" id="smartAnalysisBtn2">✨ فتح التحليل</button></div><div class="smart-strip-grid">${(()=>{const d=smartAnalysisData(currentMonth());return `<div><b>📈 ${d.currentAvg?Math.round(d.currentAvg)+'%':'—'}</b><span>متوسط الدرجات</span></div><div><b>⚠️ ${d.lowAttendance.length}</b><span>حضور أقل من 70%</span></div><div><b>💰 ${d.collection}%</b><span>تحصيل الشهر</span></div><div><b>🔔 ${d.candidates.length}</b><span>أولوية متابعة</span></div>`})()}</div></div>
 <div class="panel" style="margin-top:15px"><div class="panel-head"><h3>أحدث الطلاب</h3><button class="secondary" data-go="students">عرض الطلاب</button></div>${activeStudents.length?studentTable(activeStudents.slice(-5).reverse()):'<div class="empty">لا يوجد طلاب بعد. اضغط إضافة طالب للبدء.</div>'}</div>`;
}
const schemas={
 staff:{title:'الموظفين',singular:'موظف',fields:[['name','اسم الموظف / المساعد','text',true],['role','الوظيفة','text',false],['phone','رقم الهاتف','tel',false],['salary','المرتب الشهري بالجنيه','number',true],['notes','ملاحظات','text',false]]},
 students:{title:'الطلاب وملفاتهم',singular:'طالب',fields:[['name','اسم الطالب','text',true],['phone','رقم هاتف الطالب','tel',false],['grade','الصف الدراسي','text',true],['groupId','المجموعة','group',false],['parentName','اسم ولي الأمر','text',false],['parentPhone','هاتف ولي الأمر','tel',false],['notes','ملاحظات','textarea',false]]},
 expenses:{title:'مصروفات الخزينة',singular:'مصروف',fields:[['month','الشهر (YYYY-MM)','month',true],['category','بند المصروف','text',true],['amount','المبلغ بالجنيه','number',true],['method','طريقة الدفع','text',false],['notes','ملاحظات','text',false]]},
 groups:{title:'المجموعات والأسعار',singular:'مجموعة',fields:[['name','اسم المجموعة','text',true],['subject','المادة','text',true],['teacher','اسم المدرس','text',false],['grade','الصف الدراسي','text',false],['schedule','المواعيد','text',false],['price','سعر الاشتراك الشهري بالجنيه','number',true]]},
 payments:{title:'المدفوعات الشهرية',singular:'دفعة',fields:[['studentId','الطالب','student',true],['month','الشهر (YYYY-MM)','month',true],['amount','المبلغ بالجنيه','number',true],['status','حالة الدفع','paymentStatus',true],['method','طريقة الدفع','text',false],['notes','ملاحظات','text',false]]},
 grades:{title:'الدرجات والامتحانات',singular:'درجة',fields:[['studentId','الطالب','student',true],['date','تاريخ الامتحان','date',true],['exam','اسم الامتحان','text',true],['score','الدرجة المحصلة','number',true],['total','الدرجة النهائية','number',true],['notes','ملاحظات','text',false]]}
};
function fieldHtml(f,r={}){
 const [key,label,type,required]=f;let value=r[key]??(type==='date'?today():type==='month'?today().slice(0,7):'');let control='';
 if(type==='group'||type==='student'){
   const arr=type==='group'?db.groups:db.students;
   control=`<select id="f-${key}" name="${key}" ${required?'required':''}><option value="">${type==='group'?'بدون مجموعة':'اختر الطالب'}</option>${arr.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)}${type==='group'?' — '+cash(x.price)+'/شهر':''}</option>`).join('')}</select>`;
 }else if(type==='paymentStatus'){
   control=`<select id="f-${key}" name="${key}" required><option value="paid" ${value==='paid'?'selected':''}>مدفوع</option><option value="unpaid" ${value==='unpaid'?'selected':''}>غير مدفوع</option><option value="partial" ${value==='partial'?'selected':''}>مدفوع جزئيًا</option></select>`;
 }else{
   control=`<input id="f-${key}" name="${key}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0" step="0.01"':''} autocomplete="off">`;
 }
 return `<div class="field"><label for="f-${key}">${label}${required?' *':''}</label>${control}</div>`;
}
function formHtml(kind,record={}){
 const schema=schemas[kind];return `<div class="form-panel"><h3>${record.id?'تعديل':'إضافة'} ${schema.singular}</h3><form id="recordForm" data-kind="${kind}" data-id="${record.id||''}"><div class="form-grid">${schema.fields.map(f=>fieldHtml(f,record)).join('')}</div><div class="actions"><button class="primary" type="submit">حفظ البيانات</button><button class="secondary" type="button" id="cancelForm">إلغاء</button></div></form></div>`;
}
function genericTable(kind,rows){
 const cols=kind==='groups'?[['name','اسم المجموعة'],['subject','المادة'],['teacher','المدرس'],['grade','الصف'],['price','السعر الشهري']]:
 kind==='payments'?[['month','الشهر'],['studentId','الطالب'],['amount','المبلغ'],['status','الحالة'],['method','طريقة الدفع']]:
 [['date','التاريخ'],['studentId','الطالب'],['exam','الامتحان'],['score','الدرجة'],['total','النهاية'],['percent','النسبة']];
 return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th>إجراءات</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(([k])=>{let v=r[k];if(k==='studentId')v=studentLabel(v);if(k==='price'||k==='amount')v=cash(v);if(k==='status')v=v==='paid'?'مدفوع':v==='unpaid'?'غير مدفوع':v==='partial'?'جزئي':'—';if(k==='percent')v=Number(r.total)>0?Math.round(Number(r.score)/Number(r.total)*100)+'%':'—';return `<td>${esc(v??'—')}</td>`}).join('')}<td><button class="tiny" data-edit="${kind}:${r.id}">تعديل</button> ${kind==='payments'?`<button class="tiny" data-receipt="${r.id}">إيصال</button>`:''} <button class="tiny" data-del="${kind}:${r.id}">حذف</button></td></tr>`).join('')}</tbody></table></div>`;
}
function studentTable(rows){
 return `<div class="table-wrap"><table><thead><tr><th>الرقم التسلسلي</th><th>اسم الطالب</th><th>الصف</th><th>المجموعة</th><th>ولي الأمر</th><th>الاشتراك الحالي</th><th>إجراءات</th></tr></thead><tbody>${rows.map(s=>`<tr><td><code>${esc(s.serial)}</code></td><td><button class="link-name" data-profile="${s.id}">${esc(s.name)}</button></td><td>${esc(s.grade)}</td><td>${esc(groupLabel(s.groupId))}</td><td>${esc(s.parentName||'—')}</td><td><span class="pill ${monthlyPaymentStatus(s.id).status==='paid'?'':'warn'}">${esc(paymentStatusText(monthlyPaymentStatus(s.id)))}</span></td><td><button class="tiny" data-profile="${s.id}">الملف</button> <button class="tiny" data-edit="students:${s.id}">تعديل</button> <button class="tiny danger" data-delete-student="${s.id}">حذف</button></td></tr>`).join('')}</tbody></table></div>`;
}
function archivePage(){
 const rows=(db.students||[]).filter(s=>s.archived).sort((a,b)=>String(b.archivedAt||'').localeCompare(String(a.archivedAt||'')));
 const q=String(searchValue||'').toLowerCase();const filtered=rows.filter(s=>JSON.stringify(s).toLowerCase().includes(q));
 return `<div class="section-head"><div><h2>🗄 أرشيف الطلاب</h2><p>الطلاب المؤرشفون خارج القوائم النشطة. استرجاع الطالب يعيده للقوائم دون فقد سجلاته التاريخية.</p></div><span class="muted">${filtered.length} طالب</span></div><div class="toolbar"><input class="search" id="search" placeholder="🔎 ابحث في الأرشيف بالاسم أو الرقم..." value="${esc(searchValue)}"><button class="secondary" id="exportArchiveCsv">⬇️ تصدير الأرشيف CSV</button></div><div class="panel">${filtered.length?`<div class="table-wrap"><table><thead><tr><th>الرقم</th><th>اسم الطالب</th><th>الصف</th><th>المجموعة</th><th>تاريخ الأرشفة</th><th>الإجراءات</th></tr></thead><tbody>${filtered.map(s=>`<tr><td>${esc(s.serial)}</td><td>${esc(s.name)}</td><td>${esc(s.grade||'—')}</td><td>${esc(groupLabel(s.groupId))}</td><td>${esc(String(s.archivedAt||'').slice(0,10)||'—')}</td><td><button class="tiny" data-profile="${esc(s.id)}">الملف</button> <button class="tiny primary" data-restore-student="${esc(s.id)}">استرجاع</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">الأرشيف فارغ حاليًا.</div>'}</div>`;
}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function downloadCsv(name,rows){
 const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printPaymentReceipt(paymentId){
 const p=db.payments.find(x=>x.id===paymentId);if(!p)return;const st=student(p.studentId);const w=window.open('','_blank');
 if(!w){say('اسمح بفتح النوافذ المنبثقة لطباعة الإيصال.',true);return}
 const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>إيصال دفع</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}.receipt{max-width:620px;margin:auto;border:2px solid #222;padding:28px;border-radius:12px}.head{text-align:center;border-bottom:1px solid #aaa;padding-bottom:18px}h1{margin:0 0 8px;font-size:24px}.muted{color:#555}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #bbb;padding:12px 0;gap:20px}.amount{font-size:25px;font-weight:bold}.foot{margin-top:28px;display:flex;justify-content:space-between}@media print{button{display:none}}</style><div class="receipt"><div class="head"><h1>${esc(db.settings.centerName||'ClassMind AI')}</h1><div>${esc(db.settings.teacherName||'')}</div><p>إيصال استلام اشتراك</p></div><div class="row"><span>رقم الإيصال</span><b>${esc(p.id.slice(-8).toUpperCase())}</b></div><div class="row"><span>الطالب</span><b>${esc(st?.name||'—')} (${esc(st?.serial||'—')})</b></div><div class="row"><span>المجموعة / الصف</span><b>${esc(groupLabel(st?.groupId))} / ${esc(st?.grade||'—')}</b></div><div class="row"><span>الشهر</span><b>${esc(p.month||'—')}</b></div><div class="row"><span>تاريخ التسجيل</span><b>${esc(String(p.createdAt||p.date||today()).slice(0,10))}</b></div><div class="row"><span>طريقة الدفع</span><b>${esc(p.method||'غير محددة')}</b></div><div class="row"><span>المبلغ المستلم</span><b class="amount">${esc(cash(p.amount))}</b></div><div class="row"><span>الحالة</span><b>${p.status==='paid'?'مدفوع':p.status==='partial'?'مدفوع جزئيًا':'غير مكتمل'}</b></div><div class="foot"><span>توقيع المستلم: __________</span><span>ختم السنتر: __________</span></div><p class="muted" style="text-align:center;margin-top:24px">تم إنشاء الإيصال بواسطة ClassMind AI · تصميم مهندس علي أشرف</p><button onclick="window.print()">طباعة الإيصال</button></div><script>setTimeout(()=>window.print(),300)</script></html>`;
 w.document.open();w.document.write(html);w.document.close();
}
function entityPage(kind){
 const schema=schemas[kind];const record=editing?.kind===kind?db[kind].find(x=>x.id===editing.id):null;
 const q=searchValue.toLowerCase();
 const sourceRows=kind==='students'?(db.students||[]).filter(r=>!r.archived):(db[kind]||[]);
 let rows=sourceRows.filter(r=>JSON.stringify({...r,studentName:studentLabel(r.studentId)}).toLowerCase().includes(q));
 if(kind==='students'){
 const groups=db.groups.filter(g=>rows.some(st=>st.groupId===g.id));
 const grouped=groups.map(g=>`<div class="panel"><div class="panel-head"><h3>📚 ${esc(g.name)}</h3><span class="muted">${rows.filter(st=>st.groupId===g.id).length} طالب</span></div>${studentTable(rows.filter(st=>st.groupId===g.id).sort((a,b)=>Number(a.serial)-Number(b.serial)))}</div>`).join('');
 const ungrouped=rows.filter(st=>!st.groupId||!group(st.groupId));
 return `<div class="section-head"><div><h2>${schema.title}</h2><p>أسماء الطلاب مرتبة داخل كل مجموعة، والترقيم التسلسلي مستقل لكل مجموعة.</p></div><button class="primary" id="addRecord">＋ إضافة طالب</button></div><div id="formMount">${record?formHtml(kind,record):''}</div><div class="toolbar"><input class="search" id="search" placeholder="🔎 ابحث باسم الطالب أو رقمه التسلسلي..." value="${esc(searchValue)}"><span class="muted">${rows.length} طالب</span></div>${grouped}${ungrouped.length?`<div class="panel"><div class="panel-head"><h3>طلاب بدون مجموعة</h3></div>${studentTable(ungrouped)}</div>`:''}${rows.length?'':'<div class="panel empty">لا توجد نتائج. اضغط «إضافة طالب» وسجّل البيانات المطلوبة.</div>'}`;
 }
 return `<div class="section-head"><div><h2>${schema.title}</h2><p>${kind==='groups'?'حدد سعر كل مجموعة، وسيظهر السعر عند تسجيل الطالب.':kind==='payments'?'سجّل المدفوعات لكل شهر وتابع المبالغ غير المدفوعة.':'أضف نتائج الامتحانات لكل طالب.'}</p></div><button class="primary" id="addRecord">＋ إضافة ${schema.singular}</button></div><div id="formMount">${record?formHtml(kind,record):''}</div><div class="toolbar"><input class="search" id="search" placeholder="بحث..." value="${esc(searchValue)}"><span class="muted">${rows.length} سجل</span></div>${rows.length?genericTable(kind,rows):'<div class="panel empty">لا توجد سجلات بعد. استخدم زر الإضافة بالأعلى.</div>'}`;
}
function attendancePage(){
 const recent=db.attendance.slice(-25).reverse();
 const month=currentMonth();
 return `<div class="section-head"><div><h2>تسجيل الحضور بالرقم التسلسلي</h2><p>اكتب رقم الطالب، وسيظهر فورًا هل اشتراك ${monthLabel(month)} مدفوع أم لا.</p></div></div>
 <div class="form-panel"><h3>🔌 تسجيل الحضور بقارئ الباركود USB — يعمل دون إنترنت</h3>
 <div class="scanner-tools"><span class="muted">وصّل قارئ USB ثم امسح باركود الطالب. سيُدخل القارئ الرقم تلقائيًا؛ اضغط Enter إذا لم يكن القارئ يرسله تلقائيًا.</span></div><div id="usbScanStatus" class="scan-status">قارئ USB جاهز. امسح باركود الطالب لتسجيل الحضور.</div>
 <form id="attendanceForm"><div class="form-grid"><div class="field"><label>المجموعة المراد تسجيل حضورها *</label><select id="attendanceGroup" name="groupId" required><option value="">اختر المجموعة أولًا</option>${db.groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></div><div class="field"><label>رقم الطالب داخل المجموعة / قارئ USB *</label><input id="attendanceSerial" name="serial" placeholder="اختر المجموعة ثم امسح الباركود" required autocomplete="off" inputmode="numeric"></div><div class="field"><label>التاريخ *</label><input id="attendanceDate" name="date" type="date" value="${today()}" required></div><div class="field"><label>الحالة *</label><select name="status"><option value="present">حاضر</option><option value="late">متأخر</option><option value="absent">غائب</option></select></div></div>
 <div class="actions"><button class="secondary" type="button" id="finishAttendanceGroup">🔒 إنهاء المجموعة وتسجيل غير المسجلين غيابًا</button></div><div id="attendanceCloseReport" class="payment-check empty">بعد إنهاء المجموعة سيظهر تقرير بأسماء الطلاب الذين تم تسجيلهم غيابًا.</div>
 <div id="attendanceStudentInfo" class="payment-check empty">امسح الباركود أو اكتب الرقم لعرض بيانات الطالب والاشتراك.</div>
 <div class="actions"><button class="primary" type="submit">✓ تسجيل الحضور</button></div></form></div>
 <div class="form-panel staff-scan-panel"><h3>🪪 حضور الموظفين — دخول وانصراف بالباركود</h3><p class="muted">كل مسح يسجل دخولًا ثم انصرافًا بالتبادل. كود الموظف يبدأ بـ STF-.</p><form id="staffScanForm"><div class="field"><label for="staffScanInput">امسح بطاقة الموظف *</label><input id="staffScanInput" name="staffCode" autocomplete="off" placeholder="امسح باركود الموظف أو اكتب كوده" required></div></form>${staffTodayHtml()}</div><div class="panel"><div class="panel-head"><h3>آخر سجلات الحضور</h3><span class="muted">${db.attendance.length} سجل إجمالي</span></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الرقم</th><th>الطالب</th><th>المجموعة</th><th>الحالة</th><th>اشتراك الشهر</th></tr></thead><tbody>${recent.map(a=>{const st=monthlyPaymentStatus(a.studentId);return `<tr><td>${esc(a.date)}</td><td>${esc(student(a.studentId)?.serial||'—')}</td><td>${esc(studentLabel(a.studentId))}</td><td>${esc(groupLabel(student(a.studentId)?.groupId))}</td><td>${a.status==='present'?'حاضر':a.status==='late'?'متأخر':'غائب'}</td><td><span class="metric ${st.status==='paid'?'':'bad'}">${esc(paymentStatusText(st))}</span></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">لا توجد سجلات حضور بعد.</div>'}</div>`;
}
function settingsPage(){
 const settings=db.settings||{};
 return `<div class="section-head"><div><h2>${t('إعدادات المدرس والسنتر','Teacher & Center Settings')}</h2><p>${t('احفظ بيانات المدرس ورقم واتساب وملاحظاتك اليومية واللغة المفضلة.','Save teacher data, WhatsApp number, daily notes and preferred language.')}</p></div></div>
 <div class="form-panel"><h3>${t('بيانات التعريف والدخول','Identity & Access')}</h3><form id="settingsForm"><div class="form-grid">
 <div class="field"><label for="teacherName">${t('اسم المدرس / المستر *','Teacher Name *')}</label><input id="teacherName" name="teacherName" value="${esc(settings.teacherName)}" required maxlength="100" autocomplete="name" placeholder="${t('مثال: أ/ أحمد محمد','Example: Mr. Ahmed Mohamed')}"></div>
 <div class="field"><label for="centerName">${t('اسم السنتر *','Center Name *')}</label><input id="centerName" name="centerName" value="${esc(settings.centerName)}" required maxlength="120" placeholder="${t('مثال: سنتر التفوق','Example: Excellence Center')}"></div>
 <div class="field"><label for="subject">${t('المادة الدراسية *','Teaching Subject *')}</label><input id="subject" name="subject" value="${esc(settings.subject||'')}" required maxlength="80" placeholder="${t('مثال: الفيزياء','Example: Physics')}"><small class="muted">${t('ستظهر المادة على شاشة اللابتوب في شاشة الدخول.','This subject appears on the laptop screen on the entry screen.')}</small></div>
 <div class="field"><label for="teacherWhatsapp">${t('رقم واتساب المدرس','Teacher WhatsApp Number')}</label><input id="teacherWhatsapp" name="teacherWhatsapp" type="tel" value="${esc(settings.teacherWhatsapp||'')}" maxlength="20" placeholder="+20XXXXXXXXXX"><small class="muted">${t('يُحفظ كرقم واتساب المرسل في إعدادات النظام.','Stored as the configured WhatsApp sender number.')}</small></div>
 <div class="field"><label for="language">${t('اللغة','Language')}</label><select id="language" name="language"><option value="ar" ${language==='ar'?'selected':''}>العربية</option><option value="en" ${language==='en'?'selected':''}>English</option></select></div>
 <div class="field"><label for="centerCode">${t('رمز السنتر *','Center Access Code *')}</label><input id="centerCode" name="centerCode" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="${settings.centerCode?t('اتركه فارغًا للإبقاء على الرمز الحالي','Leave blank to keep current code'):t('أنشئ رمزًا من 4 أحرف/أرقام على الأقل','Create a code of at least 4 characters')}" ${settings.centerCode?'':'required'}><small class="muted">${settings.centerCode?t('اترك الحقل فارغًا للإبقاء على الرمز الحالي، أو اكتب رمزًا جديدًا.','Leave blank to keep the current code, or enter a new one.'):t('أنشئ رمزًا لتأمين شاشة الدخول.','Create a code to secure the entry screen.')}</small></div>
 <div class="field"><label for="financeCode">${t('رمز الحسابات والموظفين','Accounts & Staff Code')}</label><input id="financeCode" name="financeCode" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="${settings.financeCode?t('اتركه فارغًا للإبقاء على الرمز الحالي','Leave blank to keep current code'):t('أنشئ رمزًا من 4 أحرف/أرقام على الأقل','Create a code of at least 4 characters')}"><small class="muted">${t('يحمي الخزينة والتقارير المالية وقسم الموظفين.','Protects Treasury, financial reports and Staff.')} ${settings.financeCode?t('اتركه فارغًا للإبقاء على الرمز الحالي.','Leave blank to keep the current code.'):t('أنشئه الآن.','Create it now.')}</small></div>
 </div><div class="field full-field"><label for="entryImageUpload">${t('صورة شاشة البداية','Startup Screen Image')}</label><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:8px 0 12px"><img id="entryImagePreview" src="${esc(settings.entryImageData||'')}" alt="معاينة صورة البداية" style="width:150px;height:100px;object-fit:cover;border-radius:12px;border:1px solid var(--border,#ccd3df);background:#111"><div><input id="entryImageUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="muted" style="display:block;margin-top:6px">${t('اختر صورة من جهازك لتظهر في شاشة البداية. سيتم حفظها داخل البرنامج وتبقى بعد إعادة التشغيل.','Choose an image from your device. It will be saved and remain after restarting the app.')}</small><button type="button" class="secondary" id="removeEntryImage" style="margin-top:8px">${t('حذف الصورة المختارة','Restore Default Image')}</button></div></div></div>
<div class="field full-field"><label for="teacherNotes">${t('ملاحظات المدرس اليومية','Teacher Daily Notes')}</label><textarea id="teacherNotes" name="notes" rows="7" maxlength="5000" placeholder="${t('اكتب هنا مواعيد اليوم، الحصص، المهام، الاجتماعات وأي ملاحظات مهمة...','Write today’s schedule, lessons, tasks, meetings and important notes...')}">${esc(settings.notes||'')}</textarea></div>
 <div class="actions"><button class="primary" type="submit">${t('حفظ الإعدادات','Save Settings')}</button></div></form></div>
 <div class="insight"><b>${t('معاينة بيانات واتساب','WhatsApp Configuration Preview')}</b><p>${t('رقم المرسل المحفوظ:','Configured sender number:')} ${esc(settings.teacherWhatsapp||t('لم يتم تسجيل رقم بعد','No number configured'))}</p><p>${t('مع تحيات أ/','Regards,')} ${esc(settings.teacherName||t('اسم المدرس','Teacher Name'))} — ${esc(settings.centerName||t('اسم السنتر','Center Name'))}</p></div>${backupRestorePanel()}`;
}
function arabicMonthFileName(month){
 const [y,m]=String(month||'').split('-');
 const names=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 return `تقرير-${names[Math.max(0,Number(m||1)-1)]||m||'الشهر'}-${y||new Date().getFullYear()}`;
}
function xmlExcelEscape(value){
 const s=String(value??'');
 return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/\r?\n/g,'&#10;');
}
function buildBrowserExcelXml(sheets){
 const rowsToXml=rows=>rows.map(row=>`<Row>${row.map(cell=>{
   const v=cell==null?'':cell;
   const type=typeof v==='number' && Number.isFinite(v)?'Number':'String';
   return `<Cell><Data ss:Type="${type}">${xmlExcelEscape(v)}</Data></Cell>`;
 }).join('')}</Row>`).join('');
 return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>${sheets.map(sheet=>`<Worksheet ss:Name="${xmlExcelEscape(sheet.name).slice(0,31)}"><Table>${rowsToXml(sheet.rows)}</Table></Worksheet>`).join('')}</Workbook>`;
}
function downloadBrowserExcel(month,fileName,sheets){
 const xml=buildBrowserExcelXml(sheets);
 const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`${fileName||arabicMonthFileName(month)}.xls`;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportMonthlyExcel(month=currentMonth()){
 const f=monthlyFinance(month), settings=db.settings||{};
 const money=n=>Number(n)||0;
 const status=x=>x.payment.status==='paid'?'مدفوع بالكامل':x.payment.status==='partial'?'مدفوع جزئيًا':'لم يدفع';
 const sheets=[
  {name:'ملخص الشهر',rows:[
   ['ClassMind AI — التقرير الشهري'],['اسم السنتر',settings.centerName||'—'],['اسم المدرس',settings.teacherName||'—'],['المادة الدراسية',settings.subject||'—'],['الشهر',monthLabel(month)],[],
   ['المؤشر','القيمة'],['إجمالي الطلاب',f.rows.length],['دفع بالكامل',f.paidCount],['مدفوع جزئيًا',f.partialCount],['لم يدفع',f.unpaidCount],['إجمالي المفروض',money(f.expected)],['إجمالي المحصل',money(f.collected)],['إجمالي المتبقي',money(f.outstanding)],['نسبة التحصيل',f.expected?Math.round(f.collected/f.expected*100):0]
  ]},
  {name:'الطلاب',rows:[['الرقم','اسم الطالب','الصف','المجموعة','سعر الاشتراك','مدفوع هذا الشهر','المتبقي','حالة الدفع','هاتف الطالب','اسم ولي الأمر','هاتف ولي الأمر','ملاحظات'],...f.rows.map(x=>[Number(x.s.serial)||x.s.serial,x.s.name||'',x.s.grade||'',groupLabel(x.s.groupId),money(x.fee),money(x.paid),money(x.payment.remaining),status(x),x.s.phone||'',x.s.parentName||'',x.s.parentPhone||'',x.s.notes||''])]},
  {name:'المجموعات',rows:[['اسم المجموعة','المادة','المدرس','الصف','المواعيد','سعر الاشتراك','عدد الطلاب'],...db.groups.map(g=>[g.name||'',g.subject||'',g.teacher||settings.teacherName||'',g.grade||'',g.schedule||'',money(g.price),db.students.filter(s=>s.groupId===g.id).length])]},
  {name:'المدفوعات',rows:[['الشهر','الرقم','اسم الطالب','المجموعة','المبلغ','الحالة','طريقة الدفع','ملاحظات','تاريخ التسجيل'],...db.payments.filter(p=>p.month===month).map(p=>[p.month,Number(student(p.studentId)?.serial)||student(p.studentId)?.serial||'—',studentLabel(p.studentId),groupLabel(student(p.studentId)?.groupId),money(p.amount),p.status==='paid'?'مدفوع':p.status==='partial'?'جزئي':'غير مدفوع',p.method||'',p.notes||'',String(p.createdAt||p.date||'').slice(0,10)])]},
  {name:'الدرجات',rows:[['التاريخ','الرقم','اسم الطالب','الصف','المجموعة','الامتحان','الدرجة','الدرجة النهائية','النسبة','ملاحظات'],...db.grades.map(g=>{const st=student(g.studentId);return [g.date,Number(st?.serial)||st?.serial||'—',st?.name||'—',st?.grade||'—',groupLabel(st?.groupId),g.exam||'',money(g.score),money(g.total),g.total?Math.round(Number(g.score)/Number(g.total)*100):0,g.notes||'']})]},
  {name:'الحضور',rows:[['التاريخ','الرقم','اسم الطالب','الصف','المجموعة','الحالة'],...db.attendance.filter(a=>String(a.date||'').slice(0,7)===month).map(a=>{const st=student(a.studentId);return [a.date,Number(st?.serial)||st?.serial||'—',st?.name||'—',st?.grade||'—',groupLabel(st?.groupId),a.status==='present'?'حاضر':a.status==='late'?'متأخر':'غائب']})]},
  {name:'المصروفات',rows:[['الشهر','البند','المبلغ','طريقة الدفع','ملاحظات'],...expensesForMonth(month).map(x=>[x.month,x.category,money(x.amount),x.method||'',x.notes||''])]},
  {name:'متابعة الطلاب',rows:[['موعد المتابعة','اسم الطالب','الرقم التسلسلي','النوع','الحالة','الملاحظة','تاريخ التسجيل'],...(db.followUps||[]).map(x=>[x.dueDate,studentLabel(x.studentId),student(x.studentId)?.serial||'',({academic:'دراسية',attendance:'حضور وغياب',financial:'مالية',parent:'ولي الأمر',other:'أخرى'})[x.type]||'أخرى',x.status==='done'?'تمت':'مفتوحة',x.note||'',x.createdAt||''])]},
  {name:'سجل العمليات',rows:[['الوقت','المستخدم','العملية','التفاصيل'],...(db.auditLogs||[]).slice(0,200).map(x=>[x.at,x.user||'',x.action||'',x.detail||''])]},
  {name:'الأوائل',rows:[['الصف الدراسي','الترتيب','اسم الطالب','الرقم','المجموعة','متوسط الدرجات','الحضور','التقييم النهائي'],...topStudentsByGrade(month,10).flatMap(block=>block.rows.map((x,i)=>[block.grade,i+1,x.s.name||'',Number(x.s.serial)||x.s.serial||'',groupLabel(x.s.groupId),x.avg===null?'':Math.round(x.avg),x.attendanceTotal?x.attendance:'',Math.round(x.rankingScore)]))]},
  {name:'الإعدادات',rows:[['البيان','القيمة'],['اسم السنتر',settings.centerName||''],['اسم المدرس',settings.teacherName||''],['المادة الدراسية',settings.subject||''],['رقم واتساب المدرس',settings.teacherWhatsapp||''],['رمز السنتر','محمي ولا يتم تصديره'],['ملاحظات المدرس',settings.notes||'']]}
 ];
 if(window.classMindDesktop?.exportExcel){
   try{const r=await window.classMindDesktop.exportExcel({month,fileName:arabicMonthFileName(month),sheets});if(r?.ok)say(`تم تصدير تقرير ${monthLabel(month)} إلى Excel بنجاح.`);else if(!r?.canceled)say('تعذر تصدير ملف Excel.',true);}
   catch(err){say('تعذر تصدير Excel: '+(err.message||err),true)}
 }else{
   try{
     downloadBrowserExcel(month,arabicMonthFileName(month),sheets);
     say(`تم تنزيل تقرير ${monthLabel(month)} بصيغة Excel بنجاح.`);
   }catch(err){
     say('تعذر إنشاء ملف Excel في وضع المتصفح: '+(err.message||err),true);
   }
 }
}

function monthAttendanceStats(month=currentMonth()){
  const rows=db.students.filter(s=>includedInMonth(s,month)).map(s=>{
    const records=db.attendance.filter(a=>a.studentId===s.id&&String(a.date||'').slice(0,7)===month);
    const present=records.filter(a=>a.status==='present'||a.status==='late').length;
    const total=records.length;
    const rate=total?Math.round(present/total*100):0;
    return {s,total,present,absent:records.filter(a=>a.status==='absent').length,rate};
  });
  return rows;
}
function monthGradeStats(month=currentMonth()){
  return db.students.filter(s=>includedInMonth(s,month)).map(s=>{
    const rows=db.grades.filter(g=>g.studentId===s.id&&String(g.date||'').slice(0,7)===month);
    const scores=rows.map(g=>Number(g.score)/Math.max(1,Number(g.total))*100).filter(Number.isFinite);
    return {s,avg:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,count:scores.length};
  });
}
function groupGradeAnalysis(month=currentMonth()){
  return db.groups.map(g=>{
    const vals=[];
    db.students.filter(s=>!s.archived&&s.groupId===g.id).forEach(s=>{
      db.grades.filter(x=>x.studentId===s.id&&String(x.date||'').slice(0,7)===month).forEach(x=>vals.push(Number(x.score)/Math.max(1,Number(x.total))*100));
    });
    return {g,avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,count:vals.length};
  }).filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg);
}
function smartAnalysisData(month=currentMonth()){
  const grades=monthGradeStats(month), prevMonth=(()=>{const d=new Date(month+'-01T00:00:00');d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();
  const prev=monthGradeStats(prevMonth);
  const currentVals=grades.filter(x=>x.avg!==null).map(x=>x.avg), prevVals=prev.filter(x=>x.avg!==null).map(x=>x.avg);
  const currentAvg=currentVals.length?currentVals.reduce((a,b)=>a+b,0)/currentVals.length:0;
  const prevAvg=prevVals.length?prevVals.reduce((a,b)=>a+b,0)/prevVals.length:0;
  const gradeChange=prevAvg?((currentAvg-prevAvg)/prevAvg*100):0;
  const attendance=monthAttendanceStats(month), lowAttendance=attendance.filter(x=>x.total>0&&x.rate<70).sort((a,b)=>a.rate-b.rate);
  const finance=monthlyFinance(month), collection=finance.expected?Math.round(finance.collected/finance.expected*100):0;
  const bestGroup=groupGradeAnalysis(month)[0];
  const candidates=db.students.filter(s=>!s.archived).map(s=>{
    const a=attendance.find(x=>x.s.id===s.id)||{rate:0,total:0,absent:0};
    const g=grades.find(x=>x.s.id===s.id)||{avg:null};
    const pay=monthlyPaymentStatus(s.id,month);
    let risk=0;if(a.total&&a.rate<70)risk+=50;else if(a.total&&a.rate<80)risk+=25;if(g.avg!==null&&g.avg<60)risk+=35;else if(g.avg!==null&&g.avg<70)risk+=18;if(pay.status==='unpaid')risk+=20;else if(pay.status==='partial')risk+=10;
    return {s,a,g,pay,risk};
  }).filter(x=>x.risk>0).sort((a,b)=>b.risk-a.risk).slice(0,6);
  return {month,monthName:monthLabel(month),gradeChange,currentAvg,attendance,lowAttendance,finance,collection,bestGroup,candidates,prevMonth};
}
function showSmartAnalysis(month=currentMonth()){
  const d=smartAnalysisData(month);
  const gradeText=d.currentAvg?`متوسط الدرجات الحالي ${Math.round(d.currentAvg)}%`:'لا توجد درجات كافية لهذا الشهر';
  const changeText=d.gradeChange>0?`ارتفع ${Math.round(d.gradeChange)}%`:d.gradeChange<0?`انخفض ${Math.abs(Math.round(d.gradeChange))}%`:'مستقر تقريبًا';
  const students=d.candidates.map(x=>`<tr><td><b>${esc(x.s.name)}</b><small>${esc(x.s.grade||'—')} · ${esc(groupLabel(x.s.groupId))}</small></td><td>${x.a.total?x.a.rate+'%':'—'}</td><td>${x.g.avg!==null?Math.round(x.g.avg)+'%':'—'}</td><td>${paymentStatusText(x.pay)}</td><td><button class="tiny" data-profile="${x.s.id}">فتح الملف</button></td></tr>`).join('');
  $('#smartAnalysisRoot').innerHTML=`<div class="smart-backdrop" id="smartBackdrop"><section class="smart-modal" role="dialog" aria-modal="true" aria-label="التحليل الذكي"><button class="smart-close" id="closeSmartAnalysis">×</button><div class="smart-header"><div><span>✨ CLASSMIND AI</span><h2>تحليل ${esc(d.monthName)}</h2><p>${gradeText} · تحليل تلقائي من بيانات الحضور والدرجات والمصروفات.</p><div class="smart-controls"><label for="smartMonth">الشهر</label><input id="smartMonth" type="month" value="${esc(month)}"><button class="smart-refresh" id="refreshSmartAnalysis">↻ تحديث التحليل</button></div></div><div class="smart-score">AI<br><b>LIVE</b></div></div><div class="smart-insights"><article><b>📈</b><strong>${changeText}</strong><span>مقارنة بالشهر السابق</span></article><article><b>⚠️</b><strong>${d.lowAttendance.length} طالب</strong><span>حضورهم أقل من 70%</span></article><article><b>💰</b><strong>${d.collection}%</strong><span>نسبة تحصيل المصروفات</span></article><article><b>🎯</b><strong>${esc(d.bestGroup?.g?.name||'—')}</strong><span>${d.bestGroup?`أفضل متوسط ${Math.round(d.bestGroup.avg)}%`:'لا توجد درجات كافية'}</span></article></div><div class="smart-body"><div class="smart-panel"><div class="smart-panel-title"><h3>🔔 الطلاب الذين يحتاجون متابعة</h3><span>أولوية هذا الأسبوع · ${d.candidates.length}</span></div>${students?`<div class="table-wrap"><table class="smart-table"><thead><tr><th>الطالب</th><th>الحضور</th><th>الدرجات</th><th>المصروفات</th><th></th></tr></thead><tbody>${students}</tbody></table></div>`:'<div class="empty">لا توجد حالات تحتاج متابعة حاليًا 🎉</div>'}</div><div class="smart-panel"><div class="smart-panel-title"><h3>🧠 التوصية</h3></div><div class="smart-recommendation">${d.candidates.length?`ينصح النظام بمتابعة <b>${d.candidates.length} طلاب</b> خلال الأسبوع القادم، والبدء بالطلاب أصحاب أقل حضور أو انخفاض الدرجات. يمكن فتح ملف كل طالب للاطلاع على بياناته وإرسال ملخص لولي الأمر.`:'الأداء العام مستقر. استمر في متابعة الحضور والدرجات وتحصيل الاشتراكات شهريًا.'}</div><div class="smart-mini-list">${d.lowAttendance.slice(0,5).map(x=>`<div><span>⚠️ ${esc(x.s.name)}</span><b>${x.rate}% حضور</b></div>`).join('')||'<div>لا يوجد طلاب أقل من 70% حضور.</div>'}</div></div></div></section></div>`;
}
function reportsPage(){
 const month=window.classMindReportMonth||currentMonth();
 const f=monthlyFinance(month);
 const paidRows=f.rows.filter(x=>x.payment.status==='paid');
 const notPaidRows=f.rows.filter(x=>x.payment.status!=='paid' && x.fee>0);
 const maxFee=Math.max(1,...f.rows.map(x=>x.fee));
 const paidPct=f.expected?Math.min(100,Math.round(f.collected/f.expected*100)):0;
 const groups=db.groups.map(g=>{
   const rows=f.rows.filter(x=>x.s.groupId===g.id);
   return {g,count:rows.length,paid:rows.filter(x=>x.payment.status==='paid').length,unpaid:rows.filter(x=>x.payment.status!=='paid'&&x.fee>0).length,collected:rows.reduce((a,x)=>a+x.paid,0),expected:rows.reduce((a,x)=>a+x.fee,0)};
 });
 return `<div class="section-head"><div><h2>التقارير والتحليل المالي</h2><p>لوحة شهرية تفاعلية توضح من دفع، من لم يدفع، المحصل، المستحق، والمتبقي.</p></div><div class="report-actions"><input id="reportMonth" type="month" value="${esc(month)}"><button class="secondary" id="exportExcel">📊 تصدير Excel</button><button class="secondary" onclick="window.print()">🖨 طباعة التقرير</button></div></div>
 <div class="month-banner"><div><b>تقرير شهر ${esc(monthLabel(month))}</b><span>الحساب يتم من سعر المجموعة لكل طالب.</span></div><div class="month-progress"><div><span>نسبة التحصيل</span><b>${paidPct}%</b></div><div class="progress"><i style="width:${paidPct}%"></i></div></div></div>
 <div class="stats report-kpis">
   ${stat('الطلاب الذين دفعوا',f.paidCount,'✓',`من إجمالي ${db.students.length} طالب`)}
   ${stat('الطلاب الذين لم يدفعوا',f.unpaidCount,'!','لم يتم تسجيل أي مبلغ')}
   ${stat('مدفوع جزئيًا',f.partialCount,'◐','لم يكتمل الاشتراك بعد')}
   ${stat('إجمالي المحصل',cash(f.collected),'₪','هذا الشهر')}
   ${stat('المفروض تحصيله',cash(f.expected),'◎','حسب أسعار المجموعات')}
   ${stat('لسه مجمعناش',cash(f.outstanding),'↘','المتبقي حتى اكتمال الشهر')}
 </div>
 <div class="dashboard-grid">
   <div class="panel dashboard-card"><div class="panel-head"><h3>حالة الاشتراكات</h3><span class="muted">${f.paidCount} دفعوا بالكامل</span></div>
    <div class="finance-donut-wrap"><div class="finance-donut" style="--paid:${db.students.length?f.paidCount/db.students.length*100:0}%;--partial:${db.students.length?f.partialCount/db.students.length*100:0}%"><b>${f.paidCount}</b><small>دفع بالكامل</small></div>
    <div class="legend"><span><i class="dot present"></i>دفع بالكامل: ${f.paidCount}</span><span><i class="dot late"></i>جزئي: ${f.partialCount}</span><span><i class="dot absent"></i>لم يدفع: ${f.unpaidCount}</span></div></div>
   </div>
   <div class="panel dashboard-card"><div class="panel-head"><h3>المبالغ</h3><span class="muted">مقارنة المتوقع بالمحصل</span></div>
    <div class="money-bars"><div><span>المفروض</span><b>${cash(f.expected)}</b><i style="height:100%"></i></div><div><span>المحصل</span><b>${cash(f.collected)}</b><i style="height:${f.expected?Math.max(4,f.collected/f.expected*100):0}%"></i></div><div><span>المتبقي</span><b>${cash(f.outstanding)}</b><i style="height:${f.expected?Math.max(4,f.outstanding/f.expected*100):0}%"></i></div></div>
   </div>
 </div>
 <div class="panel report-panel"><div class="panel-head"><h3>🔴 الطلاب الذين لم يدفعوا</h3><span class="muted">${notPaidRows.length} طالب</span></div>${notPaidRows.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>الرقم</th><th>اسم الطالب</th><th>المجموعة</th><th>الصف</th><th>سعر الاشتراك</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${notPaidRows.map(x=>`<tr><td><code>${esc(x.s.serial)}</code></td><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button></td><td>${esc(groupLabel(x.s.groupId))}</td><td>${esc(x.s.grade)}</td><td>${cash(x.fee)}</td><td>${cash(x.paid)}</td><td class="money">${cash(x.payment.remaining)}</td><td><span class="metric ${x.payment.status==='partial'?'warn':'bad'}">${esc(paymentStatusText(x.payment))}</span></td><td><button class="tiny" data-pay-now="${x.s.id}">تسجيل دفع</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">🎉 كل الطلاب المسجلين دفعوا اشتراك هذا الشهر.</div>'}</div>
 <div class="panel report-panel"><div class="panel-head"><h3>🟢 الطلاب الذين دفعوا</h3><span class="muted">${paidRows.length} طالب · ${cash(f.collected)}</span></div>${paidRows.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>الرقم</th><th>اسم الطالب</th><th>المجموعة</th><th>الصف</th><th>سعر الاشتراك</th><th>المدفوع</th><th>تاريخ آخر دفع</th></tr></thead><tbody>${paidRows.map(x=>{const pays=db.payments.filter(p=>p.studentId===x.s.id&&p.month===month&&['paid','partial'].includes(p.status));const last=pays.sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')))[0];return `<tr><td>${esc(x.s.serial)}</td><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button></td><td>${esc(groupLabel(x.s.groupId))}</td><td>${esc(x.s.grade)}</td><td>${cash(x.fee)}</td><td class="money">${cash(x.paid)}</td><td>${esc(last?.createdAt?.slice(0,10)||last?.date||'—')}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">لا توجد مدفوعات مكتملة لهذا الشهر.</div>'}</div>
 <div class="panel report-panel"><div class="panel-head"><h3>تقرير المجموعات</h3><span class="muted">دفع · لم يدفع · المتوقع · المحصل</span></div>${groups.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>المجموعة</th><th>عدد الطلاب</th><th>دفع بالكامل</th><th>جزئي/لم يدفع</th><th>المفروض</th><th>المحصل</th><th>المتبقي</th></tr></thead><tbody>${groups.map(x=>`<tr><td><b>${esc(x.g.name)}</b></td><td>${x.count}</td><td><span class="metric">${x.paid}</span></td><td><span class="metric ${x.unpaid?'warn':''}">${x.unpaid}</span></td><td>${cash(x.expected)}</td><td class="money">${cash(x.collected)}</td><td>${cash(Math.max(0,x.expected-x.collected))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد مجموعات مسجلة.</div>'}</div>
 <div class="panel report-panel"><div class="panel-head"><h3>📈 مقارنة الشهر السابق</h3><span class="muted">درجات · حضور · تحصيل</span></div>${(()=>{const prev=monthDelta(month),g=monthGradeAverage(month),pg=monthGradeAverage(prev),a=monthAttendanceAverage(month),pa=monthAttendanceAverage(prev),pc=monthlyFinance(month),pp=monthlyFinance(prev),pct=pc.expected?Math.round(pc.collected/pc.expected*100):0,ppt=pp.expected?Math.round(pp.collected/pp.expected*100):0;const diff=(x,y)=>y?`${x-y>=0?'+':''}${Math.round(x-y)} نقطة`:'—';return `<div class="comparison-grid"><div><span>متوسط الدرجات</span><b>${g?Math.round(g)+'%':'—'}</b><small>${diff(g,pg)}</small></div><div><span>متوسط الحضور</span><b>${a?Math.round(a)+'%':'—'}</b><small>${diff(a,pa)}</small></div><div><span>التحصيل</span><b>${pct}%</b><small>${diff(pct,ppt)}</small></div></div>`})()}</div>
 <div class="panel report-panel"><div class="panel-head"><h3>🏆 أفضل الطلاب</h3><span class="muted">حسب متوسط درجات ${esc(monthLabel(month))}</span></div>${(()=>{const rows=topStudents(month,8);return rows.length?`<div class="table-wrap"><table class="report-table"><thead><tr><th>المركز</th><th>الطالب</th><th>المجموعة</th><th>متوسط الدرجات</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i<3?['🥇','🥈','🥉'][i]:i+1}</td><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button></td><td>${esc(groupLabel(x.s.groupId))}</td><td class="money">${Math.round(x.avg)}%</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد درجات كافية.</div>'})()}</div>
 <div class="panel report-panel"><div class="panel-head"><h3>ملخص سريع</h3></div><div class="finance-summary"><div><b>${db.students.length}</b><span>إجمالي الطلاب</span></div><div><b>${f.paidCount}</b><span>دفع بالكامل</span></div><div><b>${f.unpaidCount+f.partialCount}</b><span>لم يكتمل دفعهم</span></div><div><b>${paidPct}%</b><span>نسبة التحصيل المالي</span></div></div></div>`;
}

function insightsPage(){
 const month=window.classMindReportMonth||currentMonth(),d=smartAnalysisData(month),groups=groupGradeAnalysis(month),tops=topStudents(month,6);
 return `<div class="section-head"><div><h2>🧠 ClassMind Smart Center Insights</h2><p>تحليل تنفيذي يحول بيانات السنتر إلى قرارات متابعة واضحة.</p></div><div class="report-actions"><input id="reportMonth" type="month" value="${esc(month)}"><button class="smart-analysis-btn" id="smartAnalysisBtn2">✨ تحليل تفاعلي</button></div></div>
 <div class="insight-hero"><div><span>SMART CENTER INSIGHTS</span><h2>تحليل ${esc(d.monthName)}</h2><p>${d.candidates.length?`ينصح النظام بمتابعة ${d.candidates.length} طلاب خلال الأسبوع القادم.`:'الأداء العام مستقر هذا الشهر.'}</p></div><div class="insight-hero-score"><b>${d.collection}%</b><span>تحصيل</span></div></div>
 <div class="stats">${stat('متوسط الدرجات',d.currentAvg?Math.round(d.currentAvg)+'%':'—','📈','هذا الشهر')}${stat('متوسط الحضور',Math.round(monthAttendanceAverage(month))+'%','✓','من السجلات المسجلة')}${stat('أفضل مجموعة',d.bestGroup?.g?.name||'—','🎯',d.bestGroup?`متوسط ${Math.round(d.bestGroup.avg)}%`:'لا توجد بيانات')}${stat('أولوية المتابعة',d.candidates.length,'🔔','طلاب يحتاجون تدخلًا')}</div>
 <div class="dashboard-grid"><div class="panel"><div class="panel-head"><h3>🔴 قائمة المتابعة الذكية</h3><span class="muted">مرتبة حسب درجة المخاطرة</span></div>${d.candidates.length?`<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحضور</th><th>الدرجات</th><th>الدفع</th><th>السبب</th><th></th></tr></thead><tbody>${d.candidates.map(x=>`<tr><td><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button></td><td>${x.a.total?x.a.rate+'%':'—'}</td><td>${x.g.avg!==null?Math.round(x.g.avg)+'%':'—'}</td><td>${esc(paymentStatusText(x.pay))}</td><td>${x.a.total&&x.a.rate<70?'حضور منخفض · ':''}${x.g.avg!==null&&x.g.avg<70?'درجات منخفضة · ':''}${x.pay.status!=='paid'?'مصروفات غير مكتملة':''}</td><td><button class="tiny" data-profile="${x.s.id}">فتح الملف</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">🎉 لا توجد حالات عالية الأولوية.</div>'}</div><div class="panel"><div class="panel-head"><h3>🏆 أفضل الطلاب</h3></div>${tops.length?tops.map((x,i)=>`<div class="rank-row"><span>${i<3?['🥇','🥈','🥉'][i]:i+1}</span><button class="link-name" data-profile="${x.s.id}">${esc(x.s.name)}</button><b>${Math.round(x.avg)}%</b></div>`).join(''):'<div class="empty">لا توجد درجات.</div>'}</div></div>
 <div class="panel"><div class="panel-head"><h3>📊 مقارنة المجموعات</h3><span class="muted">حسب متوسط درجات الشهر</span></div>${groups.length?`<div class="group-insight-grid">${groups.map(x=>`<div class="group-insight"><div><b>${esc(x.g.name)}</b><span>${x.count} اختبارًا</span></div><strong>${Math.round(x.avg)}%</strong><div class="progress"><i style="width:${Math.min(100,x.avg)}%"></i></div></div>`).join('')}</div>`:'<div class="empty">سجل درجات أولًا لعرض المقارنة.</div>'}</div>`;
}
function treasuryPage(){
 const month=window.classMindReportMonth||currentMonth(),d=treasuryData(month), netClass=d.net>=0?'good':'bad';
 const form=editing?.kind==='expenses'?formHtml('expenses',db.expenses.find(x=>x.id===editing.id)||{}):'';
 return `<div class="section-head"><div><h2>💰 خزينة السنتر</h2><p>الإيرادات المحصلة والمصروفات وصافي الشهر في مكان واحد.</p></div><div class="report-actions"><input id="reportMonth" type="month" value="${esc(month)}"><button class="primary" id="addRecord">＋ تسجيل مصروف</button></div></div><div id="formMount">${form}</div><div class="stats">${stat('الإيرادات',cash(d.income),'↗','المحصل من الطلاب')}${stat('المصروفات',cash(d.expenses),'↘','المصروفات المسجلة')}${stat('صافي الشهر',cash(d.net),'₪',d.net>=0?'فائض':'عجز')}${stat('عدد المصروفات',d.rows.length,'🧾','عمليات مسجلة')}</div><div class="panel"><div class="panel-head"><h3>🧾 مصروفات ${esc(monthLabel(month))}</h3><span class="muted">يتم حفظها ضمن النسخة الاحتياطية وExcel</span></div>${d.rows.length?`<div class="table-wrap"><table><thead><tr><th>البند</th><th>المبلغ</th><th>طريقة الدفع</th><th>ملاحظات</th><th></th></tr></thead><tbody>${d.rows.map(x=>`<tr><td>${esc(x.category)}</td><td class="money">${cash(x.amount)}</td><td>${esc(x.method||'—')}</td><td>${esc(x.notes||'—')}</td><td><button class="tiny" data-del="expenses:${x.id}">حذف</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد مصروفات مسجلة لهذا الشهر.</div>'}</div>`;
}
function notificationsPage(){
 const month=window.classMindReportMonth||currentMonth(),items=notificationItems(month),detailType=window.notificationDetailType||'',detailTitles={lowGrades:'الطلاب أصحاب الدرجات المنخفضة',incompleteSubs:'الاشتراكات غير المكتملة',newTop:'المتفوقون الجدد',priority:'طلاب أولوية المتابعة',attendance:'الطلاب أصحاب الحضور المنخفض'};let details='';
 if(detailType){const rows=notificationStudents(detailType,month);details=`<div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>📋 ${detailTitles[detailType]||'تفاصيل الطلاب'}</h3><span class="muted">${rows.length} طالب · ${esc(monthLabel(month))}</span></div><button class="secondary" id="closeNotificationDetails">إغلاق القائمة</button></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>رقم الطالب</th><th>اسم الطالب</th><th>الصف</th><th>المجموعة</th><th>هاتف الطالب</th><th>ولي الأمر</th><th>هاتف ولي الأمر</th><th>التفاصيل</th><th>الملف</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.s.serial||'—')}</td><td>${esc(x.s.name||'—')}</td><td>${esc(x.s.grade||'—')}</td><td>${esc(groupLabel(x.s.groupId))}</td><td>${esc(x.s.phone||'—')}</td><td>${esc(x.s.parentName||'—')}</td><td>${esc(x.s.parentPhone||'—')}</td><td>${esc(x.reason||'يحتاج مراجعة')}</td><td><button class="tiny" data-profile="${x.s.id}">فتح الملف الكامل</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا يوجد طلاب في هذه الفئة حسب البيانات المسجلة للشهر المحدد.</div>'}</div>`;}
 return `<div class="section-head"><div><h2>🔔 مركز التنبيهات</h2><p>اضغط على «عرض الطلاب» لمعرفة الأسماء والبيانات وفتح الملف الكامل لكل طالب.</p></div><div class="report-actions"><input id="notificationMonth" type="month" value="${esc(month)}"><button class="smart-analysis-btn" id="smartAnalysisBtn2">✨ فتح التحليل الذكي</button></div></div><div class="notification-list">${items.length?items.map(x=>{const type=x.type||(x.title.includes('درجاتهم منخفضة')?'lowGrades':x.title.includes('اشتراك غير مكتمل')?'incompleteSubs':x.title.includes('متابعة حضور')?'attendance':x.title.includes('أولوية متابعة')?'priority':'newTop');return `<div class="notification-card ${x.level}"><div class="notification-icon">${x.level==='danger'?'⚠️':x.level==='warn'?'📉':x.level==='gold'?'💰':'⭐'}</div><div style="flex:1"><b>${esc(x.title)}</b><p>${esc(x.body)}</p><button class="tiny" data-notification-detail="${type}">عرض الطلاب والبيانات ←</button></div><span>${x.count}</span></div>`}).join(''):'<div class="panel empty">🎉 لا توجد تنبيهات عاجلة.</div>'}</div>${details}`;
}
function activityPage(){
 const rows=(db.auditLogs||[]).slice(0,120);return `<div class="section-head"><div><h2>🧾 سجل العمليات</h2><p>تاريخ آخر الإجراءات التي تمت داخل ClassMind AI.</p></div><span class="muted">${rows.length} عملية محفوظة</span></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${esc(new Date(x.at).toLocaleString('ar-EG'))}</td><td>${esc(x.user||'—')}</td><td><b>${esc(x.action)}</b></td><td>${esc(x.detail||'—')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">لا توجد عمليات مسجلة بعد.</td></tr>'}</tbody></table></div></div>`;
}
function backupRestorePanel(){return `<div class="modal-section"><h3>🛡️ حماية البيانات والنسخ الاحتياطي</h3><p class="muted">النسخة تشمل الطلاب والمجموعات والحضور والدرجات والمدفوعات والمصروفات وسجل المتابعة والإعدادات. احتفظ بنسخة خارج جهاز السنتر أيضًا.</p><div class="backup-summary"><span>الطلاب: <b>${db.students.length}</b></span><span>المجموعات: <b>${db.groups.length}</b></span><span>سجلات الحضور: <b>${db.attendance.length}</b></span><span>المدفوعات: <b>${db.payments.length}</b></span><span>المتابعات: <b>${(db.followUps||[]).length}</b></span></div><div class="backup-tools"><button class="primary" id="backupFromSettings">⬇️ إنشاء وتنزيل نسخة الآن</button><button class="secondary" id="restoreBackup">♻️ استعادة نسخة احتياطية</button></div></div><div class="backup-tools"><button class="secondary" id="demoData">🧪 تحميل بيانات تجريبية</button><button class="danger" id="clearDemoData">🗑 حذف جميع البيانات</button></div>`}
function render(){
 $('#title').textContent=language==='en'?(pageNamesEn[page]||pageNamesEn.dashboard):(pageNames[page]||pageNames.dashboard);$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 $('#content').innerHTML=`<div class="muted" style="text-align:left;margin:0 0 10px" id="liveDateTime">${new Intl.DateTimeFormat('ar-EG',{dateStyle:'full',timeStyle:'medium'}).format(new Date())}</div>`+(page==='dashboard'?dashboard():page==='archive'?archivePage():page==='attendance'?attendancePage():page==='reports'?reportsPage():page==='insights'?insightsPage():page==='topStudents'?topStudentsPage():page==='treasury'?treasuryPage():page==='staff'?staffPage():page==='notifications'?notificationsPage():page==='activity'?activityPage():page==='settings'?settingsPage():entityPage(page));document.documentElement.lang=language;document.documentElement.dir=language==='en'?'ltr':'rtl';if(language==='en')translateRenderedUI();
}
// الأقسام المحمية برمز من الإعدادات: الخزينة، التقارير المالية، الموظفين.
const LOCKED_PAGES=['treasury','reports','staff'];
let financePassFor=null;
function go(next){
 if(LOCKED_PAGES.includes(next)){
   if(financePassFor!==next){openFinanceGate(next);return}
   financePassFor=null;
 }
 page=next;editing=null;searchValue='';render();window.scrollTo({top:0,behavior:'smooth'})
}
function openFinanceGate(target){
 const hasCode=!!db.settings?.financeCode;
 $('#modalRoot').innerHTML=`<div class="modal-backdrop" id="financeGate"><div class="modal finance-gate" role="dialog" aria-modal="true" aria-labelledby="financeGateTitle" style="max-width:440px;margin:auto"><div class="modal-head"><div><h2 id="financeGateTitle">🔒 قسم محمي</h2><span class="muted">${esc(pageNames[target]||'')}</span></div><button class="modal-close" type="button" id="closeFinanceGate">إغلاق ✕</button></div>${hasCode?`<form id="financeGateForm" data-target="${esc(target)}"><div class="field"><label for="financeGateCode">أدخل رمز الحسابات والموظفين</label><input id="financeGateCode" name="financeCode" type="password" autocomplete="off" required></div><p class="muted" id="financeGateMsg" role="status"></p><div class="actions"><button class="primary" type="submit">فتح القسم</button></div></form>`:`<p class="muted">لم يتم تحديد رمز لهذه الأقسام بعد. افتح الإعدادات وأنشئ «رمز الحسابات والموظفين» أولًا.</p><div class="actions"><button class="primary" type="button" id="gotoSettingsFromGate">الذهاب إلى الإعدادات</button></div>`}</div></div>`;
 setTimeout(()=>document.querySelector('#financeGateCode')?.focus(),50);
}
function staffPaidFor(staffId,month){return (db.expenses||[]).some(x=>x.staffId===staffId&&x.month===month)}
// ── كود الموظف وبطاقته ──
function nextStaffCode(){
 const nums=(db.staff||[]).map(x=>Number(String(x.code||'').replace(/\D/g,''))||0);
 return 'STF-'+String(Math.max(0,...nums)+1).padStart(3,'0');
}
function ensureStaffCodes(){
 if(!Array.isArray(db.staff))db.staff=[];
 db.staff.forEach(st=>{if(!st.code)st.code=nextStaffCode();});
}
function staffCardMarkup(st){
 const qr=qrSvg(st.code||st.id,4),settings=db.settings||{};
 return `<article class="cm-student-card cm-staff-card"><div class="cm-card-top"><div class="cm-card-brand"><span class="cm-card-logo">ع</span><div><b>CLASSMIND AI</b><small>${esc(settings.centerName||'السنتر التعليمي')}</small></div></div><span class="cm-card-chip">STAFF ID</span></div><div class="cm-card-body"><div class="cm-card-details"><div class="cm-card-label">بطاقة موظف</div><h2>${esc(st.name||'—')}</h2><div class="cm-card-field"><span>كود الموظف</span><b>${esc(st.code||'—')}</b></div><div class="cm-card-field"><span>الوظيفة</span><b>${esc(st.role||'مساعد')}</b></div><div class="cm-card-field"><span>الهاتف</span><b>${esc(st.phone||'—')}</b></div><div class="cm-card-teacher">المدرس: ${esc(settings.teacherName||'—')}</div></div><div class="cm-card-qr">${qr}<small>امسح لتسجيل الدخول والانصراف</small></div></div><div class="cm-card-footer"><span>STAFF ACCESS</span><span>DESIGNED BY ALI ASHRAF</span></div></article>`;
}
function openStaffCard(id){
 const st=(db.staff||[]).find(x=>x.id===id);if(!st)return;
 $('#modalRoot').innerHTML=`<div class="modal-backdrop" id="staffCardBackdrop"><div class="modal" role="dialog" aria-modal="true" style="max-width:600px;margin:auto"><div class="modal-head"><div><h2>🎫 بطاقة ${esc(st.name)}</h2><span class="muted">كود ${esc(st.code||'—')}</span></div><button class="modal-close" type="button" id="closeStaffCard">إغلاق ✕</button></div><div class="student-profile-card">${staffCardMarkup(st)}</div><div class="actions"><button class="primary" type="button" data-staff-print="${esc(st.id)}">🖨 طباعة البطاقة</button></div></div></div>`;
}
function printStaffCard(id){
 const st=(db.staff||[]).find(x=>x.id===id);if(!st)return;
 const w=window.open('','_blank');if(!w){say('اسمح بفتح نافذة الطباعة لبطاقة الموظف.',true);return}
 w.document.open();w.document.write(studentCardsPrintDocument(staffCardMarkup(st),'بطاقة الموظف'));w.document.close();
}

// ── حضور الموظفين: كل مسح يتبادل بين دخول وانصراف ──
function staffTodayRecords(staffId,date=today()){
 return (db.staffAttendance||[]).filter(a=>a.staffId===staffId&&a.date===date).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
}
async function recordStaffScan(code){
 const clean=String(code||'').trim().toUpperCase();
 const st=(db.staff||[]).find(x=>String(x.code||'').toUpperCase()===clean);
 if(!st){say('كود الموظف غير موجود. تأكد من الباركود أو من الكود في قسم الموظفين.',true);return null}
 const recs=staffTodayRecords(st.id);
 const type=recs.length&&recs[recs.length-1].type==='in'?'out':'in';
 const at=new Date().toISOString();
 if(!Array.isArray(db.staffAttendance))db.staffAttendance=[];
 db.staffAttendance.push({id:uid(),staffId:st.id,date:today(),type,at});
 logAction(type==='in'?'تسجيل دخول موظف':'تسجيل انصراف موظف',`${st.name} — ${today()}`);
 return (await save())?{st,type,at}:null;
}
function playStaffChime(){
 return new Promise(resolve=>{
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC){resolve();return}
   const ctx=new AC();
   if(ctx.state==='suspended')ctx.resume().catch(()=>{});
   const t0=ctx.currentTime+0.02;
   // نغمتان ناعمتان متتابعتان (جرس) بدل صفارة الطلاب
   [[659.25,0],[880,0.22]].forEach(([f,d])=>{
     const o=ctx.createOscillator(),g=ctx.createGain();
     o.type='sine';o.frequency.value=f;
     g.gain.setValueAtTime(0.0001,t0+d);g.gain.exponentialRampToValueAtTime(0.25,t0+d+0.03);g.gain.exponentialRampToValueAtTime(0.0001,t0+d+0.6);
     o.connect(g);g.connect(ctx.destination);o.start(t0+d);o.stop(t0+d+0.65);
   });
   setTimeout(()=>ctx.close().catch(()=>{}),1500);
   setTimeout(resolve,820);
  }catch(err){console.warn('Staff chime unavailable',err);resolve();}
 });
}
async function staffFeedback(st,type){
 const token=++attendanceSpeechToken;
 stopSpeech();
 await playStaffChime();
 if(token!==attendanceSpeechToken)return;
 await speakArabic(type==='in'?`أهلًا بك ${st.name}، تم تسجيل دخولك`:`مع السلامة ${st.name}، تم تسجيل انصرافك`);
 if(token!==attendanceSpeechToken)return;
 await speakEnglish(type==='in'?'Welcome, you are checked in':'Goodbye, you are checked out');
}

function showStaffCardPopup(st,type,at){
 document.querySelector('#attendanceCardPopup')?.remove();
 clearTimeout(showAttendanceCardPopup.timer);
 const time=new Date(at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
 const box=document.createElement('div');
 box.id='attendanceCardPopup';box.className='attendance-pop-backdrop';
 box.innerHTML=`<div class="attendance-pop student-profile-card" role="status" aria-live="polite"><div class="attendance-pop-badge ${type==='in'?'staff-in':'staff-out'}">${type==='in'?'🟢 تسجيل دخول':'🟠 تسجيل انصراف'} · ${esc(time)}</div>${staffCardMarkup(st)}<div class="payment-check"><div class="payment-check-main"><div><b>${esc(st.name)}</b><span>${esc(st.role||'موظف')}</span></div><strong>${type==='in'?'داخل السنتر الآن':'خرج من السنتر'}</strong></div></div><button type="button" class="secondary" id="closeAttendancePop">إغلاق</button></div>`;
 box.addEventListener('click',e=>{if(e.target.closest('#closeAttendancePop'))box.remove()});
 document.body.appendChild(box);
 showAttendanceCardPopup.timer=setTimeout(()=>box.remove(),12000);
}
function staffTimeLabel(at){return new Date(at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
function staffTodayHtml(){
 const list=(db.staff||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
 if(!list.length)return '<div class="empty">لا يوجد موظفون مسجلون. أضفهم من قسم الموظفين.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الاسم</th><th>الحالة اليوم</th><th>آخر تسجيل</th></tr></thead><tbody>${list.map(st=>{const recs=staffTodayRecords(st.id);const last=recs[recs.length-1];return `<tr><td><code>${esc(st.code||'—')}</code></td><td>${esc(st.name)}</td><td>${!last?'لم يحضر بعد':last.type==='in'?'<span class="metric">داخل السنتر</span>':'<span class="metric bad">خرج</span>'}</td><td>${last?staffTimeLabel(last.at):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
}
function staffTable(rows,month=window.classMindReportMonth||currentMonth()){
 return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الاسم</th><th>الوظيفة</th><th>الهاتف</th><th>المرتب الشهري</th><th>صرف ${esc(monthLabel(month))}</th><th>حضور اليوم</th><th>إجراءات</th></tr></thead><tbody>${rows.map(r=>{const paid=staffPaidFor(r.id,month);const recs=staffTodayRecords(r.id);const last=recs[recs.length-1];const now=!last?'لم يحضر':last.type==='in'?'داخل السنتر':'خرج';return `<tr><td><code>${esc(r.code||'—')}</code></td><td><b>${esc(r.name||'—')}</b></td><td>${esc(r.role||'—')}</td><td>${esc(r.phone||'—')}</td><td class="money">${cash(r.salary)}</td><td>${paid?'<span class="metric">تم الصرف ✓</span>':`<button class="tiny primary" data-staff-pay="${esc(r.id)}">💵 صرف المرتب</button>`}</td><td>${esc(now)}</td><td><button class="tiny" data-staff-card="${esc(r.id)}">🎫 البطاقة</button> <button class="tiny" data-edit="staff:${esc(r.id)}">تعديل</button> <button class="tiny" data-del="staff:${esc(r.id)}">حذف</button></td></tr>`}).join('')}</tbody></table></div>`;
}
function staffPage(){
 const month=window.classMindReportMonth||currentMonth();
 const all=(db.staff||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
 const q=String(searchValue||'').toLowerCase();
 const rows=all.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
 const total=all.reduce((a,r)=>a+Number(r.salary||0),0);
 const paidRows=all.filter(r=>staffPaidFor(r.id,month));
 const paidTotal=paidRows.reduce((a,r)=>a+Number(r.salary||0),0);
 const record=editing?.kind==='staff'?(db.staff||[]).find(x=>x.id===editing.id):null;
 return `<div class="section-head"><div><h2>👥 الموظفين والمساعدون</h2><p>أسماء المساعدين ومرتب كل واحد. صرف المرتب يُسجَّل تلقائيًا كمصروف في الخزينة.</p></div><div class="report-actions"><input id="reportMonth" type="month" value="${esc(month)}"><button class="primary" id="addRecord">＋ إضافة موظف</button></div></div>
 <div id="formMount">${record?formHtml('staff',record):''}</div>
 <div class="stats">${stat('عدد الموظفين',all.length,'👥','المساعدون المسجلون')}${stat('إجمالي المرتبات',cash(total),'₪','مجموع المرتبات الشهرية')}${stat('تم صرفه هذا الشهر',`${paidRows.length} / ${all.length}`,'✓',cash(paidTotal))}</div>
 <div class="toolbar"><input class="search" id="search" placeholder="🔎 ابحث باسم الموظف أو وظيفته..." value="${esc(searchValue)}"><span class="muted">${rows.length} موظف</span></div>
 <div class="panel">${rows.length?staffTable(rows,month):'<div class="empty">لا يوجد موظفون مسجلون. اضغط «إضافة موظف».</div>'}</div>`;
}
async function paySalary(staffId,month=window.classMindReportMonth||currentMonth()){
 const st=(db.staff||[]).find(x=>x.id===staffId);if(!st)return;
 if(staffPaidFor(staffId,month)){say('تم صرف مرتب هذا الشهر لهذا الموظف بالفعل.',true);return}
 const amount=Math.round(Number(st.salary||0)*100)/100;
 if(amount<=0){say('حدد المرتب الشهري لهذا الموظف أولًا من زر تعديل.',true);return}
 if(!confirm(`تسجيل صرف مرتب ${st.name} (${cash(amount)}) لشهر ${monthLabel(month)} كمصروف في الخزينة؟`))return;
 if(!Array.isArray(db.expenses))db.expenses=[];
 db.expenses.push({id:uid(),month,category:`مرتب: ${st.name}`,amount,method:'مرتب',notes:`مرتب شهر ${monthLabel(month)}`,staffId:st.id,createdAt:new Date().toISOString()});
 logAction('صرف مرتب موظف',`${st.name} — ${cash(amount)} — ${month}`);
 if(await save()){render();say(`تم تسجيل صرف مرتب ${st.name} في الخزينة.`)}
}
function openProfile(sid){
 const s=student(sid);if(!s)return;activeStudent=sid;
 const g=group(s.groupId),payments=db.payments.filter(p=>p.studentId===sid).sort((a,b)=>b.month.localeCompare(a.month)),grades=db.grades.filter(x=>x.studentId===sid).sort((a,b)=>b.date.localeCompare(a.date));
 const attendance=db.attendance.filter(a=>a.studentId===sid);
 $('#modalRoot').innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${esc(s.name)}</h2><span class="muted">الملف الشخصي للطالب · ${esc(s.serial)}</span></div><button class="modal-close" id="closeModal">إغلاق ✕</button></div>
 <div class="profile-grid"><div class="detail"><small>الصف الدراسي</small><b>${esc(s.grade)}</b></div><div class="detail"><small>المجموعة</small><b>${esc(groupLabel(s.groupId))} — ${g?cash(g.price)+'/شهر':'لا توجد مجموعة'}</b></div><div class="detail"><small>رقم الطالب</small><b>${esc(s.phone||'غير مسجل')}</b></div><div class="detail"><small>ولي الأمر</small><b>${esc(s.parentName||'غير مسجل')} — ${esc(s.parentPhone||'لا يوجد رقم')}</b></div><div class="detail"><small>إجمالي المدفوع</small><b>${cash(totalPaid(sid))}</b></div><div class="detail"><small>سجلات الحضور</small><b>${attendance.length} سجل · ${attendance.filter(a=>a.status==='absent').length} غياب</b></div></div>
 <div class="modal-section remainder-payment-panel"><div class="panel-head"><div><h3>💰 تسجيل المتبقي</h3><span class="muted">اشتراك ${esc(monthLabel(currentMonth()))}</span></div><strong>${cash(monthlyPaymentStatus(sid).remaining)}</strong></div><p class="muted">المدفوع: ${cash(monthlyPaymentStatus(sid).paid)} · إجمالي الاشتراك: ${cash(monthlyPaymentStatus(sid).fee)}</p><button class="primary" data-profile-action="settle-remainder" ${monthlyPaymentStatus(sid).remaining<=0?'disabled':''}>✓ تسجيل المتبقي فقط</button></div>
 <div class="modal-section student-profile-card"><div class="panel-head"><h3>🎫 بطاقة الطالب والباركود</h3><button class="secondary" data-profile-action="card-print">🖨 طباعة البطاقة</button></div>${studentCardMarkup(s)}</div>
 <div class="modal-section student-actions"><button class="primary" data-profile-action="payment">＋ تسجيل دفعة</button><button class="secondary" data-profile-action="grade">＋ إضافة درجة</button><button class="secondary" data-profile-action="whatsapp">✉ إرسال ملخص لولي الأمر</button><button class="secondary" data-profile-action="print">طباعة ملف الطالب</button><button class="danger" data-profile-action="delete">حذف الطالب</button></div>
 <div class="modal-section"><h3>المدفوعات الشهرية</h3>${payments.length?`<div class="table-wrap"><table><thead><tr><th>الشهر</th><th>المبلغ</th><th>الحالة</th><th>طريقة الدفع</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(p.month)}</td><td>${cash(p.amount)}</td><td>${p.status==='paid'?'مدفوع':p.status==='partial'?'جزئي':'غير مدفوع'}</td><td>${esc(p.method||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد دفعات مسجلة.</div>'}</div>
 <div class="modal-section"><h3>درجات الامتحانات</h3>${grades.length?`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الامتحان</th><th>الدرجة</th><th>النسبة</th></tr></thead><tbody>${grades.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.exam)}</td><td>${esc(x.score)} / ${esc(x.total)}</td><td>${Math.round(Number(x.score)/Math.max(1,Number(x.total))*100)}%</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد درجات مسجلة.</div>'}</div>
 <div class="modal-section"><h3>🗓️ سجل المتابعة</h3>
 <form id="followUpForm" class="followup-form" data-student-id="${esc(sid)}"><div class="form-grid"><div class="field"><label for="followUpDate">موعد المتابعة</label><input id="followUpDate" name="dueDate" type="date" value="${today()}" required></div><div class="field"><label for="followUpType">نوع المتابعة</label><select id="followUpType" name="type"><option value="academic">دراسية</option><option value="attendance">حضور وغياب</option><option value="financial">مالية</option><option value="parent">التواصل مع ولي الأمر</option><option value="other">أخرى</option></select></div><div class="field"><label for="followUpStatus">الحالة</label><select id="followUpStatus" name="status"><option value="open">مفتوحة</option><option value="done">تمت</option></select></div></div><div class="field" style="margin-top:10px"><label for="followUpNote">الملاحظة / الإجراء</label><textarea id="followUpNote" name="note" required maxlength="1500" placeholder="اكتب سبب المتابعة والإجراء المتخذ..."></textarea></div><div class="actions"><button class="primary" type="submit">＋ حفظ المتابعة</button></div></form>
 ${db.followUps.filter(x=>x.studentId===sid).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).length?`<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>موعد المتابعة</th><th>النوع</th><th>الملاحظة</th><th>الحالة</th><th></th></tr></thead><tbody>${db.followUps.filter(x=>x.studentId===sid).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(x=>`<tr><td>${esc(x.dueDate||'—')}</td><td>${({academic:'دراسية',attendance:'حضور وغياب',financial:'مالية',parent:'ولي الأمر',other:'أخرى'})[x.type]||'أخرى'}</td><td>${esc(x.note||'—')}</td><td><span class="pill ${x.status==='done'?'':'warn'}">${x.status==='done'?'تمت':'مفتوحة'}</span></td><td><button class="tiny" data-followup-toggle="${esc(x.id)}">${x.status==='done'?'إعادة فتح':'إنهاء'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">لا توجد متابعات مسجلة لهذا الطالب.</div>'}</div>
 <div class="modal-section"><h3>ملاحظات عامة</h3><p>${esc(s.notes||'لا توجد ملاحظات.')}</p></div></div></div>`;
}
function closeModal(){$('#modalRoot').innerHTML='';activeStudent=null}
async function deleteStudentRecord(sid){
 const s=student(sid);if(!s)return;
 const confirmed=confirm(`هل تريد أرشفة الطالب «${s.name}»؟ سيتم إخفاؤه من القوائم النشطة مع الاحتفاظ بسجلات الحضور والمدفوعات والدرجات والمتابعات للتقارير. يمكن استرجاع البيانات من النسخة الاحتياطية.`);
 if(!confirmed)return;
 s.archived=true;s.archivedAt=new Date().toISOString();
 logAction('أرشفة طالب',`${s.name} — الرقم ${s.serial}`);
 if(await save()){closeModal();render();say(`تمت أرشفة الطالب ${s.name} مع الاحتفاظ بسجلاته التاريخية.`)}
}
function showInlineForm(kind,sid){
 const studentId=sid||activeStudent;closeModal();page=kind;editing=null;render();
 if(studentId&&kind==='payments'){
   $('#formMount').innerHTML=formHtml(kind,{studentId,month:today().slice(0,7),amount:group(student(studentId)?.groupId)?.price||'',status:'paid'});
 }else if(studentId&&kind==='grades'){
   $('#formMount').innerHTML=formHtml(kind,{studentId,date:today()});
 }
 $('#formMount')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function makeParentMessage(sid){
 const s=student(sid),g=group(s.groupId);if(!s)return '';
 const month=today().slice(0,7),pay=db.payments.find(p=>p.studentId===sid&&p.month===month&&p.status==='paid');
 const due=pay?'تم تسجيل سداد اشتراك الشهر الحالي.':g?`اشتراك الشهر الحالي ${cash(g.price)} ولم يتم تسجيل سداد كامل له في النظام.`:'لم تُحدد مجموعة أو قيمة اشتراك للطالب.';
 const grades=db.grades.filter(x=>x.studentId===sid).slice(-5).map(x=>`${x.exam}: ${x.score}/${x.total}`).join('، ')||'لا توجد درجات مسجلة حاليًا';
 const abs=db.attendance.filter(x=>x.studentId===sid&&x.status==='absent').length;
 return `مرحبًا أ/ ${s.parentName||'ولي الأمر'}،\nملخص الطالب: ${s.name}\nالصف: ${s.grade}\nالمجموعة: ${g?.name||'غير محددة'}\nالاشتراك: ${due}\nالدرجات الأخيرة: ${grades}\nعدد حالات الغياب المسجلة: ${abs}\nمع تحيات أ/ ${db.settings?.teacherName||'إدارة السنتر'}
${db.settings?.centerName||'العقل الذكي ClassMind AI'}`;
}
function sendWhatsApp(sid){
 const s=student(sid);if(!s?.parentPhone){say('أضف رقم هاتف ولي الأمر أولًا من ملف الطالب.',true);return}
 if(!db.settings?.teacherWhatsapp){say('سجّل رقم واتساب المدرس من الإعدادات أولًا.',true);return}
 const phone=s.parentPhone.replace(/\D/g,'').replace(/^0/,'20');
 const url=`https://wa.me/${phone}?text=${encodeURIComponent(makeParentMessage(sid))}`;
 window.open(url,'_blank','noopener,noreferrer');
}


function validateBackupData(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.students)||!Array.isArray(data.groups))throw new Error('ملف النسخة غير صالح: يجب أن يحتوي على قوائم الطلاب والمجموعات.');
 for(const key of ['attendance','payments','grades','expenses','followUps','auditLogs','staff','staffAttendance']) if(data[key]!==undefined&&!Array.isArray(data[key]))throw new Error(`بنية النسخة غير صالحة في قسم ${key}.`);
 if(data.students.some(s=>!s||typeof s!=='object'||!s.id||!String(s.name||'').trim()))throw new Error('تحتوي النسخة على سجل طالب غير مكتمل.');
 if(data.groups.some(g=>!g||typeof g!=='object'||!g.id||!String(g.name||'').trim()))throw new Error('تحتوي النسخة على سجل مجموعة غير مكتمل.');
 return true;
}
async function restoreBackup(){
 try{
   let data=null;
   if(window.classMindDesktop?.importBackup){const r=await window.classMindDesktop.importBackup();if(!r||r.canceled)return; if(!r.ok||!r.data)throw new Error('تعذر قراءة ملف النسخة.');data=r.data;}
   else{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';data=await new Promise((resolve,reject)=>{input.onchange=async()=>{const f=input.files?.[0];if(!f){resolve(null);return}try{resolve(JSON.parse(await f.text()))}catch(err){reject(new Error('الملف ليس JSON صالحًا.'))}};input.click()});if(!data)return;}
   validateBackupData(data);
   if(!confirm(`سيتم استبدال البيانات الحالية (${db.students.length} طالب) بالنسخة المحددة (${data.students.length} طالب). يُنصح بإنشاء نسخة من البيانات الحالية أولًا. هل تريد المتابعة؟`))return;
   // Save the current state as a recoverable browser snapshot before replacement.
   try{localStorage.setItem('classmind-pre-restore-'+Date.now(),JSON.stringify({backupFormat:'ClassMindAI',schemaVersion:2,exportedAt:new Date().toISOString(),...db}));}catch(_e){}
   const previous=db;
   db={...EMPTY,...data,settings:{...EMPTY.settings,...(data.settings||{})}};
   for(const key of ['students','groups','attendance','payments','grades','expenses','followUps','auditLogs','staff','staffAttendance'])if(!Array.isArray(db[key]))db[key]=[];
   ensureStaffCodes();
   normalizeSerials();logAction('استعادة نسخة احتياطية',`تم استيراد نسخة تحتوي على ${db.students.length} طالب`);
   if(!(await save())){db=previous;return;}
   render();updateEntryIdentity();say('تمت استعادة النسخة الاحتياطية والتحقق من بنيتها بنجاح.');
 }catch(e){say('تعذر استعادة النسخة الاحتياطية: '+(e.message||e),true)}
}
async function loadDemoData(){
 if(!confirm('سيتم استبدال البيانات الحالية ببيانات تجريبية. هل تريد المتابعة؟'))return;
 const groups=[{id:uid(),name:'المجموعة الأولى',subject:db.settings.subject||'المادة',teacher:db.settings.teacherName||'المدرس',grade:'ثالث ثانوي',schedule:'السبت 6 مساءً',price:350},{id:uid(),name:'المجموعة الثانية',subject:db.settings.subject||'المادة',teacher:db.settings.teacherName||'المدرس',grade:'ثاني ثانوي',schedule:'الأحد 5 مساءً',price:300},{id:uid(),name:'المجموعة الثالثة',subject:db.settings.subject||'المادة',teacher:db.settings.teacherName||'المدرس',grade:'أولى ثانوي',schedule:'الإثنين 7 مساءً',price:320}];
 const names=['أحمد محمد','محمد علي','عمر خالد','يوسف أحمد','محمود حسن','آدم كريم','سيف وليد','عبدالله سامح','زياد محمود','علي حسن','مصطفى أحمد','ياسين محمد'];
 const students=names.map((name,i)=>({id:uid(),serial:String(Math.floor(i/3)+1),createdAt:new Date().toISOString(),name,phone:'01000000000',grade:groups[i%3].grade,groupId:groups[i%3].id,parentName:'ولي أمر '+name,parentPhone:'01000000000',notes:i%4===0?'يحتاج متابعة إضافية':''}));
 const month=currentMonth();const attendance=[],grades=[],payments=[];students.forEach((s,i)=>{for(let d=1;d<=8;d++){const date=`${month}-${String(d).padStart(2,'0')}`;attendance.push({id:uid(),studentId:s.id,date,status:(i===1||i===5)?(d%3===0?'absent':'present'):(d%5===0?'late':'present')})}const avg=[92,58,64,87,78,55,81,72,96,69,88,76][i];for(let q=1;q<=3;q++)grades.push({id:uid(),studentId:s.id,date:`${month}-${String(q+1).padStart(2,'0')}`,exam:'اختبار '+q,score:Math.round(avg*q/3),total:100,notes:''});const fee=groups[i%3].price;const ratio=[1,0,.6,1,1,.4,.8,1,1,.5,1,.7][i];payments.push({id:uid(),studentId:s.id,month,amount:Math.round(fee*ratio),status:ratio>=1?'paid':ratio>0?'partial':'unpaid',method:'نقدي',notes:''})});
 db={...EMPTY,students,groups,attendance,grades,payments,expenses:[{id:uid(),month,category:'إعلانات',amount:900,method:'نقدي',notes:'حملة الشهر'}],auditLogs:[],settings:{...db.settings,subject:db.settings.subject||'الفيزياء',serialScheme:SERIAL_SCHEME}};logAction('تحميل بيانات تجريبية',`تم إنشاء ${students.length} طالب و${groups.length} مجموعات`);await save();render();updateEntryIdentity();say('تم تحميل بيانات تجريبية جاهزة للعرض.');
}
document.addEventListener('click',async e=>{
 if(e.target.closest('#themeToggle')){applyTheme(document.body.dataset.theme==='light'?'dark':'light');return}
 if(e.target.closest('#closeFinanceGate')){$('#modalRoot').innerHTML='';return}
 const staffCardBtn=e.target.closest('[data-staff-card]');if(staffCardBtn){openStaffCard(staffCardBtn.dataset.staffCard);return}
 const staffPrint=e.target.closest('[data-staff-print]');if(staffPrint){printStaffCard(staffPrint.dataset.staffPrint);return}
 if(e.target.closest('#closeStaffCard')){$('#modalRoot').innerHTML='';return}
 if(e.target.closest('#gotoSettingsFromGate')){$('#modalRoot').innerHTML='';go('settings');return}
 const staffPay=e.target.closest('[data-staff-pay]');if(staffPay){await paySalary(staffPay.dataset.staffPay);return}
 if(e.target.closest('#finishAttendanceGroup')){
   const groupId=$('#attendanceGroup')?.value,date=$('#attendanceDate')?.value||today();
   if(!groupId){say('اختر المجموعة أولًا.',true);return}
   const members=db.students.filter(st=>!st.archived&&String(st.groupId||'')===String(groupId));
   if(!members.length){say('لا يوجد طلاب مسجلون في هذه المجموعة.',true);return}
   const missed=[];
   for(const st of members){
     const existing=db.attendance.find(a=>a.studentId===st.id&&a.date===date);
     if(!existing){db.attendance.push({id:uid(),studentId:st.id,date,status:'absent',autoMarked:true,createdAt:new Date().toISOString(),notes:'غياب تلقائي عند إنهاء تسجيل المجموعة'});missed.push(st);}
   }
   logAction('إنهاء تسجيل حضور مجموعة',`${groupLabel(groupId)} — ${date} — غياب تلقائي ${missed.length} طالب`);
   if(await save()){
     const absentMembers=members.filter(st=>db.attendance.some(a=>a.studentId===st.id&&a.date===date&&a.status==='absent'));
     const box=$('#attendanceCloseReport');
     if(box){box.className='payment-check';box.innerHTML=`<b>تقرير غياب مجموعة ${esc(groupLabel(groupId))} — ${esc(date)}</b><p>عدد الغائبين: ${absentMembers.length} (تم تسجيل ${missed.length} منهم تلقائيًا)</p>${absentMembers.length?`<ol>${absentMembers.map(st=>`<li>${esc(st.name)} — رقم ${esc(st.serial)}</li>`).join('')}</ol>`:'<p>لا يوجد غياب مسجل لهذه المجموعة.</p>'}<button type="button" class="secondary" id="printAttendanceCloseReport">🖨 طباعة التقرير</button>`;}
     say(`تم إنهاء المجموعة. سُجل ${missed.length} طالب غائبًا تلقائيًا.`);
   }
   return;
 }
 if(e.target.closest('#printAttendanceCloseReport')){
   const box=$('#attendanceCloseReport');if(!box)return;
   const w=window.open('','_blank');if(!w){say('اسمح بالنوافذ المنبثقة لطباعة التقرير.',true);return}
   w.document.write(`<html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير الغياب</title><style>body{font-family:Arial;margin:30px}li{margin:8px 0}</style><body>${box.innerHTML.replace(/<button[\s\S]*?<\/button>/,'')}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();return;
 }
 const notificationDetail=e.target.closest('[data-notification-detail]');if(notificationDetail){window.notificationDetailType=notificationDetail.dataset.notificationDetail;render();return}
 if(e.target.closest('#closeNotificationDetails')){window.notificationDetailType='';render();return}
 if(e.target.closest('#smartAnalysisBtn')||e.target.closest('#smartAnalysisBtn2')){showSmartAnalysis(document.querySelector('#reportMonth')?.value||currentMonth());return}
 if(e.target.closest('#closeSmartAnalysis')||e.target.id==='smartBackdrop'){document.querySelector('#smartBackdrop')?.remove();return}
 if(e.target.closest('#refreshSmartAnalysis')){showSmartAnalysis(document.querySelector('#smartMonth')?.value||currentMonth());return}
 const nav=e.target.closest('[data-page]');if(nav){go(nav.dataset.page);return}
 const quick=e.target.closest('[data-go]');if(quick){go(quick.dataset.go);return}
 if(e.target.closest('#addRecord')){editing={kind:page==='treasury'?'expenses':page,id:null};if(page==='treasury'){render();}else{$('#formMount').innerHTML=formHtml(page,{});}$('#formMount')?.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(e.target.closest('#cancelForm')){editing=null;render();return}
 const payNow=e.target.closest('[data-pay-now]');if(payNow){showInlineForm('payments',payNow.dataset.payNow);return}
 const profile=e.target.closest('[data-profile]');if(profile){openProfile(profile.dataset.profile);return}
 const edit=e.target.closest('[data-edit]');if(edit){const [kind,id]=edit.dataset.edit.split(':');editing={kind,id};render();$('#formMount')?.scrollIntoView({behavior:'smooth',block:'start'});return}
 const deleteStudent=e.target.closest('[data-delete-student]');if(deleteStudent){await deleteStudentRecord(deleteStudent.dataset.deleteStudent);return}
 const restoreStudent=e.target.closest('[data-restore-student]');if(restoreStudent){const st=student(restoreStudent.dataset.restoreStudent);if(st&&confirm(`استرجاع الطالب ${st.name} إلى قائمة الطلاب النشطة؟`)){st.archived=false;delete st.archivedAt;reserveSerialForStudent(st);logAction('استرجاع طالب من الأرشيف',`${st.name} — الرقم ${st.serial}`);if(await save()){render();say('تم استرجاع الطالب مع الاحتفاظ بسجلاته.')}}return}
 const receipt=e.target.closest('[data-receipt]');if(receipt){printPaymentReceipt(receipt.dataset.receipt);return}
 if(e.target.closest('#exportArchiveCsv')){const rows=(db.students||[]).filter(s=>s.archived).map(s=>[s.serial,s.name,s.grade,groupLabel(s.groupId),s.phone,s.parentName,s.parentPhone,String(s.archivedAt||'').slice(0,10),s.notes]);downloadCsv(`ClassMind-Archive-${today()}.csv`,[['الرقم','الاسم','الصف','المجموعة','الهاتف','ولي الأمر','هاتف ولي الأمر','تاريخ الأرشفة','ملاحظات'],...rows]);say('تم تصدير الأرشيف إلى CSV.');return}
 const del=e.target.closest('[data-del]');if(del){const [kind,id]=del.dataset.del.split(':');if(confirm('هل تريد حذف السجل المحدد؟')){db[kind]=db[kind].filter(x=>x.id!==id);if(await save()){render();say('تم حذف السجل.')}}return}
 if(e.target.closest('#closeModal')||e.target.id==='backdrop'){closeModal();return}
 const action=e.target.closest('[data-profile-action]')?.dataset.profileAction;
 if(action==='payment'){showInlineForm('payments',activeStudent);return}
 if(action==='settle-remainder'){await settleStudentRemainder(activeStudent);return}
 if(action==='grade'){showInlineForm('grades',activeStudent);return}
 if(action==='whatsapp'){sendWhatsApp(activeStudent);return}
 if(action==='print'){window.print();return}
 if(action==='card-print'){printStudentCard(activeStudent);return}
 if(action==='delete'){await deleteStudentRecord(activeStudent);return}
 const followupToggle=e.target.closest('[data-followup-toggle]');if(followupToggle){const item=(db.followUps||[]).find(x=>x.id===followupToggle.dataset.followupToggle);if(item){item.status=item.status==='done'?'open':'done';item.updatedAt=new Date().toISOString();logAction('تحديث متابعة طالب',`${studentLabel(item.studentId)} — ${item.status==='done'?'تمت':'أعيد فتحها'}`);if(await save()){openProfile(item.studentId);say('تم تحديث حالة المتابعة.')}}return}
 if(e.target.closest('#exportExcel')){await exportMonthlyExcel(window.classMindReportMonth||currentMonth());return}
 if(e.target.closest('#restoreBackup')){await restoreBackup();return}
 if(e.target.closest('#demoData')){await loadDemoData();return}
 if(e.target.closest('#clearDemoData')){if(confirm('سيتم حذف البيانات الحالية واستبدالها بقاعدة فارغة. هل تريد المتابعة؟')){db={...structuredClone(EMPTY),settings:{...EMPTY.settings}};logAction('إعادة ضبط البيانات','تمت إعادة قاعدة البيانات إلى حالة فارغة');if(await save()){render();say('تمت إعادة ضبط قاعدة البيانات.')}}return}
 if(e.target.closest('#backup')||e.target.closest('#backupFromSettings')){
   const json=JSON.stringify({backupFormat:'ClassMindAI',schemaVersion:2,exportedAt:new Date().toISOString(),...db},null,2);
   if(window.classMindDesktop){try{const r=await window.classMindDesktop.exportBackup(json);if(r.ok)say('تم تصدير النسخة الاحتياطية.');}catch(err){say('تعذر التصدير: '+err.message,true)}}
   else{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`classmind-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);say('تم تنزيل النسخة الاحتياطية. احفظها في مكان آمن.')}
 }
});
document.addEventListener('change',async e=>{
 if(e.target.id==='notificationMonth'){window.classMindReportMonth=e.target.value||currentMonth();render();return}
 if(e.target.id==='entryImageUpload'){
   const file=e.target.files?.[0]; if(!file)return;
   if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){say('اختر صورة بصيغة PNG أو JPG أو WEBP أو GIF.',true);e.target.value='';return;}
   if(file.size>12*1024*1024){say('حجم الصورة كبير. اختر صورة أقل من 12 ميجابايت.',true);e.target.value='';return;}
   try{
     const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
     const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=dataUrl});
     const max=1200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
     const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
     canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
     db.settings={...db.settings,entryImageData:canvas.toDataURL('image/jpeg',0.86)};
     if(await save()){const preview=$('#entryImagePreview');if(preview)preview.src=db.settings.entryImageData;updateEntryIdentity();logAction('تغيير صورة شاشة البداية','تم حفظ صورة جديدة لشاشة الدخول');await save();say('تم حفظ صورة شاشة البداية بنجاح.');}
   }catch(err){say('تعذر تحميل الصورة. جرّب صورة أخرى.',true)}
 }
});
document.addEventListener('click',async e=>{
 if(e.target.closest('#removeEntryImage')){
   delete db.settings.entryImageData;
   if(await save()){const preview=$('#entryImagePreview');if(preview)preview.removeAttribute('src');updateEntryIdentity();say('تم حذف الصورة. اختر صورة جديدة من جهازك عند الحاجة.');}
 }
});

document.addEventListener('submit',async e=>{
 if(e.target.id==='followUpForm'){
   e.preventDefault();const fd=new FormData(e.target),sid=e.target.dataset.studentId,note=String(fd.get('note')||'').trim();
   if(!student(sid)||!note){say('تأكد من اختيار الطالب وكتابة ملاحظة المتابعة.',true);return}
   const item={id:uid(),studentId:sid,dueDate:String(fd.get('dueDate')||today()),type:String(fd.get('type')||'other'),status:String(fd.get('status')||'open'),note,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   if(!Array.isArray(db.followUps))db.followUps=[];db.followUps.unshift(item);logAction('إضافة متابعة طالب',`${studentLabel(sid)} — ${item.dueDate} — ${note.slice(0,100)}`);
   if(await save()){openProfile(sid);say('تم حفظ متابعة الطالب بنجاح.')}return;
 }
   if(e.target.id==='staffScanForm'){
   e.preventDefault();const input=$('#staffScanInput'),code=String(input?.value||'').trim();if(!code)return;
   const res=await recordStaffScan(code);
   if(res){showStaffCardPopup(res.st,res.type,res.at);staffFeedback(res.st,res.type);}
   render();$('#staffScanInput')?.focus();return;
 }
 if(e.target.id==='financeGateForm'){
   e.preventDefault();
   const entered=String($('#financeGateCode')?.value||''),target=e.target.dataset.target||'dashboard',msg=$('#financeGateMsg');
   if(entered!==String(db.settings?.financeCode||'')){if(msg)msg.textContent='الرمز غير صحيح. حاول مرة أخرى.';$('#financeGateCode')?.select();return}
   financePassFor=target;$('#modalRoot').innerHTML='';go(target);return;
 }
 if(e.target.id==='settingsForm'){
   e.preventDefault();const fd=new FormData(e.target);
   const teacherName=String(fd.get('teacherName')||'').trim(),centerName=String(fd.get('centerName')||'').trim(),subject=String(fd.get('subject')||'').trim(),teacherWhatsapp=String(fd.get('teacherWhatsapp')||'').trim(),notes=String(fd.get('notes')||'').trim(),newLanguage=String(fd.get('language')||'ar')==='en'?'en':'ar',newCode=String(fd.get('centerCode')||'').trim(),newFinanceCode=String(fd.get('financeCode')||'').trim();
   if(!teacherName||!centerName||!subject){say('اكتب اسم المدرس واسم السنتر والمادة الدراسية.',true);return}
   if(newCode&&newCode.length<4){say('رمز السنتر يجب ألا يقل عن 4 أحرف أو أرقام.',true);return}
   if(newFinanceCode&&newFinanceCode.length<4){say('رمز الحسابات والموظفين يجب ألا يقل عن 4 أحرف أو أرقام.',true);return}
   if(!db.settings.centerCode&&!newCode){say('أنشئ رمزًا للسنتر قبل حفظ الإعدادات.',true);return}
   db.settings={...db.settings,teacherName,centerName,subject,teacherWhatsapp,notes,language:newLanguage,centerCode:newCode||db.settings.centerCode||'',financeCode:newFinanceCode||db.settings.financeCode||''};language=newLanguage;logAction('تعديل الإعدادات',`تم تحديث إعدادات ${centerName} — المادة: ${subject}`);
   if(await save()){render();updateEntryIdentity();say('تم حفظ إعدادات المدرس والسنتر ورمز الدخول.');}
   return;
 }
 if(e.target.id==='recordForm'){
   e.preventDefault();const kind=e.target.dataset.kind,recordId=e.target.dataset.id,form=new FormData(e.target),r={};let newlyAddedSerial=null;
   for(const [k,v] of form.entries()){const f=schemas[kind].fields.find(x=>x[0]===k);r[k]=f&&f[2]==='number'?(v===''?'':Number(v)):v}
   if(kind==='grades'&&(Number(r.total)<=0||Number(r.score)>Number(r.total))){say('تأكد أن الدرجة النهائية أكبر من صفر وأن الدرجة المحصلة لا تتجاوزها.',true);return}
   if(kind==='students'&&!r.groupId)r.groupId='';
   if(kind==='staff'&&!recordId)r.code=nextStaffCode();
   if(recordId){
     const existingRecord=db[kind].find(x=>x.id===recordId);
     if(kind==='students'&&String(existingRecord.groupId||'')!==String(r.groupId||'')){
       const used=new Set(db.students.filter(st=>!st.archived&&st.id!==recordId&&String(st.groupId||'')===String(r.groupId||'')).map(st=>Number.parseInt(st.serial,10)).filter(n=>Number.isInteger(n)&&n>0));
       let n=1;while(used.has(n))n++;r.serial=String(n);
     }
     Object.assign(existingRecord,r);logAction('تعديل سجل',`${kind} — ${recordId}`)
   }
   else if(kind==='students'){
     // Always reuse the smallest vacant serial number first.
     const used=new Set(db.students.filter(st=>!st.archived&&String(st.groupId||'')===String(r.groupId||'')).map(st=>Number.parseInt(st.serial,10)).filter(n=>Number.isInteger(n)&&n>0));
     let serialNumber=1; while(used.has(serialNumber)) serialNumber++;
     const serial=String(serialNumber);newlyAddedSerial=serial;
     db.students.push({id:uid(),serial,createdAt:new Date().toISOString(),...r});logAction('إضافة طالب',`${r.name||''} — الرقم ${serial}`);
     db.nextSerial=Math.max(db.nextSerial||1,serialNumber+1);
   }else {if(kind==='payments'){const possible=db.payments.find(p=>p.studentId===r.studentId&&p.month===r.month&&Number(p.amount)===Number(r.amount)&&String(p.createdAt||'').slice(0,10)===today());if(possible&&!confirm('توجد دفعة مطابقة للطالب والمبلغ والشهر بتاريخ اليوم. هل تريد تسجيل دفعة أخرى رغم احتمال التكرار؟'))return;}db[kind].push({id:uid(),createdAt:new Date().toISOString(),...r});logAction('إضافة سجل',`${kind}`)}
   if(await save()){editing=null;searchValue='';render();say(newlyAddedSerial!==null?`تم تسجيل الطالب بنجاح، رقمه في الجدول هو ${newlyAddedSerial}.`:'تم حفظ البيانات بنجاح.');}
   return;
 }
 if(e.target.id==='attendanceForm'){
   e.preventDefault();const form=new FormData(e.target),serial=String(form.get('serial')||'').trim(),groupId=String(form.get('groupId')||''),s=db.students.find(x=>String(x.serial)===serial&&String(x.groupId||'')===groupId&&!x.archived);
   if(!s){say('لم يتم العثور على طالب بهذا الرقم. تأكد من الرقم التسلسلي في قائمة الطلاب.',true);$('#attendanceSerial').select();return}
   const date=form.get('date'),status=form.get('status');
   const duplicate=db.attendance.find(a=>a.studentId===s.id&&a.date===date);
   if(duplicate){if(!confirm(`يوجد سجل لهذا الطالب في ${date}. هل تريد تحديث حالته من ${duplicate.status==='present'?'حاضر':duplicate.status==='late'?'متأخر':'غائب'} إلى ${status==='present'?'حاضر':status==='late'?'متأخر':'غائب'}؟`))return;duplicate.status=status;duplicate.updatedAt=new Date().toISOString();logAction('تحديث سجل حضور',`${s.name} — ${date} — ${status}`)}
   else {db.attendance.push({id:uid(),studentId:s.id,date,status,createdAt:new Date().toISOString()});logAction('تسجيل حضور',`${s.name} — ${date} — ${status}`)}
   if(await save()){const p=monthlyPaymentStatus(s.id);if(status==='present'||status==='late'){showAttendanceCardPopup(s,status);attendanceFeedback(s,status);}render();say(`تم تسجيل ${status==='present'?'حضور':status==='late'?'تأخير':'غياب'} الطالب ${s.name} — حالة الاشتراك: ${paymentStatusText(p)}`);$('#attendanceSerial')?.focus()}
 }
});
document.addEventListener('keydown',e=>{if(e.target?.id==='attendanceSerial'&&e.key==='Enter'){e.preventDefault();const form=$('#attendanceForm');if(form)form.requestSubmit();}});
document.addEventListener('change',e=>{
 if(e.target.id==='reportMonth'){window.classMindReportMonth=e.target.value||currentMonth();render();return}
 if(e.target.id==='topStudentsMonth'){window.topStudentsMonth=e.target.value||currentMonth();render();return}
});
document.addEventListener('input',e=>{
 if(e.target.id==='attendanceSerial'){
   const serial=String(e.target.value||'').trim(),s=db.students.find(x=>String(x.serial)===serial),box=$('#attendanceStudentInfo');
   if(!box)return;
   if(!s){box.className='payment-check empty';box.innerHTML='لم يتم العثور على طالب بهذا الرقم.';return}
   const p=monthlyPaymentStatus(s.id);
   box.className=`payment-check ${p.status}`;
   box.innerHTML=`<div class="payment-check-main"><div><b>${esc(s.name)}</b><span>رقم ${esc(s.serial)} · ${esc(s.grade)} · ${esc(groupLabel(s.groupId))}</span></div><strong>${esc(paymentStatusText(p))}</strong></div><div class="payment-check-meta"><span>سعر الاشتراك: ${cash(p.fee)}</span><span>المدفوع: ${cash(p.paid)}</span><span>المتبقي: ${cash(p.remaining)}</span></div>`;
   return;
 }
 if(e.target.id==='search'){
   searchValue=e.target.value;const pos=e.target.selectionStart;
   // Re-render only the list region, preserving the input element and focus.
   const kind=page;const query=searchValue.toLowerCase();
   if(kind==='students'){
     const rows=db.students.filter(r=>!r.archived&&JSON.stringify({...r,studentName:studentLabel(r.id)}).toLowerCase().includes(query));
     const old=$('.table-wrap')||$('#content').querySelector('.empty');
     const replacement=document.createElement('div');
     replacement.innerHTML=rows.length?studentTable(rows):'<div class="panel empty">لا توجد نتائج مطابقة.</div>';
     if(old)old.replaceWith(replacement.firstElementChild);
   }else if(kind==='archive'){
     const rows=db.students.filter(r=>r.archived&&JSON.stringify(r).toLowerCase().includes(query));
     const old=$('.table-wrap')||$('#content').querySelector('.empty');const replacement=document.createElement('div');
     replacement.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>الرقم</th><th>اسم الطالب</th><th>الصف</th><th>المجموعة</th><th>تاريخ الأرشفة</th><th>الإجراءات</th></tr></thead><tbody>${rows.map(st=>`<tr><td>${esc(st.serial)}</td><td>${esc(st.name)}</td><td>${esc(st.grade||'—')}</td><td>${esc(groupLabel(st.groupId))}</td><td>${esc(String(st.archivedAt||'').slice(0,10)||'—')}</td><td><button class="tiny" data-profile="${esc(st.id)}">الملف</button> <button class="tiny primary" data-restore-student="${esc(st.id)}">استرجاع</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="panel empty">لا توجد نتائج مطابقة.</div>';
     if(old)old.replaceWith(replacement.firstElementChild);
   }else if(kind==='staff'){const rows=(db.staff||[]).filter(r=>JSON.stringify(r).toLowerCase().includes(query));const old=$('.table-wrap')||$('#content').querySelector('.empty');const replacement=document.createElement('div');replacement.innerHTML=rows.length?staffTable(rows):'<div class="panel empty">لا توجد نتائج مطابقة.</div>';if(old)old.replaceWith(replacement.firstElementChild);}else if(schemas[kind]){
     const rows=db[kind].filter(r=>JSON.stringify({...r,studentName:studentLabel(r.studentId)}).toLowerCase().includes(query));
     const old=$('.table-wrap')||$('#content').querySelector('.empty');
     const replacement=document.createElement('div');
     replacement.innerHTML=rows.length?genericTable(kind,rows):'<div class="panel empty">لا توجد نتائج مطابقة.</div>';
     if(old)old.replaceWith(replacement.firstElementChild);
   }
   e.target.setSelectionRange(pos,pos);
 }
});
$('#dateNow').textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
function updateEntryIdentity(){
  const settings=db.settings||{};
  const center=$('#entryCenterName'),teacher=$('#entryTeacherName'),subject=$('#entrySubjectLaptop'),bannerTeacher=$('#entryTeacherBanner'),bannerSubject=$('#entrySubjectBanner');
  if(center)center.textContent=settings.centerName||'اسم السنتر غير مسجل';
  if(teacher)teacher.textContent=settings.teacherName||'اسم المدرس غير مسجل';
  if(subject)subject.textContent=settings.subject||'المادة الدراسية';
  if(bannerTeacher)bannerTeacher.textContent=settings.teacherName||'اسم المدرس';
  if(bannerSubject)bannerSubject.textContent=settings.subject||'المادة الدراسية';
  const bannerImage=$('#teacherBannerPhoto');
  if(bannerImage)bannerImage.src=settings.entryImageData||'../assets/ali-ashraf.jpg';
}
function unlockProgram(){
  $('#entryScreen')?.classList.add('entry-hidden');
  document.body.classList.remove('entry-locked');
  $('#centerAccessCode').value='';
  $('#content')?.focus();
}
function prepareEntryScreen(){
  updateEntryIdentity();
  const screen=$('#entryScreen'),panel=$('#entryPanel'),cord=$('#lampCord'),hint=$('#lampHint');
  let lit=false,dragging=false,startY=0,pulled=false,autoTimer=null;
  const turnOn=()=>{
    if(lit)return;
    lit=true;screen.classList.add('lamp-on');document.body.classList.add('lamp-lit');
    panel.setAttribute('aria-hidden','true');hint.textContent=`أهلًا وسهلًا ${db.settings?.teacherName?'أستاذ '+db.settings.teacherName:'بك في ClassMind AI'} — جاري تشغيل النظام…`;
    clearTimeout(autoTimer);autoTimer=setTimeout(()=>{panel.setAttribute('aria-hidden','false');hint.textContent=`أهلًا أستاذ ${db.settings?.teacherName||'المدرس'} — الأباجورة منورة؛ أدخل رمز السنتر للمتابعة`;$('#centerAccessCode')?.focus()},2000);
  };
  const turnOff=()=>{lit=false;clearTimeout(autoTimer);screen.classList.remove('lamp-on');document.body.classList.remove('lamp-lit');panel.setAttribute('aria-hidden','true');hint.textContent='اسحب الحبل لتشغيل الأباجورة';};
  const pull=()=>{if(lit)turnOff();else turnOn()};
  cord.addEventListener('pointerdown',e=>{dragging=true;pulled=false;startY=e.clientY;cord.setPointerCapture?.(e.pointerId);});
  cord.addEventListener('pointermove',e=>{if(!dragging)return;const distance=Math.max(0,e.clientY-startY);cord.style.setProperty('--pull',Math.min(distance,70)+'px');if(distance>22)pulled=true;screen.style.setProperty('--sway',Math.max(-2,Math.min(2,(e.clientX-window.innerWidth/2)/180))+'deg');});
  const release=()=>{if(!dragging)return;dragging=false;cord.style.setProperty('--pull','0px');if(pulled)pull();};
  cord.addEventListener('pointerup',release);cord.addEventListener('pointercancel',release);
  cord.addEventListener('click',()=>{if(!dragging)pull()});
  screen.addEventListener('pointermove',e=>{if(!lit)return;const x=(e.clientX/window.innerWidth-.5)*2;screen.style.setProperty('--sway',(x*2)+'deg');});
  $('#entryForm').addEventListener('submit',e=>{
    e.preventDefault();const entered=$('#centerAccessCode').value,code=db.settings?.centerCode||'',msg=$('#entryMessage');
    if(!code){msg.textContent='أول تشغيل: افتح الإعدادات وسجّل رمزًا للسنتر.';msg.classList.add('entry-warning');unlockProgram();return;}
    if(entered!==code){msg.textContent='رمز السنتر غير صحيح. حاول مرة أخرى.';msg.classList.remove('entry-warning');msg.classList.add('entry-error');screen.classList.remove('login-error');void screen.offsetWidth;screen.classList.add('login-error');$('#centerAccessCode').select();return;}
    msg.textContent='تم التحقق — جاري فتح لوحة التحكم…';msg.classList.remove('entry-error');screen.classList.add('login-success');setTimeout(unlockProgram,700);
  });
}

// ---- تفعيل الجهاز: يُطلب رمز التفعيل مرة واحدة على كل جهاز جديد ----
// يُخزَّن هنا بصمة SHA-256 للرمز لا الرمز نفسه. التفعيل يُحفظ داخل الجهاز فقط.
const ACTIVATION_HASH='2540c07079249f962794e553ee1edaa6ded982a1cdafcc646728da24d699eb44';
function normalizeActivationCode(v){return String(v||'').replace(/[\s-]/g,'').toUpperCase()}
async function sha256Hex(text){
  const bytes=new TextEncoder().encode(text);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function isDeviceActivated(){
  try{
    if(window.classMindDesktop?.getActivation){const r=await window.classMindDesktop.getActivation();return !!r?.activated}
    return localStorage.getItem('classmind-activated')==='1';
  }catch(_e){return false}
}
async function markDeviceActivated(){
  try{
    if(window.classMindDesktop?.setActivation){await window.classMindDesktop.setActivation({device:navigator.platform||'device'});return true}
    localStorage.setItem('classmind-activated','1');return true;
  }catch(e){say('تعذر حفظ التفعيل على هذا الجهاز: '+(e.message||e),true);return false}
}
function showActivationGate(){
  return new Promise(resolve=>{
    const gate=document.createElement('div');
    gate.id='activationGate';
    gate.className='activation-gate';
    gate.setAttribute('role','dialog');
    gate.setAttribute('aria-modal','true');
    gate.innerHTML=`<form class="activation-card" id="activationForm" autocomplete="off">
      <div class="activation-mark">✦</div>
      <div class="activation-eyebrow">CLASSMIND AI · ACTIVATION</div>
      <h2>تفعيل البرنامج على هذا الجهاز</h2>
      <p class="activation-text">هذا الجهاز يعمل لأول مرة مع ClassMind AI. أدخل رمز التفعيل الخاص بك لبدء الاستخدام، ولن يُطلب مرة أخرى على هذا الجهاز.</p>
      <label for="activationCode">رمز التفعيل</label>
      <input id="activationCode" name="activationCode" type="text" dir="ltr" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required>
      <p id="activationMessage" class="activation-message" role="status"></p>
      <button class="activation-submit" type="submit">تفعيل البرنامج</button>
      <div class="activation-foot">تصميم <strong>مهندس علي أشرف</strong></div>
    </form>`;
    document.body.appendChild(gate);
    const input=gate.querySelector('#activationCode'), msg=gate.querySelector('#activationMessage'), form=gate.querySelector('#activationForm');
    setTimeout(()=>input.focus(),50);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const code=normalizeActivationCode(input.value);
      if(!code){msg.textContent='اكتب رمز التفعيل أولًا.';msg.className='activation-message error';return}
      msg.textContent='جاري التحقق…';msg.className='activation-message';
      let hash='';
      try{hash=await sha256Hex(code)}catch(_e){msg.textContent='تعذر التحقق من الرمز على هذا الجهاز.';msg.className='activation-message error';return}
      if(hash!==ACTIVATION_HASH){
        msg.textContent='رمز التفعيل غير صحيح. تأكد من كتابته كما هو.';msg.className='activation-message error';
        form.classList.remove('shake');void form.offsetWidth;form.classList.add('shake');input.select();return;
      }
      if(!(await markDeviceActivated()))return;
      msg.textContent='تم التفعيل بنجاح ✨';msg.className='activation-message ok';
      setTimeout(()=>{gate.remove();resolve(true)},700);
    });
  });
}
(async()=>{initTheme();warmUpSpeech();if(!(await isDeviceActivated()))await showActivationGate();await load();autoMarkMissedAttendance();window.classMindReportMonth=currentMonth();render();prepareEntryScreen();setInterval(()=>{autoMarkMissedAttendance()},60000)})();

setInterval(()=>{const clock=document.querySelector('#liveDateTime');if(clock)clock.textContent=new Intl.DateTimeFormat('ar-EG',{dateStyle:'full',timeStyle:'medium'}).format(new Date());},1000);
