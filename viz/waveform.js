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
	drawFG() {
		const data = new Uint8Array( this.sab )
		const ctx = this.ctx
		const width = this.width
		const height = this.height
		
		ctx.beginPath()
		ctx.lineWidth = 2
		ctx.strokeStyle = this.strokeFG // for line
		//const scaleX = width / data.time[0].length
		const scaleX = width / this.fftSize
		
		// channels
		//for (let ch = 0, e = data.time.length; ch < e; ch++) {
		for (let ch = 0, e = this.channels; ch < e; ch++) {
			let amp// = data[ch][i]
			let pos = this.y + (ch+.5)*this.chHigh
			ctx.moveTo(this.x, (pos))
			//for (let i = 0, ee = data.time[ch].length; i < ee; i++) {
			for (let i = 0, ee = this.fftSize; i < ee; i++) {
				//amp = (data.time[ch][i]-128.0) / 128.0
				amp = (data[ch*this.fftSize*1.5+i]-128.0) / 128.0
				pos = this.y + (ch+.5)*this.chHigh + amp*this.ampHigh
				//ctx.fillStyle = this.colorMap[data.time[ch][i]]
				ctx.lineTo((this.x+(i)*scaleX), (pos))
				//ctx.fillRect((this.x+i*this.width/ee), (this.y+pos), 1, 1)	// draw pixel
				//ctx.fillRect((this.x+i*this.width/ee), (this.y+pos), 1*scaleX, -amp*this.ampHigh)	// draw line
			}
			//ctx.lineTo((this.x+width), (this.y+pos))
		}
		ctx.stroke()
	}
	setAudio(info) {
		this.sab = info.sab
		this.fftSize = info.fftSize

		if (!info.channels) return
		this.channels = info.channels

		// just calc once and use often
		this.chHigh = this.height / info.channels
		this.ampHigh = this.chHigh / 2
		//console.log(this)
	}
}