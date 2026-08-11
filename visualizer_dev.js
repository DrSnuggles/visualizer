/*	
	Visualizer, now as class for multiple instances
*/
import {Analyzer, defaultSettings} from './analyzer.js' // single source of truth for defaults

/* old local copy, now imported from analyzer.js (see #8):
const defaultSettings = {
	fps: 0,
	fft: 0, // 11 pow 2 = 2048;   0=auto
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}
*/

export class Visualizer {
	constructor(source, canvas, settings) {
		// Canvas offscreen worker
		this.canvasWorker = new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'}) // import.meta.url: https://stackoverflow.com/questions/12417216/javascript-not-resolving-worker-path-relative-to-current-script
		//this.canvasWorker = new Worker(URL.createObjectURL( new Blob([``], {type:'text/javascript'}) ), {type: 'module'}),
		this.audioSource = source
		this.settings = {...defaultSettings, ...settings}

		// mobiles and portait mode
		let width = Math.max(screen.width, screen.height)
		let height = Math.min(screen.width, screen.height)
		if (/Mobi/i.test(navigator.userAgent) || window.safari !== undefined) {
			width = Math.max(visualViewport.width, visualViewport.height)
			height = Math.min(visualViewport.width, visualViewport.height)
		}

		// autoFFTsize
		// try to make it like the canvas size => wave fftSize = canvas.width = screen.width
		// get rid of complex settings
		if (this.settings.fft === 0) {
			for (let i = 5; i < 16; i++) {
				if (Math.pow(2, i) >= width * this.settings.scale) {
					this.settings.fft = i
					console.log('AutoFFT size: '+ Math.pow(2, i))
					break
				}
			}
			// ^^ this is the max needed fftSize for at least one pixel per screen.width
		}
		
		// first call
		// cannot change dimensions after transfer, so max for best fullscreen
		try {
			canvas.width = width * this.settings.scale
			canvas.height = height * this.settings.scale
			canvas.style.cssText += ';user-select:none;'
			canvas.ondblclick = (ev) => { canvas.requestFullscreen() }
			canvas.onfullscreenchange = (ev) => {
				if (document.fullscreenElement)		// .fullscreenElement only on document
					canvas.style.cursor = 'none'
				else
					canvas.style.cursor = 'inherit'
			}
				
			const offscreen = canvas.transferControlToOffscreen()
			// pass settings too so the worker can build an optional custom layout (settings.layout)
			this.canvasWorker.postMessage({ canvas: offscreen, devicePixelRatio: devicePixelRatio, settings: this.settings }, [offscreen]) // its nicer to pack the transfered objects into a new one
		}
		catch(e) {
			console.info('Visualizer recalled. Use .analyzer.setSource() instead')
			throw(e)
		}

		this.analyzer = new Analyzer(this.audioSource, this.canvasWorker, this.settings)
		// further calls this.analyzer.setSource(this.audioSource)
		return this
	}

	exit() {
		// kill worker
		this.canvasWorker.terminate()
		// stop analyzer polling AND close the (self-created) AudioContext
		this.analyzer.dispose()
		/* old inline cleanup (now in Analyzer.dispose, also closes AudioContext):
		if (this.analyzer.fps === 0) {
			cancelAnimationFrame(this.analyzer.rAF)
		} else {
			clearInterval(this.analyzer.rAF)
		}
		*/
		// todo: more cleanup like canvas event??
	}
}
