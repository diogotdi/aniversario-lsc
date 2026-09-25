# Leixões SC — 119.º Aniversário — Project Management Tool

## 🏠 Deployment URL
`https://aniversario.leixoessc.com/project-management`

## 📁 File Structure

```
project-management/
├── index.html          ← Main entry point (6 KB)
├── manifest.json       ← PWA manifest for home screen install
├── sw.js               ← Service worker for offline support
├── .htaccess           ← Apache server config (optional)
├── _headers            ← Netlify/Vercel headers (optional)
├── css/
│   └── app.css         ← Full stylesheet with dark mode (29 KB)
├── js/
│   └── app.js          ← Complete application logic (70 KB)
└── icons/
    └── icon.svg        ← App icon (SVG, scalable)
```

**Total size: ~106 KB** (before GZIP; ~35 KB compressed)

## 🚀 Deployment Instructions

### Option A: FTP / cPanel (Traditional Hosting)
1. Connect to your server via FTP/SFTP
2. Navigate to the web root (e.g., `/public_html/` or `/var/www/html/`)
3. Create the directory `project-management/`
4. Upload **all files** maintaining the folder structure above
5. Visit `https://aniversario.leixoessc.com/project-management`

### Option B: Netlify / Vercel
1. Create a new site from this folder
2. Set **Publish directory** to `project-management/`
3. Configure redirect: `/*` → `/index.html` (200)
4. Deploy

### Option C: WordPress (subdirectory)
1. In your WordPress hosting file manager, navigate to `wp-content/` level
2. Go UP to the root (same level as `wp-config.php`)
3. Create `project-management/` folder
4. Upload all files there
5. No WordPress plugin needed — it runs independently

### Option D: Nginx
Add to your server block:
```nginx
location /project-management/ {
    alias /var/www/html/project-management/;
    try_files $uri $uri/ /project-management/index.html;
    
    location ~* \.(css|js|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## ✅ Features
- 📊 Dashboard with KPI cards and donut chart
- 📋 Task list with 85+ pre-loaded tasks from the project plan
- 📊 Gantt chart with SVG dependency arrows
- 📅 Monthly calendar view
- 📁 File hosting with drag-and-drop upload
- ☑️ Subtasks with progress rollup
- 👥 Assignees and collaborators
- 🔗 Task dependencies
- 📥📤 CSV import/export (Asana-compatible)
- ☑️ Bulk status updates
- 🌙 Dark mode (system-aware + manual toggle)
- ⌨️ Keyboard shortcuts
- 🔔 Browser notifications
- 📱 PWA — installable on mobile home screens
- 💾 Offline-first — all data in localStorage
- 🔒 No server needed — runs entirely client-side

## 🔒 Data & Privacy
- All data stays in the browser (localStorage)
- No analytics, no tracking, no cookies
- No external requests after initial page load
- PWA cache enables full offline usage
