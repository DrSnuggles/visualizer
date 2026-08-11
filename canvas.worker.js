/*
	Worker for OffscreenCanvas
*/
import {Waveform} from './viz/waveform.js'
import {Spectrogram} from './viz/spectrogram.js'
import {Goniometer} from './viz/goniometer.js'

let viz = [],
	dat, raf = 0, dirty = false, sabState = null, lastFrame = 0

// registry so layouts can be defined by type name (configurable, see settings.layout)
const VIZ_CLASSES = {Goniometer, Spectrogram, Waveform}

// default layout. args are passed to the constructor after ctx.
// src selects the data source per frame: 0 = time domain (sab32, process[0]),
//                                        1 = frequency  (sab8,  process[1]).
function defaultLayout(W, H) {
	const half = W / 2
	return [
		{type: 'Goniometer',  src: 0, args: [0, 0, half, half, 2, 4]}, // args 5,6 = decimate tolerance px (0=off), step stride (1=all, 2=half, ...)
		{type: 'Spectrogram', src: 1, args: ['LINEAR', 'A', half, 0, half, half]},
		//{type: 'Spectrogram', src: 1, args: ['LOG', 'A', half, 0, half, half]},
		//{type: 'Spectrogram', src: 1, args: ['CONSTANT_Q', 'A', half, 0, half, half]},
		{type: 'Waveform',    src: 0, args: [0, half, W, H - half]},
	]
}

function buildViz(ctx, layout) {
	viz = []
	for (const item of layout) {
		const Cls = VIZ_CLASSES[item.type]
		if (!Cls) { console.error('Unknown viz type:', item.type); continue }
		const v = new Cls(ctx, ...(item.args || []))
		v.src = item.src || 0 // which process[] buffer to feed in renderLoop
		viz.push(v)
	}
}

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
		// The analyzer may deliberately run below display refresh rate.  Do not redraw
		// the same shared/copied audio frame in every worker rAF: it wastes canvas work
		// and advances the spectrogram history without a new audio observation.
		dirty = true
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
		const tmp = e.data.canvas.getContext('2d', {alpha: false}) // opaque canvas: skip alpha compositing -> faster fills/strokes/clears
		// generic, configurable build (settings.layout overrides the default)
		const layout = (e.data.settings && e.data.settings.layout) || defaultLayout(tmp.canvas.width, tmp.canvas.height)
		buildViz(tmp, layout)
		/* old hardcoded build, kept for reference:
		viz.push(new Goniometer(tmp, 0, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Spectrogram(tmp, 'LINEAR', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
//		viz.push(new Spectrogram(tmp, 'LOG', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		//viz.push(new Spectrogram(tmp, 'CONSTANT_Q', 'A', tmp.canvas.width/2, 0, tmp.canvas.width/2, tmp.canvas.width/2))
		viz.push(new Waveform(tmp, 0, tmp.canvas.width/2, tmp.canvas.width, tmp.canvas.height - tmp.canvas.width/2))
		*/
		return
	}

	// 2nd init = after analyzer setup
	if (e.data.audioInfo) {
		for (let i = 0; i < viz.length; i++) {
			viz[i].setAudio(e.data.audioInfo)
		}
		// Select the transport-specific loop once.  The render hot paths below stay
		// branch-free: SAB reads cached views; ArrayBuffer reads its latest message.
		sabState = e.data.audioInfo.sabState ? new Int32Array(e.data.audioInfo.sabState) : null
		lastFrame = sabState ? Atomics.load(sabState, 0) : 0
		//console.log(e.data.audioInfo)
		if (!raf) raf = requestAnimationFrame(sabState ? renderLoopSAB : renderLoopCopy)
		return
	}

	// still here ?
	console.error('Unknown message:', e.data)
}

function renderLoopSAB(delta) {
	raf = requestAnimationFrame(renderLoopSAB)
	const frame = Atomics.load(sabState, 0)
	if (frame === lastFrame) return
	lastFrame = frame
	try {
		for (let i = 0; i < viz.length; i++) {
			viz[i].clear()
			viz[i].drawFG(viz[i].sabData)
		}
	} catch(e) {
		console.error('Error in canvas.worker SAB renderLoop', e)
	}
}

function renderLoopCopy(delta) {
	raf = requestAnimationFrame(renderLoopCopy)
	if (!dat || !dirty) return
	// A message cannot interleave with this synchronous render. Clear the flag before
	// drawing so the next queued process message schedules one new render.
	dirty = false
	try {
		const process = dat.process
		for (let i = 0; i < viz.length; i++) {
			viz[i].clear()
			viz[i].drawFG(process[viz[i].src])
		}
		/* old hardcoded version, kept for reference:
		viz[0].clear()
		viz[0].drawFG(dat.process[0])
		viz[1].clear()
		viz[1].drawFG(dat.process[1])
		viz[2].clear()
		viz[2].drawFG(dat.process[0])
		*/
	} catch(e) {
		console.error('Error in canvas.worker copy renderLoop', e)
	}
}
