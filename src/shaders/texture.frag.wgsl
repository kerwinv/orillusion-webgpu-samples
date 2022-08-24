struct VertexUniform {
    offset: f32,
    speed: f32,
    time: f32
}

@group(0) @binding(0) var<uniform> uniforms : VertexUniform;
@group(1) @binding(0) var Sampler: sampler;
@group(1) @binding(1) var Texture: texture_2d<f32>;

// 生产0-1间的随机值
fn random(uv: vec2<f32>) -> f32 {
  return fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453123);
}

fn randomRange (standard: vec2<f32> ,min: f32, max:f32) -> f32 {
	return min + random(standard) * (max - min);
}

@stage(fragment)
fn main(@location(0) fragPosition: vec4<f32>,
        @location(1) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
  var maxOffset = uniforms.offset / 9.0;
  var cTime = floor(uniforms.time * uniforms.speed * 50);
  var texOffset: vec2<f32> = vec2(randomRange(vec2(cTime + maxOffset, 9999.0), -maxOffset, maxOffset), randomRange(vec2(cTime, 9999.0), -maxOffset, maxOffset));
  var uvOff = fract(fragUV + texOffset);
  var rnd = random(vec2(cTime, 9999.0));
  var color = textureSample(Texture, Sampler, fragUV).rgb;
  var changedColor = textureSample(Texture, Sampler, uvOff);
  if (rnd <= 0.33) {
    color.r = changedColor.r;
  } else if (rnd <= 0.66) {
    color.g = changedColor.g;
  } else {
    color.b = changedColor.b;
  }
  return vec4(color, 1.0);
}