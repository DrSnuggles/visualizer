`], {type:'text/javascript'}) ), {type: 'module'}),
audioSource: null,
analyzer: null,
settings: {
	fps: 0,
	fft: 11, // pow = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
},
init: (source, canvas, settings = visualizer.settings) => {
	//console.log('visualizer.init', source, canvas, screen)
	//canvas.width = canvas.offsetWidth //screen.width// max possible for fullscreen
	//canvas.height = canvas.offsetWidth*screen.height/screen.width//screen.height// could also be changed on fullscreen and view
	// cannot change dimensions after transfer, so max for best fullscreen
	visualizer.audioSource = source
	visualizer.settings = {...visualizer.settings, ...settings}
	// Canvas offscreen worker
	try {
		canvas.width = screen.width * visualizer.settings.scale
		canvas.height = screen.height * visualizer.settings.scale
		const offscreen = canvas.transferControlToOffscreen()
		visualizer.canvasWorker.postMessage({ canvas: offscreen }, [offscreen]) // its nicer to pack the transfered objects into a new one
		visualizer.analyzer = analyzer.init(visualizer.audioSource, visualizer.canvasWorker, visualizer.settings)
	}catch(e){
		// not the first time here
		visualizer.analyzer = analyzer.init(visualizer.audioSource, visualizer.canvasWorker)
	}
	return visualizer
},
/*
addUserInteract: () => {
	// stupid no audio till user interaction policy thingy
	addEventListener('keydown', visualizer.userInteract, { passive: true })
	addEventListener('click', visualizer.userInteract, { passive: true })
	addEventListener('touchstart', visualizer.userInteract, { passive: true })
},
userInteract: () => {
	visualizer.analyzer = analyzer.init(visualizer.audioSource, visualizer.canvasWorker, visualizer.settings)
	//visualizer.canvasWorker.postMessage({ audioInfo: analyzer.audioInfo })
	removeEventListener('keydown', visualizer.userInteract)
	removeEventListener('click', visualizer.userInteract)
	removeEventListener('touchstart', visualizer.userInteract)

	//console.log(visualizer)
},
*/
}

//visualizer.addUserInteract()