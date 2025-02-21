struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) fragPosition: vec4<f32>
};

@stage(vertex)
fn main(@location(0) position : vec4<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.Position = position;
    output.fragPosition = position;
    return output;
}