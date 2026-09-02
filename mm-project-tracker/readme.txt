=== MM Project Tracker ===
Contributors: mariuszmirecki
Tags: project management, tracker, personal
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.5.0
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
* Combined status and colour filtering, with live counts
* Collapsible task cards with icon actions
* Swipe a task card left to complete it, right to edit it
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

= 1.5.0 =
* Task Triage: the priority pills became a row of six colour swatches —
  All plus the five triage colours, solid fills carrying only a count.
  Each is named by a tooltip, an aria-label and a live caption below the
  row, so the colours never stand unlabelled
* Task Triage: colour counts are scoped to the active Open / Completed /
  All tab; a colour with nothing to show is disabled and skipped by Tab,
  and switching tabs resets the colour filter
* Task Triage: the status bar and the colour bar now read as two rows of
  one control — both run the full width and share a fill, a padding and a
  height, so the Open tab, the first swatch and the caption line up on one
  left edge. The status tabs keep their own width rather than stretching
* Task Triage: swipe a task card left to complete it (or reopen a
  completed one) and right to open its editor — mouse, touch and pen, at
  every width. Vertical scrolling is untouched, and a tap still expands
* Task Triage: completing or reopening a task raises a toast with a 3
  second Undo, whether it came from the swipe or the tick icon
* Task Triage: the triage colour dropdown in the task form became five
  colour buttons — arrow-key navigable, captioned, defaulting to Vital
* Task Triage: its own five-colour palette, no longer borrowed from the
  project status colours
* Project Tracker is unchanged by all of the above

= 1.4.0 =
* Both views: the card grid is one column below 1024px, so a tablet in
  portrait no longer gets two cramped columns; two columns below 1400px
* Both views: the mode switch runs the full width, with the view title and
  its primary action on a new row beneath it
* Task Triage: the status filter is now a segmented control matching the
  mode switch, with arrow-key navigation
* Task Triage: the static colour legend became a single-select priority
  filter — counts follow the status filter, empty priorities are dimmed
* Task Triage: priority group headings removed; one continuous grid, still
  sorted Critical to No chance and by due date within each priority
* Task Triage: task cards collapse to a priority dot and the title, and
  expand to reveal the description, due date and actions
* Task Triage: Complete / Edit / Delete are icon buttons with labelled
  tooltips; delete keeps its confirmation step
* Triage filter selections survive switching to the Project Tracker and back

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
