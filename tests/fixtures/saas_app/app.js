/* This UI exercises the real fixture API. It never inserts user content as HTML. */
const byId = (id) => document.getElementById(id);
let csrf = "";
const pendingKeys = new Map();

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Something went wrong. Please retry.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function announce(message) { byId("status").textContent = message; }
function showError(error) {
  byId("error").textContent = error instanceof TypeError
    ? "The connection was interrupted. Retry your action; a completed outline will not use another credit."
    : error.message;
  byId("error").hidden = false;
  byId("error").focus();
}
function clearError() { byId("error").hidden = true; byId("error").textContent = ""; }

async function busy(button, message, action) {
  clearError();
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = message;
  announce(message);
  try { await action(); }
  catch (error) { announce(""); showError(error); }
  finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = label;
  }
}

function renderAccount(account) {
  byId("account-email").textContent = account.email;
  byId("balance").textContent = account.plan === "free" ? "Free plan · 0 outline credits" : `Demo plan · ${account.credits} outline credits`;
  byId("upgrade").hidden = account.plan !== "free";
}

async function renderBriefs() {
  const { briefs } = await api("/api/briefs");
  const list = byId("briefs");
  list.replaceChildren();
  byId("empty").hidden = briefs.length !== 0;
  for (const brief of briefs) {
    const item = document.createElement("li");
    const title = document.createElement("h3");
    title.textContent = brief.title;
    item.append(title);
    if (brief.outline) {
      const outline = document.createElement("pre");
      outline.className = "outline";
      outline.textContent = brief.outline;
      item.append(outline);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = brief.outline ? "Create another outline" : "Create outline";
    button.addEventListener("click", () => busy(button, "Creating outline…", async () => {
      const key = pendingKeys.get(brief.id) || crypto.randomUUID();
      pendingKeys.set(brief.id, key);
      await api(`/api/briefs/${brief.id}/outline`, { method: "POST", body: "{}", headers: { "Idempotency-Key": key } });
      renderAccount((await api("/api/session")).account);
      await renderBriefs();
      // A committed operation is still pending from the user's perspective until
      // both refreshes display it. Retrying a failed refresh must replay its key.
      pendingKeys.delete(brief.id);
      announce("Outline saved. You can return to it later.");
      byId("saved-heading").setAttribute("tabindex", "-1");
      byId("saved-heading").focus();
    }));
    item.append(button);
    list.append(item);
  }
}

async function enterWorkspace(session) {
  csrf = session.csrf;
  renderAccount(session.account);
  byId("auth").hidden = true;
  byId("workspace").hidden = false;
  byId("logout").hidden = false;
  await renderBriefs();
  byId("title").focus();
}

byId("auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.submitter || event.target.querySelector("button");
  busy(button, button.value === "login" ? "Signing in…" : "Creating account…", async () => {
    const session = await api(`/api/${button.value}`, {
      method: "POST", body: JSON.stringify({ email: byId("email").value, password: byId("password").value }),
    });
    byId("password").value = "";
    await enterWorkspace(session);
    announce("You are signed in. Your briefs stay private to this account.");
  });
});

byId("brief-form").addEventListener("submit", (event) => {
  event.preventDefault();
  busy(event.target.querySelector("button"), "Saving brief…", async () => {
    await api("/api/briefs", { method: "POST", body: JSON.stringify({ title: byId("title").value }) });
    byId("title").value = "";
    await renderBriefs();
    announce("Brief saved. Create an outline when you are ready.");
    byId("title").focus();
  });
});

byId("upgrade").addEventListener("click", (event) => busy(event.target, "Enabling demo plan…", async () => {
  const { account } = await api("/api/fixture/plan", { method: "POST", body: '{"plan":"demo"}' });
  renderAccount(account);
  announce("Demo plan enabled. No payment was made.");
  byId("title").focus();
}));

byId("logout").addEventListener("click", (event) => busy(event.target, "Signing out…", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  csrf = "";
  pendingKeys.clear();
  byId("briefs").replaceChildren();
  byId("workspace").hidden = true;
  byId("logout").hidden = true;
  byId("auth").hidden = false;
  byId("email").focus();
  announce("Signed out. Sign in again to return to your briefs.");
}));

(async () => {
  announce("Loading your workspace…");
  try { await enterWorkspace(await api("/api/session")); announce("Your saved workspace is ready."); }
  catch (error) {
    byId("auth").hidden = false;
    announce("");
    if (error.status !== 401) showError(error);
  }
})();
