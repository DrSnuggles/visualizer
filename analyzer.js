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
		// not possible to let AnalyzerNode to write into Shared directly
		this.sab = new SharedArrayBuffer( 2 * 32768 + 16384 )	// maxChannels * maxSize // rethink this! actually we are just using stereo visualizers... or?
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
		//for (let i = 0, e = source.channelCount; i < e; i++) { // all channels the ctx has
		for (let i = 0, e = 2; i < e; i++) { // all channels the ctx has !! no just display 2
			this.analyserNodes[i] = ctx.createAnalyser()
			this.analyserNodes[i].fftSize = Math.pow(2, this.settings.fft) // default = 2048 // 2^5 .. 2^15 (32..32768)
			this.analyserNodes[i].minDecibels = this.settings.minDB // default = -100
			this.analyserNodes[i].maxDecibels = this.settings.maxDB // default = -30
			this.analyserNodes[i].smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
			// Todo: ^^ needs to be set by visualizers, or ???
			//console.log(i)
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
		let sab8 = new Uint8Array( this.sab )
		let t = new Uint8Array(this.analyserNodes[0].fftSize)
		for (let i = 0; i < this.analyserNodes.length; i++) {
			// timedomain waveform, goniometer
			this.analyserNodes[i].getByteTimeDomainData(t)
			// sab didnt work !!! this.analyserNodes[i].getByteTimeDomainData( new Uint8Array( this.sab.slice(0, 0*32768) ) )
			// time is about 10x faster (here freq took about 0.2ms hard to beat with of FFT)
			//u8.set(t, i*chSize)
			sab8.set(t, i*chSize)	// need to copy over to shared arraybuffer
		}
		// fft just once
		t = new Uint8Array(this.analyserNode.frequencyBinCount)
		this.analyserNode.getByteFrequencyData(t)
		//sab8.set(t, this.analyserNodes.length*(chSize))
		sab8.set(t, 2*32768)

		//console.timeEnd('getByteData')
		//this.canvasWorker.postMessage({data: this.data})
		//const ab = u8.buffer
		//this.canvasWorker.postMessage(ab, [ab])	// avoid json here to gain bit speed JSON is really fast but collecting all
		this.canvasWorker.postMessage('process')
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
			sab: this.sab,
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
