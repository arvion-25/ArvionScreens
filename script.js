// ---------- script.js (admin) ----------
const BUCKET = 'ads-videos'; // change if needed

// format to IST
function toIST(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(',', '');
}

// utility to show element
function $(id) { return document.getElementById(id); }

// ---------- load display users into selects ----------
async function loadDisplayUsers() {
  const { data, error } = await supabase.from('app_users').select('id,username').eq('role','display').order('username');
  const assign = $('assignDisplaySelect');
  const brandSel = $('brandAssignSelect');
  const usersList = $('usersList');
  if (!assign || !brandSel || !usersList) return;
  assign.innerHTML = '';
  brandSel.innerHTML = '';
  usersList.innerHTML = '';

  if (error) { assign.innerHTML = '<option>Error</option>'; return; }

  (data || []).forEach(u => {
    assign.appendChild(new Option(u.username, u.id));
    brandSel.appendChild(new Option(u.username, u.id));
    // add to users list (will be refreshed by loadUsers)
  });
}

// ---------- create user ----------
$('newRole').addEventListener('change', function() {
  const v = this.value;
  $('brandDisplayWrap').style.display = v === 'brand' ? 'block' : 'none';
});

$('createUserBtn').onclick = async () => {
  const un = $('newUsername').value.trim();
  const pw = $('newPassword').value.trim();
  const role = $('newRole').value;
  const msg = $('createUserMsg');
  msg.textContent = '';

  if (!un || !pw) { msg.textContent = 'Enter username & password'; return; }
  if (un === 'admin') { msg.textContent = 'Cannot create admin'; return; }

  try {
    // call create_user RPC (expects p_username,p_password,p_role signature)
    const { data, error } = await supabase.rpc('create_user', { p_username: un, p_password: pw, p_role: role });

    if (error) throw error;

    const createdId = data; // uuid returned

    // if role is brand, link brand -> display_user_id
    if (role === 'brand') {
      const displayId = $('brandAssignSelect').value;
      if (!displayId) {
        msg.textContent = 'Pick a display for this brand';
      } else {
        // insert brand_links
        const { error: err2 } = await supabase.from('brand_links').insert([{ brand_user_id: createdId, display_user_id: displayId }]);
        if (err2) { console.error(err2); msg.textContent = 'Brand link insert failed'; }
      }
    }

    msg.textContent = 'Created user';
    $('newUsername').value = '';
    $('newPassword').value = '';
    await loadUsers();
    await loadDisplayUsers();
  } catch (e) {
    console.error(e);
    msg.textContent = 'Create failed: ' + (e.message || JSON.stringify(e));
  }
};

// ---------- load users list ----------
async function loadUsers() {
  const { data, error } = await supabase.from('app_users').select('id,username,role').order('username');
  const ul = $('usersList');
  if (error) { ul.innerHTML = '<li>Error</li>'; return; }
  ul.innerHTML = '';
  (data || []).forEach(u => {
    const li = document.createElement('li');
    li.textContent = `${u.username} (${u.role})`;
    if (u.role !== 'admin') {
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'delete-btn';
      btn.style.marginLeft = '8px';
      btn.onclick = async () => {
        if (!confirm('Delete '+u.username+'?')) return;
        // delete brand_links entries if brand
        if (u.role === 'brand') {
          await supabase.from('brand_links').delete().eq('brand_user_id', u.id);
        }
        await supabase.from('app_users').delete().eq('id', u.id);
        loadUsers();
        loadDisplayUsers();
      };
      li.appendChild(btn);
    }
    ul.appendChild(li);
  });
}

// ---------- upload video (assign to display_id) ----------
$('uploadForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target.video.files[0];
  if (!f) return alert('Select file');
  const displayId = $('assignDisplaySelect').value;
  if (!displayId) return alert('Select display to assign');

  const storagePath = Date.now() + '-' + f.name;
  const up = await supabase.storage.from(BUCKET).upload(storagePath, f);
  if (up.error) { alert('Upload failed: '+up.error.message); return; }

  // insert into videos table with display_user_id
  const { error } = await supabase.from('videos').insert([{
    filename: f.name,
    storage_path: storagePath,
    display_user_id: displayId,
    uploaded_by: 'admin'
  }]);
  if (error) { alert('DB insert failed: '+error.message); return; }

  alert('Uploaded and assigned');
  loadVideosGrouped();
};

// ---------- load videos grouped by display_user_id ----------
async function loadVideosGrouped() {
  const div = $('videosGrouped');
  div.innerHTML = 'Loading...';
  const { data, error } = await supabase.from('videos').select('id,filename,storage_path,display_user_id,uploaded_at').order('uploaded_at',{ascending:false});
  if (error) { div.innerHTML = 'Error'; return; }
  div.innerHTML = '';
  const groups = {};
  (data || []).forEach(v => {
    const key = v.display_user_id || 'unassigned';
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  });

  for (const key of Object.keys(groups)) {
    const header = document.createElement('h3');
    header.textContent = key === 'unassigned' ? 'Unassigned' : `Display ID: ${key}`;
    div.appendChild(header);
    const ul = document.createElement('ul');
    for (const v of groups[key]) {
      const li = document.createElement('li');
      li.innerHTML = `${v.filename} <button data-path="${v.storage_path}">Delete</button>`;
      const del = li.querySelector('button');
      del.className = 'delete-btn';
      del.onclick = async () => {
        if (!confirm('Delete?')) return;
        const res = await supabase.storage.from(BUCKET).remove([v.storage_path]);
        if (res.error) { alert('Storage delete failed'); return; }
        await supabase.from('videos').delete().eq('id', v.id);
        loadVideosGrouped();
      };
      ul.appendChild(li);
    }
    div.appendChild(ul);
  }
}

// ---------- load history for a target display (for brand/admin) ----------
async function loadHistoryForDisplay(displayId = null, filterDate = null) {
  const tbody = $('historyBody');
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';

  let q = supabase.from('login_history').select('*').neq('user_name','admin').order('login_time',{ascending:false});
  if (displayId) q = q.eq('display_user_id', displayId);
  if (filterDate) {
    // convert local date to IST boundaries then to ISO
    const start = new Date(filterDate + 'T00:00:00+05:30').toISOString();
    const end = new Date(filterDate + 'T23:59:59+05:30').toISOString();
    q = q.gte('login_time', start).lte('login_time', end);
  }

  const { data, error } = await q;
  if (error) { tbody.innerHTML = '<tr><td colspan="5">Error</td></tr>'; console.error(error); return; }

  tbody.innerHTML = '';
  (data || []).forEach(r => {
    const tr = document.createElement('tr');
    const logout = r.logout_time ? toIST(r.logout_time) : 'Active';
    tr.innerHTML = `<td>${r.user_name}</td><td>${toIST(r.login_time)}</td><td>${logout}</td><td>${r.device_model||''}</td><td title="${r.user_agent||''}">${r.user_agent||''}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------- Export helpers ----------
function csvFromRows(rows) {
  let out = 'Username,Login,Logout,Device,UA\n';
  (rows || []).forEach(r => {
    out += `"${r.user_name}","${toIST(r.login_time)}","${r.logout_time ? toIST(r.logout_time): ''}","${r.device_model||''}","${(r.user_agent||'').replace(/"/g,'""')}"\n`;
  });
  return out;
}

$('exportAllBtn').onclick = async () => {
  const { data, error } = await supabase.from('login_history').select('*').neq('user_name','admin').order('login_time',{ascending:false});
  if (error) return alert('Export failed');
  const b = new Blob([csvFromRows(data)], { type:'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'history-all.csv'; a.click();
};
$('exportFilteredBtn').onclick = async () => {
  const date = $('filterDate').value;
  if (!date) return alert('Pick date');
  const start = new Date(date + 'T00:00:00+05:30').toISOString();
  const end = new Date(date + 'T23:59:59+05:30').toISOString();
  const { data } = await supabase.from('login_history').select('*').neq('user_name','admin').gte('login_time',start).lte('login_time',end).order('login_time',{ascending:false});
  const b = new Blob([csvFromRows(data)], { type:'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `history-${date}.csv`; a.click();
};

// ---------- filter buttons ----------
$('filterBtn').onclick = () => {
  const date = $('filterDate').value; if (!date) return alert('Pick a date');
  // Show all displays (admin) - no displayId filter
  loadHistoryForDisplay(null, date);
};
$('clearFilterBtn').onclick = () => {
  $('filterDate').value = '';
  loadHistoryForDisplay(null, null);
};

// ---------- Realtime broadcast subscription ----------
const channel = supabase.channel('login_updates');
channel.on('broadcast', { event: '*' }, (payload) => {
  // payload may include { display_user_id, event }
  loadHistoryForDisplay(null, $('filterDate').value || null);
  loadVideosGrouped();
  loadUsers();
  loadDisplayUsers();
});
channel.subscribe();

// ---------- INIT ----------
(async function init(){
  await loadDisplayUsers();
  await loadUsers();
  await loadVideosGrouped();
  const today = new Date().toISOString().slice(0,10);
  $('filterDate').value = today;
  loadHistoryForDisplay(null, today);
})();
