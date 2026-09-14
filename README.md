# Orbit

Orbit is a full-stack, Trello-inspired workspace with a calmer visual system and a clearer permission model. It includes workspaces, boards, lists, draggable cards, due dates, priorities, labels, assignees, comments, progress summaries, activity history, and responsive layouts.

## Roles

| Role | Access |
| --- | --- |
| Owner | Updates the workspace, appoints admins, manages every member, and controls all boards |
| Admin | Updates workspace settings; manages members and guests; creates, edits, archives, and deletes boards |
| Member | Sees all workspace boards and creates or edits boards, lists, cards, labels, dates, and assignees |
| Guest | Sees only assigned boards, opens card details, and participates in comments; cannot change board content |

The first account created becomes the owner of its own workspace. To add another person, that person creates an Orbit account first; an owner or admin can then add their email from **Members**. Guest access can be restricted to selected boards.

All interface icons are rendered as SVGs. The workspace switcher supports multiple teams, board search supports `Ctrl/Cmd + K`, and every visible menu/control is connected to an action.

## Run locally

1. Keep `DATABASE_URL` in `backend/.env` (already configured in this workspace).
2. Add a strong `JWT_SECRET` to `backend/.env` before production use.
3. From the repository root, run:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`.

The API runs at `http://localhost:4000`. On first launch, it creates the configured PostgreSQL database when needed and then safely creates any missing tables and indexes.

## Commands

- `npm run dev` — start frontend and backend in watch mode
- `npm run build` — create the frontend production bundle
- `npm test` — run backend tests and verify a frontend production build
- `npm start` — start the API only

## Deploy to Render

The root `render.yaml` defines the complete Render deployment:

- One static frontend service (`orbit-web`) that remains available and displays the startup screen
- One Node web service (`orbit-app`) for the Express API
- One separate managed Render PostgreSQL database
- An automatically generated production `JWT_SECRET`
- A health check at `/api/health`
- React Router fallback support for direct board URLs

Deployment steps:

1. Commit and push the repository to GitHub.
2. In Render, choose **New → Blueprint**.
3. Connect the GitHub repository and select `render.yaml`.
4. Review the `orbit-web`, `orbit-app`, and `orbit-db` resources, then apply the Blueprint.
5. Copy the public URL of `orbit-app`.
6. In the `orbit-web` service, set `VITE_API_URL` to the backend URL followed by `/api`, for example:

   ```text
   https://orbit-app.onrender.com/api
   ```

7. Redeploy `orbit-web` after saving the environment variable. Vite places this value into the production bundle at build time.
8. Share and open the generated `orbit-web.onrender.com` URL. This is the public application URL; it can show the loading screen immediately while `orbit-app` wakes from an idle state.

The API accepts requests from Render-hosted frontend URLs automatically. If the frontend later uses a custom domain, add that exact origin to the backend's `CLIENT_URL` environment variable (multiple origins may be comma-separated), then redeploy the backend.

The frontend builds explicitly install development dependencies because Vite is a build-time tool and Render builds with `NODE_ENV=production`.

The Blueprint uses free plans for initial testing. Review Render's current free-tier limits and upgrade the database before storing production data.
