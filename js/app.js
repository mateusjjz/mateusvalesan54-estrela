/**
 * SISTEMA DE COMPENSAÇÃO DE HORÁRIO
 * Prefeitura Municipal de Lajeado - Secretaria da Educação
 * Interface Full-Width com Menu Lateral e HUD Flutuante de Lançamento
 */

// Chaves e Autenticação
const STORAGE_SERVERS_KEY = 'smed_banco_horas_servidores';
const STORAGE_RECORDS_KEY = 'smed_banco_horas_registros';
const STORAGE_ACTIVE_KEY = 'smed_banco_horas_ativo';
const STORAGE_CLEARED_FLAG = 'smed_banco_horas_clean_v1';
const STORAGE_SESSION_USER = 'smed_banco_horas_logged_user';

// Usuários Cadastrados
const AUTH_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'admin',
    role: 'ADMIN' // Administrador: visualiza e gerencia todas as matrículas
  },
  {
    username: 'simone',
    password: 'simone123',
    name: 'Simone',
    role: 'SERVER', // Usuário de cargo normal: acesso apenas à sua matrícula
    serverId: 'servidor_simone'
  }
];

let currentUser = null;

// Servidores Padrão
const DEFAULT_SERVERS = [
  {
    id: 'servidor_simone',
    nome: 'Simone',
    matricula: '5120',
    emei: 'PRIMEIROS PASSOS',
    ano: '2026',
    cargo: 'Professora / Servidora',
    lancadoPor: 'Diretoria / Coordenação',
    dataLancamento: new Date().toISOString().split('T')[0]
  },
  {
    id: 'servidor_franciele',
    nome: 'Franciele',
    matricula: '4820',
    emei: 'PRIMEIROS PASSOS',
    ano: '2026',
    cargo: 'Professora / Servidora',
    lancadoPor: 'Diretoria / Coordenação',
    dataLancamento: new Date().toISOString().split('T')[0]
  }
];

// Registros Padrão: Vazio
const DEFAULT_RECORDS = [];

// Estado da Aplicação
let appState = {
  servers: [],
  records: [],
  activeServerId: 'servidor_simone',
  currentView: 'registrar',
  dashboardTab: 'side-by-side'
};

// ==========================================================================
// UTILITÁRIOS DE HORAS E MINUTOS
// ==========================================================================

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

function minutesToHHMM(totalMinutes, showSign = false) {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  
  if (showSign) {
    if (isNegative) return `-${formatted}`;
    if (totalMinutes > 0) return `+${formatted}`;
  }
  return formatted;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function calculateDiffMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end >= start) {
    return end - start;
  }
  return (24 * 60 - start) + end;
}

// ==========================================================================
// PERSISTÊNCIA LOCAL (LOCALSTORAGE)
// ==========================================================================

function loadState() {
  try {
    if (!localStorage.getItem(STORAGE_CLEARED_FLAG)) {
      localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_CLEARED_FLAG, 'true');
    }

    const savedServers = localStorage.getItem(STORAGE_SERVERS_KEY);
    const savedRecords = localStorage.getItem(STORAGE_RECORDS_KEY);
    const savedActive = localStorage.getItem(STORAGE_ACTIVE_KEY);

    if (savedServers) {
      appState.servers = JSON.parse(savedServers);
      // Garante que Simone e Franciele existem na lista
      DEFAULT_SERVERS.forEach(ds => {
        if (!appState.servers.find(s => s.id === ds.id)) {
          appState.servers.push(ds);
        }
      });
    } else {
      appState.servers = [...DEFAULT_SERVERS];
    }

    if (savedRecords) {
      appState.records = JSON.parse(savedRecords);
    } else {
      appState.records = [];
    }

    appState.activeServerId = savedActive || 'servidor_simone';
  } catch (err) {
    console.error('Erro ao ler LocalStorage:', err);
    appState.servers = [...DEFAULT_SERVERS];
    appState.records = [];
    appState.activeServerId = 'servidor_simone';
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_SERVERS_KEY, JSON.stringify(appState.servers));
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(appState.records));
    if (appState.activeServerId) {
      localStorage.setItem(STORAGE_ACTIVE_KEY, appState.activeServerId);
    }
  } catch (err) {
    console.error('Erro ao salvar no LocalStorage:', err);
  }
}

function getActiveServer() {
  return appState.servers.find(s => s.id === appState.activeServerId) || appState.servers[0] || DEFAULT_SERVERS[0];
}

function getActiveRecords() {
  return appState.records.filter(r => r.serverId === appState.activeServerId);
}

// ==========================================================================
// AUTENTICAÇÃO E PERMISSÕES (ADMIN VS SERVIDORA)
// ==========================================================================

function checkSession() {
  const savedUser = sessionStorage.getItem(STORAGE_SESSION_USER);
  const loginOverlay = document.getElementById('loginScreen');

  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      // Mantém dados sincronizados com AUTH_USERS (como o nome 'admin')
      const freshUser = AUTH_USERS.find(u => u.username.toLowerCase() === (currentUser.username || '').toLowerCase());
      if (freshUser) {
        currentUser = freshUser;
        sessionStorage.setItem(STORAGE_SESSION_USER, JSON.stringify(currentUser));
      }
      if (loginOverlay) loginOverlay.style.display = 'none';
      applyUserPermissions();
      renderUI();
    } catch (e) {
      currentUser = null;
      if (loginOverlay) loginOverlay.style.display = 'flex';
    }
  } else {
    currentUser = null;
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPassword');
  const toggleBtn = document.getElementById('btnTogglePassword');
  if (!pwdInput || !toggleBtn) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    toggleBtn.textContent = '🙈';
    toggleBtn.title = 'Ocultar senha';
  } else {
    pwdInput.type = 'password';
    toggleBtn.textContent = '👁️';
    toggleBtn.title = 'Mostrar senha';
  }
}

function handleLoginFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const errorMsg = document.getElementById('loginErrorMsg');

  if (!usernameInput || !passwordInput) return false;

  const u = (usernameInput.value || '').trim().toLowerCase();
  const p = (passwordInput.value || '').trim();

  // Permite login com ou sem Caps Lock para maior comodidade
  const found = AUTH_USERS.find(user => 
    user.username.toLowerCase() === u && 
    (user.password === p || user.password.toLowerCase() === p.toLowerCase())
  );

  if (found) {
    currentUser = found;
    sessionStorage.setItem(STORAGE_SESSION_USER, JSON.stringify(currentUser));
    if (errorMsg) errorMsg.style.display = 'none';
    
    // Se for Simone, direciona obrigatoriamente para a matrícula dela
    if (currentUser.role === 'SERVER') {
      appState.activeServerId = 'servidor_simone';
      saveState();
    }

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    
    usernameInput.value = '';
    passwordInput.value = '';
    
    applyUserPermissions();
    renderUI();
    return true;
  } else {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = '⚠️ Usuário ou senha incorretos. Verifique suas credenciais.';
    }
    return false;
  }
}

function handleLogout() {
  if (confirm('Deseja realmente sair do sistema?')) {
    sessionStorage.removeItem(STORAGE_SESSION_USER);
    currentUser = null;
    const loginOverlay = document.getElementById('loginScreen');
    if (loginOverlay) loginOverlay.style.display = 'flex';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginErrorMsg').style.display = 'none';
  }
}

function applyUserPermissions() {
  if (!currentUser) return;

  const adminBar = document.getElementById('adminServerBar');
  const roleBadge = document.getElementById('sidebarRoleBadge');
  const matAddWrap = document.getElementById('matAddServerWrap');
  const matSelectWrap = document.getElementById('matSelectServerWrap');

  if (currentUser.role === 'ADMIN') {
    // ADMIN: Visualiza e gerencia todas as matrículas
    if (adminBar) {
      adminBar.style.display = 'block';
      populateAdminServerSelect();
    }
    if (roleBadge) {
      roleBadge.textContent = '👑 Administrador';
      roleBadge.style.background = '#fef3c7';
      roleBadge.style.color = '#92400e';
      roleBadge.style.borderColor = '#fde68a';
    }
    if (matAddWrap) matAddWrap.style.display = 'block';
    if (matSelectWrap) matSelectWrap.style.display = 'block';
  } else {
    // SERVIDORA (Simone): Usuário de cargo normal - visualiza apenas sua própria matrícula
    appState.activeServerId = 'servidor_simone';
    saveState();

    if (adminBar) adminBar.style.display = 'none';
    if (roleBadge) {
      roleBadge.textContent = 'Cargo Normal';
      roleBadge.style.background = '#e0f2fe';
      roleBadge.style.color = '#0369a1';
      roleBadge.style.borderColor = '#bae6fd';
    }
    if (matAddWrap) matAddWrap.style.display = 'none';
    if (matSelectWrap) matSelectWrap.style.display = 'none';
  }
}

function populateAdminServerSelect() {
  const adminSelect = document.getElementById('adminSelectServer');
  if (!adminSelect) return;
  adminSelect.innerHTML = '';
  appState.servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nome} - Matrícula ${s.matricula || '-'} (${s.emei || 'EMEI'})`;
    if (s.id === appState.activeServerId) opt.selected = true;
    adminSelect.appendChild(opt);
  });
}

function changeActiveServerAsAdmin(serverId) {
  if (!currentUser || currentUser.role !== 'ADMIN') return;
  appState.activeServerId = serverId;
  saveState();
  renderUI();
}

// Limpar todos os registros do servidor ativo
function clearAllRecords() {
  if (confirm('Tem certeza de que deseja LIMPAR TODOS OS REGISTROS DE HORAS deste servidor? Esta ação não pode ser desfeita.')) {
    appState.records = appState.records.filter(r => r.serverId !== appState.activeServerId);
    saveState();
    renderUI();
    alert('Todos os registros de horas foram apagados com sucesso!');
  }
}

// ==========================================================================
// CÁLCULOS TOTAIS
// ==========================================================================

function calculateTotals() {
  const records = getActiveRecords();
  let totalWorkedMins = 0;
  let totalTakenMins = 0;

  records.forEach(rec => {
    if (rec.type === 'WORKED') {
      totalWorkedMins += rec.durationMinutes || 0;
    } else if (rec.type === 'TAKEN') {
      totalTakenMins += rec.durationMinutes || 0;
    }
  });

  const balanceMins = totalWorkedMins - totalTakenMins;
  const compensationPercent = totalWorkedMins > 0 ? Math.min(100, Math.round((totalTakenMins / totalWorkedMins) * 100)) : 0;

  return {
    workedMins: totalWorkedMins,
    takenMins: totalTakenMins,
    balanceMins: balanceMins,
    workedHHMM: minutesToHHMM(totalWorkedMins),
    takenHHMM: minutesToHHMM(totalTakenMins),
    balanceHHMM: minutesToHHMM(Math.abs(balanceMins)),
    isPositive: balanceMins >= 0,
    percent: compensationPercent
  };
}

// ==========================================================================
// NAVEGAÇÃO ENTRE AS PÁGINAS (MENU LATERAL)
// ==========================================================================

function navigateTo(viewName) {
  appState.currentView = viewName;

  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  renderUI();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-open');
}

// ==========================================================================
// HUD DE LANÇAMENTO (FORMULÁRIO MODAL FLUTUANTE)
// ==========================================================================

let activeRecordType = 'WORKED'; // 'WORKED' ou 'TAKEN'

// Popula os seletores de Hora e Minuto
function populateTimeDropdowns() {
  const startHour = document.getElementById('startHour');
  const startMinute = document.getElementById('startMinute');
  const endHour = document.getElementById('endHour');
  const endMinute = document.getElementById('endMinute');

  if (!startHour || !startMinute || !endHour || !endMinute) return;

  // Horas de 00h a 23h
  let hoursHtml = '<option value="" disabled selected>Hora (HH)</option>';
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    hoursHtml += `<option value="${hh}">${hh}h</option>`;
  }
  startHour.innerHTML = hoursHtml;
  endHour.innerHTML = hoursHtml;

  // Minutos de 00 min a 59 min
  let minsHtml = '<option value="" disabled selected>Minuto (MM)</option>';
  for (let m = 0; m < 60; m++) {
    const mm = String(m).padStart(2, '0');
    minsHtml += `<option value="${mm}">${mm} min</option>`;
  }
  startMinute.innerHTML = minsHtml;
  endMinute.innerHTML = minsHtml;
}

function onStartHourChanged() {
  const startMinute = document.getElementById('startMinute');
  if (startMinute && !startMinute.value) {
    startMinute.value = '00';
  }
  updateHudCalcPreview();
  if (startMinute) startMinute.focus();
}

function onEndHourChanged() {
  const endMinute = document.getElementById('endMinute');
  if (endMinute && !endMinute.value) {
    endMinute.value = '00';
  }
  updateHudCalcPreview();
  if (endMinute) endMinute.focus();
}

function openEntryHud(type = 'WORKED', editId = null) {
  const hud = document.getElementById('entryHudModal');
  const hudTitle = document.getElementById('hudTitleText');
  const submitBtn = document.getElementById('hudSubmitBtn');
  const editInput = document.getElementById('hudEditRecordId');

  activeRecordType = type;

  if (editId) {
    const record = appState.records.find(r => r.id === editId);
    if (!record) return;

    editInput.value = record.id;
    activeRecordType = record.type;
    document.getElementById('hudRecordDate').value = record.date;

    const [sH, sM] = (record.startTime || '00:00').split(':');
    const [eH, eM] = (record.endTime || '00:00').split(':');
    document.getElementById('startHour').value = sH || '';
    document.getElementById('startMinute').value = sM || '';
    document.getElementById('endHour').value = eH || '';
    document.getElementById('endMinute').value = eM || '';

    document.getElementById('hudRecordJustification').value = record.justification || '';
    
    hudTitle.textContent = '✏️ Editar Lançamento de Horário';
    submitBtn.textContent = '💾 Salvar Alterações';
  } else {
    editInput.value = '';
    document.getElementById('hudRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('startHour').value = '';
    document.getElementById('startMinute').value = '';
    document.getElementById('endHour').value = '';
    document.getElementById('endMinute').value = '';
    document.getElementById('hudRecordJustification').value = '';
    
    hudTitle.textContent = '➕ Lançamento de Horário';
    submitBtn.textContent = '➕ Adicionar Horário';
  }

  updateHudToggleState();
  updateHudCalcPreview();

  hud.classList.add('active');
}

function closeEntryHud() {
  const hud = document.getElementById('entryHudModal');
  if (hud) hud.classList.remove('active');
}

function updateHudToggleState() {
  const typeWorkedBtn = document.getElementById('hudBtnTypeWorked');
  const typeTakenBtn = document.getElementById('hudBtnTypeTaken');
  const justifGroup = document.getElementById('hudJustificationGroup');
  const justifInput = document.getElementById('hudRecordJustification');

  if (activeRecordType === 'WORKED') {
    typeWorkedBtn.className = 'type-toggle-btn active type-worked';
    typeTakenBtn.className = 'type-toggle-btn';
    justifGroup.style.display = 'block';
    justifInput.required = true;
  } else {
    typeTakenBtn.className = 'type-toggle-btn active type-taken';
    typeWorkedBtn.className = 'type-toggle-btn';
    justifGroup.style.display = 'none';
    justifInput.required = false;
  }
}

function selectHudType(type) {
  activeRecordType = type;
  updateHudToggleState();
  updateHudCalcPreview();
}

function selectHudJustification(text) {
  document.getElementById('hudRecordJustification').value = text;
}

function updateHudCalcPreview() {
  const sH = document.getElementById('startHour')?.value;
  const sM = document.getElementById('startMinute')?.value;
  const eH = document.getElementById('endHour')?.value;
  const eM = document.getElementById('endMinute')?.value;
  const calcBox = document.getElementById('hudCalcPreview');

  if (sH && sM && eH && eM) {
    const diff = calculateDiffMinutes(`${sH}:${sM}`, `${eH}:${eM}`);
    const isTaken = activeRecordType === 'TAKEN';
    calcBox.textContent = (isTaken ? '-' : '+') + minutesToHHMM(diff);
    calcBox.style.color = isTaken ? '#dc2626' : 'var(--primary-700)';
  } else {
    calcBox.textContent = '00:00';
    calcBox.style.color = 'var(--primary-700)';
  }
}

function saveHudEntry(e) {
  e.preventDefault();

  const date = document.getElementById('hudRecordDate').value;
  const sH = document.getElementById('startHour').value;
  const sM = document.getElementById('startMinute').value;
  const eH = document.getElementById('endHour').value;
  const eM = document.getElementById('endMinute').value;
  const justification = document.getElementById('hudRecordJustification').value;
  const editId = document.getElementById('hudEditRecordId').value;

  if (!date || !sH || !sM || !eH || !eM) {
    alert('Por favor, selecione primeiro a hora e depois o minuto tanto para o início quanto para o término.');
    return;
  }

  const startTime = `${sH}:${sM}`;
  const endTime = `${eH}:${eM}`;

  const durationMinutes = calculateDiffMinutes(startTime, endTime);
  if (durationMinutes <= 0) {
    alert('O horário de término deve ser diferente do horário de início.');
    return;
  }

  if (editId) {
    const index = appState.records.findIndex(r => r.id === editId);
    if (index !== -1) {
      appState.records[index] = {
        ...appState.records[index],
        type: activeRecordType,
        date,
        startTime,
        endTime,
        durationMinutes,
        justification: activeRecordType === 'WORKED' ? (justification || 'Auxílio a pedido') : 'Compensação de horas'
      };
    }
  } else {
    const newRecord = {
      id: 'rec_' + Date.now(),
      serverId: appState.activeServerId,
      type: activeRecordType,
      date,
      startTime,
      endTime,
      durationMinutes,
      justification: activeRecordType === 'WORKED' ? (justification || 'Auxílio a pedido') : 'Compensação de horas'
    };
    appState.records.push(newRecord);
  }

  saveState();
  closeEntryHud();
  renderUI();
}

function editRecord(id) {
  openEntryHud('WORKED', id);
}

function deleteRecord(id) {
  if (confirm('Tem certeza de que deseja excluir este lançamento?')) {
    appState.records = appState.records.filter(r => r.id !== id);
    saveState();
    renderUI();
  }
}

// ==========================================================================
// RENDERIZAÇÃO GERAL
// ==========================================================================

function renderUI() {
  renderSidebarProfile();
  renderDashboard();
  renderRegisterView();
  renderMatriculaView();
}

function renderSidebarProfile() {
  const avatar = document.getElementById('sidebarAvatar');
  const nameElem = document.getElementById('sidebarName');
  const subElem = document.getElementById('sidebarMatricula');
  const roleBadge = document.getElementById('sidebarRoleBadge');

  if (currentUser && currentUser.role === 'ADMIN') {
    if (avatar) avatar.textContent = 'AD';
    if (nameElem) nameElem.textContent = 'admin';
    const server = getActiveServer();
    if (subElem) {
      subElem.textContent = 'Administrador';
      subElem.title = `Visualizando matrícula: ${server.nome} (${server.matricula || '-'})`;
    }
    if (roleBadge) {
      roleBadge.textContent = '👑 Administrador';
      roleBadge.style.background = '#fef3c7';
      roleBadge.style.color = '#92400e';
      roleBadge.style.borderColor = '#fde68a';
    }
  } else {
    // Usuário de cargo normal (Simone)
    const server = getActiveServer();
    const initials = (currentUser?.name || server.nome || 'SI').substring(0, 2).toUpperCase();

    if (avatar) avatar.textContent = initials;
    if (nameElem) nameElem.textContent = currentUser?.name || server.nome || 'Simone';
    if (subElem) subElem.textContent = `Matrícula: ${server.matricula || '-'}`;
    if (roleBadge) {
      roleBadge.textContent = 'Cargo Normal';
      roleBadge.style.background = '#e0f2fe';
      roleBadge.style.color = '#0369a1';
      roleBadge.style.borderColor = '#bae6fd';
    }
  }
}

// ==========================================================================
// TELA 1: DASHBOARD
// ==========================================================================

function renderDashboard() {
  const server = getActiveServer();
  const totals = calculateTotals();
  const activeRecs = getActiveRecords();

  document.getElementById('dashBannerName').textContent = server.nome || 'Servidor';
  document.getElementById('dashBannerMatricula').textContent = `Matrícula: ${server.matricula || '-'}`;
  document.getElementById('dashBannerEmei').textContent = `EMEI: ${server.emei || '-'}`;
  document.getElementById('dashBannerAno').textContent = `Ano: ${server.ano || '2026'}`;

  document.getElementById('dashWorkedHours').textContent = totals.workedHHMM;
  document.getElementById('dashTakenHours').textContent = totals.takenHHMM;

  const balanceCard = document.getElementById('dashBalanceCard');
  const balanceValue = document.getElementById('dashBalanceHours');
  const balanceBadge = document.getElementById('dashBalanceBadge');

  balanceValue.textContent = totals.balanceHHMM;

  if (totals.balanceMins > 0) {
    balanceCard.className = 'stat-card stat-card-balance positive';
    balanceBadge.textContent = 'Sobra de Horas (Crédito)';
  } else if (totals.balanceMins < 0) {
    balanceCard.className = 'stat-card stat-card-balance negative';
    balanceBadge.textContent = 'Horas a Compensar (Débito)';
  } else {
    balanceCard.className = 'stat-card stat-card-balance';
    balanceBadge.textContent = 'Horas Zeradas';
  }

  const countWorked = activeRecs.filter(r => r.type === 'WORKED').length;
  const countTaken = activeRecs.filter(r => r.type === 'TAKEN').length;

  document.getElementById('dashCountSide').textContent = Math.max(countWorked, countTaken);
  document.getElementById('dashCountWorked').textContent = countWorked;
  document.getElementById('dashCountTaken').textContent = countTaken;

  renderDashboardTable();
}

function renderDashboardTable() {
  const container = document.getElementById('dashTableContainer');
  const activeRecs = getActiveRecords();

  const workedList = activeRecs.filter(r => r.type === 'WORKED').sort((a, b) => a.date.localeCompare(b.date));
  const takenList = activeRecs.filter(r => r.type === 'TAKEN').sort((a, b) => a.date.localeCompare(b.date));

  if (appState.dashboardTab === 'side-by-side') {
    renderSideBySideTable(container, workedList, takenList);
  } else if (appState.dashboardTab === 'worked') {
    renderSingleTypeTable(container, workedList, 'WORKED');
  } else {
    renderSingleTypeTable(container, takenList, 'TAKEN');
  }
}

// ==========================================================================
// TELA 2: REGISTRAR HORAS (TELA CHEIA)
// ==========================================================================

function renderRegisterView() {
  const container = document.getElementById('registerFullTableContainer');
  const activeRecs = getActiveRecords();

  const sortedRecs = [...activeRecs].sort((a, b) => b.date.localeCompare(a.date));

  if (sortedRecs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-card">
          <div class="empty-state-icon">📝</div>
          <h3>Nenhum horário lançado</h3>
          <p>Ainda não há horários ou compensações lançados para este servidor.</p>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <table class="custom-table">
      <thead>
        <tr>
          <th style="width: 140px; white-space: nowrap;">TIPO</th>
          <th style="width: 140px; white-space: nowrap;">DATA</th>
          <th style="width: 170px; white-space: nowrap;">HORÁRIO</th>
          <th style="width: 130px; white-space: nowrap;">DURAÇÃO</th>
          <th>JUSTIFICATIVA / OBSERVAÇÃO</th>
          <th style="text-align:right; width: 120px; white-space: nowrap;">AÇÕES</th>
        </tr>
      </thead>
      <tbody>
  `;

  sortedRecs.forEach(rec => {
    const isWorked = rec.type === 'WORKED';
    const typeLabel = isWorked ? '🕒 Sobra' : '🗓️ Tirada';
    const typeBadgeStyle = isWorked 
      ? 'background:#dbeafe; color:#1e40af; border-color:#93c5fd;' 
      : 'background:#e0f2fe; color:#0369a1; border-color:#7dd3fc;';

    const formattedDuration = isWorked 
      ? `+${minutesToHHMM(rec.durationMinutes)}` 
      : `-${minutesToHHMM(rec.durationMinutes)}`;
    const durationClass = isWorked ? 'col-duration duration-worked' : 'col-duration duration-taken';
    const durationStyle = isWorked 
      ? 'white-space: nowrap; color: var(--primary-700); font-weight: 800;' 
      : 'white-space: nowrap; color: #dc2626; font-weight: 800;';

    html += `
      <tr>
        <td style="white-space: nowrap; width: 140px;"><span class="badge-tag" style="${typeBadgeStyle} white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">${typeLabel}</span></td>
        <td style="white-space: nowrap;"><strong>${formatDateBR(rec.date)}</strong></td>
        <td style="white-space: nowrap;">${rec.startTime} às ${rec.endTime}</td>
        <td class="${durationClass}" style="${durationStyle}">${formattedDuration}</td>
        <td>${rec.justification || '-'}</td>
        <td class="col-actions">
          <button class="action-btn" onclick="editRecord('${rec.id}')" title="Editar este lançamento">✏️</button>
          <button class="action-btn btn-delete" onclick="deleteRecord('${rec.id}')" title="Excluir este lançamento">🗑️</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ==========================================================================
// TELA 3: MINHA MATRÍCULA
// ==========================================================================

function renderMatriculaView() {
  const server = getActiveServer();
  const totals = calculateTotals();

  const initials = (server.nome || 'FR').substring(0, 2).toUpperCase();
  document.getElementById('matProfileAvatar').textContent = initials;
  document.getElementById('matProfileName').textContent = server.nome || 'Servidor';
  document.getElementById('matProfileSub').textContent = `Matrícula: ${server.matricula || '-'} • ${server.emei || 'EMEI'}`;

  document.getElementById('matMiniWorked').textContent = totals.workedHHMM;
  document.getElementById('matMiniTaken').textContent = totals.takenHHMM;
  document.getElementById('matMiniBalance').textContent = (totals.isPositive ? '+' : '-') + totals.balanceHHMM;

  document.getElementById('matInputNome').value = server.nome || '';
  document.getElementById('matInputMatricula').value = server.matricula || '';
  document.getElementById('matInputEmei').value = server.emei || '';
  document.getElementById('matInputAno').value = server.ano || '2026';
  document.getElementById('matInputCargo').value = server.cargo || 'Professora';
  document.getElementById('matInputLancador').value = server.lancadoPor || 'Diretoria / Coordenação';

  const selectElem = document.getElementById('matSelectServer');
  if (selectElem) {
    selectElem.innerHTML = '';
    appState.servers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.nome} - Matrícula ${s.matricula || '-'} (${s.emei || 'EMEI'})`;
      if (s.id === appState.activeServerId) opt.selected = true;
      selectElem.appendChild(opt);
    });
  }
}

function saveMatriculaProfile(e) {
  if (e) e.preventDefault();
  const server = getActiveServer();

  server.nome = document.getElementById('matInputNome').value.trim() || 'Servidor';
  server.matricula = document.getElementById('matInputMatricula').value.trim();
  server.emei = document.getElementById('matInputEmei').value.trim();
  server.ano = document.getElementById('matInputAno').value.trim() || '2026';
  server.cargo = document.getElementById('matInputCargo').value.trim();
  server.lancadoPor = document.getElementById('matInputLancador').value.trim();

  saveState();
  renderUI();

  const msg = document.getElementById('matSaveSuccessMsg');
  if (msg) {
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  }
}

function changeActiveServerFromMatricula(serverId) {
  appState.activeServerId = serverId;
  saveState();
  renderUI();
}

function addNewServerFromMatricula() {
  const nome = prompt('Digite o nome do novo Servidor(a):');
  if (!nome || !nome.trim()) return;

  const matricula = prompt('Digite a matrícula:', '') || '';
  const emei = prompt('Digite a EMEI ou Escola:', getActiveServer().emei || 'EMEI') || 'EMEI';
  const ano = prompt('Digite o Ano:', '2026') || '2026';

  const newServer = {
    id: 'server_' + Date.now(),
    nome: nome.trim(),
    matricula: matricula.trim(),
    emei: emei.trim(),
    ano: ano.trim(),
    cargo: 'Servidor(a)',
    lancadoPor: 'Diretoria / Coordenação',
    dataLancamento: new Date().toISOString().split('T')[0]
  };

  appState.servers.push(newServer);
  appState.activeServerId = newServer.id;
  saveState();
  renderUI();
}

// ==========================================================================
// RENDERIZAÇÃO DAS TABELAS DO DASHBOARD
// ==========================================================================

function renderSideBySideTable(container, workedList, takenList) {
  const maxRows = Math.max(workedList.length, takenList.length);

  if (maxRows === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-card">
          <div class="empty-state-icon">📋</div>
          <h3>Nenhum registro encontrado</h3>
          <p>Ainda não há lançamentos de compensação ou sobra de horas cadastrados nesta matrícula.</p>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <table class="custom-table table-side-by-side">
      <colgroup>
        <col style="width: 12%;">
        <col style="width: 14%;">
        <col style="width: 9%;">
        <col style="width: 15%;">
        <col style="width: 12%;">
        <col style="width: 14%;">
        <col style="width: 9%;">
        <col style="width: 15%;">
      </colgroup>
      <thead>
        <tr>
          <th colspan="4" style="background:#dbeafe; border-right:2px solid #93c5fd; text-align:center;">
            TURNO / HORÁRIO TRABALHADO (SOBRA)
          </th>
          <th colspan="4" style="background:#e0f2fe; text-align:center;">
            TURNO / HORÁRIO FALTANTE (TIRADO)
          </th>
        </tr>
        <tr>
          <th>Dia</th>
          <th>Horário</th>
          <th>Total</th>
          <th style="border-right:2px solid #93c5fd;">Justificativa</th>
          <th>Dia</th>
          <th>Horário</th>
          <th>Total</th>
          <th style="text-align: center;">Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < maxRows; i++) {
    const w = workedList[i];
    const t = takenList[i];

    html += `<tr>`;

    if (w) {
      html += `
        <td style="white-space: nowrap; vertical-align: middle;"><strong>${formatDateBR(w.date)}</strong></td>
        <td style="white-space: nowrap; vertical-align: middle;">${w.startTime} às ${w.endTime}</td>
        <td class="col-duration duration-worked" style="white-space: nowrap; vertical-align: middle; color: var(--primary-700); font-weight: 800;">+${minutesToHHMM(w.durationMinutes)}</td>
        <td style="border-right:2px solid #93c5fd; vertical-align: middle;">
          <div class="table-badge-actions">
            <span class="badge-tag" title="${w.justification || 'Auxílio a pedido'}">${w.justification || 'Auxílio a pedido'}</span>
            <div class="action-btn-group">
              <button class="action-btn" onclick="editRecord('${w.id}')" title="Editar">✏️</button>
              <button class="action-btn btn-delete" onclick="deleteRecord('${w.id}')" title="Excluir">🗑️</button>
            </div>
          </div>
        </td>
      `;
    } else {
      html += `
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td style="border-right:2px solid #93c5fd; color:#cbd5e1; vertical-align: middle;">-</td>
      `;
    }

    if (t) {
      html += `
        <td style="white-space: nowrap; vertical-align: middle;"><strong>${formatDateBR(t.date)}</strong></td>
        <td style="white-space: nowrap; vertical-align: middle;">${t.startTime} às ${t.endTime}</td>
        <td class="col-duration duration-taken" style="white-space: nowrap; vertical-align: middle; color: #dc2626; font-weight: 800;">-${minutesToHHMM(t.durationMinutes)}</td>
        <td class="col-actions" style="vertical-align: middle; text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 0.2rem; justify-content: center;">
            <button class="action-btn" onclick="editRecord('${t.id}')" title="Editar">✏️</button>
            <button class="action-btn btn-delete" onclick="deleteRecord('${t.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      `;
    } else {
      html += `
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td style="color:#cbd5e1; vertical-align: middle;">-</td>
        <td class="col-actions" style="color:#cbd5e1; vertical-align: middle; text-align: center;">-</td>
      `;
    }

    html += `</tr>`;
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderSingleTypeTable(container, list, type) {
  if (list.length === 0) {
    const isWorked = type === 'WORKED';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-card">
          <div class="empty-state-icon">${isWorked ? '🕒' : '🗓️'}</div>
          <h3>Nenhum registro de ${isWorked ? 'Horas Trabalhadas (Sobra)' : 'Horas Faltantes (Tiradas)'}</h3>
          <p>${isWorked ? 'Não há créditos de horas trabalhadas cadastrados nesta matrícula.' : 'Não há compensações ou horas faltantes tiradas nesta matrícula.'}</p>
        </div>
      </div>
    `;
    return;
  }

  const isWorked = type === 'WORKED';
  let html = `
    <table class="custom-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Início</th>
          <th>Término</th>
          <th>Duração</th>
          ${isWorked ? '<th>Justificativa</th>' : '<th>Observação</th>'}
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach(rec => {
    const formattedDuration = isWorked 
      ? `+${minutesToHHMM(rec.durationMinutes)}` 
      : `-${minutesToHHMM(rec.durationMinutes)}`;
    const durationClass = isWorked ? 'col-duration duration-worked' : 'col-duration duration-taken';
    const durationStyle = isWorked 
      ? 'white-space: nowrap; vertical-align: middle; color: var(--primary-700); font-weight: 800;' 
      : 'white-space: nowrap; vertical-align: middle; color: #dc2626; font-weight: 800;';

    html += `
      <tr>
        <td style="white-space: nowrap; vertical-align: middle;"><strong>${formatDateBR(rec.date)}</strong></td>
        <td style="white-space: nowrap; vertical-align: middle;">${rec.startTime}</td>
        <td style="white-space: nowrap; vertical-align: middle;">${rec.endTime}</td>
        <td class="${durationClass}" style="${durationStyle}">${formattedDuration}</td>
        <td style="white-space: nowrap; vertical-align: middle;"><span class="badge-tag" style="white-space: nowrap;">${rec.justification || (isWorked ? 'Trabalho extraordinário' : 'Compensação')}</span></td>
        <td class="col-actions" style="white-space: nowrap; vertical-align: middle;">
          <button class="action-btn" onclick="editRecord('${rec.id}')" title="Editar">✏️</button>
          <button class="action-btn btn-delete" onclick="deleteRecord('${rec.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ==========================================================================
// FOLHA OFICIAL PARA IMPRESSÃO / PDF (PREFEITURA DE LAJEADO)
// ==========================================================================

function openOfficialPrintModal() {
  const server = getActiveServer();
  const totals = calculateTotals();
  const activeRecs = getActiveRecords();

  const workedList = activeRecs.filter(r => r.type === 'WORKED').sort((a, b) => a.date.localeCompare(b.date));
  const takenList = activeRecs.filter(r => r.type === 'TAKEN').sort((a, b) => a.date.localeCompare(b.date));

  const totalRows = Math.max(workedList.length, takenList.length, 30);

  let rowsHtml = '';
  for (let i = 0; i < totalRows; i++) {
    const w = workedList[i];
    const t = takenList[i];

    const wDia = w ? formatDateBR(w.date) : '';
    const wInicio = w ? w.startTime : '';
    const wTermino = w ? w.endTime : '';
    const wTotal = w ? minutesToHHMM(w.durationMinutes) : '';
    const wJust = w ? (w.justification || '') : '';

    const tDia = t ? formatDateBR(t.date) : '';
    const tInicio = t ? t.startTime : '';
    const tTermino = t ? t.endTime : '';
    const tTotal = t ? minutesToHHMM(t.durationMinutes) : (i < Math.max(workedList.length, takenList.length) ? '00:00' : '');

    rowsHtml += `
      <tr>
        <td style="width:75px;">${wDia}</td>
        <td style="width:45px;">${wInicio}</td>
        <td style="width:45px;">${wTermino}</td>
        <td style="width:55px; font-weight:bold;">${wTotal}</td>
        <td class="text-left" style="width:230px;">${wJust}</td>
        <td style="width:75px;">${tDia}</td>
        <td style="width:45px;">${tInicio}</td>
        <td style="width:45px;">${tTermino}</td>
        <td style="width:55px; font-weight:bold;">${tTotal}</td>
      </tr>
    `;
  }

  const todayBR = formatDateBR(new Date().toISOString().split('T')[0]);

  const sheetHtml = `
    <div class="official-sheet" id="printArea">
      <div class="sheet-header-title">
        <h2>Prefeitura Municipal de Lajeado</h2>
        <h3>Secretaria da Educação</h3>
        <h4>Registro de Compensação de Horário</h4>
      </div>

      <table class="sheet-meta-box">
        <tr>
          <td style="width:30%;"><span class="sheet-meta-label">EMEI:</span> ${server.emei || ''}</td>
          <td style="width:35%;"><span class="sheet-meta-label">Servidor:</span> ${server.nome || ''}</td>
          <td style="width:20%;"><span class="sheet-meta-label">Matrícula:</span> ${server.matricula || ''}</td>
          <td style="width:15%;"><span class="sheet-meta-label">Ano:</span> ${server.ano || '2026'}</td>
        </tr>
      </table>

      <table class="sheet-table-main">
        <thead>
          <tr>
            <th colspan="4">TURNO/HORÁRIO TRABALHADO</th>
            <th rowspan="3" style="width:230px; vertical-align:middle;">JUSTIFICATIVA PARA O TEMPO TRABALHADO</th>
            <th colspan="4">TURNO/HORÁRIO FALTANTE</th>
          </tr>
          <tr>
            <th rowspan="2">DIA</th>
            <th colspan="2">HORÁRIO</th>
            <th rowspan="2">TOTAL DE HORAS</th>
            <th rowspan="2">DIA</th>
            <th colspan="2">HORÁRIO</th>
            <th rowspan="2">TOTAL DE HORAS</th>
          </tr>
          <tr>
            <th>INÍCIO</th>
            <th>TÉRMINO</th>
            <th>INÍCIO</th>
            <th>TÉRMINO</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="sheet-summary-box">
        <tr>
          <td style="width:30%;">TOTAL DE HORAS TRABALHADAS</td>
          <td style="width:15%; text-align:center;">${totals.workedHHMM}</td>
          <td style="width:40%; text-align:right;">TOTAL DE HORAS FALTANTES</td>
          <td style="width:15%; text-align:center;">${totals.takenHHMM}</td>
        </tr>
        <tr>
          <td colspan="2" style="background:#f8fafc;"></td>
          <td style="text-align:right;">Saldo de Horas:</td>
          <td style="text-align:center; font-size:10pt;">${totals.isPositive ? '+' : '-'}${totals.balanceHHMM}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem; font-size:9pt;">
        <tr>
          <td style="border:1px solid #000; padding:6px; width:45%;">
            <strong>Lançado por:</strong> ${server.lancadoPor || 'Diretoria / Coordenação'}
          </td>
          <td style="border:1px solid #000; padding:6px; width:25%;">
            <strong>Data:</strong> ${todayBR}
          </td>
          <td style="width:30%;"></td>
        </tr>
      </table>

      <div class="sheet-signatures">
        <div class="sheet-sign-line">
          Assinatura do servidor(a)
        </div>
        <div class="sheet-sign-line">
          Assinatura do Diretor(a)
        </div>
      </div>

      <div class="sheet-notice">
        * Este documento poderá ser solicitado a qualquer momento pela Secretaria da Educação.
      </div>
    </div>
  `;

  document.getElementById('printModalContent').innerHTML = sheetHtml;
  document.getElementById('printModal').classList.add('active');
}

function closePrintModal() {
  document.getElementById('printModal').classList.remove('active');
}

function executePrint() {
  window.print();
}

// ==========================================================================
// EXPORTAÇÕES E BACKUP
// ==========================================================================

function exportToCSV() {
  const server = getActiveServer();
  const totals = calculateTotals();
  const activeRecs = getActiveRecords();

  let csv = `PREFEITURA MUNICIPAL DE LAJEADO - SECRETARIA DA EDUCACAO\n`;
  csv += `REGISTRO DE COMPENSACAO DE HORARIO\n`;
  csv += `EMEI:;${server.emei};Servidor:;${server.nome};Matricula:;${server.matricula};Ano:;${server.ano}\n\n`;

  csv += `TURNO/HORARIO TRABALHADO;;;;;TURNO/HORARIO FALTANTE\n`;
  csv += `Data;Inicio;Termino;Total Horas;Justificativa;Data;Inicio;Termino;Total Horas\n`;

  const worked = activeRecs.filter(r => r.type === 'WORKED');
  const taken = activeRecs.filter(r => r.type === 'TAKEN');
  const max = Math.max(worked.length, taken.length);

  for (let i = 0; i < max; i++) {
    const w = worked[i];
    const t = taken[i];

    const wData = w ? formatDateBR(w.date) : '';
    const wIn = w ? w.startTime : '';
    const wOut = w ? w.endTime : '';
    const wTot = w ? minutesToHHMM(w.durationMinutes) : '';
    const wJust = w ? `"${(w.justification || '').replace(/"/g, '""')}"` : '';

    const tData = t ? formatDateBR(t.date) : '';
    const tIn = t ? t.startTime : '';
    const tOut = t ? t.endTime : '';
    const tTot = t ? minutesToHHMM(t.durationMinutes) : '';

    csv += `${wData};${wIn};${wOut};${wTot};${wJust};${tData};${tIn};${tOut};${tTot}\n`;
  }

  csv += `\nTOTAL HORAS TRABALHADAS:;${totals.workedHHMM};;;TOTAL HORAS FALTANTES:;${totals.takenHHMM}\n`;
  csv += `SALDO DE HORAS:;${totals.isPositive ? '+' : '-'}${totals.balanceHHMM}\n`;

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Compensacao_Horas_${server.nome.replace(/\s+/g, '_')}_${server.ano}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function backupData() {
  const data = {
    servers: appState.servers,
    records: appState.records,
    exportedAt: new Date().toISOString(),
    version: '2.2'
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Backup_Sistema_Horas_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.servers && data.records) {
        if (confirm('Restaurar este backup substituirá os dados atuais. Deseja continuar?')) {
          appState.servers = data.servers;
          appState.records = data.records;
          appState.activeServerId = data.servers[0] ? data.servers[0].id : null;
          saveState();
          renderUI();
          alert('Backup restaurado com sucesso!');
        }
      } else {
        alert('Arquivo de backup inválido.');
      }
    } catch (err) {
      alert('Erro ao processar arquivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  populateTimeDropdowns();

  const hudForm = document.getElementById('hudTimeEntryForm');
  if (hudForm) {
    hudForm.addEventListener('submit', saveHudEntry);
  }

  const btnToday = document.getElementById('hudBtnSetToday');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      document.getElementById('hudRecordDate').value = new Date().toISOString().split('T')[0];
    });
  }

  document.querySelectorAll('.dash-view-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.dash-view-tab').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      appState.dashboardTab = target.dataset.tab;
      renderDashboardTable();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEntryHud();
      closePrintModal();
    }
  });

  navigateTo('registrar');
  checkSession();
});
