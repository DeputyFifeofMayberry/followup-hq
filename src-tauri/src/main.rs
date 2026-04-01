#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Default)]
struct OutlookLoopbackState {
    redirect_uri: Option<String>,
    callback_url: Option<String>,
    listening: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineEvent {
    id: String,
    at: String,
    #[serde(rename = "type")]
    event_type: String,
    summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FollowUpItem {
    id: String,
    title: String,
    source: String,
    project: String,
    owner: String,
    status: String,
    priority: String,
    due_date: String,
    promised_date: Option<String>,
    last_touch_date: String,
    next_touch_date: String,
    last_nudged_at: Option<String>,
    snoozed_until_date: Option<String>,
    next_action: String,
    summary: String,
    tags: Vec<String>,
    source_ref: String,
    source_refs: Vec<String>,
    merged_item_ids: Vec<String>,
    waiting_on: Option<String>,
    notes: String,
    timeline: Vec<TimelineEvent>,
    category: String,
    owes_next_action: String,
    escalation_level: String,
    cadence_days: i64,
    contact_id: Option<String>,
    company_id: Option<String>,
    thread_key: Option<String>,
    draft_follow_up: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContactRecord {
    id: String,
    name: String,
    email: Option<String>,
    phone: Option<String>,
    company_id: Option<String>,
    role: String,
    notes: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompanyRecord {
    id: String,
    name: String,
    #[serde(rename = "type")]
    company_type: String,
    notes: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DroppedEmailImport {
    id: String,
    file_name: String,
    format: String,
    subject: String,
    from: String,
    to_recipients: Vec<String>,
    cc_recipients: Vec<String>,
    sent_at: Option<String>,
    body_preview: String,
    source_ref: String,
    project_hint: String,
    parse_quality: String,
    parse_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IntakeSignal {
    id: String,
    source: String,
    title: String,
    detail: String,
    urgency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookConnectionSettings {
    client_id: String,
    tenant_id: String,
    redirect_uri: String,
    scopes: Vec<String>,
    sync_limit: i64,
    auto_pull_sent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookAuthSession {
    pkce_verifier: String,
    state: String,
    auth_url: String,
    started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookMailboxProfile {
    user_id: String,
    display_name: String,
    email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookTokenSet {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: String,
    acquired_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct OutlookFolderSyncState {
    delta_link: Option<String>,
    last_folder_sync_at: Option<String>,
    last_message_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookSyncCursorByFolder {
    inbox: OutlookFolderSyncState,
    sentitems: OutlookFolderSyncState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookConnectionState {
    settings: OutlookConnectionSettings,
    auth_session: Option<OutlookAuthSession>,
    profile: Option<OutlookMailboxProfile>,
    tokens: Option<OutlookTokenSet>,
    mailbox_linked: bool,
    last_sync_at: Option<String>,
    last_error: Option<String>,
    sync_status: String,
    sync_cursor_by_folder: OutlookSyncCursorByFolder,
    last_sync_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlookMessage {
    id: String,
    internet_message_id: Option<String>,
    conversation_id: Option<String>,
    subject: String,
    body_preview: String,
    from: String,
    to_recipients: Vec<String>,
    cc_recipients: Vec<String>,
    received_date_time: Option<String>,
    sent_date_time: Option<String>,
    is_read: bool,
    importance: String,
    has_attachments: bool,
    categories: Vec<String>,
    flag_status: Option<String>,
    web_link: Option<String>,
    folder: String,
    source_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSnapshot {
    items: Vec<FollowUpItem>,
    contacts: Vec<ContactRecord>,
    companies: Vec<CompanyRecord>,
    intake_signals: Vec<IntakeSignal>,
    dismissed_duplicate_pairs: Vec<String>,
    dropped_email_imports: Vec<DroppedEmailImport>,
    outlook_connection: OutlookConnectionState,
    outlook_messages: Vec<OutlookMessage>,
}

fn default_outlook_connection() -> OutlookConnectionState {
    OutlookConnectionState {
        settings: OutlookConnectionSettings {
            client_id: String::new(),
            tenant_id: "common".to_string(),
            redirect_uri: "http://localhost".to_string(),
            scopes: vec![
                "openid".to_string(),
                "profile".to_string(),
                "offline_access".to_string(),
                "User.Read".to_string(),
                "Mail.Read".to_string(),
            ],
            sync_limit: 15,
            auto_pull_sent: true,
        },
        auth_session: None,
        profile: None,
        tokens: None,
        mailbox_linked: false,
        last_sync_at: None,
        last_error: None,
        sync_status: "idle".to_string(),
        sync_cursor_by_folder: OutlookSyncCursorByFolder {
            inbox: OutlookFolderSyncState::default(),
            sentitems: OutlookFolderSyncState::default(),
        },
        last_sync_mode: None,
    }
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push("followup_hq.sqlite3");
    Ok(dir)
}

fn apply_item_migrations(conn: &Connection) -> Result<(), String> {
    let migrations = [
        "ALTER TABLE items ADD COLUMN promised_date TEXT",
        "ALTER TABLE items ADD COLUMN next_touch_date TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE items ADD COLUMN last_nudged_at TEXT",
        "ALTER TABLE items ADD COLUMN snoozed_until_date TEXT",
        "ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT 'General'",
        "ALTER TABLE items ADD COLUMN owes_next_action TEXT NOT NULL DEFAULT 'Unknown'",
        "ALTER TABLE items ADD COLUMN escalation_level TEXT NOT NULL DEFAULT 'None'",
        "ALTER TABLE items ADD COLUMN cadence_days INTEGER NOT NULL DEFAULT 3",
        "ALTER TABLE items ADD COLUMN contact_id TEXT",
        "ALTER TABLE items ADD COLUMN company_id TEXT",
        "ALTER TABLE items ADD COLUMN thread_key TEXT",
        "ALTER TABLE items ADD COLUMN draft_follow_up TEXT",
    ];

    for migration in migrations {
        match conn.execute(migration, []) {
            Ok(_) => {}
            Err(error) if error.to_string().contains("duplicate column name") => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            project TEXT NOT NULL,
            owner TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            due_date TEXT NOT NULL,
            promised_date TEXT,
            last_touch_date TEXT NOT NULL,
            next_touch_date TEXT NOT NULL DEFAULT '',
            last_nudged_at TEXT,
            snoozed_until_date TEXT,
            next_action TEXT NOT NULL,
            summary TEXT NOT NULL,
            tags_json TEXT NOT NULL,
            source_ref TEXT NOT NULL,
            source_refs_json TEXT NOT NULL DEFAULT '[]',
            merged_item_ids_json TEXT NOT NULL DEFAULT '[]',
            waiting_on TEXT,
            notes TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            owes_next_action TEXT NOT NULL DEFAULT 'Unknown',
            escalation_level TEXT NOT NULL DEFAULT 'None',
            cadence_days INTEGER NOT NULL DEFAULT 3,
            contact_id TEXT,
            company_id TEXT,
            thread_key TEXT,
            draft_follow_up TEXT
        );
        CREATE TABLE IF NOT EXISTS timeline_events (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            at TEXT NOT NULL,
            event_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS intake_signals (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT NOT NULL,
            urgency TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dismissed_duplicate_pairs (
            pair_key TEXT PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outlook_messages (
            id TEXT PRIMARY KEY,
            internet_message_id TEXT,
            conversation_id TEXT,
            subject TEXT NOT NULL,
            body_preview TEXT NOT NULL,
            from_json TEXT NOT NULL,
            to_recipients_json TEXT NOT NULL,
            cc_recipients_json TEXT NOT NULL,
            received_date_time TEXT,
            sent_date_time TEXT,
            is_read INTEGER NOT NULL,
            importance TEXT NOT NULL,
            has_attachments INTEGER NOT NULL,
            categories_json TEXT NOT NULL,
            flag_status TEXT,
            web_link TEXT,
            folder TEXT NOT NULL,
            source_ref TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
    apply_item_migrations(&conn)?;
    Ok(conn)
}

#[tauri::command]
fn start_outlook_loopback_listener(loopback_state: State<Arc<Mutex<OutlookLoopbackState>>>) -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind Outlook callback listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read Outlook callback port: {e}"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    {
        let mut state = loopback_state.lock().map_err(|_| "Failed to lock Outlook callback state.".to_string())?;
        state.redirect_uri = Some(redirect_uri.clone());
        state.callback_url = None;
        state.listening = true;
    }

    let shared_state = loopback_state.inner().clone();
    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buffer = [0_u8; 4096];
            let bytes_read = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
            let request_line = request.lines().next().unwrap_or_default();
            let path = request_line.split_whitespace().nth(1).unwrap_or("/");
            let callback_url = format!("http://127.0.0.1:{port}{path}");

            if let Ok(mut state) = shared_state.lock() {
                state.callback_url = Some(callback_url);
                state.listening = false;
            }

            let html = r#"<!doctype html>
<html>
  <head><meta charset=\"utf-8\"><title>FollowUp HQ</title></head>
  <body style=\"font-family:Segoe UI, Arial, sans-serif; padding:32px; background:#f8fafc; color:#0f172a;\">
    <h2 style=\"margin:0 0 12px 0;\">Outlook sign-in complete</h2>
    <p style=\"margin:0;\">You can close this browser window and return to FollowUp HQ.</p>
  </body>
</html>"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(),
                html
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();
        }

        if let Ok(mut state) = shared_state.lock() {
            state.listening = false;
        }
    });

    Ok(redirect_uri)
}

#[tauri::command]
fn read_outlook_loopback_callback(loopback_state: State<Arc<Mutex<OutlookLoopbackState>>>) -> Result<Option<String>, String> {
    let state = loopback_state.lock().map_err(|_| "Failed to lock Outlook callback state.".to_string())?;
    Ok(state.callback_url.clone())
}

#[tauri::command]
fn clear_outlook_loopback_callback(loopback_state: State<Arc<Mutex<OutlookLoopbackState>>>) -> Result<(), String> {
    let mut state = loopback_state.lock().map_err(|_| "Failed to lock Outlook callback state.".to_string())?;
    state.callback_url = None;
    state.redirect_uri = None;
    state.listening = false;
    Ok(())
}

#[tauri::command]
fn load_snapshot(app: AppHandle) -> Result<AppSnapshot, String> {
    let conn = open_db(&app)?;
    let mut items_stmt = conn
        .prepare(
            r#"SELECT id, title, source, project, owner, status, priority, due_date, promised_date, last_touch_date, next_touch_date,
               last_nudged_at, snoozed_until_date, next_action, summary, tags_json, source_ref,
               COALESCE(source_refs_json, '[]'), COALESCE(merged_item_ids_json, '[]'), waiting_on, notes,
               COALESCE(category, 'General'), COALESCE(owes_next_action, 'Unknown'), COALESCE(escalation_level, 'None'),
               COALESCE(cadence_days, 3), contact_id, company_id, thread_key, draft_follow_up
               FROM items
               ORDER BY last_touch_date DESC, due_date ASC"#,
        )
        .map_err(|e| e.to_string())?;

    let item_rows = items_stmt
        .query_map([], |row| {
            let tags_json: String = row.get(15)?;
            let source_refs_json: String = row.get(17)?;
            let merged_item_ids_json: String = row.get(18)?;
            Ok(FollowUpItem {
                id: row.get(0)?,
                title: row.get(1)?,
                source: row.get(2)?,
                project: row.get(3)?,
                owner: row.get(4)?,
                status: row.get(5)?,
                priority: row.get(6)?,
                due_date: row.get(7)?,
                promised_date: row.get(8)?,
                last_touch_date: row.get(9)?,
                next_touch_date: row.get(10)?,
                last_nudged_at: row.get(11)?,
                snoozed_until_date: row.get(12)?,
                next_action: row.get(13)?,
                summary: row.get(14)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                source_ref: row.get(16)?,
                source_refs: serde_json::from_str(&source_refs_json).unwrap_or_default(),
                merged_item_ids: serde_json::from_str(&merged_item_ids_json).unwrap_or_default(),
                waiting_on: row.get(19)?,
                notes: row.get(20)?,
                category: row.get(21)?,
                owes_next_action: row.get(22)?,
                escalation_level: row.get(23)?,
                cadence_days: row.get(24)?,
                contact_id: row.get(25)?,
                company_id: row.get(26)?,
                thread_key: row.get(27)?,
                draft_follow_up: row.get(28)?,
                timeline: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items: Vec<FollowUpItem> = Vec::new();
    for item_result in item_rows {
        items.push(item_result.map_err(|e| e.to_string())?);
    }

    let mut timeline_stmt = conn
        .prepare(r#"SELECT id, item_id, at, event_type, summary FROM timeline_events ORDER BY at DESC"#)
        .map_err(|e| e.to_string())?;
    let timeline_rows = timeline_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?,
                TimelineEvent {
                    id: row.get(0)?,
                    at: row.get(2)?,
                    event_type: row.get(3)?,
                    summary: row.get(4)?,
                },
            ))
        })
        .map_err(|e| e.to_string())?;

    for event_result in timeline_rows {
        let (item_id, event) = event_result.map_err(|e| e.to_string())?;
        if let Some(item) = items.iter_mut().find(|entry| entry.id == item_id) {
            item.timeline.push(event);
        }
    }

    let mut signals_stmt = conn
        .prepare("SELECT id, source, title, detail, urgency FROM intake_signals ORDER BY id")
        .map_err(|e| e.to_string())?;
    let signal_rows = signals_stmt
        .query_map([], |row| {
            Ok(IntakeSignal {
                id: row.get(0)?,
                source: row.get(1)?,
                title: row.get(2)?,
                detail: row.get(3)?,
                urgency: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut intake_signals = Vec::new();
    for signal_result in signal_rows {
        intake_signals.push(signal_result.map_err(|e| e.to_string())?);
    }

    let mut duplicate_stmt = conn
        .prepare("SELECT pair_key FROM dismissed_duplicate_pairs ORDER BY pair_key")
        .map_err(|e| e.to_string())?;
    let duplicate_rows = duplicate_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut dismissed_duplicate_pairs = Vec::new();
    for pair_result in duplicate_rows {
        dismissed_duplicate_pairs.push(pair_result.map_err(|e| e.to_string())?);
    }

    let dropped_email_imports = conn
        .query_row(
            "SELECT value_json FROM app_kv WHERE key = 'dropped_email_imports'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|json| serde_json::from_str::<Vec<DroppedEmailImport>>(&json).ok())
        .unwrap_or_default();

    let contacts = conn
        .query_row(
            "SELECT value_json FROM app_kv WHERE key = 'contacts'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|json| serde_json::from_str::<Vec<ContactRecord>>(&json).ok())
        .unwrap_or_default();

    let companies = conn
        .query_row(
            "SELECT value_json FROM app_kv WHERE key = 'companies'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|json| serde_json::from_str::<Vec<CompanyRecord>>(&json).ok())
        .unwrap_or_default();

    let outlook_connection = conn
        .query_row(
            "SELECT value_json FROM app_kv WHERE key = 'outlook_connection'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|json| {
            let mut value = serde_json::from_str::<serde_json::Value>(&json).ok()?;
            if value.get("syncCursorByFolder").is_none() {
                value["syncCursorByFolder"] = serde_json::json!({ "inbox": {}, "sentitems": {} });
            }
            serde_json::from_value::<OutlookConnectionState>(value).ok()
        })
        .unwrap_or_else(default_outlook_connection);

    let mut messages_stmt = conn
        .prepare(
            r#"SELECT id, internet_message_id, conversation_id, subject, body_preview, from_json, to_recipients_json,
               cc_recipients_json, received_date_time, sent_date_time, is_read, importance, has_attachments,
               categories_json, flag_status, web_link, folder, source_ref
               FROM outlook_messages
               ORDER BY COALESCE(received_date_time, sent_date_time) DESC"#,
        )
        .map_err(|e| e.to_string())?;
    let message_rows = messages_stmt
        .query_map([], |row| {
            let to_json: String = row.get(6)?;
            let cc_json: String = row.get(7)?;
            let categories_json: String = row.get(13)?;
            Ok(OutlookMessage {
                id: row.get(0)?,
                internet_message_id: row.get(1)?,
                conversation_id: row.get(2)?,
                subject: row.get(3)?,
                body_preview: row.get(4)?,
                from: row.get(5)?,
                to_recipients: serde_json::from_str(&to_json).unwrap_or_default(),
                cc_recipients: serde_json::from_str(&cc_json).unwrap_or_default(),
                received_date_time: row.get(8)?,
                sent_date_time: row.get(9)?,
                is_read: row.get::<_, i64>(10)? == 1,
                importance: row.get(11)?,
                has_attachments: row.get::<_, i64>(12)? == 1,
                categories: serde_json::from_str(&categories_json).unwrap_or_default(),
                flag_status: row.get(14)?,
                web_link: row.get(15)?,
                folder: row.get(16)?,
                source_ref: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut outlook_messages = Vec::new();
    for message_result in message_rows {
        outlook_messages.push(message_result.map_err(|e| e.to_string())?);
    }

    Ok(AppSnapshot {
        items,
        contacts,
        companies,
        intake_signals,
        dismissed_duplicate_pairs,
        dropped_email_imports,
        outlook_connection,
        outlook_messages,
    })
}

#[tauri::command]
fn save_snapshot(app: AppHandle, snapshot: AppSnapshot) -> Result<(), String> {
    let mut conn = open_db(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM timeline_events", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM items", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM intake_signals", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM dismissed_duplicate_pairs", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM outlook_messages", []).map_err(|e| e.to_string())?;

    for item in snapshot.items {
        tx.execute(
            r#"INSERT INTO items (id, title, source, project, owner, status, priority, due_date, promised_date, last_touch_date, next_touch_date, last_nudged_at, snoozed_until_date, next_action, summary, tags_json, source_ref, source_refs_json, merged_item_ids_json, waiting_on, notes, category, owes_next_action, escalation_level, cadence_days, contact_id, company_id, thread_key, draft_follow_up)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29)"#,
            params![
                item.id,
                item.title,
                item.source,
                item.project,
                item.owner,
                item.status,
                item.priority,
                item.due_date,
                item.promised_date,
                item.last_touch_date,
                item.next_touch_date,
                item.last_nudged_at,
                item.snoozed_until_date,
                item.next_action,
                item.summary,
                serde_json::to_string(&item.tags).map_err(|e| e.to_string())?,
                item.source_ref,
                serde_json::to_string(&item.source_refs).map_err(|e| e.to_string())?,
                serde_json::to_string(&item.merged_item_ids).map_err(|e| e.to_string())?,
                item.waiting_on,
                item.notes,
                item.category,
                item.owes_next_action,
                item.escalation_level,
                item.cadence_days,
                item.contact_id,
                item.company_id,
                item.thread_key,
                item.draft_follow_up,
            ],
        )
        .map_err(|e| e.to_string())?;

        for event in item.timeline {
            tx.execute(
                r#"INSERT INTO timeline_events (id, item_id, at, event_type, summary) VALUES (?1, ?2, ?3, ?4, ?5)"#,
                params![event.id, item.id, event.at, event.event_type, event.summary],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    for signal in snapshot.intake_signals {
        tx.execute(
            r#"INSERT INTO intake_signals (id, source, title, detail, urgency) VALUES (?1, ?2, ?3, ?4, ?5)"#,
            params![signal.id, signal.source, signal.title, signal.detail, signal.urgency],
        )
        .map_err(|e| e.to_string())?;
    }

    for pair_key in snapshot.dismissed_duplicate_pairs {
        tx.execute(
            "INSERT INTO dismissed_duplicate_pairs (pair_key) VALUES (?1)",
            params![pair_key],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT OR REPLACE INTO app_kv (key, value_json) VALUES ('dropped_email_imports', ?1)",
        params![serde_json::to_string(&snapshot.dropped_email_imports).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT OR REPLACE INTO app_kv (key, value_json) VALUES ('contacts', ?1)",
        params![serde_json::to_string(&snapshot.contacts).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT OR REPLACE INTO app_kv (key, value_json) VALUES ('companies', ?1)",
        params![serde_json::to_string(&snapshot.companies).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT OR REPLACE INTO app_kv (key, value_json) VALUES ('outlook_connection', ?1)",
        params![serde_json::to_string(&snapshot.outlook_connection).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;

    for message in snapshot.outlook_messages {
        tx.execute(
            r#"INSERT INTO outlook_messages (id, internet_message_id, conversation_id, subject, body_preview, from_json, to_recipients_json, cc_recipients_json, received_date_time, sent_date_time, is_read, importance, has_attachments, categories_json, flag_status, web_link, folder, source_ref)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)"#,
            params![
                message.id,
                message.internet_message_id,
                message.conversation_id,
                message.subject,
                message.body_preview,
                message.from,
                serde_json::to_string(&message.to_recipients).map_err(|e| e.to_string())?,
                serde_json::to_string(&message.cc_recipients).map_err(|e| e.to_string())?,
                message.received_date_time,
                message.sent_date_time,
                if message.is_read { 1 } else { 0 },
                message.importance,
                if message.has_attachments { 1 } else { 0 },
                serde_json::to_string(&message.categories).map_err(|e| e.to_string())?,
                message.flag_status,
                message.web_link,
                message.folder,
                message.source_ref,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(OutlookLoopbackState::default())))
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_snapshot,
            start_outlook_loopback_listener,
            read_outlook_loopback_callback,
            clear_outlook_loopback_callback
        ])
        .run(tauri::generate_context!())
        .expect("error while running FollowUp HQ");
}
