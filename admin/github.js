// GitHub storage: reads/writes data/products.json and uploads photos via the Contents API.
// Imports nothing browser-only at load time, so the base64 helpers can be unit-tested in Node.
import { blobToBase64 } from "./images.js";

// ---------- UTF-8 safe base64 (btoa/atob alone break on emoji and accents) ----------
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, "")); // GitHub inserts newlines every 60 chars
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

// ---------- Errors with friendly wording ----------
export class GitHubError extends Error {
  constructor(message, { status = 0, kind = "other" } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.kind = kind; // network | auth | permission | notfound | conflict | rate | server | other
  }
}

export class ConflictError extends GitHubError {
  constructor(latest) {
    super(
      "The shop was changed somewhere else (maybe on another device). We loaded the newest version. Your edits are still on screen, so tap Save again to apply them.",
      { status: 409, kind: "conflict" },
    );
    this.name = "ConflictError";
    this.latest = latest;
  }
}

function friendly(status, apiMessage, context) {
  const m = apiMessage ? ` (${apiMessage})` : "";
  if (status === 401) return new GitHubError("GitHub didn't accept your key. It may have expired or been copied wrong. Sign out and connect again with a new key.", { status, kind: "auth" });
  if (status === 403 && /rate limit/i.test(apiMessage || "")) return new GitHubError("GitHub is asking us to slow down. Wait a minute and try again.", { status, kind: "rate" });
  if (status === 403) return new GitHubError(`Your key isn't allowed to change files. When you make the key, set "Contents" to "Read and write".${m}`, { status, kind: "permission" });
  if (status === 404) return new GitHubError(`GitHub couldn't find ${context || "that"}. Check the owner, repository and branch in Settings, and that your key was made for this repository.`, { status, kind: "notfound" });
  if (status === 409 || status === 422) return new GitHubError(`GitHub couldn't save that${m}`, { status, kind: "conflict" });
  if (status >= 500) return new GitHubError("GitHub is having trouble right now. Please try again in a few minutes.", { status, kind: "server" });
  return new GitHubError(`Something went wrong talking to GitHub (${status})${m}`, { status, kind: "other" });
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

export class GitHubStore {
  constructor({ token, owner, repo, branch = "main", catalogPath = "data/products.json", imageDir = "images/products" }) {
    Object.assign(this, { token, owner, repo, branch, catalogPath, imageDir });
    this.kind = "github";
    this.sha = null;
    this.raw = null; // last loaded JSON (to keep any extra top-level keys)
    this._ts = 0;
  }

  get repoUrl() {
    return `https://github.com/${this.owner}/${this.repo}`;
  }

  async _fetch(path, { method = "GET", body, raw = false, query = "" } = {}) {
    const url = `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}${query}`;
    let res;
    try {
      res = await fetch(url, {
        method,
        cache: "no-store",
        headers: {
          Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError("Can't reach GitHub. Check your internet connection and try again.", { kind: "network" });
    }
    return res;
  }

  async _json(res, context) {
    if (res.ok) return res.json();
    let apiMessage = "";
    try {
      apiMessage = (await res.json()).message || "";
    } catch {
      /* ignore */
    }
    throw friendly(res.status, apiMessage, context);
  }

  // Check the key works and can write; returns repo info.
  async verify() {
    const res = await this._fetch("");
    const info = await this._json(res, `the repository ${this.owner}/${this.repo}`);
    if (info.permissions && info.permissions.push === false) {
      throw new GitHubError('Your key can only look, not change, this shop. Make a new key with "Contents: Read and write".', { status: 403, kind: "permission" });
    }
    return info;
  }

  async load() {
    const path = `/contents/${encodePath(this.catalogPath)}`;
    const res = await this._fetch(path, { query: `?ref=${encodeURIComponent(this.branch)}` });
    const file = await this._json(res, `the product file (${this.catalogPath}) on branch "${this.branch}"`);
    let text;
    if (file.content && file.encoding === "base64") {
      text = base64ToUtf8(file.content);
    } else {
      // Large files come back without content; ask for the raw bytes instead.
      const r2 = await this._fetch(path, { raw: true, query: `?ref=${encodeURIComponent(this.branch)}` });
      if (!r2.ok) throw friendly(r2.status, "", "the product file");
      text = await r2.text();
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new GitHubError("The product file on GitHub isn't valid JSON, so the admin can't open it. It may need a manual fix.", { kind: "other" });
    }
    this.sha = file.sha;
    this.raw = data;
    return { ...data, categories: data.categories || [], products: data.products || [], bundles: data.bundles || [] };
  }

  async save(catalog, message) {
    if (!this.sha) await this.load();
    const content = utf8ToBase64(JSON.stringify({ ...this.raw, ...catalog }, null, 2) + "\n");
    const res = await this._fetch(`/contents/${encodePath(this.catalogPath)}`, {
      method: "PUT",
      body: { message, content, sha: this.sha, branch: this.branch },
    });
    if (res.ok) {
      const out = await res.json();
      this.sha = out.content.sha;
      this.raw = { ...this.raw, ...catalog };
      return { commitUrl: out.commit?.html_url };
    }
    let apiMessage = "";
    try {
      apiMessage = (await res.json()).message || "";
    } catch {
      /* ignore */
    }
    if (res.status === 409 || (res.status === 422 && /sha|does not match|expected/i.test(apiMessage))) {
      const latest = await this.load(); // fetch the newest copy so the next try works
      throw new ConflictError(latest);
    }
    throw friendly(res.status, apiMessage, "the product file");
  }

  // Upload one photo (a JPEG Blob). Returns the repo-relative path to store in products.json.
  async uploadImage(blob, { slug = "photo" } = {}) {
    const ts = Math.max(Date.now(), this._ts + 1);
    this._ts = ts;
    const path = `${this.imageDir}/${slug}-${ts}.jpg`;
    const res = await this._fetch(`/contents/${encodePath(path)}`, {
      method: "PUT",
      body: { message: `Admin: add photo ${slug}`, content: await blobToBase64(blob), branch: this.branch },
    });
    await this._json(res, "the photos folder");
    return path;
  }
}
