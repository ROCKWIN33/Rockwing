# Smile — Photo + GitHub + QR

This version changes the Smile flow to:

1. Open the admin page.
2. Capture a photo.
3. Immediately preview it and choose **Yes, Save Photo** or **Retake Photo**.
4. On Yes:
   - save a local browser backup in IndexedDB;
   - download a JPEG to the capturing device;
   - upload the confirmed JPEG to a GitHub repository through a secure serverless endpoint.
5. Only after the GitHub upload succeeds can the admin continue to the customer message.
6. Generate a QR code containing the customer message and the public GitHub image URL.
7. When the QR is scanned, the customer page displays the GitHub-saved photo and message.

## Important architecture

The browser **must not contain a GitHub Personal Access Token**. The `/api/upload.js` serverless function keeps the token on the server and calls the GitHub Contents API.

This project is prepared for Vercel's serverless-function format. The same idea can be adapted to Netlify Functions or another backend.

## GitHub setup

Create a GitHub repository that will hold the photos. The repository should be public if customers need to load images directly from `raw.githubusercontent.com` without authentication.

Create a GitHub token with only the minimum repository permissions required to create files in the target repository. Store it as a server environment variable, never in `app.js`.

Set these environment variables on the deployment platform:

```text
GITHUB_TOKEN=your_token
GITHUB_OWNER=your-github-username-or-organization
GITHUB_REPO=your-repository-name
GITHUB_BRANCH=main
GITHUB_FOLDER=photos
```

`GITHUB_BRANCH` defaults to `main` and `GITHUB_FOLDER` defaults to `photos`.

## Vercel deployment

Deploy the project as a Vercel project. The `/api/upload.js` file is automatically treated as a serverless function.

After deployment, configure the environment variables above in the Vercel project settings and redeploy.

The frontend calls:

```text
POST /api/upload
Content-Type: image/jpeg
```

The function returns JSON similar to:

```json
{
  "ok": true,
  "id": "SMILE-20260812161600-ABC123",
  "photoUrl": "https://raw.githubusercontent.com/OWNER/REPO/main/photos/SMILE-20260812161600-ABC123.jpg"
}
```

## Local testing

Camera access normally requires HTTPS. For the frontend alone, a local server can be started with:

```bash
python -m http.server 8080
```

However, the GitHub upload endpoint is a serverless function and is not provided by Python's simple HTTP server. For end-to-end GitHub testing, deploy to Vercel (or run the function using the platform's local development tooling).

## Privacy

The photo becomes publicly readable if the GitHub repository is public. Anyone who obtains the raw image URL can view the image. Do not use this architecture for private/sensitive photos without adding a private storage system and authenticated image delivery.

## Current fallback behavior

Every confirmed photo is also kept in the admin browser's IndexedDB and downloaded locally. If GitHub upload fails, the app does **not** generate a QR that pretends the photo was uploaded. It instead offers **Retry GitHub Upload** or **Take Another Photo**.
