'use strict';

/* ------------------------------------------------------------------
   Plateforme éducative - version démo
   Les données sont stockées dans le navigateur (localStorage).
   Aucun mot de passe n'est utilisé : le profil est choisi dans la liste.
   ------------------------------------------------------------------ */

const STORE_KEY = 'site-educatif-v1';
const SESSION_KEY = 'site-educatif-profil';
const MAX_FILE = 400 * 1024; // 400 Ko : le stockage du navigateur est limité (~5 Mo)

// Types de fichiers acceptés (liste blanche)
const ALLOWED = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'text/plain': 'TXT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX'
};
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.docx';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TYPES = { cours: 'Cours', sujet: 'Sujet' };

/* ----------------------------- Outils ----------------------------- */

// Crée un élément DOM sans jamais utiliser innerHTML (protection contre le XSS)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clean(s, max) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSize(bytes) {
  return bytes < 1024 ? bytes + ' o' : Math.round(bytes / 1024) + ' Ko';
}

/* ----------------------------- Données ---------------------------- */

function seed() {
  const m = { res: uid(), sec: uid(), web: uid(), bdd: uid() };
  const p = { a: uid(), b: uid() };
  const now = new Date().toISOString();
  return {
    matieres: [
      { id: m.res, nom: 'Réseaux' },
      { id: m.sec, nom: 'Sécurité informatique' },
      { id: m.web, nom: 'Développement web' },
      { id: m.bdd, nom: 'Bases de données' }
    ],
    profs: [
      { id: p.a, nom: 'Amina Omar' },
      { id: p.b, nom: 'Youssouf Ahmed' }
    ],
    documents: [
      {
        id: uid(), titre: 'Introduction aux réseaux : le modèle OSI', matiereId: m.res, profId: p.a,
        type: 'cours', description: 'Les 7 couches du modèle OSI avec des exemples simples.',
        date: now, fichier: null
      },
      {
        id: uid(), titre: 'Examen blanc : sécurité des mots de passe', matiereId: m.sec, profId: p.b,
        type: 'sujet', description: 'Sujet de 1 h 30 sur le hachage et les bonnes pratiques.',
        date: now, fichier: null
      },
      {
        id: uid(), titre: 'HTML et CSS : première page', matiereId: m.web, profId: p.a,
        type: 'cours', description: 'Structure d\'une page, balises de base et mise en forme.',
        date: now, fichier: null
      }
    ],
    planning: [
      { id: uid(), profId: p.a, jour: 'Lundi', debut: '08:00', fin: '10:00', matiereId: m.res, salle: 'Salle 1' },
      { id: uid(), profId: p.b, jour: 'Mardi', debut: '10:00', fin: '12:00', matiereId: m.sec, salle: 'Salle 3' },
      { id: uid(), profId: p.a, jour: 'Jeudi', debut: '14:00', fin: '16:00', matiereId: m.web, salle: 'Labo informatique' }
    ]
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.matieres) && Array.isArray(d.profs) &&
          Array.isArray(d.documents) && Array.isArray(d.planning)) return d;
    }
  } catch (e) { /* stockage indisponible ou données abîmées : on repart de la démo */ }
  return seed();
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    return false;
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignoré */ }
  return { role: 'etudiant' };
}

function saveSession() {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignoré */ }
}

let db = load();
let session = loadSession();
if (session.role === 'prof' && !db.profs.some(p => p.id === session.profId)) session = { role: 'etudiant' };
if (!['etudiant', 'prof', 'admin'].includes(session.role)) session = { role: 'etudiant' };

let tab = defaultTab(session.role);
let msg = null;
let docFilter = { q: '', matiere: '', type: '' };
let planFilterProf = '';

const matiereNom = id => (db.matieres.find(m => m.id === id) || { nom: 'Matière supprimée' }).nom;
const profNom = id => (db.profs.find(p => p.id === id) || { nom: 'Professeur supprimé' }).nom;

/* ----------------------------- Navigation ------------------------- */

function defaultTab(role) {
  return { etudiant: 'documents', prof: 'publier', admin: 'matieres' }[role];
}

function tabsFor(role) {
  if (role === 'prof') {
    return [
      { id: 'publier', label: 'Publier un document' },
      { id: 'monplanning', label: 'Mon planning' },
      { id: 'documents', label: 'Tous les documents' }
    ];
  }
  if (role === 'admin') {
    return [
      { id: 'matieres', label: 'Matières' },
      { id: 'profs', label: 'Professeurs' },
      { id: 'documents', label: 'Documents' }
    ];
  }
  return [
    { id: 'documents', label: 'Cours et sujets' },
    { id: 'planning', label: 'Planning' }
  ];
}

function profileValue() {
  return session.role === 'prof' ? 'prof:' + session.profId : session.role;
}

function switchProfile(value) {
  if (value.startsWith('prof:')) session = { role: 'prof', profId: value.slice(5) };
  else session = { role: value === 'admin' ? 'admin' : 'etudiant' };
  saveSession();
  tab = defaultTab(session.role);
  msg = null;
  render();
}

function say(type, text) {
  msg = { type, text };
}

/* ----------------------------- Rendu général ---------------------- */

const app = document.getElementById('app');

function render() {
  app.replaceChildren(headerEl(), navEl(), h('main', { id: 'contenu' }, h('div', { class: 'wrap' }, msgEl(), mainEl())), footerEl());
}

function headerEl() {
  const select = h('select', {
    id: 'profil',
    onchange: e => switchProfile(e.target.value)
  },
    h('option', { value: 'etudiant' }, 'Étudiant'),
    h('option', { value: 'admin' }, 'Administrateur'),
    db.profs.map(p => h('option', { value: 'prof:' + p.id }, 'Professeur · ' + p.nom))
  );
  select.value = profileValue();
  return h('header', { class: 'top' },
    h('div', { class: 'wrap' },
      h('h1', {}, 'Plateforme éducative', h('small', {}, 'Cours, sujets et plannings au même endroit')),
      h('div', { class: 'profil' }, h('label', { for: 'profil' }, 'Profil (démo) :'), select)
    )
  );
}

function navEl() {
  return h('nav', { class: 'tabs', 'aria-label': 'Sections' },
    h('div', { class: 'wrap' },
      tabsFor(session.role).map(t => h('button', {
        type: 'button',
        'aria-current': t.id === tab ? 'page' : null,
        onclick: () => { tab = t.id; msg = null; render(); }
      }, t.label))
    )
  );
}

function msgEl() {
  if (!msg) return null;
  return h('div', { class: 'msg ' + msg.type, role: msg.type === 'err' ? 'alert' : 'status' }, msg.text);
}

function footerEl() {
  return h('footer', { class: 'bottom' },
    h('div', { class: 'wrap' },
      h('span', {}, 'Version de démonstration : les données restent dans ce navigateur. Aucun mot de passe n\'est utilisé.'),
      h('button', {
        type: 'button', class: 'btn small ghost',
        onclick: () => {
          if (confirm('Remettre les données de démonstration ? Tes documents et plannings seront effacés.')) {
            db = seed();
            save();
            session = { role: 'etudiant' };
            saveSession();
            tab = defaultTab('etudiant');
            say('ok', 'Les données de démonstration ont été remises à zéro.');
            render();
          }
        }
      }, 'Réinitialiser la démo')
    )
  );
}

function mainEl() {
  const views = {
    documents: () => documentsView({ canDelete: session.role === 'admin' }),
    planning: () => planningView({ editableProfId: null }),
    publier: () => publishView(),
    monplanning: () => planningView({ editableProfId: session.profId }),
    matieres: () => matieresView(),
    profs: () => profsView()
  };
  return (views[tab] || views.documents)();
}

/* ----------------------------- Documents -------------------------- */

function documentsView({ canDelete = false, profId = null, title = 'Cours et sujets', lead = 'Recherche un document par mot, matière ou type.' } = {}) {
  const list = h('div', { class: 'cards' });

  function refresh() {
    const f = docFilter;
    const q = f.q.toLowerCase();
    const items = db.documents
      .filter(d => (!profId || d.profId === profId) &&
        (!f.matiere || d.matiereId === f.matiere) &&
        (!f.type || d.type === f.type) &&
        (!q || (d.titre + ' ' + d.description).toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!items.length) {
      list.replaceChildren(h('p', { class: 'empty' }, 'Aucun document ne correspond.'));
      return;
    }
    list.replaceChildren(...items.map(d => docCard(d, canDelete)));
  }

  const search = h('input', {
    type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Rechercher', value: docFilter.q, maxlength: 60,
    oninput: e => { docFilter.q = e.target.value; refresh(); }
  });
  const matSel = h('select', {
    'aria-label': 'Filtrer par matière',
    onchange: e => { docFilter.matiere = e.target.value; refresh(); }
  }, h('option', { value: '' }, 'Toutes les matières'), db.matieres.map(m => h('option', { value: m.id }, m.nom)));
  matSel.value = docFilter.matiere;
  const typeSel = h('select', {
    'aria-label': 'Filtrer par type',
    onchange: e => { docFilter.type = e.target.value; refresh(); }
  }, h('option', { value: '' }, 'Cours et sujets'), h('option', { value: 'cours' }, 'Cours'), h('option', { value: 'sujet' }, 'Sujets'));
  typeSel.value = docFilter.type;

  refresh();
  return h('section', {},
    h('h2', {}, title),
    h('p', { class: 'lead' }, lead),
    h('div', { class: 'filters' }, search, matSel, typeSel),
    list
  );
}

function fileLink(d) {
  const f = d.fichier;
  // On ne crée le lien que si le fichier est bien un type autorisé (données du navigateur non fiables)
  const valid = f && ALLOWED[f.type] && typeof f.data === 'string' && f.data.startsWith('data:' + f.type + ';base64,');
  if (!valid) return h('span', { class: 'meta' }, 'Pas de fichier joint');
  return h('a', { class: 'btn small', href: f.data, download: clean(f.nom, 80) || 'document' },
    'Télécharger (' + ALLOWED[f.type] + ', ' + formatSize(f.taille || 0) + ')');
}

function docCard(d, canDelete) {
  return h('article', { class: 'card' },
    h('h4', {}, d.titre),
    h('div', {},
      h('span', { class: 'badge ' + (d.type === 'sujet' ? 'sujet' : '') }, TYPES[d.type] || 'Document'),
      h('span', { class: 'badge' }, matiereNom(d.matiereId))
    ),
    h('p', { class: 'meta' }, 'Par ' + profNom(d.profId) + ' · ' + formatDate(d.date)),
    d.description ? h('p', {}, d.description) : null,
    h('div', { class: 'actions' },
      fileLink(d),
      (canDelete || (session.role === 'prof' && d.profId === session.profId))
        ? h('button', {
            type: 'button', class: 'btn small danger',
            onclick: () => {
              if (!confirm('Supprimer « ' + d.titre + ' » ?')) return;
              db.documents = db.documents.filter(x => x.id !== d.id);
              save();
              say('ok', 'Document supprimé.');
              render();
            }
          }, 'Supprimer')
        : null
    )
  );
}

function publishView() {
  const prof = db.profs.find(p => p.id === session.profId);
  if (!prof) return h('p', { class: 'empty' }, 'Choisis un professeur dans le profil.');

  const titre = h('input', { id: 'f-titre', type: 'text', required: true, maxlength: 100 });
  const matiere = h('select', { id: 'f-matiere', required: true }, db.matieres.map(m => h('option', { value: m.id }, m.nom)));
  const type = h('select', { id: 'f-type' }, h('option', { value: 'cours' }, 'Cours'), h('option', { value: 'sujet' }, 'Sujet'));
  const desc = h('textarea', { id: 'f-desc', maxlength: 500 });
  const file = h('input', { id: 'f-file', type: 'file', accept: ACCEPT });

  const form = h('form', {
    class: 'grid',
    onsubmit: async e => {
      e.preventDefault();
      const t = clean(titre.value, 100);
      if (!t) { say('err', 'Le titre est obligatoire.'); render(); return; }
      if (!db.matieres.length) { say('err', 'Aucune matière n\'existe. Demande à l\'administrateur d\'en ajouter.'); render(); return; }

      let fichier = null;
      const f = file.files[0];
      if (f) {
        if (!ALLOWED[f.type]) { say('err', 'Type de fichier non accepté. Formats : PDF, PNG, JPEG, TXT, DOCX.'); render(); return; }
        if (f.size > MAX_FILE) { say('err', 'Fichier trop gros (' + formatSize(f.size) + '). Maximum : ' + formatSize(MAX_FILE) + ' dans cette démo.'); render(); return; }
        try {
          const data = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          });
          fichier = { nom: clean(f.name, 80), type: f.type, taille: f.size, data };
        } catch (err) {
          say('err', 'Impossible de lire le fichier.'); render(); return;
        }
      }

      db.documents.push({
        id: uid(), titre: t, matiereId: matiere.value, profId: prof.id,
        type: type.value === 'sujet' ? 'sujet' : 'cours',
        description: clean(desc.value, 500), date: new Date().toISOString(), fichier
      });
      if (!save()) {
        db.documents.pop();
        say('err', 'Stockage plein : supprime d\'anciens documents ou choisis un fichier plus petit.');
      } else {
        say('ok', 'Document publié.');
      }
      render();
    }
  },
    h('div', { class: 'field full' }, h('label', { for: 'f-titre' }, 'Titre'), titre),
    h('div', { class: 'field' }, h('label', { for: 'f-matiere' }, 'Matière'), matiere),
    h('div', { class: 'field' }, h('label', { for: 'f-type' }, 'Type'), type),
    h('div', { class: 'field full' }, h('label', { for: 'f-desc' }, 'Description (facultative)'), desc),
    h('div', { class: 'field full' },
      h('label', { for: 'f-file' }, 'Fichier (facultatif)'), file,
      h('span', { class: 'hint' }, 'PDF, PNG, JPEG, TXT ou DOCX · maximum ' + formatSize(MAX_FILE) + ' dans cette démo.')
    ),
    h('div', { class: 'full' }, h('button', { type: 'submit', class: 'btn' }, 'Publier'))
  );

  return h('section', {},
    h('h2', {}, 'Publier un document'),
    h('p', { class: 'lead' }, 'Connecté en tant que ' + prof.nom + '.'),
    h('div', { class: 'panel' }, form),
    h('h3', {}, 'Mes documents'),
    documentsListFor(prof.id)
  );
}

function documentsListFor(profId) {
  const items = db.documents.filter(d => d.profId === profId).sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return h('p', { class: 'empty' }, 'Tu n\'as pas encore publié de document.');
  return h('div', { class: 'cards' }, items.map(d => docCard(d, false)));
}

/* ----------------------------- Planning --------------------------- */

function planningView({ editableProfId }) {
  const editable = !!editableProfId;
  let slots = db.planning.slice();
  if (editable) slots = slots.filter(s => s.profId === editableProfId);
  else if (planFilterProf) slots = slots.filter(s => s.profId === planFilterProf);

  slots.sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour) || a.debut.localeCompare(b.debut));

  const rows = slots.map(s => h('tr', {},
    h('td', {}, s.jour),
    h('td', {}, s.debut + ' – ' + s.fin),
    h('td', {}, matiereNom(s.matiereId)),
    editable ? null : h('td', {}, profNom(s.profId)),
    h('td', {}, s.salle || '—'),
    editable ? h('td', {}, h('button', {
      type: 'button', class: 'btn small danger',
      onclick: () => {
        db.planning = db.planning.filter(x => x.id !== s.id);
        save();
        say('ok', 'Créneau supprimé.');
        render();
      }
    }, 'Supprimer')) : null
  ));

  const table = slots.length
    ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Jour'), h('th', {}, 'Horaire'), h('th', {}, 'Matière'),
          editable ? null : h('th', {}, 'Professeur'), h('th', {}, 'Salle'), editable ? h('th', {}, '') : null)),
        h('tbody', {}, rows)))
    : h('p', { class: 'empty' }, 'Aucun créneau pour le moment.');

  let filter = null;
  if (!editable) {
    const sel = h('select', {
      'aria-label': 'Filtrer par professeur',
      onchange: e => { planFilterProf = e.target.value; render(); }
    }, h('option', { value: '' }, 'Tous les professeurs'), db.profs.map(p => h('option', { value: p.id }, p.nom)));
    sel.value = planFilterProf;
    filter = h('div', { class: 'filters' }, sel);
  }

  return h('section', {},
    h('h2', {}, editable ? 'Mon planning' : 'Planning des professeurs'),
    h('p', { class: 'lead' }, editable ? 'Ajoute ou supprime tes créneaux.' : 'Consulte les créneaux de chaque professeur.'),
    filter,
    table,
    editable ? planningForm(editableProfId) : null
  );
}

function planningForm(profId) {
  const jour = h('select', { id: 'p-jour' }, JOURS.map(j => h('option', { value: j }, j)));
  const debut = h('input', { id: 'p-debut', type: 'time', required: true, value: '08:00' });
  const fin = h('input', { id: 'p-fin', type: 'time', required: true, value: '10:00' });
  const matiere = h('select', { id: 'p-matiere', required: true }, db.matieres.map(m => h('option', { value: m.id }, m.nom)));
  const salle = h('input', { id: 'p-salle', type: 'text', maxlength: 30 });

  const form = h('form', {
    class: 'grid',
    onsubmit: e => {
      e.preventDefault();
      if (!db.matieres.length) { say('err', 'Aucune matière n\'existe. Demande à l\'administrateur d\'en ajouter.'); render(); return; }
      if (!debut.value || !fin.value || debut.value >= fin.value) {
        say('err', 'L\'heure de fin doit être après l\'heure de début.'); render(); return;
      }
      const clash = db.planning.some(s => s.profId === profId && s.jour === jour.value &&
        debut.value < s.fin && fin.value > s.debut);
      if (clash) { say('err', 'Ce créneau chevauche un autre de tes créneaux.'); render(); return; }
      db.planning.push({
        id: uid(), profId, jour: jour.value, debut: debut.value, fin: fin.value,
        matiereId: matiere.value, salle: clean(salle.value, 30)
      });
      if (!save()) { db.planning.pop(); say('err', 'Stockage plein.'); }
      else say('ok', 'Créneau ajouté.');
      render();
    }
  },
    h('div', { class: 'field' }, h('label', { for: 'p-jour' }, 'Jour'), jour),
    h('div', { class: 'field' }, h('label', { for: 'p-matiere' }, 'Matière'), matiere),
    h('div', { class: 'field' }, h('label', { for: 'p-debut' }, 'Début'), debut),
    h('div', { class: 'field' }, h('label', { for: 'p-fin' }, 'Fin'), fin),
    h('div', { class: 'field full' }, h('label', { for: 'p-salle' }, 'Salle (facultative)'), salle),
    h('div', { class: 'full' }, h('button', { type: 'submit', class: 'btn' }, 'Ajouter le créneau'))
  );

  return h('div', {}, h('h3', {}, 'Ajouter un créneau'), h('div', { class: 'panel' }, form));
}

/* ----------------------------- Administration --------------------- */

function simpleListView({ title, lead, label, items, inputId, onAdd, onDelete }) {
  const input = h('input', { id: inputId, type: 'text', required: true, maxlength: 60 });
  const form = h('form', {
    class: 'grid',
    onsubmit: e => {
      e.preventDefault();
      const v = clean(input.value, 60);
      if (!v) { say('err', 'Le nom est obligatoire.'); render(); return; }
      if (items.some(i => i.nom.toLowerCase() === v.toLowerCase())) { say('err', 'Ce nom existe déjà.'); render(); return; }
      onAdd(v);
    }
  },
    h('div', { class: 'field full' }, h('label', { for: inputId }, label), input),
    h('div', { class: 'full' }, h('button', { type: 'submit', class: 'btn' }, 'Ajouter'))
  );

  return h('section', {},
    h('h2', {}, title),
    h('p', { class: 'lead' }, lead),
    h('div', { class: 'panel' }, form),
    h('h3', {}, 'Liste (' + items.length + ')'),
    items.length
      ? h('ul', { class: 'list' }, items.map(i => h('li', {},
          h('span', {}, i.nom),
          h('button', { type: 'button', class: 'btn small danger', onclick: () => onDelete(i) }, 'Supprimer'))))
      : h('p', { class: 'empty' }, 'La liste est vide.')
  );
}

function matieresView() {
  return simpleListView({
    title: 'Matières',
    lead: 'Les professeurs choisissent parmi ces matières.',
    label: 'Nouvelle matière',
    inputId: 'm-nom',
    items: db.matieres,
    onAdd: nom => { db.matieres.push({ id: uid(), nom }); save(); say('ok', 'Matière ajoutée.'); render(); },
    onDelete: m => {
      const used = db.documents.some(d => d.matiereId === m.id) || db.planning.some(s => s.matiereId === m.id);
      if (used) { say('err', 'Impossible : « ' + m.nom + ' » est utilisée par des documents ou des créneaux.'); render(); return; }
      if (!confirm('Supprimer la matière « ' + m.nom + ' » ?')) return;
      db.matieres = db.matieres.filter(x => x.id !== m.id);
      save(); say('ok', 'Matière supprimée.'); render();
    }
  });
}

function profsView() {
  return simpleListView({
    title: 'Professeurs',
    lead: 'Chaque professeur apparaît ensuite dans la liste des profils.',
    label: 'Nom du professeur',
    inputId: 'pr-nom',
    items: db.profs,
    onAdd: nom => { db.profs.push({ id: uid(), nom }); save(); say('ok', 'Professeur ajouté.'); render(); },
    onDelete: p => {
      const used = db.documents.some(d => d.profId === p.id) || db.planning.some(s => s.profId === p.id);
      if (used) { say('err', 'Impossible : ' + p.nom + ' a encore des documents ou des créneaux.'); render(); return; }
      if (!confirm('Supprimer le professeur ' + p.nom + ' ?')) return;
      db.profs = db.profs.filter(x => x.id !== p.id);
      save(); say('ok', 'Professeur supprimé.'); render();
    }
  });
}

render();
