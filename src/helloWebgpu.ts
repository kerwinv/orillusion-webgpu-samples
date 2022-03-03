async function initWebGPU() {
    try{
        if(!navigator.gpu)
            throw new Error('Not support WebGPU')
        const adapter = await navigator.gpu.requestAdapter() as GPUAdapter
        const device = await adapter.requestDevice()
        console.log(device)
        document.body.innerHTML = '<h1>Hello WebGPU</h1>'
        for(let i in device.limits)
            document.body.innerHTML += `<p>${i}:${device.limits[i as keyof GPUSupportedLimits]}</p>`
    }catch(error:any){
        document.body.innerHTML = error.message
    }
}

initWebGPU()