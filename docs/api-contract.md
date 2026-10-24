# API contract

## Demo scope

One pre-created student account, catalog/schedule imports, graded course history, academic profile, search, two-section comparison, prerequisites, a semester roadmap, watchlists and Discord alerts. Prerequisite evaluation includes minimum course grades, cumulative GPA, total earned units, class standing and major restrictions. There is no registration, SSO, account administration or other account type. The header's Sign in button is a disabled placeholder; the login form is a separate feature stub.

The importer keeps its full dataset and source metadata. The Computer Engineering BS demo roadmap (`CMPE`) and one configured term are used for the presentation; they are not importer limits. Course availability comes from imported schedule observations. Students do not trigger imports or change seat counts through this API.

Backend startup seeds the demo account and selects `CMPE` for a new profile. The automatic worker imports the catalog and schedule on startup, then refreshes them daily and every five minutes by default. After catalog data is available it links the demo roadmap and seeds initial course history once. Later runs preserve account credentials, profile selection, course history, watchlists and preferences, including deleted history records. The roadmap is a seven-course subset using semester groups from the department's Fall 2024 chart, not a complete current degree audit.

One worker runs jobs serially and dispatches notifications after schedule imports and every thirty seconds. Import failures preserve cached data and retry later. Failed notification deliveries remain failed. Intervals, schedule term and source URLs are backend configuration; no API endpoints are added. The current feature stubs still need implementation before real imports, login and Discord delivery work.

## Basic rules

- Add `/api` before every path below. Use JSON and `snake_case` fields.
- Login is required except for health, CSRF setup and login itself.
- Use an email/password made for the project, never university credentials. Demo credentials are in the README.
- Session tokens stay in HttpOnly cookies, never JSON or browser storage. CSRF tokens are separate and kept in browser memory.
- Send `X-CSRF-Token` with POST, PUT, PATCH and DELETE. `/me` identity comes from the session, never a request field.
- IDs are strings, including class numbers and notification IDs. Response fields are always included; unknown values use `null`, empty lists use `[]`.
- `timestamp` is a UTC ISO 8601 string. Meeting times are `HH:MM` in `America/Los_Angeles`.
- GET/PATCH/POST return 200 unless specified. PUT returns 201 for creation, 200 for update. DELETE/logout return empty 204; do not parse JSON from them.
- GET and DELETE requests have no body. Requests marked None have no body.
- Unknown JSON fields and extra query parameters on paginated endpoints return 422. Required nullable fields must still be supplied.
- No compatibility routes, removed fields, migration paths or alternate account roles are supported.

## Endpoints

### Health

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/health` | None | 200 `{status:"ok"}`; database failure is 503 `{detail:"Database unavailable"}` |

### Account and profile

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | None | `CsrfResponse` and HttpOnly CSRF cookie |
| POST | `/auth/login` | `LoginRequest` | `SessionResponse` and HttpOnly session cookie |
| GET | `/auth/session` | None | `SessionResponse`; missing/expired session is 401 |
| POST | `/auth/logout` | None | 204; session and CSRF cookies cleared |
| GET | `/me` | None | `ProfileResponse` |
| PATCH | `/me` | `ProfileUpdate` | `ProfileResponse` |

The account name/email are read-only. An academic profile contains major selection, class standing, cumulative GPA and total earned units. GPA is finite 0–4; units are a nonnegative integer. Missing GPA/units/major use null, missing class standing uses `unspecified`; zero is a known value. These are editable cumulative facts, not calculations from the partial demo course history. Standing is supplied independently rather than inferred from units. Sessions expire after eight hours or thirty idle minutes. Logging in replaces the previous session.

### Courses and sections

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/terms` | Pagination query | `Page<Term>` |
| GET | `/courses` | Course query | `Page<Course>` |
| GET | `/courses/{course_id}` | None | `Course` |
| GET | `/sections` | Section query | `Page<Section>` |
| GET | `/sections/{section_id}` | None | `Section` |
| POST | `/sections/compare` | `CompareRequest` | `ComparisonResponse` |

Keyword search ignores case and matches code/title. Sections match every supplied filter. Comparison requires exactly two different sections in one term and preserves their requested order. Missing courses/sections return 404; invalid comparisons return 422.

### Course history and roadmap

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/majors` | Pagination query | `Page<Major>` |
| GET | `/majors/{major_code}/roadmap` | None | `MajorRoadmap` |
| GET | `/me/course-records` | Pagination query | `Page<CourseRecord>` |
| PUT | `/me/course-records/{course_id}` | `CourseRecordInput` | `CourseRecord` |
| DELETE | `/me/course-records/{course_id}` | None | 204, including repeat deletes |
| POST | `/me/eligibility` | `EligibilityRequest` | `EligibilityResponse` |
| GET | `/me/roadmap` | None | `StudentRoadmap` |

Keep one record per student/course. A non-null term must exist (422); a missing course is 404. Only completed attempts may have a grade; in-progress/planned grades must be null (422 otherwise). A completed attempt may have a failing grade and does not automatically satisfy a prerequisite. No major selection returns `409 PROFILE_INCOMPLETE` for the personal roadmap.

The assigned eligibility implementation must evaluate the following rules, including AND/OR groups and parentheses:

- Completed prerequisite courses and minimum letter grades. Letter order is `F < D- < D < D+ < C- < C < C+ < B- < B < B+ < A- < A < A+`. Missing grades are unknown. F/NC/WU/IC fail; W/I/RP/RD/AU are unknown. CR can establish general course credit, but stays unknown for a specific letter threshold or an unresolved credit/no-credit restriction.
- Cumulative GPA and total earned-unit thresholds, using the stated comparison. Missing facts are unknown; zero is not missing. Major/SJSU-only GPA and subject/residency-specific unit rules stay unknown because those separate facts are not collected.
- Class standing with undergraduate order freshman, sophomore, junior, senior. Junior standing means at least junior; upper division means junior or above. Exact lists use exact matches. Graduate standing is a separate level, not automatically above senior.
- Allowed/excluded major codes, including alternatives. A known disallowed major fails; missing major or an unresolved source-name mapping is unknown.

The internal `RequirementRule` tree uses kinds all/any/course/gpa/units/standing/major/unknown, with text, children, course_id, minimum_grade, concurrent, value and operator. Numeric/standing comparisons support gte/gt/lte/lt/eq/ne; major rules use eq/ne. Operators default to gte, so major/exact-standing clauses must set theirs explicitly. Only a verified absence of requirements becomes an empty all-rule. Concurrent enrollment, permissions, placement and unrecognized clauses remain unknown rather than being dropped. Course, corequisite and restriction text must all be represented.

Results explain both required and actual academic facts. `missing_course_ids` contains definite absent/unfinished/insufficient-grade prerequisite courses, not invented IDs for GPA/units/standing/major failures or failed alternatives of an OR that passes. Roadmap and watchlist reuse the same evaluator and refresh after profile or history edits. These are implementation requirements; the evaluator bodies remain assigned stubs.

Grade symbols follow the [SJSU Registrar grading reference](https://www.sjsu.edu/registrar/academic-records/grade-changes.php). This demo does not calculate cumulative GPA or apply transcript repeat/forgiveness rules.

### Watchlist and Discord

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/me/watchlist` | Watchlist query | `Page<WatchlistEntry>` |
| PUT | `/me/watchlist/{section_id}` | None | `WatchlistEntry` |
| DELETE | `/me/watchlist/{section_id}` | None | 204, including repeat deletes |
| GET | `/me/notification-preferences` | None | `NotificationPreferences` |
| PATCH | `/me/notification-preferences` | `PreferencesUpdate` | `NotificationPreferences` |
| GET | `/me/notifications` | Pagination query | `Page<Notification>` |

- Watches are unique per student/section. Reactivating an existing watch returns 200. Eligibility warnings never block saving.
- Discord uses one backend `DISCORD_WEBHOOK_URL`. The URL is never sent to the frontend. Students can only turn their alerts on/off.
- Missing/invalid configuration makes `available=false`. Enabling then returns `503 CHANNEL_UNAVAILABLE`; disabling still works.
- Alert only for a known zero-to-positive seat transition on an active watch with alerts enabled. Unknown-to-positive and unchanged positive seats do not alert.
- Persist one delivery per event/student. `sent` means Discord accepted the request, not that a person read it. Rejected sends are failed, never sent.
- The automatic worker runs imports and notification dispatch serially. Failed deliveries are not automatically retried. External delivery is not guaranteed exactly once across crashes.

## Query parameters

| Used by | Parameters |
| --- | --- |
| All paginated endpoints | Optional `limit: integer` from 1 to 100, default 25; `offset: integer` at least 0, default 0 |
| `/courses` | Optional `q: string` |
| `/sections` | Required `term: string`; optional `q: string`, `course_id: string` |
| `/me/watchlist` | Optional `term: string` |

Omit unused parameters; query parameters do not accept null. Terms/courses/sections sort by ID ascending, majors by `major_code`, course history by `course_id`. Watchlists sort by `added_at` descending then section ID ascending. Notifications sort by `created_at` descending then ID ascending. Count matching rows before pagination.

## Request bodies

All fields are required. Nullable fields must be sent even when null. PATCH has the smaller explicit shapes below, not arbitrary partial objects.

| Type | Fields |
| --- | --- |
| `LoginRequest` | `email: string`, `password: string` |
| `ProfileUpdate` | `major_code: string \| null`, `standing: Standing`, `gpa: number \| null` (finite 0–4), `earned_units: integer \| null` (>=0); a non-null major must exist |
| `CompareRequest` | `section_ids: string[]`, exactly two unique IDs from one term |
| `CourseRecordInput` | `status: CourseStatus`, `grade: Grade \| null`, `term: string \| null`; non-completed records require grade=null |
| `EligibilityRequest` | `course_ids: string[]`, 1–100 unique IDs |
| `PreferencesUpdate` | `enabled: boolean`; null and omitted values are invalid |

## Data types

### Enums

| Type | Values |
| --- | --- |
| `CourseStatus` | `completed`, `in_progress`, `planned` |
| `StudentCourseStatus` | `CourseStatus` plus `not_started` |
| `Standing` | `freshman`, `sophomore`, `junior`, `senior`, `graduate`, `unspecified` |
| `Grade` | `A+`, `A`, `A-`, `B+`, `B`, `B-`, `C+`, `C`, `C-`, `D+`, `D`, `D-`, `F`, `CR`, `NC`, `WU`, `IC`, `W`, `I`, `RP`, `RD`, `AU` |
| `EligibilityStatus` | `eligible`, `ineligible`, `unknown` |
| `Availability` | `open`, `closed`, `unknown` |
| `Weekday` | `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` |
| `DeliveryStatus` | `pending`, `sent`, `failed` |

### Responses

`T[]` is a list; `number` may have decimals, `integer` is whole, and `boolean` is true/false.

| Type | Fields |
| --- | --- |
| `Page<T>` | `items: T[]`, `total: integer`, `limit: integer`, `offset: integer` |
| `User` | `id: string`, `email: string`, `full_name: string`, `created_at: timestamp` |
| `Profile` | `major_code: string \| null`, `standing: Standing`, `gpa: number \| null`, `earned_units: integer \| null` |
| `CsrfResponse` | `csrf_token: string` |
| `SessionResponse` | `user: User`, `csrf_token: string`, `expires_at: timestamp` |
| `ProfileResponse` | `user: User`, `profile: Profile` |
| `Term` | `id: string`, `name: string` |
| `Course` | `id`, `subject`, `catalog_number`, `title`: strings; `description`, `prerequisite_text`, `corequisite_text`, `restrictions_text`, `catalog_url`: string or null; `units_min`, `units_max`: number or null |
| `Section` | `id`, `term`, `class_number`, `section_number`, `title`, `mode`, `source_url`: strings; `course: Course`; `units: number \| null`; `open_seats: integer \| null`; `availability: Availability`; `meetings: Meeting[]`; `instructors: Instructor[]`; `notes`, `last_checked_at`: string or null; `is_stale: boolean` |
| `Meeting` | `days: Weekday[]`, `start_time: time \| null`, `end_time: time \| null`, `location: string \| null`, `is_tba: boolean` |
| `Instructor` | `name: string` |
| `ComparisonResponse` | `sections: Section[]` |
| `Major` | `major_code: string`, `title: string`, `degree_type: string`, `description: string \| null` |
| `CourseRecord` | `course_id: string`, `status: CourseStatus`, `grade: Grade \| null`, `term: string \| null` |
| `Eligibility` | `course_id: string`, `status: EligibilityStatus`, `reasons: string[]`, `missing_course_ids: string[]` |
| `EligibilityResponse` | `results: Eligibility[]`, preserving requested order |
| `RoadmapEntry` | `course: Course`, `term_order: integer`, `is_required: boolean` |
| `StudentRoadmapEntry` | `RoadmapEntry` fields plus `student_status: StudentCourseStatus`, `grade: Grade \| null`, `eligibility: Eligibility` |
| `ProgressSummary` | `completed_courses: integer`, `total_required_courses: integer`, `completion_percent: number` |
| `MajorRoadmap` | `major: Major`, `courses: RoadmapEntry[]` |
| `StudentRoadmap` | `major: Major`, `courses: StudentRoadmapEntry[]`, `summary: ProgressSummary`, `recommendations: string[]` |
| `WatchlistEntry` | `section: Section`, `added_at: timestamp`, `eligibility: Eligibility` |
| `NotificationPreferences` | `enabled: boolean`, `available: boolean` |
| `Notification` | `id: string`, `section_id: string`, `event_type: "section_opened"`, `status: DeliveryStatus`, `created_at: timestamp`, `sent_at: timestamp \| null` |

Positive seats mean open, zero means closed, null means unknown. Missing meetings/instructors remain empty arrays; TBA times remain null. Missing timestamps or observations older than five minutes are stale. A section contains its nested course, not duplicate flat course fields.

Roadmaps sort by semester then course ID. Progress counts required courses with completed attempts and a passing letter grade (A+ through D-) or CR, with zero percent for an empty required set. Failing, missing and unresolved grades do not count as earned credit. Recommendations are eligible required courses without earned credit, including failed completed attempts, excluding in-progress courses, in roadmap order. The seeded Computer Engineering roadmap is a selected course subset, not a complete degree audit or a guarantee that CR/low passing grades meet every program rule.

## Errors

Planned errors use `{error: {code: string, message: string, fields: [{path: string, message: string}]}}`. Fields are empty unless inputs need correcting. Paths are dot-separated field names. Health keeps its separate error format.

| Status | Meaning |
| --- | --- |
| 401 | Missing/expired session or wrong login details |
| 403 | Missing/invalid CSRF token |
| 404 | Resource not found, except repeatable deletes |
| 409 | Profile incomplete |
| 422 | Invalid, missing or unknown input |
| 501 | An assigned feature is not implemented in the scaffold yet |
| 503 | Database or Discord unavailable |
