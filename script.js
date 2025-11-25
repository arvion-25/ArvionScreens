/******************************************************************
 * SUPABASE HELPER
 ******************************************************************/
function toIST(utcIso) {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })
          .replace(',', '');
}

// Convert timestamp → "YYYY-MM-DD" in IST for date filtering
function toISTDate(ts) {
  if (!ts) return '';
  const ist = new Date(ts).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
  const [d, m, y] = ist.split(',')[0].split('/');
  return `${y}-${m}-${d}`;
}

/******************************************************************
 * VIDEO LIST (UPLOAD, DELETE)
 ******************************************************************/
async function listVideos() {
  const ul = document.getElementById('videoList');
  ul.innerHTML = 'Loading...';

  try {
    const { data, error } = await supabase
      .storage
      .from('ads-videos')
      .list('', { limit: 500 });

    if (error) {
      ul.innerHTML = '<li>Error listing videos</li>';
      console.error(error);
      return;
    }

    ul.innerHTML = '';
    data.forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `${f.name} <button class="delBtn">Delete</button>`;

      li.querySelector('.delBtn').onclick = async () => {
        if (!confirm('Delete this file?')) return;

        const r = await supabase
          .storage
          .from('ads-videos')
          .remove([f.name]);

        if (r.error) {
          alert('Delete failed: ' + r.error.message);
          console.error(r.error);
        } else {
          listVideos();
        }
      };

      ul.appendChild(li);
    });

  } catch (e) {
    console.error(e);
    ul.innerHTML = '<li>Error listing videos</li>';
  }
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = e.target.video.files[0];
  if (!file) return alert('Select a file');

  const fileName = Date.now() + '-' + file.name;

  const { error } = await supabase.storage
    .from('ads-videos')
    .upload(fileName, file);

  if (error) {
    alert('Upload failed: ' + error.message);
    console.error(error);
    return;
  }

  alert('Uploaded');
  listVideos();
});

/******************************************************************
 * LOGIN HISTORY (DATE FILTER + REALTIME)
 ******************************************************************/
async function loadHistory(filterDate = null) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  const oldHTML = tbody.innerHTML;
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';

  try {
    // FETCH EVERYTHING FIRST
    let { data, error } = await supabase
      .from('login_history')
      .select('*')
      .neq('user_name', 'admin')
      .order('login_time', { ascending: false });

    if (error) {
      console.error(error);
      tbody.innerHTML = oldHTML || '<tr><td colspan="5">Error loading</td></tr>';
      return;
    }

    let rows = data || [];

    // ---- FIXED DATE FILTERING USING IST DATE ----
    if (filterDate) {
      rows = rows.filter(r => toISTDate(r.login_time) === filterDate);
    }

    // RENDER DATA
    tbody.innerHTML = '';
    rows.forEach(r => {
      let logoutDisplay = r.logout_time ? toIST(r.logout_time) : 'Active';

      if (!r.logout_time && r.last_ping) {
        const lastPing = new Date(r.last_ping);
        const sec = (Date.now() - lastPing.getTime()) / 1000;
        if (sec > 70) logoutDisplay = toIST(r.last_ping) + ' (detected offline)';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.user_name}</td>
        <td>${toIST(r.login_time)}</td>
        <td>${logoutDisplay}</td>
        <td>${r.device_model || ''}</td>
        <td title="${r.user_agent || ''}">
          ${r.user_agent || ''}
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = oldHTML || '<tr><td colspan="5">Error loading</td></tr>';
  }
}

/******************************************************************
 * EXPORT BUTTONS
 ******************************************************************/
function rowsToCSV(rows) {
  let out = 'Username,Login(IST),Logout(IST),Device,UserAgent\n';

  rows.forEach(r => {
    let logout = r.logout_time
      ? toIST(r.logout_time)
      : (r.last_ping ? toIST(r.last_ping) + ' (offline)' : '');

    out += `"${r.user_name}","${toIST(r.login_time)}","${logout}","${r.device_model || ''}","${(r.user_agent || '').replace(/"/g, '""')}"\n`;
  });

  return out;
}

document.getElementById('exportAllBtn').onclick = async () => {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .neq('user_name', 'admin');

  if (error) return alert('Export failed');

  const blob = new Blob([rowsToCSV(data)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'history-all.csv';
  a.click();
};

document.getElementById('exportFilteredBtn').onclick = async () => {
  const date = document.getElementById('filterDate').value;
  if (!date) return alert('Pick a date');

  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .neq('user_name', 'admin');

  if (error) return alert('Export failed');

  const filtered = data.filter(r => toISTDate(r.login_time) === date);

  const blob = new Blob([rowsToCSV(filtered)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `history-${date}.csv`;
  a.click();
};

/******************************************************************
 * REALTIME BROADCAST CHANNEL (for live login/logout)
 ******************************************************************/
let channel = supabase.channel('login_updates');

channel.on('broadcast', { event: '*' }, (payload) => {
  console.log('Realtime update:', payload);
  const fd = document.getElementById('filterDate').value;
  if (fd) loadHistory(fd);
  else loadHistory();
});

channel.subscribe();

/******************************************************************
 * BUTTON HANDLERS
 ******************************************************************/
document.getElementById('filterBtn').onclick = () => {
  const date = document.getElementById('filterDate').value;
  if (!date) return alert('Pick a date');
  loadHistory(date);
};

document.getElementById('refreshBtn').onclick = () => {
  document.getElementById('filterDate').value = '';
  loadHistory();
};

/******************************************************************
 * INITIAL LOAD
 ******************************************************************/
listVideos();
loadHistory();
