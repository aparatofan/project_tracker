<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMPT_CPT {

    /**
     * Register the mm_project custom post type.
     */
    public static function register() {
        register_post_type( 'mm_project', array(
            'labels'       => array(
                'name'          => 'Projects',
                'singular_name' => 'Project',
            ),
            'public'       => false,
            'show_ui'      => false,
            'show_in_rest' => false,
            'supports'     => array( 'title' ),
            'capability_type' => 'post',
        ) );
    }
}
