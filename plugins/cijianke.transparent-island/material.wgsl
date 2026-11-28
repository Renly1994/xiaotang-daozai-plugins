// An alpha-zero surface leaves the host's foreground controls and hit testing intact.
fn material(_input: MaterialIn) -> vec4<f32> {
    return vec4<f32>(0.0);
}
