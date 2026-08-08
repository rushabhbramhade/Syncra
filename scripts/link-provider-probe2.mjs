import pg from 'pg';
import crypto from 'crypto';
process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const key = crypto.createHash("sha256").update(process.env.TOKEN_ENCRYPTION_KEY).digest();
function decrypt(enc){if(!enc)return"";try{const[iv,data]=enc.split(":");if(!iv||!data)return"";const d=crypto.createDecipheriv("aes-256-cbc",key,Buffer.from(iv,"hex"));return d.update(data,"hex","utf8")+d.final("utf8");}catch{return"";}}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const userId = "34bc8d0a-65ef-4ac5-800b-2ced669100ce";
const { rows } = await client.query("SELECT provider, email, encrypted_access_token FROM user_integrations WHERE user_id=$1 AND provider IN ('github','slack')",[userId]);
const gh = rows.find(r=>r.provider==="github"); const sl = rows.find(r=>r.provider==="slack");
const ghToken = decrypt(gh.encrypted_access_token);
const GH = { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
console.log("=== GitHub repos ===");
const repos = await (await fetch("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member", { headers: GH })).json();
for (const r of (repos||[])) console.log(`  ${r.full_name} pushed=${r.pushed_at} private=${r.private} default=${r.default_branch}`);
// events for each repo
for (const r of (repos||[]).slice(0,5)) {
  const ev = await (await fetch(`https://api.github.com/repos/${r.full_name}/events?per_page=10`, { headers: GH })).json();
  if (Array.isArray(ev)) {
    console.log(`  ${r.full_name} events=${ev.length}`, ev.slice(0,3).map(e=>`${e.type}@${e.created_at}`).join(", "));
  } else console.log(`  ${r.full_name} events err:`, JSON.stringify(ev).slice(0,120));
}
console.log("\n=== Slack channels detail ===");
const AH = { Authorization: `Bearer ${decrypt(sl.encrypted_access_token)}` };
const list = await (await fetch("https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&limit=100", { headers: AH })).json();
for (const c of (list.channels||[])) {
  const h = await (await fetch(`https://slack.com/api/conversations.history?channel=${c.id}&limit=3`, { headers: AH })).json();
  console.log(`  ${c.id} name=${c.name||''} is_im=${!!c.is_im} is_mpim=${!!c.is_mpim} user=${c.user||''} history=${h.ok?`ok ${h.messages?.length}msgs`:`${h.error}`}`);
}
await client.end();
