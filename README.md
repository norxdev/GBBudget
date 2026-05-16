# Clarity — Budget Dashboard

A modern personal budgeting app built with React + Vite + Supabase.

## File Structure

```
GBBudget/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-deploys to GitHub Pages on every push
├── src/
│   ├── components/
│   │   ├── Toast.jsx
│   │   ├── Toast.module.css
│   │   ├── UpgradeModal.jsx
│   │   └── UpgradeModal.module.css
│   ├── lib/
│   │   └── supabase.js         # Supabase client (reads from env vars)
│   ├── pages/
│   │   ├── AppShell.jsx        # Main layout + nav
│   │   ├── AppShell.module.css
│   │   ├── Budget.jsx          # Budget entry tab
│   │   ├── Budget.module.css
│   │   ├── Dashboard.jsx       # Dashboard tab
│   │   ├── Dashboard.module.css
│   │   ├── Goals.jsx           # Savings goals tab
│   │   ├── Goals.module.css
│   │   ├── LoginPage.jsx       # Login + signup
│   │   ├── LoginPage.module.css
│   │   ├── Reports.jsx         # Reports + CSV export
│   │   └── Reports.module.css
│   ├── App.jsx                 # Root: handles auth state
│   ├── index.css               # Global CSS variables + resets
│   └── main.jsx                # React entry point
├── .env.example                # Template for environment variables
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## Setup Steps

### 1. Create the GitHub repository

1. Go to github.com → New repository
2. Name it exactly: `GBBudget`
3. Set to Public
4. Do NOT initialize with README (you're uploading files)
5. Upload all these files maintaining the folder structure

### 2. Add your Supabase keys as GitHub Secrets

(Do this BEFORE pushing — the build will fail without them)

1. In your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:

| Secret name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

### 3. Enable GitHub Pages

1. In your GitHub repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### 4. Push your code

Once files are uploaded and secrets are set, go to the **Actions** tab in GitHub. You'll see the deploy workflow running. When it's green, your site is live at:

```
https://norxdev.github.io/GBBudget/
```

---

## Adding Supabase Keys Later

When you have your Supabase keys ready:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add the two secrets above
3. Go to Actions → re-run the latest workflow

The site will rebuild and connect to your database automatically.

---

## Local Development (Optional)

If you install Node.js later:

```bash
cp .env.example .env.local
# Fill in your Supabase keys in .env.local

npm install
npm run dev
# Opens at http://localhost:5173/GBBudget/
```
