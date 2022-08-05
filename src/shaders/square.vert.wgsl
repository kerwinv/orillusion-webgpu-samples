struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
};

@stage(vertex)
fn main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 1.0);
}