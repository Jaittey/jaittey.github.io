DF7 / Small Business Premium UI Fix
==================================

Problem found:
The two premium CSS files were copied into src/, but React/Vite never loaded them.
Only ./styles.css was imported by src/main.jsx.

Fixed:
1. src/main.jsx now imports, in this exact order:
   - ./styles.css
   - ./df7-premium-ui.css
   - ./df7-premium-mobile.css
2. Service-worker cache name was changed so deployed users do not stay on an older cached shell.
3. Existing application code and data logic were left unchanged.

Deploy:
Upload/replace the repository files, commit to main, and let the GitHub Pages workflow finish.
Then hard refresh once (Ctrl+F5).
