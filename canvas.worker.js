/*
	Worker for OffscreenCanvas
*/
import {Waveform} from './viz/waveform.js'
import {Spectrogram} from './viz/spectrogram.js'
import {Goniometer} from './viz/goniometer.js'

let viz = []
let dat

onmessage = function(e) {
	//console.log(e.data.byteLength)
	// most used on top
	if (e.data.process) {
		//console.time('process')
		//for (let i = 0; i < viz.length; i++) {
			//console.time('viz #'+i)
		//	viz[i].clear()
			//viz[i].drawBG()
		//	viz[i].drawFG()
			//console.timeEnd('viz #'+i)
		//}
		/*
		viz[0].clear()
		viz[0].drawFG(e.data.process[0])
		viz[1].clear()
		viz[1].drawFG(e.data.process[1])
		viz[2].clear()
		viz[2].drawFG(e.data.process[0])
		*/
		dat = e.data
		//console.timeEnd('process')
		return
	}
	/*
	if (e.data.byteLength) {
		const u8 = new Uint8Array(e.data)
		for (let i = 0; i < viz.length; i++) {
			//console.time('viz #'+i)
			viz[i].clear()
			//viz[i].drawBG()
			viz[i].drawFG(u8)
			//console.timeEnd('viz #'+i)
		}
		return
	}
	// below is obsolete
	if (e.data.data) {
		//console.time('draw all viz')
		//const startTime = performance.now()
		for (let i = 0; i < viz.length; i++) {
			//console.time('viz #'+i)
			viz[i].clear()
			//viz[i].drawBG()
			viz[i].drawFG(e.data.data)
			//console.timeEnd('viz #'+i)
		}
		//const runTime = performance.now() - startTime
		//console.timeEnd('draw all viz')
		//if (runTime > 6) // 120fps = 8.333ms
		//	console.info('long running:', runTime)
		return
	}
	*/

	// 1st init = transfer of offscreen canvas
	if (e.data.canvas) {
		const tmp = e.data.canvas.getContext('2d')
		viz.push(new Goniometer(tmp, 0, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Spectrogram(tmp, 'LINEAR', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
//		viz.push(new Spectrogram(tmp, 'LOG', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		//viz.push(new Spectrogram(tmp, 'CONSTANT_Q', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Waveform(tmp, 0, tmp.canvas.width/2, tmp.canvas.width, tmp.canvas.height - tmp.canvas.width/2))
		return
	}

	// 2nd init = after analyzer setup
	if (e.data.audioInfo) {
		for (let i = 0; i < viz.length; i++) {
			viz[i].setAudio(e.data.audioInfo)
		}
		//console.log(e.data.audioInfo)
		requestAnimationFrame(renderLoop) // is this late enough?
		return
	}

	// still here ?
	console.error('Unknown message:', e.data)
}

function renderLoop(delta) {
	//console.time('renderLoop')
	requestAnimationFrame(renderLoop)
	if (!dat) return
	try {
		viz[0].clear()
		viz[0].drawFG(dat.process[0])
		viz[1].clear()
		viz[1].drawFG(dat.process[1])
		viz[2].clear()
		viz[2].drawFG(dat.process[0])
	} catch(e) {
		console.error('Error in canvas.worker renderLoop', e)
	}
	//console.timeEnd('renderLoop')
}
// requestAnimationFrame(renderLoop) // too early