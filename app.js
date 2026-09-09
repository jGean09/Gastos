import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';

// ── TRATAMENTO GLOBAL DE ERROS ──
window.addEventListener('error', function(event) {
  console.error("Erro crítico:", event.message);
});
window.addEventListener('unhandledrejection', function(event) {
  console.error("Erro Firebase:", event.reason ? event.reason.message : "Desconhecido");
});

window.showToast = function(msg, duration = 3000) {
  try {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), duration);
    }
  } catch(e) { console.error(e); }
};

// ── ESTADO ──
let currentFile = null;
let currentBase64 = null;
let currentMime = 'image/jpeg';
let currentProducts = [];
let nextId = 0;
let allReceipts = [];
let appSettings = { him: 'Eu', her: 'Ela', password: '15112018', passwordHer: '', geminiKey: '', monthlyGoal: 0 };
let loggedAs = sessionStorage.getItem('casal_logged_as') || null; // 'him' | 'her' | null

let isSaving = false;
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
    
    // CORREÇÃO: Chama a função certa para preencher o filtro de Faturas!
    if (id === 'history') { window.populateCycleSelects(); window.renderHistory(); }
    if (id === 'report')  { window.populateCycleSelects(); window.renderReport(); }
    if (id === 'personal') { window.renderPersonalDashboard(); }
  } catch (error) {
    console.error("Erro na navegação:", error);
    alert("Erro ao mudar de página: " + error.message);
  }
};

window.updatePayerSelect = function() {
  try {
    const names = getNames();
    const html = `<option value="him">${names.him}</option><option value="her">${names.her}</option>`;
    ['meta-payer', 'quick-payer', 'edit-payer', 'cycle-payer', 'settle-payer'].forEach(id => {
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

    // Verifica senha dela primeiro (se existir)
    if (appSettings.passwordHer && input === appSettings.passwordHer) {
      erroMsg.style.display = 'none';
      loggedAs = 'her';
      sessionStorage.setItem('casal_logged_as', 'her');
      localStorage.setItem('casal_auth', 'ok');
      liberarAcesso();
    } else if (input === appSettings.password) {
      erroMsg.style.display = 'none';
      loggedAs = 'him';
      sessionStorage.setItem('casal_logged_as', 'him');
      localStorage.setItem('casal_auth', 'ok');
      liberarAcesso();
    } else {
      erroMsg.style.display = 'block';
      erroMsg.textContent = 'Senha incorreta! Tente novamente.';
      inputEl.classList.add('shake');
      setTimeout(() => inputEl.classList.remove('shake'), 500);
    }
  } catch (error) { console.error(error); }
};

function liberarAcesso() {
  try {
    const loginScreen = document.getElementById('login-screen');
    loginScreen.style.opacity = '0';
    loginScreen.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { loginScreen.style.display = 'none'; }, 400);
    document.getElementById('app-content').style.display = 'block';
    initApp();
  } catch (error) { console.error(error); }
}

window.logout = function() {
  localStorage.removeItem('casal_auth');
  sessionStorage.removeItem('casal_logged_as');
  loggedAs = null;
  location.reload();
};

// ── FIREBASE LOAD/SAVE ──
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    if (snap.exists()) appSettings = { ...appSettings, ...snap.data() };
    // Se tem sessão salva mas a senha mudou ou não existe, mantém o loggedAs existente
    if (!loggedAs) {
      loggedAs = sessionStorage.getItem('casal_logged_as') || 'him';
    }
  } catch(e) { console.error(e); }
}

async function saveSettingsToCloud() {
  setSyncStatus('syncing');
  try {
    await setDoc(doc(db, 'config', 'settings'), appSettings);
    setSyncStatus('ok');
  } catch(e) { setSyncStatus('err'); window.showToast("❌ Falha ao salvar configurações."); }
}

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
    } catch(e2) { setSyncStatus('err'); window.showToast("❌ Erro ao baixar dados."); }
  }
  try {
    window.populateCycleSelects(); // CORREÇÃO AQUI
    window.renderHistory();
    if (document.getElementById('page-personal').classList.contains('active')) window.renderPersonalDashboard();
  } catch (error) { console.error(error); }
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

window.deleteReceipt = async function(fireId) {
  if (!confirm('Tem certeza que deseja apagar?')) return;
  const receiptToDel = allReceipts.find(r => r._fireId === fireId);
  const isPersonal = receiptToDel && receiptToDel.scope && receiptToDel.scope.startsWith('personal_');
  
  setSyncStatus('syncing');
  try {
    await deleteDoc(doc(db, 'receipts', fireId));
    allReceipts = allReceipts.filter(r => r._fireId !== fireId);
    setSyncStatus('ok');
    window.showToast('🗑️ Removido com sucesso.');
    
    if (isPersonal) {
      window.renderPersonalDashboard();
    } else {
      window.populateCycleSelects(); // CORREÇÃO AQUI
      window.renderHistory();
      window.renderReport();
    }
  } catch(e) {
    setSyncStatus('err');
    window.showToast("❌ Falha ao excluir.");
  }
};

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
    window.showToast(newStatus === 'paid' ? '✅ Marcado como pago!' : '🔄 Reaberto!');
  } catch(e) { setSyncStatus('err'); console.error(e); }
};

// ── MODAL DE ACERTO (PIX SOLTO) ──
window.openSettleModal = function() {
  window.updatePayerSelect();
  document.getElementById('settle-date').value = today();
  document.getElementById('settle-amount').value = '';
  document.getElementById('settle-modal').classList.add('open');
};

window.closeSettleModal = function() {
  document.getElementById('settle-modal').classList.remove('open');
};

window.saveSettlement = async function() {
  if (isSaving) return;
  const payer = document.getElementById('settle-payer').value;
  const amountStr = document.getElementById('settle-amount').value;
  const date = document.getElementById('settle-date').value || today();

  if (!amountStr || amountStr <= 0) { window.showToast('⚠️ Digite o valor do pagamento!'); return; }

  isSaving = true;
  const amountCents = cents(amountStr);
  const names = getNames();

  const receipt = {
    id: Date.now(),
    type: 'settlement',
    store: '💸 Acerto de Contas (Pix)',
    date: date,
    payer: payer,
    cycle: 'current', // Sempre atrelado à fatura aberta
    amountCents: amountCents,
    names: { him: names.him, her: names.her },
    createdAt: Date.now()
  };

  const ok = await addReceiptToCloud(receipt);
  if (ok) {
    window.showToast('✅ Acerto registrado!');
    window.closeSettleModal();
    window.populateCycleSelects(); // CORREÇÃO AQUI
    window.renderHistory();
    window.renderReport();
  }
  isSaving = false;
};

// ── PAINEL PESSOAL ──
window.renderPersonalDashboard = function() {
  try {
    const owner = document.getElementById('personal-owner').value; 
    const scopeName = `personal_${owner}`;
    
    let list = allReceipts.filter(r => r.scope === scopeName);
    list.sort((a,b) => b.date.localeCompare(a.date));

    let incomeCents = 0;
    let expenseCents = 0;

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
          const isInc = r.type === 'income';
          const color = isInc ? 'var(--both)' : 'var(--her)';
          const sign = isInc ? '+' : '-';
          return `
            <div class="store-row" style="border-bottom: 1px solid var(--border); padding: 0.75rem 0;">
              <div style="flex:1;">
                <div style="font-weight:700; font-size:0.85rem;">${r.store}</div>
                <div style="font-size:0.7rem; color:var(--muted2);">${dStr}</div>
              </div>
              <div style="text-align:right;">
                <div style="color:${color}; font-weight:800;">${sign} ${fmt(fromCents(r.amountCents))}</div>
                <button class="btn-ghost" style="border:none; padding:0.2rem; font-size:0.7rem; color:var(--muted);" onclick="window.deleteReceipt('${r._fireId}')">Apagar</button>
              </div>
            </div>
          `;
        }).join('');

    const html = `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header">➕ Novo Lançamento Pessoal</div>
        <div style="padding:1.25rem">
          <div class="meta-grid">
            <div>
              <label class="field-label">Tipo</label>
              <select class="field-input" id="pers-type">
                <option value="expense">📉 Saída / Despesa</option>
                <option value="income">📈 Entrada / Dinheiro</option>
              </select>
            </div>
            <div>
              <label class="field-label">Valor (R$)</label>
              <input class="field-input" type="number" step="0.01" min="0" id="pers-price" placeholder="0,00">
            </div>
            <div style="grid-column: span 2;">
              <label class="field-label">Descrição</label>
              <input class="field-input" id="pers-desc" placeholder="Ex: Salário, Fatura Nubank, Ifood Sozinho...">
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%; margin-top:0.75rem;" onclick="window.savePersonalTransaction()">💾 Salvar no Pessoal</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Minhas Entradas</div>
          <div class="stat-value" style="color:var(--both)">${fmt(fromCents(incomeCents))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Minhas Saídas</div>
          <div class="stat-value" style="color:var(--her)">${fmt(fromCents(expenseCents))}</div>
        </div>
        <div class="stat-card" style="grid-column: span 2;">
          <div class="stat-label">Saldo em Conta / Sobra</div>
          <div class="stat-value" style="color:${balanceColor}">${fmt(fromCents(balanceCents))}</div>
        </div>
      </div>

      <div class="card" style="margin-top:1.5rem;">
        <div class="card-header">📋 Meu Histórico</div>
        <div style="padding:0 1.25rem 0.5rem 1.25rem;">
          ${historyHTML}
        </div>
      </div>
    `;
    document.getElementById('personal-dashboard-content').innerHTML = html;
  } catch (error) { console.error(error); }
};

window.savePersonalTransaction = async function() {
  if (isSaving) return;
  const owner = document.getElementById('personal-owner').value;
  const type = document.getElementById('pers-type').value;
  const price = document.getElementById('pers-price').value;
  const desc = document.getElementById('pers-desc').value.trim();

  if (!desc || !price || price <= 0) { window.showToast('⚠️ Preencha o valor e a descrição!'); return; }

  isSaving = true;
  const amountCents = cents(price);
  const names = getNames();

  const receipt = {
    id: Date.now(), scope: `personal_${owner}`, type: type,
    store: desc, date: today(), amountCents: amountCents,
    names: { him: names.him, her: names.her }, createdAt: Date.now()
  };

  const ok = await addReceiptToCloud(receipt);
  if (ok) {
    window.showToast('✅ Lançamento salvo!');
    window.renderPersonalDashboard();
  }
  isSaving = false;
};

// ── LÓGICA DE FECHAMENTO DE FATURA ──
window.openCloseCycleModal = function() {
  window.updatePayerSelect();
  document.getElementById('cycle-date').value = today();
  document.getElementById('cycle-name').value = '';
  document.getElementById('cycle-amount').value = '';
  document.getElementById('close-cycle-modal').classList.add('open');
};

window.closeCycleModal = function() {
  document.getElementById('close-cycle-modal').classList.remove('open');
};

window.saveCloseCycle = async function() {
  if (isSaving) return;
  
  const cycleName = document.getElementById('cycle-name').value.trim() || 'Fatura ' + today();
  const payer = document.getElementById('cycle-payer').value;
  const amountStr = document.getElementById('cycle-amount').value;
  const date = document.getElementById('cycle-date').value || today();
  
  const amountPaid = amountStr ? cents(amountStr) : 0;
  
  let activeReceipts = allReceipts.filter(r => !r.scope && (!r.cycle || r.cycle === 'current'));
  if (activeReceipts.length === 0) { window.showToast('⚠️ Nenhuma conta aberta!'); return; }

  isSaving = true; setSyncStatus('syncing');

  try {
    let coupleBalanceCents = 0; 
    activeReceipts.forEach(r => {
      if (r.type === 'settlement') {
         if (r.payer === 'him') coupleBalanceCents += r.amountCents;
         else if (r.payer === 'her') coupleBalanceCents -= r.amountCents;
      } else if (r.status !== 'paid') {
         const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
         const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
         if (r.payer === 'him') coupleBalanceCents += rHerC;
         else if (r.payer === 'her') coupleBalanceCents -= rHimC;
      }
    });

    if (payer === 'him') coupleBalanceCents += amountPaid; 
    else if (payer === 'her') coupleBalanceCents -= amountPaid; 

    await Promise.all(activeReceipts.map(async r => {
      await setDoc(doc(db, 'receipts', r._fireId), { cycle: cycleName }, { merge: true });
      r.cycle = cycleName; 
    }));

    if (amountPaid > 0) {
      const names = getNames();
      const settlement = {
        id: Date.now(), type: 'settlement', store: '💸 Pix / Acerto Final',
        date, payer, amountCents: amountPaid, cycle: cycleName, 
        names: { him: names.him, her: names.her }, createdAt: Date.now()
      };
      await addReceiptToCloud(settlement);
    }

    if (coupleBalanceCents !== 0) {
      const names = getNames();
      let rollPayer = ''; let rHimC = 0, rHerC = 0; let splitType = '';
      let itemPrice = Math.abs(coupleBalanceCents);

      if (coupleBalanceCents > 0) { rollPayer = 'him'; rHerC = itemPrice; splitType = 'her'; } 
      else { rollPayer = 'her'; rHimC = itemPrice; splitType = 'him'; }

      const rolloverItem = { id: Date.now(), name: 'Dívida pendente: ' + cycleName, priceCents: itemPrice, split: splitType, otherName: '' };
      const rolloverReceipt = {
        id: Date.now(), type: 'rollover', store: `Restante ref: ${cycleName}`,
        date: date, payer: rollPayer, method: 'Saldo Acumulado', category: 'outros', status: 'open', cycle: 'current',
        items: [rolloverItem], himCents: rHimC, herCents: rHerC, otherCents: 0, coupleCents: itemPrice, totalCents: itemPrice,
        imageBase64: null, imageMime: null, names: { him: names.him, her: names.her }, createdAt: Date.now() + 1000
      };
      await addReceiptToCloud(rolloverReceipt);
    }

    window.showToast('✅ Fatura Fechada com Sucesso!');
    window.closeCycleModal();
    window.populateCycleSelects(); 
    
    document.getElementById('filter-cycle').value = 'current';
    document.getElementById('report-cycle').value = 'current';
    
    window.renderHistory();
    window.renderReport();
  } catch (e) {
    setSyncStatus('err'); window.showToast('❌ Erro no fechamento: ' + e.message); console.error(e);
  } finally { isSaving = false; }
};

// ── MODAL DE EDIÇÃO NORMAL ──
window.openEditModal = function(fireId) {
  try {
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
  } catch(e) { console.error(e); }
};

window.closeEditModal = function() {
  document.getElementById('edit-modal').classList.remove('open');
  editingFireId = null;
  editingItems = [];
};

window.updateEditItem = function(idx, field, value) {
  if (!editingItems[idx]) return;
  if (field === 'priceCents') editingItems[idx].priceCents = Math.round(parseFloat(value || 0) * 100);
  else editingItems[idx][field] = value;
  
  if (field === 'split') {
    if (value !== 'other') editingItems[idx].otherName = '';
    renderEditItems();
  }
};

window.removeEditItem = function(idx) { editingItems.splice(idx, 1); renderEditItems(); };

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

      const otherInput = item.split === 'other'
        ? `<input class="other-input" style="margin-top:0.4rem" placeholder="Quem pegou..." value="${item.otherName || ''}" oninput="window.updateEditItem(${idx}, 'otherName', this.value)">` : '';

      return `<div style="margin-bottom:0.75rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
        <div class="edit-item-row" style="border-bottom:none; padding:0;">
          <input class="edit-item-name" value="${item.name}" oninput="window.updateEditItem(${idx}, 'name', this.value)" placeholder="Nome">
          <input class="edit-item-price" type="number" step="0.01" value="${fromCents(item.priceCents || 0).toFixed(2)}" oninput="window.updateEditItem(${idx}, 'priceCents', this.value)">
          <select class="field-input" style="width:70px;padding:0.4rem 0.3rem;font-size:0.75rem" onchange="window.updateEditItem(${idx}, 'split', this.value)">${splitOpts}</select>
          <button class="del-item-btn" onclick="window.removeEditItem(${idx})">✕</button>
        </div>
        ${otherInput}
      </div>`;
    }).join('');
}

window.saveEditModal = async function() {
  try {
    if (isSaving) return;
    const receipt = allReceipts.find(r => r._fireId === editingFireId);
    if (!receipt) return;

    isSaving = true;
    const { himC, herC, otherC } = calcTotals(editingItems);
    const names = getNames();
    const updates = {
      store: document.getElementById('edit-store').value.trim() || receipt.store,
      date: document.getElementById('edit-date').value || receipt.date,
      method: document.getElementById('edit-method').value.trim(),
      category: document.getElementById('edit-category').value || 'outros',
      payer: document.getElementById('edit-payer').value,
      items: editingItems,
      himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
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
  } catch(e) { window.showToast('❌ Erro: ' + e.message); console.error(e); } finally { isSaving = false; }
};

// ── BOOT E INIT ──
async function checkAuthAndBoot() {
  try {
    await loadSettings();
    const senhaInput = document.getElementById('senha-input');
    if (senhaInput) senhaInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.verificarSenha(); });
    if (localStorage.getItem('casal_auth') === 'ok') liberarAcesso();
  } catch (error) { console.error("Erro no boot:", error); }
}

async function initApp() {
  try {
    document.getElementById('api-key-input').value = appSettings.geminiKey || '';
    document.getElementById('api-key-settings').value = appSettings.geminiKey || '';
    document.getElementById('name-him').value = appSettings.him;
    document.getElementById('name-her').value = appSettings.her;
    document.getElementById('meta-date').value = today();
    document.getElementById('quick-date').value = today();
    const goalEl = document.getElementById('monthly-goal');
    if (goalEl) goalEl.value = appSettings.monthlyGoal > 0 ? fromCents(appSettings.monthlyGoal).toFixed(2) : '';
    window.updatePayerSelect();

    // Mostrar badge de perfil logado no header
    const names = getNames();
    const profileBadge = document.getElementById('profile-badge');
    if (profileBadge && loggedAs) {
      const pName = loggedAs === 'him' ? names.him : names.her;
      const pColor = loggedAs === 'him' ? 'var(--him)' : 'var(--her)';
      profileBadge.style.display = 'flex';
      profileBadge.style.borderColor = pColor;
      profileBadge.innerHTML = `<span style="color:${pColor};font-weight:700;font-size:0.78rem">👤 ${pName.split(' ')[0]}</span>`;
    }

    // Configurar painel pessoal para o perfil logado
    const ownerSel = document.getElementById('personal-owner');
    const ownerLabel = document.getElementById('personal-owner-label');
    const ownerCard = document.getElementById('personal-owner-card');
    if (ownerSel && loggedAs) {
      ownerSel.value = loggedAs;
      if (loggedAs === 'her') {
        // Ela só vê o próprio painel
        ownerSel.style.display = 'none';
        if (ownerLabel) ownerLabel.textContent = `Painel de ${names.her.split(' ')[0]}`;
        if (ownerCard) ownerCard.style.borderColor = 'var(--her)';
      } else {
        ownerSel.style.display = '';
        if (ownerLabel) ownerLabel.textContent = 'De quem é este painel?';
        if (ownerCard) ownerCard.style.borderColor = 'var(--him)';
      }
    }

    // Configurar quick-payer para o perfil logado por padrão
    const quickPayer = document.getElementById('quick-payer');
    if (quickPayer && loggedAs) quickPayer.value = loggedAs;

    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) window.loadFile(e.dataTransfer.files[0]); });
    }
    await loadReceipts();
  } catch (error) { console.error("Erro ao inicializar", error); }
}

// ── LANÇAMENTO RÁPIDO ──
window.saveQuickExpense = async function() {
  try {
    if (isSaving) return;
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

    isSaving = true;
    const itemCents = cents(price);
    let himC = 0, herC = 0, otherC = 0;
    if (split === 'him') himC = itemCents;
    else if (split === 'her') herC = itemCents;
    else if (split === 'other') otherC = itemCents;
    else { himC = Math.floor(itemCents / 2); herC = itemCents - Math.floor(itemCents / 2); }

    const item = { id: Date.now(), name: desc, priceCents: itemCents, split, otherName: split === 'other' ? otherName : '' };
    const names = getNames();
    const receipt = {
      id: Date.now(),
      store: desc,           // ← CORRIGIDO: usa a descrição como nome do lançamento
      date: dateVal,         // ← CORRIGIDO: usa a data escolhida pelo usuário
      payer, method, category, status: 'open',
      cycle: 'current',
      items: [item], himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
      imageBase64: null, imageMime: null, names: { him: names.him, her: names.her }, createdAt: Date.now()
    };

    const ok = await addReceiptToCloud(receipt);
    if (ok) {
      window.showToast('✅ Salvo!');
      document.getElementById('quick-desc').value = '';
      document.getElementById('quick-price').value = '';
      document.getElementById('quick-date').value = today();
      if (document.getElementById('quick-method')) document.getElementById('quick-method').value = '';
      document.getElementById('quick-other-name').value = '';
      document.getElementById('quick-other-div').style.display = 'none';
      document.getElementById('quick-split').value = 'both';
      document.getElementById('quick-category').value = 'outros';
      window.populateCycleSelects();
      window.renderHistory();
    }
  } catch (error) { console.error(error); } finally { isSaving = false; }
};

// ── CONFIGURAÇÕES E DADOS GERAIS ──
window.saveApiKey = function() { appSettings.geminiKey = document.getElementById('api-key-input').value.trim(); document.getElementById('api-key-settings').value = appSettings.geminiKey; saveSettingsToCloud(); };
window.saveApiKeySettings = function() { appSettings.geminiKey = document.getElementById('api-key-settings').value.trim(); document.getElementById('api-key-input').value = appSettings.geminiKey; saveSettingsToCloud(); };
window.saveNames = function() { appSettings.him = document.getElementById('name-him').value || 'Eu'; appSettings.her = document.getElementById('name-her').value || 'Ela'; window.updatePayerSelect(); saveSettingsToCloud(); };
window.saveGoal = function() { appSettings.monthlyGoal = cents(document.getElementById('monthly-goal').value); saveSettingsToCloud(); };
window.changePassword = function() { const np = document.getElementById('new-password').value.trim(); if (!np) return; appSettings.password = np; saveSettingsToCloud(); document.getElementById('new-password').value = ''; window.showToast('✅ Sua senha foi alterada!'); };
window.changePasswordHer = function() {
  const np = document.getElementById('new-password-her')?.value.trim();
  if (!np) { window.showToast('⚠️ Digite a nova senha dela!'); return; }
  appSettings.passwordHer = np;
  saveSettingsToCloud();
  document.getElementById('new-password-her').value = '';
  window.showToast('✅ Senha dela alterada! Agora ela pode fazer login.');
};

window.clearAllData = async function() {
  if (!confirm('Apagar TODOS os dados (incluindo painel pessoal e faturas antigas)?')) return;
  setSyncStatus('syncing');
  try {
    const snap = await getDocs(collection(db, 'receipts'));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'receipts', d.id))));
    allReceipts = [];
    setSyncStatus('ok');
    window.populateCycleSelects(); // CORREÇÃO AQUI
    window.renderHistory();
    window.renderReport();
    if (document.getElementById('page-personal').classList.contains('active')) window.renderPersonalDashboard();
    window.showToast('🗑️ Limpeza concluída.');
  } catch(e) { setSyncStatus('err'); console.error(e); }
};

// ── LER CUPOM COM GEMINI ──
window.handleFile = function(e) { if (e.target.files[0]) window.loadFile(e.target.files[0]); };
window.loadFile = function(file) {
  try {
    currentFile = file; currentMime = 'image/jpeg';
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
        currentBase64 = dataUrl.split(',')[1];
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
  currentFile = null; currentBase64 = null; currentProducts = []; nextId = 0;
  document.getElementById('preview-section').style.display = 'none'; document.getElementById('products-section').style.display = 'none';
  document.getElementById('upload-zone').style.display = 'block'; document.getElementById('upload-zone').querySelector('input').value = '';
};
window.resetAll = function() { window.resetUpload(); window.showToast('Descartado.'); };

window.extractWithGemini = async function() {
  try {
    const apiKey = appSettings.geminiKey || '';
    if (!apiKey || !currentBase64) { window.showToast('⚠️ Chave ou Imagem faltando!'); return; }
    document.getElementById('extract-btn').disabled = true; document.getElementById('loading-box').style.display = 'flex';
    const body = { contents: [{ parts: [{ inline_data: { mime_type: currentMime, data: currentBase64 } }, { text: `Analise este cupom fiscal brasileiro. Retorne APENAS JSON válido, sem markdown, sem texto extra:\n{"store":"nome do estabelecimento","date":"YYYY-MM-DD","items":[{"name":"nome do produto","price":0.00}]}\nUse preço total do item (qtd x unitário). Omita itens ilegíveis. NUNCA coloque texto fora do JSON.` }] }], generationConfig: { temperature: 0 } };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.split('```json').join('').split('```').join('').trim();
    const parsed = JSON.parse(text);
    currentProducts = parsed.items.map(item => ({ id: nextId++, name: item.name, priceCents: cents(item.price), split: 'both', otherName: '' }));
    if (parsed.store) document.getElementById('meta-store').value = parsed.store;
    if (parsed.date) document.getElementById('meta-date').value = parsed.date;
    window.renderProducts();
    document.getElementById('products-section').style.display = 'block';
    window.showToast('✅ Extraído!');
  } catch(err) { window.showToast('❌ Falha na IA.'); console.error(err); } 
  finally {
    const b = document.getElementById('extract-btn'); if(b) b.disabled = false;
    const bx = document.getElementById('loading-box'); if(bx) bx.style.display = 'none';
  }
};

window.addManual = function() {
  const nameEl = document.getElementById('new-name'); const priceEl = document.getElementById('new-price');
  const name = nameEl.value.trim(); if (!name) return;
  currentProducts.push({ id: nextId++, name, priceCents: cents(priceEl.value), split: 'both', otherName: '' });
  nameEl.value = ''; priceEl.value = ''; document.getElementById('products-section').style.display = 'block';
  window.renderProducts(); nameEl.focus();
};

window.renderProducts = function() {
  const names = getNames(); const list = document.getElementById('products-list'); list.innerHTML = '';
  currentProducts.forEach(item => {
    const div = document.createElement('div'); div.className = 'product-item';
    const otherInput = item.split === 'other' ? `<input class="other-input" placeholder="Pessoa..." value="${item.otherName || ''}" oninput="window.setOtherName(${item.id}, this.value)">` : '';
    div.innerHTML = `
      <div class="product-top">
        <div style="display:flex;align-items:flex-start;gap:0.5rem;flex:1"><button class="del-item-btn" onclick="window.removeItem(${item.id})">✕</button><span class="product-name-text">${item.name}</span></div>
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
};
window.removeItem = function(id) { currentProducts = currentProducts.filter(p => p.id !== id); window.renderProducts(); };
window.setSplit = function(id, type) { const item = currentProducts.find(p => p.id === id); if (item) { item.split = type; if (type !== 'other') item.otherName = ''; } window.renderProducts(); };
window.setOtherName = function(id, name) { const item = currentProducts.find(p => p.id === id); if (item) item.otherName = name; window.renderSummary(); };

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
  const names = getNames(); const { himC, herC, otherC } = calcTotals(currentProducts); const coupleC = himC + herC;
  const pills = [ { label: names.him, value: fmt(fromCents(himC)), color: 'var(--him)' }, { label: names.her, value: fmt(fromCents(herC)), color: 'var(--her)' }, { label: 'Casal', value: fmt(fromCents(coupleC)), color: 'var(--both)' }, otherC > 0 ? { label: 'Terceiros', value: fmt(fromCents(otherC)), color: 'var(--other)' } : null ].filter(Boolean);
  document.getElementById('summary-row').innerHTML = pills.map(p => `<div class="summary-pill"><div class="pill-label">${p.label}</div><div class="pill-value" style="color:${p.color}">${p.value}</div></div>`).join('');
};

window.saveReceipt = async function() {
  if (isSaving) return;
  if (currentProducts.length === 0) { window.showToast('⚠️ Nenhum produto!'); return; }
  isSaving = true;
  const names = getNames(); const { himC, herC, otherC } = calcTotals(currentProducts);
  const receipt = {
    id: Date.now(), store: document.getElementById('meta-store').value.trim() || 'Sem nome', date: document.getElementById('meta-date').value || today(),
    payer: document.getElementById('meta-payer').value || 'him', method: document.getElementById('meta-method').value.trim(), category: document.getElementById('meta-category').value || 'outros', status: 'open',
    cycle: 'current', 
    items: currentProducts.map(p => ({ ...p })), himCents: himC, herCents: herC, otherCents: otherC, coupleCents: himC + herC, totalCents: himC + herC + otherC,
    imageBase64: currentBase64, imageMime: currentMime, names: { him: names.him, her: names.her }, createdAt: Date.now()
  };
  const ok = await addReceiptToCloud(receipt);
  if (ok) { window.resetUpload(); window.populateCycleSelects(); window.renderHistory(); window.showToast('✅ Cupom salvo!'); }
  isSaving = false;
};

// ── RENDERIZAÇÃO DE HISTÓRICO E RELATÓRIO ──
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
    const list = allReceipts.filter(r => !r.scope && r.cycle && r.cycle !== 'current');
    const cycles = [...new Set(list.map(r => r.cycle))]; 
    ['filter-cycle', 'report-cycle'].forEach(sid => {
      const sel = document.getElementById(sid); if (!sel) return;
      const first = sel.options[0].cloneNode(true); sel.innerHTML = ''; sel.appendChild(first);
      cycles.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = "📁 " + c; sel.appendChild(opt);
      });
    });
  } catch(e) { console.error(e); }
};

window.renderHistory = function() {
  try {
    const cycle = document.getElementById('filter-cycle')?.value || 'current';
    const person = document.getElementById('filter-person')?.value || '';
    const category = document.getElementById('filter-category')?.value || '';
    const searchRaw = document.getElementById('history-search')?.value.trim().toLowerCase() || '';
    
    let list = allReceipts.filter(r => !r.scope);
    
    if (cycle === 'current') {
       list = list.filter(r => !r.cycle || r.cycle === 'current');
    } else {
       list = list.filter(r => r.cycle === cycle);
    }
    
    if (person === 'him') list = list.filter(r => r.type === 'settlement' ? r.payer === 'him' : r.himCents > 0);
    if (person === 'her') list = list.filter(r => r.type === 'settlement' ? r.payer === 'her' : r.herCents > 0);
    if (category) list = list.filter(r => r.type !== 'settlement' && (r.category || 'outros') === category);
    
    // Filtro de busca por texto
    if (searchRaw) {
      list = list.filter(r => {
        const storeMatch = (r.store || '').toLowerCase().includes(searchRaw);
        const itemMatch = r.items && r.items.some(i => (i.name || '').toLowerCase().includes(searchRaw));
        return storeMatch || itemMatch;
      });
    }
    
    list.sort((a, b) => b.date.localeCompare(a.date));

    const container = document.getElementById('history-list');
    if (!list.length) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><p>Nenhum lançamento nesta fatura.</p></div>`;
      return;
    }

    container.innerHTML = list.map((r, idx) => {
      const names = r.names || getNames();
      const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const fid = r._fireId;

      if (r.type === 'settlement') {
        const payerName = r.payer === 'him' ? names.him : names.her;
        const color = r.payer === 'him' ? 'var(--him)' : 'var(--her)';
        return `<div class="receipt-card" style="animation-delay:${idx * 0.04}s; border-color:${color};">
          <div class="receipt-head" style="align-items:center;">
            <div>
              <div class="receipt-store" style="color:${color}">${r.store}</div>
              <div class="receipt-date">${dateStr} • Por ${payerName}</div>
            </div>
            <div style="font-weight:900; font-size:1.1rem; color:${color};">${fmt(fromCents(r.amountCents))}</div>
          </div>
          <div style="padding: 0 1.25rem 1rem 1.25rem; text-align:right;">
             <button class="btn-ghost" style="border:none; padding:0.2rem; font-size:0.75rem; color:var(--muted);" onclick="window.deleteReceipt('${fid}')">🗑️ Apagar Pix</button>
          </div>
        </div>`;
      }

      const himC = r.himCents || 0; const herC = r.herCents || 0; const otherC = r.otherCents || 0;
      const isPaid = r.status === 'paid';
      const payerName = r.payer === 'him' ? names.him : (r.payer === 'her' ? names.her : '');
      const methodStr = r.method ? ` (${r.method})` : '';
      const cat = catLabel(r.category || 'outros');
      const statusBadge = isPaid ? `<span class="item-badge badge-both">✅ PAGO</span>` : `<span class="item-badge badge-other">⏳ ABERTO</span>`;

      const itemRows = r.items.map(item => {
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

window.renderReport = function() {
  try {
    const cycle = document.getElementById('report-cycle')?.value || 'current';
    let list = allReceipts.filter(r => !r.scope);
    if (cycle === 'current') {
       list = list.filter(r => !r.cycle || r.cycle === 'current');
    } else {
       list = list.filter(r => r.cycle === cycle);
    }

    const container = document.getElementById('report-content');
    const names = getNames();

    let runningBalanceCents = 0; 
    let thirdPartyDebts = { him: {}, her: {} };
    let himC = 0, herC = 0, otherC = 0;
    const storeMap = {}; const categoryMap = {};

    list.forEach(r => {
      if (r.type === 'settlement') {
        if (r.payer === 'him') runningBalanceCents += r.amountCents;
        else if (r.payer === 'her') runningBalanceCents -= r.amountCents;
      } else {
        const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
        const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
        const rOtherC = r.otherCents !== undefined ? r.otherCents : cents(r.otherTotal || 0);
        
        himC += rHimC; herC += rHerC; otherC += rOtherC;
        if (!storeMap[r.store]) storeMap[r.store] = { himC: 0, herC: 0 };
        storeMap[r.store].himC += rHimC; storeMap[r.store].herC += rHerC;
        const cat = r.category || 'outros';
        if (!categoryMap[cat]) categoryMap[cat] = 0;
        categoryMap[cat] += rHimC + rHerC + rOtherC;

        if (r.status !== 'paid') {
          if (r.payer === 'him') {
            runningBalanceCents += rHerC; 
            if (r.items) r.items.filter(i => i.split === 'other').forEach(i => {
              const n = i.otherName || 'Alguém';
              thirdPartyDebts.him[n] = (thirdPartyDebts.him[n] || 0) + (i.priceCents || cents(i.price));
            });
          } else if (r.payer === 'her') {
            runningBalanceCents -= rHimC;
            if (r.items) r.items.filter(i => i.split === 'other').forEach(i => {
              const n = i.otherName || 'Alguém';
              thirdPartyDebts.her[n] = (thirdPartyDebts.her[n] || 0) + (i.priceCents || cents(i.price));
            });
          }
        }
      }
    });

    let settlementHTML = '';
    if (runningBalanceCents > 0) {
      settlementHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--both)"><div class="card-header" style="color:var(--both)">🤝 Acerto (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center"><div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.her} deve pagar para ${names.him}</div><div style="font-size:2rem;font-weight:900;color:var(--both);letter-spacing:-1px">${fmt(fromCents(runningBalanceCents))}</div></div></div>`;
    } else if (runningBalanceCents < 0) {
      settlementHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--her)"><div class="card-header" style="color:var(--her)">🤝 Acerto (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center"><div style="font-size:0.85rem;color:var(--muted2);margin-bottom:0.4rem">${names.him} deve pagar para ${names.her}</div><div style="font-size:2rem;font-weight:900;color:var(--her);letter-spacing:-1px">${fmt(fromCents(Math.abs(runningBalanceCents)))}</div></div></div>`;
    } else {
      settlementHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🤝 Acerto (Nesta Fatura)</div><div style="padding:1.25rem;text-align:center;font-weight:700;color:var(--both)">Tudo quite nesta fatura! ✅</div></div>`;
    }

    let listGastos = list.filter(r => r.type !== 'settlement' && r.type !== 'rollover');

    if (!listGastos.length && runningBalanceCents === 0) {
      container.innerHTML = `${settlementHTML}<div class="empty"><div class="empty-icon">📊</div><p>Nenhum dado nesta fatura.</p></div>`;
      return;
    }

    const coupleC = himC + herC; const grandC = coupleC + otherC;
    const himPct = coupleC > 0 ? Math.round(himC / coupleC * 100) : 0; const herPct = 100 - himPct;

    let thirdPartyHTML = ''; let hasDebts = false; let debtsRows = '';
    Object.entries(thirdPartyDebts.him).forEach(([name, amount]) => { hasDebts = true; debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.him})</small></span><span style="color:var(--him);font-weight:800">${fmt(fromCents(amount))}</span></div>`; });
    Object.entries(thirdPartyDebts.her).forEach(([name, amount]) => { hasDebts = true; debtsRows += `<div class="store-row"><span>${name} <small style="color:var(--muted2)">(deve a ${names.her})</small></span><span style="color:var(--her);font-weight:800">${fmt(fromCents(amount))}</span></div>`; });
    if (hasDebts) { thirdPartyHTML = `<div class="card" style="margin-bottom:1rem;border-color:var(--other)"><div class="card-header" style="color:var(--other)">👥 A Receber de Terceiros (Em Aberto)</div><div style="padding:0 1.25rem">${debtsRows}</div></div>`; }

    let goalHTML = '';
    if (appSettings.monthlyGoal > 0) {
      const pct = Math.min(100, Math.round(coupleC / appSettings.monthlyGoal * 100));
      const color = pct >= 100 ? 'var(--her)' : pct >= 80 ? 'var(--other)' : 'var(--both)';
      goalHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🎯 Meta da Fatura</div><div class="goal-bar-wrap"><div class="goal-bar-labels"><span>${fmt(fromCents(coupleC))} gastos</span><span style="color:${color};font-weight:800">${pct}%</span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div></div><div style="font-size:0.72rem;color:var(--muted2);margin-top:0.4rem">Meta: ${fmt(fromCents(appSettings.monthlyGoal))}</div></div></div>`;
    }

    const statsHTML = `<div class="stat-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-label">${names.him} consumiu</div><div class="stat-value" style="color:var(--him)">${fmt(fromCents(himC))}</div></div>
      <div class="stat-card"><div class="stat-label">${names.her} consumiu</div><div class="stat-value" style="color:var(--her)">${fmt(fromCents(herC))}</div></div>
      <div class="stat-card"><div class="stat-label">Total do casal</div><div class="stat-value" style="color:var(--both)">${fmt(fromCents(coupleC))}</div></div>
      ${otherC > 0 ? `<div class="stat-card"><div class="stat-label">Terceiros</div><div class="stat-value" style="color:var(--other)">${fmt(fromCents(otherC))}</div></div>` : `<div class="stat-card"><div class="stat-label">Contas</div><div class="stat-value">${listGastos.length}</div></div>`}
    </div>`;

    const donutSegs = [ { value: himC, color: 'var(--him)', label: names.him, val: fmt(fromCents(himC)) }, { value: herC, color: 'var(--her)', label: names.her, val: fmt(fromCents(herC)) } ];
    if (otherC > 0) donutSegs.push({ value: otherC, color: 'var(--other)', label: 'Terceiros', val: fmt(fromCents(otherC)) });
    const donutHTML = `<div class="card" style="margin-bottom:1rem"><div class="card-header">🍩 Proporção de gastos</div><div class="donut-wrap">${buildDonutSVG(donutSegs)}<div class="donut-legend">${donutSegs.map(s => `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${s.color}"></div><span class="donut-legend-label">${s.label}</span><span class="donut-legend-value" style="color:${s.color}">${s.val}</span></div>`).join('')}<div class="donut-legend-item" style="margin-top:0.25rem;padding-top:0.5rem;border-top:1px solid var(--border)"><span class="donut-legend-label">Proporção</span><span class="donut-legend-value" style="color:var(--muted2)">${himPct}% / ${herPct}%</span></div></div></div></div>`;

    const catRows = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
      const pctBar = grandC > 0 ? Math.round(val / grandC * 100) : 0;
      return `<div class="cat-row"><span style="min-width:100px;font-size:0.82rem;font-weight:600">${catLabel(cat)}</span><div class="cat-row-bar"><div class="cat-row-fill" style="width:${pctBar}%"></div></div><span class="cat-row-value">${fmt(fromCents(val))}</span></div>`;
    }).join('');
    const categoryHTML = grandC > 0 ? `<div class="card" style="margin-bottom:1rem"><div class="card-header">📂 Gastos por categoria</div><div style="padding:0.5rem 1.25rem">${catRows}</div></div>` : '';

    const storeRows = Object.entries(storeMap).sort((a, b) => (b[1].himC + b[1].herC) - (a[1].himC + a[1].herC)).slice(0, 8).map(([store, v]) => `<div class="store-row"><span class="store-name">${store}</span><div class="store-amounts"><span style="color:var(--him)">${fmt(fromCents(v.himC))}</span><span style="color:var(--her)">${fmt(fromCents(v.herC))}</span></div></div>`).join('');
    const receiptRows = [...listGastos].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
      const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0); const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
      const d = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `<div class="store-row" style="${r.status === 'paid' ? 'opacity:0.6' : ''}"><span>${d} — ${r.store} <span class="category-badge">${catLabel(r.category || 'outros')}</span></span><div class="store-amounts"><span style="color:var(--him)">${fmt(fromCents(rHimC))}</span><span style="color:var(--her)">${fmt(fromCents(rHerC))}</span></div></div>`;
    }).join('');

    const exportBtn = `<div style="margin-bottom:1rem;display:flex;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="window.exportCSV()">📥 Exportar CSV desta Fatura</button></div>`;

    container.innerHTML = `
      ${settlementHTML}
      ${thirdPartyHTML}
      ${goalHTML}
      ${statsHTML}
      ${donutHTML}
      ${categoryHTML}
      <div class="card" style="margin-bottom:1rem"><div class="card-header">🏪 Onde vocês mais gastaram</div><div style="padding:0 1.25rem">${storeRows}</div></div>
      <div class="card" style="margin-bottom:1rem"><div class="card-header">🧾 ${listGastos.length} contas na fatura</div><div style="padding:0 1.25rem">${receiptRows}</div></div>
      ${exportBtn}
    `;
  } catch (error) { console.error(error); }
};

window.exportCSV = function() {
  try {
    const cycle = document.getElementById('report-cycle')?.value || 'current';
    let list = allReceipts.filter(r => !r.scope && r.type !== 'settlement');
    if (cycle === 'current') list = list.filter(r => !r.cycle || r.cycle === 'current');
    else list = list.filter(r => r.cycle === cycle);

    if (!list.length) { window.showToast('⚠️ Nenhum dado para exportar.'); return; }

    const names = getNames();
    const rows = [['Data', 'Estabelecimento', 'Categoria', 'Pago por', 'Forma', names.him, names.her, 'Terceiros', 'Total', 'Status']];
    list.forEach(r => {
      const himC = r.himCents || 0; const herC = r.herCents || 0; const othC = r.otherCents || 0;
      rows.push([
        r.date, r.store, catLabel(r.category || 'outros'), r.payer === 'him' ? names.him : names.her, r.method || '',
        fromCents(himC).toFixed(2), fromCents(herC).toFixed(2), fromCents(othC).toFixed(2), fromCents(himC + herC + othC).toFixed(2),
        r.status === 'paid' ? 'Pago' : 'Em Aberto'
      ]);
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `gastos_casal_${cycle}.csv`; a.click(); URL.revokeObjectURL(url);
    window.showToast('📥 CSV exportado!');
  } catch(e) { console.error(e); }
};

checkAuthAndBoot();