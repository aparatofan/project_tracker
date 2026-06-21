<?php
/**
 * Plugin Name: MM Project Tracker
 * Plugin URI:  https://mariuszmirecki.pl
 * Description: A personal project management tool — "Begin with the end in mind." (Covey Habit 2)
 * Version:     1.1.0
 * Author:      Mariusz Mirecki
 * Author URI:  https://mariuszmirecki.pl
 * Text Domain: mm-project-tracker
 * Requires PHP: 7.4
 * Requires at least: 6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'MMPT_VERSION', '1.1.0' );
define( 'MMPT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MMPT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once MMPT_PLUGIN_DIR . 'includes/class-cpt.php';
require_once MMPT_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once MMPT_PLUGIN_DIR . 'includes/class-shortcode.php';

/**
 * Initialize the plugin.
 */
function mmpt_init() {
    MMPT_CPT::register();
    MMPT_Shortcode::register();
}
add_action( 'init', 'mmpt_init' );

/**
 * Register REST API routes.
 */
function mmpt_rest_api_init() {
    $api = new MMPT_REST_API();
    $api->register_routes();
}
add_action( 'rest_api_init', 'mmpt_rest_api_init' );
