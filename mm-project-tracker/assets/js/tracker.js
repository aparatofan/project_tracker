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
        taskFilter: 'open',
        counts: { active: 0, archived: 0, milestones: 0 },
    };

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

    function stalenessHtml(level, days) {
        var cls = 'mmpt-staleness-' + level;
        var text;
        if (level === 'critical') text = '\u26A0 ' + days + 'd silent';
        else if (level === 'warning') text = days + 'd silent';
        else text = daysLabel(days);
        return '<span class="mmpt-chip-staleness ' + cls + '">' + text + '</span>';
    }

    function commitmentHtml(status, daysRemaining) {
        if (status === 'none') return '';
        var cls = 'mmpt-commitment-' + status;
        var text;
        if (status === 'on_track') text = '\u2705 ' + Math.max(0, daysRemaining) + 'd left';
        else if (status === 'due_soon') text = '\uD83D\uDD35 Due in ' + Math.max(0, daysRemaining) + 'd';
        else if (status === 'late') text = '\uD83D\uDFE1 Due ' + Math.abs(daysRemaining) + 'd ago';
        else text = '\uD83D\uDD34 Overdue by ' + Math.abs(daysRemaining) + 'd';
        return '<span class="mmpt-chip-commitment ' + cls + '">' + text + '</span>';
    }

    function priorityChip(p) {
        return '<span class="mmpt-chip mmpt-chip-priority mmpt-chip-priority-' + p + '">' +
            p.charAt(0).toUpperCase() + p.slice(1) + '</span>';
    }

    var CADENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };

    function cardStatusClass(p) {
        if (!p.cadence || p.cadence === 'none') return '';
        var allowed = CADENCE_DAYS[p.cadence];
        if (!allowed) return '';
        var daysOverdue = p.days_since_activity - allowed;
        if (daysOverdue < -2) return 'mmpt-card--on-track';
        if (daysOverdue < 0) return 'mmpt-card--due-soon';
        if (daysOverdue <= 3) return 'mmpt-card--slight-over';
        if (daysOverdue <= 14) return 'mmpt-card--overdue';
        return 'mmpt-card--severe';
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
            '<span class="mmpt-chip mmpt-chip-version">v' + esc(m.version) + '</span>' +
            '<span class="mmpt-timeline-date">' + formatDate(m.date) + '</span>' +
            '</div>' +
            '<div class="mmpt-timeline-desc">' + esc(m.description) + '</div>' +
            '</div>';
    }

    var MILESTONE_VISIBLE = 7;

    function renderMilestones(milestones) {
        if (!milestones || !milestones.length) return '<p class="mmpt-detail-text" style="color:#94A3B8;">No milestones yet.</p>';
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
        var cat = p.category ? '<span class="mmpt-chip mmpt-chip-category">' + esc(p.category) + '</span>' : '';
        var commitment = commitmentHtml(p.commitment_status, p.commitment_days_remaining);
        var cadenceSection = '';
        if (p.cadence !== 'none') {
            cadenceSection = '<div class="mmpt-detail-section">' +
                '<div class="mmpt-detail-label">\uD83D\uDCC5 Commitment</div>' +
                '<div class="mmpt-detail-text">' + esc(p.cadence_label || p.cadence) + ' (' + esc(p.cadence) + ')</div>' +
                '</div>';
        }
        var archiveLabel = p.status === 'publish' ? 'Archive' : 'Restore';
        var statusClass = cardStatusClass(p);
        var cardClass = 'mmpt-card' + (statusClass ? ' ' + statusClass : '');

        return '<div class="' + cardClass + '" data-id="' + p.id + '" data-priority="' + p.priority + '" data-staleness="' + p.staleness_level + '">' +
            '<div class="mmpt-card-header">' +
                '<span class="mmpt-card-name">' + esc(p.name) + '</span>' +
                '<span class="mmpt-chip mmpt-chip-version">v' + esc(p.version) + '</span>' +
                cat +
                priorityChip(p.priority) +
                stalenessHtml(p.staleness_level, p.days_since_activity) +
                commitment +
                '<span class="mmpt-card-spacer"></span>' +
                '<span class="mmpt-card-chevron">\u25BC</span>' +
            '</div>' +
            '<div class="mmpt-card-body">' +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">\uD83C\uDFC1 The End In Mind</div>' +
                    '<div class="mmpt-detail-text">' + esc(p.end_in_mind) + '</div>' +
                '</div>' +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">\uD83D\uDCA1 Why I Started This</div>' +
                    '<div class="mmpt-detail-text">' + esc(p.rationale) + '</div>' +
                '</div>' +
                cadenceSection +
                '<div class="mmpt-detail-section">' +
                    '<div class="mmpt-detail-label">Milestone Log</div>' +
                    renderMilestones(p.milestones) +
                '</div>' +
                '<div class="mmpt-card-actions">' +
                    '<button class="mmpt-btn mmpt-btn-sm mmpt-btn-primary mmpt-action-milestone" data-id="' + p.id + '">+ Log Milestone</button>' +
                    '<button class="mmpt-btn mmpt-btn-sm mmpt-btn-secondary mmpt-action-edit" data-id="' + p.id + '">Edit</button>' +
                    '<button class="mmpt-btn mmpt-btn-sm mmpt-btn-secondary mmpt-action-archive" data-id="' + p.id + '">' + archiveLabel + '</button>' +
                    '<button class="mmpt-btn mmpt-btn-sm mmpt-btn-ghost mmpt-action-delete" data-id="' + p.id + '">Delete</button>' +
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

    var TASK_COLOURS = [
        { key: 'red', label: 'Critical' },
        { key: 'orange', label: 'Vital' },
        { key: 'yellow', label: 'Advised' },
        { key: 'green', label: 'If there’s time' },
        { key: 'black', label: 'No chance' },
    ];

    function dueDateHtml(task) {
        if (!task.due_date) return '';
        var days = task.days_remaining;
        var label;
        var stateClass = '';
        if (days < 0) {
            label = 'Overdue by ' + Math.abs(days) + ' day' + (Math.abs(days) === 1 ? '' : 's');
            stateClass = ' mmpt-task-due-overdue';
        } else if (days === 0) {
            label = 'Due today';
            stateClass = ' mmpt-task-due-today';
        } else {
            label = days + ' day' + (days === 1 ? '' : 's') + ' left';
        }
        return '<span class="mmpt-task-due' + stateClass + '">' +
            '<span>' + formatDueDate(task.due_date) + '</span>' +
            '<strong>' + label + '</strong>' +
        '</span>';
    }

    function renderTask(task) {
        var description = task.description
            ? '<p class="mmpt-task-description">' + esc(task.description) + '</p>'
            : '';
        var completeLabel = task.completed ? 'Reopen' : 'Complete';
        var completedClass = task.completed ? ' mmpt-task-card-completed' : '';

        return '<article class="mmpt-task-card mmpt-task-card-' + task.colour + completedClass + '" data-id="' + task.id + '">' +
            '<div class="mmpt-task-card-main">' +
                '<span class="mmpt-colour-dot mmpt-colour-dot-' + task.colour + '" aria-hidden="true"></span>' +
                '<div class="mmpt-task-content">' +
                    '<h4>' + esc(task.title) + '</h4>' +
                    description +
                '</div>' +
                dueDateHtml(task) +
            '</div>' +
            '<div class="mmpt-task-actions">' +
                '<button type="button" class="mmpt-btn mmpt-btn-sm mmpt-btn-primary mmpt-task-action-complete" data-id="' + task.id + '">' + completeLabel + '</button>' +
                '<button type="button" class="mmpt-btn mmpt-btn-sm mmpt-btn-secondary mmpt-task-action-edit" data-id="' + task.id + '">Edit</button>' +
                '<button type="button" class="mmpt-btn mmpt-btn-sm mmpt-btn-ghost mmpt-task-action-delete" data-id="' + task.id + '">Delete</button>' +
            '</div>' +
        '</article>';
    }

    function sortTasks(tasks) {
        return tasks.slice().sort(function (a, b) {
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
        $('#mmpt-nav-task-count').textContent = open;
    }

    function renderTasks() {
        var container = $('#mmpt-tasks');
        var visible = state.tasks.filter(function (task) {
            if (state.taskFilter === 'open') return !task.completed;
            if (state.taskFilter === 'completed') return task.completed;
            return true;
        });

        renderTaskCounts();

        if (!visible.length) {
            container.innerHTML = '<div class="mmpt-empty">No tasks found.</div>';
            return;
        }

        container.innerHTML = TASK_COLOURS.map(function (colour) {
            var tasks = sortTasks(visible.filter(function (task) { return task.colour === colour.key; }));
            if (!tasks.length) return '';
            return '<section class="mmpt-task-group mmpt-task-group-' + colour.key + '">' +
                '<div class="mmpt-task-group-heading">' +
                    '<span><i class="mmpt-colour-dot mmpt-colour-dot-' + colour.key + '"></i>' + colour.label + '</span>' +
                    '<span class="mmpt-badge-count">' + tasks.length + '</span>' +
                '</div>' +
                '<div class="mmpt-task-list">' + tasks.map(renderTask).join('') + '</div>' +
            '</section>';
        }).join('');
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

    function validateTaskForm() {
        var title = $('#mmpt-task-title').value.trim();
        var colour = $('#mmpt-task-colour').value;
        $('#mmpt-submit-task').disabled = !(title && colour);
    }

    /* ───── Event Binding ───── */
    function init() {
        loadProjects();
        loadTasks();

        /* Main Sections */
        $$('.mmpt-main-nav-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var section = item.dataset.section;
                $$('.mmpt-main-nav-item').forEach(function (navItem) {
                    navItem.classList.toggle('mmpt-main-nav-item-active', navItem === item);
                });
                $('#mmpt-section-projects').hidden = section !== 'projects';
                $('#mmpt-section-triage').hidden = section !== 'triage';
            });
        });

        /* New Task Button */
        $('#mmpt-new-task-btn').addEventListener('click', function () {
            $('#mmpt-form-task').reset();
            $('#mmpt-task-edit-id').value = '';
            $('#mmpt-modal-task-title').textContent = 'Add Task';
            $('#mmpt-submit-task').textContent = 'Add Task';
            $('#mmpt-submit-task').disabled = true;
            openModal('mmpt-modal-task');
        });

        ['mmpt-task-title', 'mmpt-task-colour'].forEach(function (id) {
            $('#' + id).addEventListener('input', validateTaskForm);
            $('#' + id).addEventListener('change', validateTaskForm);
        });

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

        /* Task Status Tabs */
        $$('.mmpt-task-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                $$('.mmpt-task-tab').forEach(function (item) { item.classList.remove('mmpt-tab-active'); });
                tab.classList.add('mmpt-tab-active');
                state.taskFilter = tab.dataset.taskStatus;
                renderTasks();
            });
        });

        /* Task Actions */
        $('#mmpt-tasks').addEventListener('click', function (e) {
            var button = e.target.closest('button');
            if (!button) return;
            var id = parseInt(button.dataset.id, 10);
            var task = state.tasks.find(function (item) { return item.id === id; });
            if (!task) return;

            if (button.classList.contains('mmpt-task-action-complete')) {
                req('PUT', 'tasks/' + id + '/complete').then(function (updated) {
                    var idx = state.tasks.findIndex(function (item) { return item.id === updated.id; });
                    if (idx !== -1) state.tasks[idx] = updated;
                    renderTasks();
                }).catch(function (err) {
                    alert(err.message || 'Error updating task.');
                });
                return;
            }

            if (button.classList.contains('mmpt-task-action-edit')) {
                $('#mmpt-task-edit-id').value = task.id;
                $('#mmpt-task-title').value = task.title;
                $('#mmpt-task-description').value = task.description || '';
                $('#mmpt-task-due-date').value = task.due_date || '';
                $('#mmpt-task-colour').value = task.colour;
                $('#mmpt-modal-task-title').textContent = 'Edit Task';
                $('#mmpt-submit-task').textContent = 'Save Changes';
                $('#mmpt-submit-task').disabled = false;
                openModal('mmpt-modal-task');
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
            $('#mmpt-modal-project-title').innerHTML = '\uD83C\uDFAF Begin With The End In Mind';
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

        /* Tabs */
        $$('.mmpt-tab[data-status]').forEach(function (tab) {
            tab.addEventListener('click', function () {
                $$('.mmpt-tab[data-status]').forEach(function (t) { t.classList.remove('mmpt-tab-active'); });
                tab.classList.add('mmpt-tab-active');
                state.filter.status = tab.dataset.status;
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
