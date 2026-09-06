# Orbit: Tech Stack and System Flow

## 1. System overview

Orbit is a full-stack project-management application inspired by Trello. Users organize work inside workspaces, boards, lists, and cards. A role-based permission system controls who can manage the workspace and who can change or only view its boards.

The application has three main layers:

```text
React browser application
        |
        | JSON over HTTP (/api/*)
        v
Express REST API
        |
        | parameterized SQL
        v
PostgreSQL database
```

## 2. Technology stack

### Frontend

| Technology | Purpose |
| --- | --- |
| React 19 | Component-based user interface and client-side state |
| React DOM | Renders the React application in the browser |
| React Router | Handles login, dashboard, and board routes without full page reloads |
| Vite | Development server, hot reload, and production bundling |
| Lucide React | Interface icons rendered as inline SVG elements |
| Native Fetch API | Sends authenticated JSON requests to the backend |
| Native HTML drag-and-drop | Moves cards between lists |
| CSS | Responsive layouts, board presentation, dialogs, role badges, and visual states |

Important frontend files:

- `frontend/src/App.jsx` defines protected application routes.
- `frontend/src/hooks/useAuth.jsx` owns login state and refreshes workspace memberships.
- `frontend/src/services/api.js` is the shared API client and attaches the JWT.
- `frontend/src/pages/WorkspacePage.jsx` renders workspace statistics and boards.
- `frontend/src/pages/BoardPage.jsx` renders lists and cards and handles drag-and-drop.
- `frontend/src/components/WorkspaceModals.jsx` handles members, roles, guests, and activity.
- `frontend/src/components/CardModal.jsx` handles card details, labels, assignment, dates, completion, and comments.
- `frontend/src/styles/global.css` contains the responsive visual system.

### Backend

| Technology | Purpose |
| --- | --- |
| Node.js with ES modules | JavaScript runtime for the API |
| Express 5 | REST routing, middleware, request parsing, and error handling |
| `pg` | PostgreSQL connection pooling, queries, and transactions |
| PostgreSQL | Persistent relational data storage |
| bcryptjs | One-way password hashing using bcrypt |
| JSON Web Token | Seven-day authenticated sessions |
| CORS | Restricts which frontend origins can call the API |
| dotenv | Loads `DATABASE_URL`, `JWT_SECRET`, ports, and client settings |
| Node test runner | Backend unit tests without an additional test framework |

Important backend files:

- `backend/src/server.js` loads configuration, initializes PostgreSQL, and starts the API.
- `backend/src/app.js` configures middleware and mounts the routes.
- `backend/src/config/db.js` owns the connection pool, transactions, database creation, and schema setup.
- `backend/src/middleware/auth.js` validates JWTs and loads the signed-in user.
- `backend/src/middleware/permissions.js` enforces workspace and board access.
- `backend/src/routes/auth.js` handles registration, login, and session details.
- `backend/src/routes/workspaces.js` handles settings, members, roles, guest access, and activity.
- `backend/src/routes/boards.js` handles boards, lists, cards, and comments.

## 3. Database model

```text
users
  |-- owns --> workspaces
  |              |
  |              |-- workspace_members --> users
  |              |
  |              |-- boards
  |                    |
  |                    |-- board_guests --> guest users
  |                    |
  |                    |-- lists
  |                          |
  |                          |-- cards
  |                                |
  |                                |-- comments --> users
  |
  |-- activity_logs records actions in a workspace/board
```

### Tables

- `users`: name, normalized email, password hash, and avatar color.
- `workspaces`: workspace profile and permanent owner reference.
- `workspace_members`: one role per user per workspace.
- `boards`: workspace boards, color, starred state, and archived state.
- `board_guests`: limits guest accounts to explicitly assigned boards.
- `lists`: ordered workflow columns inside a board.
- `cards`: work items with description, priority, date, labels, assignee, completion, and position.
- `comments`: conversation attached to a card.
- `activity_logs`: audit-style feed of board and card actions.

Foreign keys use cascading deletion where child records no longer make sense without their parent. Frequently used relationships and ordering fields are indexed.

## 4. Authentication flow

### Registration

1. The user submits a name, email, password, and optional workspace name.
2. The API validates the required fields and minimum password length.
3. The email is normalized and checked for uniqueness.
4. bcrypt hashes the password. The plain password is never stored.
5. A transaction creates the user, their workspace, and an `owner` membership.
6. The transaction creates a starter board, four lists, and example cards.
7. The API returns a signed JWT and public user information.
8. The frontend stores the token in `localStorage` and loads `/api/auth/me`.

### Login and protected requests

1. The API finds the normalized email and compares the password with its bcrypt hash.
2. A valid login returns a seven-day JWT.
3. The shared frontend API client sends `Authorization: Bearer <token>` on later requests.
4. Authentication middleware verifies the signature and loads the current user.
5. Permission middleware checks the user's workspace role and board access before the route runs.
6. Invalid or expired sessions return HTTP `401`; insufficient permissions return HTTP `403`.

## 5. Role and permission flow

The hierarchy is `owner > admin > member > guest`.

| Function | Owner | Admin | Member | Guest |
| --- | :---: | :---: | :---: | :---: |
| View workspace and members | Yes | Yes | Yes | Yes |
| View all workspace boards | Yes | Yes | Yes | No |
| View assigned boards | Yes | Yes | Yes | Yes |
| Update workspace profile | Yes | Yes | No | No |
| Add or remove members | Yes | Yes | No | No |
| Appoint or manage admins | Yes | No | No | No |
| Change the owner's role | No | No | No | No |
| Create and edit boards | Yes | Yes | Yes | No |
| Permanently delete boards | Yes | Yes | No | No |
| Create, rename, or delete lists | Yes | Yes | Yes | No |
| Create, edit, move, or delete cards | Yes | Yes | Yes | No |
| Assign cards to non-guest members | Yes | Yes | Yes | No |
| View card details | Yes | Yes | Yes | Yes |
| Add card comments | Yes | Yes | Yes | Yes |
| View workspace activity | Yes | Yes | Yes | Assigned boards only |

Owners cannot be removed or demoted through the member endpoints. Admins cannot appoint, modify, or remove other admins. Guest assignments are checked against boards belonging to the same workspace.

## 6. Main system flows

### Workspace and board discovery

1. `/api/auth/me` returns every workspace membership for the signed-in user.
2. The frontend displays a workspace switcher when more than one membership exists.
3. The selected workspace ID is saved locally so it remains selected after refresh.
4. The board list endpoint returns all active boards for owners, admins, and members.
5. For guests, the query returns only boards present in `board_guests`.
6. Dashboard search filters the loaded boards by name and description.

### Adding a user

1. The person creates an Orbit account so their email exists in `users`.
2. An owner or admin opens **Members** and enters that email.
3. The API verifies the actor's role and protects the existing owner/admin roles.
4. Members and admins receive workspace-wide board access.
5. Guests must be assigned at least one board; those mappings are stored in `board_guests`.
6. Membership data refreshes when the user's browser regains focus or the page reloads.

### Board, list, and card work

1. A permitted user creates a board. Default workflow lists are created in one transaction.
2. The board endpoint returns its lists and nested cards ordered by position.
3. Users can add lists and cards through inline forms.
4. Dragging a card to another list sends the target list ID and a new position.
5. Opening a card loads its comments separately.
6. Saving a card can update its title, description, priority, due date, labels, assignee, list, or completion state.
7. Mutations write activity records so the team can review recent progress.

### Error flow

1. Route handlers throw an `HttpError` for expected validation, authentication, permission, or missing-record failures.
2. The global Express error middleware maps those errors to JSON responses.
3. Database constraint failures become safe `400` or `409` responses.
4. Unexpected server errors are logged on the server and returned as a generic message.
5. The frontend API helper converts non-success responses into JavaScript errors displayed by the relevant page or dialog.

## 7. Runtime flow

From the repository root:

```powershell
npm run dev
```

This starts:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

Vite proxies `/api` requests to the backend during development. On backend startup, the configured PostgreSQL database and missing tables/indexes are initialized safely. For production, the frontend is compiled with `npm run build`, and `JWT_SECRET` must remain private and unpredictable.
