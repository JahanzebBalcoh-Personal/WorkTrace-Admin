// WorkTrace Admin - Agency OS Logic
const firebaseConfig = {
  apiKey: "AIzaSyDdRwSkiB4DjRg_W_dh5B50vUzsJtg-dyA",
  authDomain: "worktrace-agency.firebaseapp.com",
  projectId: "worktrace-agency",
  storageBucket: "worktrace-agency.firebasestorage.app",
  messagingSenderId: "891860270689",
  appId: "1:891860270689:web:31cc3e9047bd79bc15b420",
  measurementId: "G-S1HR173NW8"
};

// Initialize Firebase (Compat Mode for Vanilla JS)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

let allProjects = [];
let allStats = {
    revenue: 0,
    payouts: 0,
    active: 0
};

// ─── AUTHENTICATION ───
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(res => {
        checkUserAccess(res.user);
    }).catch(err => {
        console.error("Login Error:", err);
        alert("Login failed!");
    });
}

async function checkUserAccess(user) {
    if(!user) return;
    
    const doc = await db.collection('users').doc(user.email).get();
    if(doc.exists && doc.data().role === 'admin') {
        document.getElementById('auth-overlay').style.display = 'none';
        startListeners();
    } else {
        // If first time or unauthorized
        await db.collection('users').doc(user.email).set({
            name: user.displayName,
            email: user.email,
            photo: user.photoURL,
            role: 'pending', // Needs manual approval in Firestore
            lastLogin: new Date().toISOString()
        }, { merge: true });
        
        alert("Access Pending: Admin approval required for " + user.email);
        auth.signOut();
    }
}

// ─── LISTENERS ───
function startListeners() {
    db.collection('projects').onSnapshot(snap => {
        allProjects = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderProjects();
        calculateStats();
    });
}

// ─── RENDERING ───
function renderProjects() {
    const tbody = document.getElementById('project-list');
    if(!tbody) return;
    
    if(allProjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--muted);">No projects yet. Click + NEW PROJECT to start.</td></tr>';
        return;
    }

    tbody.innerHTML = allProjects.map(p => `
        <tr>
            <td><b>${p.name}</b></td>
            <td>${p.clientName || 'N/A'}</td>
            <td>
                <div style="width: 100px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                    <div style="width: ${p.progress || 0}%; height: 100%; background: var(--accent); border-radius: 10px;"></div>
                </div>
            </td>
            <td><span class="status-badge ${getStatusClass(p.status)}">${p.status || 'Active'}</span></td>
            <td>${p.deadline || 'No Date'}</td>
            <td><button onclick="manageProject('${p.id}')" style="background:transparent; border:1px solid var(--border); color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:11px;">Manage</button></td>
        </tr>
    `).join('');
}

function getStatusClass(status) {
    if(status === 'Active') return 'status-active';
    if(status === 'Review') return 'status-review';
    return '';
}

function calculateStats() {
    let rev = allProjects.reduce((s, p) => s + (parseFloat(p.revenue) || 0), 0);
    let pay = allProjects.reduce((s, p) => s + (parseFloat(p.editorFee) || 0), 0);
    let profit = rev - pay;
    let margin = rev > 0 ? (profit / rev) * 100 : 0;

    document.getElementById('stat-rev').textContent = '$' + rev.toLocaleString();
    document.getElementById('stat-payout').textContent = '$' + pay.toLocaleString();
    document.getElementById('stat-margin').textContent = Math.round(margin) + '%';
    document.getElementById('stat-active').textContent = allProjects.length;
}

// ─── ACTIONS ───
async function createProject() {
    const name = prompt("Project Name:");
    if(!name) return;
    
    const clientName = prompt("Client Name:");
    const clientEmail = prompt("Client Email (for login):");
    const editorEmail = prompt("Editor Email (for assignment):");
    const revenue = prompt("Revenue Amount ($):") || 0;
    const editorFee = prompt("Editor Payout ($):") || 0;
    const deadline = prompt("Deadline (e.g. May 25, 2026):");
    
    try {
        await db.collection('projects').add({
            name,
            clientName,
            clientEmail,
            editorEmail,
            revenue: parseFloat(revenue),
            editorFee: parseFloat(editorFee),
            deadline,
            status: 'Active',
            progress: 10,
            step: 1,
            currentPhase: 'Planning & Discovery',
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser.email
        });
        alert("Project Created & Assigned! ✅");
    } catch(e) {
        alert("Error: " + e.message);
    }
}

// Initial Check
auth.onAuthStateChanged(user => {
    if(user) checkUserAccess(user);
    else document.getElementById('auth-overlay').style.display = 'flex';
});
