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

		// per-column draw tables for the current MODE (provisional, rebuilt in setAudio)
		this.makeColumns()
		// (was: this.makeHeightLUT() + this.makeCQT(), now unified)

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
		const data = dat
		// old SAB fallback allocated a new TypedArray view for every draw:
		// const data = dat ? dat : new Uint8Array(this.sab)
		const ctx = this.ctx
		const hCoeff = this.hCoeff
		const specSpeed = 2
		const isRepeated = false // jitter correction disabled (see isRepeatedFrequencyData)
		// One loop for LINEAR / LOG / CONSTANT_Q — the per-mode differences (which bins to read,
		// x position, bar width, height scale) are baked into the tables by makeColumns().
		const binLo = this._binLo
		if (binLo) {
			const binHi = this._binHi
			const colX = this._colX
			const colW = this._colW
			const hLUT = this._hLUT
			const colorMap = this.colorMap
			const tctx = this.tempCtx
			const px = this.x
			const yTop = this.y + hCoeff
			const N = binLo.length
			for (let c = 0; c < N; c++) {
				// max-pool the FFT bins mapped to this column (exactly one for LINEAR/LOG)
				let val = 0
				for (let b = binLo[c], e = binHi[c]; b <= e; b++) if (data[b] > val) val = data[b]
				const h = hLUT[c] * val | 0
				const style = colorMap[ val ]
				const x = colX[c], w = colW[c]
				ctx.fillStyle = style
				ctx.fillRect(px + x, yTop - h, w, h)
				tctx.fillStyle = style
				tctx.fillRect(x, 0, w, specSpeed)
			}
		}
		/* previous per-mode 3-branch version (replaced by the unified loop above), kept for reference:
		const scaleX = width / (this.maxHearableBin+1)
		if (this.MODE === 'LINEAR') {
			for (let i = 0; i <= this.maxHearableBin; i++) {
				const val = data[i], style = this.colorMap[val], h = this._hLUT[i]*val|0, x = i*scaleX
				ctx.fillStyle = style; ctx.fillRect(this.x+x, this.y+hCoeff-h, scaleX, h)
				this.tempCtx.fillStyle = style; this.tempCtx.fillRect(x, 0, scaleX, specSpeed)
			}
		} else if (this.MODE === 'LOG') {
			const logmax = Math.log(this.maxHearableBin)
			for (let i = 0; i <= this.maxHearableBin; i++) {
				const val = data[i]
				const x = (Math.log(i+1)/logmax)*width|0
				const binWidth = (Math.log(i+2)/logmax)*width - x|0
				const h = this._hLUT[i]*val|0, style = this.colorMap[val]
				ctx.fillStyle = style; ctx.fillRect(this.x+x, this.y+hCoeff-h, binWidth, h)
				this.tempCtx.fillStyle = style; this.tempCtx.fillRect(x, 0, binWidth, specSpeed)
			}
		} else if (this.MODE === 'CONSTANT_Q') {
			const binLo = this._cqtBinLo, binHi = this._cqtBinHi, hLUT = this._cqtHLUT
			for (let x = 0; x < width; x++) {
				let val = 0
				for (let b = binLo[x], e = binHi[x]; b <= e; b++) if (data[b] > val) val = data[b]
				const h = hLUT[x]*val|0, style = this.colorMap[val]
				ctx.fillStyle = style; ctx.fillRect(this.x+x, this.y+hCoeff-h, 1, h)
				this.tempCtx.fillStyle = style; this.tempCtx.fillRect(x, 0, 1, specSpeed)
			}
		}
		*/
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

		// rebuild per-column draw tables with the real sampleRate/bins
		this.makeColumns()
		// (was: this.makeHeightLUT() + this.makeCQT(), now unified)

		this.sab = info.sab8
		this.sabData = new Uint8Array(info.sab8) // one reusable SAB view for renderLoopSAB
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
	makeColumns() {
		// Build per-output-column draw tables so drawFG() is one loop for all 3 modes:
		//   _binLo[c].._binHi[c] = FFT bins to max-pool.  Never make more output
		//   columns than visible pixels: sub-pixel bars cost many fillRect calls but
		//   cannot add visible detail.
		//   _colX[c], _colW[c]   = x position and bar width in px
		//   _hLUT[c]             = folded height scale ((weighting/1.4 or 1) * hCoeff/256)
		const useA = this.WEIGHTING === 'A'
		const hScale = this.hCoeff / 256
		const width = this.width | 0

		if (this.MODE === 'CONSTANT_Q') {
			// geometric (log) bands; each column max-pools the linear FFT bins inside its band.
			// Constant Q = constant frequency ratio between adjacent columns.
			if (width <= 0 || !this.bins) return
			const N = width
			const binsPerHz = this.bins / this.nyquist // FFT bin index per Hz
			const fMin = Math.max(20, this.nyquist / this.bins) // >=20Hz, but at least first bin
			const fMax = Math.min(20000, this.nyquist)          // upper hearing limit / nyquist
			const logMin = Math.log(fMin)
			const logRange = Math.log(fMax) - logMin
			const maxBin = this.bins - 1
			const binLo = new Int32Array(N), binHi = new Int32Array(N)
			const colX = new Float64Array(N), colW = new Float64Array(N), hLUT = new Float64Array(N)
			for (let x = 0; x < N; x++) {
				const fLeft   = Math.exp(logMin + logRange * x / N)
				const fRight  = Math.exp(logMin + logRange * (x + 1) / N)
				const fCenter = Math.exp(logMin + logRange * (x + 0.5) / N)
				let lo = Math.floor(fLeft  * binsPerHz)
				let hi = Math.ceil (fRight * binsPerHz)
				if (lo < 1) lo = 1          // skip DC (bin 0)
				if (hi > maxBin) hi = maxBin
				if (hi < lo) hi = lo        // at least one bin (low-freq bands)
				binLo[x] = lo; binHi[x] = hi
				colX[x] = x; colW[x] = 1
				const w = 0.5 + 0.5 * this._getAWeighting(fCenter)
				hLUT[x] = (useA ? w / 1.4 : 1) * hScale
			}
			this._binLo = binLo; this._binHi = binHi
			this._colX = colX; this._colW = colW; this._hLUT = hLUT
			return
		}

		// LINEAR / LOG: map audible FFT bins to at most one band per visible pixel.
		// With fewer bins than pixels every band remains a single bin, so the normal
		// low-FFT output is unchanged.  With more bins we retain the local peak.
		const maxBin = this.maxHearableBin
		const sourceBins = maxBin + 1
		const N = Math.min(sourceBins, width)
		if (N <= 0) return
		const aw = this._aWeightingLUT
		const isLog = this.MODE === 'LOG'
		const scaleX = width / N
		const logmax = Math.log(maxBin)  // LOG x-mapping
		const binLo = new Int32Array(N), binHi = new Int32Array(N)
		const colX = new Float64Array(N), colW = new Float64Array(N), hLUT = new Float64Array(N)
		for (let i = 0; i < N; i++) {
			if (isLog) {
				// Inverse of the previous log x mapping.  Adjacent visible columns
				// receive the FFT bins whose old bars landed in that pixel column.
				let lo = Math.ceil(Math.exp(i * logmax / N)) - 1
				let hi = Math.ceil(Math.exp((i + 1) * logmax / N)) - 2
				if (lo < 0) lo = 0
				if (lo > maxBin) lo = maxBin
				if (hi < lo) hi = lo
				if (hi > maxBin) hi = maxBin
				binLo[i] = lo; binHi[i] = hi
				colX[i] = i * scaleX
				colW[i] = scaleX
			} else {
				let lo = Math.floor(i * sourceBins / N)
				let hi = Math.floor((i + 1) * sourceBins / N) - 1
				if (hi < lo) hi = lo
				binLo[i] = lo; binHi[i] = hi
				colX[i] = i * scaleX
				colW[i] = scaleX
			}
			// A-weighting follows the centre bin of the pooled band.
			const centre = (binLo[i] + binHi[i]) >> 1
			hLUT[i] = (useA ? aw[centre] / 1.4 : 1) * hScale
		}
		this._binLo = binLo; this._binHi = binHi
		this._colX = colX; this._colW = colW; this._hLUT = hLUT
	}
	/* superseded by makeColumns(), kept for reference:
	makeHeightLUT() {
		// fold the constant per-bin factors into one LUT so drawFG does just hLUT[i]*val|0
		const useA = this.WEIGHTING === 'A'
		const n = this._aWeightingLUT.length
		const base = this.hCoeff / 256
		const lut = new Float32Array(n)
		for (let i = 0; i < n; i++) lut[i] = (useA ? this._aWeightingLUT[i] / 1.4 : 1) * base
		this._hLUT = lut
	}
	makeCQT() {
		const width = this.width | 0
		if (width <= 0 || !this.bins) return
		const binsPerHz = this.bins / this.nyquist
		const fMin = Math.max(20, this.nyquist / this.bins)
		const fMax = Math.min(20000, this.nyquist)
		const logMin = Math.log(fMin), logRange = Math.log(fMax) - logMin, maxBin = this.bins - 1
		const useA = this.WEIGHTING === 'A', hScale = this.hCoeff / 256
		const binLo = new Int32Array(width), binHi = new Int32Array(width), hLUT = new Float32Array(width)
		for (let x = 0; x < width; x++) {
			const fLeft = Math.exp(logMin + logRange * x / width)
			const fRight = Math.exp(logMin + logRange * (x + 1) / width)
			const fCenter = Math.exp(logMin + logRange * (x + 0.5) / width)
			let lo = Math.floor(fLeft * binsPerHz), hi = Math.ceil(fRight * binsPerHz)
			if (lo < 1) lo = 1
			if (hi > maxBin) hi = maxBin
			if (hi < lo) hi = lo
			binLo[x] = lo; binHi[x] = hi
			const w = 0.5 + 0.5 * this._getAWeighting(fCenter)
			hLUT[x] = (useA ? w / 1.4 : 1) * hScale
		}
		this._cqtBinLo = binLo; this._cqtBinHi = binHi; this._cqtHLUT = hLUT
	}
	*/
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
