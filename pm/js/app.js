// ================================================
// LEIXÕES SC 119 PM — Production JS v2.0
// ================================================

// --- UTILITIES ---
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const uuid = () => 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fileUuid = () => 'f-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dayMs = 86400000;

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-PT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / dayMs); }
function isOverdue(dueDate, status) {
  if (!dueDate || status === 'Done') return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0,10));
}
function personInitials(name) {
  return name.split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2);
}
const SECTION_COLORS = [
  '#C8102E','#0065FF','#00875A','#FF8B00','#6554C0','#00B8D9','#FF5630',
  '#36B37E','#8777D9','#00C7E6','#FF7452','#57D9A3','#998DD9','#79E2F2'
];

// ================================================
// THEME (Dark Mode)
// ================================================
const Theme = {
  init() {
    const saved = localStorage.getItem('leixoes-pm-theme');
    if (saved) { document.documentElement.setAttribute('data-theme', saved); }
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('leixoes-pm-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('leixoes-pm-theme', next);
    showToast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode');
  },
  isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
};

// ================================================
// DATA STORE
// ================================================
const Store = {
  _data: null, _listeners: [], LS_KEY: 'leixoes-pm-v2',

  init() {
    const saved = localStorage.getItem(this.LS_KEY);
    if (saved) { try { this._data = JSON.parse(saved); } catch(e) { this._data = null; } }
    if (!this._data || !this._data.tasks || this._data.tasks.length === 0) {
      this._data = SeedData.generate();
      this._save();
    }
    this._data.tasks.forEach(t => {
      if (!t.collaborators) t.collaborators = [];
      if (!t.activityLog) t.activityLog = [];
      if (!t.files) t.files = [];
      if (!t.subtasks) t.subtasks = [];
      if (!t.completedBy) t.completedBy = null;
      if (!t.completedAt) t.completedAt = null;
      if (!t.lastUpdated) t.lastUpdated = t.createdAt || new Date().toISOString();
    });
    if (!this._data.files) this._data.files = [];
    return this._data;
  },
  _save() { localStorage.setItem(this.LS_KEY, JSON.stringify(this._data)); this._listeners.forEach(fn => fn(this._data)); },
  onChange(fn) { this._listeners.push(fn); },
  get data() { return this._data; },
  get tasks() { return this._data.tasks; },
  get sections() { return this._data.sections; },
  get people() { return this._data.people; },
  get files() { return this._data.files; },

  getTask(id) { return this._data.tasks.find(t => t.id === id); },
  getSection(id) { return this._data.sections.find(s => s.id === id); },
  getPerson(id) { return this._data.people.find(p => p.id === id); },

  addTask(task) {
    const t = {
      id: uuid(), sectionId: task.sectionId || this._data.sections[0].id,
      name: task.name || 'New Task', description: task.description || '',
      startDate: task.startDate || '', dueDate: task.dueDate || '',
      priority: task.priority || 'Medium', status: 'To Do',
      tags: task.tags || [], assignee: task.assignee || null,
      collaborators: task.collaborators || [], dependencies: task.dependencies || [],
      completedBy: null, completedAt: null,
      createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
      isMilestone: false, isGate: false, notes: task.notes || '',
      files: [], subtasks: [],
      activityLog: [{ time: new Date().toISOString(), action: 'Created', user: 'You' }]
    };
    this._data.tasks.push(t);
    this._save();
    return t;
  },

  updateTask(id, field, value) {
    const t = this.getTask(id);
    if (!t) return;
    const old = t[field];
    t[field] = value;
    t.lastUpdated = new Date().toISOString();
    if (field === 'status' && value === 'Done') { t.completedBy = 'You'; t.completedAt = new Date().toISOString(); }
    if (field === 'status' && value !== 'Done') { t.completedBy = null; t.completedAt = null; }
    t.activityLog.unshift({ time: new Date().toISOString(), action: `Changed ${field}: ${String(old).slice(0,30)} → ${String(value).slice(0,30)}`, user: 'You' });
    this._save();
  },

  deleteTask(id) {
    this._data.tasks = this._data.tasks.filter(t => t.id !== id);
    this._data.tasks.forEach(t => { t.dependencies = t.dependencies.filter(d => d !== id); });
    this._save();
  },

  addFile(file) { this._data.files.push(file); this._save(); return file; },
  deleteFile(id) { this._data.files = this._data.files.filter(f => f.id !== id); this._save(); },

  addPerson(p) {
    const person = { id: 'p-' + Date.now().toString(36), name: p.name, role: p.role || '', initials: personInitials(p.name), color: SECTION_COLORS[this._data.people.length % SECTION_COLORS.length] };
    this._data.people.push(person);
    this._save();
    return person;
  },

  getTasksBySection() {
    const map = {};
    this._data.sections.forEach(s => { map[s.id] = { section: s, tasks: [] }; });
    this._data.tasks.forEach(t => { if (map[t.sectionId]) map[t.sectionId].tasks.push(t); });
    return map;
  },

  getStats() {
    const tasks = this._data.tasks;
    return {
      total: tasks.length,
      done: tasks.filter(t => t.status === 'Done').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      overdue: tasks.filter(t => isOverdue(t.dueDate, t.status)).length,
      todo: tasks.filter(t => t.status === 'To Do').length,
      blocked: tasks.filter(t => t.status === 'Blocked').length,
    };
  },

  // Subtask operations
  addSubtask(taskId, name) {
    const t = this.getTask(taskId);
    if (!t) return;
    t.subtasks.push({ id: 'st-' + Date.now().toString(36), name, done: false, createdAt: new Date().toISOString() });
    t.lastUpdated = new Date().toISOString();
    t.activityLog.unshift({ time: new Date().toISOString(), action: `Added subtask: ${name}`, user: 'You' });
    this._save();
  },
  toggleSubtask(taskId, subtaskId) {
    const t = this.getTask(taskId);
    if (!t) return;
    const st = t.subtasks.find(s => s.id === subtaskId);
    if (st) { st.done = !st.done; t.lastUpdated = new Date().toISOString(); this._save(); }
  },
  removeSubtask(taskId, subtaskId) {
    const t = this.getTask(taskId);
    if (!t) return;
    t.subtasks = t.subtasks.filter(s => s.id !== subtaskId);
    t.lastUpdated = new Date().toISOString();
    this._save();
  },

  // Bulk operations
  bulkUpdateStatus(ids, status) {
    ids.forEach(id => { this.updateTask(id, 'status', status); });
  },

  // CSV Export
  exportCSV() {
    const headers = ['Section','Task Name','Start Date','Due Date','Priority','Status','Assignee','Tags'];
    const rows = this._data.tasks.map(t => {
      const sec = this.getSection(t.sectionId);
      const person = t.assignee ? this.getPerson(t.assignee) : null;
      return [sec?.name||'', t.name, t.startDate||'', t.dueDate||'', t.priority, t.status, person?.name||'', (t.tags||[]).join('; ')];
    });
    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += r.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',') + '\n'; });
    return csv;
  },

  // CSV Import
  importCSV(csvText) {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return 0;
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g) || [];
      const clean = vals.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      const row = {};
      headers.forEach((h, j) => { row[h] = clean[j] || ''; });

      const secName = row['section'] || row['section/column'] || '';
      let sec = this._data.sections.find(s => s.name.toLowerCase().includes(secName.toLowerCase().slice(0, 10)));
      if (!sec) sec = this._data.sections[0];

      const name = row['task name'] || row['name'] || '';
      if (!name) continue;

      // Check duplicate
      if (this._data.tasks.find(t => t.name === name && t.sectionId === sec.id)) continue;

      const priMap = { 'alta':'High', 'média':'Medium', 'média':'Medium', 'baixa':'Low', 'high':'High', 'medium':'Medium', 'low':'Low' };
      const tags = (row['tags'] || '').split(/[;,]/).map(t => t.trim()).filter(Boolean);

      this.addTask({
        name, sectionId: sec.id,
        startDate: row['start date'] || '',
        dueDate: row['due date'] || '',
        priority: priMap[(row['priority']||'').toLowerCase()] || 'Medium',
        tags
      });
      count++;
    }
    this._save();
    return count;
  }
};

// ================================================
// SEED DATA
// ================================================
const SeedData = {
  generate() {
    const sections = [
      { id:'s-01', name:'Gestão de Projeto', color:'#C8102E' },
      { id:'s-02', name:'Local e Montagem', color:'#0065FF' },
      { id:'s-03', name:'Podcast — O Destino: Saudade', color:'#00875A' },
      { id:'s-04', name:'Voluntariado', color:'#FF8B00' },
      { id:'s-05', name:'Ambientação e Identidade Visual', color:'#6554C0' },
      { id:'s-06', name:'Protocolo Institucional', color:'#00B8D9' },
      { id:'s-07', name:'Prémios Leixões e Alfinetes', color:'#FF5630' },
      { id:'s-08', name:'Produção Técnica', color:'#36B37E' },
      { id:'s-09', name:'Restauração e Hospitalidade', color:'#8777D9' },
      { id:'s-10', name:'Comunicação e Ativação', color:'#00C7E6' },
      { id:'s-11', name:'Gestão de Convidados', color:'#FF7452' },
      { id:'s-12', name:'Orçamento e Finanças', color:'#57D9A3' },
      { id:'s-13', name:'Patrocínios e Parcerias', color:'#998DD9' },
      { id:'s-14', name:'Risco e Contingência', color:'#79E2F2' }
    ];
    const people = [
      { id:'p-01', name:'Jorge Moreira', role:'Presidente', initials:'JM', color:'#C8102E' },
      { id:'p-02', name:'Luís Cruz', role:'Memória e Equipa', initials:'LC', color:'#0065FF' },
      { id:'p-03', name:'Cláudia Silva', role:'Imagem', initials:'CS', color:'#00875A' },
      { id:'p-04', name:'Coordenação Executiva', role:'Coordenação', initials:'CE', color:'#FF8B00' },
      { id:'p-05', name:'Resp. Protocolo', role:'Protocolo', initials:'RP', color:'#6554C0' },
      { id:'p-06', name:'Resp. Produção', role:'Produção Técnica', initials:'PT', color:'#00B8D9' },
      { id:'p-07', name:'Resp. Parcerias', role:'Parcerias / Finanças', initials:'PF', color:'#FF5630' },
      { id:'p-08', name:'Resp. Comunicação', role:'Comunicação', initials:'RC', color:'#36B37E' },
      { id:'p-09', name:'Resp. Programa', role:'Programa', initials:'PG', color:'#8777D9' },
    ];

    const rawTasks = [
      ['s-01','Aprovação do plano de dois dias pela Direção','2026-08-07','2026-08-14','High',['Gestão','Direção'],'p-01',[]],
      ['s-01','Aprovação do teto financeiro e local preferencial','2026-08-07','2026-08-14','High',['Gestão','Finanças'],'p-01',[]],
      ['s-01','Nomeação da equipa operacional','2026-08-07','2026-08-14','High',['Gestão','Equipa'],'p-02',[]],
      ['s-01','Kick-off com equipa de coordenação','2026-08-14','2026-08-21','High',['Gestão'],'p-04',[]],
      ['s-01','Reunião de arranque com toda a equipa','2026-09-24','2026-10-01','High',['Gestão'],'p-04',[]],
      ['s-01','Definir e confirmar funções da equipa','2026-09-24','2026-10-01','High',['Gestão'],'p-04',[]],
      ['s-01','Criar cronograma mestre do evento','2026-09-26','2026-10-03','High',['Gestão'],'p-04',[]],
      ['s-01','Definir KPIs e métricas de sucesso','2026-09-30','2026-10-05','Medium',['Gestão'],'p-04',[]],
      ['s-01','Briefing final pré-evento','2026-11-17','2026-11-24','High',['Gestão'],'p-04',[]],
      ['s-01','Reunião de balanço pós-evento','2026-11-29','2026-12-04','Medium',['Gestão'],'p-04',[]],
      ['s-02','GATE 1 — Pré-reserva escrita do espaço','2026-08-14','2026-08-21','High',['Local','Gate'],'p-04',[]],
      ['s-02','Confirmar disponibilidade, valor e caução','2026-08-14','2026-08-21','High',['Local','Finanças'],'p-04',[]],
      ['s-02','Realizar visita técnica ao armazém','2026-09-23','2026-09-30','High',['Local','Técnica'],'p-06',[]],
      ['s-02','Fechar planta, energia e projeção','2026-10-04','2026-10-11','High',['Local','Técnica'],'p-06',['t-012']],
      ['s-02','Planear reutilização ambientação sexta/sábado','2026-10-27','2026-11-01','Medium',['Local','Ambientação'],'p-02',[]],
      ['s-02','Montagem e testes de sexta','2026-11-25','2026-11-26','High',['Local','Técnica'],'p-06',[]],
      ['s-02','Desmontagem e reposição do espaço','2026-11-28','2026-11-30','Medium',['Local'],'p-06',[]],
      ['s-03','Obter confirmação escrita do âmbito técnico','2026-08-21','2026-08-28','High',['Podcast'],'p-04',[]],
      ['s-03','Brief para Luís Cruz — proposta convidados','2026-08-21','2026-08-28','High',['Podcast','Luís Cruz'],'p-02',[]],
      ['s-03','Lista fundamentada candidatos ao painel','2026-08-21','2026-08-28','High',['Podcast','Convidados'],'p-02',[]],
      ['s-03','Identificar figuras para a plateia','2026-08-21','2026-08-28','High',['Podcast','Convidados'],'p-02',[]],
      ['s-03','Validar lista com a Direção','2026-10-04','2026-10-11','High',['Podcast','Protocolo'],'p-01',[]],
      ['s-03','Execução sessão ao vivo (Sex 21h00)','2026-11-27','2026-11-27','High',['Podcast','Evento'],'p-04',[]],
      ['s-04','Identificar perfis por frente operacional','2026-08-21','2026-08-28','High',['Voluntariado'],'p-02',[]],
      ['s-04','Recrutar voluntários: Coordenação Geral','2026-09-08','2026-09-15','High',['Voluntariado'],'p-02',[]],
      ['s-04','Recrutar voluntários: Memória e Ambientação','2026-09-08','2026-09-15','High',['Voluntariado'],'p-02',[]],
      ['s-04','Recrutar voluntários: Protocolo Sábado','2026-09-08','2026-09-15','High',['Voluntariado','Protocolo'],'p-05',[]],
      ['s-04','Validar lista final voluntários','2026-10-04','2026-10-11','High',['Voluntariado','Direção'],'p-01',[]],
      ['s-04','Preparar briefing individual por função','2026-11-09','2026-11-16','High',['Voluntariado'],'p-04',[]],
      ['s-04','Ensaio geral com voluntários','2026-11-25','2026-11-26','High',['Voluntariado'],'p-04',[]],
      ['s-05','Inventariar peças no Clube','2026-08-21','2026-08-28','High',['Ambientação'],'p-02',[]],
      ['s-05','Definir narrativa visual por zona','2026-10-04','2026-10-11','High',['Ambientação','Design'],'p-02',[]],
      ['s-05','Desenhar painel 119 para fundo de palco','2026-10-04','2026-10-11','High',['Ambientação','Design'],'p-02',[]],
      ['s-05','Criar logótipo e elementos visuais','2026-10-04','2026-10-11','High',['Design'],'p-08',[]],
      ['s-05','Imprimir todos os materiais físicos','2026-11-08','2026-11-15','High',['Design'],'p-08',[]],
      ['s-05','Montagem da ambientação','2026-11-25','2026-11-26','High',['Design','Local'],'p-06',[]],
      ['s-06','Preparar lista convidados institucionais','2026-10-04','2026-10-11','High',['Protocolo'],'p-01',[]],
      ['s-06','Definir categorias protocolares','2026-10-04','2026-10-11','High',['Protocolo'],'p-05',[]],
      ['s-06','Enviar convites institucionais formais','2026-10-05','2026-10-12','High',['Protocolo','Comunicação'],'p-05',[]],
      ['s-06','Acompanhar confirmações de presença','2026-11-01','2026-11-08','High',['Protocolo','Convidados'],'p-05',[]],
      ['s-06','Definir mapa de sala e precedências','2026-11-01','2026-11-08','High',['Protocolo'],'p-05',[]],
      ['s-06','Execução sessão institucional (Sáb 17h30)','2026-11-28','2026-11-28','High',['Protocolo','Evento'],'p-05',[]],
      ['s-07','Confirmar modelo de atribuição','2026-09-08','2026-09-15','High',['Prémios'],'p-09',[]],
      ['s-07','Aprovação lista homenageados','2026-10-04','2026-10-11','High',['Prémios','Direção'],'p-01',[]],
      ['s-07','Confirmar apresentador cerimónia','2026-10-04','2026-10-11','High',['Prémios'],'p-09',[]],
      ['s-07','Redigir guião cerimónia (45-60 min)','2026-11-08','2026-11-15','High',['Prémios'],'p-09',[]],
      ['s-07','Execução cerimónia (Sáb 21h00)','2026-11-28','2026-11-28','High',['Prémios','Evento'],'p-09',[]],
      ['s-08','GATE 2 — Comparar propostas antes de contratar','2026-09-23','2026-09-30','High',['Técnica','Gate'],'p-06',['t-010']],
      ['s-08','Solicitar propostas de som','2026-09-23','2026-09-30','High',['Técnica'],'p-06',[]],
      ['s-08','Solicitar propostas de luz','2026-09-23','2026-09-30','High',['Técnica'],'p-06',[]],
      ['s-08','Solicitar propostas de projeção','2026-09-23','2026-09-30','High',['Técnica'],'p-06',[]],
      ['s-08','Solicitar propostas de palco','2026-09-23','2026-09-30','High',['Técnica'],'p-06',[]],
      ['s-08','Fecho técnico — programa, planta, guiões','2026-11-09','2026-11-16','High',['Técnica'],'p-06',[]],
      ['s-08','Ensaio técnico completo AV','2026-11-24','2026-11-25','High',['Técnica'],'p-06',[]],
      ['s-09','GATE 3 — Contratar apenas remanescente','2026-10-04','2026-10-11','High',['Restauração','Gate'],'p-07',[]],
      ['s-09','Confirmar fornecedor catering institucional','2026-10-15','2026-10-22','High',['Restauração'],'p-07',[]],
      ['s-09','Confirmar bolo até 350 participantes','2026-10-27','2026-11-01','High',['Restauração'],'p-07',[]],
      ['s-09','Confirmar finos (barris, máquina)','2026-10-27','2026-11-01','High',['Restauração'],'p-07',[]],
      ['s-09','Coordenação restauração nos dias','2026-11-27','2026-11-28','High',['Restauração'],'p-07',[]],
      ['s-10','Criar página inscrição e QR Code','2026-10-04','2026-10-11','High',['Comunicação','Digital'],'p-08',[]],
      ['s-10','Fase Revelação — programa, conceito','2026-10-04','2026-10-11','High',['Comunicação'],'p-08',[]],
      ['s-10','Lançamento público de inscrições','2026-10-05','2026-10-12','High',['Comunicação','Digital'],'p-08',[]],
      ['s-10','Reconfirmação por email/SMS','2026-11-18','2026-11-23','High',['Comunicação','Digital'],'p-08',[]],
      ['s-10','Relatório de resultados e KPIs','2026-11-29','2026-12-04','High',['Comunicação','Gestão'],'p-04',[]],
      ['s-11','Compilar lista mestre por categoria','2026-09-28','2026-10-05','High',['Convidados'],'p-05',[]],
      ['s-11','Configurar sistema RSVPs e QR Code','2026-10-03','2026-10-10','High',['Convidados','Digital'],'p-08',[]],
      ['s-11','Enviar convites formais','2026-10-15','2026-10-22','High',['Convidados'],'p-05',[]],
      ['s-11','Finalizar lista confirmados','2026-11-15','2026-11-20','High',['Convidados'],'p-05',[]],
      ['s-11','Gerir check-in nos dias do evento','2026-11-27','2026-11-28','High',['Convidados'],'p-04',[]],
      ['s-12','Definir meta ≤ 2.500 € e teto 5.000 €','2026-08-07','2026-08-14','High',['Orçamento','Direção'],'p-01',[]],
      ['s-12','Criar folha de controlo financeiro','2026-08-14','2026-08-21','High',['Orçamento'],'p-07',[]],
      ['s-12','GATE 4 — Aprovação orçamento consolidado','2026-10-04','2026-10-11','High',['Orçamento','Gate'],'p-01',[]],
      ['s-12','GATE 5 — Escalar se previsão > 2.500 €','2026-10-04','2026-10-11','High',['Orçamento','Gate'],'p-04',[]],
      ['s-12','Reconciliação final e prestação de contas','2026-11-29','2026-12-04','High',['Orçamento'],'p-07',[]],
      ['s-13','Autorização Direção para abordagem','2026-08-07','2026-08-14','High',['Patrocínios','Direção'],'p-01',[]],
      ['s-13','Procurar cedência do espaço','2026-08-14','2026-08-21','High',['Patrocínios','Local'],'p-07',[]],
      ['s-13','Candidatura a subsídio municipal','2026-09-08','2026-09-15','High',['Patrocínios'],'p-07',[]],
      ['s-13','Confirmar parceiros apoio em espécie','2026-09-23','2026-09-30','High',['Patrocínios'],'p-07',[]],
      ['s-13','Definir manual de contrapartidas','2026-10-04','2026-10-11','High',['Patrocínios','Comunicação'],'p-07',[]],
      ['s-13','Documentar entrega dos apoios','2026-11-28','2026-11-28','High',['Patrocínios','Finanças'],'p-07',[]],
      ['s-14','Contingência: espaço não reservado','2026-09-30','2026-10-07','High',['Risco','Local'],'p-04',[]],
      ['s-14','Contingência: produção suborçamentada','2026-09-30','2026-10-07','High',['Risco','Técnica'],'p-06',[]],
      ['s-14','Contingência: apoios insuficientes','2026-09-30','2026-10-07','High',['Risco','Patrocínios'],'p-07',[]],
      ['s-14','Decisão módulo Estádio do Mar','2026-10-09','2026-10-16','High',['Risco','Gestão'],'p-01',[]],
      ['s-14','Rever e atualizar registo de riscos','2026-10-27','2026-11-01','Medium',['Risco'],'p-04',[]],
    ];

    const today = new Date().toISOString().slice(0,10);
    const tasks = rawTasks.map((r, i) => {
      const id = 't-' + String(i).padStart(3,'0');
      const dueDate = r[3];
      let status = 'To Do';
      if (dueDate < today && dueDate < '2026-09-26') status = 'Done';
      else if (dueDate < today) status = 'In Progress';
      return {
        id, sectionId: r[0], name: r[1], description: '',
        startDate: r[2], dueDate: r[3], priority: r[4], status,
        tags: r[5], assignee: r[6], collaborators: [],
        dependencies: r[7] || [],
        completedBy: status === 'Done' ? 'System' : null,
        completedAt: status === 'Done' ? dueDate + 'T18:00:00Z' : null,
        createdAt: '2026-08-06T10:00:00Z',
        lastUpdated: status === 'Done' ? dueDate + 'T18:00:00Z' : new Date().toISOString(),
        isMilestone: r[1].startsWith('GATE') || r[1].startsWith('Execução'),
        isGate: r[1].startsWith('GATE'),
        notes: '', files: [], subtasks: [],
        activityLog: [{ time: '2026-08-06T10:00:00Z', action: 'Created from project plan', user: 'System' }]
      };
    });
    return { sections, people, tasks, milestones: [], files: [] };
  }
};


// ================================================
// NAVIGATION
// ================================================
const Nav = {
  current: 'dashboard',
  init() {
    $$('[data-view]').forEach(btn => { btn.addEventListener('click', () => this.go(btn.dataset.view)); });
    this.go('dashboard');
  },
  go(view) {
    this.current = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    const el = $(`#view-${view}`);
    if (el) el.classList.add('active');
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.desktop-nav button').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    BulkActions.clear();
    if (view === 'dashboard') Dashboard.render();
    if (view === 'tasks') TaskList.render();
    if (view === 'gantt') Gantt.render();
    if (view === 'calendar') Calendar.render();
    if (view === 'files') Files.render();
  }
};

// ================================================
// MODAL & TOAST
// ================================================
const Modal = {
  open(title, bodyHtml) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close() { $('#modalOverlay').classList.remove('open'); document.body.style.overflow = ''; }
};

function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toastContainer').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, duration);
}

// ================================================
// BULK ACTIONS
// ================================================
const BulkActions = {
  selected: new Set(),
  toggle(id) {
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    this.updateUI();
  },
  clear() { this.selected.clear(); this.updateUI(); },
  updateUI() {
    const bar = $('#bulkBar');
    if (this.selected.size > 0) {
      bar.classList.add('active');
      bar.innerHTML = `
        <span class="bulk-count">${this.selected.size} selected</span>
        <button class="btn btn-sm btn-secondary" onclick="BulkActions.setStatus('Done')">✅ Done</button>
        <button class="btn btn-sm btn-secondary" onclick="BulkActions.setStatus('In Progress')">🔵 Progress</button>
        <button class="btn btn-sm btn-secondary" onclick="BulkActions.setStatus('To Do')">⬜ To Do</button>
        <button class="btn btn-sm btn-secondary" onclick="BulkActions.clear()">✕</button>
      `;
    } else { bar.classList.remove('active'); }
    $$('.task-card').forEach(c => c.classList.toggle('selected', this.selected.has(c.dataset?.id)));
  },
  setStatus(status) {
    Store.bulkUpdateStatus([...this.selected], status);
    showToast(`✅ ${this.selected.size} tasks → ${status}`);
    this.clear();
    TaskList.render();
  }
};

// ================================================
// DASHBOARD VIEW
// ================================================
const Dashboard = {
  render() {
    const s = Store.getStats();
    const grouped = Store.getTasksBySection();
    const pct = s.total ? Math.round(s.done / s.total * 100) : 0;

    // Upcoming tasks (next 14 days, not done)
    const today = new Date().toISOString().slice(0,10);
    const in14 = new Date(Date.now() + 14 * dayMs).toISOString().slice(0,10);
    const upcoming = Store.tasks
      .filter(t => t.dueDate >= today && t.dueDate <= in14 && t.status !== 'Done')
      .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 10);

    const container = $('#dashboardContent');
    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-value" style="color:var(--text)">${s.total}</div><div class="kpi-label">Total Tasks</div></div>
        <div class="kpi-card"><div class="kpi-value" style="color:var(--success)">${s.done}</div><div class="kpi-label">Completed</div></div>
        <div class="kpi-card"><div class="kpi-value" style="color:var(--info)">${s.inProgress}</div><div class="kpi-label">In Progress</div></div>
        <div class="kpi-card"><div class="kpi-value" style="color:var(--danger)">${s.overdue}</div><div class="kpi-label">Overdue</div></div>
      </div>

      <div class="progress-section">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <strong style="font-size:0.9rem">Overall Progress</strong>
          <span style="font-size:0.85rem;font-weight:700;color:var(--success)">${pct}%</span>
        </div>
        <div class="progress-overall"><div class="progress-overall-fill" style="width:${pct}%"></div></div>
      </div>

      <div class="chart-container">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px">Priority Distribution</div>
        <canvas id="priorityChart" width="200" height="200"></canvas>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Progress by Section</div>
        ${Store.sections.map(sec => {
          const secTasks = grouped[sec.id]?.tasks || [];
          const secDone = secTasks.filter(t => t.status === 'Done').length;
          const secPct = secTasks.length ? Math.round(secDone/secTasks.length*100) : 0;
          return `<div class="section-progress-item">
            <span class="section-color" style="background:${sec.color}"></span>
            <span style="flex:1;font-size:0.78rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sec.name}</span>
            <span style="font-size:0.68rem;color:var(--text-light);min-width:35px;text-align:right">${secDone}/${secTasks.length}</span>
            <div class="section-progress-bar-wrap" style="max-width:80px">
              <div class="section-progress-fill" style="width:${secPct}%;background:${sec.color}"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">📅 Upcoming (14 days)</div>
        <div class="upcoming-list">
          ${upcoming.length ? upcoming.map(t => `
            <div class="upcoming-item" onclick="Nav.go('tasks');setTimeout(()=>TaskDetail.open('${t.id}'),100)">
              <span class="priority-dot ${t.priority.toLowerCase()}"></span>
              <span class="upcoming-date">${formatDate(t.dueDate)}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</span>
            </div>
          `).join('') : '<div style="color:var(--text-light);font-size:0.82rem;padding:8px 0">No upcoming tasks 🎉</div>'}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">💰 Budget</div>
        <div class="detail-field"><div class="detail-field-label">Target</div><div class="detail-field-value">≤ €2,500</div></div>
        <div class="detail-field"><div class="detail-field-label">Absolute Ceiling</div><div class="detail-field-value">€5,000</div></div>
        <div class="detail-field"><div class="detail-field-label">Event Dates</div><div class="detail-field-value">27-28 Nov 2026</div></div>
        <div class="detail-field"><div class="detail-field-label">Team Members</div><div class="detail-field-value">${Store.people.length}</div></div>
        <div class="detail-field"><div class="detail-field-label">Files</div><div class="detail-field-value">${Store.files.length}</div></div>
      </div>
    `;

    // Draw donut chart
    this.drawDonut(s);
  },

  drawDonut(s) {
    const canvas = $('#priorityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 100, cy = 100, r = 70, lw = 24;
    ctx.clearRect(0, 0, 200, 200);

    const high = Store.tasks.filter(t => t.priority === 'High').length;
    const med = Store.tasks.filter(t => t.priority === 'Medium').length;
    const low = Store.tasks.filter(t => t.priority === 'Low').length;
    const total = high + med + low || 1;
    const data = [
      { val: high, color: '#DE350B', label: 'High' },
      { val: med, color: '#FF8B00', label: 'Medium' },
      { val: low, color: '#00875A', label: 'Low' }
    ];

    let start = -Math.PI / 2;
    data.forEach(d => {
      const sweep = (d.val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + sweep);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = lw;
      ctx.stroke();
      start += sweep;
    });

    // Center text
    ctx.fillStyle = Theme.isDark() ? '#E8E8F0' : '#172B4D';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.total, cx, cy - 8);
    ctx.font = '11px Arial';
    ctx.fillStyle = Theme.isDark() ? '#A0A8C0' : '#5E6C84';
    ctx.fillText('tasks', cx, cy + 12);
  }
};

// ================================================
// TASK LIST VIEW
// ================================================
const TaskList = {
  filters: { search:'', section:'', priority:'', status:'', assignee:'' },

  render() {
    this.renderFilters();
    this.renderStats();
    this.renderList();
  },
  renderFilters() {
    const secs = Store.sections, ppl = Store.people;
    let h = `<div class="filter-chip${this.filters.section?'':' active'}" onclick="TaskList.setFilter('section','')">All</div>`;
    secs.forEach(s => {
      h += `<div class="filter-chip${this.filters.section===s.id?' active':''}" onclick="TaskList.setFilter('section','${s.id}')" style="${this.filters.section===s.id?'background:'+s.color+';color:white;border-color:'+s.color:''}">
        <span class="section-color" style="background:${s.color};width:8px;height:8px;border-radius:50%"></span>${s.name}</div>`;
    });
    h += `<div class="filter-chip"><select onchange="TaskList.setFilter('priority',this.value)"><option value="">Priority</option>
      <option value="High"${this.filters.priority==='High'?' selected':''}>🔴 High</option>
      <option value="Medium"${this.filters.priority==='Medium'?' selected':''}>🟡 Medium</option>
      <option value="Low"${this.filters.priority==='Low'?' selected':''}>🟢 Low</option></select></div>
      <div class="filter-chip"><select onchange="TaskList.setFilter('status',this.value)"><option value="">Status</option>
      <option value="To Do"${this.filters.status==='To Do'?' selected':''}>To Do</option>
      <option value="In Progress"${this.filters.status==='In Progress'?' selected':''}>In Progress</option>
      <option value="Done"${this.filters.status==='Done'?' selected':''}>Done</option>
      <option value="Blocked"${this.filters.status==='Blocked'?' selected':''}>Blocked</option></select></div>
      <div class="filter-chip"><select onchange="TaskList.setFilter('assignee',this.value)"><option value="">Assignee</option>
      ${ppl.map(p=>`<option value="${p.id}"${this.filters.assignee===p.id?' selected':''}>${p.name}</option>`).join('')}
      <option value="unassigned"${this.filters.assignee==='unassigned'?' selected':''}>Unassigned</option></select></div>`;
    $('#taskFilters').innerHTML = h;
  },
  renderStats() {
    const s = Store.getStats();
    $('#taskStats').innerHTML = `<span class="stat-chip total">📋 ${s.total}</span><span class="stat-chip overdue">⚠️ ${s.overdue}</span><span class="stat-chip progress">🔵 ${s.inProgress}</span><span class="stat-chip done">✅ ${s.done}</span>`;
  },
  renderList() {
    const grouped = Store.getTasksBySection();
    const search = this.filters.search.toLowerCase();
    let html = '';
    Store.sections.forEach(section => {
      if (this.filters.section && this.filters.section !== section.id) return;
      let tasks = grouped[section.id]?.tasks || [];
      tasks = tasks.filter(t => {
        if (search && !t.name.toLowerCase().includes(search)) return false;
        if (this.filters.priority && t.priority !== this.filters.priority) return false;
        if (this.filters.status && t.status !== this.filters.status) return false;
        if (this.filters.assignee === 'unassigned' && t.assignee) return false;
        if (this.filters.assignee && this.filters.assignee !== 'unassigned' && t.assignee !== this.filters.assignee) return false;
        return true;
      });
      if (tasks.length === 0) return;
      tasks.sort((a,b) => {
        const aOd = isOverdue(a.dueDate, a.status) ? 0 : 1;
        const bOd = isOverdue(b.dueDate, b.status) ? 0 : 1;
        if (aOd !== bOd) return aOd - bOd;
        return (a.dueDate||'9').localeCompare(b.dueDate||'9');
      });
      html += `<div class="section-group" id="sec-${section.id}">
        <div class="section-header" onclick="TaskList.toggleSection('${section.id}')">
          <div class="section-color" style="background:${section.color}"></div>
          <span class="section-name">${section.name}</span>
          <span class="section-count">${tasks.length}</span>
          <span class="section-toggle">▼</span>
        </div><div class="task-items">`;
      tasks.forEach(t => {
        const od = isOverdue(t.dueDate, t.status);
        const assignee = t.assignee ? Store.getPerson(t.assignee) : null;
        const stTotal = (t.subtasks||[]).length;
        const stDone = (t.subtasks||[]).filter(s=>s.done).length;
        html += `<div class="task-card${t.status==='Done'?' status-done':''}${BulkActions.selected.has(t.id)?' selected':''}" data-id="${t.id}"
          draggable="true" ondragstart="TaskList.dragStart(event,'${t.id}')" ondragover="TaskList.dragOver(event)" ondrop="TaskList.drop(event,'${t.id}')" ondragend="TaskList.dragEnd(event)"
          onclick="TaskDetail.open('${t.id}')">
          <div class="task-check ${t.status==='Done'?'done':''}" onclick="event.stopPropagation();TaskList.toggleDone('${t.id}')"
               oncontextmenu="event.preventDefault();event.stopPropagation();BulkActions.toggle('${t.id}')"></div>
          <div class="task-info">
            <div class="task-title">${t.isGate?'🚧 ':''}${t.isMilestone&&!t.isGate?'🏁 ':''}${t.name}</div>
            <div class="task-meta">
              <span class="task-meta-item"><span class="priority-dot ${t.priority.toLowerCase()}"></span>${t.priority}</span>
              <span class="task-meta-item ${od?'overdue':''}">📅 ${formatDate(t.dueDate)}${od?' ⚠️':''}</span>
              ${stTotal?`<span class="subtask-progress"><span class="subtask-progress-bar"><span class="subtask-progress-fill" style="width:${stTotal?stDone/stTotal*100:0}%"></span></span>${stDone}/${stTotal}</span>`:''}
              ${t.tags.slice(0,2).map(tg=>`<span class="tag-badge">${tg}</span>`).join('')}
            </div>
          </div>
          <div class="task-right">
            ${assignee?`<div class="avatar" style="background:${assignee.color}" title="${assignee.name}">${assignee.initials}</div>`:''}
            <span class="status-badge ${t.status==='Done'?'done':t.status==='In Progress'?'in-progress':od?'overdue':'todo'}">${t.status}</span>
          </div>
        </div>`;
      });
      html += '</div></div>';
    });
    if (!html) html = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No tasks found</div></div>';
    $('#taskListContainer').innerHTML = html;
  },
  setFilter(k, v) { this.filters[k] = v; this.render(); },
  onSearch(v) { this.filters.search = v; this.renderList(); },
  toggleSection(id) { $(`#sec-${id}`)?.classList.toggle('collapsed'); },
  toggleDone(id) {
    const t = Store.getTask(id);
    if (!t) return;
    Store.updateTask(id, 'status', t.status === 'Done' ? 'To Do' : 'Done');
    this.render();
    showToast(t.status === 'Done' ? `✅ "${t.name}" completed` : `↩️ "${t.name}" reopened`);
  },
  // Drag and Drop
  _dragId: null,
  dragStart(e, id) { this._dragId = id; e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
  dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
  dragEnd(e) { e.target.classList.remove('dragging'); $$('.drag-over').forEach(el => el.classList.remove('drag-over')); },
  drop(e, targetId) {
    e.preventDefault();
    $$('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (!this._dragId || this._dragId === targetId) return;
    const tasks = Store.tasks;
    const fromIdx = tasks.findIndex(t => t.id === this._dragId);
    const toIdx = tasks.findIndex(t => t.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    Store._save();
    this.renderList();
    showToast('Task reordered');
    this._dragId = null;
  }
};

// ================================================
// TASK DETAIL
// ================================================
const TaskDetail = {
  open(id) {
    const t = Store.getTask(id);
    if (!t) return;
    const section = Store.getSection(t.sectionId);
    const assignee = t.assignee ? Store.getPerson(t.assignee) : null;
    const collabs = (t.collaborators||[]).map(c => Store.getPerson(c)).filter(Boolean);
    const deps = (t.dependencies||[]).map(d => Store.getTask(d)).filter(Boolean);
    const stTotal = (t.subtasks||[]).length;
    const stDone = (t.subtasks||[]).filter(s=>s.done).length;

    let html = `
      <div class="detail-section">
        <div class="detail-field"><div class="detail-field-label">Section</div>
          <div class="detail-field-value"><span class="section-color" style="background:${section?.color||'#ccc'};display:inline-block;width:10px;height:10px;border-radius:50%"></span> ${section?.name||'—'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Status</div>
          <div class="detail-field-value"><select class="form-select" style="width:auto" onchange="TaskDetail.update('${id}','status',this.value)">
            ${['To Do','In Progress','Done','Blocked'].map(s=>`<option${t.status===s?' selected':''}>${s}</option>`).join('')}
          </select></div></div>
        <div class="detail-field"><div class="detail-field-label">Priority</div>
          <div class="detail-field-value"><select class="form-select" style="width:auto" onchange="TaskDetail.update('${id}','priority',this.value)">
            ${['High','Medium','Low'].map(p=>`<option${t.priority===p?' selected':''}>${p}</option>`).join('')}
          </select></div></div>
        <div class="detail-field"><div class="detail-field-label">Assignee</div>
          <div class="detail-field-value"><select class="form-select" style="width:auto" onchange="TaskDetail.update('${id}','assignee',this.value||null)">
            <option value="">Unassigned</option>
            ${Store.people.map(p=>`<option value="${p.id}"${t.assignee===p.id?' selected':''}>${p.name}</option>`).join('')}
          </select></div></div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Dates</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Start Date</label>
            <input type="date" class="form-input" value="${t.startDate||''}" onchange="TaskDetail.update('${id}','startDate',this.value)"></div>
          <div class="form-group"><label class="form-label">Due Date</label>
            <input type="date" class="form-input" value="${t.dueDate||''}" onchange="TaskDetail.update('${id}','dueDate',this.value)"></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Collaborators</div>
        <div class="multi-select-wrap">${collabs.map(c=>`<span class="chip"><span class="avatar" style="background:${c.color};width:16px;height:16px;font-size:0.5rem">${c.initials}</span>${c.name}<span class="remove" onclick="TaskDetail.removeCollab('${id}','${c.id}')">×</span></span>`).join('')}</div>
        <select class="form-select" style="margin-top:6px" onchange="if(this.value){TaskDetail.addCollab('${id}',this.value);this.value=''}">
          <option value="">+ Add collaborator</option>
          ${Store.people.filter(p=>!t.collaborators?.includes(p.id)).map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Subtasks ${stTotal?`(${stDone}/${stTotal})`:''}</div>
        ${stTotal?`<div style="margin-bottom:8px"><div class="subtask-progress-bar" style="width:100%;height:6px"><div class="subtask-progress-fill" style="width:${stTotal?stDone/stTotal*100:0}%"></div></div></div>`:''}
        <div class="subtask-list">
          ${(t.subtasks||[]).map(st=>`<div class="subtask-item${st.done?' done':''}">
            <div class="subtask-check${st.done?' done':''}" onclick="Store.toggleSubtask('${id}','${st.id}');TaskDetail.open('${id}')"></div>
            <span class="subtask-name">${st.name}</span>
            <span class="subtask-remove" onclick="Store.removeSubtask('${id}','${st.id}');TaskDetail.open('${id}')">✕</span>
          </div>`).join('')}
        </div>
        <div class="add-subtask">
          <input type="text" placeholder="Add subtask..." id="newSubtaskInput" onkeydown="if(event.key==='Enter'){TaskDetail.addSubtask('${id}')}">
          <button class="btn btn-sm btn-secondary" onclick="TaskDetail.addSubtask('${id}')">+</button>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Dependencies</div>
        ${deps.length?deps.map(d=>`<div class="task-meta-item" style="padding:4px 0">🔗 ${d.name} <span class="status-badge ${d.status==='Done'?'done':'todo'}" style="margin-left:4px">${d.status}</span></div>`).join(''):'<div style="color:var(--text-light);font-size:0.8rem">No dependencies</div>'}
        <select class="form-select" style="margin-top:6px" onchange="if(this.value){TaskDetail.addDep('${id}',this.value);this.value=''}">
          <option value="">+ Add dependency</option>
          ${Store.tasks.filter(dt=>dt.id!==id&&!(t.dependencies||[]).includes(dt.id)).slice(0,50).map(dt=>`<option value="${dt.id}">${dt.name.slice(0,50)}</option>`).join('')}
        </select>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Notes</div>
        <textarea class="form-textarea" onchange="TaskDetail.update('${id}','notes',this.value)">${t.notes||''}</textarea>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Tracking</div>
        <div class="detail-field"><div class="detail-field-label">Last Updated</div><div class="detail-field-value">${formatDateTime(t.lastUpdated)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Created</div><div class="detail-field-value">${formatDateTime(t.createdAt)}</div></div>
        ${t.completedBy?`<div class="detail-field"><div class="detail-field-label">Completed By</div><div class="detail-field-value">✅ ${t.completedBy} — ${formatDateTime(t.completedAt)}</div></div>`:''}
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Activity Log</div>
        ${(t.activityLog||[]).slice(0,10).map(a=>`<div class="activity-item"><span class="activity-time">${formatDateTime(a.time)}</span><span class="activity-text">${a.action} <em style="opacity:0.6">— ${a.user}</em></span></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-danger btn-sm" onclick="if(confirm('Delete this task?')){Store.deleteTask('${id}');Modal.close();TaskList.render();showToast('Task deleted')}">🗑 Delete</button>
      </div>`;
    Modal.open(t.name, html);
  },
  update(id, field, value) { Store.updateTask(id, field, value); if (Nav.current==='tasks') TaskList.render(); this.open(id); showToast('Updated'); },
  addCollab(tid, pid) { const t=Store.getTask(tid); if(!t)return; const c=[...(t.collaborators||[])]; if(!c.includes(pid))c.push(pid); Store.updateTask(tid,'collaborators',c); this.open(tid); },
  removeCollab(tid, pid) { const t=Store.getTask(tid); if(!t)return; Store.updateTask(tid,'collaborators',(t.collaborators||[]).filter(c=>c!==pid)); this.open(tid); },
  addDep(tid, did) { const t=Store.getTask(tid); if(!t)return; const d=[...(t.dependencies||[])]; if(!d.includes(did))d.push(did); Store.updateTask(tid,'dependencies',d); this.open(tid); },
  addSubtask(tid) {
    const input = $('#newSubtaskInput');
    if (!input || !input.value.trim()) return;
    Store.addSubtask(tid, input.value.trim());
    this.open(tid);
  }
};

// ================================================
// ADD TASK MODAL
// ================================================
const TaskModal = {
  open() {
    let html = `
      <div class="form-group"><label class="form-label">Task Name *</label><input type="text" class="form-input" id="newTaskName" placeholder="What needs to be done?"></div>
      <div class="form-group"><label class="form-label">Section</label><select class="form-select" id="newTaskSection">${Store.sections.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" id="newTaskStart"></div>
        <div class="form-group"><label class="form-label">Due Date</label><input type="date" class="form-input" id="newTaskDue"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="newTaskPriority"><option value="High">🔴 High</option><option value="Medium" selected>🟡 Medium</option><option value="Low">🟢 Low</option></select></div>
        <div class="form-group"><label class="form-label">Assignee</label><select class="form-select" id="newTaskAssignee"><option value="">Unassigned</option>${Store.people.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Tags</label><input type="text" class="form-input" id="newTaskTags" placeholder="e.g. Gestão, Comunicação"></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="newTaskNotes" rows="2"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="TaskModal.save()">Create Task</button>`;
    Modal.open('Add Task', html);
    setTimeout(() => $('#newTaskName')?.focus(), 100);
  },
  save() {
    const name = $('#newTaskName')?.value?.trim();
    if (!name) { showToast('Task name is required'); return; }
    const task = Store.addTask({
      name, sectionId: $('#newTaskSection')?.value,
      startDate: $('#newTaskStart')?.value||'', dueDate: $('#newTaskDue')?.value||'',
      priority: $('#newTaskPriority')?.value||'Medium',
      assignee: $('#newTaskAssignee')?.value||null,
      tags: ($('#newTaskTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean),
      notes: $('#newTaskNotes')?.value||''
    });
    Modal.close(); TaskList.render(); showToast(`✅ "${task.name}" created`);
  }
};


// ================================================
// GANTT CHART (with dependency arrows)
// ================================================
const Gantt = {
  filterSection: '',
  render() {
    this.renderControls();
    this.renderChart();
  },
  renderControls() {
    let h = `<div class="filter-chip${!this.filterSection?' active':''}" onclick="Gantt.filterSection='';Gantt.render()">All</div>`;
    Store.sections.forEach(s => {
      h += `<div class="filter-chip${this.filterSection===s.id?' active':''}" onclick="Gantt.filterSection='${s.id}';Gantt.render()" style="${this.filterSection===s.id?'background:'+s.color+';color:white;border-color:'+s.color:''}">${s.name}</div>`;
    });
    $('#ganttControls').innerHTML = h;
  },
  renderChart() {
    const tasks = Store.tasks.filter(t => {
      if (this.filterSection && t.sectionId !== this.filterSection) return false;
      return t.dueDate;
    });
    if (!tasks.length) { $('#ganttContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No tasks to display</div></div>'; return; }

    const allDates = tasks.flatMap(t => [t.startDate, t.dueDate].filter(Boolean)).map(d => new Date(d));
    const minDate = new Date(Math.min(...allDates)); minDate.setDate(minDate.getDate() - 3);
    const maxDate = new Date(Math.max(...allDates)); maxDate.setDate(maxDate.getDate() + 7);
    const totalDays = daysBetween(minDate, maxDate);
    const dayWidth = 28;
    const labelWidth = 200;
    const rowHeight = 28;
    const today = new Date().toISOString().slice(0,10);

    let headerHtml = '';
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate.getTime() + i * dayMs);
      const iso = d.toISOString().slice(0,10);
      const dow = d.getDay();
      headerHtml += `<div class="gantt-day${dow===0||dow===6?' weekend':''}${iso===today?' today':''}" data-date="${iso}">${d.getDate()}</div>`;
    }

    const grouped = Store.getTasksBySection();
    let rowsHtml = '';
    let rowIndex = 0;
    const taskRowMap = {};
    const taskBarMap = {};
    const visibleSections = this.filterSection ? [Store.getSection(this.filterSection)] : Store.sections;

    visibleSections.forEach(section => {
      const secTasks = (grouped[section.id]?.tasks||[]).filter(t => t.dueDate).sort((a,b) => (a.startDate||a.dueDate).localeCompare(b.startDate||b.dueDate));
      if (!secTasks.length) return;
      rowsHtml += `<div class="gantt-row gantt-row-section"><div class="gantt-label-col">${section.name}</div><div class="gantt-bars" style="background:var(--bg)"></div></div>`;
      rowIndex++;
      secTasks.forEach(t => {
        const sd = t.startDate || t.dueDate;
        const ed = t.dueDate;
        const startOff = daysBetween(minDate, new Date(sd));
        const dur = Math.max(1, daysBetween(new Date(sd), new Date(ed)) + 1);
        const left = startOff * dayWidth;
        const width = dur * dayWidth - 2;
        let barColor = section.color;
        if (t.status === 'Done') barColor = '#00875A';
        else if (isOverdue(t.dueDate, t.status)) barColor = '#DE350B';
        const cls = t.isMilestone && !t.isGate ? 'gantt-bar milestone' : 'gantt-bar';

        taskRowMap[t.id] = rowIndex;
        taskBarMap[t.id] = { left: left + labelWidth, right: left + width + labelWidth, top: rowIndex * rowHeight + rowHeight/2 };

        rowsHtml += `<div class="gantt-row"><div class="gantt-label-col" onclick="TaskDetail.open('${t.id}')"><span class="priority-dot ${t.priority.toLowerCase()}" style="margin-right:4px"></span>${t.name}</div>
          <div class="gantt-bars"><div class="${cls}" style="left:${left}px;width:${width}px;background:${barColor}" title="${t.name}" onclick="TaskDetail.open('${t.id}')" data-task-id="${t.id}"></div></div></div>`;
        rowIndex++;
      });
    });

    const todayOff = daysBetween(minDate, new Date(today));
    const todayLeft = todayOff * dayWidth + dayWidth / 2;
    const totalHeight = (rowIndex + 1) * rowHeight;

    // Build SVG dependency arrows
    let svgPaths = '';
    tasks.forEach(t => {
      (t.dependencies||[]).forEach(depId => {
        const from = taskBarMap[depId];
        const to = taskBarMap[t.id];
        if (!from || !to) return;
        const x1 = from.right;
        const y1 = from.top;
        const x2 = to.left;
        const y2 = to.top;
        const midX = (x1 + x2) / 2;
        svgPaths += `<path d="M${x1-labelWidth},${y1} C${midX-labelWidth},${y1} ${midX-labelWidth},${y2} ${x2-labelWidth},${y2}" data-from="${depId}" data-to="${t.id}"/>`;
        svgPaths += `<circle cx="${x2-labelWidth}" cy="${y2}" r="3" data-from="${depId}" data-to="${t.id}"/>`;
      });
    });

    const svgWidth = totalDays * dayWidth;
    const svgHtml = svgPaths ? `<svg class="gantt-dep-svg" width="${svgWidth}" height="${totalHeight}" style="left:${labelWidth}px">${svgPaths}</svg>` : '';

    $('#ganttContainer').innerHTML = `
      <div style="min-width:${labelWidth + totalDays * dayWidth}px;position:relative">
        <div class="gantt-header-row"><div class="gantt-label-col">Task</div><div class="gantt-timeline" style="display:flex">${headerHtml}</div></div>
        ${rowsHtml}
        ${svgHtml}
        <div class="gantt-today-line" style="left:${labelWidth + todayLeft}px;height:${totalHeight}px"></div>
      </div>`;

    // Hover highlight for dependency arrows
    $$('.gantt-bar').forEach(bar => {
      bar.addEventListener('mouseenter', () => {
        const tid = bar.dataset.taskId;
        $$('.gantt-dep-svg path, .gantt-dep-svg circle').forEach(p => {
          if (p.dataset.from === tid || p.dataset.to === tid) { p.classList.add('highlight'); }
        });
      });
      bar.addEventListener('mouseleave', () => {
        $$('.gantt-dep-svg path.highlight, .gantt-dep-svg circle.highlight').forEach(p => p.classList.remove('highlight'));
      });
    });
  }
};

// ================================================
// CALENDAR
// ================================================
const Calendar = {
  year: 2026, month: 10,
  render() { this.renderHeader(); this.renderGrid(); },
  renderHeader() {
    const mn = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    $('#calendarHeader').innerHTML = `
      <div class="calendar-nav"><button onclick="Calendar.prev()">◀</button></div>
      <div class="calendar-title">${mn[this.month]} ${this.year}</div>
      <div class="calendar-nav"><button onclick="Calendar.next()">▶</button><button onclick="Calendar.goToday()" style="font-size:0.72rem;width:auto;padding:0 10px">Today</button></div>`;
  },
  renderGrid() {
    const dn = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    let html = dn.map(d=>`<div class="calendar-day-name">${d}</div>`).join('');
    const firstDay = new Date(this.year, this.month, 1);
    let startDow = firstDay.getDay()-1; if(startDow<0)startDow=6;
    const daysInMonth = new Date(this.year, this.month+1, 0).getDate();
    const today = new Date().toISOString().slice(0,10);
    const taskMap = {};
    Store.tasks.forEach(t => { if(!t.dueDate)return; if(!taskMap[t.dueDate])taskMap[t.dueDate]=[]; taskMap[t.dueDate].push(t); });
    const prevDays = new Date(this.year, this.month, 0).getDate();
    for(let i=startDow-1;i>=0;i--) html+=`<div class="calendar-cell other-month"><div class="calendar-date">${prevDays-i}</div></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const iso=`${this.year}-${String(this.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday=iso===today;
      const dt=taskMap[iso]||[];
      html+=`<div class="calendar-cell${isToday?' today':''}" onclick="Calendar.showDay('${iso}')"><div class="calendar-date">${d}</div>`;
      dt.slice(0,3).forEach(t=>{const sec=Store.getSection(t.sectionId); html+=`<div class="calendar-task-dot" style="background:${sec?.color||'#999'}" onclick="event.stopPropagation();TaskDetail.open('${t.id}')">${t.name}</div>`;});
      if(dt.length>3)html+=`<div class="calendar-more">+${dt.length-3} more</div>`;
      html+='</div>';
    }
    const rem=(7-(startDow+daysInMonth)%7)%7;
    for(let i=1;i<=rem;i++) html+=`<div class="calendar-cell other-month"><div class="calendar-date">${i}</div></div>`;
    $('#calendarGrid').innerHTML=html;
  },
  prev() { this.month--; if(this.month<0){this.month=11;this.year--;} this.render(); },
  next() { this.month++; if(this.month>11){this.month=0;this.year++;} this.render(); },
  goToday() { const n=new Date(); this.year=n.getFullYear(); this.month=n.getMonth(); this.render(); },
  showDay(iso) {
    const tasks = Store.tasks.filter(t=>t.dueDate===iso);
    if(!tasks.length){showToast(`No tasks on ${formatDate(iso)}`);return;}
    let html=tasks.map(t=>{const sec=Store.getSection(t.sectionId);return`<div class="task-card" onclick="Modal.close();setTimeout(()=>TaskDetail.open('${t.id}'),300)"><div class="task-check ${t.status==='Done'?'done':''}"></div><div class="task-info"><div class="task-title">${t.name}</div><div class="task-meta"><span class="tag-badge" style="background:${sec?.color||'#999'};color:white">${sec?.name||''}</span></div></div></div>`;}).join('');
    Modal.open(`Tasks — ${formatDate(iso)}`,html);
  }
};

// ================================================
// FILES
// ================================================
const Files = {
  render() {
    const files = Store.files;
    const used = files.reduce((a,f)=>a+(f.size||0),0);
    const max = 50*1024*1024;
    let html = `<div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()"><div class="drop-zone-icon">📤</div><div class="drop-zone-text">Drag & drop files or tap to upload</div><div class="drop-zone-hint">Up to 10 MB each</div><input type="file" id="fileInput" multiple style="display:none" onchange="Files.handleUpload(this.files)"></div>
      <div class="storage-bar"><div class="storage-bar-label">${formatBytes(used)} / ${formatBytes(max)}</div><div class="storage-bar-track"><div class="storage-bar-fill" style="width:${Math.min(100,used/max*100)}%"></div></div></div><div class="file-list">`;
    if(!files.length) html+='<div class="empty-state"><div class="empty-state-icon">📂</div><div class="empty-state-title">No files yet</div></div>';
    else {
      files.sort((a,b)=>(b.uploadedAt||'').localeCompare(a.uploadedAt||''));
      files.forEach(f=>{
        const ic=f.type?.startsWith('image')?'image':f.type?.includes('pdf')?'pdf':f.type?.includes('sheet')||f.type?.includes('excel')?'sheet':f.type?.includes('word')?'doc':'other';
        const emoji=ic==='image'?'🖼️':ic==='pdf'?'📄':ic==='sheet'?'📊':ic==='doc'?'📝':'📎';
        html+=`<div class="file-card"><div class="file-icon ${ic}">${emoji}</div><div class="file-info"><div class="file-name">${f.name}</div><div class="file-meta-line">${formatBytes(f.size||0)} · ${formatDateTime(f.uploadedAt)}</div></div><div class="file-actions">${f.dataUrl?`<button onclick="event.stopPropagation();Files.download('${f.id}')" title="Download">⬇</button>`:''}<button onclick="event.stopPropagation();Files.delete('${f.id}')" title="Delete">🗑</button></div></div>`;
      });
    }
    html+='</div>';
    $('#filesContainer').innerHTML=html;
    const dz=$('#dropZone');
    if(dz){
      dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
      dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
      dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');this.handleUpload(e.dataTransfer.files);});
    }
  },
  handleUpload(fileList) {
    Array.from(fileList).forEach(file=>{
      if(file.size>10*1024*1024){showToast(`${file.name} too large`);return;}
      const reader=new FileReader();
      reader.onload=e=>{
        Store.addFile({id:fileUuid(),name:file.name,size:file.size,type:file.type,dataUrl:e.target.result,taskId:null,taskTitle:'General',notes:'',uploadedAt:new Date().toISOString(),uploadedBy:'You'});
        this.render(); showToast(`📎 "${file.name}" uploaded`); this.updateBadge();
      };
      reader.readAsDataURL(file);
    });
  },
  download(id) { const f=Store.files.find(fi=>fi.id===id); if(!f||!f.dataUrl)return; const a=document.createElement('a'); a.href=f.dataUrl; a.download=f.name; a.click(); },
  delete(id) { if(!confirm('Delete this file?'))return; Store.deleteFile(id); this.render(); this.updateBadge(); showToast('File deleted'); },
  updateBadge() { const c=Store.files.length; const b=$('#fileBadge'); if(c>0){b.style.display='flex';b.textContent=c;}else{b.style.display='none';} }
};

// ================================================
// CSV IMPORT/EXPORT
// ================================================
const CSVModule = {
  export() {
    const csv = Store.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leixoes-119-tasks.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📥 CSV exported');
  },
  importPrompt() {
    let html = `
      <div class="form-group">
        <label class="form-label">Select CSV File</label>
        <input type="file" accept=".csv" class="form-input" id="csvFileInput">
        <div class="form-hint" style="margin-top:8px">Expected columns: Section, Task Name, Due Date, Priority, Tags</div>
      </div>
      <button class="btn btn-primary btn-block" onclick="CSVModule.doImport()">Import</button>`;
    Modal.open('📤 Import CSV', html);
  },
  doImport() {
    const input = $('#csvFileInput');
    if (!input || !input.files.length) { showToast('Select a file'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const count = Store.importCSV(e.target.result);
      Modal.close();
      TaskList.render();
      showToast(`📤 ${count} tasks imported`);
    };
    reader.readAsText(input.files[0]);
  }
};

// ================================================
// KEYBOARD SHORTCUTS
// ================================================
const Shortcuts = {
  init() {
    document.addEventListener('keydown', e => {
      // Don't trigger when typing in inputs
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); Nav.go('tasks'); setTimeout(()=>$('#taskSearch')?.focus(), 100); return; }
      if (e.key === 'Escape') { Modal.close(); $('#shortcutOverlay')?.classList.remove('open'); return; }
      if (e.key === '?') { this.showHelp(); return; }
      if (e.key === 'n' || e.key === 'N') { TaskModal.open(); return; }
      if (e.key === 'd' || e.key === 'D') { Theme.toggle(); return; }
      if (e.key === '1') { Nav.go('dashboard'); return; }
      if (e.key === '2') { Nav.go('tasks'); return; }
      if (e.key === '3') { Nav.go('gantt'); return; }
      if (e.key === '4') { Nav.go('calendar'); return; }
      if (e.key === '5') { Nav.go('files'); return; }
    });
  },
  showHelp() {
    const overlay = $('#shortcutOverlay');
    if (overlay) overlay.classList.toggle('open');
  }
};

// ================================================
// NOTIFICATIONS
// ================================================
const Notifications = {
  init() {
    if (!('Notification' in window)) return;
    // Check periodically for overdue
    this.check();
    setInterval(() => this.check(), 60 * 60 * 1000); // Every hour
  },
  async requestPermission() {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },
  async check() {
    const allowed = await this.requestPermission();
    if (!allowed) return;
    const today = new Date().toISOString().slice(0,10);
    const tomorrow = new Date(Date.now() + dayMs).toISOString().slice(0,10);
    const overdue = Store.tasks.filter(t => isOverdue(t.dueDate, t.status));
    const dueTomorrow = Store.tasks.filter(t => t.dueDate === tomorrow && t.status !== 'Done');

    // Only notify once per session
    if (this._notified) return;
    this._notified = true;

    if (overdue.length > 0) {
      new Notification('⚠️ Leixões 119 PM', { body: `${overdue.length} task(s) are overdue`, icon: '/project-management/icons/icon.svg' });
    }
    if (dueTomorrow.length > 0) {
      new Notification('📅 Leixões 119 PM', { body: `${dueTomorrow.length} task(s) due tomorrow`, icon: '/project-management/icons/icon.svg' });
    }
  }
};

// ================================================
// APP-LEVEL FUNCTIONS
// ================================================
const App = {
  showStats() { Nav.go('dashboard'); },

  exportData() {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leixoes-119-project.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('📥 Data exported as JSON');
  },

  showExportImport() {
    let html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <button class="btn btn-secondary btn-block" onclick="App.exportData();Modal.close()">💾 Export JSON</button>
        <button class="btn btn-secondary btn-block" onclick="CSVModule.export();Modal.close()">📊 Export CSV</button>
        <button class="btn btn-secondary btn-block" onclick="Modal.close();CSVModule.importPrompt()">📤 Import CSV</button>
        <hr style="border:none;border-top:1px solid var(--border-light)">
        <button class="btn btn-danger btn-block" onclick="if(confirm('Reset all data?')){localStorage.removeItem(Store.LS_KEY);location.reload();}">🔄 Reset to Default</button>
      </div>`;
    Modal.open('Import / Export', html);
  },

  showSettings() {
    const isDark = Theme.isDark();
    let html = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600">🌙 Dark Mode</span>
          <button class="btn btn-sm ${isDark?'btn-primary':'btn-secondary'}" onclick="Theme.toggle();App.showSettings()">${isDark?'On':'Off'}</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600">🔔 Notifications</span>
          <button class="btn btn-sm btn-secondary" onclick="Notifications.requestPermission().then(r=>{showToast(r?'Notifications enabled':'Notifications blocked')})">Enable</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-light);padding-top:8px;border-top:1px solid var(--border-light)">
          <strong>Keyboard Shortcuts:</strong> Press <kbd class="kbd">?</kbd> to see all shortcuts
        </div>
      </div>`;
    Modal.open('⚙️ Settings', html);
  }
};

// ================================================
// INITIALIZATION
// ================================================
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Store.init();
  Nav.init();
  Files.updateBadge();
  Shortcuts.init();
  Notifications.init();
  Calendar.year = 2026;
  Calendar.month = 10;

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/project-management/sw.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.log('SW registration failed:', err));
  }
});
