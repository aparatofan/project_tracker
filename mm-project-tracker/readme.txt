=== MM Project Tracker ===
Contributors: mariuszmirecki
Tags: project management, tracker, personal
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.3.0
License: GPLv2 or later

A personal project management tool — "Begin with the end in mind." (Covey Habit 2)

== Description ==

MM Project Tracker is a private, frontend-based project management plugin. It enforces Covey's Habit 2 by requiring you to define the desired end state and rationale before creating any project.

Features:
* Version-numbered progress tracking with milestones
* Staleness detection to surface neglected projects
* Commitment cadence tracking (daily/weekly/monthly/etc.)
* Priority-based colour coding
* Archive/restore workflow
* REST API for future integrations
* Task Triage with five colour-coded urgency levels
* Due-date countdowns and priority/date ordering
* Task editing, completion, reopening, and deletion

== Installation ==

1. Upload the `mm-project-tracker` folder to `/wp-content/plugins/`
2. Activate the plugin through the Plugins menu
3. Create a new page and add the shortcode `[mm_project_tracker]`
4. Add the page to your site menu

= Divi note =

The tracker lays out up to 1800px wide. Divi caps a standard row at roughly
1450px, so the row holding the shortcode should be set to full width (or a
max-width of at least 1800px) with its left/right padding at 0. The plugin
also releases `.et_pb_row` / `.et_pb_row_inner` containing the app in CSS,
which covers most layouts on its own.

== Changelog ==

= 1.3.0 =
* Visual redesign: slate-blue accent, 12px radii, new ink and status palette
* Removed the page title and subtitle from both views
* Mode switch is now the top-level navigation, with counts on both tabs and
  arrow-key support; the New project / New task button moved beside it
* Status colour is now a 2px border on all four sides of a card, not a left rail
* Card grid is 3 / 2 / 1 columns with a 20px gap, up to 1800px wide
* Status filters became chips; buttons reduced to primary / secondary / ghost
* Fixed Cancel buttons in modals being restyled by the close-button rule

= 1.2.0 =
* Added Task Triage as a second main section
* Added red, orange, yellow, green, and black triage levels
* Added due dates with days-left and overdue indicators
* Added task editing, completion, reopening, and deletion

= 1.0.0 =
* Initial release
