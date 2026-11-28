const DIRECT_HOSTS = ["www.baidu.com", "www.bilibili.com", "github.com", "www.zhihu.com"];
const MAX_SITES = 20;
const PAGE_SIZE = 8;

function clean(value, max) {
    return [...String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim()].slice(0, max).join("");
}

function parseLink(value) {
    let url = String(value ?? "").trim();
    if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !url.includes("://")) url = "https://" + url;
    if (url.length > 200 || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(url)) return null;
    const match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(url);
    if (!match || !/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(match[1])) return null;
    return { url, direct: /^https:\/\//i.test(url) && DIRECT_HOSTS.includes(match[1].toLowerCase()) };
}

function siteOf(row) {
    const name = clean(row?.name, 28);
    const link = parseLink(row?.url);
    return name && link ? { name, url: link.url } : null;
}

function settingsSites(settings) {
    try {
        const rows = typeof settings?.sites === "string" ? JSON.parse(settings.sites) : settings?.sites;
        if (!Array.isArray(rows)) return { sites: [], invalid: true };
        const sites = [];
        let invalid = rows.length > 8;
        for (const row of rows.slice(0, 8)) {
            const site = siteOf(row);
            if (site) sites.push(site);
            else invalid = true;
        }
        return { sites, invalid };
    } catch (_) {
        return { sites: [], invalid: true };
    }
}

function result(input, isRefresh) {
    const configured = settingsSites(input?.settings);
    const old = input?.storage;
    // 旧版可能停留在分组或编辑页；升级后统一回到列表。
    const storage = {
        sites: (Array.isArray(old?.sites) ? old.sites : []).slice(0, MAX_SITES).map(siteOf).filter(Boolean),
        page: Number.isInteger(old?.page) ? old.page : 0,
        view: !isRefresh && old?.view === "add" ? "add" : "list"
    };
    const id = input?.action?.id || "";
    const form = input?.action?.form || {};
    let alert = configured.invalid ? "设置中有无效网址，请检查并保存设置" : undefined;
    if (id === "add-view") storage.view = "add";
    else if (id === "back") storage.view = "list";
    else if (id === "add-site") {
        const site = siteOf({ name: form.name, url: form.url });
        if (!site) alert = "请输入网站名称和有效网址";
        else if (configured.sites.length + storage.sites.length >= MAX_SITES) alert = "网站已达 20 个";
        else if ([...configured.sites, ...storage.sites].some(item => item.url === site.url)) alert = "这个网址已经保存";
        else {
            storage.sites.push(site);
            storage.view = "list";
            storage.page = Math.floor((configured.sites.length + storage.sites.length - 1) / PAGE_SIZE);
        }
    } else if (id === "page-prev") storage.page--;
    else if (id === "page-next") storage.page++;

    // 设置列表中的每一行都要可见：不同名称可以指向同一网址。
    const sites = [...configured.sites, ...storage.sites];
    const pages = Math.max(1, Math.ceil(sites.length / PAGE_SIZE));
    storage.page = Math.min(Math.max(0, storage.page), pages - 1);
    const status = { state: "idle", label: "我的常用网站", items: [] };
    if (alert) status.alert = alert;
    if (storage.view === "add") {
        status.fields = [
            { key: "name", label: "网站名称", max: 28 },
            { key: "url", label: "网址", max: 200 }
        ];
        status.actions = [{ id: "add-site", label: "保存" }, { id: "back", label: "返回" }];
    } else {
        status.items = sites.slice(storage.page * PAGE_SIZE, (storage.page + 1) * PAGE_SIZE)
            .map(site => {
                const target = parseLink(site.url);
                return {
                    label: site.name,
                    detail: site.url,
                    ...(target.direct ? { open: site.url } : { copy: site.url })
                };
            });
        status.actions = [];
        if (storage.page > 0) status.actions.push({ id: "page-prev", label: "上一页" });
        status.actions.push({ id: "add-view", label: "添加网站" });
        if (storage.page + 1 < pages) status.actions.push({ id: "page-next", label: "下一页" });
        if (!sites.length) status.summary = "暂无网站，点击下方添加";
    }
    return { status, storage };
}

function refresh(input) { return result(input, true); }
function action(input) { return result(input, false); }
