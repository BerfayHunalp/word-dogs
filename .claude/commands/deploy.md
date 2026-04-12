Run pre-deploy checks and deploy the app.

1. Run `npm run ci` (lint + typecheck + test + build)
2. If CI fails, stop and report the issue
3. If CI passes, confirm with the user before deploying
4. Deploy frontend: `npx wrangler pages deploy dist --project-name word-dogs`
5. Optionally deploy worker: `cd worker && npx wrangler deploy`
6. Report deployment status and live URLs
