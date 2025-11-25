// ---------- IST Format ----------
function toIST(utcIso) {
  if (!utcIso) return "";
  const d = new Date(utcIso);
  return d.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", "");
}

// ------------------- VIDEO LIST -------------------
async function listVideos() {
  const ul = document.getElementById("videoList");
  ul.innerHTML = "Loading...";

  const { data, error } = await supabase.storage.from("ads-videos").list("", { limit: 500 });

  if (error) {
    ul.innerHTML = "<li>Error loading videos</li>";
    return;
  }

  ul.innerHTML = "";
  data.forEach((file) => {
    const li = document.createElement("li");
    li.innerHTML = `${file.name} <button class="delete-btn">Delete</button>`;

    li.querySelector(".delete-btn").onclick = async () => {
      if (!confirm("Delete this video?")) return;

      const r = await supabase.storage.from("ads-videos").remove([file.name]);
      if (r.error) {
        alert("Delete failed");
      } else {
        listVideos();
      }
    };

    ul.appendChild(li);
  });
}

// ---------- UPLOAD ----------
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = e.target.video.files[0];
  if (!file) return alert("Select a file");

  const name = Date.now() + "-" + file.name;

  const { error } = await supabase.storage.from("ads-videos").upload(name, file);
  if (error) {
    alert("Upload failed");
    return;
  }

  alert("Uploaded");
  listVideos();
});

// ------------------- CREATE USER -------------------
document.getElementById("createUserBtn").onclick = async () => {
  const un = document.getElementById("newUserName").value;
  const pwd = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;

  if (!un || !pwd) return alert("Enter username and password");

  const { data, error } = await supabase.rpc("create_user", {
    un,
    pwd,
    role_in: role
  });

  if (error) {
    alert("Create failed: " + error.message);
    return;
  }

  alert("User Created");
  loadUsers();
};

// ------------------- LIST USERS -------------------
async function loadUsers() {
  const ul = document.getElementById("userList");

  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role")
    .order("username");

  if (error) {
    ul.innerHTML = "<li>Error loading users</li>";
    return;
  }

  ul.innerHTML = "";
  data.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `${u.username} (${u.role})`;

    if (u.role !== "admin") {
      const b = document.createElement("button");
      b.className = "user-delete-btn";
      b.innerText = "Delete";
      b.onclick = () => deleteUser(u.id);
      li.appendChild(b);
    }

    ul.appendChild(li);
  });
}

// ------------------- DELETE USER -------------------
async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  const { data, error } = await supabase.rpc("delete_user", { uid: id });

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  alert("User deleted");
  loadUsers();
}

// ------------------- LOAD HISTORY -------------------
async function loadHistory(filterDate = null) {
  const body = document.getElementById("historyBody");
  body.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

  let q = supabase
    .from("login_history")
    .select("*")
    .neq("user_name", "admin")
    .order("login_time", { ascending: false });

  if (filterDate) {
    const start = filterDate + "T00:00:00";
    const end = filterDate + "T23:59:59";
    q = q.gte("login_time", start).lte("login_time", end);
  }

  const { data, error } = await q;

  if (error) {
    body.innerHTML = "<tr><td colspan='5'>Error loading history</td></tr>";
    return;
  }

  body.innerHTML = "";

  data.forEach((r) => {
    const tr = document.createElement("tr");

    let logout = r.logout_time ? toIST(r.logout_time) : "Active";

    tr.innerHTML = `
      <td>${r.user_name}</td>
      <td>${toIST(r.login_time)}</td>
      <td>${logout}</td>
      <td>${r.device_model || ""}</td>
      <td>${r.user_agent || ""}</td>
    `;

    body.appendChild(tr);
  });
}

// ------------------- EXPORT -------------------
function csv(rows) {
  let out = "Username,Login,Logout,Device,UserAgent\n";
  rows.forEach((r) => {
    out += `"${r.user_name}","${toIST(r.login_time)}","${r.logout_time ? toIST(r.logout_time) : ""}","${r.device_model || ""}","${(r.user_agent || "").replace(/"/g, '""')}"\n`;
  });
  return out;
}

document.getElementById("exportAllBtn").onclick = async () => {
  const { data } = await supabase
    .from("login_history")
    .select("*")
    .neq("user_name", "admin");

  const blob = new Blob([csv(data || [])], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "history-all.csv";
  a.click();
};

document.getElementById("exportFilteredBtn").onclick = async () => {
  const date = document.getElementById("filterDate").value;
  if (!date) return alert("Pick a date");

  const start = date + "T00:00:00";
  const end = date + "T23:59:59";

  const { data } = await supabase
    .from("login_history")
    .select("*")
    .neq("user_name", "admin")
    .gte("login_time", start)
    .lte("login_time", end);

  const blob = new Blob([csv(data || [])], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `history-${date}.csv`;
  a.click();
};

// ------------------- FILTER BUTTONS -------------------
document.getElementById("filterBtn").onclick = () => {
  const d = document.getElementById("filterDate").value;
  if (!d) return alert("Pick a date");
  loadHistory(d);
};

document.getElementById("refreshBtn").onclick = () => {
  document.getElementById("filterDate").value = "";
  loadHistory();
};

// ------------------- BROADCAST SUBSCRIPTION -------------------
let channel = supabase.channel("login_updates");

channel.on("broadcast", { event: "*" }, () => {
  loadHistory();
});

channel.subscribe();

// ------------------- INIT -------------------
listVideos();
loadUsers();
loadHistory();
