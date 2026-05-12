// WorkTrace Admin - Professional Agency OS Logic
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
        document.getElementById('user-name').textContent = "User: " + user.displayName;
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
    document.getElementById('view-title').textContent = title;
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// ─── LISTENERS ───
function startListeners() {
    // Projects Listener
    db.collection('projects').orderBy('createdAt', 'desc').onSnapshot(snap => {
        allProjects = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderAll();
    });

    // Users Listener
    db.collection('users').onSnapshot(snap => {
        allUsers = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderUsers();
    });
}

// ─── RENDERING ───
function renderAll() {
    renderDashboard();
    renderProjectsList();
    calculateStats();
}

function renderDashboard() {
    const list = document.getElementById('dashboard-project-list');
    const recent = allProjects.slice(0, 5);
    list.innerHTML = recent.map(p => `
        <tr>
            <td><b>${p.name}</b></td>
            <td>${p.clientName}</td>
            <td>
                <div style="width: 80px; height: 5px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                    <div style="width: ${p.progress}%; height: 100%; background: var(--accent); border-radius: 10px;"></div>
                </div>
            </td>
            <td><span class="status-badge status-active">${p.status}</span></td>
            <td>${p.deadline || 'N/A'}</td>
            <td><button onclick="switchView('projects', 'Project Management')" class="btn-tiny">View</button></td>
        </tr>
    `).join('');
}

function renderProjectsList() {
    const list = document.getElementById('full-project-list');
    list.innerHTML = allProjects.map(p => `
        <tr>
            <td><b>${p.name}</b></td>
            <td style="font-size:12px;">${p.clientEmail}</td>
            <td style="font-size:12px;">${p.editorEmail}</td>
            <td><span class="status-badge">${p.status}</span></td>
            <td>$${p.editorFee}</td>
            <td>
                <button onclick="updateProgress('${p.id}')" class="btn-tiny">Step+</button>
                <button onclick="deleteProject('${p.id}')" class="btn-tiny" style="color:#ef4444;">Del</button>
            </td>
        </tr>
    `).join('');
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
    
    // Finance View
    const finRev = document.getElementById('fin-total-rev');
    const finExp = document.getElementById('fin-total-exp');
    if(finRev) finRev.textContent = '$' + rev.toLocaleString();
    if(finExp) finExp.textContent = '$' + pay.toLocaleString();
}

// ─── PROJECT ACTIONS ───
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
        progress: 10,
        step: 1,
        currentPhase: 'Planning',
        createdAt: new Date().toISOString()
    };

    if(!data.name || !data.clientEmail) return alert("Fill required fields!");

    try {
        await db.collection('projects').add(data);
        hideModal('project-modal');
        // Clear inputs
        ['p-name', 'p-client-name', 'p-client-email', 'p-editor-email', 'p-deadline'].forEach(id => document.getElementById(id).value = '');
    } catch(e) { alert("Error: " + e.message); }
}

async function updateProgress(id) {
    const p = allProjects.find(x => x.id === id);
    let nextStep = (p.step || 1) + 1;
    if(nextStep > 5) nextStep = 5;
    const phases = ["Planning", "Design", "Development", "Testing", "Delivery"];
    
    await db.collection('projects').doc(id).update({
        step: nextStep,
        progress: nextStep * 20,
        currentPhase: phases[nextStep - 1]
    });
}

async function deleteProject(id) {
    if(confirm("Delete this project?")) await db.collection('projects').doc(id).delete();
}

async function changeRole(email) {
    const newRole = prompt("Enter new role (admin, editor, client):");
    if(newRole) await db.collection('users').doc(email).update({ role: newRole });
}

// ─── INIT ───
auth.onAuthStateChanged(user => {
    if(user) checkUserAccess(user);
    else document.getElementById('auth-overlay').style.display = 'flex';
});

// Sidebar Event Listeners
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.textContent.trim().toLowerCase();
        if(view === 'dashboard') switchView('dashboard', 'Agency Overview');
        else if(view === 'projects') switchView('projects', 'Project Management');
        else if(view === 'finance') switchView('finance', 'Financial Intelligence');
        else if(view === 'clients' || view === 'editors') switchView('users', 'Platform Users');
    });
});
