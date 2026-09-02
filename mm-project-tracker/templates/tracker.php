<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div id="mmpt-app" class="mmpt-app">
    <!-- Top-level navigation: the mode switch runs the full width -->
    <div class="mmpt-switch" role="tablist" aria-label="Tracker sections">
        <button type="button" id="mmpt-tab-projects" class="mmpt-switch__tab" role="tab"
                aria-selected="true" aria-controls="mmpt-section-projects" tabindex="0"
                data-section="projects">
            <span>Project Tracker</span>
            <span id="mmpt-switch-count-projects" class="mmpt-switch__count">0</span>
        </button>
        <button type="button" id="mmpt-tab-triage" class="mmpt-switch__tab" role="tab"
                aria-selected="false" aria-controls="mmpt-section-triage" tabindex="-1"
                data-section="triage">
            <span>Task Triage</span>
            <span id="mmpt-switch-count-tasks" class="mmpt-switch__count">0</span>
        </button>
    </div>

    <!-- Page head: the active view's title, and its primary action -->
    <div class="mmpt-pagehead">
        <h2 id="mmpt-pagehead-title" class="mmpt-pagehead__title">Project Tracker</h2>
        <button type="button" id="mmpt-new-btn" class="mmpt-btn mmpt-btn--primary" data-section="projects">+ New project</button>
        <button type="button" id="mmpt-new-task-btn" class="mmpt-btn mmpt-btn--primary" data-section="triage" hidden>+ New task</button>
    </div>

    <section id="mmpt-section-projects" class="mmpt-main-section" role="tabpanel" aria-labelledby="mmpt-tab-projects">
        <!-- Status filter -->
        <div class="mmpt-chips" role="group" aria-label="Filter projects by status">
            <button type="button" class="mmpt-chip" data-status="publish" aria-pressed="true">Active <span id="mmpt-count-active" class="mmpt-chip__count">0</span></button>
            <button type="button" class="mmpt-chip" data-status="draft" aria-pressed="false">Archived <span id="mmpt-count-archived" class="mmpt-chip__count">0</span></button>
            <button type="button" class="mmpt-chip" data-status="all" aria-pressed="false">All</button>
        </div>

        <!-- Tools -->
        <div class="mmpt-tools">
            <select id="mmpt-filter-priority" class="mmpt-select" aria-label="Filter by priority">
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>
            <select id="mmpt-filter-sort" class="mmpt-select" aria-label="Sort projects">
                <option value="neglected">Most neglected</option>
                <option value="priority">By priority</option>
                <option value="version">By version</option>
                <option value="newest">Newest first</option>
            </select>
            <input type="search" id="mmpt-search" class="mmpt-search" placeholder="Search projects&hellip;" aria-label="Search projects" />
        </div>

        <!-- Project grid -->
        <div id="mmpt-projects" class="mmpt-grid">
            <div class="mmpt-loading">Loading projects...</div>
        </div>

        <!-- Stats Footer -->
        <div id="mmpt-footer" class="mmpt-footer">
            <span>Active <strong id="mmpt-stat-active">0</strong></span>
            <span>Total milestones <strong id="mmpt-stat-milestones">0</strong></span>
            <span>Archived <strong id="mmpt-stat-archived">0</strong></span>
        </div>
    </section>

    <section id="mmpt-section-triage" class="mmpt-main-section" role="tabpanel" aria-labelledby="mmpt-tab-triage" hidden>
        <!-- Status: segmented control, sized to its content -->
        <div class="mmpt-statusswitch" role="tablist" aria-label="Filter tasks by status">
            <button type="button" class="mmpt-statusswitch__tab" role="tab" aria-controls="mmpt-tasks"
                    aria-selected="true" tabindex="0" data-task-status="open">
                <span>Open</span>
                <span id="mmpt-count-tasks-open" class="mmpt-statusswitch__count">0</span>
            </button>
            <button type="button" class="mmpt-statusswitch__tab" role="tab" aria-controls="mmpt-tasks"
                    aria-selected="false" tabindex="-1" data-task-status="completed">
                <span>Completed</span>
                <span id="mmpt-count-tasks-completed" class="mmpt-statusswitch__count">0</span>
            </button>
            <button type="button" class="mmpt-statusswitch__tab" role="tab" aria-controls="mmpt-tasks"
                    aria-selected="false" tabindex="-1" data-task-status="all">
                <span>All</span>
            </button>
        </div>

        <!-- Priority: single-select toggles. Counts are filled in by JS. -->
        <div class="mmpt-prio" role="group" aria-label="Filter tasks by priority">
            <button type="button" class="mmpt-prio__btn" data-priority="all" aria-pressed="true">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>All</span>
                <span class="mmpt-prio__count">0</span>
            </button>
            <button type="button" class="mmpt-prio__btn" data-priority="critical" aria-pressed="false">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>Critical</span>
                <span class="mmpt-prio__count">0</span>
            </button>
            <button type="button" class="mmpt-prio__btn" data-priority="vital" aria-pressed="false">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>Vital</span>
                <span class="mmpt-prio__count">0</span>
            </button>
            <button type="button" class="mmpt-prio__btn" data-priority="advised" aria-pressed="false">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>Advised</span>
                <span class="mmpt-prio__count">0</span>
            </button>
            <button type="button" class="mmpt-prio__btn" data-priority="if-time" aria-pressed="false">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>If there&rsquo;s time</span>
                <span class="mmpt-prio__count">0</span>
            </button>
            <button type="button" class="mmpt-prio__btn" data-priority="no-chance" aria-pressed="false">
                <span class="mmpt-prio__dot" aria-hidden="true"></span>
                <span>No chance</span>
                <span class="mmpt-prio__count">0</span>
            </button>
        </div>

        <div id="mmpt-tasks" class="mmpt-grid">
            <div class="mmpt-loading">Loading tasks...</div>
        </div>
    </section>

    <!-- Task Modal -->
    <div id="mmpt-modal-task" class="mmpt-modal" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content">
            <div class="mmpt-modal-header">
                <h3 id="mmpt-modal-task-title">Add Task</h3>
                <button type="button" class="mmpt-modal-close" aria-label="Close">&times;</button>
            </div>
            <p class="mmpt-modal-subtitle">Capture the task, then decide how urgently it deserves your attention.</p>
            <form id="mmpt-form-task" class="mmpt-form">
                <input type="hidden" id="mmpt-task-edit-id" value="" />
                <div class="mmpt-field">
                    <label for="mmpt-task-title">Title *</label>
                    <input type="text" id="mmpt-task-title" required placeholder="What needs to be done?" />
                </div>
                <div class="mmpt-field">
                    <label for="mmpt-task-description">Description</label>
                    <textarea id="mmpt-task-description" rows="4" placeholder="Add any useful details..."></textarea>
                </div>
                <div class="mmpt-field-row">
                    <div class="mmpt-field">
                        <label for="mmpt-task-due-date">Due date</label>
                        <input type="date" id="mmpt-task-due-date" />
                    </div>
                    <div class="mmpt-field">
                        <label for="mmpt-task-colour">Triage colour *</label>
                        <select id="mmpt-task-colour" required>
                            <option value="">Choose a colour...</option>
                            <option value="red">Red — critical</option>
                            <option value="orange">Orange — vital</option>
                            <option value="yellow">Yellow — advised</option>
                            <option value="green">Green — if there’s time</option>
                            <option value="black">Black — no chance</option>
                        </select>
                    </div>
                </div>
                <div class="mmpt-form-actions">
                    <button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-modal-close">Cancel</button>
                    <button type="submit" id="mmpt-submit-task" class="mmpt-btn mmpt-btn--primary" disabled>Add Task</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Task Delete Confirmation Modal -->
    <div id="mmpt-modal-task-delete" class="mmpt-modal" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content mmpt-modal-small">
            <div class="mmpt-modal-header">
                <h3>Delete Task</h3>
                <button type="button" class="mmpt-modal-close" aria-label="Close">&times;</button>
            </div>
            <p>Are you sure you want to permanently delete <strong id="mmpt-task-delete-name"></strong>? This cannot be undone.</p>
            <input type="hidden" id="mmpt-task-delete-id" value="" />
            <div class="mmpt-form-actions">
                <button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-modal-close">Cancel</button>
                <button type="button" id="mmpt-confirm-task-delete" class="mmpt-btn mmpt-btn--danger">Delete</button>
            </div>
        </div>
    </div>

    <!-- New Project Modal -->
    <div id="mmpt-modal-project" class="mmpt-modal mmpt-modal-wide" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content">
            <div class="mmpt-modal-header">
                <h3 id="mmpt-modal-project-title">Begin With The End In Mind</h3>
                <button type="button" class="mmpt-modal-close" aria-label="Close">&times;</button>
            </div>
            <p class="mmpt-modal-subtitle" id="mmpt-modal-project-subtitle">Before you start, define where you want to end up and why this matters.</p>
            <form id="mmpt-form-project" class="mmpt-form">
                <input type="hidden" id="mmpt-edit-id" value="" />
                <div class="mmpt-form-grid">
                    <div class="mmpt-form-col-left">
                        <div class="mmpt-field">
                            <label for="mmpt-name">Project Name *</label>
                            <input type="text" id="mmpt-name" required placeholder="Project name" />
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-end-in-mind">The end I have in mind *</label>
                            <textarea id="mmpt-end-in-mind" required placeholder="What does 'done' look like?" rows="5"></textarea>
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-rationale">Why am I starting this? *</label>
                            <textarea id="mmpt-rationale" required placeholder="How will this help my work or life?" rows="5"></textarea>
                        </div>
                    </div>
                    <div class="mmpt-form-col-right">
                        <div class="mmpt-field">
                            <label for="mmpt-priority">Priority</label>
                            <select id="mmpt-priority">
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-category">Category</label>
                            <input type="text" id="mmpt-category" placeholder="TBT, PNA, NET, Personal..." />
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-cadence">Commitment cadence</label>
                            <select id="mmpt-cadence">
                                <option value="none" selected>No recurring commitment</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="biweekly">Biweekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                            </select>
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-cadence-label">Cadence description</label>
                            <input type="text" id="mmpt-cadence-label" placeholder="e.g. 1 lesson per week" />
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-stale-days">Stale after (days)</label>
                            <input type="number" id="mmpt-stale-days" value="14" min="1" />
                        </div>
                    </div>
                </div>
                <div class="mmpt-form-actions">
                    <button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-modal-close">Cancel</button>
                    <button type="submit" id="mmpt-submit-project" class="mmpt-btn mmpt-btn--primary" disabled>Create Project</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Milestone Modal -->
    <div id="mmpt-modal-milestone" class="mmpt-modal" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content">
            <div class="mmpt-modal-header">
                <h3>Log Milestone — <span id="mmpt-ms-project-name"></span></h3>
                <button type="button" class="mmpt-modal-close" aria-label="Close">&times;</button>
            </div>
            <p class="mmpt-modal-subtitle">Current: <strong id="mmpt-ms-current-ver"></strong> &rarr; Next: <strong id="mmpt-ms-next-ver"></strong></p>
            <form id="mmpt-form-milestone" class="mmpt-form">
                <input type="hidden" id="mmpt-ms-project-id" value="" />
                <input type="hidden" id="mmpt-ms-current-version" value="" />
                <div class="mmpt-field">
                    <label>Type</label>
                    <div class="mmpt-toggle-group">
                        <button type="button" class="mmpt-toggle mmpt-toggle-active" data-type="minor">Minor update</button>
                        <button type="button" class="mmpt-toggle" data-type="major">Major milestone</button>
                    </div>
                </div>
                <div class="mmpt-field">
                    <label for="mmpt-ms-desc">What did you accomplish? *</label>
                    <textarea id="mmpt-ms-desc" required placeholder="Describe this milestone..." rows="3"></textarea>
                </div>
                <div class="mmpt-form-actions">
                    <button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-modal-close">Cancel</button>
                    <button type="submit" class="mmpt-btn mmpt-btn--primary">Log Milestone</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="mmpt-modal-delete" class="mmpt-modal" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content mmpt-modal-small">
            <div class="mmpt-modal-header">
                <h3>Delete Project</h3>
                <button type="button" class="mmpt-modal-close" aria-label="Close">&times;</button>
            </div>
            <p>Are you sure you want to permanently delete <strong id="mmpt-delete-name"></strong>? This cannot be undone.</p>
            <input type="hidden" id="mmpt-delete-id" value="" />
            <div class="mmpt-form-actions">
                <button type="button" class="mmpt-btn mmpt-btn--secondary mmpt-modal-close">Cancel</button>
                <button type="button" id="mmpt-confirm-delete" class="mmpt-btn mmpt-btn--danger">Delete</button>
            </div>
        </div>
    </div>
</div>
