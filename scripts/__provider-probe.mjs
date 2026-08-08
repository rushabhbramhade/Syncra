import pg from 'pg';
import crypto from 'crypto';

process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const key = crypto.createHash("sha256").update(process.env.TOKEN_ENCRYPTION_KEY).digest();
function decrypt(enc) {
  if (!enc) return "";
  try {
    const [ivHex, data] = enc.split(":");
    if (!ivHex || !data) return "";
    const d = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
    return d.update(data, "hex", "utf8") + d.final("utf8");
  } catch { return ""; }
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const userId = "34bc8d0a-65ef-4ac5-800b-2ced669100ce";
const { rows } = await client.query(
  "SELECT provider, email, scopes, encrypted_access_token FROM user_integrations WHERE user_id=$1", [userId]);
for (const r of rows) {
  if (r.provider !== "github" && r.provider !== "slack") continue;
  const token = decrypt(r.encrypted_access_token);
  console.log(`\n##### ${r.provider} (${r.email}) scopes=${r.scopes} tokenLen=${token?.length}`);
  if (!token) { console.log("  ! token decrypt failed"); continue; }
  if (r.provider === "github") {
    const H = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    try {
      const user = await (await fetch("https://api.github.com/user", { headers: H })).json();
      console.log("  /user:", user.login, "| id:", user.id, "| public_repos:", user.public_repos);
    } catch (e) { console.log("  /user ERROR:", e.message); }
    try {
      const issues = await (await fetch("https://api.github.com/issues?filter=all&state=open&per_page=100", { headers: H })).json();
      console.log("  /issues filter=all:", Array.isArray(issues) ? issues.length : JSON.stringify(issues).slice(0, 200));
    } catch (e) { console.log("  /issues ERROR:", e.message); }
    try {
      const notifs = await (await fetch("https://api.github.com/notifications?per_page=100", { headers: H })).json();
      console.log("  /notifications:", Array.isArray(notifs) ? notifs.length : JSON.stringify(notifs).slice(0, 200));
    } catch (e) { console.log("  /notifications ERROR:", e.message); }
    try {
      const events = await (await fetch("https://api.github.com/users/" + "NEED_LOGIN" + "/events/public?per_page=30", { headers: H })).json();
      console.log("  /events sample:", Array.isArray(events) ? events.length : JSON.stringify(events).slice(0,120));
    } catch {}
  } else {
    const AH = { Authorization: `Bearer ${token}` };
    try {
      const auth = await (await fetch("https://slack.com/api/auth.test", { headers: AH })).json();
      console.log("  auth.test:", auth.ok ? `user=${auth.user} team=${auth.team}` : JSON.stringify(auth).slice(0,200));
    } catch (e) { console.log("  auth.test ERROR:", e.message); }
    try {
      const list = await (await fetch("https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&limit=100", { headers: AH })).json();
      console.log("  conversations.list:", list.ok ? `channels=${(list.channels||[]).length}` : JSON.stringify(list).slice(0,300));
      if (list.ok && list.channels?.length) {
        const ch = list.channels[0];
        console.log("  first channel:", ch.id, ch.name, ch.is_im, ch.is_mpim);
        const hist = await (await fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=5`, { headers: AH })).json();
        console.log("  conversations.history (first channel):", hist.ok ? `messages=${(hist.messages||[]).length}` : JSON.stringify(hist).slice(0,300));
      }
    } catch (e) { console.log("  conversations.list ERROR:", e.message); }
  }
}
await client.end();