import textureVert from './shaders/texture.vert.wgsl?raw'
import textureFrag from './shaders/texture.frag.wgsl?raw'
import * as texture from './util/texture'
import textureUrl from '/text.png?url'

interface IPipelLineStruct {
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    uniformGroup: GPUBindGroup;
    unis: IUniformStruct;
}

interface IUniformStruct {
    offset: number;
    speed: number;
    time: number;
}

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
        // powerPreference: 'low-power'
    })
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = {width: canvas.width, height: canvas.height}
    context.configure({
        // json specific format when key and value are the same
        device, format,
        // prevent chrome warning
        alphaMode: 'opaque'
    })
    return {device, context, format, size}
}
// create a simple pipiline
async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
    const descriptor: GPURenderPipelineDescriptor = {
        label:"texture render pipeline",
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: textureVert
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 5 * 4, // 每个顶点分割的长度， 3 vertex position 2 uv position
                attributes: [{ // 每个element的大小配置
                    // position
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x3'
                },
                {
                    // uv
                    shaderLocation: 1,
                    offset: 3 * 4,
                    format: 'float32x2'
                }]
            }]
        },
        primitive: {
            topology: 'triangle-strip' // try point-list, line-list, line-strip, triangle-strip, triangle-list?
        },
        fragment: {
            module: device.createShaderModule({
                code: textureFrag
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        }
    }
    // 创建顶点buffer配置/描述
    const vertexDescriptor: GPUBufferDescriptor = {
        size: texture.vertex.byteLength, // buffer大小
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST // 用途，顶点buffer及可从js中改变
    }
    // 创建动态offset/speed/time等参数buffer
    const uniformDescriptor: GPUBufferDescriptor = {
        label: "uniform buffer for texture", // 用于debug
        size: 3 * 4, // offset&speed&time
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }
    // 创建顶点buffer
    const vertexBuffer = device.createBuffer(vertexDescriptor)
    // 创建uniform buffer 
    const uniformBuffer = device.createBuffer(uniformDescriptor);

    // 写数据
    device.queue.writeBuffer(vertexBuffer, 0, texture.vertex)
    // const unis = new Proxy<IUniformStruct>({
    //     offset: 0,
    //     speed: 0,
    //     time: 0
    // }, {
    //     set: function(target, key, v) {
    //         if (Reflect.has(target, key)) {
    //             Reflect.set(target, key, v);
    //             device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([target.offset, target.speed, target.time]));
    //             return true;
    //         }
    //         return false;
    //     }
    // });
    const unis: IUniformStruct = {
        offset: 0.5,
        speed: 0.3,
        time: 0
    }
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(Object.values(unis)))
    
    // 创建渲染流水线(render pipeline仅关心绘制)
    const pipeline = await device.createRenderPipelineAsync(descriptor)

    // 创建bindgroup
    const uniformGroup = device.createBindGroup({
        label: 'Uniform Group with uniformBuffer',
        layout: pipeline.getBindGroupLayout(0), // bind布局，可以自己创建，也可以通过这种方式简单获取
        entries: [
            {
                binding: 0, // offset
                resource: {
                    buffer: uniformBuffer
                }
            }
        ]
    })
    
    return  {pipeline, vertexBuffer, uniformBuffer, uniformGroup, unis}
}
// create & submit device commands
function draw(device: GPUDevice, context: GPUCanvasContext, pipelineObj: IPipelLineStruct, textureGroup: GPUBindGroup) {
    const { pipeline, vertexBuffer, uniformGroup } = pipelineObj;
    const commandEncoder = device.createCommandEncoder()
    const view = context.getCurrentTexture().createView()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: view,
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear', // clear/load
                storeOp: 'store' // store/discard
            }
        ]
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipeline)
    // set vertex
    passEncoder.setVertexBuffer(0, vertexBuffer)
    // set bind group(要先于draw)
    passEncoder.setBindGroup(0, uniformGroup)
    // set textureGroup
    passEncoder.setBindGroup(1, textureGroup)
    // 4 vertex form a square
    passEncoder.draw(texture.vertexCount)

    passEncoder.end()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    const {device, context, format} = await initWebGPU(canvas)
    const pipeLineObj = await initPipeline(device, format)

    // fetch an image and upload to GPUTexture
    const res = await fetch(textureUrl)
    const img = await res.blob()
    // const img = document.createElement('img')
    // img.src = textureUrl
    // await img.decode()
    const bitmap = await createImageBitmap(img)
    const textureSize = [bitmap.width, bitmap.height]
    // create empty texture
    // 贴图纹理创建（空容器）
    const texture = device.createTexture({
        size: textureSize,
        format: 'rgba8unorm', // 8 bit 纹理格式
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    })
    // update image to GPUTexture
    // 拷入纹理数据
    device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: texture },
        textureSize
    )
    // Create a sampler with linear filtering for smooth interpolation.
    // 创建采样器
    const sampler = device.createSampler({
        // addressModeU: 'repeat',
        // addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear'
    })
    const textureGroup = device.createBindGroup({
        label: 'Texture Group with Texture/Sampler',
        layout: pipeLineObj.pipeline.getBindGroupLayout(1), 
        entries: [
            {
                binding: 0,
                resource: sampler
            },
            {
                binding: 1,
                resource: texture.createView() // gpu操作的texture逻辑
            }
        ]
    })

    // start draw
    draw(device, context, pipeLineObj, textureGroup)

    const todayDateObj = (() => {
        let oDate = new Date()
        oDate.setHours(0, 0, 0, 0)
        return oDate
    })()

    let diffTime = (new Date().getTime() - todayDateObj.getTime()) / 1e3
    let loop = () => {
        requestAnimationFrame(() => {
            diffTime = (new Date().getTime() - todayDateObj.getTime()) / 1e3 // 以秒传入，保留毫秒以实现速度变化
            const {unis, uniformBuffer} = pipeLineObj
            unis.time = diffTime
            device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(Object.values(unis)))
            draw(device, context, pipeLineObj, textureGroup)
            loop()
        })
    }
    loop()
    
    // re-configure context on resize
    // window.addEventListener('resize', ()=>{
    //     canvas.width = canvas.clientWidth * devicePixelRatio
    //     canvas.height = canvas.clientHeight * devicePixelRatio
    //     // don't need to recall context.configure() after v104
    //     // draw(device, context, pipeLineObj)
    // })
}
run()