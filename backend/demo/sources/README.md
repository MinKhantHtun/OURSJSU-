# Official source captures

`catalog/manifest.json` records the URL, UTC capture time, and HTML filename for each of 24 official 2026–27 catalog course pages. The catalog's browser verification was completed in a browser during capture; no guessed course records or requirement text are substituted for it.

`schedules/manifest.json` records the URL and UTC capture time of `fall-2026.html`, the full public schedule with 6,980 sections. The parser preserves multiple meetings, TBA values, and instructor lists. Review mode explicitly filters observations to the configured course IDs and logs exclusions.

`schedules/closed.json` and `open.json` contain the 204 sections whose courses are in the captured catalog. They derive their course/meeting/instructor details from the official schedule. Seat counts are **simulated**: all sections start at zero; the open snapshot sets CMPE 131 sections to two. These are replay scenarios, not historical claims about availability. Both preserve the original capture timestamp and mark their notes as replay data.

Snapshot course objects are used to identify their catalog linkage. They are never inserted as replacement catalog records; the importer requires the verified catalog record to exist first. API reads use the persisted catalog details.

Live mode fetches configured official URLs. It never silently falls back to these captures. Review explicitly selects the captured catalog and a live schedule subset. Replay explicitly selects captured data and never fetches upstream sources. These configurations use separate Docker volumes.

To refresh captures, save actual official course HTML with the `course_preview_title` heading and course body. Update the manifest with its real source URL and capture time. Include linked prerequisites needed by the chosen demo. For schedule captures, preserve the source table headers and all 14 columns; derive replay snapshots through the normal parser and clearly label any simulated observations. Do not replace a capture with a challenge/error page.
