<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMPT_REST_API {

    const NAMESPACE = 'mm-project-tracker/v1';

    const META_FIELDS = array(
        '_mm_end_in_mind',
        '_mm_rationale',
        '_mm_priority',
        '_mm_category',
        '_mm_version',
        '_mm_cadence',
        '_mm_cadence_label',
        '_mm_stale_days',
        '_mm_milestones',
    );

    const VALID_PRIORITIES = array( 'high', 'medium', 'low' );
    const VALID_CADENCES   = array( 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'none' );
    const CADENCE_DAYS     = array(
        'daily'     => 1,
        'weekly'    => 7,
        'biweekly'  => 14,
        'monthly'   => 30,
        'quarterly' => 90,
    );

    /**
     * Permission callback: current user can manage_options.
     */
    public function check_admin_permission() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Register all REST routes.
     */
    public function register_routes() {
        register_rest_route( self::NAMESPACE, '/projects', array(
            array(
                'methods'             => 'GET',
                'callback'            => array( $this, 'get_projects' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
            array(
                'methods'             => 'POST',
                'callback'            => array( $this, 'create_project' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
        ) );

        register_rest_route( self::NAMESPACE, '/projects/(?P<id>\d+)', array(
            array(
                'methods'             => 'PUT',
                'callback'            => array( $this, 'update_project' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
            array(
                'methods'             => 'DELETE',
                'callback'            => array( $this, 'delete_project' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
        ) );

        register_rest_route( self::NAMESPACE, '/projects/(?P<id>\d+)/milestone', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'add_milestone' ),
            'permission_callback' => array( $this, 'check_admin_permission' ),
        ) );

        register_rest_route( self::NAMESPACE, '/projects/(?P<id>\d+)/archive', array(
            'methods'             => 'PUT',
            'callback'            => array( $this, 'toggle_archive' ),
            'permission_callback' => array( $this, 'check_admin_permission' ),
        ) );

        register_rest_route( self::NAMESPACE, '/summary', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'get_summary' ),
            'permission_callback' => array( $this, 'check_admin_permission' ),
        ) );
    }

    /**
     * GET /projects
     */
    public function get_projects( WP_REST_Request $request ) {
        $status   = $request->get_param( 'status' ) ?: 'publish';
        $priority = $request->get_param( 'priority' );
        $category = $request->get_param( 'category' );
        $sort     = $request->get_param( 'sort' ) ?: 'neglected';
        $search   = $request->get_param( 'search' );

        $args = array(
            'post_type'      => 'mm_project',
            'post_status'    => $status === 'all' ? array( 'publish', 'draft' ) : $status,
            'posts_per_page' => -1,
            'orderby'        => 'date',
            'order'          => 'DESC',
        );

        if ( $search ) {
            $args['s'] = $search;
        }

        if ( $priority && in_array( $priority, self::VALID_PRIORITIES, true ) ) {
            $args['meta_query'][] = array(
                'key'   => '_mm_priority',
                'value' => $priority,
            );
        }

        if ( $category ) {
            $args['meta_query'][] = array(
                'key'   => '_mm_category',
                'value' => $category,
            );
        }

        $query    = new WP_Query( $args );
        $projects = array();

        foreach ( $query->posts as $post ) {
            $projects[] = $this->format_project( $post );
        }

        // Sort results.
        if ( $sort === 'neglected' ) {
            usort( $projects, function( $a, $b ) {
                return $b['days_since_activity'] - $a['days_since_activity'];
            } );
        } elseif ( $sort === 'priority' ) {
            $order = array( 'high' => 0, 'medium' => 1, 'low' => 2 );
            usort( $projects, function( $a, $b ) use ( $order ) {
                return ( $order[ $a['priority'] ] ?? 1 ) - ( $order[ $b['priority'] ] ?? 1 );
            } );
        } elseif ( $sort === 'version' ) {
            usort( $projects, function( $a, $b ) {
                return version_compare( $b['version'], $a['version'] );
            } );
        } elseif ( $sort === 'newest' ) {
            usort( $projects, function( $a, $b ) {
                return strtotime( $b['created'] ) - strtotime( $a['created'] );
            } );
        }

        return rest_ensure_response( $projects );
    }

    /**
     * POST /projects
     */
    public function create_project( WP_REST_Request $request ) {
        $body = $request->get_json_params();

        $name        = isset( $body['name'] ) ? sanitize_text_field( $body['name'] ) : '';
        $end_in_mind = isset( $body['end_in_mind'] ) ? sanitize_textarea_field( $body['end_in_mind'] ) : '';
        $rationale   = isset( $body['rationale'] ) ? sanitize_textarea_field( $body['rationale'] ) : '';

        if ( empty( $name ) ) {
            return new WP_Error( 'missing_name', 'Project name is required.', array( 'status' => 400 ) );
        }
        if ( empty( $end_in_mind ) ) {
            return new WP_Error( 'missing_end_in_mind', 'You must define the end in mind (Habit 2) before creating a project.', array( 'status' => 400 ) );
        }
        if ( empty( $rationale ) ) {
            return new WP_Error( 'missing_rationale', 'You must define why this project matters before creating it.', array( 'status' => 400 ) );
        }

        $priority = isset( $body['priority'] ) ? sanitize_text_field( $body['priority'] ) : 'medium';
        if ( ! in_array( $priority, self::VALID_PRIORITIES, true ) ) {
            return new WP_Error( 'invalid_priority', 'Priority must be high, medium, or low.', array( 'status' => 400 ) );
        }

        $cadence = isset( $body['cadence'] ) ? sanitize_text_field( $body['cadence'] ) : 'none';
        if ( ! in_array( $cadence, self::VALID_CADENCES, true ) ) {
            return new WP_Error( 'invalid_cadence', 'Invalid cadence value.', array( 'status' => 400 ) );
        }

        $post_id = wp_insert_post( array(
            'post_type'   => 'mm_project',
            'post_title'  => $name,
            'post_status' => 'publish',
        ) );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, '_mm_end_in_mind', $end_in_mind );
        update_post_meta( $post_id, '_mm_rationale', $rationale );
        update_post_meta( $post_id, '_mm_priority', $priority );
        update_post_meta( $post_id, '_mm_category', isset( $body['category'] ) ? sanitize_text_field( $body['category'] ) : '' );
        update_post_meta( $post_id, '_mm_version', '1.0' );
        update_post_meta( $post_id, '_mm_cadence', $cadence );
        update_post_meta( $post_id, '_mm_cadence_label', isset( $body['cadence_label'] ) ? sanitize_text_field( $body['cadence_label'] ) : '' );
        update_post_meta( $post_id, '_mm_stale_days', isset( $body['stale_days'] ) ? absint( $body['stale_days'] ) : 14 );
        update_post_meta( $post_id, '_mm_milestones', array() );

        $post = get_post( $post_id );
        return rest_ensure_response( $this->format_project( $post ) );
    }

    /**
     * PUT /projects/{id}
     */
    public function update_project( WP_REST_Request $request ) {
        $id   = (int) $request->get_param( 'id' );
        $post = get_post( $id );

        if ( ! $post || $post->post_type !== 'mm_project' ) {
            return new WP_Error( 'not_found', 'Project not found.', array( 'status' => 404 ) );
        }

        $body = $request->get_json_params();

        if ( isset( $body['name'] ) ) {
            wp_update_post( array(
                'ID'         => $id,
                'post_title' => sanitize_text_field( $body['name'] ),
            ) );
        }

        $meta_map = array(
            'end_in_mind'  => '_mm_end_in_mind',
            'rationale'    => '_mm_rationale',
            'priority'     => '_mm_priority',
            'category'     => '_mm_category',
            'cadence'      => '_mm_cadence',
            'cadence_label'=> '_mm_cadence_label',
            'stale_days'   => '_mm_stale_days',
        );

        foreach ( $meta_map as $key => $meta_key ) {
            if ( isset( $body[ $key ] ) ) {
                $value = $body[ $key ];

                if ( $key === 'priority' && ! in_array( $value, self::VALID_PRIORITIES, true ) ) {
                    return new WP_Error( 'invalid_priority', 'Priority must be high, medium, or low.', array( 'status' => 400 ) );
                }
                if ( $key === 'cadence' && ! in_array( $value, self::VALID_CADENCES, true ) ) {
                    return new WP_Error( 'invalid_cadence', 'Invalid cadence value.', array( 'status' => 400 ) );
                }
                if ( $key === 'stale_days' ) {
                    $value = absint( $value );
                } else {
                    $value = sanitize_text_field( $value );
                }

                update_post_meta( $id, $meta_key, $value );
            }
        }

        $post = get_post( $id );
        return rest_ensure_response( $this->format_project( $post ) );
    }

    /**
     * DELETE /projects/{id}
     */
    public function delete_project( WP_REST_Request $request ) {
        $id   = (int) $request->get_param( 'id' );
        $post = get_post( $id );

        if ( ! $post || $post->post_type !== 'mm_project' ) {
            return new WP_Error( 'not_found', 'Project not found.', array( 'status' => 404 ) );
        }

        wp_delete_post( $id, true );
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    /**
     * POST /projects/{id}/milestone
     */
    public function add_milestone( WP_REST_Request $request ) {
        $id   = (int) $request->get_param( 'id' );
        $post = get_post( $id );

        if ( ! $post || $post->post_type !== 'mm_project' ) {
            return new WP_Error( 'not_found', 'Project not found.', array( 'status' => 404 ) );
        }

        $body        = $request->get_json_params();
        $description = isset( $body['description'] ) ? sanitize_textarea_field( $body['description'] ) : '';
        $type        = isset( $body['type'] ) ? sanitize_text_field( $body['type'] ) : 'minor';

        if ( empty( $description ) ) {
            return new WP_Error( 'missing_description', 'Milestone description is required.', array( 'status' => 400 ) );
        }

        if ( ! in_array( $type, array( 'minor', 'major' ), true ) ) {
            return new WP_Error( 'invalid_type', 'Milestone type must be minor or major.', array( 'status' => 400 ) );
        }

        $current_version = get_post_meta( $id, '_mm_version', true ) ?: '1.0';
        $new_version     = $this->calculate_next_version( $current_version, $type );

        $milestones = get_post_meta( $id, '_mm_milestones', true );
        if ( ! is_array( $milestones ) ) {
            $milestones = array();
        }

        $milestone = array(
            'version'     => $new_version,
            'type'        => $type,
            'description' => $description,
            'date'        => current_time( 'c' ),
        );

        $milestones[] = $milestone;
        update_post_meta( $id, '_mm_milestones', $milestones );
        update_post_meta( $id, '_mm_version', $new_version );

        $post = get_post( $id );
        return rest_ensure_response( $this->format_project( $post ) );
    }

    /**
     * PUT /projects/{id}/archive
     */
    public function toggle_archive( WP_REST_Request $request ) {
        $id   = (int) $request->get_param( 'id' );
        $post = get_post( $id );

        if ( ! $post || $post->post_type !== 'mm_project' ) {
            return new WP_Error( 'not_found', 'Project not found.', array( 'status' => 404 ) );
        }

        $new_status = ( $post->post_status === 'publish' ) ? 'draft' : 'publish';
        wp_update_post( array(
            'ID'          => $id,
            'post_status' => $new_status,
        ) );

        $post = get_post( $id );
        return rest_ensure_response( $this->format_project( $post ) );
    }

    /**
     * GET /summary
     */
    public function get_summary( WP_REST_Request $request ) {
        $query = new WP_Query( array(
            'post_type'      => 'mm_project',
            'post_status'    => array( 'publish', 'draft' ),
            'posts_per_page' => -1,
        ) );

        $active_count     = 0;
        $archived_count   = 0;
        $total_milestones = 0;
        $stale            = array();
        $overdue          = array();

        foreach ( $query->posts as $post ) {
            $project = $this->format_project( $post );

            if ( $project['status'] === 'publish' ) {
                $active_count++;
            } else {
                $archived_count++;
            }

            $total_milestones += count( $project['milestones'] );

            if ( $project['status'] === 'publish' ) {
                if ( $project['staleness_level'] === 'critical' || $project['staleness_level'] === 'warning' ) {
                    $stale[] = array(
                        'id'                  => $project['id'],
                        'name'                => $project['name'],
                        'days_since_activity' => $project['days_since_activity'],
                        'staleness_level'     => $project['staleness_level'],
                    );
                }

                if ( $project['commitment_status'] === 'overdue' || $project['commitment_status'] === 'late' ) {
                    $overdue[] = array(
                        'id'                => $project['id'],
                        'name'              => $project['name'],
                        'commitment_status' => $project['commitment_status'],
                        'days_since_activity' => $project['days_since_activity'],
                        'cadence'           => $project['cadence'],
                    );
                }
            }
        }

        return rest_ensure_response( array(
            'active_count'     => $active_count,
            'archived_count'   => $archived_count,
            'total_milestones' => $total_milestones,
            'stale_projects'   => $stale,
            'overdue_projects' => $overdue,
        ) );
    }

    /**
     * Format a project post into a response array.
     */
    private function format_project( WP_Post $post ) {
        $milestones = get_post_meta( $post->ID, '_mm_milestones', true );
        if ( ! is_array( $milestones ) ) {
            $milestones = array();
        }

        $last_activity = $post->post_date;
        if ( ! empty( $milestones ) ) {
            $last_ms       = end( $milestones );
            $last_activity = $last_ms['date'];
        }

        $now               = current_time( 'timestamp' );
        $last_ts           = strtotime( $last_activity );
        $days_since        = max( 0, (int) floor( ( $now - $last_ts ) / 86400 ) );
        $staleness_level   = $this->get_staleness_level( $days_since );

        $cadence           = get_post_meta( $post->ID, '_mm_cadence', true ) ?: 'none';
        $commitment_status = 'none';
        $commitment_days_remaining = null;

        if ( $cadence !== 'none' && isset( self::CADENCE_DAYS[ $cadence ] ) ) {
            $allowed = self::CADENCE_DAYS[ $cadence ];
            $ratio   = $days_since / max( 1, $allowed );

            if ( $ratio > 1.5 ) {
                $commitment_status = 'overdue';
            } elseif ( $ratio > 1.0 ) {
                $commitment_status = 'late';
            } elseif ( $ratio > 0.75 ) {
                $commitment_status = 'due_soon';
            } else {
                $commitment_status = 'on_track';
            }

            $commitment_days_remaining = $allowed - $days_since;
        }

        return array(
            'id'                        => $post->ID,
            'name'                      => $post->post_title,
            'status'                    => $post->post_status,
            'created'                   => $post->post_date,
            'end_in_mind'               => get_post_meta( $post->ID, '_mm_end_in_mind', true ),
            'rationale'                 => get_post_meta( $post->ID, '_mm_rationale', true ),
            'priority'                  => get_post_meta( $post->ID, '_mm_priority', true ) ?: 'medium',
            'category'                  => get_post_meta( $post->ID, '_mm_category', true ),
            'version'                   => get_post_meta( $post->ID, '_mm_version', true ) ?: '1.0',
            'cadence'                   => $cadence,
            'cadence_label'             => get_post_meta( $post->ID, '_mm_cadence_label', true ),
            'stale_days'                => (int) ( get_post_meta( $post->ID, '_mm_stale_days', true ) ?: 14 ),
            'milestones'                => $milestones,
            'last_activity'             => $last_activity,
            'days_since_activity'       => $days_since,
            'staleness_level'           => $staleness_level,
            'commitment_status'         => $commitment_status,
            'commitment_days_remaining' => $commitment_days_remaining,
        );
    }

    /**
     * Calculate staleness level from days since activity.
     */
    private function get_staleness_level( $days ) {
        if ( $days >= 30 ) {
            return 'critical';
        }
        if ( $days >= 14 ) {
            return 'warning';
        }
        if ( $days >= 7 ) {
            return 'notice';
        }
        return 'fresh';
    }

    /**
     * Calculate the next version string.
     */
    private function calculate_next_version( $current, $type ) {
        $parts = explode( '.', $current );
        $major = isset( $parts[0] ) ? (int) $parts[0] : 1;
        $minor = isset( $parts[1] ) ? (int) $parts[1] : 0;

        if ( $type === 'major' ) {
            $major++;
            $minor = 0;
        } else {
            $minor++;
        }

        return $major . '.' . $minor;
    }
}
