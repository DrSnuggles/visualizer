/*	
	Analyzer
	Just pluggin in the analyzer in between

	for low freq with linear bins maybe https://stackoverflow.com/questions/42313990/javascript-analysernode-low-frequencies-bass
*/

const defaultSettings = {
	fps: 0,
	fft: 11, // pow 2 = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}

export class Analyzer {
	constructor(source, canvasWorker, settings) {
		this.analyserNodes = []
		this.audioInfo = {}
		this.data = []
		this.rAF = null
		this.settings = {...defaultSettings, ...settings}
		this.framerate = 0 // measured
		this.lastTick = performance.now()

		this.canvasWorker = canvasWorker
		return this.setSource(source)
	}

	setSource(source) {
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
		//this.analyserNodes = []
		for (let i = 0, e = source.channelCount; i < e; i++) { // all channels the ctx has
			this.analyserNodes[i] = ctx.createAnalyser()
			this.analyserNodes[i].fftSize = Math.pow(2, this.settings.fft) // default = 2048 // 2^5 .. 2^15 (32..32768)
			this.analyserNodes[i].minDecibels = this.settings.minDB // default = -100
			this.analyserNodes[i].maxDecibels = this.settings.maxDB // default = -30
			this.analyserNodes[i].smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
			// Todo: ^^ needs to be set by visualizers, or ???
			//console.log(i)
			splitter.connect(this.analyserNodes[i], i, 0) // Route each single channel from Splitter --> Analyzer
		}
		source.connect(ctx.destination)	// connect to destination else no audio

		this.sendAudioInfo(ctx)
		this.setFPS( this.settings.fps )

		return this
	}

	loopRAF() {
		// no more IF in loop
		// but another jump (should be faster) ;)
		this.rAF = requestAnimationFrame(()=>{this.loopRAF()})
		this.loop()
	}
	loopTimer() {
		// setTimout(this.loopTimer, 1000/this.fps)
		//console.log('loopTimer')
		this.getFramerate()
		this.loop()
	}
	getFramerate() {
		const now = performance.now()
		this.framerate = 1000 / (now - this.lastTick)
		this.lastTick = now
	}
	loop () {
		//console.log('loop')
		/* now loopRAF
		if (this.fps === 0) {
			this.rAF = requestAnimationFrame(this.loop)  
		} else {
			//this.rAF = setTimeout(this.loop, 1000/this.fps)
		}
		*/

		this.data = {
			freq: [],
			time: [],
		}
		// TimeDomain and Frequency
		// freq (use binCount or fftSize/2)
		//console.time('getByteData')
		for (let i = 0; i < this.analyserNodes.length; i++) {
			// timedomain waveform, goniometer
			this.data.time[i] = new Uint8Array(this.analyserNodes[i].fftSize)
			this.analyserNodes[i].getByteTimeDomainData(this.data.time[i])
			// time is about 10x faster (here freq took about 0.2ms hard to beat with of FFT)

			this.data.freq[i] = new Uint8Array(this.analyserNodes[i].frequencyBinCount)
			this.analyserNodes[i].getByteFrequencyData(this.data.freq[i])
		}
		//console.timeEnd('getByteData')
		this.canvasWorker.postMessage({data: this.data})
	}
	sendAudioInfo(ctx) {
		this.canvasWorker.postMessage({audioInfo: {
			fftSize: this.analyserNodes[0].fftSize,
			minDB: this.analyserNodes[0].minDecibels,
			maxDB: this.analyserNodes[0].maxDecibels,
			smooth: this.analyserNodes[0].smoothingTimeConstant,
			sampleRate: ctx?.sampleRate,
			channels: ctx?.destination.channelCount,
		}})
		/*
		this.audioInfo = {
			fftSize: this.analyserNodes[0].fftSize,
			minDB: this.analyserNodes[0].minDecibels,
			maxDB: this.analyserNodes[0].maxDecibels,
			smooth: this.analyserNodes[0].smoothingTimeConstant,
			sampleRate: ctx.sampleRate,
			channels: ctx.destination.channelCount,
		}
		*/
	}
	setFPS(fps) {
		//console.log('Target FPS: '+ fps)
		// stop loop
		if (this.rAF) {
			if (this.fps === 0) {
				cancelAnimationFrame(this.rAF)
			} else {
				//clearTimeout(this.rAF)
				clearInterval(this.rAF)
			}
			this.rAF = null
		}
		// start loop
		if (fps === 0) {
			//console.log('Using RAF')
			this.rAF = requestAnimationFrame(()=>{this.loopRAF()})
			this.framerate = 'MAX'
		} else {
			//console.log('Using Interval')
			//this.rAF = setTimeout(this.loopTimer, 1000/fps) // slower for tests
			//this.rAF = setInterval(this.loopTimer, 1000/fps) // slower for tests	// did not work in class
			this.rAF = setInterval(()=>{this.loopTimer()}, 1000/fps) // slower for tests

			//this.rAF = setInterval(()=>{
			//	requestAnimationFrame(this.loopTimer)
			//}, 1000/fps) // slower for tests
		}
		this.fps = fps
	}
}
