const { app, BrowserWindow, ipcMain, safeStorage, dialog, session } = require('electron');
const zlib = require('node:zlib');
const path = require('node:path');
const fs = require('node:fs');

let win;
const dataFile = () => path.join(app.getPath('userData'), 'classmind-data.enc');
const blank = () => ({ students: [], groups: [], attendance: [], payments: [], grades: [], expenses: [], followUps: [], auditLogs: [], staff: [], staffAttendance: [], nextSerial: 1 });

function readData() {
  const file = dataFile();
  if (!fs.existsSync(file)) return blank();
  if (!safeStorage.isEncryptionAvailable()) throw new Error('تشفير بيانات الجهاز غير متاح؛ لم يتم فتح قاعدة البيانات.');
  const raw = safeStorage.decryptString(fs.readFileSync(file));
  const parsed = JSON.parse(raw);
  return { ...blank(), ...parsed };
}
function writeData(data) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('تشفير بيانات الجهاز غير متاح؛ لم يتم حفظ البيانات.');
  const file = dataFile();
  const temp = file + '.tmp';
  fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(data)));
  fs.renameSync(temp, file);
  return { ok: true };
}

// ---- تفعيل الجهاز: سجل منفصل عن بيانات السنتر ويُشفَّر بمفتاح الجهاز ----
const activationFile = () => path.join(app.getPath('userData'), 'classmind-activation.enc');
function readActivation() {
  const file = activationFile();
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return { activated: false };
  try {
    const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
    return { activated: parsed.activated === true, at: parsed.at || null };
  } catch (_e) { return { activated: false }; }
}
function writeActivation(record) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('تشفير بيانات الجهاز غير متاح؛ لم يتم حفظ التفعيل.');
  const file = activationFile();
  const temp = file + '.tmp';
  fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(record)));
  fs.renameSync(temp, file);
  return { ok: true };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(n) { const b=Buffer.alloc(2); b.writeUInt16LE(n&0xffff); return b; }
function u32(n) { const b=Buffer.alloc(4); b.writeUInt32LE(n>>>0); return b; }
function zipStore(files) {
  const locals=[], centrals=[]; let offset=0;
  for (const file of files) {
    const name=Buffer.from(file.name,'utf8'), data=Buffer.from(file.data,'utf8'), crc=crc32(data);
    const local=Buffer.concat([Buffer.from('PK\x03\x04','binary'),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=Buffer.concat([Buffer.from('PK\x01\x02','binary'),u16(20),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central); offset += local.length;
  }
  const central=Buffer.concat(centrals), body=Buffer.concat([...locals,central]);
  const end=Buffer.concat([Buffer.from('PK\x05\x06','binary'),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);
  return Buffer.concat([body,end]);
}
function xmlEscape(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function colName(n){let s=''; while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)} return s;}
function sheetXml(rows) {
  const out=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetData>'];
  rows.forEach((row,ri)=>{out.push(`<row r="${ri+1}">`); row.forEach((cell,ci)=>{const ref=colName(ci+1)+(ri+1); const v=cell==null?'':cell; const numeric=typeof v==='number' && Number.isFinite(v); if(numeric) out.push(`<c r="${ref}"${ri===0?' s="1"':''}><v>${v}</v></c>`); else out.push(`<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`);}); out.push('</row>');}); out.push('</sheetData></worksheet>'); return out.join('');
}
function makeXlsx(sheets){
  const files=[];
  files.push({name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});
  files.push({name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
  files.push({name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((x,i)=>`<sheet name="${xmlEscape(x.name).slice(0,31)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`});
  files.push({name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
  files.push({name:'xl/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>`});
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}));
  return zipStore(files);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1000, minHeight: 680,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}
// Enable experimental Chromium web platform APIs where available (including BarcodeDetector on builds that expose it).
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.whenReady().then(() => {
  // Allow the local desktop app to request camera access for offline QR attendance scanning.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
  ipcMain.handle('activation:get', () => readActivation());
  ipcMain.handle('activation:set', (_event, record) => writeActivation({ activated: true, at: new Date().toISOString(), device: String(record?.device || '').slice(0, 80) }));
  ipcMain.handle('data:read', () => readData());
  ipcMain.handle('data:write', (_event, data) => writeData(data));
  ipcMain.handle('excel:export', async (_event, payload) => {
    const month = String(payload?.month || 'report');
    const safeName = String(payload?.fileName || `تقرير-${month}`).replace(/[\\/:*?"<>|]/g,'-');
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير التقرير الشهري إلى Excel',
      defaultPath: `${safeName}.xlsx`,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const bytes = makeXlsx(Array.isArray(payload?.sheets) ? payload.sheets : []);
    fs.writeFileSync(result.filePath, bytes);
    return { ok: true, filePath: result.filePath };
  });
  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'استعادة نسخة ClassMind AI', properties: ['openFile'], filters: [{ name: 'JSON Backup', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.students) || !Array.isArray(data.groups)) throw new Error('ملف النسخة الاحتياطية غير صالح.');
    return { ok: true, data };
  });
  ipcMain.handle('backup:export', async (_event, json) => {
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير نسخة احتياطية',
      defaultPath: 'classmind-backup.json',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, json, { encoding: 'utf8', flag: 'wx' });
    return { ok: true };
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });