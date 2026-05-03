import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';

// ── TRATAMENTO GLOBAL DE ERROS ──
window.addEventListener('error', function(event) {
  console.error("Erro crítico:", event.message);
});
window.addEventListener('unhandledrejection', function(event) {
  console.error("Erro Firebase:", event.reason ? event.reason.message : "Desconhecido");
});

// ── TOAST ──
window.showToast = function(msg, duration = 3000) {
  try {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), duration);
    }
  } catch(e) {}
};

// ── ESTADO ──
let currentFile = null;
let currentBase64 = null;
let currentMime = 'image/jpeg';
let currentProducts = [];
let nextId = 0;
let allReceipts = [];
let appSettings = { him: 'Eu', her: 'Ela', password: '15112018', geminiKey: '', monthlyGoal: 0 };

// Estado do modal de edição
let editingFireId = null;
let editingItems = [];

// ── HELPERS ──
function cents(v) { return Math.round((parseFloat(v) || 0) * 100); }
function fromCents(c) { return c / 100; }
function fmt(v) { return 'R$ ' + fromCents(cents(v)).toFixed(2).replace('.', ','); }
function today() { return new Date().toISOString().split('T')[0]; }
function getNames() { return { him: appSettings.him || 'Eu', her: appSettings.her || 'Ela' }; }

const CATEGORY_LABELS = {
  mercado: '🛒 Mercado', restaurante: '🍽️ Restaurante', transporte: '🚗 Transporte',
  saude: '💊 Saúde', lazer: '🎉 Lazer', moradia: '🏠 Moradia',
  educacao: '📚 Educação', roupas: '👕 Roupas', outros: '📦 Outros'
};

function catLabel(cat) { return CATEGORY_LABELS[cat] || '📦 Outros'; }

function setSyncStatus(s) {
  try {
    const d = document.getElementById('sync-dot');
    if (d) d.className = 'sync-dot ' + s;
  } catch(e) {}
}

// ── ABAS ──
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-content-' + tab).classList.add('active');
};

// ── ATUALIZAR SELECTS DE PAGADOR ──
window.updatePayerSelect = function() {
  try {
    const names = getNames();
    const html = `<option value="him">${names.him}</option><option value="her">${names.her}</option>`;
    ['meta-payer', 'quick-payer', 'edit-payer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
    const quickSplit = document.getElementById('quick-split');
    if (quickSplit) {
      quickSplit.options[0].text = 'Dividir entre o Casal';
      quickSplit.options[1].text = `Só para ${names.him.split(' ')[0]}`;
      quickSplit.options[2].text = `Só para ${names.her.split(' ')[0]}`;
      quickSplit.options[3].text = 'Emprestado (Terceiro)';
    }
  } catch (error) {
    console.error("Erro ao atualizar selects:", error);
  }
};

// ── LOGIN ──
window.verificarSenha = function() {
  try {
    const inputEl = document.getElementById('senha-input');
    const erroMsg = document.getElementById('login-erro');
    if (!inputEl || !erroMsg) return;
    const input = inputEl.value;
    if (!input) { erroMsg.style.display = 'block'; erroMsg.textContent = 'Digite a senha!'; return; }
    if (input === appSettings.password) {
      erroMsg.style.display = 'none';
      localStorage.setItem('casal_auth', 'ok');
      liberarAcesso();
    } else {
      erroMsg.style.display = 'block';
      erroMsg.textContent = 'Senha incorreta! Tente novamente.';
      inputEl.classList.add('shake');
      setTimeout(() => inputEl.classList.remove('shake'), 500);
    }
  } catch (error) {
    console.error("Erro login:", error);
  }
};

function liberarAcesso() {
  try {
    const loginScreen = document.getElementById('login-screen');
    loginScreen.style.opacity = '0';
    loginScreen.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { loginScreen.style.display = 'none'; }, 400);
    document.getElementById('app-content').style.display = 'block';
    initApp();
  } catch (error) {
    console.error("Erro ao liberar acesso:", error);
  }
}

window.logout = function() {
  localStorage.removeItem('casal_auth');
  location.reload();
};

// ── FIREBASE: SETTINGS ──
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    if (snap.exists()) appSettings = { ...appSettings, ...snap.data() };
  } catch(e) {
    console.warn("Aviso: Falha ao carregar configurações.", e.message);
  }
}

async function saveSettingsToCloud() {
  setSyncStatus('syncing');
  try {
    await setDoc(doc(db, 'config', 'settings'), appSettings);
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('err');
    window.showToast("❌ Falha ao salvar configurações.");
  }
}

// ── FIREBASE: RECEIPTS ──
async function loadReceipts() {
  setSyncStatus('syncing');
  try {
    const q = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    allReceipts = snap.docs.map(d => ({ ...d.data(), _fireId: d.id }));
    setSyncStatus('ok');
  } catch(e) {
    try {
      const snap2 = await getDocs(collection(db, 'receipts'));
      allReceipts = snap2.docs.map(d => ({ ...d.data(), _fireId: d.id }));
      allReceipts.sort((a, b) => b.date.localeCompare(a.date));
      setSyncStatus('ok');
    } catch(e2) {
      setSyncStatus('err');
      window.showToast("❌ Erro ao baixar cupons: " + e2.message);
    }
  }
  try {
    window.populateMonthSelects();
    window.renderHistory();
  } catch (error) {
    console.error("Erro ao renderizar histórico:", error);
  }
}

async function addReceiptToCloud(receipt) {
  setSyncStatus('syncing');
  try {
    const ref = await addDoc(collection(db, 'receipts'), receipt);
    receipt._fireId = ref.id;
    allReceipts.unshift(receipt);
    allReceipts.sort((a, b) => b.date.localeCompare(a.date));
    setSyncStatus('ok');
    return true;
  } catch(e) {
    setSyncStatus('err');
    window.showToast('❌ Erro ao salvar: ' + e.message);
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
    window.showToast("❌ Falha ao excluir: " + e.message);
    return false;
  }
}

// ── TOGGLE STATUS PAGO/ABERTO ──
window.toggleReceiptStatus = async function(fireId) {
  try {
    const receipt = allReceipts.find(r => r._fireId === fireId);
    if (!receipt) return;
    const newStatus = receipt.status === 'paid' ? 'open' : 'paid';
    setSyncStatus('syncing');
    await setDoc(doc(db, 'receipts', fireId), { status: newStatus }, { merge: true });
    receipt.status = newStatus;
    setSyncStatus('ok');
    window.renderHistory();
    window.renderReport();
    window.showToast(newStatus === 'paid' ? '✅ Conta marcada como paga!' : '🔄 Conta reaberta!');
  } catch(e) {
    setSyncStatus('err');
    window.showToast('❌ Erro ao atualizar: ' + e.message);
  }
};

// ── MODAL: EDITAR CUPOM ──
window.openEditModal = function(fireId) {
  const receipt = allReceipts.find(r => r._fireId === fireId);
  if (!receipt) return;
  editingFireId = fireId;
  editingItems = receipt.items.map(i => ({ ...i }));

  document.getElementById('edit-store').value = receipt.store || '';
  document.getElementById('edit-date').value = receipt.date || today();
  document.getElementById('edit-method').value = receipt.method || '';
  document.getElementById('edit-category').value = receipt.category || 'outros';
  window.updatePayerSelect();
  document.getElementById('edit-payer').value = receipt.payer || 'him';

  renderEditItems();
  document.getElementById('edit-modal').classList.add('open');
};

window.closeEditModal = function() {
  document.getElementById('edit-modal').classList.remove('open');
  editingFireId = null;
  editingItems = [];
};

// Funções globais para manipular os dados do modal sem problemas de escopo
window.updateEditItem = function(idx, field, value) {
  if (!editingItems[idx]) return;
  if (field === 'priceCents') {
    editingItems[idx].priceCents = Math.round(parseFloat(value || 0) * 100);
  } else {
    editingItems[idx][field] = value;
  }
};

window.removeEditItem = function(idx) {
  editingItems.splice(idx, 1);
  renderEditItems();
};

function renderEditItems() {
  const names = getNames();
  const container = document.getElementById('edit-items-list');
  if (!container) return;

  container.innerHTML = '<div class="field-label" style="margin-bottom:0.5rem">Itens do cupom</div>' +
    editingItems.map((item, idx) => {
      const splitOpts = [
        { v: 'both', l: '÷2' },
        { v: 'him', l: names.him.split(' ')[0] },
        { v: 'her', l: names.her.split(' ')[0] },
        { v: 'other', l: '👤' }
      ].map(o => `<option value="${o.v}" ${item.split === o.v ? 'selected' : ''}>${o.l}</option>`).join('');

      return `<div class="edit-item-row">
        <input class="edit-item-name" value="${item.name}" oninput="window.updateEditItem(${idx}, 'name', this.value)" placeholder="Nome">
        <input class="edit-item-price" type="number" step="0.01" value="${fromCents(item.priceCents || 0).toFixed(2)}" oninput="window.updateEditItem(${idx}, 'priceCents', this.value)">
        <select class="field-input" style="width:70px;padding:0.4rem 0.3rem;font-size:0.75rem" onchange="window.updateEditItem(${idx}, 'split', this.value)">${splitOpts}</select>
        <button class="del-item-btn" onclick="window.removeEditItem(${idx})">✕</button>
      </div>`;
    }).join('');
}

window.saveEditModal = async function() {
  try {
    const receipt = allReceipts.find(r => r._fireId === editingFireId);
    if (!receipt) return;

    const { himC, herC, otherC } = calcTotals(editingItems);
    const names = getNames();

    const updates = {
      store: document.getElementById('edit-store').value.trim() || receipt.store,
      date: document.getElementById('edit-date').value || receipt.date,
      method: document.getElementById('edit-method').value.trim(),
      category: document.getElementById('edit-category').value || 'outros',
      payer: document.getElementById('edit-payer').value,
      items: editingItems,
      himCents: himC, herCents: herC, otherCents: otherC,
      coupleCents: himC + herC, totalCents: himC + herC + otherC,
      names: { him: names.him, her: names.her }
    };

    setSyncStatus('syncing');
    await setDoc(doc(db, 'receipts', editingFireId), updates, { merge: true });
    Object.assign(receipt, updates);
    setSyncStatus('ok');
    window.closeEditModal();
    window.renderHistory();
    window.renderReport();
    window.showToast('✅ Lançamento atualizado!');
  } catch(e) {
    setSyncStatus('err');
    window.showToast('❌ Erro ao salvar: ' + e.message);
  }
};

// ── BOOT ──
async function checkAuthAndBoot() {
  try {
    await loadSettings();
    const senhaInput = document.getElementById('senha-input');
    if (senhaInput) {
      senhaInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') window.verificarSenha();
      });
    }
    if (localStorage.getItem('casal_auth') === 'ok') {
      liberarAcesso();
    }
  } catch (error) {
    console.error("Erro no boot:", error);
  }
}

async function initApp() {
  try {
    document.getElementById('api-key-input').value = appSettings.geminiKey || '';
    document.getElementById('api-key-settings').value = appSettings.geminiKey || '';
    document.getElementById('name-him').value = appSettings.him;
    document.getElementById('name-her').value = appSettings.her;
    document.getElementById('meta-date').value = today();
    const goalEl = document.getElementById('monthly-goal');
    if (goalEl) goalEl.value = appSettings.monthlyGoal > 0 ? fromCents(appSettings.monthlyGoal).toFixed(2) : '';
    window.updatePayerSelect();

    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) window.loadFile(e.dataTransfer.files[0]);
      });
    }

    await loadReceipts();
  } catch (error) {
    window.showToast("Erro ao carregar: " + error.message);
  }
}

// ── LANÇAMENTO RÁPIDO ──
window.saveQuickExpense = async function() {
  try {
    const desc = document.getElementById('quick-desc').value.trim();
    const price = document.getElementById('quick-price').value;
    const payer = document.getElementById('quick-payer').value;
    const split = document.getElementById('quick-split').value;
    const otherName = document.getElementById('quick-other-name').value.trim();
    const category = document.getElementById('quick-category').value || 'outros';

    if (!desc) { window.showToast('⚠️ Digite o que é o gasto!'); return; }
    if (!price || price <= 0) { window.showToast('⚠️ Digite o valor!'); return; }
    if (split === 'other' && !otherName) { window.showToast('⚠️ Digite o nome do devedor!'); return; }

    const itemCents = cents(price);
    let himC = 0, herC = 0, otherC = 0;
    if (split === 'him') himC = itemCents;
    else if (split === 'her') herC = itemCents;
    else if (split === 'other') otherC = itemCents;
    else { himC = Math.floor(itemCents / 2); herC = itemCents - Math.floor(itemCents / 2); }

    const item = { id: Date.now(), name: desc, priceCents: itemCents, split, otherName: split === 'other' ? otherName : '' };
    const names = getNames();
    const receipt = {
      id: Date.now(), store: 'Lançamento Avulso', date: today(), payer, method: 'Avulso',
      category, status: 'open', items: [item],
      himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
      imageBase64: null, imageMime: null, names: { him: names.him, her: names.her }, createdAt: Date.now()
    };

    const ok = await addReceiptToCloud(receipt);
    if (ok) {
      window.showToast('✅ Lançamento salvo!');
      document.getElementById('quick-desc').value = '';
      document.getElementById('quick-price').value = '';
      document.getElementById('quick-other-name').value = '';
      document.getElementById('quick-other-div').style.display = 'none';
      document.getElementById('quick-split').value = 'both';
      document.getElementById('quick-category').value = 'outros';
      window.populateMonthSelects();
      window.renderHistory();
    }
  } catch (error) {
    window.showToast("Erro: " + error.message);
  }
};

// ── SETTINGS ──
window.saveApiKey = function() {
  try {
    const k = document.getElementById('api-key-input').value.trim();
    appSettings.geminiKey = k;
    document.getElementById('api-key-settings').value = k;
    saveSettingsToCloud();
  } catch(e) {}
};

window.saveApiKeySettings = function() {
  try {
    const k = document.getElementById('api-key-settings').value.trim();
    appSettings.geminiKey = k;
    document.getElementById('api-key-input').value = k;
    saveSettingsToCloud();
  } catch(e) {}
};

window.saveNames = function() {
  try {
    appSettings.him = document.getElementById('name-him').value || 'Eu';
    appSettings.her = document.getElementById('name-her').value || 'Ela';
    window.updatePayerSelect();
    saveSettingsToCloud();
  } catch(e) {}
};

window.saveGoal = function() {
  try {
    const v = document.getElementById('monthly-goal').value;
    appSettings.monthlyGoal = cents(v);
    saveSettingsToCloud();
  } catch(e) {}
};

window.changePassword = function() {
  try {
    const np = document.getElementById('new-password').value.trim();
    if (!np) { window.showToast('⚠️ Digite a nova senha!'); return; }
    appSettings.password = np;
    saveSettingsToCloud();
    document.getElementById('new-password').value = '';
    window.showToast('✅ Senha alterada!');
  } catch(e) {}
};

window.clearAllData = async function() {
  if (!confirm('Apagar TODOS os cupons? Não pode desfazer.')) return;
  setSyncStatus('syncing');
  try {
    const snap = await getDocs(collection(db, 'receipts'));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'receipts', d.id))));
    allReceipts = [];
    setSyncStatus('ok');
    window.populateMonthSelects();
    window.renderHistory();
    window.renderReport();
    window.showToast('🗑️ Dados apagados.');
  } catch(e) {
    setSyncStatus('err');
    window.showToast('❌ Erro: ' + e.message);
  }
};

// ── NAVEGAÇÃO ──
window.showPage = function(id, desktopBtn, navId) {
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    document.querySelectorAll('.desktop-nav-btn').forEach(b => b.classList.remove('active'));
    if (desktopBtn) desktopBtn.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId) document.getElementById(navId)?.classList.add('active');
    if (id === 'history') { window.populateMonthSelects(); window.renderHistory(); }
    if (id === 'report')  { window.populateMonthSelects(); window.renderReport(); }
  } catch (error) {
    console.error("Erro ao mudar página:", error);
  }
};

// ── UPLOAD / CUPOM ──
window.handleFile = function(e) { if (e.target.files[0]) window.loadFile(e.target.files[0]); };

window.loadFile = function(file) {
  try {
    currentFile = file;
    currentMime = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = e => {
      currentBase64 = e.target.result.split(',')[1];
      document.getElementById('preview-img').src = e.target.result;
      document.getElementById('preview-section').style.display = 'block';
      document.getElementById('upload-zone').style.display = 'none';
      document.getElementById('products-section').style.display = 'none';
    };
    reader.readAsDataURL(file);
  } catch (error) {
    window.showToast("Erro ao carregar imagem: " + error.message);
  }
};

window.resetUpload = function() {
  try {
    currentFile = null; currentBase64 = null; currentProducts = []; nextId = 0;
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('products-section').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'block';
    document.getElementById('upload-zone').querySelector('input').value = '';
    document.getElementById('meta-method').value = '';
  } catch(e) {}
};

window.resetAll = function() { window.resetUpload(); window.showToast('Descartado.'); };

// ── GEMINI ──
window.extractWithGemini = async function() {
  try {
    const apiKey = appSettings.geminiKey || '';
    if (!apiKey) { window.showToast('⚠️ Configure a chave Gemini!'); return; }
    if (!currentBase64) { window.showToast('⚠️ Selecione uma imagem!'); return; }

    document.getElementById('extract-btn').disabled = true;
    document.getElementById('loading-box').style.display = 'flex';

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [
        { inline_data: { mime_type: currentMime, data: currentBase64 } },
        { text: `Analise este cupom fiscal brasileiro. Retorne APENAS JSON válido, sem markdown, sem texto extra:\n{"store":"nome do estabelecimento","date":"YYYY-MM-DD","items":[{"name":"nome do produto","price":0.00}]}\nUse preço total do item (qtd x unitário). Omita itens ilegíveis. NUNCA coloque texto fora do JSON.` }
      ]}],
      generationConfig: { temperature: 0 }
    };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.split('```json').join('').split('```').join('').trim();
    const parsed = JSON.parse(text);

    currentProducts = parsed.items.map(item => ({
      id: nextId++, name: item.name, priceCents: cents(item.price), split: 'both', otherName: ''
    }));

    if (parsed.store) document.getElementById('meta-store').value = parsed.store;
    if (parsed.date) document.getElementById('meta-date').value = parsed.date;

    window.renderProducts();
    document.getElementById('products-section').style.display = 'block';
    window.showToast('✅ Extraído com sucesso!');
  } catch(err) {
    window.showToast('❌ Erro na extração: ' + err.message);
  } finally {
    const btn = document.getElementById('extract-btn');
    if (btn) btn.disabled = false;
    const box = document.getElementById('loading-box');
    if (box) box.style.display = 'none';
  }
};

// ── PRODUTOS ──
window.addManual = function() {
  try {
    const nameEl = document.getElementById('new-name');
    const priceEl = document.getElementById('new-price');
    const name = nameEl.value.trim();
    if (!name) { window.showToast('⚠️ Digite o nome!'); return; }
    currentProducts.push({ id: nextId++, name, priceCents: cents(priceEl.value), split: 'both', otherName: '' });
    nameEl.value = ''; priceEl.value = '';
    document.getElementById('products-section').style.display = 'block';
    window.renderProducts();
    nameEl.focus();
  } catch (error) {
    window.showToast("Erro ao adicionar: " + error.message);
  }
};

window.renderProducts = function() {
  try {
    const names = getNames();
    const list = document.getElementById('products-list');
    list.innerHTML = '';
    currentProducts.forEach(item => {
      const div = document.createElement('div');
      div.className = 'product-item';
      div.id = 'item-' + item.id;
      const otherInput = item.split === 'other'
        ? `<input class="other-input" placeholder="Nome da pessoa..." value="${item.otherName || ''}" oninput="window.setOtherName(${item.id}, this.value)">`
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
            <button class="split-btn ${item.split==='him'?'s-him':''}" onclick="window.setSplit(${item.id},'him')">${names.him.split(' ')[0]}</button>
            <button class="split-btn ${item.split==='her'?'s-her':''}" onclick="window.setSplit(${item.id},'her')">${names.her.split(' ')[0]}</button>
            <button class="split-btn ${item.split==='both'?'s-both':''}" onclick="window.setSplit(${item.id},'both')">÷2</button>
            <button class="split-btn ${item.split==='other'?'s-other':''}" onclick="window.setSplit(${item.id},'other')">👤 Emp.</button>
          </div>
        </div>
        ${otherInput}
      `;
      list.appendChild(div);
    });
    window.renderSummary();
  } catch (error) {
    window.showToast("Erro ao renderizar produtos: " + error.message);
  }
};

window.removeItem = function(id) { currentProducts = currentProducts.filter(p => p.id !== id); window.renderProducts(); };

window.setSplit = function(id, type) {
  const item = currentProducts.find(p => p.id === id);
  if (item) { item.split = type; if (type !== 'other') item.otherName = ''; }
  window.renderProducts();
};

window.setOtherName = function(id, name) {
  const item = currentProducts.find(p => p.id === id);
  if (item) item.otherName = name;
  window.renderSummary();
};

function calcTotals(products) {
  let himC = 0, herC = 0, otherC = 0;
  products.forEach(p => {
    const c = p.priceCents !== undefined ? p.priceCents : cents(p.price || 0);
    if (p.split === 'him') himC += c;
    else if (p.split === 'her') herC += c;
    else if (p.split === 'other') otherC += c;
    else { himC += Math.floor(c / 2); herC += c - Math.floor(c / 2); }
  });
  return { himC, herC, otherC };
}

window.renderSummary = function() {
  try {
    const names = getNames();
    const { himC, herC, otherC } = calcTotals(currentProducts);
    const coupleC = himC + herC;
    const pills = [
      { label: names.him, value: fmt(fromCents(himC)), color: 'var(--him)' },
      { label: names.her, value: fmt(fromCents(herC)), color: 'var(--her)' },
      { label: 'Casal',   value: fmt(fromCents(coupleC)), color: 'var(--both)' },
      otherC > 0 ? { label: 'Terceiros', value: fmt(fromCents(otherC)), color: 'var(--other)' } : null
    ].filter(Boolean);
    document.getElementById('summary-row').innerHTML = pills.map(p =>
      `<div class="summary-pill"><div class="pill-label">${p.label}</div><div class="pill-value" style="color:${p.color}">${p.value}</div></div>`
    ).join('');
  } catch(e) {}
};

// ── SALVAR CUPOM ──
window.saveReceipt = async function() {
  try {
    if (currentProducts.length === 0) { window.showToast('⚠️ Nenhum produto adicionado!'); return; }
    const names = getNames();
    const { himC, herC, otherC } = calcTotals(currentProducts);
    const receipt = {
      id: Date.now(),
      store: document.getElementById('meta-store').value.trim() || 'Sem nome',
      date: document.getElementById('meta-date').value || today(),
      payer: document.getElementById('meta-payer').value || 'him',
      method: document.getElementById('meta-method').value.trim(),
      category: document.getElementById('meta-category').value || 'outros',
      status: 'open',
      items: currentProducts.map(p => ({ ...p })),
      himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
      imageBase64: currentBase64, imageMime: currentMime,
      names: { him: names.him, her: names.her }, createdAt: Date.now()
    };
    const ok = await addReceiptToCloud(receipt);
    if (ok) {
      window.resetUpload(); 
      window.populateMonthSelects();
      window.renderHistory();
      window.showToast('✅ Cupom salvo na nuvem!');
    }
  } catch (error) {
    window.showToast("Erro ao salvar: " + error.message);
  }
};

// ── DELETAR ──
window.deleteReceipt = async function(fireId) {
  if (!confirm('Deletar este cupom?')) return;
  const ok = await deleteReceiptFromCloud(fireId);
  if (ok) {
    window.populateMonthSelects();
    window.renderHistory();
    window.renderReport();
    window.showToast('🗑️ Removido.');
  }
};

// ── EXPORTAR CSV ──
window.exportCSV = function() {
  try {
    const month = document.getElementById('report-month')?.value || '';
    let list = [...allReceipts];
    if (month) list = list.filter(r => r.date.startsWith(month));
    if (!list.length) { window.showToast('⚠️ Nenhum dado para exportar.'); return; }

    const names = getNames();
    const rows = [['Data', 'Estabelecimento', 'Categoria', 'Pago por', 'Forma', names.him, names.her, 'Terceiros', 'Total', 'Status']];
    list.forEach(r => {
      const himC = r.himCents || 0;
      const herC = r.herCents || 0;
      const othC = r.otherCents || 0;
      rows.push([
        r.date, r.store, catLabel(r.category || 'outros'),
        r.payer === 'him' ? names.him : names.her,
        r.method || '',
        fromCents(himC).toFixed(2),
        fromCents(herC).toFixed(2),
        fromCents(othC).toFixed(2),
        fromCents(himC + herC + othC).toFixed(2),
        r.status === 'paid' ? 'Pago' : 'Em Aberto'
      ]);
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos_casal_${month || 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('📥 CSV exportado!');
  } catch(e) {
    window.showToast('❌ Erro ao exportar: ' + e.message);
  }
};

// ── POPULARTE MONTH SELECTS ──
window.populateMonthSelects = function() {
  try {
    const months = [...new Set(allReceipts.map(r => r.date.slice(0, 7)))].sort().reverse();
    ['filter-month', 'report-month'].forEach(sid => {
      const sel = document.getElementById(sid);
      if (!sel) return;
      const first = sel.options[0].cloneNode(true);
      sel.innerHTML = '';
      sel.appendChild(first);
      months.forEach(m => {
        const [y, mo] = m.split('-');
        const label = new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        sel.appendChild(opt);
      });
    });
  } catch(e) {}
};

// ── RENDER HISTORY ──
window.renderHistory = function() {
  try {
    const month = document.getElementById('filter-month')?.value || '';
    const person = document.getElementById('filter-person')?.value || '';
    const category = document.getElementById('filter-category')?.value || '';
    let list = [...allReceipts];
    if (month) list = list.filter(r => r.date.startsWith(month));
    if (person === 'him') list = list.filter(r => r.himCents > 0);
    if (person === 'her') list = list.filter(r => r.herCents > 0);
    if (category) list = list.filter(r => (r.category || 'outros') === category);
    list.sort((a, b) => b.date.localeCompare(a.date));

    const container = document.getElementById('history-list');
    if (!list.length) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><p>Nenhum cupom encontrado.</p></div>`;
      return;
    }

    container.innerHTML = list.map((r, idx) => {
      const names = r.names || getNames();
      const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const himC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
      const herC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
      const otherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);
      const isPaid = r.status === 'paid';
      const fid = r._fireId;
      const payerName = r.payer === 'him' ? names.him : (r.payer === 'her' ? names.her : '');
      const methodStr = r.method ? ` (${r.method})` : '';
      const cat = catLabel(r.category || 'outros');

      const statusBadge = isPaid
        ? `<span style="background:var(--both-bg);color:var(--both);padding:0.15rem 0.4rem;border-radius:10px;font-size:0.62rem;font-weight:800;margin-left:0.4rem;">✅ PAGO</span>`
        : `<span style="background:var(--other-bg);color:var(--other);padding:0.15rem 0.4rem;border-radius:10px;font-size:0.62rem;font-weight:800;margin-left:0.4rem;">⏳ EM ABERTO</span>`;

      const itemRows = r.items.map(item => {
        const iC = item.priceCents !== undefined ? item.priceCents : cents(item.price || 0);
        const badgeClass = item.split === 'him' ? 'badge-him' : item.split === 'her' ? 'badge-her' : item.split === 'other' ? 'badge-other' : 'badge-both';
        const badgeLabel = item.split === 'him' ? names.him.split(' ')[0] : item.split === 'her' ? names.her.split(' ')[0] : item.split === 'other' ? (item.otherName || '?') : '÷2';
        return `<div class="receipt-item-row"><span style="flex:1">${item.name}</span><span class="item-badge ${badgeClass}">${badgeLabel}</span><span style="font-weight:700;color:var(--both)">${fmt(fromCents(iC))}</span></div>`;
      }).join('');

      const imgSrc = r.imageBase64 ? `data:${r.imageMime || 'image/jpeg'};base64,${r.imageBase64}` : '';

      return `<div class="receipt-card" style="${isPaid ? 'opacity:0.72;' : ''}animation-delay:${idx * 0.04}s">
        <div class="receipt-head" onclick="window.toggleCard('${fid}')">
          <div style="min-width:0">
            <div class="receipt-store">${r.store}</div>
            <div class="receipt-date" style="display:flex;align-items:center;flex-wrap:wrap;gap:0.2rem;margin-top:0.2rem">
              ${dateStr} ${statusBadge}
            </div>
            <div style="margin-top:0.25rem">
              <span class="category-badge">${cat}</span>
              ${payerName ? `<span style="font-size:0.7rem;color:var(--muted2);margin-left:0.35rem">por <strong>${payerName}</strong>${methodStr}</span>` : ''}
            </div>
          </div>
          <div class="receipt-amounts">
            <div class="receipt-amount-item"><div class="amount-dot" style="background:var(--him)"></div><span style="color:var(--him)">${fmt(fromCents(himC))}</span></div>
            <div class="receipt-amount-item"><div class="amount-dot" style="background:var(--her)"></div><span style="color:var(--her)">${fmt(fromCents(herC))}</span></div>
            ${otherC > 0 ? `<div class="receipt-amount-item"><div class="amount-dot" style="background:var(--other)"></div><span style="color:var(--other)">${fmt(fromCents(otherC))}</span></div>` : ''}
          </div>
        </div>
        <div class="receipt-body" id="card-body-${fid}">
          ${imgSrc ? `<div class="receipt-img-wrap"><img src="${imgSrc}" alt="Cupom"></div>` : ''}
          <div class="receipt-items">${itemRows}</div>
          <div class="receipt-actions">
            <button class="btn ${isPaid ? 'btn-ghost' : 'btn-success'} btn-sm" onclick="window.toggleReceiptStatus('${fid}')">${isPaid ? '🔄 Reabrir' : '💸 Marcar Pago'}</button>
            <button class="btn btn-ghost btn-sm" onclick="window.openEditModal('${fid}')">✏️ Editar</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteReceipt('${fid}')">🗑️ Apagar</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    window.showToast("Erro ao renderizar histórico: " + error.message);
  }
};

window.toggleCard = function(id) {
  try { document.getElementById('card-body-' + id)?.classList.toggle('open'); } catch(e) {}
};

// ── DONUT CHART SVG ──
function buildDonutSVG(segments) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return '';
  const r = 52, cx = 60, cy = 60, stroke = 16;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let paths = '';
  segments.forEach(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset * circ / total).toFixed(2)}"
      stroke-linecap="butt"
      style="transform:rotate(-90deg);transform-origin:${cx}px ${cy}px;transition:stroke-dasharray 0.6s ease"/>`;
    offset += seg.value;
  });
  return `<svg class="donut-svg" viewBox="0 0 120 120" width="120" height="120">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>
    ${paths}
  </svg>`;
}

// ── RENDER REPORT ──
window.renderReport = function() {
  try {
    const month = document.getElementById('report-month')?.value || '';
    let list = [...allReceipts];
    if (month) list = list.filter(r => r.date.startsWith(month));

    const container = document.getElementById('report-content');
    if (!list.length) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>Nenhum dado ${month ? 'neste mês' : '— selecione um mês'}.</p></div>`;
      return;
    }

    const names = getNames();
    let himC = 0, herC = 0, otherC = 0;
    let coupleBalanceCents = 0;
    let thirdPartyDebts = { him: {}, her: {} };
    const storeMap = {};
    const categoryMap = {};

    list.forEach(r => {
      const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
      const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
      const rOtherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);
      himC += rHimC; herC += rHerC; otherC += rOtherC;

      // Acerto
      if (r.status !== 'paid') {
        if (r.payer === 'him') {
          coupleBalanceCents += rHerC;
          if (r.items) r.items.filter(i => i.split === 'other').forEach(i => {
            const n = i.otherName || 'Alguém';
            thirdPartyDebts.him[n] = (thirdPartyDebts.him[n] || 0) + (i.priceCents || cents(i.price));
          });
        } else if (r.payer === 'her') {
          coupleBalanceCents -= rHimC;
          if (r.items) r.items.filter(i => i.split === 'other').forEach(i => {
            const n = i.otherName || 'Alguém';
            thirdPartyDebts.her[n] = (thirdPartyDebts.her[n] || 0) + (i.priceCents || cents(i.price));
          });
        }
      }

      // Loja
      if (!storeMap[r.store]) storeMap[r.store] = { himC: 0, herC: 0 };
      storeMap[r.store].himC += rHimC;
      storeMap[r.store].herC += rHerC;

      // Categoria
      const cat = r.category || 'outros';
      if (!categoryMap[cat]) categoryMap[cat] = 0;
      categoryMap[cat] += rHimC + rHerC + rOtherC;
    });

    const coupleC = himC + herC;
    const grandC = coupleC + otherC;
    const himPct = coupleC > 0 ? Math.round(himC / coupleC * 100) : 0;
    const herPct = 100 - himPct;

    // ── Acerto ──
    let settlementHTML = '';
    if (coupleBalanceCents > 0) {
      settlementHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--both)">
        <div class="card-header" style="color:var(--both)">🤝 Acerto do Casal</div>
        <div style="padding:1.25rem;text-align:center">
          <div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.her} deve pagar para ${names.him}</div>
          <div style="font-size:2rem;font-weight:900;color:var(--both);letter-spacing:-1px">${fmt(fromCents(coupleBalanceCents))}</div>
          <div style="font-size:0.7rem;color:var(--muted2);margin-top:0.4rem">*Somente contas Em Aberto</div>
        </div></div>`;
    } else if (coupleBalanceCents < 0) {
      settlementHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--her)">
        <div class="card-header" style="color:var(--her)">🤝 Acerto do Casal</div>
        <div style="padding:1.25rem;text-align:center">
          <div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.him} deve pagar para ${names.her}</div>
          <div style="font-size:2rem;font-weight:900;color:var(--her);letter-spacing:-1px">${fmt(fromCents(Math.abs(coupleBalanceCents)))}</div>
          <div style="font-size:0.7rem;color:var(--muted2);margin-top:0.4rem">*Somente contas Em Aberto</div>
        </div></div>`;
    } else {
      settlementHTML = `<div class="card" style="margin-bottom:1rem">
        <div class="card-header">🤝 Acerto do Casal</div>
        <div style="padding:1.25rem;text-align:center;font-weight:700;color:var(--both)">Tudo quite! ✅</div>
      </div>`;
    }

    // ── Terceiros ──
    let thirdPartyHTML = '';
    let debtsRows = '';
    let hasDebts = false;
    Object.entries(thirdPartyDebts.him).forEach(([name, amount]) => {
      hasDebts = true;
      debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.him})</small></span><span style="color:var(--him);font-weight:800">${fmt(fromCents(amount))}</span></div>`;
    });
    Object.entries(thirdPartyDebts.her).forEach(([name, amount]) => {
      hasDebts = true;
      debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.her})</small></span><span style="color:var(--her);font-weight:800">${fmt(fromCents(amount))}</span></div>`;
    });
    if (hasDebts) {
      thirdPartyHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--other)">
        <div class="card-header" style="color:var(--other)">👥 A Receber de Terceiros (Em Aberto)</div>
        <div style="padding:0 1.25rem">${debtsRows}</div></div>`;
    }

    // ── Meta mensal ──
    let goalHTML = '';
    if (appSettings.monthlyGoal > 0) {
      const pct = Math.min(100, Math.round(coupleC / appSettings.monthlyGoal * 100));
      const color = pct >= 100 ? 'var(--her)' : pct >= 80 ? 'var(--other)' : 'var(--both)';
      goalHTML = `<div class="card" style="margin-bottom:1rem">
        <div class="card-header">🎯 Meta Mensal do Casal</div>
        <div class="goal-bar-wrap">
          <div class="goal-bar-labels">
            <span>${fmt(fromCents(coupleC))} gastos</span>
            <span style="color:${color};font-weight:800">${pct}%</span>
          </div>
          <div class="goal-bar-track">
            <div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div style="font-size:0.72rem;color:var(--muted2);margin-top:0.4rem">Meta: ${fmt(fromCents(appSettings.monthlyGoal))}</div>
        </div>
      </div>`;
    }

    // ── Stats ──
    const statsHTML = `<div class="stat-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-label">${names.him} consumiu</div><div class="stat-value" style="color:var(--him)">${fmt(fromCents(himC))}</div></div>
      <div class="stat-card"><div class="stat-label">${names.her} consumiu</div><div class="stat-value" style="color:var(--her)">${fmt(fromCents(herC))}</div></div>
      <div class="stat-card"><div class="stat-label">Total do casal</div><div class="stat-value" style="color:var(--both)">${fmt(fromCents(coupleC))}</div></div>
      ${otherC > 0
        ? `<div class="stat-card"><div class="stat-label">Terceiros</div><div class="stat-value" style="color:var(--other)">${fmt(fromCents(otherC))}</div></div>`
        : `<div class="stat-card"><div class="stat-label">Contas no mês</div><div class="stat-value">${list.length}</div></div>`}
    </div>`;

    // ── Donut Chart ──
    const donutSegs = [
      { value: himC, color: 'var(--him)', label: names.him, val: fmt(fromCents(himC)) },
      { value: herC, color: 'var(--her)', label: names.her, val: fmt(fromCents(herC)) },
    ];
    if (otherC > 0) donutSegs.push({ value: otherC, color: 'var(--other)', label: 'Terceiros', val: fmt(fromCents(otherC)) });

    const donutHTML = `<div class="card" style="margin-bottom:1rem">
      <div class="card-header">🍩 Proporção de gastos</div>
      <div class="donut-wrap">
        ${buildDonutSVG(donutSegs)}
        <div class="donut-legend">
          ${donutSegs.map(s => `<div class="donut-legend-item">
            <div class="donut-legend-dot" style="background:${s.color}"></div>
            <span class="donut-legend-label">${s.label}</span>
            <span class="donut-legend-value" style="color:${s.color}">${s.val}</span>
          </div>`).join('')}
          <div class="donut-legend-item" style="margin-top:0.25rem;padding-top:0.5rem;border-top:1px solid var(--border)">
            <span class="donut-legend-label">Proporção</span>
            <span class="donut-legend-value" style="color:var(--muted2)">${himPct}% / ${herPct}%</span>
          </div>
        </div>
      </div>
    </div>`;

    // ── Categorias ──
    const topCat = grandC > 0;
    const catRows = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => {
        const pctBar = grandC > 0 ? Math.round(val / grandC * 100) : 0;
        return `<div class="cat-row">
          <span style="min-width:100px;font-size:0.82rem;font-weight:600">${catLabel(cat)}</span>
          <div class="cat-row-bar"><div class="cat-row-fill" style="width:${pctBar}%"></div></div>
          <span class="cat-row-value">${fmt(fromCents(val))}</span>
        </div>`;
      }).join('');

    const categoryHTML = topCat ? `<div class="card" style="margin-bottom:1rem">
      <div class="card-header">📂 Gastos por categoria</div>
      <div style="padding:0.5rem 1.25rem">${catRows}</div>
    </div>` : '';

    // ── Estabelecimentos ──
    const storeRows = Object.entries(storeMap)
      .sort((a, b) => (b[1].himC + b[1].herC) - (a[1].himC + a[1].herC))
      .slice(0, 8)
      .map(([store, v]) => `<div class="store-row">
        <span class="store-name">${store}</span>
        <div class="store-amounts">
          <span style="color:var(--him)">${fmt(fromCents(v.himC))}</span>
          <span style="color:var(--her)">${fmt(fromCents(v.herC))}</span>
        </div>
      </div>`).join('');

    // ── Lista de contas ──
    const receiptRows = [...list].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
      const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
      const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
      const d = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const isPaid = r.status === 'paid';
      return `<div class="store-row" style="${isPaid ? 'opacity:0.6' : ''}">
        <span>${d} — ${r.store} <span class="category-badge">${catLabel(r.category || 'outros')}</span></span>
        <div class="store-amounts">
          <span style="color:var(--him)">${fmt(fromCents(rHimC))}</span>
          <span style="color:var(--her)">${fmt(fromCents(rHerC))}</span>
        </div>
      </div>`;
    }).join('');

    // ── Botão exportar ──
    const exportBtn = `<div style="margin-bottom:1rem;display:flex;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="window.exportCSV()">📥 Exportar CSV</button>
    </div>`;

    container.innerHTML = `
      ${settlementHTML}
      ${thirdPartyHTML}
      ${goalHTML}
      ${statsHTML}
      ${donutHTML}
      ${categoryHTML}
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header">🏪 Onde vocês mais gastaram</div>
        <div style="padding:0 1.25rem">${storeRows}</div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header">🧾 ${list.length} contas no mês</div>
        <div style="padding:0 1.25rem">${receiptRows}</div>
      </div>
      ${exportBtn}
    `;
  } catch (error) {
    window.showToast("Erro ao renderizar relatório: " + error.message);
  }
};

// ── BOOT ──
checkAuthAndBoot();