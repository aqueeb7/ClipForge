use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

pub fn setup_native_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&MenuItemBuilder::with_id("menu_new_project", "New Project...").accelerator("CmdOrCtrl+N").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_open_project", "Open Project...").accelerator("CmdOrCtrl+O").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_save_project", "Save Project").accelerator("CmdOrCtrl+S").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_save_as", "Save Project As...").accelerator("CmdOrCtrl+Shift+S").build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("menu_import_video", "Import Video Source...").accelerator("CmdOrCtrl+I").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_import_audio", "Import Audio Track...").accelerator("CmdOrCtrl+Shift+I").build(handle)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&MenuItemBuilder::with_id("menu_cut_intro", "Cut Intro Fluff at Playhead").accelerator("[").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_cut_outro", "Cut Outro Fluff at Playhead").accelerator("]").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_split_part", "Split Part at Playhead").accelerator("CmdOrCtrl+K").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_reset_trim", "Reset Trimming to Full Source").accelerator("CmdOrCtrl+R").build(handle)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&MenuItemBuilder::with_id("menu_view_media", "Media Pool Workspace").accelerator("F1").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_view_edit", "Edit & Studio Workspace").accelerator("F2").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_view_deliver", "Deliver & Export Workspace").accelerator("F3").build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("menu_toggle_sidebar", "Toggle Stream Tools Sidebar").accelerator("CmdOrCtrl+B").build(handle)?)
        .build()?;

    let render_menu = SubmenuBuilder::new(handle, "Render")
        .item(&MenuItemBuilder::with_id("menu_render_remaining", "Render Remaining Parts").accelerator("CmdOrCtrl+E").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_render_all", "Render All Parts").accelerator("CmdOrCtrl+Shift+E").build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("menu_clean_temp", "Clean Incomplete Files").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_open_exports", "Open Exports Directory").build(handle)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(handle, "Help")
        .item(&MenuItemBuilder::with_id("menu_shortcuts", "Keyboard Shortcuts...").build(handle)?)
        .item(&MenuItemBuilder::with_id("menu_diagnostics", "System & GPU Diagnostics...").build(handle)?)
        .build()?;

    let menu = MenuBuilder::new(handle)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&render_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app_handle, event| {
        let id_str = event.id().as_ref();
        let _ = app_handle.emit("native-menu-action", id_str);
    });

    Ok(())
}
