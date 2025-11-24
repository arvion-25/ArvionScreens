// script.js — used by admin.html
// Assumes supabase-client.js loaded first and supabase global exists
// Realtime updates for login_history table
supabase
  .channel('history-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'login_history' },
    (payload) => {
      console.log('Realtime update:', payload);
      const date = document.getElementById('filterDate').value;
      if (date) loadHistory(date);
      else loadHistory();
    }
  )
  .subscribe();

function toIST(utcIso) {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(',', '');
}

async function listVideos(){
  const ul = document.getElementById('videoList'); ul.innerHTML = 'Loading...';
  const { data, error } = await supabase.storage.from('ads-videos').list('', { limit: 500 });
  if (error) { ul.innerHTML = '<li>Error listing videos</li>'; console.error(error); return; }
  ul.innerHTML = '';
  data.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = `${f.name} <button class="delBtn">Delete</button>`;
    li.querySelector('.delBtn').onclick = async () => {
      if (!confirm('Delete this file?')) return;
      const r = await supabase.storage.from('ads-videos').remove([f.name]);
      if (r.error) { alert('Delete failed: ' + r.error.message); console.error(r.error); }
      else listVideos();
    };
    ul.appendChild(li);
  });
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = e.target.video.files[0];
  if (!file) return alert('Select a file');
  const fileName = Date.now() + '-' + file.name;
  const { error } = await supabase.storage.from('ads-videos').upload(fileName, file);
  if (error) { alert('Upload failed: ' + error.message); console.error(error); return; }
  // optional video metadata table insert (if you created a videos table)
  await supabase.from('videos').insert([{ filename: file.name, storage_path: fileName, uploaded_by: sessionStorage.getItem('logged_user') || 'admin' }]).catch(()=>{});
  alert('Uploaded');
  listVideos();
});

// Load history (filter optional date param YYYY-MM-DD)
async function loadHistory(filterDate = null) {
  const tbody = document.getElementById('historyBody'); tbody.innerHTML = 'Loading...';
  try {
    let q = supabase.from('login_history').select('*').neq('user_name','admin').order('login_time', { ascending: false });
    if (filterDate) {
      const start = new Date(filterDate + 'T00:00:00Z').toISOString();
      const end = new Date(filterDate + 'T23:59:59Z').toISOString();
      q = q.gte('login_time', start).lte('login_time', end);
    }
    const { data, error } = await q;
    if (error) { tbody.innerHTML = '<tr><td colspan="5">Error loading history</td></tr>'; console.error(error); return; }
    tbody.innerHTML = '';
    (data||[]).forEach(r => {
      let logoutDisplay = r.logout_time ? toIST(r.logout_time) : 'Active';
      if (!r.logout_time && r.last_ping) {
        const lastPing = new Date(r.last_ping);
        const ageSec = (Date.now() - lastPing.getTime()) / 1000;
        if (ageSec > 70) logoutDisplay = toIST(r.last_ping) + ' (detected offline)';
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.user_name}</td><td>${toIST(r.login_time)}</td><td>${logoutDisplay}</td><td>${r.device_model||''}</td><td class="user-agent" title="${r.user_agent||''}">${r.user_agent||''}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5">Error loading history</td></tr>';
  }
}

document.getElementById('filterBtn').onclick = () => {
  const date = document.getElementById('filterDate').value;
  if (!date) { alert('Pick a date'); return; }
  loadHistory(date);
};
document.getElementById('refreshBtn').onclick = () => {
  document.getElementById('filterDate').value = '';
  loadHistory();
};

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
  const start = new Date(date + 'T00:00:00Z').toISOString();
  const end = new Date(date + 'T23:59:59Z').toISOString();
  const { data, error } = await supabase.from('login_history').select('*').neq('user_name','admin').gte('login_time', start).lte('login_time', end).order('login_time', { ascending:false });
  if (error) { alert('Export failed'); console.error(error); return; }
  const blob = new Blob([csvFromRows(data||[])], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `history-${date}.csv`; a.click();
};

// auto-refresh every 5s (ok for GitHub Pages - unlimited bandwidth)


// initial load
listVideos();
loadHistory();
