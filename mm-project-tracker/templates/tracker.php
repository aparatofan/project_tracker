<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div id="mmpt-app" class="mmpt-app">
    <!-- Header -->
    <div class="mmpt-header">
        <div class="mmpt-header-left">
            <h2 class="mmpt-title">Project Tracker</h2>
            <p class="mmpt-subtitle">"Begin with the end in mind" &mdash; Habit 2</p>
        </div>
        <button id="mmpt-new-btn" class="mmpt-btn mmpt-btn-primary">+ New Project</button>
    </div>

    <!-- Filters -->
    <div class="mmpt-filters">
        <div class="mmpt-tabs">
            <button class="mmpt-tab mmpt-tab-active" data-status="publish">Active <span id="mmpt-count-active" class="mmpt-badge-count">0</span></button>
            <button class="mmpt-tab" data-status="draft">Archived <span id="mmpt-count-archived" class="mmpt-badge-count">0</span></button>
            <button class="mmpt-tab" data-status="all">All</button>
        </div>
        <div class="mmpt-filter-row">
            <select id="mmpt-filter-priority" class="mmpt-select">
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>
            <select id="mmpt-filter-sort" class="mmpt-select">
                <option value="neglected">Most Neglected</option>
                <option value="priority">By Priority</option>
                <option value="version">By Version</option>
                <option value="newest">Newest First</option>
            </select>
            <input type="text" id="mmpt-search" class="mmpt-search" placeholder="&#128269; Search projects..." />
        </div>
    </div>

    <!-- Project List -->
    <div id="mmpt-projects" class="mmpt-projects">
        <div class="mmpt-loading">Loading projects...</div>
    </div>

    <!-- Stats Footer -->
    <div id="mmpt-footer" class="mmpt-footer">
        <span>Active: <strong id="mmpt-stat-active">0</strong></span>
        <span>Total Milestones: <strong id="mmpt-stat-milestones">0</strong></span>
        <span>Archived: <strong id="mmpt-stat-archived">0</strong></span>
    </div>

    <!-- New Project Modal -->
    <div id="mmpt-modal-project" class="mmpt-modal mmpt-modal-wide" style="display:none;">
        <div class="mmpt-modal-overlay"></div>
        <div class="mmpt-modal-content">
            <div class="mmpt-modal-header">
                <h3 id="mmpt-modal-project-title">&#127919; Begin With The End In Mind</h3>
                <button class="mmpt-modal-close">&times;</button>
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
                            <label for="mmpt-end-in-mind">The End I Have In Mind *</label>
                            <textarea id="mmpt-end-in-mind" required placeholder="What does 'done' look like?" rows="5"></textarea>
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-rationale">Why Am I Starting This? *</label>
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
                            <label for="mmpt-cadence">Commitment Cadence</label>
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
                            <label for="mmpt-cadence-label">Cadence Description</label>
                            <input type="text" id="mmpt-cadence-label" placeholder="e.g. 1 lesson per week" />
                        </div>
                        <div class="mmpt-field">
                            <label for="mmpt-stale-days">Stale After (days)</label>
                            <input type="number" id="mmpt-stale-days" value="14" min="1" />
                        </div>
                    </div>
                </div>
                <div class="mmpt-form-actions">
                    <button type="button" class="mmpt-btn mmpt-btn-secondary mmpt-modal-close">Cancel</button>
                    <button type="submit" id="mmpt-submit-project" class="mmpt-btn mmpt-btn-primary" disabled>Create Project</button>
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
                <button class="mmpt-modal-close">&times;</button>
            </div>
            <p class="mmpt-modal-subtitle">Current: <strong id="mmpt-ms-current-ver"></strong> &rarr; Next: <strong id="mmpt-ms-next-ver"></strong></p>
            <form id="mmpt-form-milestone" class="mmpt-form">
                <input type="hidden" id="mmpt-ms-project-id" value="" />
                <input type="hidden" id="mmpt-ms-current-version" value="" />
                <div class="mmpt-field">
                    <label>Type</label>
                    <div class="mmpt-toggle-group">
                        <button type="button" class="mmpt-toggle mmpt-toggle-active" data-type="minor">&#128295; Minor Update</button>
                        <button type="button" class="mmpt-toggle" data-type="major">&#128640; Major Milestone</button>
                    </div>
                </div>
                <div class="mmpt-field">
                    <label for="mmpt-ms-desc">What did you accomplish? *</label>
                    <textarea id="mmpt-ms-desc" required placeholder="Describe this milestone..." rows="3"></textarea>
                </div>
                <div class="mmpt-form-actions">
                    <button type="button" class="mmpt-btn mmpt-btn-secondary mmpt-modal-close">Cancel</button>
                    <button type="submit" class="mmpt-btn mmpt-btn-primary">Log Milestone</button>
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
                <button class="mmpt-modal-close">&times;</button>
            </div>
            <p>Are you sure you want to permanently delete <strong id="mmpt-delete-name"></strong>? This cannot be undone.</p>
            <input type="hidden" id="mmpt-delete-id" value="" />
            <div class="mmpt-form-actions">
                <button type="button" class="mmpt-btn mmpt-btn-secondary mmpt-modal-close">Cancel</button>
                <button type="button" id="mmpt-confirm-delete" class="mmpt-btn mmpt-btn-danger">Delete</button>
            </div>
        </div>
    </div>
</div>
