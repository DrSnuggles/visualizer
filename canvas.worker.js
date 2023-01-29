/*
	Worker for OffscreenCanvas
*/
import {Waveform} from './viz/waveform.js'
import {Spectrogram} from './viz/spectrogram.js'
import {Goniometer} from './viz/goniometer.js'

let viz = []

onmessage = function(e) {
	//console.log(e.data)
	// most used on top
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

	// 1st init = transfer of offscreen canvas
	if (e.data.canvas) {
		const tmp = e.data.canvas.getContext('2d')
		viz.push(new Goniometer(tmp, 0, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Spectrogram(tmp, 'LINEAR', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Waveform(tmp, 0, tmp.canvas.width/2, tmp.canvas.width, tmp.canvas.height - tmp.canvas.width/2))
		return
	}

	// 2nd init = after analyzer setup
	if (e.data.audioInfo) {
		for (let i = 0; i < viz.length; i++) {
			viz[i].setAudio(e.data.audioInfo)
		}
		//console.log(e.data.audioInfo)
		return
	}

	// still here ?
	console.error('Unknown message:', e.data)
}
