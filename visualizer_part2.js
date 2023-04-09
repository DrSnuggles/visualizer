`], {type:'text/javascript'}) ), {type: 'module'}),
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