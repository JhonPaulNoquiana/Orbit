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
