/**
 * ══════════════════════════════════════════════════════════════════
 *  GASTOS CASAL — FRONTEND (Vanilla JS MVC)
 *  Padrões Aplicados:
 *  - Facade (ApiService): Simplifica chamadas à API REST do Backend.
 *  - Observer (AppState): Notifica a UI quando os dados mudam.
 *  - Controller (window.*): Recebe eventos da UI e delega para serviços.
 *  - Strategy (calcTotals): Encapsula diferentes formas de dividir gastos.
 *  - Template Method (renderReport): Define a estrutura do relatório sem
 *    alterar a lógica de cada bloco.
 * ══════════════════════════════════════════════════════════════════
 */

// ── CONFIGURAÇÃO: Altere aqui a URL do seu Backend no Render ──
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

// ══════════════════════════════════════════════════════════════════
//  PADRÃO FACADE — ApiService
//  Encapsula toda a complexidade do fetch(). O resto do código
//  apenas chama métodos simples como api.getReceipts().
// ══════════════════════════════════════════════════════════════════
const api = {
  async request(method, path, body = null) {
    setSyncStatus('syncing');
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(API_BASE_URL + path, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Erro desconhecido');
      }
      setSyncStatus('ok');
      return res.status === 204 ? null : res.json();
    } catch (e) {
      setSyncStatus('err');
      throw e;
    }
  },
  getReceipts:     ()         => api.request('GET',    '/receipts'),
  addReceipt:      (data)     => api.request('POST',   '/receipts', data),
  deleteReceipt:   (id)       => api.request('DELETE', `/receipts/${id}`),
  deleteAll:       ()         => api.request('DELETE', '/receipts/all'),
  toggleStatus:    (id, cur)  => api.request('PATCH',  `/receipts/${id}/status`, { currentStatus: cur }),
  updateReceipt:   (id, data) => api.request('PATCH',  `/receipts/${id}`, data),
  closeCycle:      (data)     => api.request('POST',   '/receipts/close-cycle', data),
  getSettings:     ()         => api.request('GET',    '/settings'),
  saveSettings:    (data)     => api.request('POST',   '/settings', data),
};

// ══════════════════════════════════════════════════════════════════
//  PADRÃO OBSERVER — AppState
//  Mantém o estado da aplicação e notifica listeners ao mudar.
// ══════════════════════════════════════════════════════════════════
const AppState = {
  allReceipts: [],
  appSettings: {
    him: 'Eu', her: 'Ela', password: '15112018', passwordHer: '', geminiKey: '', monthlyGoal: 0,
    goals: {
      categories: {},
      persons: { him: 0, her: 0 }
    }
  },
  loggedAs: sessionStorage.getItem('casal_logged_as') || null,
  currentFile: null,
  currentBase64: null,
  currentMime: 'image/jpeg',
  currentProducts: [],
  nextId: 0,
  isSaving: false,
  editingFireId: null,
  editingItems: [],
  historyTabFilter: 'couple',
  reportTabFilter: 'all',
};

// ── TRATAMENTO GLOBAL DE ERROS ──
window.addEventListener('error', e => console.error('Erro crítico:', e.message));
window.addEventListener('unhandledrejection', e => console.error('Erro:', e.reason?.message || 'Desconhecido'));

// ── HELPERS ──
function cents(v) { return Math.round((parseFloat(v) || 0) * 100); }
function fromCents(c) { return c / 100; }
function fmt(v) { return 'R$ ' + fromCents(cents(v)).toFixed(2).replace('.', ','); }
function today() { return new Date().toISOString().split('T')[0]; }
function getNames() { return { him: AppState.appSettings.him || 'Eu', her: AppState.appSettings.her || 'Ela' }; }

// ── Migra limites antigos de categorias (número → {him, her}) ──
function normalizeCategoryLimits(categories) {
  const out = {};
  for (const key of Object.keys(categories || {})) {
    const v = categories[key];
    if (typeof v === 'number') {
      // legado: divide igualmente os dois
      const half = Math.round(v / 2);
      out[key] = { him: half, her: v - half };
    } else if (v && typeof v === 'object') {
      out[key] = { him: v.him || 0, her: v.her || 0 };
    } else {
      out[key] = { him: 0, her: 0 };
    }
  }
  return out;
}

const CATEGORY_LABELS = {
  mercado: '🛒 Mercado', restaurante: '🍽️ Restaurante', transporte: '🚗 Transporte',
  saude: '💊 Saúde', lazer: '🎉 Lazer', moradia: '🏠 Moradia',
  educacao: '📚 Educação', roupas: '👕 Roupas', outros: '📦 Outros'
};
function catLabel(cat) { return CATEGORY_LABELS[cat] || '📦 Outros'; }

function setSyncStatus(s) {
  try { const d = document.getElementById('sync-dot'); if (d) d.className = 'sync-dot ' + s; } catch(e) {}
}

window.showToast = function(msg, duration = 3000) {
  try {
    const t = document.getElementById('toast');
    if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), duration); }
  } catch(e) { console.error(e); }
};

// ── ABAS E NAVEGAÇÃO ──
window.switchTab = function(tab) {
  try {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('tab-content-' + tab).classList.add('active');
  } catch (error) { console.error(error); }
};

window.showPage = function(id, desktopBtn, navId) {
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    document.querySelectorAll('.desktop-nav-btn').forEach(b => b.classList.remove('active'));
    if (desktopBtn) desktopBtn.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId) document.getElementById(navId)?.classList.add('active');
    if (id === 'history') { window.populateCycleSelects(); window.renderHistory(); }
    if (id === 'report')  { window.populateCycleSelects(); window.renderReport(); }
    if (id === 'personal') { window.renderPersonalDashboard(); }
    if (id === 'goals') { window.renderGoals(); }
  } catch (error) { console.error('Erro na navegação:', error); alert('Erro ao mudar de página: ' + error.message); }
};

window.updatePayerSelect = function() {
  try {
    const names = getNames();
    const html = `<option value="him">${names.him}</option><option value="her">${names.her}</option>`;
    ['meta-payer', 'quick-payer', 'edit-payer', 'cycle-payer', 'settle-payer'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = html;
    });
    const quickSplit = document.getElementById('quick-split');
    if (quickSplit) {
      quickSplit.options[0].text = 'Dividir entre o Casal';
      quickSplit.options[1].text = `Só para ${names.him.split(' ')[0]}`;
      quickSplit.options[2].text = `Só para ${names.her.split(' ')[0]}`;
      quickSplit.options[3].text = 'Emprestado (Terceiro)';
    }
  } catch (error) { console.error(error); }
};

// ── LOGIN ──
window.verificarSenha = function() {
  try {
    const inputEl = document.getElementById('senha-input');
    const erroMsg = document.getElementById('login-erro');
    if (!inputEl || !erroMsg) return;
    const input = inputEl.value;
    if (!input) { erroMsg.style.display = 'block'; erroMsg.textContent = 'Digite a senha!'; return; }
    if (AppState.appSettings.passwordHer && input === AppState.appSettings.passwordHer) {
      erroMsg.style.display = 'none'; AppState.loggedAs = 'her';
      sessionStorage.setItem('casal_logged_as', 'her'); localStorage.setItem('casal_auth', 'ok'); liberarAcesso();
    } else if (input === AppState.appSettings.password) {
      erroMsg.style.display = 'none'; AppState.loggedAs = 'him';
      sessionStorage.setItem('casal_logged_as', 'him'); localStorage.setItem('casal_auth', 'ok'); liberarAcesso();
    } else {
      erroMsg.style.display = 'block'; erroMsg.textContent = 'Senha incorreta! Tente novamente.';
      inputEl.classList.add('shake'); setTimeout(() => inputEl.classList.remove('shake'), 500);
    }
  } catch (error) { console.error(error); }
};

function liberarAcesso() {
  try {
    const loginScreen = document.getElementById('login-screen');
    loginScreen.style.opacity = '0'; loginScreen.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { loginScreen.style.display = 'none'; }, 400);
    document.getElementById('app-content').style.display = 'block';
    initApp();
  } catch (error) { console.error(error); }
}

window.logout = function() {
  localStorage.removeItem('casal_auth'); sessionStorage.removeItem('casal_logged_as');
  AppState.loggedAs = null; location.reload();
};

// ── CARREGAR DADOS DA API ──
async function loadSettings() {
  try {
    const data = await api.getSettings();
    AppState.appSettings = { ...AppState.appSettings, ...data };
    if (!AppState.loggedAs) AppState.loggedAs = sessionStorage.getItem('casal_logged_as') || 'him';
  } catch(e) { console.error('Erro ao carregar configurações:', e); }
}

async function saveSettingsToCloud() {
  try {
    await api.saveSettings(AppState.appSettings);
  } catch(e) { window.showToast('❌ Falha ao salvar configurações.'); }
}

async function loadReceipts() {
  setSyncStatus('syncing');
  try {
    AppState.allReceipts = await api.getReceipts();
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('err'); window.showToast('❌ Erro ao baixar dados.');
  }
  try {
    window.populateCycleSelects(); window.renderHistory();
    if (document.getElementById('page-personal').classList.contains('active')) window.renderPersonalDashboard();
  } catch (error) { console.error(error); }
}

async function addReceiptToCloud(receipt) {
  setSyncStatus('syncing');
  try {
    const saved = await api.addReceipt(receipt);
    AppState.allReceipts.unshift(saved);
    AppState.allReceipts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setSyncStatus('ok');
    return true;
  } catch(e) {
    setSyncStatus('err'); window.showToast('❌ Erro ao salvar: ' + e.message); return false;
  }
}

window.deleteReceipt = async function(fireId) {
  if (!confirm('Tem certeza que deseja apagar?')) return;
  const receiptToDel = AppState.allReceipts.find(r => r._fireId === fireId);
  const isPersonal = receiptToDel && receiptToDel.scope && receiptToDel.scope.startsWith('personal_');
  setSyncStatus('syncing');
  try {
    await api.deleteReceipt(fireId);
    AppState.allReceipts = AppState.allReceipts.filter(r => r._fireId !== fireId);
    setSyncStatus('ok'); window.showToast('🗑️ Removido com sucesso.');
    if (isPersonal) { window.renderPersonalDashboard(); }
    else { window.populateCycleSelects(); window.renderHistory(); window.renderReport(); }
  } catch(e) { setSyncStatus('err'); window.showToast('❌ Falha ao excluir.'); }
};

window.toggleReceiptStatus = async function(fireId) {
  try {
    const receipt = AppState.allReceipts.find(r => r._fireId === fireId);
    if (!receipt) return;
    setSyncStatus('syncing');
    const updated = await api.toggleStatus(fireId, receipt.status);
    receipt.status = updated.status;
    setSyncStatus('ok'); window.renderHistory(); window.renderReport();
    window.showToast(receipt.status === 'paid' ? '✅ Marcado como pago!' : '🔄 Reaberto!');
  } catch(e) { setSyncStatus('err'); console.error(e); }
};

// ── MODAL DE ACERTO ──
window.openSettleModal = function() {
  window.updatePayerSelect();
  document.getElementById('settle-date').value = today();
  document.getElementById('settle-amount').value = '';
  document.getElementById('settle-modal').classList.add('open');
};
window.closeSettleModal = function() { document.getElementById('settle-modal').classList.remove('open'); };

window.saveSettlement = async function() {
  if (AppState.isSaving) return;
  const payer = document.getElementById('settle-payer').value;
  const amountStr = document.getElementById('settle-amount').value;
  const date = document.getElementById('settle-date').value || today();
  if (!amountStr || amountStr <= 0) { window.showToast('⚠️ Digite o valor do pagamento!'); return; }
  AppState.isSaving = true;
  const amountCents = cents(amountStr); const names = getNames();
  const receipt = {
    id: Date.now(), type: 'settlement', store: '💸 Acerto de Contas (Pix)',
    date, payer, cycle: 'current', amountCents, names: { him: names.him, her: names.her }, createdAt: Date.now()
  };
  const ok = await addReceiptToCloud(receipt);
  if (ok) { window.showToast('✅ Acerto registrado!'); window.closeSettleModal(); window.populateCycleSelects(); window.renderHistory(); window.renderReport(); }
  AppState.isSaving = false;
};

// ── PAINEL PESSOAL ──
window.renderPersonalDashboard = function() {
  try {
    const owner = document.getElementById('personal-owner').value;
    const scopeName = `personal_${owner}`;
    let list = AppState.allReceipts.filter(r => r.scope === scopeName);
    list.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    let incomeCents = 0, expenseCents = 0;
    list.forEach(r => {
      if (r.type === 'income') incomeCents += r.amountCents;
      else if (r.type === 'expense') expenseCents += r.amountCents;
    });
    const balanceCents = incomeCents - expenseCents;
    const balanceColor = balanceCents >= 0 ? 'var(--both)' : 'var(--her)';
    const historyHTML = list.length === 0
      ? `<div class="empty"><p>Nenhum lançamento no seu painel pessoal.</p></div>`
      : list.map(r => {
          const dStr = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          const isInc = r.type === 'income'; const color = isInc ? 'var(--both)' : 'var(--her)'; const sign = isInc ? '+' : '-';
          return `<div class="store-row" style="border-bottom: 1px solid var(--border); padding: 0.75rem 0;">
            <div style="flex:1;"><div style="font-weight:700; font-size:0.85rem;">${r.store}</div><div style="font-size:0.7rem; color:var(--muted2);">${dStr}</div></div>
            <div style="text-align:right;"><div style="color:${color}; font-weight:800;">${sign} ${fmt(fromCents(r.amountCents))}</div>
            <button class="btn-ghost" style="border:none; padding:0.2rem; font-size:0.7rem; color:var(--muted);" onclick="window.deleteReceipt('${r._fireId}')">Apagar</button></div>
          </div>`;
        }).join('');
    
    // ── Extração de Dívidas de Terceiros para este usuário ──
    let thirdPartyHTML = '';
    let hasDebts = false;
    let debtsRows = '';
    AppState.allReceipts.filter(r => !r.scope && r.status !== 'paid' && r.payer === owner).forEach(r => {
      if (r.items) {
        r.items.forEach((item, idx) => {
          if (item.split === 'other' && !item.paid) {
            hasDebts = true;
            const amt = item.priceCents || cents(item.price);
            const n = item.otherName || 'Alguém';
            const dStr = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            debtsRows += `<div class="store-row" style="border-bottom: 1px solid var(--border); padding: 0.75rem 0;">
              <div style="flex:1;">
                <div style="font-weight:700; font-size:0.85rem;">${n} <span style="font-weight:400; color:var(--muted2); font-size:0.75rem;">(de ${r.store})</span></div>
                <div style="font-size:0.7rem; color:var(--muted2);">${dStr}</div>
              </div>
              <div style="text-align:right;">
                <div style="color:var(--other); font-weight:800;">+ ${fmt(fromCents(amt))}</div>
                <button class="btn-ghost" style="border:none; padding:0.2rem; font-size:0.7rem; color:var(--primary);" onclick="window.markItemPaid('${r._fireId}', ${idx})">Dar Baixa</button>
              </div>
            </div>`;
          }
        });
      }
    });
    if (hasDebts) {
      thirdPartyHTML = `<div class="card" style="margin-top:1.5rem; border-color:var(--other);"><div class="card-header" style="color:var(--other);">👥 A Receber de Terceiros</div><div style="padding:0 1.25rem 0.5rem 1.25rem;">${debtsRows}</div></div>`;
    }

    const html = `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">➕ Novo Lançamento Pessoal</div>
        <div style="padding:1.25rem">
          <div class="meta-grid">
            <div><label class="field-label">Tipo</label><select class="field-input" id="pers-type"><option value="expense">📉 Saída / Despesa</option><option value="income">📈 Entrada / Dinheiro</option></select></div>
            <div><label class="field-label">Valor (R$)</label><input class="field-input" type="number" step="0.01" min="0" id="pers-price" placeholder="0,00"></div>
            <div style="grid-column: span 2;"><label class="field-label">Descrição</label><input class="field-input" id="pers-desc" placeholder="Ex: Salário, Fatura Nubank, Ifood Sozinho..."></div>
          </div>
          <button class="btn btn-primary" style="width:100%; margin-top:0.75rem;" onclick="window.savePersonalTransaction()">💾 Salvar no Pessoal</button>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Minhas Entradas</div><div class="stat-value" style="color:var(--both)">${fmt(fromCents(incomeCents))}</div></div>
        <div class="stat-card"><div class="stat-label">Minhas Saídas</div><div class="stat-value" style="color:var(--her)">${fmt(fromCents(expenseCents))}</div></div>
        <div class="stat-card" style="grid-column: span 2;"><div class="stat-label">Saldo em Conta / Sobra</div><div class="stat-value" style="color:${balanceColor}">${fmt(fromCents(balanceCents))}</div></div>
      </div>
      <div class="card" style="margin-top:1.5rem;"><div class="card-header">📋 Meu Histórico</div><div style="padding:0 1.25rem 0.5rem 1.25rem;">${historyHTML}</div></div>
      ${thirdPartyHTML}`;
    document.getElementById('personal-dashboard-content').innerHTML = html;
  } catch (error) { console.error(error); }
};

window.markItemPaid = async function(fireId, itemIdx) {
  const r = AppState.allReceipts.find(x => x._fireId === fireId);
  if (!r || !r.items || !r.items[itemIdx]) return;
  if (!confirm(`Marcar o valor de ${r.items[itemIdx].otherName || 'Alguém'} como pago?`)) return;
  setSyncStatus('syncing');
  r.items[itemIdx].paid = true;
  try {
    await api.updateReceipt(fireId, { items: r.items });
    setSyncStatus('ok');
    window.showToast('✅ Dívida de terceiro baixada!');
    window.renderPersonalDashboard();
    if (document.getElementById('page-report').classList.contains('active')) window.renderReport();
  } catch (e) {
    setSyncStatus('err'); console.error(e);
    r.items[itemIdx].paid = false;
  }
};

window.savePersonalTransaction = async function() {
  if (AppState.isSaving) return;
  const owner = document.getElementById('personal-owner').value;
  const type = document.getElementById('pers-type').value;
  const price = document.getElementById('pers-price').value;
  const desc = document.getElementById('pers-desc').value.trim();
  if (!desc || !price || price <= 0) { window.showToast('⚠️ Preencha o valor e a descrição!'); return; }
  AppState.isSaving = true;
  const amountCents = cents(price); const names = getNames();
  const receipt = {
    id: Date.now(), scope: `personal_${owner}`, type, store: desc, date: today(),
    amountCents, names: { him: names.him, her: names.her }, createdAt: Date.now()
  };
  const ok = await addReceiptToCloud(receipt);
  if (ok) { window.showToast('✅ Lançamento salvo!'); window.renderPersonalDashboard(); }
  AppState.isSaving = false;
};

// ── FECHAMENTO DE FATURA ──
window.openCloseCycleModal = function() {
  window.updatePayerSelect();
  document.getElementById('cycle-date').value = today();
  document.getElementById('cycle-name').value = '';
  document.getElementById('cycle-amount').value = '';
  document.getElementById('close-cycle-modal').classList.add('open');
};
window.closeCycleModal = function() { document.getElementById('close-cycle-modal').classList.remove('open'); };

window.saveCloseCycle = async function() {
  if (AppState.isSaving) return;
  const cycleName = document.getElementById('cycle-name').value.trim() || 'Fatura ' + today();
  const payer = document.getElementById('cycle-payer').value;
  const amountStr = document.getElementById('cycle-amount').value;
  const date = document.getElementById('cycle-date').value || today();
  const amountPaid = amountStr ? cents(amountStr) : 0;
  const activeLocal = AppState.allReceipts.filter(r => !r.scope && (!r.cycle || r.cycle === 'current'));
  if (activeLocal.length === 0) { window.showToast('⚠️ Nenhuma conta aberta!'); return; }
  AppState.isSaving = true; setSyncStatus('syncing');
  try {
    const names = getNames();
    await api.closeCycle({ cycleName, payer, amountPaid, date, names });
    window.showToast('✅ Fatura Fechada com Sucesso!');
    window.closeCycleModal();
    await loadReceipts(); // Recarrega tudo do backend para refletir as mudanças
    document.getElementById('filter-cycle').value = 'current';
    document.getElementById('report-cycle').value = 'current';
    window.populateCycleSelects(); window.renderHistory(); window.renderReport();
  } catch (e) {
    setSyncStatus('err'); window.showToast('❌ Erro no fechamento: ' + e.message); console.error(e);
  } finally { AppState.isSaving = false; }
};

// ── MODAL DE EDIÇÃO ──
window.openEditModal = function(fireId) {
  try {
    const receipt = AppState.allReceipts.find(r => r._fireId === fireId);
    if (!receipt) return;
    AppState.editingFireId = fireId;
    AppState.editingItems = (receipt.items || []).map(i => ({ ...i }));
    document.getElementById('edit-store').value = receipt.store || '';
    document.getElementById('edit-date').value = receipt.date || today();
    document.getElementById('edit-method').value = receipt.method || '';
    document.getElementById('edit-category').value = receipt.category || 'outros';
    window.updatePayerSelect();
    document.getElementById('edit-payer').value = receipt.payer || 'him';
    renderEditItems();
    document.getElementById('edit-modal').classList.add('open');
  } catch(e) { console.error(e); }
};

window.closeEditModal = function() {
  document.getElementById('edit-modal').classList.remove('open');
  AppState.editingFireId = null; AppState.editingItems = [];
};

window.updateEditItem = function(idx, field, value) {
  if (!AppState.editingItems[idx]) return;
  if (field === 'priceCents') AppState.editingItems[idx].priceCents = Math.round(parseFloat(value || 0) * 100);
  else AppState.editingItems[idx][field] = value;
  if (field === 'split') { if (value !== 'other') AppState.editingItems[idx].otherName = ''; renderEditItems(); }
};

window.removeEditItem = function(idx) { AppState.editingItems.splice(idx, 1); renderEditItems(); };

function renderEditItems() {
  const names = getNames();
  const container = document.getElementById('edit-items-list'); if (!container) return;
  container.innerHTML = '<div class="field-label" style="margin-bottom:0.5rem">Itens do cupom</div>' +
    AppState.editingItems.map((item, idx) => {
      const splitOpts = [{ v: 'both', l: '÷2' }, { v: 'him', l: names.him.split(' ')[0] }, { v: 'her', l: names.her.split(' ')[0] }, { v: 'other', l: '👤' }]
        .map(o => `<option value="${o.v}" ${item.split === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
      const otherInput = item.split === 'other' ? `<input class="other-input" style="margin-top:0.4rem" placeholder="Quem pegou..." value="${item.otherName || ''}" oninput="window.updateEditItem(${idx}, 'otherName', this.value)">` : '';
      return `<div style="margin-bottom:0.75rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
        <div class="edit-item-row" style="border-bottom:none; padding:0;">
          <input class="edit-item-name" value="${item.name}" oninput="window.updateEditItem(${idx}, 'name', this.value)" placeholder="Nome">
          <input class="edit-item-price" type="number" step="0.01" value="${fromCents(item.priceCents || 0).toFixed(2)}" oninput="window.updateEditItem(${idx}, 'priceCents', this.value)">
          <select class="field-input" style="width:70px;padding:0.4rem 0.3rem;font-size:0.75rem" onchange="window.updateEditItem(${idx}, 'split', this.value)">${splitOpts}</select>
          <button class="del-item-btn" onclick="window.removeEditItem(${idx})">✕</button>
        </div>${otherInput}</div>`;
    }).join('');
}

window.saveEditModal = async function() {
  try {
    if (AppState.isSaving) return;
    const receipt = AppState.allReceipts.find(r => r._fireId === AppState.editingFireId);
    if (!receipt) return;
    AppState.isSaving = true;
    const { himC, herC, otherC } = calcTotals(AppState.editingItems);
    const names = getNames();
    const updates = {
      store: document.getElementById('edit-store').value.trim() || receipt.store,
      date: document.getElementById('edit-date').value || receipt.date,
      method: document.getElementById('edit-method').value.trim(),
      category: document.getElementById('edit-category').value || 'outros',
      payer: document.getElementById('edit-payer').value,
      items: AppState.editingItems,
      himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
      names: { him: names.him, her: names.her }
    };
    setSyncStatus('syncing');
    await api.updateReceipt(AppState.editingFireId, updates);
    Object.assign(receipt, updates);
    setSyncStatus('ok');
    window.closeEditModal(); window.renderHistory(); window.renderReport();
    window.showToast('✅ Lançamento atualizado!');
  } catch(e) { window.showToast('❌ Erro: ' + e.message); console.error(e); } finally { AppState.isSaving = false; }
};

// ── BOOT E INIT ──
async function checkAuthAndBoot() {
  try {
    await loadSettings();
    const senhaInput = document.getElementById('senha-input');
    if (senhaInput) senhaInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.verificarSenha(); });
    if (localStorage.getItem('casal_auth') === 'ok') liberarAcesso();
  } catch (error) { console.error('Erro no boot:', error); }
}

async function initApp() {
  try {
    document.getElementById('api-key-input').value = AppState.appSettings.geminiKey || '';
    document.getElementById('api-key-settings').value = AppState.appSettings.geminiKey || '';
    document.getElementById('name-him').value = AppState.appSettings.him;
    document.getElementById('name-her').value = AppState.appSettings.her;
    document.getElementById('meta-date').value = today();
    document.getElementById('quick-date').value = today();
    const goalEl = document.getElementById('monthly-goal');
    if (goalEl) goalEl.value = AppState.appSettings.monthlyGoal > 0 ? fromCents(AppState.appSettings.monthlyGoal).toFixed(2) : '';
    window.updatePayerSelect();
    const names = getNames();
    const profileBadge = document.getElementById('profile-badge');
    if (profileBadge && AppState.loggedAs) {
      const pName = AppState.loggedAs === 'him' ? names.him : names.her;
      const pColor = AppState.loggedAs === 'him' ? 'var(--him)' : 'var(--her)';
      profileBadge.style.display = 'flex'; profileBadge.style.borderColor = pColor;
      profileBadge.innerHTML = `<span style="color:${pColor};font-weight:700;font-size:0.78rem">👤 ${pName.split(' ')[0]}</span>`;
    }
    const ownerSel = document.getElementById('personal-owner');
    const ownerLabel = document.getElementById('personal-owner-label');
    const ownerCard = document.getElementById('personal-owner-card');
    if (ownerSel && AppState.loggedAs) {
      ownerSel.value = AppState.loggedAs;
      if (AppState.loggedAs === 'her') {
        ownerSel.style.display = 'none';
        if (ownerLabel) ownerLabel.textContent = `Painel de ${names.her.split(' ')[0]}`;
        if (ownerCard) ownerCard.style.borderColor = 'var(--her)';
      } else {
        ownerSel.style.display = '';
        if (ownerLabel) ownerLabel.textContent = 'De quem é este painel?';
        if (ownerCard) ownerCard.style.borderColor = 'var(--him)';
      }
    }
    const quickPayer = document.getElementById('quick-payer');
    if (quickPayer && AppState.loggedAs) quickPayer.value = AppState.loggedAs;
    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) window.loadFile(e.dataTransfer.files[0]); });
    }
    await loadReceipts();
  } catch (error) { console.error('Erro ao inicializar', error); }
}

// ── LANÇAMENTO RÁPIDO ──
window.saveQuickExpense = async function() {
  try {
    if (AppState.isSaving) return;
    const desc = document.getElementById('quick-desc').value.trim();
    const price = document.getElementById('quick-price').value;
    const payer = document.getElementById('quick-payer').value;
    const split = document.getElementById('quick-split').value;
    const otherName = document.getElementById('quick-other-name').value.trim();
    const category = document.getElementById('quick-category').value || 'outros';
    const dateVal = document.getElementById('quick-date').value || today();
    const method = document.getElementById('quick-method')?.value.trim() || 'Avulso';
    if (!desc || !price || price <= 0) { window.showToast('⚠️ Preencha os campos!'); return; }
    if (split === 'other' && !otherName) { window.showToast('⚠️ Digite o devedor!'); return; }
    AppState.isSaving = true;
    const itemCents = cents(price);
    let himC = 0, herC = 0, otherC = 0;
    if (split === 'him') himC = itemCents;
    else if (split === 'her') herC = itemCents;
    else if (split === 'other') otherC = itemCents;
    else { himC = Math.floor(itemCents / 2); herC = itemCents - Math.floor(itemCents / 2); }
    const item = { id: Date.now(), name: desc, priceCents: itemCents, split, otherName: split === 'other' ? otherName : '' };
    const names = getNames();
    const receipt = {
      id: Date.now(), store: desc, date: dateVal, payer, method, category, status: 'open', cycle: 'current',
      items: [item], himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
      imageBase64: null, imageMime: null, names: { him: names.him, her: names.her }, createdAt: Date.now()
    };
    const ok = await addReceiptToCloud(receipt);
    if (ok) {
      window.showToast('✅ Salvo!');
      document.getElementById('quick-desc').value = ''; document.getElementById('quick-price').value = '';
      document.getElementById('quick-date').value = today();
      if (document.getElementById('quick-method')) document.getElementById('quick-method').value = '';
      document.getElementById('quick-other-name').value = '';
      document.getElementById('quick-other-div').style.display = 'none';
      document.getElementById('quick-split').value = 'both'; document.getElementById('quick-category').value = 'outros';
      window.populateCycleSelects(); window.renderHistory();
    }
  } catch (error) { console.error(error); } finally { AppState.isSaving = false; }
};

// ── CONFIGURAÇÕES ──
window.saveApiKey = function() { AppState.appSettings.geminiKey = document.getElementById('api-key-input').value.trim(); document.getElementById('api-key-settings').value = AppState.appSettings.geminiKey; saveSettingsToCloud(); };
window.saveApiKeySettings = function() { AppState.appSettings.geminiKey = document.getElementById('api-key-settings').value.trim(); document.getElementById('api-key-input').value = AppState.appSettings.geminiKey; saveSettingsToCloud(); };
window.saveNames = function() { AppState.appSettings.him = document.getElementById('name-him').value || 'Eu'; AppState.appSettings.her = document.getElementById('name-her').value || 'Ela'; window.updatePayerSelect(); saveSettingsToCloud(); };
window.saveGoal = function() { AppState.appSettings.monthlyGoal = cents(document.getElementById('monthly-goal').value); saveSettingsToCloud(); };
window.changePassword = function() { const np = document.getElementById('new-password').value.trim(); if (!np) return; AppState.appSettings.password = np; saveSettingsToCloud(); document.getElementById('new-password').value = ''; window.showToast('✅ Sua senha foi alterada!'); };
window.changePasswordHer = function() {
  const np = document.getElementById('new-password-her')?.value.trim();
  if (!np) { window.showToast('⚠️ Digite a nova senha dela!'); return; }
  AppState.appSettings.passwordHer = np; saveSettingsToCloud();
  document.getElementById('new-password-her').value = '';
  window.showToast('✅ Senha dela alterada! Agora ela pode fazer login.');
};

window.clearAllData = async function() {
  if (!confirm('Apagar TODOS os dados (incluindo painel pessoal e faturas antigas)?')) return;
  setSyncStatus('syncing');
  try {
    await api.deleteAll();
    AppState.allReceipts = []; setSyncStatus('ok');
    window.populateCycleSelects(); window.renderHistory(); window.renderReport();
    if (document.getElementById('page-personal').classList.contains('active')) window.renderPersonalDashboard();
    window.showToast('🗑️ Limpeza concluída.');
  } catch(e) { setSyncStatus('err'); console.error(e); }
};

// ── LER CUPOM COM GEMINI (chama a API do Google diretamente — permanece no Front) ──
window.handleFile = function(e) { if (e.target.files[0]) window.loadFile(e.target.files[0]); };
window.loadFile = function(file) {
  try {
    AppState.currentFile = file; AppState.currentMime = 'image/jpeg';
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200; let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        AppState.currentBase64 = dataUrl.split(',')[1];
        document.getElementById('preview-img').src = dataUrl;
        document.getElementById('preview-section').style.display = 'block';
        document.getElementById('upload-zone').style.display = 'none';
        document.getElementById('products-section').style.display = 'none';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } catch (error) { console.error(error); }
};
window.resetUpload = function() {
  AppState.currentFile = null; AppState.currentBase64 = null; AppState.currentProducts = []; AppState.nextId = 0;
  document.getElementById('preview-section').style.display = 'none'; document.getElementById('products-section').style.display = 'none';
  document.getElementById('upload-zone').style.display = 'block'; document.getElementById('upload-zone').querySelector('input').value = '';
};
window.resetAll = function() { window.resetUpload(); window.showToast('Descartado.'); };

window.extractWithGemini = async function() {
  try {
    const apiKey = AppState.appSettings.geminiKey || '';
    if (!apiKey || !AppState.currentBase64) { window.showToast('⚠️ Chave ou Imagem faltando!'); return; }
    document.getElementById('extract-btn').disabled = true; document.getElementById('loading-box').style.display = 'flex';
    const body = { contents: [{ parts: [{ inline_data: { mime_type: AppState.currentMime, data: AppState.currentBase64 } }, { text: `Analise este cupom fiscal brasileiro. Retorne APENAS JSON válido, sem markdown, sem texto extra:\n{"store":"nome do estabelecimento","date":"YYYY-MM-DD","items":[{"name":"nome do produto","price":0.00}]}\nUse preço total do item (qtd x unitário). Omita itens ilegíveis. NUNCA coloque texto fora do JSON.` }] }], generationConfig: { temperature: 0 } };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.split('```json').join('').split('```').join('').trim();
    const parsed = JSON.parse(text);
    AppState.currentProducts = parsed.items.map(item => ({ id: AppState.nextId++, name: item.name, priceCents: cents(item.price), split: 'both', otherName: '' }));
    if (parsed.store) document.getElementById('meta-store').value = parsed.store;
    if (parsed.date) document.getElementById('meta-date').value = parsed.date;
    window.renderProducts(); document.getElementById('products-section').style.display = 'block'; window.showToast('✅ Extraído!');
  } catch(err) { window.showToast('❌ Falha na IA.'); console.error(err); }
  finally {
    const b = document.getElementById('extract-btn'); if(b) b.disabled = false;
    const bx = document.getElementById('loading-box'); if(bx) bx.style.display = 'none';
  }
};

window.addManual = function() {
  const nameEl = document.getElementById('new-name'); const priceEl = document.getElementById('new-price');
  const name = nameEl.value.trim(); if (!name) return;
  AppState.currentProducts.push({ id: AppState.nextId++, name, priceCents: cents(priceEl.value), split: 'both', otherName: '' });
  nameEl.value = ''; priceEl.value = ''; document.getElementById('products-section').style.display = 'block';
  window.renderProducts(); nameEl.focus();
};

window.renderProducts = function() {
  const names = getNames(); const list = document.getElementById('products-list'); list.innerHTML = '';
  AppState.currentProducts.forEach(item => {
    const div = document.createElement('div'); div.className = 'product-item';
    const otherInput = item.split === 'other' ? `<input class="other-input" placeholder="Pessoa..." value="${item.otherName || ''}" oninput="window.setOtherName(${item.id}, this.value)">` : '';
    div.innerHTML = `<div class="product-top">
      <div style="display:flex;align-items:flex-start;gap:0.5rem;flex:1"><button class="del-item-btn" onclick="window.removeItem(${item.id})">✕</button><span class="product-name-text">${item.name}</span></div>
      <span class="product-price-tag">${fmt(fromCents(item.priceCents))}</span></div>
      <div class="product-controls"><div class="split-group">
        <button class="split-btn ${item.split==='him'?'s-him':''}" onclick="window.setSplit(${item.id},'him')">${names.him.split(' ')[0]}</button>
        <button class="split-btn ${item.split==='her'?'s-her':''}" onclick="window.setSplit(${item.id},'her')">${names.her.split(' ')[0]}</button>
        <button class="split-btn ${item.split==='both'?'s-both':''}" onclick="window.setSplit(${item.id},'both')">÷2</button>
        <button class="split-btn ${item.split==='other'?'s-other':''}" onclick="window.setSplit(${item.id},'other')">👤 Emp.</button>
      </div></div>${otherInput}`;
    list.appendChild(div);
  });
  window.renderSummary();
};
window.removeItem = function(id) { AppState.currentProducts = AppState.currentProducts.filter(p => p.id !== id); window.renderProducts(); };
window.setSplit = function(id, type) { const item = AppState.currentProducts.find(p => p.id === id); if (item) { item.split = type; if (type !== 'other') item.otherName = ''; } window.renderProducts(); };
window.setOtherName = function(id, name) { const item = AppState.currentProducts.find(p => p.id === id); if (item) item.otherName = name; window.renderSummary(); };

// ── PADRÃO STRATEGY: calcTotals ──
// Encapsula o algoritmo de divisão de gastos. Para mudar a lógica de divisão,
// apenas esta função precisa ser alterada.
function calcTotals(products) {
  let himC = 0, herC = 0, otherC = 0;
  products.forEach(p => {
    const c = p.priceCents !== undefined ? p.priceCents : cents(p.price || 0);
    if (p.split === 'him') himC += c; else if (p.split === 'her') herC += c; else if (p.split === 'other') otherC += c;
    else { himC += Math.floor(c / 2); herC += c - Math.floor(c / 2); }
  });
  return { himC, herC, otherC };
}

window.renderSummary = function() {
  const names = getNames(); const { himC, herC, otherC } = calcTotals(AppState.currentProducts); const coupleC = himC + herC;
  const pills = [{ label: names.him, value: fmt(fromCents(himC)), color: 'var(--him)' }, { label: names.her, value: fmt(fromCents(herC)), color: 'var(--her)' }, { label: 'Casal', value: fmt(fromCents(coupleC)), color: 'var(--both)' }, otherC > 0 ? { label: 'Terceiros', value: fmt(fromCents(otherC)), color: 'var(--other)' } : null].filter(Boolean);
  document.getElementById('summary-row').innerHTML = pills.map(p => `<div class="summary-pill"><div class="pill-label">${p.label}</div><div class="pill-value" style="color:${p.color}">${p.value}</div></div>`).join('');
};

window.saveReceipt = async function() {
  if (AppState.isSaving) return;
  if (AppState.currentProducts.length === 0) { window.showToast('⚠️ Nenhum produto!'); return; }
  AppState.isSaving = true;
  const names = getNames(); const { himC, herC, otherC } = calcTotals(AppState.currentProducts);
  const receipt = {
    id: Date.now(), store: document.getElementById('meta-store').value.trim() || 'Sem nome',
    date: document.getElementById('meta-date').value || today(),
    payer: document.getElementById('meta-payer').value || 'him',
    method: document.getElementById('meta-method').value.trim(),
    category: document.getElementById('meta-category').value || 'outros', status: 'open', cycle: 'current',
    items: AppState.currentProducts.map(p => ({ ...p })),
    himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
    imageBase64: AppState.currentBase64, imageMime: AppState.currentMime,
    names: { him: names.him, her: names.her }, createdAt: Date.now()
  };
  const ok = await addReceiptToCloud(receipt);
  if (ok) { window.resetUpload(); window.populateCycleSelects(); window.renderHistory(); window.showToast('✅ Cupom salvo!'); }
  AppState.isSaving = false;
};

// ── RENDERIZAÇÃO ──
function buildDonutSVG(segments) {
  const total = segments.reduce((s, seg) => s + seg.value, 0); if (total === 0) return '';
  const r = 52, cx = 60, cy = 60, stroke = 16; const circ = 2 * Math.PI * r; let offset = 0, paths = '';
  segments.forEach(seg => {
    const dash = (seg.value / total) * circ; const gap = circ - dash;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset * circ / total).toFixed(2)}" style="transform:rotate(-90deg);transform-origin:${cx}px ${cy}px;transition:stroke-dasharray 0.6s ease"/>`;
    offset += seg.value;
  });
  return `<svg class="donut-svg" viewBox="0 0 120 120" width="120" height="120"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>${paths}</svg>`;
}

window.populateCycleSelects = function() {
  try {
    const list = AppState.allReceipts.filter(r => !r.scope && r.cycle && r.cycle !== 'current');
    const cycles = [...new Set(list.map(r => r.cycle))];
    ['filter-cycle', 'report-cycle'].forEach(sid => {
      const sel = document.getElementById(sid); if (!sel) return;
      const first = sel.options[0].cloneNode(true); sel.innerHTML = ''; sel.appendChild(first);
      cycles.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = "📁 " + c; sel.appendChild(opt); });
    });
  } catch(e) { console.error(e); }
};

window.renderHistoryTabPills = function() {
  const names = getNames();
  const tab = AppState.historyTabFilter;
  const tabs = [
    { key: 'couple', icon: '\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC68', label: 'Casal',           activeClass: 'active-couple' },
    { key: 'him',    icon: '\uD83D\uDD35',                                       label: names.him,         activeClass: 'active-him'    },
    { key: 'her',    icon: '\uD83D\uDD34',                                       label: names.her,         activeClass: 'active-her'    },
    { key: 'all',    icon: '\uD83C\uDF10',                                       label: 'Todos',           activeClass: 'active-all'    },
  ];
  const container = document.getElementById('history-tab-group');
  if (!container) return;
  container.innerHTML = tabs.map(t => {
    const isActive = tab === t.key;
    return `<button class="tab-pill${isActive ? ' ' + t.activeClass : ''}" onclick="window.setHistoryTab('${t.key}')">${t.icon} ${t.label}</button>`;
  }).join('');
};

window.setHistoryTab = function(tab) {
  AppState.historyTabFilter = tab;
  window.renderHistory();
};

window.renderHistory = function() {
  try {
    window.renderHistoryTabPills();
    const cycle = document.getElementById('filter-cycle')?.value || 'current';
    const category = document.getElementById('filter-category')?.value || '';
    const searchRaw = document.getElementById('history-search')?.value.trim().toLowerCase() || '';
    const tab = AppState.historyTabFilter;
    let list = AppState.allReceipts.filter(r => !r.scope && r.type !== 'settlement');
    if (cycle === 'current') list = list.filter(r => !r.cycle || r.cycle === 'current');
    else list = list.filter(r => r.cycle === cycle);
    // ── Filtragem por aba ──
    if (tab === 'him')    list = list.filter(r => (r.himCents || 0) > 0 && (r.herCents || 0) === 0 && (r.otherCents || 0) === 0);
    else if (tab === 'her')    list = list.filter(r => (r.herCents || 0) > 0 && (r.himCents || 0) === 0 && (r.otherCents || 0) === 0);
    else if (tab === 'couple') list = list.filter(r => (r.himCents || 0) > 0 && (r.herCents || 0) > 0);
    // tab === 'all': sem filtro extra
    if (category) list = list.filter(r => r.type !== 'settlement' && (r.category || 'outros') === category);
    if (searchRaw) list = list.filter(r => { const storeMatch = (r.store || '').toLowerCase().includes(searchRaw); const itemMatch = r.items && r.items.some(i => (i.name || '').toLowerCase().includes(searchRaw)); return storeMatch || itemMatch; });
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const container = document.getElementById('history-list');
    if (!list.length) { container.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><p>Nenhum lançamento nesta fatura.</p></div>`; return; }
    container.innerHTML = list.map((r, idx) => {
      const names = r.names || getNames();
      const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const fid = r._fireId;
      const himC = r.himCents || 0; const herC = r.herCents || 0; const otherC = r.otherCents || 0;
      const isPaid = r.status === 'paid';
      const payerName = r.payer === 'him' ? names.him : (r.payer === 'her' ? names.her : '');
      const methodStr = r.method ? ` (${r.method})` : '';
      const cat = catLabel(r.category || 'outros');
      const statusBadge = isPaid ? `<span class="item-badge badge-both">✅ PAGO</span>` : `<span class="item-badge badge-other">⏳ ABERTO</span>`;
      const itemRows = (r.items || []).map(item => {
        const iC = item.priceCents || 0;
        const badgeLabel = item.split === 'him' ? names.him.split(' ')[0] : item.split === 'her' ? names.her.split(' ')[0] : item.split === 'other' ? (item.otherName || '?') : '÷2';
        return `<div class="receipt-item-row"><span style="flex:1">${item.name}</span><span class="item-badge">${badgeLabel}</span><span style="font-weight:700;color:var(--both)">${fmt(fromCents(iC))}</span></div>`;
      }).join('');
      const imgSrc = r.imageBase64 ? `data:${r.imageMime || 'image/jpeg'};base64,${r.imageBase64}` : '';
      return `<div class="receipt-card" style="${isPaid ? 'opacity:0.72;' : ''}animation-delay:${idx * 0.04}s">
        <div class="receipt-head" onclick="window.toggleCard('${fid}')">
          <div style="min-width:0">
            <div class="receipt-store">${r.store} ${statusBadge}</div>
            <div class="receipt-date">${dateStr} • Por ${payerName}${methodStr}</div>
            <div style="margin-top:0.25rem"><span class="category-badge">${cat}</span></div>
          </div>
          <div class="receipt-amounts">
            <div class="receipt-amount-item"><div class="amount-dot" style="background:var(--him)"></div><span>${fmt(fromCents(himC))}</span></div>
            <div class="receipt-amount-item"><div class="amount-dot" style="background:var(--her)"></div><span>${fmt(fromCents(herC))}</span></div>
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
  } catch (error) { console.error(error); }
};

window.toggleCard = function(id) {
  try { document.getElementById('card-body-' + id)?.classList.toggle('open'); } catch(e) { console.error(e); }
};

window.renderReportTabPills = function() {
  const names = getNames();
  const tab = AppState.reportTabFilter;
  const tabs = [
    { key: 'all',    icon: '\uD83C\uDF10', label: 'Todos',     activeClass: 'active-all'    },
    { key: 'couple', icon: '\uD83D\uDC69\u200D\u2764\uFE0F\u200D\uD83D\uDC68', label: 'Casal', activeClass: 'active-couple' },
    { key: 'him',    icon: '\uD83D\uDD35', label: names.him,   activeClass: 'active-him'    },
    { key: 'her',    icon: '\uD83D\uDD34', label: names.her,   activeClass: 'active-her'    },
  ];
  const container = document.getElementById('report-tab-group');
  if (!container) return;
  container.innerHTML = tabs.map(t => {
    const isActive = tab === t.key;
    return `<button class="tab-pill${isActive ? ' ' + t.activeClass : ''}" onclick="window.setReportTab('${t.key}')">${t.icon} ${t.label}</button>`;
  }).join('');
};

window.setReportTab = function(tab) {
  AppState.reportTabFilter = tab;
  window.renderReport();
};

window.renderReport = function() {
  try {
    window.renderReportTabPills();
    const cycle = document.getElementById('report-cycle')?.value || 'current';
    const reportTab = AppState.reportTabFilter;
    let fullList = AppState.allReceipts.filter(r => !r.scope);
    if (cycle === 'current') fullList = fullList.filter(r => !r.cycle || r.cycle === 'current');
    else fullList = fullList.filter(r => r.cycle === cycle);

    // ── Lista Completa: usada para o Acerto de Contas (Falta Pagar) e Dívidas de Terceiros ──
    let runningBalanceCents = 0;
    let globalHimC = 0; let globalHerC = 0;
    fullList.forEach(r => {
      if (r.type === 'settlement') {
        if (r.payer === 'him') runningBalanceCents += r.amountCents;
        else if (r.payer === 'her') runningBalanceCents -= r.amountCents;
      } else if (r.status !== 'paid' && r.type !== 'rollover') {
        const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
        const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
        if (r.payer === 'him') runningBalanceCents += rHerC;
        else if (r.payer === 'her') runningBalanceCents -= rHimC;
        globalHimC += rHimC; globalHerC += rHerC;
      } else if (r.status === 'paid' && r.type !== 'rollover') {
        const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
        const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
        globalHimC += rHimC; globalHerC += rHerC;
      }
    });
    const globalCoupleC = globalHimC + globalHerC;

    let thirdPartyDebts = { him: {}, her: {} };
    fullList.filter(r => r.status !== 'paid').forEach(r => {
      if (r.payer === 'him') { if (r.items) r.items.filter(i => i.split === 'other' && !i.paid).forEach(i => { const n = i.otherName || 'Alguém'; thirdPartyDebts.him[n] = (thirdPartyDebts.him[n] || 0) + (i.priceCents || cents(i.price)); }); }
      else if (r.payer === 'her') { if (r.items) r.items.filter(i => i.split === 'other' && !i.paid).forEach(i => { const n = i.otherName || 'Alguém'; thirdPartyDebts.her[n] = (thirdPartyDebts.her[n] || 0) + (i.priceCents || cents(i.price)); }); }
    });

    // ── Filtragem por aba do relatório (apenas para estatísticas, gráficos e listas) ──
    let list = [...fullList];
    if (reportTab === 'him')    list = list.filter(r => r.type === 'settlement' || ((r.himCents || 0) > 0 && (r.herCents || 0) === 0 && (r.otherCents || 0) === 0));
    else if (reportTab === 'her')    list = list.filter(r => r.type === 'settlement' || ((r.herCents || 0) > 0 && (r.himCents || 0) === 0 && (r.otherCents || 0) === 0));
    else if (reportTab === 'couple') list = list.filter(r => r.type === 'settlement' || ((r.himCents || 0) > 0 && (r.herCents || 0) > 0));

    const container = document.getElementById('report-content');
    const names = getNames();

    let himC = 0, herC = 0, otherC = 0; const storeMap = {}; const categoryMap = {};
    list.forEach(r => {
      if (r.type !== 'settlement') {
        const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
        const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
        const rOtherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);
        if (r.type !== 'rollover') {
          himC += rHimC; herC += rHerC; otherC += rOtherC;
          if (!storeMap[r.store]) storeMap[r.store] = { himC: 0, herC: 0, category: r.category || 'outros' };
          storeMap[r.store].himC += rHimC; storeMap[r.store].herC += rHerC;
          const cat = r.category || 'outros';
          if (!categoryMap[cat]) categoryMap[cat] = { total: 0, him: 0, her: 0 };
          categoryMap[cat].total += rHimC + rHerC + rOtherC;
          categoryMap[cat].him += rHimC;
          categoryMap[cat].her += rHerC;
        }
      }
    });
    let settlementsHTML = ''; let settlements = fullList.filter(r => r.type === 'settlement');
    if (settlements.length > 0) {
      let sRows = settlements.map(s => { const payerName = s.payer === 'him' ? names.him : names.her; const dStr = new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); return `<div class="store-row" style="border-left: 3px solid var(--both); padding-left:0.75rem;"><div style="flex:1"><div style="font-weight:700">Adiantamento / Pix de ${payerName}</div><div style="font-size:0.7rem; color:var(--muted2);">${dStr}</div></div><div style="text-align:right"><div style="color:var(--both); font-weight:800">+ ${fmt(fromCents(s.amountCents))}</div><button class="btn-ghost" style="border:none; padding:0.2rem; font-size:0.7rem; color:var(--muted); margin-top:0.25rem;" onclick="window.deleteReceipt('${s._fireId}')">Apagar Pix</button></div></div>`; }).join('');
      settlementsHTML = `<div class="card" style="margin-bottom:1rem; border-color:var(--both);"><div class="card-header" style="color:var(--both)">💸 Pagamentos Parciais (Já Realizados)</div><div style="padding:0.75rem 1.25rem 1rem 1.25rem;">${sRows}</div></div>`;
    }
    const btnHtml = `<button class="btn btn-primary btn-sm" onclick="window.openSettleModal()" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.4rem; font-weight:700; border-radius:var(--radius-sm);">💸 Abater Valor (Registrar Pix)</button>`;
    let finalHTML = '';
    if (runningBalanceCents > 0) finalHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--both)"><div class="card-header" style="color:var(--both)">🤝 Falta Pagar (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center"><div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.her} deve pagar para ${names.him}</div><div style="font-size:2.2rem;font-weight:900;color:var(--both);letter-spacing:-1px;margin-bottom:1rem;">${fmt(fromCents(runningBalanceCents))}</div>${btnHtml}</div></div>`;
    else if (runningBalanceCents < 0) finalHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--her)"><div class="card-header" style="color:var(--her)">🤝 Falta Pagar (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center"><div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.him} deve pagar para ${names.her}</div><div style="font-size:2.2rem;font-weight:900;color:var(--her);letter-spacing:-1px;margin-bottom:1rem;">${fmt(fromCents(Math.abs(runningBalanceCents)))}</div>${btnHtml}</div></div>`;
    else finalHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🤝 Falta Pagar (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center;font-weight:700;color:var(--both)">Tudo quite nesta fatura! ✅<div style="margin-top:1rem">${btnHtml}</div></div></div>`;
    let listGastos = list.filter(r => r.type !== 'settlement' && r.type !== 'rollover');
    if (!listGastos.length && runningBalanceCents === 0 && settlements.length === 0) { container.innerHTML = `${finalHTML}<div class="empty"><div class="empty-icon">📊</div><p>Nenhum dado nesta fatura.</p></div>`; return; }
    const coupleC = himC + herC; const grandC = coupleC + otherC;
    const himPct = coupleC > 0 ? Math.round(himC / coupleC * 100) : 0; const herPct = 100 - himPct;
    let thirdPartyHTML = ''; let hasDebts = false; let debtsRows = '';
    Object.entries(thirdPartyDebts.him).forEach(([name, amount]) => { hasDebts = true; debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.him})</small></span><span style="color:var(--him);font-weight:800">${fmt(fromCents(amount))}</span></div>`; });
    Object.entries(thirdPartyDebts.her).forEach(([name, amount]) => { hasDebts = true; debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.her})</small></span><span style="color:var(--her);font-weight:800">${fmt(fromCents(amount))}</span></div>`; });
    if (hasDebts) { thirdPartyHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--other)"><div class="card-header" style="color:var(--other)">👥 A Receber de Terceiros (Em Aberto)</div><div style="padding:0 1.25rem">${debtsRows}</div></div>`; }
    let goalHTML = '';
    if (AppState.appSettings.monthlyGoal > 0) {
      const pct = Math.min(100, Math.round(globalCoupleC / AppState.appSettings.monthlyGoal * 100));
      const color = pct >= 100 ? 'var(--her)' : pct >= 80 ? 'var(--other)' : 'var(--both)';
      goalHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🎯 Meta da Fatura</div><div class="goal-bar-wrap"><div class="goal-bar-labels"><span>${fmt(fromCents(globalCoupleC))} gastos</span><span style="color:${color};font-weight:800">${pct}%</span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div></div><div style="font-size:0.72rem;color:var(--muted2);margin-top:0.4rem">Meta: ${fmt(fromCents(AppState.appSettings.monthlyGoal))}</div></div></div>`;
    }
    const statsHTML = `<div class="stat-grid" style="margin-bottom:1rem"><div class="stat-card"><div class="stat-label">${names.him} consumiu</div><div class="stat-value" style="color:var(--him)">${fmt(fromCents(himC))}</div></div><div class="stat-card"><div class="stat-label">${names.her} consumiu</div><div class="stat-value" style="color:var(--her)">${fmt(fromCents(herC))}</div></div><div class="stat-card"><div class="stat-label">Total do casal</div><div class="stat-value" style="color:var(--both)">${fmt(fromCents(coupleC))}</div></div>${otherC > 0 ? `<div class="stat-card"><div class="stat-label">Terceiros</div><div class="stat-value" style="color:var(--other)">${fmt(fromCents(otherC))}</div></div>` : `<div class="stat-card"><div class="stat-label">Contas</div><div class="stat-value">${listGastos.length}</div></div>`}</div>`;
    const donutSegs = [{ value: himC, color: 'var(--him)', label: names.him, val: fmt(fromCents(himC)) }, { value: herC, color: 'var(--her)', label: names.her, val: fmt(fromCents(herC)) }];
    if (otherC > 0) donutSegs.push({ value: otherC, color: 'var(--other)', label: 'Terceiros', val: fmt(fromCents(otherC)) });
    const donutHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🍩 Proporção de gastos</div><div class="donut-wrap">${buildDonutSVG(donutSegs)}<div class="donut-legend">${donutSegs.map(s => `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${s.color}"></div><span class="donut-legend-label">${s.label}</span><span class="donut-legend-value" style="color:${s.color}">${s.val}</span></div>`).join('')}<div class="donut-legend-item" style="margin-top:0.25rem;padding-top:0.5rem;border-top:1px solid var(--border)"><span class="donut-legend-label">Proporção</span><span class="donut-legend-value" style="color:var(--muted2)">${himPct}% / ${herPct}%</span></div></div></div></div>`;
    const catRows = Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total).map(([cat, val]) => { 
      const pctBar = grandC > 0 ? Math.round(val.total / grandC * 100) : 0; 
      return `
        <div class="cat-row" style="flex-direction:column; align-items:stretch; gap:0.4rem; padding: 0.75rem 0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.82rem;font-weight:700">${catLabel(cat)}</span>
            <span class="cat-row-value" style="font-size:0.9rem">${fmt(fromCents(val.total))}</span>
          </div>
          <div class="cat-row-bar" style="margin: 0;"><div class="cat-row-fill" style="width:${pctBar}%"></div></div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--muted2);">
            <span>${names.him}: <strong style="color:var(--him)">${fmt(fromCents(val.him))}</strong></span>
            <span>${names.her}: <strong style="color:var(--her)">${fmt(fromCents(val.her))}</strong></span>
          </div>
        </div>`; 
    }).join('');
    const categoryHTML = grandC > 0 ? `<div class="card" style="margin-bottom:1rem"><div class="card-header">📂 Gastos por categoria</div><div style="padding:0.5rem 1.25rem">${catRows}</div></div>` : '';
    const allStores = Object.entries(storeMap).sort((a, b) => (b[1].himC + b[1].herC) - (a[1].himC + a[1].herC));
    const renderStoreSubList = (listArr, title, icon) => {
      if (!listArr.length) return '';
      const rows = listArr.slice(0, 8).map(([store, v]) => {
        const dotColor = v.himC > 0 && v.herC === 0 ? 'var(--him)' : v.herC > 0 && v.himC === 0 ? 'var(--her)' : 'var(--both)';
        return `<div class="store-row" style="align-items:flex-start;gap:0.6rem">
          <div style="display:flex;align-items:flex-start;gap:0.5rem;flex:1;min-width:0">
            <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;margin-top:0.3rem"></div>
            <div style="min-width:0">
              <div class="store-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${store}</div>
              <div style="font-size:0.68rem;color:var(--muted2);margin-top:0.1rem">${catLabel(v.category)}</div>
            </div>
          </div>
          <div class="store-amounts" style="flex-shrink:0">
            ${v.himC > 0 ? `<span style="color:var(--him)">${fmt(fromCents(v.himC))}</span>` : ''}
            ${v.herC > 0 ? `<span style="color:var(--her)">${fmt(fromCents(v.herC))}</span>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div style="margin-top:1.2rem;margin-bottom:0.6rem;font-size:0.75rem;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:0.5px">${icon} ${title}</div>${rows}`;
    };

    const storeRows = (
      renderStoreSubList(allStores.filter(x => x[1].himC > 0 && x[1].herC > 0), 'Casal', '👩‍❤️‍👨') +
      renderStoreSubList(allStores.filter(x => x[1].himC > 0 && x[1].herC === 0), names.him, '🔵') +
      renderStoreSubList(allStores.filter(x => x[1].herC > 0 && x[1].himC === 0), names.her, '🔴')
    ) || '<div style="padding:1rem 0;color:var(--muted);text-align:center;font-size:0.9rem">Nenhum gasto registrado.</div>';
    const receiptRows = [...listGastos].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => { const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0); const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0); const d = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); return `<div class="store-row" style="${r.status === 'paid' ? 'opacity:0.6' : ''}"><span>${d} — ${r.store} <span class="category-badge">${catLabel(r.category || 'outros')}</span></span><div class="store-amounts"><span style="color:var(--him)">${fmt(fromCents(rHimC))}</span><span style="color:var(--her)">${fmt(fromCents(rHerC))}</span></div></div>`; }).join('');
    const exportBtn = `<div style="margin-bottom:1rem;display:flex;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="window.exportCSV()">📥 Exportar CSV desta Fatura</button></div>`;
    let topStoreTitle = '🏪 Onde vocês mais gastaram';
    if (reportTab === 'him') topStoreTitle = `🏪 Onde ${names.him} mais gastou`;
    else if (reportTab === 'her') topStoreTitle = `🏪 Onde ${names.her} mais gastou`;
    else if (reportTab === 'all') topStoreTitle = '🏪 Onde mais foi gasto';
    container.innerHTML = `${finalHTML}${settlementsHTML}${thirdPartyHTML}${goalHTML}${statsHTML}${donutHTML}${categoryHTML}<div class="card" style="margin-bottom:1rem"><div class="card-header">${topStoreTitle}</div><div style="padding:0 1.25rem">${storeRows}</div></div><div class="card" style="margin-bottom:1rem"><div class="card-header">🧾 ${listGastos.length} contas na fatura</div><div style="padding:0 1.25rem">${receiptRows}</div></div>${exportBtn}`;
  } catch (error) { console.error(error); }
};

window.exportCSV = function() {
  try {
    const cycle = document.getElementById('report-cycle')?.value || 'current';
    let list = AppState.allReceipts.filter(r => !r.scope && r.type !== 'settlement');
    if (cycle === 'current') list = list.filter(r => !r.cycle || r.cycle === 'current');
    else list = list.filter(r => r.cycle === cycle);
    if (!list.length) { window.showToast('⚠️ Nenhum dado para exportar.'); return; }
    const names = getNames();
    const rows = [['Data', 'Estabelecimento', 'Categoria', 'Pago por', 'Forma', names.him, names.her, 'Terceiros', 'Total', 'Status']];
    list.forEach(r => {
      const himC = r.himCents || 0; const herC = r.herCents || 0; const othC = r.otherCents || 0;
      rows.push([r.date, r.store, catLabel(r.category || 'outros'), r.payer === 'him' ? names.him : names.her, r.method || '', fromCents(himC).toFixed(2), fromCents(herC).toFixed(2), fromCents(othC).toFixed(2), fromCents(himC + herC + othC).toFixed(2), r.status === 'paid' ? 'Pago' : 'Em Aberto']);
    });
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `gastos_casal_${cycle}.csv`; a.click(); URL.revokeObjectURL(url);
    window.showToast('📥 CSV exportado!');
  } catch(e) { console.error(e); }
};

// ══════════════════════════════════════════════════════════════════
//  TELA DE METAS DE ORÇAMENTO
// ══════════════════════════════════════════════════════════════════
const GOALS_CATEGORIES = [
  { key: 'mercado', label: '🛒 Mercado' }, { key: 'restaurante', label: '🍽️ Restaurante' },
  { key: 'transporte', label: '🚗 Transporte' }, { key: 'saude', label: '💊 Saúde' },
  { key: 'lazer', label: '🎉 Lazer' }, { key: 'moradia', label: '🏠 Moradia' },
  { key: 'educacao', label: '📚 Educação' }, { key: 'roupas', label: '👕 Roupas' },
  { key: 'outros', label: '📦 Outros' }
];

function goalBar(spent, limit, accentColor) {
  if (!limit || limit === 0) return '';
  const pct = Math.min(100, Math.round(spent / limit * 100));
  const overBudget  = pct >= 100;
  const nearBudget  = pct >= 80;
  const statusColor = overBudget ? 'var(--her)' : nearBudget ? '#f59e0b' : (accentColor || 'var(--both)');
  const statusLabel = overBudget ? '🔴 ESTOURADO' : nearBudget ? '🟡 Atenção' : '🟢';
  return `
    <div style="margin-top:0.4rem">
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.25rem">
        <span style="font-weight:600;color:var(--muted1)">${fmt(fromCents(spent))} / ${fmt(fromCents(limit))}</span>
        <span style="color:${statusColor};font-weight:700">${statusLabel} ${pct}%</span>
      </div>
      <div style="background:var(--card2);border-radius:99px;height:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${statusColor};border-radius:99px;transition:width 0.6s ease"></div>
      </div>
    </div>`;
}

window.renderGoals = function() {
  try {
    const g = AppState.appSettings.goals || { categories: {}, persons: {} };
    const names = getNames();

    // ── Calcular gastos da fatura atual por categoria e por pessoa ──
    const current = AppState.allReceipts.filter(r => !r.scope && r.type !== 'settlement' && r.type !== 'rollover' && (!r.cycle || r.cycle === 'current'));
    const spentCat = {}; const spentCatHim = {}; const spentCatHer = {};
    let spentHim = 0; let spentHer = 0;
    current.forEach(r => {
      const cat = r.category || 'outros';
      const total = (r.himCents || 0) + (r.herCents || 0);
      spentCat[cat] = (spentCat[cat] || 0) + total;
      spentCatHim[cat] = (spentCatHim[cat] || 0) + (r.himCents || 0);
      spentCatHer[cat] = (spentCatHer[cat] || 0) + (r.herCents || 0);
      spentHim += r.himCents || 0;
      spentHer += r.herCents || 0;
    });

    // ── Renderizar inputs de categoria ──
    const normalizedCats = normalizeCategoryLimits(g.categories || {});
    const catContainer = document.getElementById('goals-category-inputs');
    if (catContainer) {
      catContainer.innerHTML = GOALS_CATEGORIES.map(({ key, label }) => {
        const lim = normalizedCats[key] || { him: 0, her: 0 };
        const limHim = lim.him; const limHer = lim.her;
        const limCouple = limHim + limHer;
        const valCouple = limCouple > 0 ? fromCents(limCouple).toFixed(2) : '';
        const valHim    = limHim    > 0 ? fromCents(limHim).toFixed(2)    : '';
        const valHer    = limHer    > 0 ? fromCents(limHer).toFixed(2)    : '';
        const spentHim_cat = spentCatHim[key] || 0;
        const spentHer_cat = spentCatHer[key] || 0;
        const barHim = limHim > 0 ? `
          <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.6rem">
            <span style="font-size:0.68rem;color:var(--him);font-weight:700;min-width:36px">${names.him}</span>
            <div style="flex:1">${goalBar(spentHim_cat, limHim, 'var(--him)')}</div>
          </div>` : '';
        const barHer = limHer > 0 ? `
          <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.35rem">
            <span style="font-size:0.68rem;color:var(--her);font-weight:700;min-width:36px">${names.her}</span>
            <div style="flex:1">${goalBar(spentHer_cat, limHer, 'var(--her)')}</div>
          </div>` : '';
        return `<div style="margin-bottom:1.5rem;padding-bottom:1.1rem;border-bottom:1px solid var(--border)">
          <div style="font-size:0.88rem;font-weight:700;margin-bottom:0.5rem">${label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem">
            <div style="display:flex;flex-direction:column;gap:0.25rem">
              <label style="font-size:0.7rem;color:var(--muted2);font-weight:600">CASAL</label>
              <input id="cat-couple-${key}" class="field-input" type="number" step="0.01" min="0" placeholder="—"
                value="${valCouple}" style="padding:0.4rem 0.5rem;font-size:0.82rem;width:100%"
                oninput="window.updateGoalCategory('${key}','casal',this.value)" data-cat="${key}" data-who="casal">
            </div>
            <div style="display:flex;flex-direction:column;gap:0.25rem">
              <label style="font-size:0.7rem;color:var(--him);font-weight:600">${names.him.toUpperCase()}</label>
              <input id="cat-him-${key}" class="field-input" type="number" step="0.01" min="0" placeholder="—"
                value="${valHim}" style="padding:0.4rem 0.5rem;font-size:0.82rem;width:100%;border-color:var(--him)"
                oninput="window.updateGoalCategory('${key}','him',this.value)" data-cat="${key}" data-who="him">
            </div>
            <div style="display:flex;flex-direction:column;gap:0.25rem">
              <label style="font-size:0.7rem;color:var(--her);font-weight:600">${names.her.toUpperCase()}</label>
              <input id="cat-her-${key}" class="field-input" type="number" step="0.01" min="0" placeholder="—"
                value="${valHer}" style="padding:0.4rem 0.5rem;font-size:0.82rem;width:100%;border-color:var(--her)"
                oninput="window.updateGoalCategory('${key}','her',this.value)" data-cat="${key}" data-who="her">
            </div>
          </div>
          ${barHim}${barHer}
        </div>`;
      }).join('');
    }


    // ── Renderizar inputs de pessoa ──
    const personContainer = document.getElementById('goals-person-inputs');
    if (personContainer) {
      const limHim = (g.persons || {}).him || 0;
      const limHer = (g.persons || {}).her || 0;
      personContainer.innerHTML = `
        <div style="margin-bottom:1rem">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem">
            <span style="font-size:0.88rem;font-weight:600;min-width:120px;color:var(--him)">👤 ${names.him}</span>
            <div style="display:flex;align-items:center;gap:0.4rem;flex:1">
              <span style="font-size:0.8rem;color:var(--muted2)">R$</span>
              <input class="field-input" type="number" step="0.01" min="0" placeholder="Sem limite"
                value="${limHim > 0 ? fromCents(limHim).toFixed(2) : ''}" style="flex:1;padding:0.4rem 0.6rem;font-size:0.85rem"
                oninput="window.updateGoalPerson('him', this.value)">
            </div>
          </div>
          ${goalBar(spentHim, limHim)}
        </div>
        <div style="margin-bottom:0.5rem">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem">
            <span style="font-size:0.88rem;font-weight:600;min-width:120px;color:var(--her)">👤 ${names.her}</span>
            <div style="display:flex;align-items:center;gap:0.4rem;flex:1">
              <span style="font-size:0.8rem;color:var(--muted2)">R$</span>
              <input class="field-input" type="number" step="0.01" min="0" placeholder="Sem limite"
                value="${limHer > 0 ? fromCents(limHer).toFixed(2) : ''}" style="flex:1;padding:0.4rem 0.6rem;font-size:0.85rem"
                oninput="window.updateGoalPerson('her', this.value)">
            </div>
          </div>
          ${goalBar(spentHer, limHer)}
        </div>`;
    }

    // ── Renderizar progresso geral (só categorias com limite definido) ──
    const progressContainer = document.getElementById('goals-progress-content');
    if (progressContainer) {
      const withLimit = GOALS_CATEGORIES.filter(c => {
        const lim = normalizedCats[c.key] || { him: 0, her: 0 };
        return lim.him > 0 || lim.her > 0;
      });
      const himLimit = (g.persons || {}).him || 0;
      const herLimit = (g.persons || {}).her || 0;
      if (withLimit.length === 0 && himLimit === 0 && herLimit === 0) {
        progressContainer.innerHTML = `<div class="empty"><p>Nenhuma meta definida ainda. Configure os limites acima para ver o progresso aqui.</p></div>`;
        return;
      }
      let html = '';
      if (withLimit.length > 0) {
        html += '<div style="font-size:0.8rem;font-weight:700;color:var(--muted2);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.5px">Por Categoria</div>';
        html += withLimit.map(({ key, label }) => {
          const lim = normalizedCats[key] || { him: 0, her: 0 };
          const bars = [
            lim.him > 0 ? `
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem">
                <span style="font-size:0.72rem;color:var(--him);font-weight:700;min-width:36px">${names.him}</span>
                <div style="flex:1">${goalBar(spentCatHim[key] || 0, lim.him, 'var(--him)')}</div>
              </div>` : '',
            lim.her > 0 ? `
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.35rem">
                <span style="font-size:0.72rem;color:var(--her);font-weight:700;min-width:36px">${names.her}</span>
                <div style="flex:1">${goalBar(spentCatHer[key] || 0, lim.her, 'var(--her)')}</div>
              </div>` : ''
          ].filter(Boolean).join('');
          return `<div style="margin-bottom:1.1rem"><div style="font-weight:700;font-size:0.88rem">${label}</div>${bars}</div>`;
        }).join('');
      }
      if (himLimit > 0 || herLimit > 0) {
        html += '<div style="font-size:0.8rem;font-weight:700;color:var(--muted2);margin:1rem 0 0.75rem;text-transform:uppercase;letter-spacing:0.5px">Por Pessoa</div>';
        if (himLimit > 0) html += `<div style="margin-bottom:1rem"><div style="font-weight:700;font-size:0.88rem;color:var(--him)">👤 ${names.him}</div>${goalBar(spentHim, himLimit)}</div>`;
        if (herLimit > 0) html += `<div style="margin-bottom:0.5rem"><div style="font-weight:700;font-size:0.88rem;color:var(--her)">👤 ${names.her}</div>${goalBar(spentHer, herLimit)}</div>`;
      }
      progressContainer.innerHTML = html;
    }
  } catch (e) { console.error(e); }
};

let _goalSaveTimer = null;
window.updateGoalCategory = function(key, who, value) {
  if (!AppState.appSettings.goals) AppState.appSettings.goals = { categories: {}, persons: {} };
  if (!AppState.appSettings.goals.categories) AppState.appSettings.goals.categories = {};
  const cats = AppState.appSettings.goals.categories;
  // garante que o objeto do key é sempre {him, her}
  const cur = normalizeCategoryLimits(cats)[key] || { him: 0, her: 0 };
  if (who === 'casal') {
    const total = cents(value);
    const half  = Math.round(total / 2);
    cur.him = half;
    cur.her = total - half;
    // atualizar os inputs individuais na tela sem re-render completo
    const himEl = document.getElementById('cat-him-' + key);
    const herEl = document.getElementById('cat-her-' + key);
    if (himEl) himEl.value = cur.him > 0 ? fromCents(cur.him).toFixed(2) : '';
    if (herEl) herEl.value = cur.her > 0 ? fromCents(cur.her).toFixed(2) : '';
  } else {
    cur[who] = cents(value);
    // atualizar o input do casal na tela sem re-render completo
    const coupleEl = document.getElementById('cat-couple-' + key);
    if (coupleEl) {
      const total = cur.him + cur.her;
      coupleEl.value = total > 0 ? fromCents(total).toFixed(2) : '';
    }
  }
  cats[key] = { him: cur.him, her: cur.her };
  clearTimeout(_goalSaveTimer);
  _goalSaveTimer = setTimeout(() => { saveSettingsToCloud(); window.renderGoals(); }, 800);
};

window.updateGoalPerson = function(who, value) {
  if (!AppState.appSettings.goals) AppState.appSettings.goals = { categories: {}, persons: {} };
  if (!AppState.appSettings.goals.persons) AppState.appSettings.goals.persons = {};
  AppState.appSettings.goals.persons[who] = cents(value);
  clearTimeout(_goalSaveTimer);
  _goalSaveTimer = setTimeout(() => { saveSettingsToCloud(); window.renderGoals(); }, 800);
};

// ── BOOT ──
checkAuthAndBoot();