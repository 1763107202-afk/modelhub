use tauri::{
    webview::NewWindowResponse,
    WebviewUrl, WebviewWindowBuilder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let start_url = "https://1763107202-afk.github.io/modelhub/"
                .parse()
                .expect("invalid desktop start URL");

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start_url))
                .title("江苏科技大学机械创新实验室交流平台")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1050.0, 700.0)
                .center()
                .resizable(true)
                .fullscreen(false)
                .on_new_window(|url, _features| {
                    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
                        if let Err(error) =
                            tauri_plugin_opener::open_url(url.as_str(), None::<&str>)
                        {
                            eprintln!("failed to open external URL {url}: {error}");
                        }
                    }

                    NewWindowResponse::Deny
                })
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 江苏科技大学机械创新实验室交流平台");
}
