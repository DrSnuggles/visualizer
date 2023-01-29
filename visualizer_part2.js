`], {type:'text/javascript'}) ), {type: 'module'}),
	audioSource: null,
	analyzer: null,
	iniFPS: 0,
	init: (source, canvas, superScale = 1, fps = visualizer.iniFPS) => {
		//console.log('visualizer.init', source, canvas, screen)
		//canvas.width = canvas.offsetWidth //screen.width// max possible for fullscreen
		//canvas.height = canvas.offsetWidth*screen.height/screen.width//screen.height// could also be changed on fullscreen and view
		// cannot change dimensions after transfer, so max for best fullscreen
		visualizer.audioSource = source
		visualizer.iniFPS = fps
		// Canvas offscreen worker
		try {
			canvas.width = screen.width * superScale
			canvas.height = screen.height * superScale
			const offscreen = canvas.transferControlToOffscreen()
			visualizer.canvasWorker.postMessage({ canvas: offscreen }, [offscreen]) // its nicer to pack the transfered objects into a new one
		}catch(e){
			// not the first time here
			visualizer.analyzer = analyzer.init(visualizer.audioSource, visualizer.canvasWorker)
		}
		return visualizer
	},
	addUserInteract: () => {
		// stupid no audio till user interaction policy thingy
		addEventListener('keydown', visualizer.userInteract, { passive: true })
		addEventListener('click', visualizer.userInteract, { passive: true })
		addEventListener('touchstart', visualizer.userInteract, { passive: true })
	},
	userInteract: () => {
		visualizer.analyzer = analyzer.init(visualizer.audioSource, visualizer.canvasWorker, visualizer.iniFPS)
		//visualizer.canvasWorker.postMessage({ audioInfo: analyzer.audioInfo })
		removeEventListener('keydown', visualizer.userInteract)
		removeEventListener('click', visualizer.userInteract)
		removeEventListener('touchstart', visualizer.userInteract)

		//console.log(visualizer)
	},
}

visualizer.addUserInteract()
