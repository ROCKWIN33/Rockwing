// Vercel serverless function.
// Required environment variables:
// GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (optional; defaults to main), GITHUB_FOLDER (optional; defaults to photos)

export const config = {
  api: { bodyParser: false }
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed."});
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const folder = (process.env.GITHUB_FOLDER || "photos").replace(/^\/+|\/+$/g, "");

  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: "GitHub upload is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO on the server."
    });
  }

  if (!folder || folder.split("/").some(part => !part || part === "." || part === "..")) {
    return res.status(500).json({error: "GITHUB_FOLDER must be a non-empty repository folder path."});
  }

  const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
  if (contentType !== "image/jpeg") {
    return res.status(415).json({error: "Only JPEG photos are accepted."});
  }

  let buffer;
  try {
    buffer = await readRequestBody(req);
  } catch (e) {
    return res.status(400).json({error: "Could not read the image body."});
  }

  const maxBytes = 8 * 1024 * 1024;
  if (buffer.length === 0) return res.status(400).json({error: "Empty image."});
  if (buffer.length > maxBytes) return res.status(413).json({error: "Photo is larger than 8 MB."});
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
    return res.status(415).json({error: "The uploaded file is not a valid JPEG image."});
  }

  const id = `SMILE-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const filename = `${id}.jpg`;
  const path = `${folder}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

  let githubResponse;
  try {
    githubResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "Smile-Photo-App"
      },
      body: JSON.stringify({
        message: `Add Smile photo ${id}`,
        content: buffer.toString("base64"),
        branch
      })
    });
  } catch (error) {
    console.error("GitHub upload request failed:", error);
    return res.status(502).json({error: "Could not reach GitHub to upload the photo. Please retry."});
  }

  const githubData = await githubResponse.json().catch(() => ({}));
  if (!githubResponse.ok) {
    return res.status(githubResponse.status).json({
      error: githubData.message || "GitHub rejected the upload."
    });
  }

  const photoUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return res.status(200).json({ok: true, id, photoUrl, path});
}
