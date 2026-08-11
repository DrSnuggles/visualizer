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

// canonical defaults, shared with visualizer_dev.js (single source of truth)
// fft: 0 = auto (resolved by Visualizer); Analyzer falls back to 11 when 0/falsy
export const defaultSettings = {
	fps: 0,
	fft: 0, // 0 = auto; 11 pow 2 = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}
/* old local default (fft: 11), kept for reference:
const defaultSettings = {
	fps: 0,
	fft: 11, // 11 pow 2 = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}
*/

export class Analyzer {
	constructor(source, canvasWorker, settings) {
		//console.log(settings)
		this.analyserNodes = []
		this.audioInfo = {}
		this.data = []
		this.rAF = null
		this.settings = {...defaultSettings, ...settings}
		this.framerate = 0 // measured
		this.lastTick = performance.now()

		this.canvasWorker = canvasWorker
		// AnalyzerNode can't write into a SharedArrayBuffer directly, and SAB only exists
		// on pages served with COOP + COEP (crossOriginIsolated). Use it when available
		// (worker reads the same memory -> zero copy), otherwise fall back to ArrayBuffer
		// (typed arrays are copied to the worker per frame via postMessage).
		try {
			if (typeof SharedArrayBuffer === 'undefined' ||
				(typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated))
				throw new Error('SharedArrayBuffer unavailable (needs COOP+COEP / crossOriginIsolated)')
			// zero-copy: afford the full 2ch * 32768 samples (Float32) -> fftSize up to 32768
			this.sab32 = new SharedArrayBuffer( 2 * 32768 * 4 )	// 2 channels * maxSamples * 4 bytes
			this.sab8 = new SharedArrayBuffer( 16384 )			// mono freq, max binCount = 32768/2
			// One atomic counter publishes a complete new audio observation to the worker.
			// It replaces the former empty postMessage tick in the SAB path.
			this.sabState = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
			this.sab = true
			this.maxFFT = 15 // 2^15 = 32768
			console.log('Visualizer: using SharedArrayBuffer (zero-copy), max fftSize 32768')
		} catch(e) {
			// copy per frame: keep buffers small so postMessage stays cheap -> cap fftSize at 8192
			this.sab32 = new ArrayBuffer( 2 * 8192 * 4 )		// 2 channels * 8192 samples * 4 bytes
			this.sab8 = new ArrayBuffer( 16384 )
			this.sabState = null
			this.sab = false
			this.maxFFT = 13 // 2^13 = 8192
			console.log('Visualizer: using ArrayBuffer (copy per frame, no SharedArrayBuffer) —', e.message)
		}
		/* old short version (always ArrayBuffer), kept for reference:
		this.sab32 = new ArrayBuffer( (2 * 32768 ) )
		this.sab8 = new ArrayBuffer( 16384 )
		this.sab = false
		*/

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
			// close a previously self-created context before making a new one (avoid leak)
			if (this.ctx && this.ownsContext) this.ctx.close()
			ctx = new AudioContext() // samplerate = default settings e.g. 48kHz
			this.ownsContext = true // we created it -> we must close it on dispose
			source = ctx.createMediaElementSource(source)
		} else {
			ctx = source.context
			this.ownsContext = false // external context, do not close
		}
		this.ctx = ctx

		if (source.numberOfOutputs < 2) {
			splitter = ctx.createChannelSplitter( source.channelCount )
			source.connect(splitter) // Input --> Splitter
		} else {
			splitter = source
		}
		//console.log(ctx, source)
		const fftExp = Math.min(this.settings.fft || 11, this.maxFFT) // 0/falsy -> 2048; cap to buffer capacity (8192 w/o SAB, 32768 w/ SAB)
		//this.analyserNodes = []
		//for (let i = 0, e = source.channelCount; i < e; i++) { // all channels the ctx has
		for (let i = 0, e = 2; i < e; i++) { // all channels the ctx has !! no just display 2
			this.analyserNodes[i] = ctx.createAnalyser()
			this.analyserNodes[i].fftSize = Math.pow(2, fftExp) // default = 2048 // 2^5 .. 2^15 (32..32768)
			this.analyserNodes[i].minDecibels = this.settings.minDB // default = -100
			this.analyserNodes[i].maxDecibels = this.settings.maxDB // default = -30
			this.analyserNodes[i].smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
			// Todo: ^^ needs to be set by visualizers, or ???
			splitter.connect(this.analyserNodes[i], i, 0) // Route each single channel from Splitter --> Analyzer
		}
		// also add another one over all channels for fft
		this.analyserNode = ctx.createAnalyser()
		this.analyserNode.fftSize = Math.pow(2, fftExp) // default = 2048 // 2^5 .. 2^15 (32..32768)
		this.analyserNode.minDecibels = this.settings.minDB // default = -100
		this.analyserNode.maxDecibels = this.settings.maxDB // default = -30
		this.analyserNode.smoothingTimeConstant = this.settings.smooth // 0..1 default = 0.8
		source.connect(this.analyserNode) // Route all channels to this fft Analyzer

		source.connect(ctx.destination)	// connect to destination else no audio

		// preallocate reusable buffers (avoid per-frame allocations in loop(), less GC)
		this._sab8 = new Uint8Array(this.sab8)   // view over output buffer (freq)
		this._sab32 = new Float32Array(this.sab32) // view over output buffer (time)
		this._sabState = this.sab ? new Int32Array(this.sabState) : null
		this._time = new Float32Array(this.analyserNodes[0].fftSize) // scratch per channel
		this._freq = new Uint8Array(this.analyserNode.frequencyBinCount) // scratch fft

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
		// fftSize can change at runtime (e.g. player FFT slider) -> resize scratch buffers to match,
		// otherwise getFloatTimeDomainData only fills the old (smaller) length -> stale right half
		if (this._time.length !== chSize) {
			this._time = new Float32Array(chSize)
			this._freq = new Uint8Array(this.analyserNode.frequencyBinCount)
		}
		// reuse preallocated buffers (see setSource), no per-frame allocations
		const sab8 = this._sab8
		const sab32 = this._sab32
		const t = this._time
		/* old (allocating) version, kept for reference:
		let sab8 = new Uint8Array( this.sab8 )
		let sab32 = new Float32Array( this.sab32 )
		let t = new Float32Array(this.analyserNodes[0].fftSize)
		*/
		for (let i = 0; i < this.analyserNodes.length; i++) {
			// timedomain waveform, goniometer
			this.analyserNodes[i].getFloatTimeDomainData(t)
			// sab didnt work !!! this.analyserNodes[i].getByteTimeDomainData( new Uint8Array( this.sab.slice(0, 0*32768) ) )
			// time is about 10x faster (here freq took about 0.2ms hard to beat with of FFT)
			//u8.set(t, i*chSize)
			sab32.set(t, i*chSize)	// need to copy over to shared arraybuffer
		}
		// fft just once
		//t = new Uint8Array(this.analyserNode.frequencyBinCount)
		const f = this._freq // reused scratch fft buffer
		this.analyserNode.getByteFrequencyData(f)
		sab8.set(f, 0)

		//console.timeEnd('getByteData')
		//this.canvasWorker.postMessage({data: this.data})
		//const ab = u8.buffer
		//this.canvasWorker.postMessage(ab, [ab])	// avoid json here to gain bit speed JSON is really fast but collecting all
		if (this.sab)
			// Publish only after both output arrays have been filled. Atomics makes this
			// visible to the worker without creating a per-frame message-queue task.
			Atomics.add(this._sabState, 0, 1)
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
			sabState: this.sabState,
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
	setFFT(exp) {
		// runtime fftSize change (e.g. player slider). Clamp to buffer capacity so the
		// per-frame writes never overflow sab32 (8192 without SAB, 32768 with SAB).
		exp = Math.min(exp | 0, this.maxFFT)
		const fft = Math.pow(2, exp)
		for (let i = 0; i < this.analyserNodes.length; i++) this.analyserNodes[i].fftSize = fft
		this.analyserNode.fftSize = fft
		this.settings.fft = exp
		// loop() resizes _time/_freq lazily; notify the worker viz (fftSize, spectrogram tables, ...)
		this.sendAudioInfo(this.ctx)
		return exp // clamped value, so the caller can sync its UI
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
	dispose() {
		// stop polling loop
		if (this.rAF) {
			if (this.fps === 0) cancelAnimationFrame(this.rAF)
			else clearInterval(this.rAF)
			this.rAF = null
		}
		// close the AudioContext only if we created it ourselves (avoid leak)
		if (this.ctx && this.ownsContext) {
			this.ctx.close()
			this.ctx = null
		}
	}
}
