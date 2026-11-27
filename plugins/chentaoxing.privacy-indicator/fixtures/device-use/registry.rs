//! Windows 注册表只读访问（advapi32 直调，不引入第三方依赖）。
//!
//! 只做三件事：打开键、枚举子键、读一个整数型值。
//! 不含任何业务判断，业务判断在 `device_use.rs`。

/// 一条原始记录：子键名 + 两个时间戳。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawEntry {
    /// 子键名（打包应用是 `<PFN>_<PublisherId>`，非打包应用是编码后的路径）。
    pub key: String,
    /// `LastUsedTimeStart`，缺失时为 `None`。
    pub start: Option<u64>,
    /// `LastUsedTimeStop`，缺失时为 `None`。
    pub stop: Option<u64>,
}

#[cfg(windows)]
mod imp {
    use super::RawEntry;
    use std::ffi::c_void;

    type Hkey = *mut c_void;

    const HKEY_CURRENT_USER: Hkey = 0x8000_0001usize as Hkey;
    const KEY_READ: u32 = 0x0002_0019;
    const REG_DWORD: u32 = 4;
    const REG_QWORD: u32 = 11;
    const ERROR_SUCCESS: i32 = 0;
    const ERROR_MORE_DATA: i32 = 234;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegOpenKeyExW(
            hkey: Hkey,
            subkey: *const u16,
            options: u32,
            access: u32,
            result: *mut Hkey,
        ) -> i32;
        fn RegEnumKeyExW(
            hkey: Hkey,
            index: u32,
            name: *mut u16,
            name_len: *mut u32,
            reserved: *mut u32,
            class: *mut u16,
            class_len: *mut u32,
            last_write: *mut i64,
        ) -> i32;
        fn RegQueryValueExW(
            hkey: Hkey,
            value_name: *const u16,
            reserved: *mut u32,
            value_type: *mut u32,
            data: *mut u8,
            data_len: *mut u32,
        ) -> i32;
        fn RegCloseKey(hkey: Hkey) -> i32;
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// 打开 `HKCU` 下的多级路径，返回已打开的键（调用方负责关闭）。
    fn open_path(path: &str) -> Option<Hkey> {
        let mut key = HKEY_CURRENT_USER;
        let mut owned = false;
        for part in path.split('\\').filter(|part| !part.is_empty()) {
            let name = wide(part);
            let mut next: Hkey = std::ptr::null_mut();
            let status = unsafe {
                RegOpenKeyExW(key, name.as_ptr(), 0, KEY_READ, &mut next)
            };
            if status != ERROR_SUCCESS {
                if owned {
                    unsafe { RegCloseKey(key) };
                }
                return None;
            }
            if owned {
                unsafe { RegCloseKey(key) };
            }
            key = next;
            owned = true;
        }
        if owned {
            Some(key)
        } else {
            None
        }
    }

    /// 枚举第 `index` 个子键名。
    fn enum_subkey(key: Hkey, index: u32) -> Option<String> {
        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;
        let status = unsafe {
            RegEnumKeyExW(
                key,
                index,
                buffer.as_mut_ptr(),
                &mut length,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if status != ERROR_SUCCESS && status != ERROR_MORE_DATA {
            return None;
        }
        let end = (length as usize).min(buffer.len());
        Some(String::from_utf16_lossy(&buffer[..end]))
    }

    /// 读一个整数型值；类型不符或不存在时返回 `None`。
    fn query_u64(key: Hkey, value: &str) -> Option<u64> {
        let name = wide(value);
        let mut value_type: u32 = 0;
        let mut size: u32 = 8;
        let mut data: u64 = 0;
        let status = unsafe {
            RegQueryValueExW(
                key,
                name.as_ptr(),
                std::ptr::null_mut(),
                &mut value_type,
                (&mut data as *mut u64).cast::<u8>(),
                &mut size,
            )
        };
        if status != ERROR_SUCCESS {
            return None;
        }
        match value_type {
            REG_QWORD => Some(data),
            REG_DWORD => Some(data & 0xffff_ffff),
            _ => None,
        }
    }

    /// 列出指定路径下的全部子键及其两个时间戳。
    pub fn read_subkeys(path: &str) -> Vec<RawEntry> {
        let mut out = Vec::new();
        let root = match open_path(path) {
            Some(key) => key,
            None => return out,
        };
        let mut index: u32 = 0;
        while let Some(name) = enum_subkey(root, index) {
            index += 1;
            let child_path = format!("{}\\{}", path, name);
            let child = match open_path(&child_path) {
                Some(key) => key,
                None => continue,
            };
            let start = query_u64(child, "LastUsedTimeStart");
            let stop = query_u64(child, "LastUsedTimeStop");
            unsafe { RegCloseKey(child) };
            out.push(RawEntry { key: name, start, stop });
        }
        unsafe { RegCloseKey(root) };
        out
    }
}

#[cfg(not(windows))]
mod imp {
    use super::RawEntry;

    /// 非 Windows 平台没有这份账本，返回空列表。
    pub fn read_subkeys(_path: &str) -> Vec<RawEntry> {
        Vec::new()
    }
}

pub use imp::read_subkeys;
