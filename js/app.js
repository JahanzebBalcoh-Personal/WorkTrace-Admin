// WorkTrace Admin - Kanban & Professional OS Logic
const firebaseConfig = {
  apiKey: "AIzaSyDdRwSkiB4DjRg_W_dh5B50vUzsJtg-dyA",
  authDomain: "worktrace-agency.firebaseapp.com",
  projectId: "worktrace-agency",
  storageBucket: "worktrace-agency.firebasestorage.app",
  messagingSenderId: "891860270689",
  appId: "1:891860270689:web:31cc3e9047bd79bc15b420",
  measurementId: "G-S1HR173NW8"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let allProjects = [];
let allUsers = [];

// ─── AUTHENTICATION ───
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("Login failed!"));
}

async function checkUserAccess(user) {
    if(!user) return;
    const doc = await db.collection('users').doc(user.email).get();
    if(doc.exists && doc.data().role === 'admin') {
        document.getElementById('auth-overlay').style.display = 'none';
        
        // Update Sidebar Profile
        document.getElementById('user-name').textContent = user.displayName;
        const initials = user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        document.getElementById('user-initials').textContent = initials;
        
        startListeners();
    } else {
        await db.collection('users').doc(user.email).set({
            name: user.displayName, email: user.email, photo: user.photoURL,
            role: doc.exists ? doc.data().role : 'pending',
            lastLogin: new Date().toISOString()
        }, { merge: true });
        alert("Access Pending: Admin approval required for " + user.email);
        auth.signOut();
    }
}

// ─── NAVIGATION ───
function switchView(viewId, title) {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    document.getElementById('view-' + viewId).style.display = 'block';
    
    const titleEl = document.getElementById('view-title');
    titleEl.style.opacity = '0';
    setTimeout(() => {
        titleEl.textContent = title;
        titleEl.style.opacity = '1';
    }, 200);
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    // Handle the event if it's from a click, otherwise find by text
    if(window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
}

// ─── LISTENERS ───
function startListeners() {
    db.collection('projects').orderBy('createdAt', 'desc').onSnapshot(snap => {
        allProjects = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderAll();
    });
    db.collection('users').onSnapshot(snap => {
        allUsers = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderUsers();
    });
}

// ─── RENDERING ───
function renderAll() {
    renderDashboard();
    renderKanban();
    calculateStats();
}

function renderDashboard() {
    const list = document.getElementById('dashboard-project-list');
    const recent = allProjects.slice(0, 5);
    if(recent.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:60px; color:var(--muted);">No active workflows found.</td></tr>`;
        return;
    }
    list.innerHTML = recent.map(p => `
        <tr>
            <td><div style="display:flex; align-items:center; gap:12px;">
                <div style="width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 10px var(--accent);"></div>
                <b>${p.name}</b>
            </div></td>
            <td>${p.clientName}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; height:4px; background:rgba(255,255,255,0.03); border-radius:10px; overflow:hidden;">
                        <div style="width: ${p.progress}%; height: 100%; background: var(--accent); border-radius: 10px;"></div>
                    </div>
                    <span style="font-size:10px; color:var(--muted);">${p.progress}%</span>
                </div>
            </td>
            <td><span class="status-badge">${p.currentPhase || 'Drafting'}</span></td>
            <td><span style="font-family:monospace; color:var(--muted);">${p.deadline || 'NO DATE'}</span></td>
            <td><button onclick="switchView('projects', 'Kanban Management')" class="btn-tiny">BOARD ❯</button></td>
        </tr>
    `).join('');
}

function renderKanban() {
    const columns = document.querySelectorAll('.kanban-col');
    columns.forEach(col => {
        const phase = col.getAttribute('data-phase');
        const body = col.querySelector('.col-body');
        const count = col.querySelector('.count');
        
        const projects = allProjects.filter(p => (p.currentPhase || 'Drafting') === phase);
        count.textContent = projects.length;
        
        body.innerHTML = projects.map(p => `
            <div class="project-card-kanban" draggable="true" ondragstart="drag(event)" id="${p.id}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <h4 style="font-size:14px; font-weight:800;">${p.name}</h4>
                    <span style="font-size:10px; opacity:0.5;">#${p.id.slice(0,4)}</span>
                </div>
                <p style="font-size:11px; color:var(--muted); margin-bottom:15px;">Client: ${p.clientName}</p>
                <div style="padding-top:15px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; color:var(--accent); font-weight:900; letter-spacing:1px;">$${p.revenue}</span>
                    <div style="display:flex; gap:8px;">
                        <button onclick="deleteProject('${p.id}')" style="background:transparent; border:none; color:var(--red); font-size:12px; cursor:pointer;">✕</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.email}</td>
            <td><span class="status-badge">${u.role.toUpperCase()}</span></td>
            <td style="font-size:11px;">${u.lastLogin ? u.lastLogin.split('T')[0] : 'N/A'}</td>
            <td><button onclick="changeRole('${u.email}')" class="btn-tiny">Role</button></td>
        </tr>
    `).join('');
}

function calculateStats() {
    const rev = allProjects.reduce((s, p) => s + (p.revenue || 0), 0);
    const pay = allProjects.reduce((s, p) => s + (p.editorFee || 0), 0);
    const margin = rev > 0 ? ((rev - pay) / rev) * 100 : 0;

    document.getElementById('stat-active').textContent = allProjects.length;
    document.getElementById('stat-rev').textContent = '$' + rev.toLocaleString();
    document.getElementById('stat-payout').textContent = '$' + pay.toLocaleString();
    document.getElementById('stat-margin').textContent = Math.round(margin) + '%';
}

// ─── DRAG AND DROP LOGIC ───
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.id); }

async function drop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text");
    const colBody = ev.currentTarget.classList.contains('col-body') ? ev.currentTarget : ev.currentTarget.querySelector('.col-body');
    const newPhase = ev.currentTarget.closest('.kanban-col').getAttribute('data-phase');
    
    // Update Firestore
    const phases = ["Drafting", "In Production", "Editing", "Supervision", "Admin Review", "Client Review", "Delivered"];
    const step = phases.indexOf(newPhase) + 1;
    
    try {
        await db.collection('projects').doc(id).update({
            currentPhase: newPhase,
            step: step,
            progress: Math.round((step / 7) * 100),
            status: newPhase === 'Delivered' ? 'Completed' : 'Active'
        });
    } catch(e) { console.error(e); }
}

// ─── ACTIONS ───
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

async function submitNewProject() {
    const data = {
        name: document.getElementById('p-name').value,
        clientName: document.getElementById('p-client-name').value,
        clientEmail: document.getElementById('p-client-email').value,
        editorEmail: document.getElementById('p-editor-email').value,
        revenue: parseFloat(document.getElementById('p-revenue').value),
        editorFee: parseFloat(document.getElementById('p-payout').value),
        deadline: document.getElementById('p-deadline').value,
        status: 'Active',
        progress: 14,
        step: 1,
        currentPhase: 'Drafting',
        createdAt: new Date().toISOString()
    };
    if(!data.name || !data.clientEmail) return alert("Fill required fields!");
    try {
        await db.collection('projects').add(data);
        hideModal('project-modal');
    } catch(e) { alert(e.message); }
}

async function deleteProject(id) {
    if(confirm("Delete project?")) await db.collection('projects').doc(id).delete();
}

async function changeRole(email) {
    const r = prompt("New role (admin, editor, client):");
    if(r) await db.collection('users').doc(email).update({ role: r });
}

// ─── INIT ───
auth.onAuthStateChanged(user => {
    if(user) checkUserAccess(user);
    else document.getElementById('auth-overlay').style.display = 'flex';
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.textContent.trim().toLowerCase();
        if(view === 'dashboard') switchView('dashboard', 'Agency Overview');
        else if(view === 'projects') switchView('projects', 'Kanban Board');
        else if(view === 'finance') switchView('finance', 'Financial Intelligence');
        else if(view === 'clients' || view === 'editors') switchView('users', 'Platform Users');
    });
});
