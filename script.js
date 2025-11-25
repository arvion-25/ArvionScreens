// Convert UTC → IST
function toIST(utcIso) {
  if (!utcIso) return "";
  return new Date(utcIso)
    .toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })
    .replace(",", "");
}

// ========================= CREATE USER =========================
document.getElementById("createUserBtn").onclick = async () => {
  const un = newUsername.value.trim();
  const pw = newPassword.value.trim();
  const rl = newRole.value.trim();
  const msg = document.getElementById("userMsg");

  if (!un || !pw) {
    msg.textContent = "Username and password required";
    return;
  }
  if (un === "admin") {
    msg.textContent = "You cannot create another admin";
    return;
  }

  const { data, error } = await supabase.rpc("create_user", {
    p_username: un,
    p_password: pw,
    p_role: rl
  });

  if (error) {
    msg.textContent = "Create failed: " + error.message;
    msg.style.color = "red";
  } else {
    msg.textContent = "User created";
    msg.style.color = "green";
    newUsername.value = "";
    newPassword.value = "";
  }
};

// ========================= VIDEO LIST / UPLOAD / DELETE =========================
async function listVideos() {
  const ul = document.getElementById("videoList");
  ul.innerHTML = "Loading…";

  const { data, error } = await supabase.storage.from("ads-videos").list("");

  if (error) {
    ul.innerHTML = "<li>Error loading videos</li>";
    return;
  }

  ul.innerHTML = "";

  data.forEach(file => {
    const li = document.createElement("li");
    li.innerHTML = `${file.name} <button class="delete-btn">Delete</button>`;
    li.querySelector("button").onclick = async () => {
      if (!confirm("Delete this video?")) return;
      await supabase.storage.from("ads-videos").remove([file.name]);
      listVideos();
    };
    ul.appendChild(li);
  });
}

uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  const file = e.target.video.files[0];
  if (!file) return;

  const fileName = Date.now() + "-" + file.name;

  const { error } = await supabase.storage.from("ads-videos").upload(fileName, file);

  if (error) {
    alert("Upload failed");
  } else {
    alert("Uploaded");
    listVideos();
  }
};

// ========================= HISTORY =========================
async function loadHistory(date = null) {
  const tbody = document.getElementById("historyBody");
  tbody.innerHTML = "<tr><td colspan='5'>Loading…</td></tr>";

  let q = supabase
    .from("login_history")
    .select("*")
    .neq("user_name", "admin")
    .order("login_time", { ascending: false });

  if (date) {
    const start = new Date(date + "T00:00:00+05:30").toISOString();
    const end = new Date(date + "T23:59:59+05:30").toISOString();
    q = q.gte("login_time", start).lte("login_time", end);
  }

  const { data, error } = await q;

  if (error) {
    tbody.innerHTML = "<tr><td colspan='5'>Error loading history</td></tr>";
    return;
  }

  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.user_name}</td>
      <td>${toIST(row.login_time)}</td>
      <td>${row.logout_time ? toIST(row.logout_time) : "Active"}</td>
      <td>${row.device_model || ""}</td>
      <td>${row.user_agent || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Filter buttons
filterBtn.onclick = () => {
  if (!filterDate.value) return alert("Pick a date");
  loadHistory(filterDate.value);
};
refreshBtn.onclick = () => {
  filterDate.value = "";
  loadHistory();
};

// ========================= REALTIME UPDATES =========================
supabase
  .channel("login_updates")
  .on("broadcast", { event: "*" }, () => loadHistory())
  .subscribe();

// ========================= INITIAL LOAD =========================
listVideos();

// Default show today's history
const today = new Date().toISOString().slice(0, 10);
filterDate.value = today;
loadHistory(today);
