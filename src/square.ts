import squareVert from './shaders/square.vert.wgsl?raw'
import colerFrag from './shaders/square.frag.wgsl?raw'
import * as square from './util/square'

interface IPipelLineStruct {
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    uniformGroup: GPUBindGroup;
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
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: squareVert
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 3 * 4, // 每个顶点分割的长度
                attributes: [{
                    format: "float32x3", // 大小
                    offset: 0,
                    shaderLocation: 0
                }]
            }]
        },
        primitive: {
            topology: 'triangle-strip' // try point-list, line-list, line-strip, triangle-strip, triangle-list?
        },
        fragment: {
            module: device.createShaderModule({
                code: colerFrag
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        }
    }
    // 创建buffer配置/描述
    const vertexDescriptor: GPUBufferDescriptor = {
        size: square.vertex.byteLength, // buffer大小
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST // 用途，顶点buffer及可从js中改变
    }
    // 创建动态颜色buffer
    const colorUniformDescriptor: GPUBufferDescriptor = {
        label: "uniform color buffer for square", // 用于debug
        size: 4 * 4, // rgba
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }
    // 创建顶点buffer
    const vertexBuffer = device.createBuffer(vertexDescriptor)
    // 创建uniform buffer 
    const uniformBuffer = device.createBuffer(colorUniformDescriptor);

    // 写数据
    device.queue.writeBuffer(vertexBuffer, 0, square.vertex)
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([1, 1, 0, 1]))
    
    // 创建渲染流水线(render pipeline仅关心绘制)
    const pipeline = await device.createRenderPipelineAsync(descriptor)
    // 创建bindgroup
    const uniformGroup = device.createBindGroup({
        label: 'Uniform Group with colorBuffer',
        layout: pipeline.getBindGroupLayout(0), // bind布局，可以自己创建，也可以通过这种方式简单获取
        entries: [
            {
                binding: 0, // group中的资源bind的唯一标识
                resource: {
                    buffer: uniformBuffer
                }
            }
        ]
    })
    
    return  {pipeline, vertexBuffer, uniformBuffer, uniformGroup}
}
// create & submit device commands
function draw(device: GPUDevice, context: GPUCanvasContext, pipelineObj: IPipelLineStruct) {
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
    // 4 vertex form a square
    passEncoder.draw(square.vertexCount)

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
    // start draw
    draw(device, context, pipeLineObj)
    
    // re-configure context on resize
    window.addEventListener('resize', ()=>{
        canvas.width = canvas.clientWidth * devicePixelRatio
        canvas.height = canvas.clientHeight * devicePixelRatio
        // don't need to recall context.configure() after v104
        draw(device, context, pipeLineObj)
    })
}
run()