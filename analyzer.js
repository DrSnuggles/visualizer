/*	
	Analyzer
	Just pluggin in the analyzer in between

	for low freq with linear bins maybe https://stackoverflow.com/questions/42313990/javascript-analysernode-low-frequencies-bass
	
	available time for analyzer AND visualizer
	 24fps = 41.67ms
	 30fps = 33.33ms
	 60fps = 16.67ms
	120fps =  8.33ms

	analyzer speed depends on fftSize on my computer
	2^5  =    32 =  0.2ms
	2^6  =    64 =  ?.?ms
	2^7  =   128 =  ?.?ms
	2^8  =   256 =  ?.?ms
	2^9  =   512 =  0.3ms
	2^10 =  1024 =  0.5ms
	2^11 =  2048 =  0.8ms
	2^12 =  4096 =  1.4ms
	2^13 =  8192 =  2.7ms
	2^14 = 16384 =  5.2ms
	2^15 = 32768 = 10.0ms
	^^^linear at the end     sab.set() does no much effect NICE (0.015ms per channel * 2(wave+fft))

	single fft node !!! cutted time by around 2
	with 16k fftSize i have now 2.7ms

	since this depends very much on machine used best is to measure for a moment and adept

*/

const defaultSettings = {
	fps: 0,
	fft: 11, // 11 pow 2 = 2048
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
		// not possible to let AnalyzerNode to write into Shared directly
		// and shared only exists on servers with COEP + COOP
		try {
			this.sab32 = new SharedArrayBuffer( (2 * 32768 ) )	// maxChannels * maxSize // rethink this! actually we are just using stereo visualizers... or?
			this.sab8 = new SharedArrayBuffer( 16384 )	// max mono uint8 for byteFrequencyDomain
			this.sab = true
		} catch(e) {
			console.log('Vizualizer: No SharedArrayBuffer, using ArrayBuffer.')
			this.sab32 = new ArrayBuffer( (2 * 32768 ) )
			this.sab8 = new ArrayBuffer( 16384 )
			this.sab = false
		}
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

		if (source.numberOfOutputs < 2) {
			splitter = ctx.createChannelSplitter( source.channelCount )
			source.connect(splitter) // Input --> Splitter
		} else {
			splitter = source
		}
		//console.log(ctx, source)
		//this.analyserNodes = []
		//for (let i = 0, e = source.channelCount; i < e; i++) { // all channels the ctx has
		for (let i = 0, e = 2; i < e; i++) { // all channels the ctx has !! no just display 2
			this.analyserNodes[i] = ctx.createAnalyser()
			this.analyserNodes[i].fftSize = Math.pow(2, this.settings.fft) // default = 2048 // 2^5 .. 2^15 (32..32768)
			this.analyserNodes[i].minDecibels = this.settings.minDB // default = -100
			this.analyserNodes[i].maxDecibels = this.settings.maxDB // default = -30
			this.analyserNodes[i].smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
			// Todo: ^^ needs to be set by visualizers, or ???
			splitter.connect(this.analyserNodes[i], i, 0) // Route each single channel from Splitter --> Analyzer
		}
		// also add another one over all channels for fft
		this.analyserNode = ctx.createAnalyser()
		this.analyserNode.fftSize = Math.pow(2, this.settings.fft) // default = 2048 // 2^5 .. 2^15 (32..32768)
		this.analyserNode.minDecibels = this.settings.minDB // default = -100
		this.analyserNode.maxDecibels = this.settings.maxDB // default = -30
		this.analyserNode.smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
		source.connect(this.analyserNode) // Route all channels to this fft Analyzer

		source.connect(ctx.destination)	// connect to destination else no audio

		this.sendAudioInfo(ctx)
		this.setFPS( this.settings.fps )

		return this
	}

	loopRAF() {
		// no more IF in loop
		// but another jump (should be faster) ;)
		this.rAF = requestAnimationFrame(()=>{this.loopRAF()})
		this.getFramerate()
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
		//this.framerate = 1000 / (now - this.lastTick)
		this.framerate = (this.framerate + 1000 / (now - this.lastTick)) / 2 // bit more avg
		this.lastTick = now
		//console.log(this.framerate)
	}
	loop () {
		//console.time('loop')
		//console.log('loop')
		/* now loopRAF
		if (this.fps === 0) {
			this.rAF = requestAnimationFrame(this.loop)  
		} else {
			//this.rAF = setTimeout(this.loop, 1000/this.fps)
		}
		*/

		// TimeDomain and Frequency
		// freq (use binCount or fftSize/2)
		//console.time('getByteData')
		// takes 0.15 -> 0.45 ms
		//let ab = new ArrayBuffer( this.analyserNodes.length*(this.analyserNodes[i].fftSize+this.analyserNodes[i].frequencyBinCount)  )		// channels max TIME + FFT
		const chSize = this.analyserNodes[0].fftSize// now at the end + this.analyserNodes[0].frequencyBinCount // fftSize*1.5
		//let u8 = new Uint8Array( this.analyserNodes.length * chSize  )		// channels max TIME + FFT
		let sab8 = new Uint8Array( this.sab8 )
		let sab32 = new Float32Array( this.sab32 )
		let t = new Float32Array(this.analyserNodes[0].fftSize)
		for (let i = 0; i < this.analyserNodes.length; i++) {
			// timedomain waveform, goniometer
			this.analyserNodes[i].getFloatTimeDomainData(t)
			// sab didnt work !!! this.analyserNodes[i].getByteTimeDomainData( new Uint8Array( this.sab.slice(0, 0*32768) ) )
			// time is about 10x faster (here freq took about 0.2ms hard to beat with of FFT)
			//u8.set(t, i*chSize)
			sab32.set(t, i*chSize)	// need to copy over to shared arraybuffer
		}
		// fft just once
		t = new Uint8Array(this.analyserNode.frequencyBinCount)
		this.analyserNode.getByteFrequencyData(t)
		sab8.set(t, 0)

		//console.timeEnd('getByteData')
		//this.canvasWorker.postMessage({data: this.data})
		//const ab = u8.buffer
		//this.canvasWorker.postMessage(ab, [ab])	// avoid json here to gain bit speed JSON is really fast but collecting all
		if (this.sab)
			this.canvasWorker.postMessage({process: []})
		else
			this.canvasWorker.postMessage({process: [sab32, sab8]})
		//console.log(this.framerate)
		//console.timeEnd('loop')
	}
	sendAudioInfo(ctx) {
		this.canvasWorker.postMessage({audioInfo: {
			fftSize: this.analyserNodes[0].fftSize,
			minDB: this.analyserNodes[0].minDecibels,
			maxDB: this.analyserNodes[0].maxDecibels,
			smooth: this.analyserNodes[0].smoothingTimeConstant,
			sampleRate: ctx?.sampleRate,
			channels: ctx?.destination.channelCount,
			sab32: this.sab32,
			sab8: this.sab8,
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
