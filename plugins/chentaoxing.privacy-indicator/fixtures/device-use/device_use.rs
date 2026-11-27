//! Windows 摄像头／麦克风占用读数层（独立实现）。
//!
//! 数据源：Windows 自己写的占用账本
//! `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\{webcam|microphone}`。
//!
//! 本文件为独立编写，只依据公开的 Windows 行为说明与本机实测，
//! 未复制任何第三方（AGPL-3.0）项目的代码。
//!
//! 分层：
//!   - 本文件：纯逻辑（名称解析、在用判定、排序去重）＋ 注册表读取调度，可单测；
//!   - `registry.rs`：advapi32 只读访问，不含业务判断。

use crate::registry::{self, RawEntry};

/// ConsentStore 在 HKCU 下的相对路径。
pub const CONSENT_STORE: &str =
    r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore";

/// 非打包应用子键名。
pub const NON_PACKAGED: &str = "NonPackaged";

/// 摄像头设备键名。
pub const DEVICE_CAMERA: &str = "webcam";

/// 麦克风设备键名。
pub const DEVICE_MICROPHONE: &str = "microphone";

/// 整份读数结果，形状与插件侧 `input.devices` 一致。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DeviceUseReport {
    pub camera: Vec<String>,
    pub microphone: Vec<String>,
}

/// 在用判定：`LastUsedTimeStart` 存在且大于 0，同时 `LastUsedTimeStop` 等于 0。
///
/// 取值缺失一律按"不占用"处理：宁可少报一次，也不能把读不到当成正在使用。
/// Windows 只在设备释放时写 `Stop`，`Stop` 为 0 表示这一次占用还没结束。
pub fn in_use(start: Option<u64>, stop: Option<u64>) -> bool {
    matches!(start, Some(value) if value > 0) && stop == Some(0)
}

/// 打包应用的显示名：`<PackageFamilyName>_<PublisherId>` → 取家族名中第一个 `.` 之后的半段。
///
/// `OpenAI.Codex_2p2nqsd0c76g0` → `Codex`
/// `Microsoft.WindowsCamera_8wekyb3d8bbwe` → `WindowsCamera`
/// 家族名本身不带点时整段使用（真机存在 `Claude_pzs8sxrjxfjjc` 这种写法）。
pub fn packaged_label(key: &str) -> Option<String> {
    let (family, _publisher) = key.rsplit_once('_')?;
    let tail = match family.split_once('.') {
        Some((_prefix, tail)) => tail,
        None => family,
    };
    clean_label(tail)
}

/// 非打包应用的显示名：编码路径取末段，去掉扩展名。
///
/// `C:#Program Files#Zoom#bin#Zoom.exe` → `Zoom`
/// `C:\app\Thing.exe` → `Thing`
pub fn non_packaged_label(key: &str) -> Option<String> {
    let tail = key
        .rsplit(|c| c == '#' || c == '\\' || c == '/')
        .find(|part| !part.is_empty())?;
    let stem = match tail.rsplit_once('.') {
        Some((head, ext)) if !head.is_empty() && ext.chars().all(|c| c.is_ascii_alphanumeric()) => head,
        // 只有扩展名（`.exe`）或扩展名异常 → 取不到名字
        Some(_) => "",
        None => tail,
    };
    clean_label(stem.trim_start_matches('.'))
}

/// 清理显示名：去掉首尾空白，丢弃空名与含控制字符的乱码名。
fn clean_label(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.chars().any(|c| c.is_control()) {
        return None;
    }
    Some(trimmed.to_string())
}

/// 按类型取名并过滤掉无法解析的键。
fn label_for(key: &str, packaged: bool) -> Option<String> {
    if packaged {
        packaged_label(key)
    } else {
        non_packaged_label(key)
    }
}

/// 从一组原始记录里挑出正在占用的程序名，按小写排序并按小写去重。
pub fn collect_names(entries: &[RawEntry], packaged: bool) -> Vec<String> {
    let mut names: Vec<String> = entries
        .iter()
        .filter(|entry| in_use(entry.start, entry.stop))
        .filter_map(|entry| label_for(&entry.key, packaged))
        .collect();
    names.sort_by_key(|name| name.to_lowercase());
    let mut out: Vec<String> = Vec::with_capacity(names.len());
    for name in names {
        let key = name.to_lowercase();
        if out
            .last()
            .map(|last: &String| last.to_lowercase() != key)
            .unwrap_or(true)
        {
            out.push(name);
        }
    }
    out
}

/// 读取一个设备键下的全部记录（含打包与非打包两支）。
fn read_device_entries(device: &str) -> Vec<(RawEntry, bool)> {
    let mut out = Vec::new();
    for (branch, packaged) in [
        (device.to_string(), true),
        (format!("{}\\{}", device, NON_PACKAGED), false),
    ] {
        let path = format!("{}\\{}", CONSENT_STORE, branch);
        for entry in registry::read_subkeys(&path) {
            // 设备键下有一个叫 NonPackaged 的分支，它自己不是一条占用记录。
            if packaged && entry.key == NON_PACKAGED {
                continue;
            }
            out.push((entry, packaged));
        }
    }
    out
}

/// 读取某个设备当前正在使用的程序名（已排序去重）。
pub fn apps_using(device: &str) -> Vec<String> {
    let entries = read_device_entries(device);
    // 打包与非打包分开解析再合并，避免同名程序被当成两条。
    let mut packed: Vec<RawEntry> = Vec::new();
    let mut loose: Vec<RawEntry> = Vec::new();
    for (entry, packaged) in entries {
        if packaged {
            packed.push(entry);
        } else {
            loose.push(entry);
        }
    }
    let mut names: Vec<String> = Vec::new();
    names.extend(collect_names(&packed, true));
    names.extend(collect_names(&loose, false));
    names.sort_by_key(|name| name.to_lowercase());
    let mut out: Vec<String> = Vec::with_capacity(names.len());
    for name in names {
        if out
            .last()
            .map(|last: &String| last.to_lowercase() != name.to_lowercase())
            .unwrap_or(true)
        {
            out.push(name);
        }
    }
    out
}

/// 读取全部设备的占用情况。
pub fn read_all() -> DeviceUseReport {
    DeviceUseReport {
        camera: apps_using(DEVICE_CAMERA),
        microphone: apps_using(DEVICE_MICROPHONE),
    }
}

/// 原始记录明细，用于核对与排障。
pub fn read_raw(device: &str) -> Vec<(String, bool, Option<u64>, Option<u64>)> {
    read_device_entries(device)
        .into_iter()
        .map(|(entry, packaged)| (entry.key, packaged, entry.start, entry.stop))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, start: Option<u64>, stop: Option<u64>) -> RawEntry {
        RawEntry {
            key: key.to_string(),
            start,
            stop,
        }
    }

    #[test]
    fn 打包应用名取家族名后半段() {
        assert_eq!(
            packaged_label("OpenAI.Codex_2p2nqsd0c76g0").as_deref(),
            Some("Codex")
        );
        assert_eq!(
            packaged_label("Microsoft.WindowsCamera_8wekyb3d8bbwe").as_deref(),
            Some("WindowsCamera")
        );
        assert_eq!(packaged_label("NoUnderscore").as_deref(), None);
        assert_eq!(packaged_label("NoDot_abc").as_deref(), Some("NoDot"));
        assert_eq!(
            packaged_label("Claude_pzs8sxrjxfjjc").as_deref(),
            Some("Claude")
        );
        assert_eq!(
            packaged_label("windows.immersivecontrolpanel_cw5n1h2txyewy").as_deref(),
            Some("immersivecontrolpanel")
        );
    }

    #[test]
    fn 非打包路径取末段并去扩展名() {
        assert_eq!(
            non_packaged_label("C:#Program Files#Zoom#bin#Zoom.exe").as_deref(),
            Some("Zoom")
        );
        assert_eq!(non_packaged_label("C:\\app\\Thing.exe").as_deref(), Some("Thing"));
        assert_eq!(non_packaged_label("D:/tools/App.exe").as_deref(), Some("App"));
        assert_eq!(non_packaged_label("plain").as_deref(), Some("plain"));
    }

    #[test]
    fn 在用判定要求开始时间有效且结束时间为零() {
        assert!(in_use(Some(1), Some(0)));
        assert!(!in_use(Some(1), Some(2)));
        assert!(!in_use(Some(0), Some(0)));
        assert!(!in_use(None, Some(0)));
        assert!(!in_use(Some(1), None));
        assert!(!in_use(None, None));
    }

    #[test]
    fn 同名程序只保留一条并按小写排序() {
        let entries = vec![
            entry("Zoom.exe", Some(1), Some(0)),
            entry("zoom.exe", Some(1), Some(0)),
            entry("Alpha.exe", Some(1), Some(0)),
            entry("Beta.exe", Some(1), Some(2)),
        ];
        let names = collect_names(&entries, false);
        assert_eq!(names, vec!["Alpha".to_string(), "Zoom".to_string()]);
    }

    #[test]
    fn 空目录得到空列表() {
        assert!(collect_names(&[], true).is_empty());
        assert!(collect_names(&[], false).is_empty());
    }

    #[test]
    fn 空名与乱码名被过滤() {
        let entries = vec![
            entry("C:#x#.exe", Some(1), Some(0)),
            entry("C:#a#bad\x00name.exe", Some(1), Some(0)),
        ];
        assert!(collect_names(&entries, false).is_empty());
    }

    #[test]
    fn 打包与非打包同名时合并去重() {
        let packed = vec![entry("OpenAI.Codex_2p2nqsd0c76g0", Some(1), Some(0))];
        let loose = vec![entry("C:#Codex.exe", Some(1), Some(0))];
        assert_eq!(collect_names(&packed, true), vec!["Codex".to_string()]);
        assert_eq!(collect_names(&loose, false), vec!["Codex".to_string()]);
    }
}
