<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class MMPT_Shortcode {

    /**
     * Register the shortcode.
     */
    public static function register() {
        add_shortcode( 'mm_project_tracker', array( __CLASS__, 'render' ) );
    }

    /**
     * Render the shortcode output.
     */
    public static function render( $atts ) {
        if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
            ob_start();
            include MMPT_PLUGIN_DIR . 'templates/locked.php';
            return ob_get_clean();
        }

        wp_enqueue_style(
            'mmpt-tracker',
            MMPT_PLUGIN_URL . 'assets/css/tracker.css',
            array(),
            MMPT_VERSION
        );

        wp_enqueue_script(
            'mmpt-tracker',
            MMPT_PLUGIN_URL . 'assets/js/tracker.js',
            array(),
            MMPT_VERSION,
            true
        );

        wp_localize_script( 'mmpt-tracker', 'mmptData', array(
            'restUrl' => rest_url( 'mm-project-tracker/v1/' ),
            'nonce'   => wp_create_nonce( 'wp_rest' ),
        ) );

        ob_start();
        include MMPT_PLUGIN_DIR . 'templates/tracker.php';
        return ob_get_clean();
    }
}
