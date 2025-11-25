// ============ Supabase Helper ============
function toIST(utcIso) {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata'
  }).replace(',', '');
}

// ============= CREATE USER ==============
document.getElementById("createUserBtn").onclick = async () => {
  const un = document.getElementById("newUsername").value.trim();
  const pw = document.getElementById("newPassword").value.trim();
  const rl = document.getElementById("newRole").value;
  const msg = document.getElementById("userMsg");

  if (!un || !pw) {
    msg.textContent = "Username and password required";
    msg.className = "error";
    return;
  }

  if (un === "admin") {
    msg.textContent = "Cannot create another admin account";
    msg.className = "error";
    return;
  }

  const { data, error } = await supabase.rpc("create_user", {
    p_username: un,
    p_password: pw,
    p_role: rl
  });

  if (error) {
    msg.textContent = "Create failed: " + error.message;
    msg.className = "error";
  } else {
    msg.textContent = "User created successfully!";
    msg.className = "";
    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";
  }
};

// ============ VIDEO LISTING / UPLOAD / DELETE ============
async function listVideos() {
  const ul = document.getElementById('videoList');
  ul.innerHTML = 'Loading…';
  const { data, error } = await supabase.storage.from('ads-videos').list('');
  if (error) { ul.innerHTML = '<li>Error loading videos</li>'; return; }

  ul.innerHTML = '';
  data.forEach(file => {
    const li = document.createElement("li");
    li.innerHTML = `${file.name} <button class="delete-btn">Delete</button>`;

    li.querySelector('button').onclick = async () => {
      if (!confirm("Delete this video?")) return;
      const { error } = await supabase.storage.from('ads-videos').remove([file.name]);
      if (!error) listVideos();
    };

    ul.appendChild(li);
  });
}

document.getElementById("uploadForm").onsubmit = async (e) => {
  e.preventDefault();
  const file = e.target.video.files[0];
  if (!file) return alert("Select a file");

  const name = Date.now() + "-" + file.name;
  const { error } = await supabase.storage.from('ads-videos').upload(name, file);

  if (error) alert("Upload failed");
  else listVideos();
};

// ================ HISTORY LISTING ==================
async function loadHistory(filterDate = null) {
  const tbody = document.getElementById("historyBody");

  let q = supabase.from("login_history")
    .select("*")
    .neq("user_name", "admin")
    .order("login_time", { ascending: false });

  if (filterDate) {
    const start = new Date(`${filterDate}T00:00:00+05:30`).toISOString();
    const end = new Date(`${filterDate}T23:59:59+05:30`).toISOString();
    q = q.gte("login_time", start).lte("login_time", end);
  }

  const { data, error } = await q;
  if (error) {
    tbody.innerHTML = "<tr><td colspan='5'>Error loading</td></tr>";
    return;
  }

  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");

    let logoutDisplay = row.logout_time
      ? toIST(row.logout_time)
      : "Active";

    tr.innerHTML = `
      <td>${row.user_name}</td>
      <td>${toIST(row.login_time)}</td>
      <td>${logoutDisplay}</td>
      <td>${row.device_model || ''}</td>
      <td>${row.user_agent || ''}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ============ FILTER + REFRESH BUTTONS ============
document.getElementById("filterBtn").onclick = () => {
  const date = document.getElementById("filterDate").value;
  if (!date) return alert("Pick date");
  loadHistory(date);
};

document.getElementById("refreshBtn").onclick = () => {
  document.getElementById("filterDate").value = "";
  loadHistory();
};

// ================ REALTIME SUBSCRIPTION ================
let channel = supabase.channel('login_updates');

channel
  .on('broadcast', { event: '*' }, () => {
    loadHistory();
  })
  .subscribe();

// =========== INITIAL RUN ==========
listVideos();

// Default show TODAY automatically
const today = new Date().toISOString().slice(0,10);
document.getElementById("filterDate").value = today;
loadHistory(today);
