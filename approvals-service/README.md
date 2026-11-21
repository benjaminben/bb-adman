# Adman approvals service

## Deploying

The stakeholder's steps. No value is written in the repository; the stakeholder supplies each one.

1. **Project.** In Vercel, add a new project from this repository (or run `npx vercel` yourself in `approvals-service/`). Framework: Next.js. **Root Directory: `approvals-service`.** Node.js version: 24.x.
2. **Database.** Project, Storage: add Turso from the Marketplace, create a database, and connect it to the project for **Production only**. This sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Choose the database region nearest the function region (step 3).
3. **Region.** Project Settings, Functions: set the function region to the one nearest your reviewers and the same as (or nearest to) the database.
4. **Key.** Make a long random key (at least 32 characters; for example `openssl rand -base64 48`). Project Settings, Environment Variables: add `API_KEY` with that value, marked Sensitive, for Production only. Keep it for step 9. Never add `TEST_PICTURE_ORIGIN`.
5. **Migration.** On your machine, in `approvals-service/`, with the two Turso values from the Vercel Storage tab typed into the shell (not saved into any file in the repository): `TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:migrate -- --hosted`. Run it again after any later migration is added. Values typed on the command line stay in the shell's history, so read them in first without echo, then run the command with the variables:

   ```sh
   read -s TURSO_DATABASE_URL
   read -s TURSO_AUTH_TOKEN
   TURSO_DATABASE_URL="$TURSO_DATABASE_URL" TURSO_AUTH_TOKEN="$TURSO_AUTH_TOKEN" npm run db:migrate -- --hosted
   ```

   The service's scripts (`npm run dev`, `build`, `start`, `test:e2e`) set `NEXT_TELEMETRY_DISABLED=1` inline, which works on macOS and Linux but not in Windows `cmd`.
6. **Deployment Protection.** Project Settings, Deployment Protection: **Standard Protection** with Vercel Authentication. Previews and deployment addresses stay private; the production domain stays public, so visitors can open links. Not "All Deployments": that would block every visitor.
7. **Nothing extra on the pages.** Leave Web Analytics and Speed Insights off, and do not add their packages: they add scripts the page policy blocks and send visitor data to a third party. Leave the Vercel Toolbar off for production.
8. **Deploy** (push to the production branch, or Deploy in the dashboard). The production domain (`{project}.vercel.app`, or a custom domain added in Project Settings, Domains) is the service address. Never give the app a deployment address or a preview address.
9. In the app: Settings, "Approvals service": the address and the key, then "Test connection".
10. In the app: Settings, "Cloud storage": the S3 bucket, region and keys (the same ones publishing uses).

To change the key later: replace `API_KEY` in Vercel and redeploy, then put the new key in the app. Every session and link stays as it was.

**Values the stakeholder supplies:** the Vercel account and project; the Turso database (made through Vercel); the `API_KEY` value; the service address. **What the stakeholder creates on Vercel:** the project (root `approvals-service`), the Turso database connected to it, the `API_KEY` variable, the function region, the Deployment Protection setting, and optionally a custom domain.
