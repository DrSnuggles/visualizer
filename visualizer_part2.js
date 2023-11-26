`], {type:'text/javascript'}) ), {type: 'module'}),
	this.audioSource = source,
	this.settings = {...defaultSettings, ...settings}

	// autoFFTsize
	// try to make it like the canvas size => wave fftSize = canvas.width = screen.width
	// get rid of complex settings
	if (this.settings.fft === 0) {
		for (let i = 5; i < 16; i++) {
			if (Math.pow(2, i) >= screen.width * this.settings.scale) {
				this.settings.fft = i
				//console.log('AutoFFT size: '+ Math.pow(2, i))
				break
			}
		}
		// ^^ this is the max needed fftSize for at least one pixel per screen.width
	}

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
	this.canvasWorker.postMessage({ canvas: offscreen, devicePixelRatio: devicePixelRatio }, [offscreen]) // its nicer to pack the transfered objects into a new one
	this.analyzer = new Analyzer(this.audioSource, this.canvasWorker, this.settings)
	// further calls this.analyzer.setSource(this.audioSource)
	return this
	}
}