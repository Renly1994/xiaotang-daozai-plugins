// 模拟宿主管理的账号和邮件。
const demoAccounts = [
    { id: "work", email: "work@example.com" },
    { id: "personal", email: "personal@example.net" },
    { id: "project", email: "project@example.org" },
    { id: "study", email: "study@example.net" },
    { id: "billing", email: "billing@example.com" },
    { id: "community", email: "community@example.org" }
];
const demoMessages = [
    {
        id: "library-renewal", accountId: "personal", date: "2026-11-27", unread: true,
        subject: "图书续借提醒", from: "市图书馆",
        body: "您借阅的《城市漫步》将于 11 月 30 日到期。\n如需续借，可在到期前通过读者账户办理。"
    },
    {
        id: "acceptance", accountId: "work", date: "2026-11-25", unread: false,
        subject: "项目验收清单", from: "项目组",
        body: "本轮验收包含登录、搜索和数据导出三项。\n请在周五前补齐测试截图和复现步骤。"
    },
    {
        id: "schedule", accountId: "work", date: "2026-11-27", unread: true,
        subject: "本周排期已更新", from: "运营组",
        body: [
            "本周发布检查改到周五 15:00。",
            "请在会前更新任务状态，并整理待确认的事项。",
            "会后由运营组汇总结果，发给项目成员。",
            "",
            "发布安排",
            "周四 18:00 前冻结本次发布的改动。仍在评审中的事项移到下个版本，已经合入的功能由对应同事补齐验收记录。测试环境保留到周五 17:30，方便复核。",
            "",
            "验收范围",
            "请重点核对登录、搜索和数据导出。遇到问题时，在记录里注明使用的账号类型、操作步骤和出现问题的时间。涉及测试数据的截图请裁掉与问题无关的信息。",
            "",
            "会后跟进",
            "运营组会在当天汇总待处理事项，并为每项任务填写负责人和预计完成时间。需要其他小组协助的事项，请在会前标注依赖关系。",
            "",
            "如对排期有疑问，请在周五中午前联系运营组。"
        ].join("\n")
    },
    {
        id: "exhibition", accountId: "personal", date: "2026-11-24", unread: false,
        subject: "周末展览预约确认", from: "美术馆",
        body: "您已预约周六 10:30 的城市摄影展。\n请提前十分钟到达一层服务台。"
    },
    {
        id: "design-review", accountId: "work", date: "2026-11-26", unread: true,
        subject: "设计评审通知", from: "设计组",
        body: "设计评审定于周四 14:30，在第三会议室举行。\n本次讨论导航、空状态和移动端排版。"
    },
    {
        id: "meeting-room", accountId: "work", date: "2026-11-24", unread: false,
        subject: "会议室预订确认", from: "行政组",
        body: "三层东侧会议室已为项目组预留。\n预订时间为周三 09:30 至 10:30。"
    },
    {
        id: "expenses", accountId: "work", date: "2026-11-23", unread: true,
        subject: "本月报销截止提醒", from: "财务组",
        body: "本月报销单请在 11 月 30 日下班前提交。\n请确认发票抬头和金额与报销单一致。"
    },
    {
        id: "weekly-report", accountId: "work", date: "2026-11-22", unread: false,
        subject: "项目周报", from: "项目组",
        body: "本周完成了数据迁移和接口联调。\n下周将进行验收演练并整理交付清单。"
    },
    {
        id: "archive", accountId: "work", date: "2026-11-21", unread: false,
        subject: "文档归档完成", from: "档案组",
        body: "十月项目材料已归档到团队文库。\n归档范围包含会议纪要、设计稿和验收记录。"
    },
    {
        id: "parcel", accountId: "personal", date: "2026-11-26", unread: true,
        subject: "包裹已送达", from: "快递站",
        body: "您的包裹已经送到小区快递站。\n营业时间为 08:00 至 20:00，请在三天内领取。"
    },
    {
        id: "bill", accountId: "personal", date: "2026-11-25", unread: false,
        subject: "本月电子账单", from: "物业中心",
        body: "十一月物业电子账单已生成。\n如已缴费，可在服务大厅查看缴费记录。"
    },
    {
        id: "talk", accountId: "personal", date: "2026-11-23", unread: true,
        subject: "线上讲座报名确认", from: "社区中心",
        body: "您已报名周四晚七点的城市历史讲座。\n讲座开始前，主办方会另外发送入场信息。"
    },
    {
        id: "cinema", accountId: "personal", date: "2026-11-22", unread: false,
        subject: "电影票预订成功", from: "城市影院",
        body: "周五 19:30 的电影票已预订成功。\n您的座位为三号厅六排八座。"
    },
    {
        id: "library-history", accountId: "personal", date: "2026-11-21", unread: false,
        subject: "借阅记录已更新", from: "市图书馆",
        body: "您归还的两本图书已登记。\n可在读者账户的借阅记录中查看归还日期。"
    },
    {
        id: "project-build", accountId: "project", date: "2026-11-26", unread: true,
        subject: "试用环境构建完成", from: "项目维护组",
        body: "验收环境已部署。\n请用测试账号确认导入、导出和历史记录三个流程。"
    },
    {
        id: "project-minutes", accountId: "project", date: "2026-11-24", unread: false,
        subject: "项目会纪要", from: "项目维护组",
        body: "会议确认了验收范围和负责人。\n下一次进度同步安排在周五。"
    },
    {
        id: "study-course", accountId: "study", date: "2026-11-27", unread: true,
        subject: "周末课程安排", from: "课程组",
        body: "周六课程将从上午十点开始。\n请在课前阅读第二章并记录想讨论的问题。"
    },
    {
        id: "study-notes", accountId: "study", date: "2026-11-21", unread: false,
        subject: "课堂笔记已同步", from: "学习小组",
        body: "本周课堂笔记已整理完毕。\n下次讨论将从最后一页的练习开始。"
    },
    {
        id: "billing-water", accountId: "billing", date: "2026-11-25", unread: true,
        subject: "本月用水账单已生成", from: "用水服务",
        body: "本期账单包含十月至十一月的用水记录。\n已开通自动缴费的账户会在到期日扣款。"
    },
    {
        id: "billing-receipt", accountId: "billing", date: "2026-11-23", unread: false,
        subject: "缴费回执", from: "账单服务",
        body: "上期账单已结清。\n回执已归入账户的历史账单。"
    },
    {
        id: "community-garden", accountId: "community", date: "2026-11-26", unread: true,
        subject: "社区花园志愿者安排", from: "社区服务组",
        body: "周日上午将整理社区花园。\n参与者请在九点到服务台领取工具。"
    },
    {
        id: "community-hours", accountId: "community", date: "2026-11-22", unread: false,
        subject: "社区中心开放时间", from: "社区服务组",
        body: "社区中心本月工作日开放至晚八点。\n周末开放时间为上午九点至下午六点。"
    },
    {
        id: "work-obsolete", accountId: "work", date: "2026-11-20", unread: false, trashed: true,
        subject: "已取消的会议预约", from: "行政组",
        body: "旧会议预约已取消，后续以新的安排为准。"
    },
    {
        id: "personal-obsolete", accountId: "personal", date: "2026-11-20", unread: false, trashed: true,
        subject: "已过期的活动提醒", from: "社区中心",
        body: "这场活动已经结束。\n感谢关注社区中心的活动安排。"
    }
];
const left = 25;
const right = 362;
const contentTop = 29;
const listTop = 49;
const rowHeight = 17;
const maxVisibleRows = 5;
const detailHeight = 149;
const favoriteAccounts = demoAccounts.slice(0, 2);
const defaultTrashIds = demoMessages.filter(message => message.trashed).map(message => message.id);

function accountLabel(account, settings) {
    const alias = String(settings[`${account.id}_name`] ?? "").replace(/[\x00-\x1f\x7f-\x9f]/g, " ").trim();
    return alias && alias !== "自动" ? alias : account.email;
}

function button(label, actionId, rect, { selected = false, hint, count = 0, size = 9 } = {}) {
    const [x, y, width, height] = rect;
    const baseline = y + height / 2 + 3.5;
    const badgeSpace = count ? 13 : 0;
    const nodes = [{
        rect, r: 5, fill: selected ? "$track" : "$card",
        ...(selected ? { stroke: "$accent", width: 1 } : {}),
        ...(actionId ? { hit: { action: actionId }, hover: { fill: "$track", ...(hint ? { hint } : {}) } } : {})
    }, {
        text: label, at: [x + (width - badgeSpace) / 2, baseline], size,
        weight: selected ? 650 : 500, align: "center", fill: actionId ? "$text" : "$muted",
        max_width: width - 6 - badgeSpace, lines: 1
    }];
    if (count) {
        nodes.push({ text: String(count), at: [x + width - 5, baseline], size: 8, align: "right", fill: "$accent" });
    }
    return nodes;
}

function accountTabs(selected, settings, unread, accountsOpen) {
    const nodes = favoriteAccounts.flatMap((account, index) =>
        button(accountLabel(account, settings), `show-${account.id}`, [left + index * 125, 1, 120, 23], {
            selected: account.id === selected.id && !accountsOpen,
            hint: account.email, count: unread[account.id]
        })
    );
    const extraUnread = demoAccounts.slice(favoriteAccounts.length)
        .reduce((total, account) => total + unread[account.id], 0);
    nodes.push(...button(accountsOpen ? "关闭列表" : "更多邮箱", "toggle-accounts", [left + 250, 1, 67, 23], {
        selected: accountsOpen || !favoriteAccounts.includes(selected),
        count: accountsOpen ? 0 : extraUnread
    }));
    nodes.push({ text: "模拟", at: [right, 16], size: 8, align: "right", fill: "$muted" });
    return nodes;
}

function accountsList(selected, settings, unread) {
    const height = 22;
    const visibleHeight = height * 5;
    const nodes = demoAccounts.flatMap((account, index) => {
        const y = contentTop + index * height;
        const label = accountLabel(account, settings);
        const hasAlias = label !== account.email;
        const active = account.id === selected.id;
        return [{
            rect: [left, y, right - left, height - 2], r: 4, fill: active ? "$track" : "$card",
            hit: { action: `show-${account.id}` }, hover: { fill: "$track", hint: account.email }
        }, {
            text: label, at: [left + 7, y + 13], size: 9.5, fill: active ? "$accent" : "$text",
            max_width: hasAlias ? 120 : 240, lines: 1
        }, ...(hasAlias ? [{
            text: account.email, at: [left + 133, y + 13], size: 9, fill: "$muted", max_width: 155, lines: 1
        }] : []), {
            text: `未读 ${unread[account.id]}`, at: [right - 7, y + 13], size: 9, align: "right",
            fill: unread[account.id] ? "$text" : "$muted"
        }];
    });
    return {
        height: contentTop + visibleHeight + 2,
        node: {
            id: "mail-account-picker", group: nodes, clip: [left, contentTop, right - left, visibleHeight],
            scroll: { axis: "y", content: demoAccounts.length * height }
        }
    };
}

function mailNodes(message, y, readIds) {
    const fill = message.unread && !readIds.has(message.id) ? "$text" : "$muted";
    return [
        {
            rect: [left, y, right - left, rowHeight],
            r: 3,
            fill: "#00000000",
            hit: { action: `open-${message.id}` },
            hover: { fill: "$card" }
        },
        {
            text: message.subject,
            at: [left + 6, y + 12],
            size: 10,
            fill,
            max_width: 172,
            lines: 1
        },
        {
            text: `${message.from} · ${message.date.slice(5)}`,
            at: [right - 4, y + 12],
            size: 9,
            align: "right",
            fill,
            max_width: 140,
            lines: 1
        }
    ];
}

function bodyGroup(message) {
    const top = contentTop + 46;
    const fontSize = 10;
    const lineHeight = 14;
    const visibleHeight = 4 * lineHeight;
    const textWidth = right - left - 12;
    // 按全角字宽保守折行，让滚动范围与实际绘制的每行对应。
    const columns = Math.floor(textWidth / (fontSize + 0.5));
    const linePattern = new RegExp(`.{1,${columns}}`, "gsu");
    const lines = message.body.split(/\r\n?|\n/).flatMap(paragraph => paragraph.match(linePattern) ?? [""]);
    const contentHeight = lines.length * lineHeight;
    return {
        id: `body-${message.id}`,
        group: lines.flatMap((text, index) => text ? [{
            text, at: [left + 6, top + 11 + index * lineHeight], size: fontSize,
            fill: "$text", max_width: textWidth, lines: 1
        }] : []),
        clip: [left, top, right - left, visibleHeight],
        ...(contentHeight > visibleHeight ? { scroll: { axis: "y", content: contentHeight } } : {})
    };
}

function detailNodes(message, folder) {
    return [
        ...button("返回列表", "back-to-list", [left, contentTop, 52, 18]),
        { text: message.subject, at: [left + 62, contentTop + 13], size: 11, weight: 650,
            fill: "$text", max_width: right - left - 68, lines: 1 },
        { text: `${message.from} · ${message.date}`, at: [left + 6, contentTop + 34],
            size: 9, fill: "$muted", max_width: 225, lines: 1 },
        ...button(folder === "trash" ? "恢复到收件箱" : "移到回收站", "move-mail",
            [right - 83, contentTop + 22, 83, 17]),
        { line: [left + 6, contentTop + 42, right - 4, contentTop + 42], stroke: "$track", width: 1 },
        bodyGroup(message)
    ];
}

function readMailbox(storage, actionId, startDate) {
    const clicked = demoAccounts.find(account => actionId === `show-${account.id}`);
    const selected = clicked ?? demoAccounts.find(account => account.id === storage?.selectedAccountId)
        ?? demoAccounts[0];
    const previousFolder = storage?.folder === "trash" ? "trash" : "inbox";
    const folder = actionId === "toggle-trash" ? (previousFolder === "trash" ? "inbox" : "trash")
        : previousFolder;
    const accountsOpen = !clicked && (actionId === "toggle-accounts" ? !storage?.accountsOpen
        : storage?.accountsOpen === true);
    const readIds = new Set(Array.isArray(storage?.readIds) ? storage.readIds : []);
    const trashIds = new Set(Array.isArray(storage?.trashIds) ? storage.trashIds : defaultTrashIds);
    const anchors = { ...storage?.anchors };
    const anchorKey = `${selected.id}-${folder}`;
    const ownMessages = demoMessages.filter(message => message.accountId === selected.id);
    const showList = clicked || ["back-to-list", "toggle-trash", "move-mail", "show-latest"].includes(actionId);
    const inFolder = message => trashIds.has(message.id) === (folder === "trash");
    if (actionId === "mark-account-read" && folder === "inbox") {
        ownMessages.filter(message => message.unread && inFolder(message)).forEach(message => readIds.add(message.id));
    }
    if (actionId === "move-mail") {
        const message = ownMessages.find(message => message.id === storage?.openMessageId
            && message.date >= startDate && inFolder(message));
        if (message && folder === "trash") {
            trashIds.delete(message.id);
        } else if (message) {
            trashIds.add(message.id);
        }
    }
    if (actionId === "show-latest") {
        delete anchors[anchorKey];
    }
    const messages = ownMessages.filter(message => inFolder(message) && message.date >= startDate)
        .sort((first, second) => second.date.localeCompare(first.date));
    const opened = showList ? null : messages.find(message => `open-${message.id}` === actionId)
        ?? messages.find(message => message.id === storage?.openMessageId);
    if (opened) {
        anchors[anchorKey] = opened.id;
        if (opened.unread) readIds.add(opened.id);
    }
    const anchorIndex = messages.findIndex(message => message.id === anchors[anchorKey]);
    const startAt = anchorIndex >= maxVisibleRows ? Math.min(anchorIndex, messages.length - maxVisibleRows) : 0;
    const unread = Object.fromEntries(demoAccounts.map(account => [account.id, 0]));
    for (const message of demoMessages) {
        if (message.unread && !readIds.has(message.id) && !trashIds.has(message.id)) {
            unread[message.accountId]++;
        }
    }
    return {
        selected, folder, accountsOpen, opened, unread, readIds, messages: messages.slice(startAt), startAt,
        storage: {
            selectedAccountId: selected.id, folder, accountsOpen, readIds: [...readIds], trashIds: [...trashIds],
            anchors, ...(opened ? { openMessageId: opened.id } : {})
        }
    };
}

function listNodes(mailbox, settings) {
    const { selected, folder, messages, unread, readIds, startAt } = mailbox;
    const trash = folder === "trash";
    const favorite = favoriteAccounts.includes(selected);
    const summary = trash ? "回收站" : `未读 ${unread[selected.id]}`;
    const firstControl = right - (trash ? (startAt ? 110 : 51) : (startAt ? 220 : 161));
    const title = favorite ? (trash ? summary : `收件箱 · ${summary}`) : accountLabel(selected, settings);
    const nodes = [
        { text: title, at: [left + 2, contentTop + 12], size: 9, fill: "$muted",
            max_width: firstControl - left - (favorite ? 8 : 47), lines: 1 },
        ...button(trash ? "收件箱" : "回收站", "toggle-trash", [right - 51, contentTop, 51, 17])
    ];
    if (!favorite) {
        nodes.push({ text: summary, at: [firstControl - 7, contentTop + 12], size: 9,
            align: "right", fill: "$muted" });
    }
    if (!trash) {
        nodes.push(...button("当前邮箱全部已读", unread[selected.id] ? "mark-account-read" : null,
            [right - 161, contentTop, 105, 17], { hint: "标记当前邮箱收件箱中的全部模拟邮件" }));
    }
    if (startAt) {
        nodes.push(...button("回到最新", "show-latest", [right - (trash ? 110 : 220), contentTop, 54, 17]));
    }
    const contentHeight = messages.length * rowHeight;
    const visibleHeight = Math.max(1, Math.min(messages.length, maxVisibleRows)) * rowHeight;
    if (messages.length) {
        nodes.push({
            id: `mail-${selected.id}-${folder}-${startAt}`,
            group: messages.flatMap((message, index) => mailNodes(message, listTop + index * rowHeight, readIds)),
            clip: [left, listTop, right - left, visibleHeight],
            ...(contentHeight > visibleHeight ? { scroll: { axis: "y", content: contentHeight } } : {})
        });
    } else {
        nodes.push({ text: trash ? "当前邮箱的回收站为空" : "没有符合起始日期的模拟邮件",
            at: [left + 6, listTop + 12],
            size: 9, fill: "$muted" });
    }
    return { height: listTop + visibleHeight + 2, nodes };
}

function renderDemo({ settings = {}, storage = null }, actionId) {
    const mailbox = readMailbox(storage, actionId, settings.start_date || "");
    const { selected, unread, accountsOpen, opened, folder } = mailbox;
    const tabs = accountTabs(selected, settings, unread, accountsOpen);
    if (accountsOpen) {
        const { height, node } = accountsList(selected, settings, unread);
        return { canvas: { height, nodes: [...tabs, node] }, storage: mailbox.storage };
    }
    if (opened) {
        return {
            canvas: { height: detailHeight, nodes: [...tabs, ...detailNodes(opened, folder)] },
            storage: mailbox.storage
        };
    }
    const { height, nodes } = listNodes(mailbox, settings);
    return { canvas: { height, nodes: [...tabs, ...nodes] }, storage: mailbox.storage };
}

function refresh(input) {
    return renderDemo(input);
}

function action(input) {
    return renderDemo(input, input.action?.id);
}
