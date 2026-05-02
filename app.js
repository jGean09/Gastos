import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';

// ── STATE ──
let currentFile     = null;
let currentBase64   = null;
let currentMime     = 'image/jpeg';
let currentProducts = [];
let nextId          = 0;
let allReceipts     = [];
let appSettings     = { him: 'Eu', her: 'Ela', password: '15112018', geminiKey: '' };

// ── MONEY (sem ponto flutuante) ──
function cents(v)   { return Math.round((parseFloat(v) || 0) * 100); }
function fromCents(c){ return c / 100; }
function fmt(v)     { return 'R$ ' + fromCents(cents(v)).toFixed(2).replace('.', ','); }

// ── SYNC DOT ──
function setSyncStatus(s) {
  const d = document.getElementById('sync-dot');
  if (d) d.className = 'sync-dot ' + s;
}

// ── Payer Dropdown Update ──
function updatePayerSelect() {
  const names = getNames();
  const sel = document.getElementById('meta-payer');
  if(sel) {
    sel.innerHTML = `<option value="him">${names.him}</option><option value="her">${names.her}</option>`;
  }
}
window.updatePayerSelect = updatePayerSelect;

// ── FIREBASE: configurações ──
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    if (snap.exists()) appSettings = { ...appSettings, ...snap.data() };
  } catch(e) { console.error('loadSettings:', e); }
}

async function saveSettingsToCloud() {
  setSyncStatus('syncing');
  try {
    await setDoc(doc(db, 'config', 'settings'), appSettings);
    setSyncStatus('ok');
  } catch(e) { setSyncStatus('err'); console.error(e); }
}

// ── FIREBASE: cupons ──
async function loadReceipts() {
  setSyncStatus('syncing');
  try {
    const q    = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    allReceipts = snap.docs.map(d => ({ ...d.data(), _fireId: d.id }));
    setSyncStatus('ok');
  } catch(e) {
    try {
      const snap2 = await getDocs(collection(db, 'receipts'));
      allReceipts = snap2.docs.map(d => ({ ...d.data(), _fireId: d.id }));
      allReceipts.sort((a,b) => b.date.localeCompare(a.date));
      setSyncStatus('ok');
    } catch(e2) { setSyncStatus('err'); console.error(e2); }
  }
  populateMonthSelects();
  renderHistory();
}

async function addReceiptToCloud(receipt) {
  setSyncStatus('syncing');
  try {
    const ref = await addDoc(collection(db, 'receipts'), receipt);
    receipt._fireId = ref.id;
    allReceipts.unshift(receipt);
    allReceipts.sort((a,b) => b.date.localeCompare(a.date));
    setSyncStatus('ok');
    return true;
  } catch(e) {
    setSyncStatus('err');
    showToast('❌ Erro ao salvar na nuvem!');
    return false;
  }
}

async function deleteReceiptFromCloud(fireId) {
  setSyncStatus('syncing');
  try {
    await deleteDoc(doc(db, 'receipts', fireId));
    allReceipts = allReceipts.filter(r => r._fireId !== fireId);
    setSyncStatus('ok');
    return true;
  } catch(e) {
    setSyncStatus('err');
    showToast('❌ Erro ao apagar!');
    return false;
  }
}

// ── LOGIN ──
function verificarSenha() {
  const input = document.getElementById('senha-input').value;
  if (input === appSettings.password) {
    document.getElementById('login-erro').style.display = 'none';
    localStorage.setItem('casal_auth', 'ok');
    liberarAcesso();
  } else {
    document.getElementById('login-erro').style.display = 'block';
  }
}
window.verificarSenha = verificarSenha;

function liberarAcesso() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-content').style.display  = 'block';
  initApp();
}

function logout() {
  localStorage.removeItem('casal_auth');
  location.reload();
}
window.logout = logout;

// ── BOOT ──
async function boot() {
  await loadSettings();
  document.getElementById('senha-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') verificarSenha();
  });
  if (localStorage.getItem('casal_auth') === 'ok') liberarAcesso();
}

// ── INIT APP ──
async function initApp() {
  document.getElementById('api-key-input').value    = appSettings.geminiKey || '';
  document.getElementById('api-key-settings').value = appSettings.geminiKey || '';
  document.getElementById('name-him').value          = appSettings.him;
  document.getElementById('name-her').value          = appSettings.her;
  document.getElementById('meta-date').value         = today();

  updatePayerSelect(); 

  const zone = document.getElementById('upload-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  await loadReceipts();
}

function today() { return new Date().toISOString().split('T')[0]; }

// ── SETTINGS ──
function saveApiKey() {
  const k = document.getElementById('api-key-input').value.trim();
  appSettings.geminiKey = k;
  document.getElementById('api-key-settings').value = k;
  saveSettingsToCloud();
}
window.saveApiKey = saveApiKey;

function saveApiKeySettings() {
  const k = document.getElementById('api-key-settings').value.trim();
  appSettings.geminiKey = k;
  document.getElementById('api-key-input').value = k;
  saveSettingsToCloud();
}
window.saveApiKeySettings = saveApiKeySettings;

function saveNames() {
  appSettings.him = document.getElementById('name-him').value || 'Eu';
  appSettings.her = document.getElementById('name-her').value || 'Ela';
  updatePayerSelect(); 
  saveSettingsToCloud();
}
window.saveNames = saveNames;

function changePassword() {
  const np = document.getElementById('new-password').value.trim();
  if (!np) { showToast('⚠️ Digite a nova senha!'); return; }
  appSettings.password = np;
  saveSettingsToCloud();
  document.getElementById('new-password').value = '';
  showToast('✅ Senha alterada!');
}
window.changePassword = changePassword;

function getNames() {
  return { him: appSettings.him || 'Eu', her: appSettings.her || 'Ela' };
}

async function clearAllData() {
  if (!confirm('Apagar TODOS os cupons? Não pode desfazer.')) return;
  setSyncStatus('syncing');
  try {
    const snap = await getDocs(collection(db, 'receipts'));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'receipts', d.id))));
    allReceipts = [];
    setSyncStatus('ok');
    populateMonthSelects();
    renderHistory();
    renderReport();
    showToast('🗑️ Dados apagados.');
  } catch(e) { setSyncStatus('err'); showToast('❌ Erro ao apagar.'); }
}
window.clearAllData = clearAllData;

// ── NAV ──
function showPage(id, desktopBtn, navId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');

  document.querySelectorAll('.desktop-nav-btn').forEach(b => b.classList.remove('active'));
  if (desktopBtn) desktopBtn.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (navId) document.getElementById(navId)?.classList.add('active');

  if (id === 'history') { populateMonthSelects(); renderHistory(); }
  if (id === 'report')  { populateMonthSelects(); renderReport(); }
}
window.showPage = showPage;

// ── FILE ──
function handleFile(e) { if (e.target.files[0]) loadFile(e.target.files[0]); }
window.handleFile = handleFile;

function loadFile(file) {
  currentFile = file;
  currentMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = e => {
    currentBase64 = e.target.result.split(',')[1];
    document.getElementById('preview-img').src              = e.target.result;
    document.getElementById('preview-section').style.display  = 'block';
    document.getElementById('upload-zone').style.display      = 'none';
    document.getElementById('products-section').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  currentFile = null; currentBase64 = null; currentProducts = []; nextId = 0;
  document.getElementById('preview-section').style.display  = 'none';
  document.getElementById('products-section').style.display = 'none';
  document.getElementById('upload-zone').style.display      = 'block';
  document.getElementById('upload-zone').querySelector('input').value = '';
  document.getElementById('meta-method').value = '';
}
window.resetUpload = resetUpload;

function resetAll() { resetUpload(); showToast('Descartado.'); }
window.resetAll = resetAll;

// ── GEMINI ──
async function extractWithGemini() {
  const apiKey = appSettings.geminiKey || '';
  if (!apiKey)      { showToast('⚠️ Configure a chave Gemini!'); return; }
  if (!currentBase64){ showToast('⚠️ Selecione uma imagem!'); return; }

  document.getElementById('extract-btn').disabled = true;
  document.getElementById('loading-box').style.display = 'flex';

  try {
    const url  = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [
        { inline_data: { mime_type: currentMime, data: currentBase64 } },
        { text: `Analise este cupom fiscal brasileiro. Retorne APENAS JSON válido, sem markdown, sem texto extra:\n{"store":"nome do estabelecimento","date":"YYYY-MM-DD","items":[{"name":"nome do produto","price":0.00}]}\nUse preço total do item (qtd x unitário). Omita itens ilegíveis. NUNCA coloque texto fora do JSON.` }
      ]}],
      generationConfig: { temperature: 0 }
    };

    const res  = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    currentProducts = parsed.items.map(item => ({
      id: nextId++,
      name: item.name,
      priceCents: cents(item.price),
      split: 'both',
      otherName: ''
    }));

    if (parsed.store) document.getElementById('meta-store').value = parsed.store;
    if (parsed.date)  document.getElementById('meta-date').value  = parsed.date;

    renderProducts();
    document.getElementById('products-section').style.display = 'block';
    showToast('✅ ' + currentProducts.length + ' produtos extraídos!');
  } catch(err) {
    console.error(err);
    showToast('❌ ' + err.message);
  } finally {
    document.getElementById('extract-btn').disabled = false;
    document.getElementById('loading-box').style.display = 'none';
  }
}
window.extractWithGemini = extractWithGemini;

// ── MANUAL ──
function addManual() {
  const nameEl  = document.getElementById('new-name');
  const priceEl = document.getElementById('new-price');
  const name    = nameEl.value.trim();
  if (!name) { showToast('⚠️ Digite o nome do produto!'); return; }
  currentProducts.push({ id: nextId++, name, priceCents: cents(priceEl.value), split: 'both', otherName: '' });
  nameEl.value = ''; priceEl.value = '';
  document.getElementById('products-section').style.display = 'block';
  renderProducts();
  nameEl.focus();
}
window.addManual = addManual;

// ── PRODUCTS ──
function renderProducts() {
  const names = getNames();
  const list  = document.getElementById('products-list');
  list.innerHTML = '';

  currentProducts.forEach(item => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.id = 'item-' + item.id;

    const otherInput = item.split === 'other'
      ? `<input class="other-input" placeholder="Nome do amigo/pessoa..." value="${item.otherName || ''}" oninput="window.setOtherName(${item.id}, this.value)">`
      : '';

    div.innerHTML = `
      <div class="product-top">
        <div style="display:flex;align-items:flex-start;gap:0.5rem;flex:1">
          <button class="del-item-btn" onclick="window.removeItem(${item.id})">✕</button>
          <span class="product-name-text">${item.name}</span>
        </div>
        <span class="product-price-tag">${fmt(fromCents(item.priceCents))}</span>
      </div>
      <div class="product-controls">
        <div class="split-group">
          <button class="split-btn ${item.split==='him'  ?'s-him':''}"   onclick="window.setSplit(${item.id},'him')">${names.him.split(' ')[0]}</button>
          <button class="split-btn ${item.split==='her'  ?'s-her':''}"   onclick="window.setSplit(${item.id},'her')">${names.her.split(' ')[0]}</button>
          <button class="split-btn ${item.split==='both' ?'s-both':''}"  onclick="window.setSplit(${item.id},'both')">÷2</button>
          <button class="split-btn ${item.split==='other'?'s-other':''}" onclick="window.setSplit(${item.id},'other')">👤 Emprestado</button>
        </div>
      </div>
      ${otherInput}
    `;
    list.appendChild(div);
  });

  renderSummary();
}

function removeItem(id) {
  currentProducts = currentProducts.filter(p => p.id !== id);
  renderProducts();
}
window.removeItem = removeItem;

function setSplit(id, type) {
  const item = currentProducts.find(p => p.id === id);
  item.split = type;
  if (type !== 'other') item.otherName = '';
  renderProducts();
}
window.setSplit = setSplit;

function setOtherName(id, name) {
  currentProducts.find(p => p.id === id).otherName = name;
  renderSummary();
}
window.setOtherName = setOtherName;

// ── TOTAIS (centavos — sem arredondamento) ──
function calcTotals(products) {
  let himC = 0, herC = 0, otherC = 0;
  products.forEach(p => {
    const c = p.priceCents !== undefined ? p.priceCents : cents(p.price || 0);
    if      (p.split === 'him')   himC  += c;
    else if (p.split === 'her')   herC  += c;
    else if (p.split === 'other') otherC += c;
    else {
      himC += Math.floor(c / 2);
      herC += c - Math.floor(c / 2);
    }
  });
  return { himC, herC, otherC };
}

function renderSummary() {
  const names           = getNames();
  const { himC, herC, otherC } = calcTotals(currentProducts);
  const coupleC         = himC + herC;

  const pills = [
    { label: names.him,  value: fmt(fromCents(himC)),    color: 'var(--him)' },
    { label: names.her,  value: fmt(fromCents(herC)),    color: 'var(--her)' },
    { label: 'Casal',    value: fmt(fromCents(coupleC)), color: 'var(--both)' },
    otherC > 0 ? { label: 'Terceiros', value: fmt(fromCents(otherC)), color: 'var(--other)' } : null
  ].filter(Boolean);

  document.getElementById('summary-row').innerHTML = pills.map(p => `
    <div class="summary-pill">
      <div class="pill-label">${p.label}</div>
      <div class="pill-value" style="color:${p.color}">${p.value}</div>
    </div>
  `).join('');
}

// ── SAVE ──
async function saveReceipt() {
  if (currentProducts.length === 0) { showToast('⚠️ Nenhum produto!'); return; }

  const names = getNames();
  const { himC, herC, otherC } = calcTotals(currentProducts);

  const receipt = {
    id:          Date.now(),
    store:       document.getElementById('meta-store').value.trim() || 'Sem nome',
    date:        document.getElementById('meta-date').value || today(),
    payer:       document.getElementById('meta-payer').value || 'him',
    method:      document.getElementById('meta-method').value.trim(),
    items:       currentProducts.map(p => ({...p})),
    himCents:    himC,
    herCents:    herC,
    otherCents:  otherC,
    coupleCents: himC + herC,
    totalCents:  himC + herC + otherC,
    imageBase64: currentBase64,
    imageMime:   currentMime,
    names:       { him: names.him, her: names.her },
    createdAt:   Date.now()
  };

  const ok = await addReceiptToCloud(receipt);
  if (ok) {
    showToast('✅ Cupom salvo na nuvem!');
    resetAll();
    populateMonthSelects();
    renderHistory();
  }
}
window.saveReceipt = saveReceipt;

// ── DELETE ──
async function deleteReceipt(fireId) {
  if (!confirm('Deletar este cupom?')) return;
  const ok = await deleteReceiptFromCloud(fireId);
  if (ok) { populateMonthSelects(); renderHistory(); renderReport(); showToast('🗑️ Removido.'); }
}
window.deleteReceipt = deleteReceipt;

// ── MONTH SELECTS ──
function populateMonthSelects() {
  const months = [...new Set(allReceipts.map(r => r.date.slice(0,7)))].sort().reverse();
  ['filter-month','report-month'].forEach(sid => {
    const sel = document.getElementById(sid);
    if (!sel) return;
    const first = sel.options[0].cloneNode(true);
    sel.innerHTML = '';
    sel.appendChild(first);
    months.forEach(m => {
      const [y, mo] = m.split('-');
      const label   = new Date(y, mo-1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
      const opt     = document.createElement('option');
      opt.value = m;
      opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      sel.appendChild(opt);
    });
  });
}

// ── HISTORY ──
function renderHistory() {
  const month  = document.getElementById('filter-month')?.value  || '';
  const person = document.getElementById('filter-person')?.value || '';
  let list = [...allReceipts];
  if (month)          list = list.filter(r => r.date.startsWith(month));
  if (person === 'him') list = list.filter(r => r.himCents > 0);
  if (person === 'her') list = list.filter(r => r.herCents > 0);
  list.sort((a,b) => b.date.localeCompare(a.date));

  const container = document.getElementById('history-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><p>Nenhum cupom encontrado.</p></div>`;
    return;
  }

  container.innerHTML = list.map(r => {
    const names   = r.names || getNames();
    const dateStr = new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'});

    const himC   = r.himCents   !== undefined ? r.himCents   : cents(r.himTotal   || 0);
    const herC   = r.herCents   !== undefined ? r.herCents   : cents(r.herTotal   || 0);
    const otherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);

    const itemRows = r.items.map(item => {
      const iC         = item.priceCents !== undefined ? item.priceCents : cents(item.price || 0);
      const badgeClass = item.split==='him'   ? 'badge-him'  :
                         item.split==='her'   ? 'badge-her'  :
                         item.split==='other' ? 'badge-other': 'badge-both';
      const badgeLabel = item.split==='him'   ? names.him.split(' ')[0] :
                         item.split==='her'   ? names.her.split(' ')[0] :
                         item.split==='other' ? (item.otherName || '?') : '÷2';
      return `<div class="receipt-item-row">
        <span style="flex:1">${item.name}</span>
        <span class="item-badge ${badgeClass}">${badgeLabel}</span>
        <span style="font-weight:700;color:var(--both)">${fmt(fromCents(iC))}</span>
      </div>`;
    }).join('');

    const imgSrc = r.imageBase64 ? `data:${r.imageMime||'image/jpeg'};base64,${r.imageBase64}` : '';
    const fid    = r._fireId;
    
    const payerName = r.payer === 'him' ? names.him : (r.payer === 'her' ? names.her : '');
    const methodStr = r.method ? ` (${r.method})` : '';
    const paymentInfo = payerName ? `<div style="font-size:0.7rem; color:var(--muted2); margin-top:0.3rem;">Pago por: <strong>${payerName}</strong>${methodStr}</div>` : '';

    return `<div class="receipt-card">
      <div class="receipt-head" onclick="window.toggleCard('${fid}')">
        <div>
          <div class="receipt-store">${r.store}</div>
          <div class="receipt-date">${dateStr}</div>
          ${paymentInfo}
        </div>
        <div class="receipt-amounts">
          <div class="receipt-amount-item">
            <div class="amount-dot" style="background:var(--him)"></div>
            <span style="color:var(--him)">${fmt(fromCents(himC))}</span>
          </div>
          <div class="receipt-amount-item">
            <div class="amount-dot" style="background:var(--her)"></div>
            <span style="color:var(--her)">${fmt(fromCents(herC))}</span>
          </div>
          ${otherC > 0 ? `
          <div class="receipt-amount-item">
            <div class="amount-dot" style="background:var(--other)"></div>
            <span style="color:var(--other)">${fmt(fromCents(otherC))}</span>
          </div>` : ''}
        </div>
      </div>
      <div class="receipt-body" id="card-body-${fid}">
        ${imgSrc ? `<div class="receipt-img-wrap"><img src="${imgSrc}" alt="Cupom"></div>` : ''}
        <div class="receipt-items">${itemRows}</div>
        <div class="receipt-actions">
          <button class="btn btn-danger btn-sm" onclick="window.deleteReceipt('${fid}')">🗑️ Apagar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.renderHistory = renderHistory;

function toggleCard(id) {
  document.getElementById('card-body-' + id)?.classList.toggle('open');
}
window.toggleCard = toggleCard;

// ── REPORT (Nova Lógica de Acerto de Contas) ──
function renderReport() {
  const month = document.getElementById('report-month')?.value || '';
  let list    = [...allReceipts];
  if (month) list = list.filter(r => r.date.startsWith(month));

  const container = document.getElementById('report-content');
  if (!list.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>Nenhum dado ${month?'neste mês':'— selecione um mês'}.</p></div>`;
    return;
  }

  const names = getNames();
  let himC = 0, herC = 0, otherC = 0;
  let coupleBalanceCents = 0; 
  let thirdPartyDebts = { him: {}, her: {} };
  const storeMap = {};

  list.forEach(r => {
    const rHimC   = r.himCents   !== undefined ? r.himCents   : cents(r.himTotal   || 0);
    const rHerC   = r.herCents   !== undefined ? r.herCents   : cents(r.herTotal   || 0);
    const rOtherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);
    
    himC   += rHimC;
    herC   += rHerC;
    otherC += rOtherC;
    
    if (r.payer === 'him') {
      coupleBalanceCents += rHerC; 
      if (r.items) {
         r.items.filter(i => i.split === 'other').forEach(i => {
           let n = i.otherName || 'Alguém';
           thirdPartyDebts.him[n] = (thirdPartyDebts.him[n] || 0) + (i.priceCents !== undefined ? i.priceCents : cents(i.price));
         });
      }
    } else if (r.payer === 'her') {
      coupleBalanceCents -= rHimC; 
      if (r.items) {
         r.items.filter(i => i.split === 'other').forEach(i => {
           let n = i.otherName || 'Alguém';
           thirdPartyDebts.her[n] = (thirdPartyDebts.her[n] || 0) + (i.priceCents !== undefined ? i.priceCents : cents(i.price));
         });
      }
    }

    if (!storeMap[r.store]) storeMap[r.store] = { himC: 0, herC: 0 };
    storeMap[r.store].himC += rHimC;
    storeMap[r.store].herC += rHerC;
  });

  const coupleC = himC + herC;
  const grandC  = coupleC + otherC;
  const himPct  = coupleC > 0 ? Math.round(himC / coupleC * 100) : 0;
  const herPct  = 100 - himPct;
  
  let settlementHTML = '';
  if (coupleBalanceCents > 0) {
     settlementHTML = `<div class="card" style="margin-bottom:1rem; border-color: var(--both);">
       <div class="card-header" style="color: var(--both);">🤝 Acerto de Contas do Casal</div>
       <div style="padding:1.25rem; text-align:center;">
         <div style="font-size:0.85rem; color:var(--muted2); margin-bottom:0.5rem;">${names.her} deve pagar para ${names.him}</div>
         <div style="font-size:1.8rem; font-weight:800; color:var(--both);">${fmt(fromCents(coupleBalanceCents))}</div>
       </div>
     </div>`;
  } else if (coupleBalanceCents < 0) {
     settlementHTML = `<div class="card" style="margin-bottom:1rem; border-color: var(--her);">
       <div class="card-header" style="color: var(--her);">🤝 Acerto de Contas do Casal</div>
       <div style="padding:1.25rem; text-align:center;">
         <div style="font-size:0.85rem; color:var(--muted2); margin-bottom:0.5rem;">${names.him} deve pagar para ${names.her}</div>
         <div style="font-size:1.8rem; font-weight:800; color:var(--her);">${fmt(fromCents(Math.abs(coupleBalanceCents)))}</div>
       </div>
     </div>`;
  } else {
     settlementHTML = `<div class="card" style="margin-bottom:1rem;">
       <div class="card-header">🤝 Acerto de Contas do Casal</div>
       <div style="padding:1.25rem; text-align:center;">
         <div style="font-size:1rem; font-weight:700; color:var(--muted2);">Tudo quite! Ninguém deve nada ao outro.</div>
       </div>
     </div>`;
  }

  let thirdPartyHTML = '';
  let hasDebts = false;
  let debtsRows = '';

  Object.entries(thirdPartyDebts.him).forEach(([name, amount]) => {
    hasDebts = true;
    debtsRows += `<div class="store-row" style="border-color:var(--border2)">
      <span>${name} <small style="color:var(--muted2)">(deve a ${names.him})</small></span>
      <span style="color:var(--him); font-weight:800">${fmt(fromCents(amount))}</span>
    </div>`;
  });
  
  Object.entries(thirdPartyDebts.her).forEach(([name, amount]) => {
    hasDebts = true;
    debtsRows += `<div class="store-row" style="border-color:var(--border2)">
      <span>${name} <small style="color:var(--muted2)">(deve a ${names.her})</small></span>
      <span style="color:var(--her); font-weight:800">${fmt(fromCents(amount))}</span>
    </div>`;
  });

  if (hasDebts) {
    thirdPartyHTML = `<div class="card" style="margin-bottom:1rem; border-color: var(--other);">
      <div class="card-header" style="color: var(--other);">👥 A Receber de Terceiros (Empréstimos)</div>
      <div style="padding:0 1.25rem;">${debtsRows}</div>
    </div>`;
  }

  const storeRows = Object.entries(storeMap)
    .sort((a,b) => (b[1].himC + b[1].herC) - (a[1].himC + a[1].herC))
    .map(([store, v]) => `<div class="store-row">
      <span class="store-name">${store}</span>
      <div class="store-amounts">
        <span style="color:var(--him)">${fmt(fromCents(v.himC))}</span>
        <span style="color:var(--her)">${fmt(fromCents(v.herC))}</span>
      </div>
    </div>`).join('');

  const receiptRows = list
    .sort((a,b) => b.date.localeCompare(a.date))
    .map(r => {
      const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
      const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
      const d = new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'short'});
      return `<div class="store-row">
        <span>${d} — ${r.store}</span>
        <div class="store-amounts">
          <span style="color:var(--him)">${fmt(fromCents(rHimC))}</span>
          <span style="color:var(--her)">${fmt(fromCents(rHerC))}</span>
        </div>
      </div>`;
    }).join('');

  container.innerHTML = `
    ${settlementHTML}
    ${thirdPartyHTML}
    
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">${names.him} Consumiu</div>
        <div class="stat-value" style="color:var(--him)">${fmt(fromCents(himC))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${names.her} Consumiu</div>
        <div class="stat-value" style="color:var(--her)">${fmt(fromCents(herC))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Casal</div>
        <div class="stat-value" style="color:var(--both)">${fmt(fromCents(coupleC))}</div>
      </div>
      ${otherC > 0 ? `
      <div class="stat-card">
        <div class="stat-label">Terceiros Consumiram</div>
        <div class="stat-value" style="color:var(--other)">${fmt(fromCents(otherC))}</div>
      </div>` : `
      <div class="stat-card">
        <div class="stat-label">Total Geral Gasto</div>
        <div class="stat-value">${fmt(fromCents(grandC))}</div>
      </div>`}
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div class="card-header">📊 Proporção do casal (no mês)</div>
      <div style="padding:1rem 1.25rem" class="bar-section">
        <div class="bar-row">
          <div class="bar-label-row">
            <span>${names.him}</span>
            <span style="color:var(--him)">${himPct}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${himPct}%;background:var(--him)"></div>
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-label-row">
            <span>${names.her}</span>
            <span style="color:var(--her)">${herPct}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${herPct}%;background:var(--her)"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div class="card-header">🏪 Onde vocês mais gastaram</div>
      <div style="padding:0 1.25rem">${storeRows}</div>
    </div>

    <div class="card">
      <div class="card-header">🧾 ${list.length} cupons no mês</div>
      <div style="padding:0 1.25rem">${receiptRows}</div>
    </div>
  `;
}
window.renderReport = renderReport;

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
window.showToast = showToast;

// ── INICIAR ──
boot();