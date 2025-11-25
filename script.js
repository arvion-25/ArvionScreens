/******************************************************************
 * script.js (admin) - full final
 * - user create/list/delete (RPCs)
 * - video upload/list/delete assigned per display user (videos table)
 * - history load (IST date filter)
 * - realtime broadcast subscription
 * - export
 ******************************************************************/

const BUCKET = 'ads-videos'; // change if your bucket name differs

// Helper: IST formatting
function toIST(utcIso) {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(',', '');
}
function toISTDate(ts) {
  if (!ts) return '';
  const ist = new Date(ts).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
  const [d,m,y] = ist.split(',')[0].split('/');
  return `${y}-${m}-${d}`;
}

/******************************************************************
 * USER MANAGEMENT (create / list / delete)
 ******************************************************************/
async function createUser(username, password, role) {
  const { data, error } = await supabase.rpc('create_user', { un: username, pwd: password, role_in: role });
  if (error) throw error;
  return data;
}

async function deleteUser(username) {
  // prefer RPC
  const { data, error } = await supabase.rpc('delete_user_by_username', { un: username }).catch(()=>({ error: null }));
  if (error) throw error;
  if (!data) {
    const r = await supabase.from('app_users').delete().eq('username', username);
    if (r.error) throw r.error;
  }
  return true;
}

async function listUsers() {
  const ul = document.getElementById('usersList');
  const assignSelect = document.getElementById('assignToSelect');
  if (!ul) return;
  ul.innerHTML = 'Loading users...';
  if (assignSelect) assignSelect.innerHTML = '<option>Loading...</option>';
  try {
    let { data, error } = await supabase.from('app_users').select('id,username,role').order('username',{ascending:true});
    if (error) {
      const r2 = await supabase.from('users').select('id,username,role').order('username',{ascending:true});
      if (r2.error) { ul.innerHTML = '<li>Error loading users</li>'; console.error(r2.error); return; }
      data = r2.data;
    }
    ul.innerHTML = '';
    // populate users list and assign dropdown with only 'display' role users
    const displays = [];
    (data||[]).forEach(u => {
      const li = document.createElement('li');
      li.innerHTML = `${u.username} <small>(${u.role||''})</small> `;
      const del = document.createElement('button'); del.textContent = 'Delete'; del.className='delete-btn';
      del.onclick = async () => {
        if (!confirm('Delete user ' + u.username + '?')) return;
        try {
          await deleteUser(u.username);
          listUsers();
          alert('Deleted');
        } catch (e) {
          console.error(e); alert('Delete failed: ' + (e.message || e));
        }
      };
      li.appendChild(del);
      ul.appendChild(li);
      if ((u.role||'').toLowerCase() === 'display') displays.push(u.username);
    });

    // populate assignToSelect
    if (assignSelect) {
      assignSelect.innerHTML = '';
      // add a default "All displays" option too if desired
      // assignSelect.appendChild(new Option('-- choose display --', ''));
      displays.forEach(username => {
        assignSelect.appendChild(new Option(username, username));
      });
    }

  } catch (e) {
    console.error(e); ul.innerHTML = '<li>Error loading users</li>';
    if (assignSelect) assignSelect.innerHTML = '<option>Error</option>';
  }
}

// Create user form handler
const createForm = document.getElementById('createUserForm');
if (createForm) {
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    if (!username || !password) return alert('Provide username and password');

    try {
      await createUser(username, password, role);
      alert('User created: ' + username);
      createForm.reset();
      listUsers();
    } catch (err) {
      console.error(err);
      alert('Create failed: ' + (err.message || JSON.stringify(err)));
    }
  });
}

/******************************************************************
 * VIDEO UPLOAD / DB INSERT / LIST / DELETE
 ******************************************************************/
async function listVideosGrouped() {
  const div = document.getElementById('videosGrouped');
  if (!div) return;
  div.innerHTML = 'Loading videos...';
  try {
    // get rows from videos table
    const { data, error } = await supabase.from('videos').select('*').order('uploaded_at', { ascending: false });
    if (error) { div.innerHTML = 'Error loading videos'; console.error(error); return; }
    const rows = data || [];

    // group by assigned_to
    const groups = {};
    rows.forEach(r => {
      if (!groups[r.assigned_to]) groups[r.assigned_to] = [];
      groups[r.assigned_to].push(r);
    });

    // render
    div.innerHTML = '';
    if (rows.length === 0) { div.innerHTML = '<div>No videos uploaded yet</div>'; return; }

    for (const user of Object.keys(groups)) {
      const h = document.createElement('h3');
      h.textContent = `Assigned to: ${user}`;
      div.appendChild(h);
      const ul = document.createElement('ul');
      groups[user].forEach(async v => {
        const li = document.createElement('li');
        // build public URL for this storage_path
        let url = '';
        try {
          const p = v.storage_path;
          const { data: pu } = supabase.storage.from(BUCKET).getPublicUrl(p);
          url = pu?.publicUrl || '';
        } catch (e) { console.warn('getPublicUrl error', e); }
        li.innerHTML = `<strong>${v.filename}</strong> (uploaded: ${toIST(v.uploaded_at || v.created_at)}) `;
        const playBtn = document.createElement('button'); playBtn.textContent = 'Play';
        playBtn.onclick = () => {
          // open video in new tab or preview
          if (url) window.open(url, '_blank');
          else alert('No public url available');
        };
        const del = document.createElement('button'); del.textContent = 'Delete'; del.className='delete-btn';
        del.style.marginLeft = '8px';
        del.onclick = async () => {
          if (!confirm('Delete this video (storage + record)?')) return;
          try {
            // delete storage
            const r1 = await supabase.storage.from(BUCKET).remove([v.storage_path]);
            if (r1.error) {
              alert('Storage delete failed: ' + r1.error.message);
              console.error(r1.error);
              return;
            }
            // delete DB row
            const r2 = await supabase.from('videos').delete().eq('id', v.id);
            if (r2.error) {
              alert('DB delete failed: ' + r2.error.message);
              console.error(r2.error);
              return;
            }
            listVideosGrouped();
          } catch (e) {
            console.error(e); alert('Delete failed');
          }
        };
        li.appendChild(playBtn);
        li.appendChild(del);
        ul.appendChild(li);
      });
      div.appendChild(ul);
    }

  } catch (e) {
    console.error(e);
    div.innerHTML = 'Error loading videos';
  }
}

// Upload: upload file to storage, then insert metadata into videos table
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = e.target.video.files[0];
    if (!file) return alert('Select a file');
    const assignTo = document.getElementById('assignToSelect').value;
    if (!assignTo) return alert('Please select a display user in drop-down');

    // generate storage path
    const storagePath = Date.now() + '-' + file.name;
    try {
      const up = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (up.error) throw up.error;

      // insert metadata in videos table
      const usernameUploader = sessionStorage.getItem('logged_user') || 'admin';
      const ins = await supabase.from('videos').insert([{
        filename: file.name,
        storage_path: storagePath,
        assigned_to: assignTo,
        uploaded_by: usernameUploader
      }]);
      if (ins.error) throw ins.error;

      alert('Uploaded & assigned to ' + assignTo);
      uploadForm.reset();
      listVideosGrouped();
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.message || err));
    }
  });
}

/******************************************************************
 * HISTORY (safe UI + IST date filter)
 ******************************************************************/
async function loadHistory(filterDate = null) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;
  const previousHTML = tbody.innerHTML;
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  try {
    let { data, error } = await supabase.from('login_history').select('*').neq('user_name','admin').order('login_time',{ascending:false});
    if (error) {
      console.error('loadHistory error', error);
      tbody.innerHTML = previousHTML || '<tr><td colspan="5">Error loading history</td></tr>';
      return;
    }
    let rows = data || [];
    if (filterDate) rows = rows.filter(r => toISTDate(r.login_time) === filterDate);
    tbody.innerHTML = '';
    rows.forEach(r => {
      let logoutDisplay = r.logout_time ? toIST(r.logout_time) : 'Active';
      if (!r.logout_time && r.last_ping) {
        const ageSec = (Date.now() - new Date(r.last_ping).getTime()) / 1000;
        if (ageSec > 70) logoutDisplay = toIST(r.last_ping) + ' (detected offline)';
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.user_name}</td><td>${toIST(r.login_time)}</td><td>${logoutDisplay}</td><td>${r.device_model||''}</td><td title="${r.user_agent||''}">${r.user_agent||''}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Unexpected loadHistory error', e);
    tbody.innerHTML = previousHTML || '<tr><td colspan="5">Error loading history</td></tr>';
  }
}

/******************************************************************
 * EXPORT
 ******************************************************************/
function csvFromRows(rows) {
  let out = 'Username,Login (IST),Logout (IST),Device,User-Agent\n';
  rows.forEach(r => {
    const logout = r.logout_time ? toIST(r.logout_time) : (r.last_ping ? toIST(r.last_ping) + ' (detected offline)' : '');
    out += `"${r.user_name}","${toIST(r.login_time)}","${logout}","${r.device_model||''}","${(r.user_agent||'').replace(/"/g,'""')}"\n`;
  });
  return out;
}

document.getElementById('exportAllBtn').onclick = async () => {
  const { data, error } = await supabase.from('login_history').select('*').neq('user_name','admin').order('login_time', { ascending:false });
  if (error) { alert('Export failed'); console.error(error); return; }
  const blob = new Blob([csvFromRows(data||[])], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'history-all.csv'; a.click();
};

document.getElementById('exportFilteredBtn').onclick = async () => {
  const date = document.getElementById('filterDate').value; if (!date) { alert('Pick a date'); return; }
  const { data, error } = await supabase.from('login_history').select('*').neq('user_name','admin').order('login_time', { ascending:false });
  if (error) { alert('Export failed'); console.error(error); return; }
  const filtered = (data || []).filter(r => toISTDate(r.login_time) === date);
  const blob = new Blob([csvFromRows(filtered)], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `history-${date}.csv`; a.click();
};

/******************************************************************
 * REALTIME CHANNEL (broadcast)
 ******************************************************************/
let channel = null;
async function ensureChannelSubscribed() {
  if (channel) return;
  channel = supabase.channel('login_updates');

  channel.on('broadcast', { event: '*' }, (payload) => {
    console.log('[broadcast] event=', payload.event, 'payload=', payload.payload);
    setTimeout(()=> {
      const date = document.getElementById('filterDate')?.value;
      if (date) loadHistory(date); else loadHistory();
      listVideosGrouped();
      listUsers();
    }, 250);
  });

  try {
    await channel.subscribe();
    console.log('subscribed to login_updates');
    // initial loads: set default date to today IST and fetch
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
    const [d,m,y] = now.split(',')[0].split('/');
    const today = `${y}-${m}-${d}`;
    document.getElementById('filterDate').value = today;
    listVideosGrouped();
    listUsers();
    loadHistory(today);
  } catch (e) {
    console.warn('channel subscribe failed', e);
  }
}
ensureChannelSubscribed().catch(()=>{});

/******************************************************************
 * BUTTONS
 ******************************************************************/
document.getElementById('filterBtn').onclick = () => {
  const date = document.getElementById('filterDate').value;
  if (!date) return alert('Pick a date');
  loadHistory(date);
};
document.getElementById('refreshBtn').onclick = () => { document.getElementById('filterDate').value=''; loadHistory(); };

/******************************************************************
 * Initial safety loads
 ******************************************************************/
listVideosGrouped();
listUsers();
