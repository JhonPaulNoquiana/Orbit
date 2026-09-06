# Orbit: Complete Functional Test Flow

## 1. Test objective

Verify authentication, workspace switching, role-based access, boards, lists, cards, comments, activity, error handling, responsive behavior, and every visible control.

Use dedicated test accounts. Do not run destructive tests against a real workspace.

## 2. Start the application

From the repository root:

```powershell
npm install
npm run dev
```

Confirm:

- `http://localhost:5173` opens the Orbit authentication screen.
- `http://localhost:4000/api/health` returns `{"status":"ok"}`.
- The browser console has no uncaught errors.
- The Network panel has no unexpected `4xx` or `5xx` responses.

Run automated checks in a second terminal:

```powershell
npm test
```

Expected: two backend tests pass and the frontend production build completes.

## 3. Prepare four test accounts

Create these accounts through **Sign up**. Use unique emails and the same test-only password of at least eight characters.

| Test user | Intended role in the main test workspace |
| --- | --- |
| QA Owner | Owner |
| QA Admin | Admin |
| QA Member | Member |
| QA Guest | Guest |

Each registration creates a separate owned workspace. Use **QA Owner Workspace** as the main workspace for all tests.

Pass criteria:

- Each valid registration logs in successfully.
- A starter board named **Product launch** appears.
- The starter board contains Ideas, In progress, Review, and Done lists.
- Duplicate email registration shows an error.
- Passwords shorter than eight characters are rejected.

## 4. Authentication tests

### Login

1. Log out through the sidebar or profile menu.
2. Log in with the correct email and password.
3. Refresh the browser.

Expected:

- Correct credentials open the dashboard.
- The session remains active after refresh.
- An incorrect password displays an error without logging in.
- Logging out returns to the login page.
- Opening `/boards/<id>` while logged out redirects to login.

### Profile and navigation controls

1. Click the profile control in the top-right corner.
2. Confirm the user's name, email, and current workspace role.
3. Close and reopen it, then test **Log out**.
4. Log in again.

Expected: every control responds once, and no console error appears.

## 5. Owner tests

Log in as QA Owner and select **QA Owner Workspace**.

### Workspace settings

1. Open **Workspace settings** from the sidebar.
2. Change the workspace description and save.
3. Refresh the page.

Expected: the change persists. Owner and admin can see this control; member and guest cannot.

### Add users and roles

1. Open **Members**.
2. Add QA Admin with the `admin` role.
3. Add QA Member with the `member` role.
4. Add QA Guest with the `guest` role and select only **Product launch**.
5. Try adding an email that has no Orbit account.
6. Try changing or removing the owner.

Expected:

- All three valid users appear with the correct role.
- Guest access shows one assigned board.
- Unknown email shows a clear error.
- The owner's role cannot be changed and the owner cannot be removed.
- The owner can promote/demote admins, while admins cannot manage other admins.

### Guest access configuration

1. Click the SVG settings icon beside QA Guest.
2. Change the selected boards and click **Update access**.
3. Log in as QA Guest and confirm the visible boards match the selection.

## 6. Workspace switching tests

Log in as QA Admin or QA Member. Their original workspace and QA Owner Workspace should both be available.

1. Click the workspace selector at the top of the desktop sidebar.
2. Select QA Owner Workspace.
3. Refresh the browser.
4. At a narrow/mobile viewport, use the workspace selector in the top bar.

Expected:

- Both workspaces are listed with no duplicates.
- The chosen workspace's boards load immediately.
- The selected workspace remains active after refresh.
- Newly granted membership appears after refocusing or refreshing the browser.

## 7. Dashboard and search tests

1. Create boards named **Website Redesign** and **Mobile Launch**.
2. Confirm the active-board count increases.
3. Search for `website` in the top search field.
4. Press `Ctrl+K` or `Cmd+K`.
5. Click **Clear search**.
6. Star and unstar a board.

Expected:

- Search filters by board name and description.
- The keyboard shortcut focuses the search field.
- Clearing restores every board.
- Starred boards move ahead of unstarred boards after the data refresh.
- Guest users do not see mutation controls.

## 8. Board tests

Open **Website Redesign**.

### Board settings

1. Click the SVG settings icon in the board header.
2. Change the board name, description, and accent color.
3. Save and refresh.

Expected: all changes persist and the accent color updates the board UI.

### Lists

1. Click **Add another list** and create `Blocked`.
2. Use the list's SVG menu icon to rename it to `Waiting`.
3. Create a temporary empty list.
4. Delete the temporary list and confirm the prompt.
5. Cancel a second delete prompt and verify the list remains.

Expected: list counts and names update without a page reload. Deleting a list warns that its cards will also be removed.

### Archive and delete board

Perform these near the end of testing:

1. Create a disposable board and archive it through board settings.
2. Return to the dashboard.
3. Confirm the archived board is absent from active boards.
4. As owner/admin, create another disposable board and delete it permanently.

Expected: archived and deleted boards no longer appear. Members may archive/edit boards but do not see permanent deletion.

## 9. Card tests

### Create and open

1. Enter a title in **Add a card…**.
2. Click **Add**.
3. Repeat using Enter instead of the button.
4. Open the new card.

Expected: exactly one card is created per submission and the detail dialog opens.

### Edit all fields

Set and save:

- Title
- Description
- Low, medium, high, and urgent priority
- Due date
- One or more labels
- A member assignee
- Another list
- Completed state

Expected:

- Every saved field appears after reopening the card.
- Removing a label persists.
- Clearing the date or assignee persists.
- Guest accounts do not appear in the assignee list.
- Completed cards show a checked state and affect dashboard progress totals.

### Drag-and-drop

1. Drag a card from Backlog/Ideas to In progress.
2. Refresh the board.

Expected: the card stays in the target list and does not appear twice.

### Comments

1. Add a comment using **Send**.
2. Add another comment by pressing Enter.
3. Close and reopen the card.

Expected: both comments persist with the correct author and date, and the card displays the comment count.

### Delete

1. Create a disposable card.
2. Click **Delete card** and cancel the first prompt.
3. Repeat and confirm.

Expected: cancellation keeps the card; confirmation removes it.

## 10. Admin tests

Log in as QA Admin and switch to QA Owner Workspace.

Confirm that the admin can:

- Update workspace settings.
- Add, update, and remove members and guests.
- Create/edit/archive/delete boards.
- Create/rename/delete lists.
- Create/edit/move/complete/delete cards.
- Assign cards and add comments.

Confirm that the admin cannot:

- Change or remove the owner.
- Appoint another admin.
- Change or remove an existing admin.

Expected unauthorized API result: HTTP `403` with a readable error message.

## 11. Member tests

Log in as QA Member and switch to QA Owner Workspace.

Confirm that the member can:

- See every active board in the workspace.
- Create and edit boards.
- Create, rename, and delete lists.
- Create, edit, move, complete, and delete cards.
- Add labels, dates, priorities, and valid assignees.
- View members and activity.
- Add comments.

Confirm that the member cannot:

- Update workspace settings.
- Add, remove, or change users.
- Permanently delete a board.
- Assign a guest or a user from an unrelated workspace.

Expected: prohibited controls are hidden or read-only. Direct permission failures return `403`; invalid cross-workspace assignments return `400`.

## 12. Guest tests

Log in as QA Guest and switch to QA Owner Workspace.

Confirm that the guest can:

- See only explicitly assigned boards.
- Open assigned boards and card details.
- View the members dialog.
- Add comments to cards.
- View activity only from assigned boards.

Confirm that the guest cannot:

- Open an unassigned board using its direct URL.
- Create, edit, star, archive, or delete a board.
- Create, rename, or delete a list.
- Create, edit, move, complete, assign, or delete a card.
- Manage workspace members or settings.

Expected: mutation controls are absent/disabled. Direct attempts return HTTP `403` and do not alter data.

## 13. Activity tests

As an owner/member, perform these actions:

- Create and update a board.
- Add a list.
- Create, move, complete, and delete a card.
- Add a comment.

Open activity from both the sidebar and notification SVG icon.

Expected:

- Both controls open the same activity dialog.
- Entries display the actor, action, entity, and timestamp.
- Newest entries appear first.
- A guest sees entries only for assigned boards.

## 14. Dialog and control tests

For every dialog:

1. Close with the SVG X icon.
2. Close by clicking the shaded backdrop.
3. Close with Escape.
4. Submit once and confirm no duplicate request occurs.

Check every visible button:

- Sign up / Log in tabs
- Password visibility SVG icon
- New board and color choices
- Star SVG icon
- Members, activity, notification, settings, and logout
- Workspace selector
- Board settings
- List SVG menus
- Add list / Add card
- Card completion, labels, comments, save, and delete

Expected: every control performs its labeled action; no decorative element looks clickable without responding.

## 15. Responsive and accessibility checks

Test widths near 1440 px, 1024 px, 768 px, 390 px, and 320 px.

Expected:

- No page-level horizontal overflow except the intentional horizontal Kanban board scroll.
- Dialogs fit inside the viewport and remain scrollable.
- Workspace switching remains available on mobile.
- Buttons and form fields remain usable by touch.
- SVG icon-only buttons have accessible labels or titles.
- Tab navigation reaches interactive controls in a logical order.
- Visible focus styling appears on fields and controls.
- Text remains readable at 200% browser zoom.

## 16. Error and recovery tests

1. Stop the backend and perform an action.
2. Restart the backend and retry.
3. Submit blank required fields.
4. Use an expired or manually corrupted token in a disposable browser profile.
5. Rapidly click save/create controls.

Expected:

- Network and validation errors are shown without crashing React.
- Blank required fields are blocked.
- Invalid sessions return `401` and cannot access protected data.
- The page recovers after the API restarts.
- No duplicated boards, lists, cards, or comments are created.

## 17. Final regression and cleanup

Run:

```powershell
npm test
```

Final pass criteria:

- Backend tests pass.
- Frontend production build passes.
- No uncaught browser-console errors.
- No unexpected API `4xx`/`5xx` responses.
- All four roles match the permission matrix.
- Data persists after refresh and server restart.
- Test-only boards, cards, memberships, and accounts are removed where appropriate.
