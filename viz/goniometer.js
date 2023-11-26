/*
	Goniometer by DrSnuggles
*/

export class Goniometer {
	constructor(ctx, x, y, w, h) {
		this.ctx = ctx
		this.x = x ? x : 0
		this.y = y ? y : 0
		this.width = w ? w : ctx.canvas.width
		this.height = h ? h : ctx.canvas.height
		this.strokeBG = 'rgba(208, 130, 34, 255)' // 30, 200, 10, 255
		this.strokeFG = 'rgba(230, 200, 32, 255)' // 30, 255, 10, 255
	}
	clear() {
		const ctx = this.ctx
		ctx.fillStyle = 'rgba(0, 0, 0, 1)'
		ctx.fillRect(this.x, this.y, this.width, this.height)
	}
	/*
	drawBG() { // not called
		const ctx = this.ctx
		const width = this.width
		const height = this.height

		ctx.lineWidth = 1
		ctx.strokeStyle = this.strokeBG
		ctx.beginPath()
		
		// x - axis
		ctx.moveTo(this.x, this.y+height/2)
		ctx.lineTo(this.x+width, this.y+height/2)
		
		// y - axis
		ctx.moveTo(this.x+width/2, this.y+0)
		ctx.lineTo(this.x+width/2, this.y+height)
		
		// l - axis
		ctx.moveTo(this.x+0, this.y+0)
		ctx.lineTo(this.x+width, this.y+height)
		
		// r - axis
		ctx.moveTo(this.x+width, this.y+0)
		ctx.lineTo(this.x+0, this.y+height)
		
		// circles/ellipses
		// 50%
		ctx.moveTo(this.x + width/2 + width/2 /2, this.y+height/2)
		ctx.ellipse(this.x + width/2, this.y+height/2, width/2 /2, height/2 /2, 0, 0, 2*Math.PI)
		
		// 75%
		ctx.moveTo(this.x + width/2 + width/2 /(4/3), this.y+height/2)
		ctx.ellipse(this.x + width/2, this.y+height/2, width/2 /(4/3), height/2 /(4/3), 0, 0, 2*Math.PI)
		
		// 100%
		ctx.moveTo(this.x+width/2 + width/2, this.y+height/2)
		ctx.ellipse(this.x+width/2, this.y+height/2, width/2, height/2, 0, 0, 2*Math.PI)
		
		ctx.stroke() // finally draw
	}
	*/
	drawFG() {
		//console.time('drawFG goniometer')
		//const data = new Uint8Array( this.sab )
		const data = new Float32Array( this.sab )
		const ctx = this.ctx
		const width = this.width/2
		const height = this.height/2
		//console.time('uint8array')
		//const dataL = new Uint8Array( this.sab.slice(0 * 32768, 32768) )//data.time[0]
		//const dataR = new Uint8Array( this.sab.slice(1 * 32768, 32768) )//data.time[1]
		//const dataL = new Uint8Array( data.slice(0 * this.fftSize*1.5, this.fftSize) )//data.time[0]
		//const dataR = new Uint8Array( data.slice(1 * this.fftSize*1.5, this.fftSize+this.fftSize/2) )//data.time[1]
		//console.timeEnd('uint8array')

		ctx.lineWidth = 1
		ctx.strokeStyle = this.strokeFG
		ctx.beginPath()
		
		let rotated
		
		// move to start point
		//rotated = this.rotate45deg(this.toFloat(dataR[0]), this.toFloat(dataL[0]))  // Right channel is mapped to x axis
		//rotated = this.rotate45deg(this.toFloat(data[this.fftSize*1.5]), this.toFloat(data[0]))  // Right channel is mapped to x axis
		//rotated = this.rotate45deg(this.toFloat(data[this.fftSize]), this.toFloat(data[0]))  // Right channel is mapped to x axis
		rotated = this.rotate45deg(data[this.fftSize], data[0])  // Right channel is mapped to x axis
		ctx.moveTo(this.x+rotated.x * width + width, this.y+rotated.y* height + height)
		// draw line
		//for (let i = 1; i < dataL.length; i++) {
		for (let i = 1; i < this.fftSize; i++) {
		 //rotated = this.rotate45deg(this.toFloat(dataR[i]), this.toFloat(dataL[i]))
		 //rotated = this.rotate45deg(this.toFloat(data[this.fftSize*1.5+i]), this.toFloat(data[i]))
		 //rotated = this.rotate45deg(this.toFloat(data[this.fftSize+i]), this.toFloat(data[i]))
		 /* this happens due to 32bit upsampling??*/
			//if (data[this.fftSize+i] < -1 || data[this.fftSize+i] > 1) console.log('data x', data[this.fftSize+i])
			//if (data[i] < -1 || data[i] > 1) console.log('data y', data[i])
		 rotated = this.rotate45deg(data[this.fftSize+i], data[i])
		 ctx.lineTo(this.x+rotated.x * width + width, this.y+rotated.y* height + height)
		}
		
		ctx.stroke()
		//console.timeEnd('drawFG goniometer')
	}
	setAudio(info) {
		this.fftSize = info.fftSize
		this.sab = info.sab32
	}
		
	// Helpers
	toFloat(uint8) {
		return (uint8-128.0)/256.0/1.414213
	}
	rotate45deg(x, y) {
		const tmp = this.cartesian2polar(x, y)
		tmp.angle -= 0.78539816 // Rotate coordinate by 45 degrees
		//if (tmp.angle < -2.0*Math.PI || tmp.angle > 2.0*Math.PI) console.log('rotate 45deg tmp.angle', tmp.angle)// ^^ thats my guess
		const tmp2 = this.polar2cartesian(tmp.radius, tmp.angle)
		return {x:tmp2.x, y:tmp2.y}
	}
	cartesian2polar(x, y) {
		// Convert cartesian to polar coordinate
		//const radius = Math.sqrt((x * x) + (y * y))
		//const radius = Math.min(1.0, Math.sqrt((x * x) + (y * y)))
		const radius = Math.sqrt((x * x) + (y * y)) / 1.4142135623730951
		const angle = Math.atan2(y,x) // atan2 gives full circle
		//if (radius < -1 || radius > 1 ) console.log('cartesian2polar radius', radius, x, y)
		//if (angle < -2.0*Math.PI || angle > 2.0*Math.PI) console.log('cartesian2polar angle', angle)
		return {radius:radius, angle:angle}
	}
	polar2cartesian(radius, angle) {
		// Convert polar coordinate to cartesian coordinate
		const x = radius * Math.sin(angle)
		const y = radius * Math.cos(angle)
		//if (x < -1 || x > 1 || y < -1 || y > 1) console.log('polar2cartesian', x, y)
		return {x:x, y:y}
	}
}