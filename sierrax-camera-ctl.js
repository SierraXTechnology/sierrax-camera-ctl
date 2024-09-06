

const { usb, getDeviceList } = require("usb");
const UVCControl = require("uvc-camctl")
const camera = new UVCControl();
const process = require("process");
const {Mutex, withTimeout} = require('async-mutex')


const asmm = require('asmm');
const {jss,logger} = asmm;
const {name,version} = require("./package.json");
const defaultConfig = require("./camera-ctl-config.json");
let setRawMutexWithTimeout, config;


process.on("uncaughtException",(error,origin)=>{
    logger(`*** UNCAUGHT EXCEPTION: ${error}\nOrigin:${origin}`,"error")
});


camState = {
    currentCamera : -1,
    cameras: 'Module Unitialized',
    availableCameras: []
}

/***
 * Helper functions
 */
const toArcSeconds = (n)=> 3600*n;

const toZoomLevel = (z)=> z/30 * 65535;

const isWebcam = (device) => {
    return device.deviceDescriptor.bDeviceClass ===  0xef
     && device.deviceDescriptor.bDeviceSubClass === 0x02
     && device.deviceDescriptor.bDeviceProtocol === 0x01
}

const getCamIDFromName = (camName) => {
    return camState.availableCameras.findIndex(camera => camera.name === camName);
}

const getWebCameras = async () => {
    const devices = getDeviceList();
    const results = await Promise.all(devices);
    const webcams = results.filter( f=>isWebcam(f) )
    return webcams;
}

const loadAvailableCameras = (cameras) => {
    const me="loadAvailableCameras()"
    const P = new Promise(
        (resolve, reject) => {
            let camerasLeft = cameras.length
            logger(`${me} detected [ ${camerasLeft} ] cameras`)
            cameras.forEach(camera => {
                camera.open();
                camera.getStringDescriptor(camera.deviceDescriptor.iProduct,
                    (error, camName) => {
                    if(error) reject(error)
                    camState.availableCameras.push({
                        name : camName,
                        camera: {
                            prod: camName,
                            ven : camera.deviceDescriptor.idVendor,
                            prodid: camera.deviceDescriptor.idProduct
                        },
                        deviceAddress : camera.deviceAddress,
                        camera
                    })
                    camera.close()
                    camerasLeft--
                    if (camerasLeft === 0)
                        resolve(true)
                    })
                })
        }
    )
    return P
}

const setZoom = async (msg) => {
    const me = "setZoom()";
    const P = new Promise(
        async (resolve, reject) => {
            let {sn, level, camName} = msg.params;
            logger(`${me} zoomLevel= ${level}, camera: ${camName}`);
            if(camName === undefined) {
                    if (camState.currentCamera === -1 ) {
                        reject(asmm.createApiResponse(msg.sn,'fail','error',
                        `No Camera Selected`));
                        return;
                    }
                     else {
                        camName = getCurrentCamera().name;
                    }
            }
            // try {
            //  await setCurrentCameraByName({sn, params: {camName}});
            // } catch (e) {
            //     logger(`${me} ERROR: ${e}`,"error")
            //     reject(e);
            //     return;
            // }

            const buffer = Buffer.alloc(2);
            try {
                buffer.writeIntLE(toZoomLevel(level), 0,2);
                await setRawMutexWithTimeout.runExclusive(async () => {
                    await setCurrentCameraByName({sn, params: {camName}});
                    await camera.setRaw('absoluteZoom',buffer)
                })
            } catch (e) {
                logger(`${me} ERROR: ${e}`,"error")
                reject(asmm.createApiResponse(msg.sn,'fail','error',
                `${e.message} on ${camName} ERRNO:${e.errno}`))
            }
            camera.close()
            resolve(asmm.createApiResponse(msg.sn,'ok',
            `SUCCESS - ${camName} zoomed ${level} `))

        })
    return P
}



const setPanTilt = ( msg ) => {
    const me = "setPanTilt()";
    const P = new Promise(
        async (resolve, reject) => {
            let {camName, pan: panDegrees, tilt: tiltDegrees} = msg.params;
            logger(`${me} pan/tilt: [ ${panDegrees}, ${tiltDegrees} ]`)
            // let pan  = toArcSeconds(panDegrees);
            // let tilt = toArcSeconds(tiltDegrees);
            // let result;
            // try {
            // } catch (e) {
            //     logger(`${me} ERROR: ${e}`,"error")
            //     reject(e);
            //     return;
            // }
            const buffer = Buffer.alloc(8);
            buffer.writeIntLE(toArcSeconds(panDegrees),0,4);
            buffer.writeIntLE(toArcSeconds(tiltDegrees),4,4);
            try {
                await setRawMutexWithTimeout.runExclusive(async () => {
                    await setCurrentCameraByName(msg);
                    await camera.setRaw('absolutePanTilt',buffer,)
                })                
            } catch (e) {
                logger(`${me} ERROR pan/tilt: ${e}`,"error")
                reject(asmm.createApiResponse(msg.sn,'fail','error',
                `${e.message} on ${camName} ERRNO:${e.errno}`))
            }
            camera.close()
            resolve(asmm.createApiResponse(msg.sn,'ok',
            `SUCCESS - ${camName} moved pan:${panDegrees} degrees, tilt:${tiltDegrees} degrees`))

        })
        return P
}




const init = async (msg) => {
    const me = "init()";
    //Allow the calling function to overwrite the default parameters
    config = {...defaultConfig,...msg.params}
    const P = new Promise(
        async (resolve, reject) => {
            logger(`${me} initializing name: ${name} version: ${version}`)
            setRawMutexWithTimeout = withTimeout(new Mutex(),config.rawMutexTimeout)
            try {
                await loadAvailableCameras(await getWebCameras())
            } catch (e) {
                reject(asmm.createApiResponse(msg.sn,'fail',
                `ACM ERROR - ${e}`,500))
            }

            let response = {...asmm.apiResponseObject};

            response.status = "ok"
            response.sn = msg.sn;
            response.response = {
                status: "Initialized",

            }
            resolve(response)
        })
    return P

}


const setCurrentCameraByName = ({sn, params: {camName}}) => {
    const me= "setCurrentCameraByName()";
    logger(`${me} setting to: ${camName}`)
    const camNo =getCamIDFromName(camName)
    return setCurrentCameraByID({sn, params: {camNo}});
}

const setCurrentCameraByID = (msg) => {
    const me = "setCurrentCameraByID()"
    logger(`${me} setting camera camSTate.currentCamera: ${jss(msg.params)}`)
    const P = new Promise((resolve, reject) => {
        let {camNo = camState.currentCamera} = msg.params;
        if (camNo < 0 || camNo >= camState.availableCameras.length) {
            const emsg = "Camera not found"
            logger(`${me} ERROR: ${emsg}`,"error")
            reject(asmm.createApiResponse(msg.sn,'fail','error',emsg));
            return;
            }
        camState.currentCamera = camNo;
        const cameraDevice = camState.availableCameras[camState.currentCamera];
        camera.device = cameraDevice.camera;
        camera.device.open()
        camera.device.interfaces.forEach(x => {
            if (x.descriptor.bInterfaceClass == 0x0e && x.descriptor.bInterfaceSubClass == 0x01)
            camera.interfaceNumber = x.interfaceNumber
            })
        resolve(asmm.createApiResponse(msg.sn,cameraDevice.name,
            `SUCCESS - Camera set to ${cameraDevice.name}`))
        })
    return P
}

const getCameraNames = (msg) => {
    const P = new Promise((resolve, reject) => {
        try {
         resolve(asmm.createApiResponse(msg.sn,'success',
             camState.availableCameras.map(camera => camera.name)))
         } catch (e) {
            reject(asmm.createApiResponse(msg.sn,'fail',
                `No Cameras Availalble`))
         }
    })
    return P
}

const getCurrentCamera = () => {
    return camState.availableCameras[camState.currentCamera]
}

const getRandomIntInclusive = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
  }



exports._test = async () => {

    let camNo = 0
    console.log(`******`)
    console.log(`****** Module: ${name} Version: ${version} ******`)
    console.log(`******`)
    let webCams = await getWebCameras()
    let availableCameras = await loadAvailableCameras(webCams)
    let cameraNames = await getCameraNames({sn:1})
    setCurrentCameraByName({sn: 1, params: {camName: cameraNames.response[camNo]}})
    console.log(`   Camera set to ${cameraNames.response[camNo]}`)
    let msg = {
        sn: 1,
        params: {
            camName:cameraNames.response[camNo], 
            pan: getRandomIntInclusive(-30,30),
            tilt: getRandomIntInclusive(-30,30),
            level: getRandomIntInclusive(-15,14)
        }
    }
    try {
    await init(msg)
    console.log(`   Pan Tilt to ${msg.params.pan} and ${msg.params.tilt}`)
    await setPanTilt(msg)
    console.log(`   Zoom to ${msg.params.level}`)
    await setZoom(msg)
    } catch (e) {
        console.error(e)
    }
    console.log(`******`)
    process.exit()
};

asmm.loadHandlers(
    {
        setPanTilt,
        init,
        setCurrentCameraByID,
        setZoom,
        getCameraNames,
        setCurrentCameraByName
    })
