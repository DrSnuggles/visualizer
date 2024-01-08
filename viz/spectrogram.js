/*
	Based on: https://github.com/mmontag/chip-player-js/blob/master/src/Spectrogram.js
	Reworked by: DrSnuggles (no deps, class in offscreen canvas worker...)
*/

import {makeColorMap} from './makeColorMap.js'

export class Spectrogram {
	constructor(ctx,mode = 'LOG', weighting = 'A', x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
		this.ctx = ctx
		this.x = x
		this.y = y
		this.width = w
		this.height = h
		this.colorMap = makeColorMap([
			'#000000',
			'#0000a0',
			'#6000a0',
			'#962761',
			'#dd1440',
			'#f0b000',
			'#ffffa0',
			'#ffffff',
		])
		this.tempCanvas = new OffscreenCanvas(this.width, this.height)// for gradient ?? needed ??
		this.tempCtx = this.tempCanvas.getContext('2d', {alpha: false}) // for repeated copy
		this.MODE = mode // LINEAR, LOG, CONSTANT_Q
		this.WEIGHTING = weighting // NONE, A
		
		this.hCoeff = this.height*0.2 // top 20% are used for spec, lower 80% for history
		this.bins = 1024 // overwritten after audio init
		this.nyquist = 48000 / 2 // half of sampleRate overwritten after audio init
		this.maxHearableBin = 1023 // overwritten after audio init by makebins
		this.lastData = []

		// A Weighting
		const freqTable = this.makeBinFreqs()
		this._aWeightingLUT = freqTable.map(f => 0.5 + 0.5 * this._getAWeighting(f))

		//console.log(this)
	}
	clear() {
		// clear
		const ctx = this.ctx
		ctx.fillStyle = 'rgb(0, 0, 0)'
		//ctx.fillRect(this.x, this.y, this.width, this.hCoeff)
		ctx.fillRect(this.x, this.y, this.width, this.height)
	}
	//drawBG() {} // not called
	drawFG(dat) {
		//console.time('drawFG spectogram')
		const data = dat ? dat : new Uint8Array( this.sab )
		const ctx = this.ctx
		const width = this.width
		const hCoeff = this.hCoeff
		const bins = this.bins

		//const data = dat.freq[0]
		//const data = dat.freq
		//console.log(bins,data)
		const specSpeed = 2
		//const specCtx = this.specCtx;
	
		//const dataHeap = new Float32Array(this.lib.HEAPF32.buffer, this.dataPtr, this.cqtSize);
		//const bins = this.fftSize / 2
		let isRepeated = false // this.isRepeatedFrequencyData(data)
		// @48kHz -> nyquist = 24kHz
		// 1024 bins (default fftSize = 2048)
		// bin[0] = 0Hz
		// bin[1] = ~23Hz
		// bin[1023] = ~24kHz
		// ^^^^ start at bin 1 not 0 and stop at 20kHz (not hearable)
		// !!! do start at 0 again its a huge gap at 16 or 32 bins
		//const scaleX = width / bins
		const scaleX = width / (this.maxHearableBin+1)
		if (this.MODE === 'LINEAR') {
			//analyserNode.getByteFrequencyData(data);
			//data = new Uint8Array(data[0])	// convert float to byte
			//console.log(data[0])
			for (let i = 0; i <= this.maxHearableBin; i++) {
				//console.log(data[x], getColor(data[x]))
				//const style = this.colorMap[data[i]]
				//let val = Math.max(data[0][i], data[1][i])
				//let val = Math.max(data[this.fftSize+i], data[this.fftSize*2.5+i])
				let val = data[i]
				const style = this.colorMap[ val ]
				const h = ((this.WEIGHTING === 'A') ? this._aWeightingLUT[i]/1.4 : 1) * val/256 * hCoeff | 0
				const x = i*scaleX
				//if (i == this.maxHearableBin) console.log(i, scaleX, x, width, this.bins, val)
				ctx.fillStyle = style
				ctx.fillRect((this.x+x), (this.y+hCoeff - h), scaleX, h)
				this.tempCtx.fillStyle = style
				this.tempCtx.fillRect(x, 0, scaleX, specSpeed)
			}
		}
		else if (this.MODE === 'LOG') {
			//analyserNode.getByteFrequencyData(data);
			//data = new Uint8Array(data[0]) // convert float to byte
			const logmax = Math.log(this.maxHearableBin)
			for (let i = 0; i <= this.maxHearableBin; i++) {
				const x =        (Math.log(i + 1) / logmax) * width | 0
				const binWidth = (Math.log(i + 2) / logmax) * width - x | 0
				const h =        ((this.WEIGHTING === 'A') ? this._aWeightingLUT[i]/1.4 : 1) * data[i]/256 * hCoeff | 0
				//const style =    this.colorMap[data[i] || 0]
				//const style = this.colorMap[ Math.max(data[this.fftSize+i], data[this.fftSize*2.5+i], 0) ]
				const style = this.colorMap[ data[i] ]
				ctx.fillStyle = style
				ctx.fillRect((this.x+x), (this.y+hCoeff - h), binWidth, h)
				this.tempCtx.fillStyle = style
				this.tempCtx.fillRect(x, 0, binWidth, specSpeed)
			}
		} else if (this.MODE === 'CONSTANT_Q') {
			// not sure if i want webassembly code here
			//analyserNode.getFloatTimeDomainData(dataHeap)
			const dataHeap = data.slice(0, this.fftSize) // TODO: just left channel (do i need a mono time analysernode)
			if (!dataHeap.every(n => n === 0)) {
				this.lib._cqt_calc(this.dataPtr, this.dataPtr)
				this.lib._cqt_render_line(this.dataPtr)
				// copy output to canvas
				for (let x = 0; x < canvasWidth; x++) {
					const weighting = WEIGHTING === 'A' ? _aWeightingLUT[x] : 1
					const val = 255 * weighting * dataHeap[x] | 0 //this.lib.getValue(this.cqtOutput + x * 4, 'float') | 0;
					const h = val * hCoeff | 0
					const style = getColor(val)
					ctx.fillStyle = style
					ctx.fillRect((this.x+x), (this.y+fqHeight - h), 1, h)
					this.tempCtx.fillStyle = style
					this.tempCtx.fillRect(x, 0, 1, specSpeed)
				}
			}
		}
		if (!isRepeated) {
			// tempCtx.drawImage(this.specCanvas, 0, 0);
			// translate the transformation matrix. subsequent draws happen in this frame
			this.tempCtx.translate(0, specSpeed)
			// draw the copied image
			this.tempCtx.drawImage(this.tempCanvas, 0, 0)
			// reset the transformation matrix
			this.tempCtx.setTransform(1, 0, 0, 1, 0, 0)
			
			ctx.drawImage(this.tempCanvas, this.x, (this.y+hCoeff))
		}

		//console.timeEnd('drawFG spectogram')
	}
	setAudio(info) {
		this.fftSize = info.fftSize
		this.bins = info.fftSize/2
		if (info.channels) {
			this.nyquist = info.sampleRate/2
			this.channels = info.channels
		}

		// A Weighting
		const freqTable = this.makeBinFreqs()
		this._aWeightingLUT = freqTable.map(f => 0.5 + 0.5 * this._getAWeighting(f))

		this.sab = info.sab8
	}

	// Helpers
	_getAWeighting(f) {
		const f2 = f*f
		return 1.5 * 1.2588966 * 148840000 * f2*f2 / ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148840000))
	}
	isRepeatedFrequencyData(data) {
		// Jitter correction: ignore repeated frequency data in spectrogram
		let isRepeated = true
		for (let i = 0; i < this.bins; i+=16) { // checks every 16th val
			if (data[i] !== this.lastData[i]) {
				isRepeated = false
			}
			this.lastData[i] = data[i]
		}
		return isRepeated
	}
	cqt_bin_to_freq(bin, basefreq, endfreq) {
		const log_base = Math.log(basefreq)
		const log_end = Math.log(endfreq)
		return Math.exp(log_base + (bin + 0.5) * (log_end - log_base) * (1.0 / width))
	}
	makeBinFreqs() {
		// web audio analysers are linear from 0 to nyquist (thats half sample rate, but audio device one NOT audio src one)
		const ret = []
		for (let i = 0; i < this.bins; i++) {
			ret[i] =  i/this.bins * this.nyquist
			if (ret[i] < 20000) this.maxHearableBin = i // max hearable 20kHz
		}
		//console.log('maxHearableBin', this.maxHearableBin, this.bins, this.maxHearableBin/this.bins) // ratio @44.1kHz=0.9  @48kHz=0.8  @192kHz=0.2
		return ret
	}
}