// 虹彩光浪 · 适配岛仔 GPU 材质接口 api: 1
// 基础玻璃采样与控件框架（hash21、rounded_normal、corner_weight、pick_control、control_glass 等）
// 改编自 @cayww 的岛仔「液态玻璃」官方样例（MIT 许可，见 LICENSE）。
// 本插件新增：
// 1. 收起态静态浅黑早退分支，保证白色前景高对比且降低空闲采样耗时
// 2. DockSpace 四方向停靠映射与 4/5 黑曜石至透明折射玻璃渐变
// 3. 居中演进、左右铺满的双层虹彩光浪与极细冷暖光学色散晶边
// 4. 屏幕边界防拉丝安全采样限幅，以及严格 [0, 1] 通道动态压稳与 WGSL 域安全平方算子

const LUMA : vec3<f32> = vec3<f32>(0.299, 0.587, 0.114);
const OBSIDIAN_CORE : vec3<f32> = vec3<f32>(0.014, 0.016, 0.024);
const COLLAPSED_SOFT_BLACK : vec3<f32> = vec3<f32>(0.105, 0.112, 0.128);
const ICY_CYAN : vec3<f32> = vec3<f32>(0.28, 0.72, 0.98);
const WARM_AMBER : vec3<f32> = vec3<f32>(0.96, 0.68, 0.34);
const PURE_ICE : vec3<f32> = vec3<f32>(0.94, 0.96, 0.99);
const ROLE_ISLAND_LYRICS : u32 = 7u;
const ROLE_SEEK : u32 = 10u;

// 替代可能传入负数或零的 pow(x, 2.0)，严格满足 WGSL 定义域规范。
fn sq(v : f32) -> f32 {
    return v * v;
}

fn hash21(p : vec2<f32>) -> f32 {
    var q = fract(p * vec2<f32>(0.1031, 0.1030));
    q = q + vec2<f32>(dot(q, q.yx + vec2<f32>(33.33)));
    return fract((q.x + q.y) * q.x);
}

// 流动五色光带（冰青 -> 靛蓝 -> 幻紫 -> 桃粉 -> 暖金琥珀）
fn prism_palette(phase : f32) -> vec3<f32> {
    let p = fract(phase) * 5.0;
    let c0 = vec3<f32>(0.34, 0.76, 0.98);
    let c1 = vec3<f32>(0.46, 0.56, 0.96);
    let c2 = vec3<f32>(0.76, 0.52, 0.92);
    let c3 = vec3<f32>(0.94, 0.58, 0.74);
    let c4 = vec3<f32>(0.96, 0.70, 0.36);
    let seg = u32(floor(p)) % 5u;
    let f = fract(p);
    let s = f * f * (3.0 - 2.0 * f);
    switch seg {
        case 0u: { return mix(c0, c1, s); }
        case 1u: { return mix(c1, c2, s); }
        case 2u: { return mix(c2, c3, s); }
        case 3u: { return mix(c3, c4, s); }
        default: { return mix(c4, c0, s); }
    }
}

// 将采样式坐标安全限制在抓屏内缩区间，防止顶部/侧边贴屏壁纸边缘细线在强折射时拉出色带。
fn safe_sample(p : vec2<f32>, ppp : f32) -> vec3<f32> {
    let inset_min = vec2<f32>(
        select(1.0 * ppp, 3.0 * ppp, frame.capture.x <= 2.0 * ppp),
        select(1.0 * ppp, 3.0 * ppp, frame.capture.y <= 2.0 * ppp)
    );
    let inset_max = max(frame.tex.zw - vec2<f32>(1.5 * ppp), inset_min + vec2<f32>(1.0));
    return sample_backdrop(clamp(p, inset_min, inset_max));
}

// 自适应低开销色散模糊采样：相比 15 次采样降低至 1~9 次纹理读取，降低显卡带宽压力。
fn tap_fast(p : vec2<f32>, dispersion : vec2<f32>, blur : f32, disp_len : f32, ppp : f32) -> vec3<f32> {
    if (blur <= 0.25 * ppp && disp_len <= 0.25 * ppp) {
        return safe_sample(p, ppp);
    }
    if (blur <= 0.35 * ppp) {
        return vec3<f32>(
            safe_sample(p + dispersion, ppp).r,
            safe_sample(p, ppp).g,
            safe_sample(p - dispersion, ppp).b
        );
    }
    let b = blur;
    let g_sum = (
        safe_sample(p, ppp).g
        + safe_sample(p + vec2<f32>(b, 0.0), ppp).g
        + safe_sample(p - vec2<f32>(b, 0.0), ppp).g
        + safe_sample(p + vec2<f32>(0.0, b), ppp).g
        + safe_sample(p - vec2<f32>(0.0, b), ppp).g
    ) * 0.20;
    let rp = p + dispersion;
    let bp_ch = p - dispersion;
    let r_avg = (
        safe_sample(rp + vec2<f32>(b * 0.75, 0.0), ppp).r
        + safe_sample(rp - vec2<f32>(b * 0.75, 0.0), ppp).r
    ) * 0.50;
    let b_avg = (
        safe_sample(bp_ch + vec2<f32>(0.0, b * 0.75), ppp).b
        + safe_sample(bp_ch - vec2<f32>(0.0, b * 0.75), ppp).b
    ) * 0.50;
    return vec3<f32>(r_avg, g_sum, b_avg);
}

fn rounded_normal(p : vec2<f32>, half_size : vec2<f32>, radius : f32) -> vec2<f32> {
    let dx = vec2<f32>(1.0, 0.0);
    let dy = vec2<f32>(0.0, 1.0);
    let gx = rr_sdf(p + dx, half_size, radius) - rr_sdf(p - dx, half_size, radius);
    let gy = rr_sdf(p + dy, half_size, radius) - rr_sdf(p - dy, half_size, radius);
    return normalize(vec2<f32>(gx, gy) + vec2<f32>(1e-6));
}

fn corner_weight(local : vec2<f32>, half_size : vec2<f32>, radius : f32) -> f32 {
    let corner = clamp((abs(local) - (half_size - radius)) / max(radius, 1.0), vec2<f32>(0.0), vec2<f32>(1.0));
    return mix(0.60, 1.0, corner.x * corner.y);
}

struct DockSpace {
    local : vec2<f32>,
    half_size : vec2<f32>,
};

// 将四种停靠方向统一映射到「-y 贴屏边、+y 朝屏幕内」的局部坐标。
fn to_dock_space(local : vec2<f32>, half_size : vec2<f32>) -> DockSpace {
    switch frame.count.y {
        case 1u: { return DockSpace(local.yx, half_size.yx); }
        case 2u: { return DockSpace(vec2<f32>(local.y, -local.x), half_size.yx); }
        case 3u: { return DockSpace(vec2<f32>(local.x, -local.y), half_size); }
        default: { return DockSpace(local, half_size); }
    }
}

struct Optics {
    refraction : f32,
    dispersion : f32,
    blur : f32,
    edge_width : f32,
    edge_opacity : f32,
};

struct ControlHit {
    index : u32,
    local : vec2<f32>,
    half_size : vec2<f32>,
    radius : f32,
    distance : f32,
};

fn pick_control(p : vec2<f32>) -> ControlHit {
    let count = min(frame.count.x, 16u);
    var hit = ControlHit(count, vec2<f32>(0.0), vec2<f32>(1.0), 0.0, 0.0);
    for (var index = 0u; index < count; index = index + 1u) {
        let ctrl = frame.ctl_shape[index];
        if (ctrl.y < 0.5) { continue; }
        let rect = frame.ctl_rect[index];
        let spring = frame.ctl_spring[index];
        let half_size = max(rect.zw * (0.5 * spring.z) - vec2<f32>(0.5), vec2<f32>(1.0));
        let radius = clamp(ctrl.x * spring.z - 0.5, 0.0, min(half_size.x, half_size.y));
        let local = p - rect.xy - rect.zw * 0.5 - spring.xy;
        let distance = rr_sdf(local, half_size, radius);
        if (distance < 0.0) {
            hit = ControlHit(index, local, half_size, radius, distance);
        }
    }
    return hit;
}

fn control_glass(
    p : vec2<f32>,
    hit : ControlHit,
    light : vec2<f32>,
    irid_strength : f32,
    t : f32,
    ppp : f32,
    optics : Optics
) -> vec4<f32> {
    let local = hit.local;
    let hs = hit.half_size;
    let distance = hit.distance;
    let normal = rounded_normal(local, hs, hit.radius);
    let short = max(min(hs.x, hs.y), 1.0);
    let band = clamp(short * 1.30, 10.0, 72.0);
    let dist_t = clamp(-distance / band, 0.0, 1.0);
    let k = sq(max(1.0 - pow(max(dist_t, 0.0), 0.30), 0.0));
    let size = frame.ctl_rect[hit.index].zw / ppp;
    let role = u32(frame.ctl_spring[hit.index].w);
    let hover = clamp(frame.ctl_shape[hit.index].z, 0.0, 1.0);
    var lens = 1.14 + hover * 0.05;
    switch role {
        case ROLE_ISLAND_LYRICS: { lens = 1.06; }
        case ROLE_SEEK: { lens = 1.0 + 0.9 * frame.ctl_shape[hit.index].w; }
        default: {}
    }
    let short_side = min(size.x, size.y) / select(1.0, lens, role == ROLE_SEEK);
    let refract = 0.52 * clamp(short_side / 70.0, 0.30, 1.0);
    let chroma = optics.dispersion * refract * corner_weight(local, hs, hit.radius);
    let bp = p - local * (1.0 - 1.0 / lens) - normal * k * optics.refraction * refract;

    var col = tap_fast(bp, -normal * k * chroma, optics.blur * 0.80 + k * 1.1 * ppp, k * chroma, ppp);
    col = col * 0.42 + OBSIDIAN_CORE * 0.58;

    let ctl_prism = select(WARM_AMBER, ICY_CYAN, normal.x > 0.0);
    let ctl_prism_tint = mix(ctl_prism, prism_palette(atan2(local.y, local.x) / 6.2831853 + t * 0.20), clamp(irid_strength * 0.5, 0.0, 1.0));
    let lobe = pow(max(dot(normal, light), 0.0), 1.6);

    let sigma = max(optics.edge_width, 0.35 * ppp) * 0.30;
    let line = exp(-sq((distance + 0.45 * ppp) / sigma)) * mix(0.45, 1.0, lobe);
    let edge = clamp(line * optics.edge_opacity * (0.75 + 0.25 * hover), 0.0, 1.0);
    let rim_col = mix(PURE_ICE, ctl_prism_tint, 0.35 + 0.25 * hover);
    col = clamp(mix(col, rim_col, edge), vec3<f32>(0.0), vec3<f32>(1.0));
    let aa = 1.0 - smoothstep(-1.0, 1.0, distance);
    return vec4<f32>(col, max(aa, edge));
}

fn material(i : MaterialIn) -> vec4<f32> {
    let p = i.px;
    let distance = body_sdf(p);
    if (distance > 2.75 || body_sdf_exact(p) > 2.0) { return vec4<f32>(0.0); }

    let ppp = max(frame.env.z, 1.0);
    let exp_t = clamp(frame.shape.y, 0.0, 1.0);
    let expand_mix = smoothstep(0.05, 0.65, exp_t);
    let aa = 1.0 - smoothstep(-1.2, 1.2, distance);
    let collapsed_col = COLLAPSED_SOFT_BLACK;

    // 收起态早退：直接渲染纯粹静态浅黑色，与白色前景保持高对比，无多余背景读取
    if (expand_mix <= 0.001) {
        if (distance <= -1.25) {
            return vec4<f32>(collapsed_col, 1.0);
        }
        let edge_bg = safe_sample(p, ppp);
        let color = clamp(mix(edge_bg, collapsed_col, aa), vec3<f32>(0.0), vec3<f32>(1.0));
        return vec4<f32>(color * aa, aa);
    }

    let split_ratio = clamp(param(0u), 0.10, 0.95);
    let lens_strength = clamp(param(2u), 0.0, 1.5);
    let glow_raw = clamp(param(4u), 0.0, 2.0);
    // 温和压稳弧光斜率：默认 0.85 清透分明，推到最高 2.0 也不致白底或前景文字过曝
    let glow_eff = glow_raw / (1.0 + 0.42 * max(glow_raw - 0.85, 0.0));
    let irid_strength = clamp(param(5u), 0.0, 1.5);
    let wave_speed = clamp(param(6u), 0.0, 3.0);
    let ripple_strength = clamp(param(7u), 0.0, 2.0);
    let optics = Optics(
        param(1u) * ppp,
        param(3u) * ppp,
        param(8u) * ppp,
        param(9u) * ppp,
        param(10u)
    );

    let t = frame.env.x * wave_speed;
    let morph = max(param(11u), 0.0) * clamp(frame.motion.z, 0.0, 1.0);

    let center = frame.body.xy + frame.body.zw * 0.5;
    let local = p - center;
    let half_size = max(frame.body.zw * 0.5 - vec2<f32>(3.0), vec2<f32>(2.0));
    let radius = clamp(frame.shape.x - 3.0, 0.0, min(half_size.x, half_size.y));

    let has_pointer = all(frame.shape.zw != vec2<f32>(-1.0));
    let to_pointer = select(vec2<f32>(0.0), frame.shape.zw - center, has_pointer);
    let pointer_distance = length(to_pointer);
    let swung = to_pointer / max(pointer_distance, 1e-3);
    let orbit_light = normalize(vec2<f32>(sin(t * 0.85) * 0.55, -0.78 + cos(t * 0.65) * 0.12));
    let light = normalize(mix(
        orbit_light,
        vec2<f32>(swung.x, min(swung.y, -0.18)),
        select(0.0, smoothstep(3.0, 56.0, pointer_distance), has_pointer)
    ) + vec2<f32>(1e-6));

    // 控件内部像素提前走轻路径，避免叠加执行一遍主岛与控件双重折射采样
    let hit = pick_control(p);
    if (hit.index < frame.count.x && hit.distance <= -1.10 && distance <= -1.40) {
        let control = control_glass(p, hit, light, irid_strength, t, ppp, optics);
        let out_col = clamp(mix(collapsed_col, control.rgb, expand_mix), vec3<f32>(0.0), vec3<f32>(1.0));
        return vec4<f32>(out_col, 1.0);
    }

    let ds = to_dock_space(local, half_size);
    let norm_pos = ds.local / max(ds.half_size, vec2<f32>(1.0));
    let x = norm_pos.x;
    let y = norm_pos.y;
    let normal = rounded_normal(local, half_size, radius);

    // 居中双曲线流体波纹（左右铺满延伸，动态经「凹碗聚光 -> 斜穿 S 脊 -> 上拱彩晕」平稳演进）
    let span_env = 1.0 - 0.24 * pow(clamp(abs(x), 0.0, 1.0), 2.2);
    let wing_env = clamp(cos(x * 1.12), 0.26, 1.0);
    let wave_center_y = 0.0;

    let ripple_scale = ripple_strength * (0.78 + morph * 0.45) * mix(0.85, 1.0, exp_t);
    let amp = 0.92 + 0.34 * ripple_scale;
    let mt = t * 1.12;
    let shift_x = x - 0.18 * sin(mt * 0.85);
    let lens_w = exp(-sq(shift_x / 0.58));
    let core_w_env = exp(-sq(shift_x / 0.44));
    let wide_env = exp(-sq(x / 0.86));

    let phase_open = 0.5 + 0.5 * sin(mt);
    let bowl_depth = (0.145 + 0.095 * phase_open) * lens_w * amp;
    let arch_lift = (-0.125 * cos(mt * 0.90) + 0.04) * lens_w * amp;
    let s_undul = (0.128 * sin(x * 2.55 - mt * 1.45) + 0.032 * sin(x * 4.40 + mt * 1.90)) * wing_env * amp;

    // 下弧聚光脊 y_bot + 上缘彩晕光幕 y_top + 穿插斜脊 y_spine
    let y_bot = wave_center_y + s_undul + bowl_depth * 0.72 + arch_lift * 0.55;
    let open_gap = (0.045 + 0.165 * phase_open) * lens_w;
    let y_top = wave_center_y + s_undul * 0.35 + arch_lift * 0.35 - open_gap + 0.024 * sin(x * 3.20 + mt * 1.30) * wing_env;
    let cross_vis = exp(-sq(phase_open - 0.55) / 0.20);
    let y_spine = mix(y_bot, 0.5 * (y_top + y_bot) - 0.10 * sin(x * 2.80 + sin(mt) * 0.35) * lens_w, 0.52);
    let wave_mid = 0.5 * (y_top + y_bot);

    // 顶部黑曜石向透明玻璃的渐变过渡独立保持在约 4/5 处（默认 obsidian=0.80 -> grad_split_y=+0.60）
    let grad_split_y = split_ratio * 2.0 - 1.0;
    let grad_t = smoothstep(-0.36, 0.24, y - grad_split_y);
    let black_alpha = mix(0.96, 0.18, grad_t);

    let short_px = max(min(ds.half_size.x, ds.half_size.y), 1.0);
    let band = clamp(short_px * 1.25, 18.0 * ppp, 88.0 * ppp) * (1.0 + morph * 0.08);
    let dist_t = clamp(-distance / band, 0.0, 1.0);
    let k = pow(max(1.0 - pow(dist_t, 0.34), 0.0), 2.1);

    var glass_col = OBSIDIAN_CORE;
    var bg_luma = 0.0;
    if (black_alpha < 0.945) {
        let lower_w = smoothstep(-0.22, 0.92, y);
        // 贴屏顶边保护衰减：避免壁纸最上缘 1~2px 细线在极大折射/色散档被拉出条纹
        let dock_safe = select(1.0, smoothstep(-0.98, -0.58, y), frame.notch.z > 0.5);
        let center_mag = lens_strength * 0.28 * (1.0 + 0.06 * sin(t * 1.5) * ripple_strength) * mix(1.0, 0.24, exp_t) * (1.0 + morph * 0.12) * lower_w * dock_safe;
        let edge_strength = optics.refraction * (1.0 + morph * 0.18) * dock_safe;
        let rip_x = sin(y * 5.8 - t * 2.2 + x * 2.0);
        let rip_y = cos(x * 4.8 + t * 1.8 - y * 2.0);
        let liquid_ripple = vec2<f32>(rip_x, rip_y) * (3.0 * ppp * ripple_strength * (1.0 + morph * 0.65) * lower_w * dock_safe);
        let bp = p - local * center_mag - normal * k * edge_strength + liquid_ripple;

        if (black_alpha >= 0.82) {
            glass_col = safe_sample(bp, ppp);
            bg_luma = dot(glass_col, LUMA);
            glass_col = mix(glass_col, OBSIDIAN_CORE, 0.18);
        } else {
            let chroma = optics.dispersion * (0.28 + 0.72 * k) * corner_weight(local, half_size, radius) * dock_safe;
            glass_col = tap_fast(bp, -normal * k * chroma, optics.blur + k * 1.1 * ppp, k * chroma, ppp);
            let lum = dot(glass_col, LUMA);
            bg_luma = lum;
            glass_col = mix(vec3<f32>(lum), glass_col, 1.06);
            glass_col = mix(glass_col, OBSIDIAN_CORE, mix(0.24, 0.16, smoothstep(0.45, 0.90, lum)));
        }
    }

    var col = mix(glass_col, OBSIDIAN_CORE, black_alpha);

    // 光学折射光斑着色：控制白区宽度与亮底衰减，保证中央前景文字清晰且无颜色通道越界
    var pointer_shift = 0.0;
    if (has_pointer) {
        pointer_shift = clamp(to_dock_space(to_pointer, half_size).local.x / max(ds.half_size.x, 1.0), -1.0, 1.0) * 0.16;
    }
    let pointer_bloom = select(0.0, exp(-length(p - frame.shape.zw) / (56.0 * ppp)), has_pointer);
    let flow_phase = x * 0.46 - t * 0.22 - pointer_shift * 0.25;
    let travel_hi = 0.5 + 0.5 * sin(x * 2.8 - t * 1.85);
    let bright_tame = 1.0 - 0.28 * grad_t * smoothstep(0.45, 0.95, bg_luma);
    let hud_guard = mix(0.65, 1.0, smoothstep(-0.78, -0.35, y));
    let wave_vis = glow_eff * (0.82 + 0.18 * travel_hi + 0.16 * pointer_bloom) * span_env * bright_tame * hud_guard;
    let irid_w = clamp(irid_strength * 0.65, 0.0, 1.0);
    let prism_hi = prism_palette(flow_phase);

    let y_lo = min(y_top, y_bot);
    let y_hi = max(y_top, y_bot);
    let gap = max(y_hi - y_lo, 0.022);

    // 1) 透镜内腔彩虹色散光幕：左冷天青蓝、右暖橘琥珀金，克制内部亮度突出细锐核心
    let lr_mix = smoothstep(-0.42, 0.42, shift_x);
    let left_caustic = vec3<f32>(0.20, 0.66, 0.96);
    let right_caustic = vec3<f32>(0.96, 0.58, 0.22);
    let base_caustic = mix(left_caustic, right_caustic, lr_mix);
    let caustic_hue = mix(base_caustic, prism_hi, irid_w * 0.45);

    let pocket = smoothstep(y_lo - 0.032, y_lo + 0.025, y) * smoothstep(y_hi + 0.022, y_hi - 0.016, y);
    let p_t = clamp((y - y_lo) / gap, 0.0, 1.0);
    let pocket_ramp = mix(0.24, 1.0, pow(clamp(p_t, 0.0, 1.0), 1.55));
    let pocket_col = mix(caustic_hue, PURE_ICE, smoothstep(0.55, 0.96, p_t));
    col += pocket_col * pocket * pocket_ramp * (0.22 + 0.34 * core_w_env) * wave_vis;

    // 2) 上缘羽化彩晕与细银沿
    let d_t = y - y_top;
    let top_haze = exp(-sq((d_t + 0.015) / 0.052));
    let top_rim = exp(-sq(d_t / 0.017));
    col += caustic_hue * top_haze * (0.20 + 0.32 * wide_env) * wave_vis;
    col += PURE_ICE * top_rim * (0.14 + 0.18 * wide_env) * wave_vis;

    // 3) 斜穿眼腔内部的细亮 S 形丝脊
    let d_sp = y - y_spine;
    let spine_line = exp(-sq(d_sp / 0.020)) * lens_w * (0.24 + 0.36 * cross_vis) * hud_guard;
    col = mix(col, PURE_ICE, clamp(spine_line * glow_eff * 0.62, 0.0, 0.62));

    // 4) 下弧细锐聚光白脊（保持细窄亮脊以免大面积压低白色前景对比度）
    let d_b = y - y_bot;
    let mist_halo = exp(-sq((y - wave_mid) / 0.15));
    let upper_bloom = exp(-sq(min(d_b, 0.0) / 0.056)) * step(d_b, 0.012);
    let sharp_bot = exp(-sq(max(d_b, 0.0) / 0.018));
    let core_sigma = mix(0.013, 0.030, core_w_env);
    let white_core = (exp(-sq(d_b / core_sigma)) + upper_bloom * 0.28 * core_w_env) * sharp_bot * (0.24 + 0.76 * core_w_env);
    let under_tint = exp(-sq((d_b - 0.026) / 0.038));
    let under_col = mix(vec3<f32>(0.90, 0.62, 0.36), prism_palette(flow_phase + 0.40), irid_w * 0.65);

    col += vec3<f32>(0.68, 0.74, 0.84) * mist_halo * (0.08 + 0.10 * wide_env) * wave_vis;
    col += under_col * under_tint * (0.14 + 0.24 * wide_env) * wave_vis;
    let core_mix = clamp(white_core * (0.84 + 0.14 * travel_hi) * glow_eff * span_env * hud_guard, 0.0, 0.82);
    col = mix(col, vec3<f32>(0.95, 0.96, 0.98), core_mix);

    // 高光柔切限幅，杜绝任何颜色分量超出 [0, 1] 范围
    let hdr_knee = max(col - vec3<f32>(0.84), vec3<f32>(0.0));
    col = min(col - hdr_knee + hdr_knee / (vec3<f32>(1.0) + hdr_knee * 2.4), vec3<f32>(1.0));

    // 左右极窄侧翼玻璃反光与约 1px 极细冷暖色散晶边
    let depth = max(-distance, 0.0);
    if (depth < 12.0 * ppp) {
        let flank_mask = pow(clamp((abs(x) - 0.72) / 0.28, 0.0, 1.0), 1.8) * exp(-depth / (9.0 * ppp));
        let flank_tint = select(WARM_AMBER, ICY_CYAN, x > 0.0);
        col += mix(PURE_ICE, flank_tint, 0.35) * flank_mask * 0.12 * glow_eff;
    }

    var rim_max = 0.0;
    if (abs(distance) < 4.5 * ppp) {
        let sigma = max(optics.edge_width, 0.30 * ppp) * 0.26;
        let prism_offset = 0.56 * ppp * clamp(0.45 + 0.55 * irid_strength, 0.35, 1.25);
        let prism_sign = select(-1.0, 1.0, x * cos(t * 0.28) + y * sin(t * 0.28) >= 0.0);
        let edge_center = -0.35 * ppp;
        let lobe_a = pow(max(dot(normal, light), 0.0), 1.4);
        let lobe_b = pow(max(dot(normal, -light), 0.0), 1.2);
        let edge_vis = mix(0.42, 1.0, smoothstep(-0.75, 0.70, y)) * (0.58 + 0.42 * max(lobe_a, lobe_b * 0.7));

        let rim_rgb = vec3<f32>(
            exp(-sq((distance + prism_sign * prism_offset - edge_center) / sigma)),
            exp(-sq((distance - edge_center) / sigma)),
            exp(-sq((distance - prism_sign * prism_offset - edge_center) / sigma))
        ) * edge_vis * optics.edge_opacity;

        rim_max = max(rim_rgb.r, max(rim_rgb.g, rim_rgb.b));
        let rim_tint = mix(PURE_ICE, mix(WARM_AMBER, ICY_CYAN, 0.5 + 0.5 * x), 0.45 * clamp(irid_strength, 0.0, 1.0));
        col = mix(col, max(rim_rgb, rim_tint * rim_max), clamp(rim_max, 0.0, 0.92));
    }

    // 控件边缘抗锯齿过渡
    if (hit.index < frame.count.x) {
        let control = control_glass(p, hit, light, irid_strength, t, ppp, optics);
        col = mix(col, control.rgb, control.a);
    }

    col = mix(collapsed_col, clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), expand_mix);
    let dither = (hash21(p) - 0.5) * (1.7 / 255.0);

    // 仅在最外沿抗锯齿细带才采样 edge_bg，其余 95%+ 像素零浪费
    if (distance <= -1.35) {
        let final_in = clamp(col + vec3<f32>(dither), vec3<f32>(0.0), vec3<f32>(1.0));
        return vec4<f32>(final_in, 1.0);
    }
    let edge_bg = safe_sample(p, ppp);
    let coverage = clamp(max(aa, rim_max * expand_mix), 0.0, 1.0);
    let color = clamp(mix(edge_bg, col, coverage) + vec3<f32>(dither), vec3<f32>(0.0), vec3<f32>(1.0));
    return vec4<f32>(color * coverage, coverage);
}
