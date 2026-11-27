//! 命令行读数工具：打印摄像头／麦克风占用情况（JSON），并可作为常驻读数程序。
//!
//! 用法：
//!   device_use.exe                       读一次，写默认数据文件
//!   device_use.exe --watch 2             每 2 秒持续刷新（插件取数用）
//!   device_use.exe --install-startup     显式安装开机自启（写当前用户 HKCU Run 键，指向本程序 --watch 2）
//!   device_use.exe --uninstall-startup   显式卸载开机自启
//!   device_use.exe --verbose             额外打印注册表原始明细（排障用）
//!   device_use.exe -o <path>             指定输出文件

mod device_use;
mod registry;

use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn json_string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn users_json(names: &[String]) -> String {
    let items: Vec<String> = names
        .iter()
        .map(|name| format!("{{\"name\":{}}}", json_string(name)))
        .collect();
    format!("[{}]", items.join(","))
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0)
}

/// 默认数据文件位置：%LOCALAPPDATA%\IslandPrivacy\devices.json
fn default_path() -> String {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    format!("{}\\IslandPrivacy\\devices.json", base)
}

/// 生成一份占用读数 JSON（带 updated_at）。
fn report_json() -> String {
    let report = device_use::read_all();
    format!(
        "{{\"camera\":{},\"microphone\":{},\"updated_at\":{}}}\n",
        users_json(&report.camera),
        users_json(&report.microphone),
        now_seconds()
    )
}

fn write_report(target: &str) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(target).parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录 {} 失败：{}", parent.display(), e))?;
        }
    }
    let json = report_json();
    std::fs::write(target, json.as_bytes()).map_err(|e| format!("写入 {} 失败：{}", target, e))?;
    print!("{}", json);
    Ok(())
}

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "IslandPrivacy-device_use";

/// 显式安装开机自启：用 reg.exe 写当前用户 Run 键，指向本程序自身 --watch 2。
/// 不写启动文件夹（避开 Defender 的 LNK 启发式），不要管理员，由用户主动触发。
fn install_startup() -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("取不到程序自身路径：{}", e))?
        .to_string_lossy()
        .to_string();
    let data = format!("\"{}\" --watch 2", exe);
    let status = Command::new("reg")
        .args([
            "add",
            RUN_KEY,
            "/v",
            RUN_VALUE,
            "/t",
            "REG_SZ",
            "/d",
            &data,
            "/f",
        ])
        .status()
        .map_err(|e| format!("调用 reg.exe 失败：{}", e))?;
    if status.success() {
        println!("已安装开机自启：{}", data);
        Ok(())
    } else {
        Err("reg add 失败（可能被安全软件拦截或权限不足）".to_string())
    }
}

fn uninstall_startup() -> Result<(), String> {
    let status = Command::new("reg")
        .args(["delete", RUN_KEY, "/v", RUN_VALUE, "/f"])
        .status()
        .map_err(|e| format!("调用 reg.exe 失败：{}", e))?;
    if status.success() {
        println!("已卸载开机自启。");
        Ok(())
    } else {
        Err("reg delete 失败（可能本就未安装）".to_string())
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut verbose = false;
    let mut output: Option<String> = None;
    let mut watch: Option<u64> = None;
    let mut install = false;
    let mut uninstall = false;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--verbose" => verbose = true,
            "-o" | "--output" => {
                index += 1;
                if index < args.len() {
                    output = Some(args[index].clone());
                }
            }
            "--watch" => {
                index += 1;
                watch = args
                    .get(index)
                    .and_then(|v| v.parse::<u64>().ok())
                    .filter(|v| *v > 0);
            }
            "--install-startup" => install = true,
            "--uninstall-startup" => uninstall = true,
            _ => {}
        }
        index += 1;
    }

    if install {
        if let Err(e) = install_startup() {
            eprintln!("{}", e);
            std::process::exit(1);
        }
        return;
    }
    if uninstall {
        if let Err(e) = uninstall_startup() {
            eprintln!("{}", e);
            std::process::exit(1);
        }
        return;
    }

    if verbose {
        for device in [device_use::DEVICE_CAMERA, device_use::DEVICE_MICROPHONE] {
            eprintln!("== {} ==", device);
            for (key, packaged, start, stop) in device_use::read_raw(device) {
                eprintln!(
                    "  [{}] start={:?} stop={:?} key={}",
                    if packaged { "packaged" } else { "nonpackaged" },
                    start,
                    stop,
                    key
                );
            }
        }
    }

    let target = output.unwrap_or_else(default_path);

    match watch {
        Some(secs) => loop {
            if let Err(e) = write_report(&target) {
                eprintln!("{}", e);
                std::process::exit(1);
            }
            std::thread::sleep(Duration::from_secs(secs));
        },
        None => {
            if let Err(e) = write_report(&target) {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
    }
}
