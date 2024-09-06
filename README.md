# sierrax-camera-ctl 

Node module to support camera control operations.\
Version 1.x.x will be limited to Pan, Tilt and Zoom (PTZ) as well as some basic descriptive helper functions.

To validate:
```
npm install
npm test
```

## Exported Functions
```javascript
getModuleVersion: () => string
```
Returns Module Version
```javascript
getModuleName: () => string
```
Returns Module Name
```javascript
setCurrentCameraByID: (camNo: Number) => String
```
Given a camera number `camNo` sets the active camera and returns it's name
```javascript
setCurrentCameraByName: (camName: String) => String
```
Given a camera name `camName` sets the active camera and returns it's name
```javascript
getCurrentCamera: () => UVCControl::Camera
```
Returns the active camera object
```javascript
getCameraNames: () => [String]
```
Returns an array of all available cameras
```javascript
setZoom: (level: number) => Promise<String>
```
Given a zoom `level` sets the zoom of the current camera
```javascript
setPTZ: (panDegrees: Number, tiltDegrees: Number) => Promise<String>
```
## Important File

[sierra-camera-ctl.js](sierra-camera-ctl.js) - Camera control Module
