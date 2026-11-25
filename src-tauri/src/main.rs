#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Prevent WebView2 window occlusion and MPO (Multi-Plane Overlay) flicker on hybrid GPU laptops (Intel + NVIDIA)
        if std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_err() {
            std::env::set_var(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--disable-features=CalculateNativeWinOcclusion --disable-direct-composition-video-overlays",
            );
        }
    }

    clipforge_lib::run();
}
