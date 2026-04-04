<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<style>
.mmpt-locked {
    max-width: 480px;
    margin: 60px auto;
    text-align: center;
    padding: 48px 32px;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 16px;
    font-family: inherit;
}
.mmpt-locked-icon {
    font-size: 48px;
    margin-bottom: 16px;
}
.mmpt-locked h2 {
    font-size: 24px;
    color: #1E293B;
    margin: 0 0 8px;
}
.mmpt-locked p {
    font-size: 15px;
    color: #64748B;
    margin: 0 0 24px;
}
.mmpt-locked-btn {
    display: inline-block;
    padding: 12px 32px;
    background: #3B82F6;
    color: #FFFFFF !important;
    text-decoration: none !important;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    transition: background 0.2s;
}
.mmpt-locked-btn:hover {
    background: #2563EB;
}
</style>
<div class="mmpt-locked">
    <div class="mmpt-locked-icon">&#128274;</div>
    <h2>Private Projects</h2>
    <p>This page is only visible to logged-in users.</p>
    <a href="<?php echo esc_url( wp_login_url( get_permalink() ) ); ?>" class="mmpt-locked-btn">Log In</a>
</div>
