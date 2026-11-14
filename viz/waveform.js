/*
	Waveform by DrSnuggles
	Idea: split height by channel amount and draw for each channel
*/

//import {makeColorMap} from './makeColorMap.js'

export class Waveform {
	constructor(ctx, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
		this.ctx = ctx
		this.x = x
		this.y = y
		this.width = w
		this.height = h
		this.strokeBG = 'rgba(0, 100, 0, 255)'
		this.strokeFG = 'rgba(0, 255, 0, 255)'
		/*
		this.colorMap = makeColorMap([
			'#ff0000',
			'#ffff00',
			'#00ff00',
			'#004000',	// symetric
			'#00ff00',
			'#ffff00',
			'#ff0000',
		])
		*/
	}
	clear() {
		const ctx = this.ctx
		ctx.fillStyle = 'rgba(0, 0, 0, 255)'
		ctx.fillRect(this.x, this.y, this.width, this.height)
	}
	/*
	drawBG() { // not called
		const ctx = this.ctx
		const width = this.width
		const height = this.height

		ctx.lineWidth = 1
		ctx.strokeStyle = this.strokeBG
		for (let i = 0, e = this.channels; i < e; i++) {
			// x axis of each channel
			ctx.beginPath()
			ctx.setLineDash([15, 15]) // dashed line
			ctx.moveTo(this.x, (this.y+(i+.5)*height/e))
			ctx.lineTo((this.x+width), (this.y+(i+.5)*height/e))
			ctx.stroke()

			// line between channels
			ctx.beginPath()
			ctx.lineWidth = 2
			ctx.setLineDash([]) // solid line
			ctx.moveTo(this.x, (this.y+i*height/e))
			ctx.lineTo((this.x+width), (this.y+i*height/e))
			ctx.stroke()
		}
	}
	*/
	drawFG(dat) {
		//console.time('drawFG waveform')
		const data = dat
		// old SAB fallback allocated a new TypedArray view for every draw:
		// const data = dat ? dat : new Float32Array(this.sab)
		const ctx = this.ctx
		const width = this.width
		//const height = this.height
		// hoist invariants into locals (avoid repeated this.* lookups in the hot loop)
		const x0 = this.x
		const y0 = this.y
		const fftSize = this.fftSize
		const chHigh = this.chHigh
		const ampHigh = this.ampHigh
		const pixelCols = Math.max(1, Math.floor(width))
		if (fftSize > pixelCols) {
			// Pool every sample into a pixel envelope. This retains short peaks and
			// replaces expensive, overlapping zigzag strokes with narrow rectangles.
			ctx.fillStyle = this.strokeFG
			const dx = width / pixelCols
			for (let ch = 0; ch < this.channels; ch++) {
				const off = ch * fftSize
				const baseline = y0 + (ch + .5) * chHigh
				let start = 0
				for (let p = 0; p < pixelCols; p++) {
					const end = Math.floor((p + 1) * fftSize / pixelCols)
					let lo = data[off + start], hi = lo
					for (let i = start + 1; i < end; i++) {
						const value = data[off + i]
						if (value < lo) lo = value
						if (value > hi) hi = value
					}
					// Bridge the previous sample so single-sample columns stay connected.
					if (start) {
						const previous = data[off + start - 1]
						if (previous < lo) lo = previous
						if (previous > hi) hi = previous
					}
					ctx.fillRect(x0 + p * dx, baseline + lo * ampHigh - 1, dx, (hi - lo) * ampHigh + 2)
					start = end
				}
			}
			return
		}

		ctx.beginPath()
		ctx.lineWidth = 2
		ctx.lineJoin = 'bevel' // cheaper than default 'miter' for the many sharp angles of the waveform
		ctx.strokeStyle = this.strokeFG // for line
		// draw at most one point per pixel column: when fftSize > width, subsample (nearest),
		// so the loop never does more than `width` lineTo calls and avoids sub-pixel overdraw.
		// when fftSize <= width this is identical to before (cols=fftSize, dx=scaleX, sstep=1).
		const cols = fftSize < width ? fftSize : width
		const dx = width / cols      // px per drawn point (= old scaleX when fftSize <= width)
		const sstep = fftSize / cols // samples advanced per point (= 1 when fftSize <= width)

		// channels
		//for (let ch = 0, e = data.time.length; ch < e; ch++) {
		for (let ch = 0, e = this.channels; ch < e; ch++) {
			const off = ch * fftSize                 // channel offset into data, once per channel
			const baseline = y0 + (ch + .5) * chHigh // constant zero-line of this channel, once per channel
			ctx.moveTo(x0, baseline + data[off] * ampHigh)
			let si = 0 // float sample accumulator (avoids a multiply per point)
			for (let p = 0; p < cols; p++) {
				// only the sampled amp varies per point; si|0 = nearest sample index
				ctx.lineTo(x0 + (p + 1) * dx, baseline + data[off + (si | 0)] * ampHigh)
				si += sstep
			}
		}
		ctx.stroke()
		/* old version (recomputed baseline and ch*fftSize per sample), kept for reference:
		const scaleX = width / this.fftSize
		for (let ch = 0, e = this.channels; ch < e; ch++) {
			//let amp = (data[ch*this.fftSize+0]-128.0) / 128.0
			let amp = data[ch*this.fftSize+0]
			let pos = this.y + (ch+.5)*this.chHigh + amp*this.ampHigh
			ctx.moveTo(this.x, (pos))
			//for (let i = 0, ee = data.time[ch].length; i < ee; i++) {
			for (let i = 0, ee = this.fftSize; i < ee; i++) {
				//amp = (data.time[ch][i]-128.0) / 128.0
				//amp = (data[ch*this.fftSize*1.5+i]-128.0) / 128.0
				//amp = (data[ch*this.fftSize+i]-128.0) / 128.0				// 0..255
				amp = data[ch*this.fftSize+i]				// -1..+1
				pos = this.y + (ch+.5)*this.chHigh + amp*this.ampHigh
				//ctx.fillStyle = this.colorMap[data.time[ch][i]]
				ctx.lineTo((this.x+(i+1)*scaleX), (pos))
				//ctx.fillRect((this.x+i*this.width/ee), (this.y+pos), 1, 1)	// draw pixel
				//ctx.fillRect((this.x+i*this.width/ee), (this.y+pos), 1*scaleX, -amp*this.ampHigh)	// draw line
			}
			//ctx.lineTo((this.x+width), (this.y+pos))
		}
		ctx.stroke()
		*/

		//console.timeEnd('drawFG waveform')
	}
	setAudio(info) {
		this.sab = info.sab32
		this.sabData = new Float32Array(info.sab32) // one reusable SAB view for renderLoopSAB
		this.fftSize = info.fftSize

		if (!info.channels) return
		this.channels = info.channels

		// just calc once and use often
		this.chHigh = this.height / info.channels
		this.ampHigh = this.chHigh / 2
		//console.log(this)
	}
}
