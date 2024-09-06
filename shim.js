const {apiResponseRouter, apiHandler, rpcHandler, runModule} = require("asmm");


const workerFilename = "avail-camera-ctl.js";

const version = require("./package.json").version
const name = require("./package.json").name


// This array is the set of Fastify-compatible API endpoints
// that thie ASM module would like to publish.
const restEndpoints = [
    {
        url: "/",
        method: "get",
        handler : (request,reply)=>apiHandler(request, reply, 'getCameraNames')
    },
    {
        url: "/getAllCameras",
        method: "get",
        handler:(request,reply)=>apiHandler(request, reply, 'getCameraNames')
    },
    {
        url: "/setCamera/:camName",
        method: "get",
        handler: (request,reply)=>apiHandler(request, reply, 'setCurrentCameraByName')
    },
    {
        url: "/zoom",
        method: "get",
        handler: (request,reply)=>apiHandler({...request, params:{level : 5}}, reply, 'setZoom')
    },
    {
        url: "/zoom/:camName/:level",
        method: "get",
        handler: (request,reply)=>apiHandler(request, reply, 'setZoom')
    },
    {
        url: "/pantilt/:camName/:pan/:tilt",
        method: "get",
        handler: (request,reply)=>apiHandler(request, reply, 'setPanTilt')
    },

];


// whoAmI provides a short desccriptive text for this ASM module.
// It helps when coming back to debug 3 years later...
const whoAmI = ()=>name

// thisVersion -- always good to know what version of the Module
// is currently running
const thisVersion = ()=>version;

// mUpdate -- routine that gets called on a periodic basis from
// the core ASM operations.  It can be ignored, or scaled to respond
// at a frequency that is appropriate for the module's function
async function myUpdate() {
    const results = {
        updateTime: Date.now(),
        name: whoAmI(),
        version: thisVersion()
    }
    const P = new Promise(
        async (resolve)=>{
                resolve(results)
        }
    );
    return P;
}

// initialize() -- this routine is what sets up and starts this ASM Module.
// It should return a promise so as to not stop ASM from doing other
// important operations.
async function initialize( options ) {

    const { moduleFolder } = options;

    const workerHandle = runModule(`${moduleFolder}${workerFilename}`);

    const p = new Promise(
        async (resolve,reject)=>{
            // Initialize our serializer to receive API responses
            // from the worker module
            apiResponseRouter( workerHandle );
            let initResult;
            try {
              initResult = await rpcHandler('init')
            } catch (e) {
                reject(e)
            }
            resolve(true);
        }
    );
    return p;
}


//--------------------------------
// factory()
//   Factory is the module's registration function.  When ASM
// loads this module, it will execute factory() and expect that
// the factory will return the Module's desscriptor object
//--------------------------------
function factory() {

    return {
        initialize: initialize,
        update: myUpdate,
        whoami: whoAmI,
        version: thisVersion,
        rest: restEndpoints
    }
}
module.exports = factory;

