use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

const API_PORT: u16 = 8000;

/// Vérifie si un processus écoute déjà sur le port API.
fn port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Sur macOS / Linux : kill tous les processus dont la commande contient
/// "enastic-api" (laissés par une session précédente qui n'aurait pas été
/// fermée proprement). Ignore les erreurs silencieusement.
#[cfg(unix)]
fn kill_orphan_api_processes() {
    let _ = Command::new("pkill").args(["-9", "-f", "enastic-api"]).status();
}

/// Sur Windows : taskkill /F /IM enastic-api.exe
#[cfg(windows)]
fn kill_orphan_api_processes() {
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "enastic-api.exe"])
        .status();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 1) Si le port est déjà occupé (zombie d'une session précédente),
            //    on tue d'abord toutes les instances orphelines.
            if port_in_use(API_PORT) {
                log::warn!("Port {API_PORT} déjà utilisé — nettoyage des processus orphelins.");
                kill_orphan_api_processes();
                // Petite pause pour que l'OS libère le port
                std::thread::sleep(Duration::from_millis(500));
            }

            // 2) Démarrer l'API embarquée (sidecar PyInstaller)
            let sidecar = app
                .shell()
                .sidecar("enastic-api")
                .expect("failed to create sidecar command");
            let (mut rx, child) = sidecar.spawn().expect("failed to spawn enastic-api sidecar");

            app.manage(SidecarChild(std::sync::Mutex::new(Some(child))));

            // Drain stdout/stderr en arrière-plan
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            log::info!("[api] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            log::info!("[api] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            log::warn!("[api] terminated: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Capturer TOUS les événements terminant l'app, pas juste la fermeture de fenêtre.
            // C'est plus robuste que on_window_event(CloseRequested).
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<SidecarChild>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
                // Filet de sécurité : tuer tout enastic-api restant
                kill_orphan_api_processes();
            }
        });
}

struct SidecarChild(std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>);
