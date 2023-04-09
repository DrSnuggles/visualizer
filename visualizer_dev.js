/*	
	Visualizer, now as class for multiple instances
*/
import {Analyzer} from './analyzer.js'

const defaultSettings = {
	fps: 0,
	fft: 11, // pow 2 = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}

export class Visualizer {
	constructor(source, canvas, settings) {

		// Canvas offscreen worker
		this.canvasWorker = new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'}) // import.meta.url: https://stackoverflow.com/questions/12417216/javascript-not-resolving-worker-path-relative-to-current-script
		//this.canvasWorker = new Worker(URL.createObjectURL( new Blob([``], {type:'text/javascript'}) ), {type: 'module'}),
		this.audioSource = source,
		this.settings = {...defaultSettings, ...settings}
		
		// first call
		// cannot change dimensions after transfer, so max for best fullscreen
		canvas.width = screen.width * this.settings.scale
		canvas.height = screen.height * this.settings.scale
		canvas.style.cssText = 'user-select:none;'
		canvas.ondblclick = (ev) => { canvas.requestFullscreen() }
		canvas.onfullscreenchange = (ev) => {
			if (document.fullscreenElement)		// .fullscreenElement only on document
				canvas.style.cursor = 'none'
			else
				canvas.style.cursor = 'inherit'
		}
			
		const offscreen = canvas.transferControlToOffscreen()
		this.canvasWorker.postMessage({ canvas: offscreen }, [offscreen]) // its nicer to pack the transfered objects into a new one
		this.analyzer = new Analyzer(this.audioSource, this.canvasWorker, this.settings)
		// further calls this.analyzer.setSource(this.audioSource)
		return this
	}
}
