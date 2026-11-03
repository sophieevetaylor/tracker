// Every hour, copies your plan to progress.json on a "progress" branch of your GitHub repo,
// so Claude can read how your year is going. Optional: does nothing until both are set in Netlify:
//   GITHUB_TOKEN  a fine-grained token with Contents read and write on this one repo
//   GITHUB_REPO   yourname/plan-2027
// Commits only when something changed, and never triggers a Netlify rebuild.
import { getStore } from "@netlify/blobs";

const BRANCH = "progress";
const FILE = "progress.json";

const env = (k) => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k];

export default async () => {
  const res = await copy();
  console.log("[mirror]", await res.clone().text());
  return res;
};

async function copy() {
  const token = env("GITHUB_TOKEN");
  const repo = (env("GITHUB_REPO") || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  if (!token || !repo) return new Response("Mirror off: GITHUB_TOKEN or GITHUB_REPO not set");

  const store = getStore({ name: "plan2027", consistency: "strong" });
  const state = await store.get("state", { type: "json" });
  if (!state) return new Response("Nothing saved yet");

  const gh = (path, init = {}) =>
    fetch("https://api.github.com/repos/" + repo + path, {
      ...init,
      headers: {
        authorization: "Bearer " + token,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "plan-2027",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });

  const content = JSON.stringify(state, null, 2) + "\n";

  // Current copy, if any.
  let sha;
  const cur = await gh("/contents/" + FILE + "?ref=" + BRANCH);
  if (cur.ok) {
    const f = await cur.json();
    sha = f.sha;
    if (Buffer.from(f.content || "", "base64").toString("utf8") === content) return new Response("Unchanged");
  } else if (cur.status === 404) {
    // First run: create the progress branch from the main branch.
    const br = await gh("/git/ref/heads/" + BRANCH);
    if (br.status === 404) {
      const info = await gh("");
      if (!info.ok) return fail("Can't see the repo", info);
      const main = await gh("/git/ref/heads/" + (await info.json()).default_branch);
      if (!main.ok) return fail("Can't read the main branch", main);
      const made = await gh("/git/refs", {
        method: "POST",
        body: JSON.stringify({ ref: "refs/heads/" + BRANCH, sha: (await main.json()).object.sha }),
      });
      if (!made.ok) return fail("Can't create the progress branch", made);
    } else if (!br.ok) return fail("Can't check the progress branch", br);
  } else return fail("Can't read progress.json", cur);

  const put = await gh("/contents/" + FILE, {
    method: "PUT",
    body: JSON.stringify({
      message: "Progress " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC [skip netlify]",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) return fail("Can't save progress.json", put);
  return new Response("Copied");
}

async function fail(msg, res) {
  const detail = await res.text().catch(() => "");
  console.error(msg, res.status, detail.slice(0, 300));
  return new Response(msg + " (" + res.status + ")", { status: 500 });
}

export const config = { schedule: "@hourly" };
