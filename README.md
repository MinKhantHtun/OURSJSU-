# OurSJSU

"It's like MySJSU, but we do it better"

The shared setup, automatic worker and demo account seeding are implemented. Finish the assigned feature functions using the comments in their files and [the work split](docs/work-distribution.md). The worker reports pending implementations until the import and notification helpers are finished. The login form and session/authentication functions also remain assigned feature work.

## Getting started

Install Docker Desktop. From the project root, create the backend environment file once:

```sh
cp backend/.env.example backend/.env
python3 - <<'PY'
from pathlib import Path
import secrets
path = Path('backend/.env')
path.write_text(path.read_text().replace('SESSION_SECRET=\n', 'SESSION_SECRET=' + secrets.token_urlsafe(32) + '\n'))
PY
```

Set `DISCORD_WEBHOOK_URL` in `backend/.env` when you want Discord delivery. A blank value leaves alerts unavailable. Keep that file private; it is ignored by Git.

Start everything:

```sh
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- Backend startup creates one student demo account and selects Computer Engineering.
- The worker starts automatically and handles imports and notification dispatch.
- SQLite stays in the `sqlite_data` Docker volume across restarts.
- The header's Sign in button stays disabled. Use the separate login form once implemented.

Demo account:

- Email: `demo@oursjsu.test`
- Password: `oursjsu-demo-password`
- Major: Computer Engineering, BS (`CMPE`)

There is no sign-up, SSO, admin account or other account type.

## Automatic jobs

The worker imports the catalog first, then the schedule. It runs them immediately on startup and keeps refreshing while Docker is running. You do not need to run import or seed commands yourself.

| Setting in `backend/.env` | Default | Purpose |
| --- | --- | --- |
| `CATALOG_REFRESH_SECONDS` | `86400` | Refresh the catalog daily |
| `SCHEDULE_REFRESH_SECONDS` | `300` | Refresh sections every five minutes |
| `NOTIFICATION_POLL_SECONDS` | `30` | Process pending opening events and deliveries |
| `SCHEDULE_TERM` | `fall-2026` | Term passed to the schedule importer |
| `CATALOG_SOURCE_URL` | `https://catalog.sjsu.edu/` | Catalog source |
| `SCHEDULE_SOURCE_URL` | `https://www.sjsu.edu/classes/schedules/fall-2026.php` | Schedule source; keep it matched to the configured term |

Intervals must be positive whole seconds. Recreate the worker after changing its environment settings with `docker compose up -d --force-recreate worker`. Worker code changes take effect after `docker compose restart worker`.

One worker runs jobs one at a time. A database-specific process lock prevents a second worker or a manual import/delivery command from running alongside it. A failed catalog import retries within five minutes; a failed schedule import retries on its next scheduled refresh. Failed fetches or parsing preserve the last successful data and observation timestamps.

Schedule imports commit seat changes and opening events before notifications run. The worker also checks the queue every thirty seconds, including events created by the local seat-change command. Notification rows marked failed are not automatically retried.

The importer keeps full source data, terms and IDs. The Computer Engineering demo subset does not limit what gets imported.

To see worker activity:

```sh
docker compose logs -f worker
```

Warnings about pending feature implementations are expected until the assigned functions are finished. An import failure is logged without treating an empty result as a successful refresh.

## Demo data

The account and major exist even before imports succeed. Once all seven courses in [the demo roadmap](backend/demo/computer-engineering.json) exist in the catalog, the worker links them and seeds this starting history:

- Completed: `MATH-30`, `MATH-42`, `CMPE-30`.
- In progress: `CMPE-50`.
- Planned: `CMPE-126`.
- No history record yet: `CMPE-130`, `CMPE-131`.

The roadmap uses semester groups from the department's [Fall 2024 Computer Engineering chart](https://www.sjsu.edu/cmpe/docs/bs-cmpe/fall_2024_BSCMPE_prereq_chart.pdf), linked from [SJSU's program page](https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/index.php). It is a demo subset, not a full degree audit. Course details and prerequisite rules come from the catalog importer.

Missing courses are reported and checked again later; setup does not create fake catalog rows. Initial history uses no specific term. If the student already has course history when the initial seed runs, it is preserved instead. Restarts and later imports preserve credentials, major selection, history edits/deletions, watchlists and alert preferences.

Once the assigned features are implemented, log in and update the course history to show eligibility and roadmap changes. Compare two sections from the same term, watch one, and turn on Discord alerts.

## Show a seat opening

Use an imported section ID that the student is watching. These commands label the change as simulated and queue events for the automatic worker:

```sh
docker compose run --rm --no-deps backend python -m scripts.demo_seat_change --section-id fall-2026:45123 --open-seats 0
docker compose run --rm --no-deps backend python -m scripts.demo_seat_change --section-id fall-2026:45123 --open-seats 1
```

Replace the sample ID with a real imported ID. Only zero-to-positive seats create an opening event; repeating positive seats or changing unknown seats to positive does not. The next successful live schedule refresh can replace the simulated seats.

Recent alerts show pending/sent/failed. Sent means Discord accepted the request. A crash after acceptance can leave a pending row that gets sent again on a later run.

## Files

- `frontend/src/`: pages, components and shared frontend code.
- `backend/app/api/`: HTTP routes.
- `backend/app/features/`: assigned feature logic.
- `backend/app/jobs/`: automatic runner and import/delivery jobs.
- `backend/scripts/`: automatic demo setup helpers and the controlled seat-change command.
- `backend/demo/computer-engineering.json`: demo course IDs, semester groups, starting history and source references.
- `backend/demo/sources/`: captured source references for importer development.
- [API contract](docs/api-contract.md).

Use the current `backend/app/db/schema.sql` and `oursjsu.db`. Schema changes use a fresh disposable development database; there are no migrations or legacy branches. The seed marker records that initial history has already been handled so deleted records stay deleted.

## Checks

From `frontend/`, run `npm run lint` and `npm run build`. Keep temporary verification files outside the repo; no test files or test dependencies are being added right now.
