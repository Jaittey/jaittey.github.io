# DF7 setup — do these steps in order

## 1. Install software

Install Node.js LTS, Git and Visual Studio Code.

Open Terminal in this project folder:

```bash
npm install
```

## 2. Create Firebase project

1. Open Firebase Console.
2. Create project: `df7-business-app`.
3. Add a Web App.
4. Copy the Firebase configuration values.
5. Open Authentication → Sign-in method → enable Google.
6. Open Authentication → Settings → Authorized domains → add `jaittey.github.io`.
7. Create Firestore Database in production mode.

## 3. Configure local environment

Copy `.env.example` to `.env` and fill every value.

```bash
cp .env.example .env
```

Set `VITE_OWNER_EMAIL` to the exact Google email that may access the app.

## 4. Protect Firestore

Open `backend/firestore.rules` and replace:

```text
YOUR_GOOGLE_EMAIL@gmail.com
```

with the same owner email used in `.env`.

Install/login to Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and enter your Firebase project ID, then deploy rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 5. Configure Google Drive

1. Open Google Cloud Console using the same project.
2. APIs & Services → Library → enable Google Drive API.
3. Configure OAuth consent screen.
4. While testing, add your Google email as a test user.
5. Credentials → Create credentials → OAuth client ID → Web application.
6. Authorized JavaScript origins:

```text
http://localhost:5173
https://jaittey.github.io
```

7. Copy the Web Client ID to `VITE_GOOGLE_CLIENT_ID`.
8. Do not put a Google client secret anywhere in this project.

## 6. Test locally

```bash
npm run dev
```

Open the displayed localhost address. Test:

- Google login
- Add a customer
- Add a product
- Create invoice
- Verify product stock decreases
- Create quotation
- Download PDF
- Connect Google Drive and upload PDF

## 7. Create GitHub repository

Create or use:

```text
https://github.com/jaittey/jaittey.github.io
```

Upload this entire project to the repository root.

## 8. Add GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions → New repository secret.

Create these eight secrets using the same values from `.env`:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_OWNER_EMAIL
VITE_GOOGLE_CLIENT_ID
```

These frontend Firebase configuration values are visible in a compiled web app by design. Never add service-account JSON, private keys, refresh tokens or Google client secrets.

## 9. Enable GitHub Pages

Repository → Settings → Pages → Source → GitHub Actions.

## 10. Push files

```bash
git init
git add .
git commit -m "Create DF7 private business app"
git branch -M main
git remote add origin https://github.com/jaittey/jaittey.github.io.git
git push -u origin main
```

Open the Actions tab and wait for the deployment workflow to complete. Then open:

```text
https://jaittey.github.io
```

## Important security fact

The website URL and frontend code are public on GitHub Pages, but the business data is private. Firestore rejects every request unless it comes from the exact approved Google account.
