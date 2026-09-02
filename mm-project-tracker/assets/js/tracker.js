/**
 * MM Project Tracker — Frontend App (Vanilla JS)
 */
(function () {
    'use strict';

    var API = mmptData.restUrl;
    var NONCE = mmptData.nonce;

    /* ───── State ───── */
    var state = {
        projects: [],
        tasks: [],
        filter: { status: 'publish', priority: '', sort: 'neglected', search: '' },
        taskFilter: 'open',        /* open | completed | all */
        taskPriority: 'all',       /* all | critical | vital | advised | if-time | no-chance */
        openTasks: {},             /* task id -> true, survives a re-render */
        counts: { active: 0, archived: 0, milestones: 0 },
    };

    /* Triage filter selections survive a trip to the Project Tracker and
       back. sessionStorage can throw outright in private mode, so every
       access is guarded. */
    var TRIAGE_STORE_KEY = 'mmpt-triage-filters';

    function readStoredTriageFilters() {
        try {
            var raw = window.sessionStorage.getItem(TRIAGE_STORE_KEY);
            var parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function persistTriageFilters() {
        try {
            window.sessionStorage.setItem(TRIAGE_STORE_KEY, JSON.stringify({
                status: state.taskFilter,
                priority: state.taskPriority,
            }));
        } catch (e) { /* nothing to do — the filters just won't be remembered */ }
    }

    /* ───── Helpers ───── */
    function req(method, path, body) {
        var opts = {
            method: method,
            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE },
        };
        if (body) opts.body = JSON.stringify(body);
        return fetch(API + path, opts).then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw e; });
            return r.json();
        });
    }

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function formatDate(iso) {
        var d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatDueDate(date) {
        var parts = date.split('-');
        var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function daysLabel(days) {
        if (days === 0) return 'Today';
        if (days === 1) return '1d ago';
        return days + 'd ago';
    }

    function stalenessTag(level, days) {
        var text;
        if (level === 'critical' || level === 'warning') text = days + 'd silent';
        else text = daysLabel(days);
        return '<span class="mmpt-tag mmpt-tag--staleness">' + text + '</span>';
    }

    function commitmentTag(status, daysRemaining) {
        if (status === 'none') return '';
        var text;
        if (status === 'on_track') text = Math.max(0, daysRemaining) + 'd left';
        else if (status === 'due_soon') text = 'Due in ' + Math.max(0, daysRemaining) + 'd';
        else if (status === 'late') text = 'Due ' + Math.abs(daysRemaining) + 'd ago';
        else text = 'Overdue by ' + Math.abs(daysRemaining) + 'd';
        return '<span class="mmpt-tag mmpt-tag--commitment">' + text + '</span>';
    }

    function priorityTag(p) {
        return '<span class="mmpt-tag mmpt-tag--priority">' +
            p.charAt(0).toUpperCase() + p.slice(1) + '</span>';
    }

    var CADENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };

    /* The card's status modifier. A commitment cadence decides it when one is
       set; otherwise staleness does. Same thresholds as v1 — only the names
       and the colours they map to changed. */
    function cardStatus(p) {
        var allowed = p.cadence && p.cadence !== 'none' ? CADENCE_DAYS[p.cadence] : 0;
        if (allowed) {
            var daysOverdue = p.days_since_activity - allowed;
            if (daysOverdue < -2) return 'on-track';
            if (daysOverdue < 0) return 'due-soon';
            if (daysOverdue <= 3) return 'overdue-light';
            if (daysOverdue <= 14) return 'overdue';
            return 'overdue-severe';
        }
        if (p.staleness_level === 'critical') return 'overdue-light';
        if (p.staleness_level === 'warning') return 'due-soon';
        return 'neutral';
    }

    function calcNextVersion(current, type) {
        var parts = current.split('.');
        var major = parseInt(parts[0], 10) || 1;
        var minor = parseInt(parts[1], 10) || 0;
        if (type === 'major') { major++; minor = 0; }
        else { minor++; }
        return major + '.' + minor;
    }

    /* ───── Render ───── */
    function renderCounts() {
        var active = 0, archived = 0, milestones = 0;
        state.projects.forEach(function (p) {
            if (p.status === 'publish') active++;
            else archived++;
            milestones += (p.milestones || []).length;
        });
        state.counts = { active: active, archived: archived, milestones: milestones };
        $('#mmpt-count-active').textContent = active;
        $('#mmpt-count-archived').textContent = archived;
        $('#mmpt-switch-count-projects').textContent = active;
        $('#mmpt-stat-active').textContent = active;
        $('#mmpt-stat-archived').textContent = archived;
        $('#mmpt-stat-milestones').textContent = milestones;
    }

    function filterAndSort(list) {
        var f = state.filter;
        var filtered = list.filter(function (p) {
            if (f.status !== 'all' && p.status !== f.status) return false;
            if (f.priority && p.priority !== f.priority) return false;
            if (f.search) {
                var q = f.search.toLowerCase();
                var hay = (p.name + ' ' + p.category + ' ' + p.end_in_mind).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });

        var sortFn;
        if (f.sort === 'neglected') {
            sortFn = function (a, b) { return b.days_since_activity - a.days_since_activity; };
        } else if (f.sort === 'priority') {
            var ord = { high: 0, medium: 1, low: 2 };
            sortFn = function (a, b) { return (ord[a.priority] || 1) - (ord[b.priority] || 1); };
        } else if (f.sort === 'version') {
            sortFn = function (a, b) {
                var av = a.version.split('.').map(Number);
                var bv = b.version.split('.').map(Number);
                return (bv[0] - av[0]) || (bv[1] - av[1]);
            };
        } else {
            sortFn = function (a, b) { return new Date(b.created) - new Date(a.created); };
        }
        filtered.sort(sortFn);
        return filtered;
    }

    function milestoneItemHtml(m) {
        return '<div class="mmpt-timeline-item" data-type="' + esc(m.type) + '">' +
            '<div class="mmpt-timeline-dot"></div>' +
            '<div class="mmpt-timeline-meta">' +
            '<span class="mmpt-tag mmpt-tag--version">v' + esc(m.version) + '</span>' +
            '<span class="mmpt-timeline-date">' + formatDate(m.date) + '</span>' +
            '</div>' +
            '<div class="mmpt-timeline-desc">' + esc(m.description) + '</div>' +
            '</div>';
    }

    var MILESTONE_VISIBLE = 7;

    function renderMilestones(milestones) {
        if (!milestones || !milestones.length) return '<p class="mmpt-detail-text">No milestones yet.</p>';
        var sorted = milestones.slice().reverse(); // newest first
        var visible = sorted.slice(0, MILESTONE_VISIBLE);
        var hidden = sorted.slice(MILESTONE_VISIBLE);

        var html = '<div class="mmpt-timeline">' + visible.map(milestoneItemHtml).join('');
        if (hidden.length) {
            html += '<div class="mmpt-milestone-hidden" style="display:none;">' +
                hidden.map(milestoneItemHtml).join('') + '</div>';
        }
        html += '</div>';

        if (hidden.length) {
            var label = 'Show ' + hidden.length + ' earlier milestone' + (hidden.length === 1 ? '' : 's') + ' ▾';
            html += '<button type="button" class="mmpt-milestone-toggle" data-count="' + hidden.length +
                '" data-expanded="false">' + label + '</button>';
        }
        return html;
    }

    function renderCard(p) {
        var cat = p.category ? '<span class="mmpt-tag mmpt-tag--category">' + esc(p.category) + '</span>' : '';
        var commitment = commitmentTag(p.commitment_status, p.commitment_days_remaining);
        var cadenceSection = '';
        if (p.cadence !== 'none') {
            cadenceSection = '<div class="mmpt-detail-section">' +
                '<div class="mmpt-detail-label">Commitment</div>' +
                '<div class="mmpt-detail-text">' + esc(p.cadence_label || p.cadence) + ' (' + esc(p.cadence) + ')</div>' +
                '</div>';
        }
        var archiveLabel = p.status === 'publish' ? 'Archive' : 'Restore';
        var cardClass = 'mmpt-card mmpt-card--' + cardStatus(p);

        return '<div class="' + cardClass + '" data-id="' + p.id + '" data-priority="' + p.priority + '" data-staleness="' + p.staleness_level + '">' +
            '<div class="mmpt-card-header">' +
                '<h3 class="mmpt-card-name">' + esc(p.name) + '</h3>' +
                '<div class="mmpt-card-tags">' +
                    '<span class="mmpt-tag mmpt-tag--version">v' + esc(p.version) + '</span>' +
                    cat +
                    priorityTag(p.priority) +
                    stalenessTag(p.staleness_level, p.days_since_activity) +
                    commitment +
                '</div>' +
                '<span class="mmpt-card-chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            '</div>' +
            '<div class="mmpt-card-body">' +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">The end in mind</div>' +
                    '<div class="mmpt-detail-text">' + esc(p.end_in_mind) + '</div>' +
                '</div>' +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">Why I started this</div>' +
                    '<div class="mmpt-detail-text">' + esc(p.rationale) + '</div>' +
                '</div>' +
                cadenceSection +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">Milestone log</div>' +
                    renderMilestones(p.milestones) +
                '</div>' +
                '<div class="mmpt-card-actions">' +
                    '<button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-btn--sm mmpt-action-milestone" data-id="' + p.id + '">+ Log Milestone</button>' +
                    '<button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-btn--sm mmpt-action-edit" data-id="' + p.id + '">Edit</button>' +
                    '<button type="button" class="mmpt-btn mmpt-btn--ghost mmpt-btn--sm mmpt-action-archive" data-id="' + p.id + '">' + archiveLabel + '</button>' +
                    '<button type="button" class="mmpt-btn mmpt-btn--ghost mmpt-btn--sm mmpt-action-delete" data-id="' + p.id + '">Delete</button>' +
                '</div>' +
                '<div class="mmpt-card-created">Created ' + formatDate(p.created) + '</div>' +
            '</div>' +
        '</div>';
    }

    function renderProjects() {
        var container = $('#mmpt-projects');
        var visible = filterAndSort(state.projects);
        if (!visible.length) {
            container.innerHTML = '<div class="mmpt-empty">No projects found.</div>';
            return;
        }
        container.innerHTML = visible.map(renderCard).join('');
    }

    /* The stored value is the colour; the slug is what the markup, the CSS
       tone tokens and the colour filter speak. Severity order is the array
       order — Critical first, No chance last — and it is fixed everywhere
       it appears: filter row, card sort, form buttons. Never re-sorted by
       count or alphabetically. */
    var TASK_PRIORITIES = [
        { colour: 'red',    slug: 'critical',  label: 'Critical' },
        { colour: 'orange', slug: 'vital',     label: 'Vital' },
        { colour: 'yellow', slug: 'advised',   label: 'Advised' },
        { colour: 'green',  slug: 'if-time',   label: 'If there’s time' },
        { colour: 'black',  slug: 'no-chance', label: 'No chance' },
    ];

    /* A new task is Vital — pre-selected, and there is no unset state. */
    var DEFAULT_TASK_COLOUR = 'orange';

    var PRIORITY_BY_COLOUR = {};
    var PRIORITY_BY_SLUG = {};
    TASK_PRIORITIES.forEach(function (p, i) {
        var entry = { colour: p.colour, slug: p.slug, label: p.label, order: i };
        PRIORITY_BY_COLOUR[p.colour] = entry;
        PRIORITY_BY_SLUG[p.slug] = entry;
    });

    /* The REST layer falls back to yellow for an unknown colour; match it. */
    function priorityFor(colour) {
        return PRIORITY_BY_COLOUR[colour] || PRIORITY_BY_COLOUR.yellow;
    }

    function taskCountLabel(n) {
        return n + (n === 1 ? ' task' : ' tasks');
    }

    /* ───── Icons — inline SVG. Divi does not enqueue Dashicons on the
       front end, so an icon font is not an option here. ───── */
    var ICON_CHEVRON = '<svg class="mmpt-card__chevron" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M6 9l6 6 6-6"/></svg>';
    var ICON_COMPLETE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
    var ICON_REOPEN = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 9h10a5 5 0 0 1 0 10H9"/><path d="M8 5L4 9l4 4"/></svg>';
    var ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 20h4L19.4 8.6a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 6.5l3 3"/></svg>';
    var ICON_DELETE = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>';

    function dueDateHtml(task) {
        if (!task.due_date) return '';
        var days = task.days_remaining;
        var label;
        var stateClass = '';
        if (days < 0) {
            label = 'Overdue by ' + Math.abs(days) + ' day' + (Math.abs(days) === 1 ? '' : 's');
            stateClass = ' mmpt-card__due--overdue';
        } else if (days === 0) {
            label = 'Due today';
            stateClass = ' mmpt-card__due--today';
        } else {
            label = days + ' day' + (days === 1 ? '' : 's') + ' left';
        }
        return '<div class="mmpt-card__due' + stateClass + '">' +
            '<span>' + formatDueDate(task.due_date) + '</span>' +
            '<strong>' + label + '</strong>' +
        '</div>';
    }

    function iconButton(cls, action, label, icon, id) {
        return '<button type="button" class="mmpt-iconbtn' + (cls ? ' ' + cls : '') + ' ' + action +
            '" data-id="' + id + '" aria-label="' + label + '" title="' + label + '">' + icon + '</button>';
    }

    /* A collapsed card is the dot and the title, nothing else. Everything
       else sits in the panel, which is inert while closed so Tab never
       lands inside it.

       The card is wrapped in a .mmpt-swipe, which clips it and carries the
       action rail behind it: dragging left reveals Complete on the right
       edge, dragging right reveals Edit on the left. The rail is decorative
       — every action on it is a button inside the panel too. */
    function renderTask(task) {
        var prio = priorityFor(task.colour);
        var isOpen = !!state.openTasks[task.id];
        var panelId = 'mmpt-task-panel-' + task.id;
        var description = task.description
            ? '<p class="mmpt-card__desc">' + esc(task.description) + '</p>'
            : '';
        var completeLabel = task.completed ? 'Reopen task' : 'Complete task';
        var completedClass = task.completed ? ' mmpt-task-card--completed' : '';
        var railDone = task.completed ? 'Reopen \u21BA' : 'Complete \u2713';

        return '<div class="mmpt-swipe" data-id="' + task.id + '">' +
            '<div class="mmpt-swipe__rail" aria-hidden="true">' +
                '<span class="mmpt-act mmpt-act--edit">\u270E Edit</span>' +
                '<span class="mmpt-act mmpt-act--done">' + railDone + '</span>' +
            '</div>' +
            '<article class="mmpt-card mmpt-task-card' + completedClass + '" data-tone="' + prio.slug +
                '" data-id="' + task.id + '" data-open="' + (isOpen ? 'true' : 'false') + '">' +
            '<button type="button" class="mmpt-card__toggle" aria-expanded="' + (isOpen ? 'true' : 'false') +
                    '" aria-controls="' + panelId + '">' +
                '<span class="mmpt-card__dot" aria-hidden="true"></span>' +
                '<span class="mmpt-card__title">' + esc(task.title) + '</span>' +
                ICON_CHEVRON +
            '</button>' +
            '<div class="mmpt-card__panel" id="' + panelId + '"' + (isOpen ? '' : ' inert') + '>' +
                '<div class="mmpt-card__panel-inner">' +
                    description +
                    dueDateHtml(task) +
                    '<div class="mmpt-card__actions">' +
                        iconButton('mmpt-iconbtn--primary', 'mmpt-task-action-complete', completeLabel,
                                   task.completed ? ICON_REOPEN : ICON_COMPLETE, task.id) +
                        iconButton('', 'mmpt-task-action-edit', 'Edit task', ICON_EDIT, task.id) +
                        iconButton('mmpt-iconbtn--danger', 'mmpt-task-action-delete', 'Delete task', ICON_DELETE, task.id) +
                    '</div>' +
                '</div>' +
            '</div>' +
            '</article>' +
        '</div>';
    }

    /* Critical → No chance, then by due date within a priority, undated
       last. The group headings are gone; this order is what carries it. */
    function sortTasks(tasks) {
        return tasks.slice().sort(function (a, b) {
            var byPriority = priorityFor(a.colour).order - priorityFor(b.colour).order;
            if (byPriority) return byPriority;

            if (a.due_date && b.due_date) {
                var dateCompare = a.due_date.localeCompare(b.due_date);
                if (dateCompare) return dateCompare;
            } else if (a.due_date) {
                return -1;
            } else if (b.due_date) {
                return 1;
            }
            return new Date(b.created) - new Date(a.created);
        });
    }

    function renderTaskCounts() {
        var open = state.tasks.filter(function (task) { return !task.completed; }).length;
        var completed = state.tasks.length - open;
        $('#mmpt-count-tasks-open').textContent = open;
        $('#mmpt-count-tasks-completed').textContent = completed;
        $('#mmpt-switch-count-tasks').textContent = open;
    }

    function tasksInStatus() {
        return state.tasks.filter(function (task) {
            if (state.taskFilter === 'open') return !task.completed;
            if (state.taskFilter === 'completed') return task.completed;
            return true;
        });
    }

    /* Counts are per colour within the current Open / Completed / All tab,
       so the numbers always agree with the list below and recalculate
       whenever either filter moves.

       The swatches carry no text, so three channels name them: the CSS
       tooltip from data-tip, the aria-label here, and the caption. */
    function renderColourFilter(inStatus) {
        var counts = { all: inStatus.length };
        TASK_PRIORITIES.forEach(function (p) { counts[p.slug] = 0; });
        inStatus.forEach(function (task) { counts[priorityFor(task.colour).slug]++; });

        /* A selection with nothing left to show falls back to All, rather
           than leaving an empty list under a dead filter. */
        if (state.taskPriority !== 'all' && !counts[state.taskPriority]) {
            state.taskPriority = 'all';
            persistTriageFilters();
        }

        $$('.mmpt-sw').forEach(function (btn) {
            var slug = btn.dataset.filter;
            var count = counts[slug] || 0;
            var name = slug === 'all' ? 'All colours' : PRIORITY_BY_SLUG[slug].label;
            var countEl = btn.querySelector('.mmpt-sw__count');

            /* Two digits is all the row has room for at 390px. */
            if (countEl) countEl.textContent = count > 99 ? '99+' : count;
            btn.setAttribute('aria-label', name + ', ' + taskCountLabel(count));
            btn.setAttribute('aria-pressed', slug === state.taskPriority ? 'true' : 'false');
            /* Greyed rather than hidden — the row must not reflow as tasks
               move — and skipped by Tab. All is never disabled. */
            btn.disabled = slug !== 'all' && count === 0;
        });

        var active = state.taskPriority;
        $('#mmpt-filter-caption').innerHTML = 'Showing <b>' +
            (active === 'all' ? 'every colour' : esc(PRIORITY_BY_SLUG[active].label)) +
            '</b> \u2014 ' + taskCountLabel(active === 'all' ? counts.all : counts[active]);
    }

    /* inert is what keeps collapsed controls out of the tab order. Older
       browsers ignore the attribute, so fall back to tabindex there. */
    var SUPPORTS_INERT = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;
    var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';

    function setPanelInert(panel, makeInert) {
        if (SUPPORTS_INERT) {
            panel.inert = makeInert;
            return;
        }
        $$(FOCUSABLE, panel).forEach(function (el) {
            if (makeInert) el.setAttribute('tabindex', '-1');
            else el.removeAttribute('tabindex');
        });
    }

    function applyInertFallback(container) {
        if (SUPPORTS_INERT) return;
        $$('.mmpt-card[data-open="false"] .mmpt-card__panel', container).forEach(function (panel) {
            setPanelInert(panel, true);
        });
    }

    function renderTasks() {
        var container = $('#mmpt-tasks');

        renderTaskCounts();
        var inStatus = tasksInStatus();
        renderColourFilter(inStatus);

        var visible = state.taskPriority === 'all'
            ? inStatus
            : inStatus.filter(function (task) {
                return priorityFor(task.colour).slug === state.taskPriority;
            });

        if (!visible.length) {
            container.innerHTML = '<div class="mmpt-empty">No tasks found.</div>';
            return;
        }

        container.innerHTML = sortTasks(visible).map(renderTask).join('');
        applyInertFallback(container);
    }

    function toggleTaskCard(card) {
        var isOpen = card.dataset.open !== 'true';
        var toggle = card.querySelector('.mmpt-card__toggle');
        var panel = card.querySelector('.mmpt-card__panel');
        var id = parseInt(card.dataset.id, 10);

        card.dataset.open = isOpen ? 'true' : 'false';
        if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (panel) setPanelInert(panel, !isOpen);

        /* Remembered so a re-render (complete, edit, delete) doesn't slam
           every open card shut. */
        if (isOpen) state.openTasks[id] = true;
        else delete state.openTasks[id];
    }

    /* ───── Task actions — one route per action, whether it was reached
       by an icon or by a swipe, so the feedback is identical ───── */

    /* /complete toggles, so undo is the same call again. */
    function toggleTaskDone(id, opts) {
        var task = state.tasks.find(function (item) { return item.id === id; });
        if (!task) return;
        var wasCompleted = !!task.completed;

        req('PUT', 'tasks/' + id + '/complete').then(function (updated) {
            var idx = state.tasks.findIndex(function (item) { return item.id === updated.id; });
            if (idx !== -1) state.tasks[idx] = updated;
            renderTasks();
            if (opts && opts.silent) return;
            showUndoToast(wasCompleted ? 'Reopened' : 'Completed \u2014 moved to Completed', id);
        }).catch(function (err) {
            renderTasks();   /* puts a swiped card back where it was */
            alert(err.message || 'Error updating task.');
        });
    }

    function openTaskEditor(id) {
        var task = state.tasks.find(function (item) { return item.id === id; });
        if (!task) return;
        $('#mmpt-task-edit-id').value = task.id;
        $('#mmpt-task-title').value = task.title;
        $('#mmpt-task-description').value = task.description || '';
        $('#mmpt-task-due-date').value = task.due_date || '';
        setTaskColour(task.colour);
        $('#mmpt-modal-task-title').textContent = 'Edit Task';
        $('#mmpt-submit-task').textContent = 'Save Changes';
        validateTaskForm();
        openModal('mmpt-modal-task');
    }

    /* ───── Undo toast ─────
       Nothing is destroyed on completion, so this window is a convenience,
       not the only route back: the task sits in the Completed tab and a
       left swipe there reopens it. Only the most recent action is
       undoable, and the next toast replaces this one. */
    var TOAST_MS = 3000;
    var toastTimer = null;

    function hideToast() {
        if (toastTimer) {
            window.clearTimeout(toastTimer);
            toastTimer = null;
        }
        var host = $('#mmpt-toast');
        host.innerHTML = '';
        host.hidden = true;
    }

    function showUndoToast(text, id) {
        hideToast();
        var host = $('#mmpt-toast');
        host.innerHTML = '<span>' + esc(text) + '</span>' +
            '<button type="button" class="mmpt-toast__undo">Undo</button>';
        host.hidden = false;
        $('.mmpt-toast__undo', host).addEventListener('click', function () {
            hideToast();
            toggleTaskDone(id, { silent: true });
        });
        toastTimer = window.setTimeout(hideToast, TOAST_MS);
    }

    /* ───── Swipe — Task Triage cards only ─────
       Pointer Events throughout: one code path for mouse, touch and pen, at
       every viewport width. The wrapper's touch-action:pan-y hands us the
       horizontal axis and keeps the vertical one for the page.

       Left completes (or reopens a completed task); right opens the editor.
       There is no keyboard equivalent and none is needed — the icon row in
       the expanded card already covers complete, edit and delete. */
    var SWIPE_LOCK_PX = 8;         /* movement before the axis is decided */
    var SWIPE_COMMIT = 0.4;        /* fraction of card width that commits */
    var SWIPE_EXIT_MS = 180;       /* exit animation before the card is gone */
    var SWIPE_SNAP_MS = 240;       /* snap-back, then the rail can go dark */

    var drag = null;
    /* A drag must never fall through to the tap-to-expand click. The click
       that follows a gesture is the only one to swallow, so this records
       when the drag ended rather than a bare flag: a right swipe opens the
       modal, and whatever the user clicks after that is their own. */
    var CLICK_SUPPRESS_MS = 700;
    var swipedAt = 0;

    function blockSelection(e) { e.preventDefault(); }

    function releaseDrag() {
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
        window.removeEventListener('pointercancel', onDragEnd);
        window.removeEventListener('selectstart', blockSelection);
        drag = null;
    }

    function onDragStart(e) {
        if (drag) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        var card = e.target.closest('.mmpt-task-card');
        var wrap = card && card.closest('.mmpt-swipe');
        if (!wrap) return;
        /* The icon row keeps working when a drag starts on top of it. */
        if (e.target.closest('.mmpt-iconbtn')) return;

        swipedAt = 0;
        card.classList.remove('mmpt-card--animate');
        drag = {
            wrap: wrap,
            card: card,
            id: parseInt(wrap.dataset.id, 10),
            pointerId: e.pointerId,
            x0: e.clientX,
            y0: e.clientY,
            dx: 0,
            lock: null,
        };

        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragEnd);
        window.addEventListener('pointercancel', onDragEnd);
    }

    function onDragMove(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        var dx = e.clientX - drag.x0;
        var dy = e.clientY - drag.y0;

        if (drag.lock === null) {
            if (Math.abs(dx) < SWIPE_LOCK_PX && Math.abs(dy) < SWIPE_LOCK_PX) return;
            /* A y lock is final for this gesture: the card never moves and
               the page scrolls normally. */
            drag.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (drag.lock === 'y') return;

            try { drag.card.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
            drag.wrap.classList.add('mmpt-swipe--active');
            window.addEventListener('selectstart', blockSelection);
        }
        if (drag.lock !== 'x') return;

        drag.dx = dx;
        /* Set every move, so the rail tracks a direction change mid-drag */
        drag.wrap.dataset.dir = dx < 0 ? 'left' : 'right';
        drag.card.style.transform = 'translateX(' + dx + 'px)';   /* 1:1, no rubber band */
    }

    function onDragEnd(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        var d = drag;
        var cancelled = e.type === 'pointercancel';
        releaseDrag();

        d.wrap.classList.remove('mmpt-swipe--active');
        /* No x lock: a tap, or a vertical scroll. The click handler owns
           tap-to-expand from here. */
        if (d.lock !== 'x') {
            d.wrap.removeAttribute('data-dir');
            return;
        }

        swipedAt = Date.now();
        d.card.classList.add('mmpt-card--animate');
        var committed = !cancelled && Math.abs(d.dx) > d.card.offsetWidth * SWIPE_COMMIT;

        if (committed && d.dx < 0) {
            d.card.style.transform = 'translateX(-100%)';
            window.setTimeout(function () { toggleTaskDone(d.id); }, SWIPE_EXIT_MS);
            return;
        }

        /* Right, or short of the threshold: the card goes back where it
           was. On a committed right swipe the modal is the feedback. */
        d.card.style.transform = '';
        window.setTimeout(function () { d.wrap.removeAttribute('data-dir'); }, SWIPE_SNAP_MS);
        if (committed) openTaskEditor(d.id);
    }

    function refresh() {
        renderCounts();
        renderProjects();
    }

    /* ───── Data Loading ───── */
    function loadProjects() {
        req('GET', 'projects?status=all').then(function (data) {
            state.projects = data;
            refresh();
        }).catch(function (err) {
            $('#mmpt-projects').innerHTML = '<div class="mmpt-empty">Error loading projects.</div>';
            console.error('MMPT load error:', err);
        });
    }

    function loadTasks() {
        req('GET', 'tasks').then(function (data) {
            state.tasks = data;
            renderTasks();
        }).catch(function (err) {
            $('#mmpt-tasks').innerHTML = '<div class="mmpt-empty">Error loading tasks.</div>';
            console.error('MMPT task load error:', err);
        });
    }

    /* ───── Modal Helpers ───── */
    function openModal(id) {
        var el = $('#' + id);
        el.style.display = '';
    }
    function closeModal(id) {
        var el = $('#' + id);
        el.style.display = 'none';
    }
    function closeAllModals() {
        $$('.mmpt-modal').forEach(function (m) { m.style.display = 'none'; });
    }

    /* ───── Project Form Validation ───── */
    function validateProjectForm() {
        var name = $('#mmpt-name').value.trim();
        var end = $('#mmpt-end-in-mind').value.trim();
        var rat = $('#mmpt-rationale').value.trim();
        $('#mmpt-submit-project').disabled = !(name && end && rat);
    }

    /* The colour buttons always hold a value, so the title is the only
       thing left that can block the submit. */
    function validateTaskForm() {
        $('#mmpt-submit-task').disabled = !$('#mmpt-task-title').value.trim();
    }

    /* The radiogroup, the hidden input the form submits, and the caption
       that names the choice all move together. */
    function setTaskColour(colour) {
        var prio = priorityFor(colour);
        $('#mmpt-task-colour').value = prio.colour;
        $$('#mmpt-task-colour-group button[role="radio"]').forEach(function (btn) {
            var checked = btn.dataset.colour === prio.colour;
            btn.setAttribute('aria-checked', checked ? 'true' : 'false');
            /* The selected button is the group's one tab stop */
            btn.tabIndex = checked ? 0 : -1;
        });
        $('#mmpt-task-colour-caption').innerHTML = 'Selected: <b>' + esc(prio.label) + '</b>';
    }

    var TASK_STATUSES = ['open', 'completed', 'all'];

    function restoreTriageFilters() {
        var stored = readStoredTriageFilters();
        if (!stored) return;
        if (TASK_STATUSES.indexOf(stored.status) !== -1) state.taskFilter = stored.status;
        var slugs = TASK_PRIORITIES.map(function (p) { return p.slug; }).concat('all');
        if (slugs.indexOf(stored.priority) !== -1) state.taskPriority = stored.priority;
    }

    /* ───── Event Binding ───── */
    function init() {
        restoreTriageFilters();
        loadProjects();
        loadTasks();

        /* Mode switch — tablist with roving tabindex and arrow-key nav.
           The page head's title and primary action follow the active view. */
        var switchTabs = $$('.mmpt-switch__tab');

        function selectSection(section) {
            switchTabs.forEach(function (tab) {
                var selected = tab.dataset.section === section;
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
                tab.tabIndex = selected ? 0 : -1;
            });
            $('#mmpt-section-projects').hidden = section !== 'projects';
            $('#mmpt-section-triage').hidden = section !== 'triage';
            $('#mmpt-new-btn').hidden = section !== 'projects';
            $('#mmpt-new-task-btn').hidden = section !== 'triage';
            $('#mmpt-pagehead-title').textContent =
                section === 'projects' ? 'Project Tracker' : 'Task Triage';
        }

        switchTabs.forEach(function (tab, index) {
            tab.addEventListener('click', function () {
                selectSection(tab.dataset.section);
            });
            tab.addEventListener('keydown', function (e) {
                var next;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = switchTabs[(index + 1) % switchTabs.length];
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = switchTabs[(index - 1 + switchTabs.length) % switchTabs.length];
                else if (e.key === 'Home') next = switchTabs[0];
                else if (e.key === 'End') next = switchTabs[switchTabs.length - 1];
                if (!next) return;
                e.preventDefault();
                selectSection(next.dataset.section);
                next.focus();
            });
        });

        /* New Task Button */
        $('#mmpt-new-task-btn').addEventListener('click', function () {
            $('#mmpt-form-task').reset();
            $('#mmpt-task-edit-id').value = '';
            setTaskColour(DEFAULT_TASK_COLOUR);
            $('#mmpt-modal-task-title').textContent = 'Add Task';
            $('#mmpt-submit-task').textContent = 'Add Task';
            $('#mmpt-submit-task').disabled = true;
            openModal('mmpt-modal-task');
        });

        $('#mmpt-task-title').addEventListener('input', validateTaskForm);

        /* Triage colour — a radiogroup: one tab stop for the five, arrow
           keys between them. Both forms use it; only the colour control
           changed, every other field is as it was. */
        var colourGroup = $('#mmpt-task-colour-group');
        var colourRadios = $$('button[role="radio"]', colourGroup);

        colourGroup.addEventListener('click', function (e) {
            var btn = e.target.closest('button[role="radio"]');
            if (btn) setTaskColour(btn.dataset.colour);
        });

        colourGroup.addEventListener('keydown', function (e) {
            var btn = e.target.closest('button[role="radio"]');
            if (!btn) return;
            var index = colourRadios.indexOf(btn);
            var next;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = colourRadios[(index + 1) % colourRadios.length];
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = colourRadios[(index - 1 + colourRadios.length) % colourRadios.length];
            else if (e.key === 'Home') next = colourRadios[0];
            else if (e.key === 'End') next = colourRadios[colourRadios.length - 1];
            if (!next) return;
            e.preventDefault();
            setTaskColour(next.dataset.colour);
            next.focus();
        });

        setTaskColour(DEFAULT_TASK_COLOUR);

        /* Task Form Submit */
        $('#mmpt-form-task').addEventListener('submit', function (e) {
            e.preventDefault();
            var editId = $('#mmpt-task-edit-id').value;
            var payload = {
                title: $('#mmpt-task-title').value.trim(),
                description: $('#mmpt-task-description').value.trim(),
                due_date: $('#mmpt-task-due-date').value,
                colour: $('#mmpt-task-colour').value,
            };

            req(editId ? 'PUT' : 'POST', editId ? 'tasks/' + editId : 'tasks', payload).then(function (task) {
                var idx = state.tasks.findIndex(function (item) { return item.id === task.id; });
                if (idx === -1) state.tasks.push(task);
                else state.tasks[idx] = task;
                closeModal('mmpt-modal-task');
                renderTasks();
            }).catch(function (err) {
                alert(err.message || 'Error saving task.');
            });
        });

        /* Task status — same tablist pattern as the main switch, smaller. */
        var statusTabs = $$('.mmpt-statusswitch__tab');

        function syncStatusTabs(status) {
            statusTabs.forEach(function (tab) {
                var selected = tab.dataset.taskStatus === status;
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
                tab.tabIndex = selected ? 0 : -1;
            });
        }

        function selectTaskStatus(status) {
            syncStatusTabs(status);
            state.taskFilter = status;
            /* The counts are scoped to the tab, so a colour carried across
               would be filtering against numbers the user never saw. */
            state.taskPriority = 'all';
            persistTriageFilters();
            renderTasks();
        }

        statusTabs.forEach(function (tab, index) {
            tab.addEventListener('click', function () {
                selectTaskStatus(tab.dataset.taskStatus);
            });
            tab.addEventListener('keydown', function (e) {
                var next;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = statusTabs[(index + 1) % statusTabs.length];
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = statusTabs[(index - 1 + statusTabs.length) % statusTabs.length];
                else if (e.key === 'Home') next = statusTabs[0];
                else if (e.key === 'End') next = statusTabs[statusTabs.length - 1];
                if (!next) return;
                e.preventDefault();
                selectTaskStatus(next.dataset.taskStatus);
                next.focus();
            });
        });

        /* A restored selection has to reach the markup before first paint.
           No render here — the tasks are still loading, and renderTasks()
           would replace the loading line with "No tasks found". */
        syncStatusTabs(state.taskFilter);

        /* Triage colour filter — single-select. Choosing one clears the
           previous; choosing the active one, or All, resets to All. */
        $$('.mmpt-sw').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var slug = btn.dataset.filter;
                state.taskPriority = slug === state.taskPriority ? 'all' : slug;
                persistTriageFilters();
                renderTasks();
            });
        });

        /* Swipe. Delegated, so it survives every re-render of the list. */
        $('#mmpt-tasks').addEventListener('pointerdown', onDragStart);

        /* A swipe ends in a click on the card it started on; swallow that
           one before it reaches the handler below and expands the card. */
        $('#mmpt-tasks').addEventListener('click', function (e) {
            if (!swipedAt) return;
            var fromSwipe = Date.now() - swipedAt < CLICK_SUPPRESS_MS;
            swipedAt = 0;
            if (!fromSwipe) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        /* Task card expand / collapse, then the actions inside the panel.
           Independent toggles — opening one card never closes another. */
        $('#mmpt-tasks').addEventListener('click', function (e) {
            var toggle = e.target.closest('.mmpt-card__toggle');
            if (toggle) {
                toggleTaskCard(toggle.closest('.mmpt-card'));
                return;
            }

            var button = e.target.closest('button');
            if (!button) return;
            var id = parseInt(button.dataset.id, 10);
            var task = state.tasks.find(function (item) { return item.id === id; });
            if (!task) return;

            /* The tick raises the same toast the swipe does — one action,
               one piece of feedback. */
            if (button.classList.contains('mmpt-task-action-complete')) {
                toggleTaskDone(id);
                return;
            }

            if (button.classList.contains('mmpt-task-action-edit')) {
                openTaskEditor(id);
                return;
            }

            if (button.classList.contains('mmpt-task-action-delete')) {
                $('#mmpt-task-delete-id').value = task.id;
                $('#mmpt-task-delete-name').textContent = task.title;
                openModal('mmpt-modal-task-delete');
            }
        });

        $('#mmpt-confirm-task-delete').addEventListener('click', function () {
            var id = parseInt($('#mmpt-task-delete-id').value, 10);
            req('DELETE', 'tasks/' + id).then(function () {
                state.tasks = state.tasks.filter(function (task) { return task.id !== id; });
                delete state.openTasks[id];
                closeModal('mmpt-modal-task-delete');
                renderTasks();
            }).catch(function (err) {
                alert(err.message || 'Error deleting task.');
            });
        });

        /* New Project Button */
        $('#mmpt-new-btn').addEventListener('click', function () {
            $('#mmpt-edit-id').value = '';
            $('#mmpt-form-project').reset();
            $('#mmpt-submit-project').disabled = true;
            $('#mmpt-submit-project').textContent = 'Create Project';
            $('#mmpt-modal-project-title').innerHTML = 'Begin With The End In Mind';
            $('#mmpt-modal-project-subtitle').textContent = 'Before you start, define where you want to end up and why this matters.';
            openModal('mmpt-modal-project');
        });

        /* Project Form Validation */
        ['mmpt-name', 'mmpt-end-in-mind', 'mmpt-rationale'].forEach(function (id) {
            $('#' + id).addEventListener('input', validateProjectForm);
        });

        /* Project Form Submit */
        $('#mmpt-form-project').addEventListener('submit', function (e) {
            e.preventDefault();
            var editId = $('#mmpt-edit-id').value;
            var payload = {
                name: $('#mmpt-name').value.trim(),
                end_in_mind: $('#mmpt-end-in-mind').value.trim(),
                rationale: $('#mmpt-rationale').value.trim(),
                priority: $('#mmpt-priority').value,
                category: $('#mmpt-category').value.trim(),
                cadence: $('#mmpt-cadence').value,
                cadence_label: $('#mmpt-cadence-label').value.trim(),
                stale_days: parseInt($('#mmpt-stale-days').value, 10) || 14,
            };

            var method = editId ? 'PUT' : 'POST';
            var path = editId ? 'projects/' + editId : 'projects';

            req(method, path, payload).then(function (project) {
                if (editId) {
                    var idx = state.projects.findIndex(function (p) { return p.id === project.id; });
                    if (idx !== -1) state.projects[idx] = project;
                } else {
                    state.projects.push(project);
                }
                closeModal('mmpt-modal-project');
                refresh();
            }).catch(function (err) {
                alert(err.message || 'Error saving project.');
            });
        });

        /* Project Status Chips */
        $$('.mmpt-chip[data-status]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                $$('.mmpt-chip[data-status]').forEach(function (c) {
                    c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
                });
                state.filter.status = chip.dataset.status;
                renderProjects();
            });
        });

        /* Priority Filter */
        $('#mmpt-filter-priority').addEventListener('change', function () {
            state.filter.priority = this.value;
            renderProjects();
        });

        /* Sort */
        $('#mmpt-filter-sort').addEventListener('change', function () {
            state.filter.sort = this.value;
            renderProjects();
        });

        /* Search */
        var searchTimer;
        $('#mmpt-search').addEventListener('input', function () {
            var val = this.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                state.filter.search = val;
                renderProjects();
            }, 200);
        });

        /* Card Click Delegation */
        $('#mmpt-projects').addEventListener('click', function (e) {
            var target = e.target;

            /* Milestone "Show earlier" toggle */
            var msToggle = target.closest('.mmpt-milestone-toggle');
            if (msToggle) {
                var section = msToggle.closest('.mmpt-detail-section');
                var hiddenBox = section ? section.querySelector('.mmpt-milestone-hidden') : null;
                if (hiddenBox) {
                    var expanded = msToggle.dataset.expanded === 'true';
                    hiddenBox.style.display = expanded ? 'none' : 'block';
                    msToggle.dataset.expanded = expanded ? 'false' : 'true';
                    var count = msToggle.dataset.count;
                    msToggle.textContent = expanded
                        ? ('Show ' + count + ' earlier milestone' + (count === '1' ? '' : 's') + ' ▾')
                        : 'Hide earlier milestones ▴';
                }
                return;
            }

            /* Expand / Collapse */
            var header = target.closest('.mmpt-card-header');
            if (header && !target.closest('button')) {
                header.closest('.mmpt-card').classList.toggle('mmpt-expanded');
                return;
            }

            /* Log Milestone */
            if (target.closest('.mmpt-action-milestone')) {
                var id = parseInt(target.closest('.mmpt-action-milestone').dataset.id, 10);
                var proj = state.projects.find(function (p) { return p.id === id; });
                if (!proj) return;
                $('#mmpt-ms-project-id').value = id;
                $('#mmpt-ms-project-name').textContent = proj.name;
                $('#mmpt-ms-current-version').value = proj.version;
                $('#mmpt-ms-current-ver').textContent = 'v' + proj.version;
                $$('#mmpt-form-milestone .mmpt-toggle').forEach(function (t) {
                    t.classList.toggle('mmpt-toggle-active', t.dataset.type === 'minor');
                });
                updateMilestonePreview();
                $('#mmpt-ms-desc').value = '';
                openModal('mmpt-modal-milestone');
                return;
            }

            /* Edit */
            if (target.closest('.mmpt-action-edit')) {
                var editId = parseInt(target.closest('.mmpt-action-edit').dataset.id, 10);
                var p = state.projects.find(function (p) { return p.id === editId; });
                if (!p) return;
                $('#mmpt-edit-id').value = p.id;
                $('#mmpt-name').value = p.name;
                $('#mmpt-end-in-mind').value = p.end_in_mind || '';
                $('#mmpt-rationale').value = p.rationale || '';
                $('#mmpt-priority').value = p.priority;
                $('#mmpt-category').value = p.category || '';
                $('#mmpt-cadence').value = p.cadence || 'none';
                $('#mmpt-cadence-label').value = p.cadence_label || '';
                $('#mmpt-stale-days').value = p.stale_days || 14;
                $('#mmpt-submit-project').textContent = 'Save Changes';
                $('#mmpt-submit-project').disabled = false;
                $('#mmpt-modal-project-title').innerHTML = 'Edit Project';
                $('#mmpt-modal-project-subtitle').textContent = 'Update your project details.';
                openModal('mmpt-modal-project');
                return;
            }

            /* Archive/Restore */
            if (target.closest('.mmpt-action-archive')) {
                var archiveId = parseInt(target.closest('.mmpt-action-archive').dataset.id, 10);
                req('PUT', 'projects/' + archiveId + '/archive').then(function (project) {
                    var idx = state.projects.findIndex(function (p) { return p.id === project.id; });
                    if (idx !== -1) state.projects[idx] = project;
                    refresh();
                }).catch(function (err) {
                    alert(err.message || 'Error toggling archive status.');
                });
                return;
            }

            /* Delete */
            if (target.closest('.mmpt-action-delete')) {
                var delId = parseInt(target.closest('.mmpt-action-delete').dataset.id, 10);
                var delProj = state.projects.find(function (p) { return p.id === delId; });
                if (!delProj) return;
                $('#mmpt-delete-id').value = delId;
                $('#mmpt-delete-name').textContent = delProj.name;
                openModal('mmpt-modal-delete');
                return;
            }
        });

        /* Milestone Type Toggle */
        $('#mmpt-form-milestone').addEventListener('click', function (e) {
            var toggle = e.target.closest('.mmpt-toggle');
            if (!toggle) return;
            e.preventDefault();
            $$('#mmpt-form-milestone .mmpt-toggle').forEach(function (t) {
                t.classList.remove('mmpt-toggle-active');
            });
            toggle.classList.add('mmpt-toggle-active');
            updateMilestonePreview();
        });

        function updateMilestonePreview() {
            var current = $('#mmpt-ms-current-version').value;
            var active = $('#mmpt-form-milestone .mmpt-toggle-active');
            var type = active ? active.dataset.type : 'minor';
            $('#mmpt-ms-next-ver').textContent = 'v' + calcNextVersion(current, type);
        }

        /* Milestone Form Submit */
        $('#mmpt-form-milestone').addEventListener('submit', function (e) {
            e.preventDefault();
            var projId = $('#mmpt-ms-project-id').value;
            var active = $('#mmpt-form-milestone .mmpt-toggle-active');
            var type = active ? active.dataset.type : 'minor';
            var desc = $('#mmpt-ms-desc').value.trim();
            if (!desc) return;

            req('POST', 'projects/' + projId + '/milestone', {
                type: type,
                description: desc,
            }).then(function (project) {
                var idx = state.projects.findIndex(function (p) { return p.id === project.id; });
                if (idx !== -1) state.projects[idx] = project;
                closeModal('mmpt-modal-milestone');
                refresh();
            }).catch(function (err) {
                alert(err.message || 'Error logging milestone.');
            });
        });

        /* Confirm Delete */
        $('#mmpt-confirm-delete').addEventListener('click', function () {
            var delId = $('#mmpt-delete-id').value;
            req('DELETE', 'projects/' + delId).then(function () {
                state.projects = state.projects.filter(function (p) { return p.id !== parseInt(delId, 10); });
                closeModal('mmpt-modal-delete');
                refresh();
            }).catch(function (err) {
                alert(err.message || 'Error deleting project.');
            });
        });

        /* Modal Close Buttons & Overlay */
        $$('.mmpt-modal-close').forEach(function (btn) {
            btn.addEventListener('click', function () {
                closeAllModals();
            });
        });
        $$('.mmpt-modal-overlay').forEach(function (overlay) {
            overlay.addEventListener('click', function () {
                closeAllModals();
            });
        });

        /* Escape key */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAllModals();
        });
    }

    /* ───── Boot ───── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
