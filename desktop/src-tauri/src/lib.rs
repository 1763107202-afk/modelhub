use tauri::{
    webview::NewWindowResponse,
    WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;

const PLATFORM_HOST: &str = "1763107202-afk.github.io";
const PLATFORM_PREFIX: &str = "/modelhub";
const DESKTOP_OPEN_PATH: &str = "/modelhub/__desktop_open__";

const DESKTOP_LINK_BRIDGE: &str = r#"
(() => {
  const PLATFORM_HOST = "1763107202-afk.github.io";
  const PLATFORM_PREFIX = "/modelhub";
  const BRIDGE_PATH = "/modelhub/__desktop_open__";

  const toUrl = (value) => {
    try { return new URL(String(value || ""), window.location.href); }
    catch (_) { return null; }
  };

  const sendToSystem = (value) => {
    const target = toUrl(value);
    if (!target) return false;
    if (!["http:", "https:", "mailto:", "tel:"].includes(target.protocol)) return false;

    const bridge = new URL(BRIDGE_PATH, "https://" + PLATFORM_HOST);
    bridge.searchParams.set("url", target.href);
    window.location.assign(bridge.href);
    return true;
  };

  const isPlatformUrl = (url) =>
    url.protocol === "https:" &&
    url.hostname === PLATFORM_HOST &&
    url.pathname.startsWith(PLATFORM_PREFIX);

  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest
      ? event.target.closest("a[href]")
      : null;
    if (!anchor) return;

    const target = toUrl(anchor.href);
    if (!target) return;

    const shouldOpenOutside =
      anchor.target === "_blank" ||
      anchor.hasAttribute("download") ||
      !isPlatformUrl(target);

    if (!shouldOpenOutside) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    sendToSystem(target.href);
  }, true);

  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    if (url && sendToSystem(url)) return null;
    return nativeOpen(url, target, features);
  };
})();
"#;

fn is_platform_url(url: &tauri::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some(PLATFORM_HOST)
        && url.path().starts_with(PLATFORM_PREFIX)
}

fn open_system_url<R: tauri::Runtime>(app: &tauri::AppHandle<R>, target: &str) {
    if let Err(error) = app.opener().open_url(target, None::<&str>) {
        eprintln!("failed to open external URL {target}: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let start_url = "https://1763107202-afk.github.io/modelhub/?desktop=1"
                .parse()
                .expect("invalid desktop start URL");

            let navigation_app = app.handle().clone();
            let new_window_app = app.handle().clone();

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start_url))
                .title("江苏科技大学机械创新实验室交流平台")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1050.0, 700.0)
                .center()
                .resizable(true)
                .fullscreen(false)
                .initialization_script(DESKTOP_LINK_BRIDGE)
                .on_navigation(move |url| {
                    if url.scheme() == "https"
                        && url.host_str() == Some(PLATFORM_HOST)
                        && url.path() == DESKTOP_OPEN_PATH
                    {
                        if let Some((_, target)) =
                            url.query_pairs().find(|(key, _)| key == "url")
                        {
                            open_system_url(&navigation_app, target.as_ref());
                        }
                        return false;
                    }

                    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel")
                        && !is_platform_url(url)
                    {
                        open_system_url(&navigation_app, url.as_str());
                        return false;
                    }

                    true
                })
                .on_new_window(move |url, _features| {
                    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
                        open_system_url(&new_window_app, url.as_str());
                    }

                    NewWindowResponse::Deny
                })
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 江苏科技大学机械创新实验室交流平台");
}
