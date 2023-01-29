/*	
	Analyzer
	Just pluggin in the analyzer in between

	for low freq with linear bins maybe https://stackoverflow.com/questions/42313990/javascript-analysernode-low-frequencies-bass
*/
export const analyzer = {
	analyserNodes: [],
	audioInfo: {},
	data: [],
	rAF: null,
	canvasWorker: null,
	fps: 0, // wanted FPS, 0=request animationframe
	framerate: 0, // measured
	lastTick: performance.now(),
	init: (source, canvasWorker, fps = analyzer.fps) => {
		analyzer.canvasWorker = canvasWorker
		//
		// disconnect input nodes from destination??? not that easy
		// or reconnect the sources.... more easy
		// problem: if source is scriptprocessor
		//
		let ctx
		let splitter
		//console.log(source)
		if (!source) return
		if (source.tagName) {
			ctx = new AudioContext() // samplerate = default settings e.g. 48kHz
			source = ctx.createMediaElementSource(source)
		} else {
			ctx = source.context
		}

		//console.log('source.channelCount', source.channelCount)
		splitter = ctx.createChannelSplitter( source.channelCount )
		//console.log(splitter)
		source.connect(splitter) // Input --> Splitter
		//console.log(ctx, source)
		analyzer.analyserNodes = []
		for (let i = 0, e = source.channelCount; i < e; i++) { // all channels the ctx has
			analyzer.analyserNodes[i] = ctx.createAnalyser()
			analyzer.analyserNodes[i].fftSize = 2048 // default = 2048 // 2^5 .. 2^15 (32..32768)
			analyzer.analyserNodes[i].minDecibels = -100 // default = -100
			analyzer.analyserNodes[i].maxDecibels = -30 // default = -30
			analyzer.analyserNodes[i].smoothingTimeConstant = 0 // 0..1 default = 0.8
			// Todo: ^^ needs to be set by visualizers, or ???
			//console.log(i)
			splitter.connect(analyzer.analyserNodes[i], i, 0) // Route each single channel from Splitter --> Analyzer
		}
		source.connect(ctx.destination)	// connect to destination else no audio

		analyzer.sendAudioInfo(ctx)
		analyzer.setFPS( fps )

		//console.log(analyzer)
		return analyzer
	},
	loopRAF: () => {
		// no more IF in loop
		// but another jump (should be faster) ;)
		analyzer.rAF = requestAnimationFrame(analyzer.loopRAF)
		analyzer.loop()
	},
	loopTimer: () => {
		// setTimout(analyzer.loopTimer, 1000/analyzer.fps)
		analyzer.getFramerate()
		analyzer.loop()
	},
	getFramerate: () => {
		const now = performance.now()
		analyzer.framerate = 1000 / (now - analyzer.lastTick)
		analyzer.lastTick = now
	},
	loop: () => {
		/* now loopRAF
		if (analyzer.fps === 0) {
			analyzer.rAF = requestAnimationFrame(analyzer.loop)  
		} else {
			//analyzer.rAF = setTimeout(analyzer.loop, 1000/analyzer.fps)
		}
		*/

		analyzer.data = {
			freq: [],
			time: [],
		}
		// TimeDomain and Frequency
		// freq (use binCount or fftSize/2)
		//console.time('getByteData')
		for (let i = 0; i < analyzer.analyserNodes.length; i++) {
			// timedomain waveform, goniometer
			analyzer.data.time[i] = new Uint8Array(analyzer.analyserNodes[i].fftSize)
			analyzer.analyserNodes[i].getByteTimeDomainData(analyzer.data.time[i])
			// time is about 10x faster (here freq took about 0.2ms hard to beat with of FFT)

			analyzer.data.freq[i] = new Uint8Array(analyzer.analyserNodes[i].frequencyBinCount)
			analyzer.analyserNodes[i].getByteFrequencyData(analyzer.data.freq[i])
		}
		//console.timeEnd('getByteData')
		analyzer.canvasWorker.postMessage({data: analyzer.data})
	},
	sendAudioInfo:(ctx) => {
		analyzer.canvasWorker.postMessage({audioInfo: {
			fftSize: analyzer.analyserNodes[0].fftSize,
			minDB: analyzer.analyserNodes[0].minDecibels,
			maxDB: analyzer.analyserNodes[0].maxDecibels,
			smooth: analyzer.analyserNodes[0].smoothingTimeConstant,
			sampleRate: ctx?.sampleRate,
			channels: ctx?.destination.channelCount,
		}})
		/*
		analyzer.audioInfo = {
			fftSize: analyzer.analyserNodes[0].fftSize,
			minDB: analyzer.analyserNodes[0].minDecibels,
			maxDB: analyzer.analyserNodes[0].maxDecibels,
			smooth: analyzer.analyserNodes[0].smoothingTimeConstant,
			sampleRate: ctx.sampleRate,
			channels: ctx.destination.channelCount,
		}
		*/
	},
	setFPS:(fps) => {
		//console.log('Target FPS: '+ fps)
		// stop loop
		if (analyzer.rAF) {
			if (analyzer.fps === 0) {
				cancelAnimationFrame(analyzer.rAF)
			} else {
				//clearTimeout(analyzer.rAF)
				clearInterval(analyzer.rAF)
			}
			analyzer.rAF = null
		}
		// start loop
		if (fps === 0) {
			//console.log('Using RAF')
			analyzer.rAF = requestAnimationFrame(analyzer.loopRAF)
			analyzer.framerate = 'MAX'
		} else {
			//console.log('Using Timeout')
			//analyzer.rAF = setTimeout(analyzer.loopTimer, 1000/fps) // slower for tests
			analyzer.rAF = setInterval(analyzer.loopTimer, 1000/fps) // slower for tests
			//analyzer.rAF = setInterval(()=>{
			//	requestAnimationFrame(analyzer.loopTimer)
			//}, 1000/fps) // slower for tests
		}
		analyzer.fps = fps
	}
}
