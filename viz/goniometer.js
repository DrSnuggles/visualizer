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
	drawBG() {
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
	drawFG(data) {
		const ctx = this.ctx
		const width = this.width
		const height = this.height
		const dataL = data.time[0]
		const dataR = data.time[1]

		ctx.lineWidth = 1
		ctx.strokeStyle = this.strokeFG
		ctx.beginPath()
		
		let rotated
		
		// move to start point
		rotated = this.rotate45deg(this.toFloat(dataR[0]), this.toFloat(dataL[0]))  // Right channel is mapped to x axis
		ctx.moveTo(this.x+rotated.x * width + width/2.0, this.y+rotated.y* height + height/2.0)
		
		// draw line
		for (let i = 1; i < dataL.length; i++) {
		 rotated = this.rotate45deg(this.toFloat(dataR[i]), this.toFloat(dataL[i]))
		 ctx.lineTo(this.x+rotated.x * width + width/2.0, this.y+rotated.y* height + height/2.0)
		}
		
		ctx.stroke()
	}
	setAudio() {}
		
	// Helpers
	toFloat(uint8) {
		return (uint8-128.0)/256.0/1.414213
	}
	rotate45deg(x, y) {
		const tmp = this.cartesian2polar(x, y)
		tmp.angle -= 0.78539816 // Rotate coordinate by 45 degrees
		const tmp2 = this.polar2cartesian(tmp.radius, tmp.angle)
		return {x:tmp2.x, y:tmp2.y}
	}
	cartesian2polar(x, y) {
		// Convert cartesian to polar coordinate
		const radius = Math.sqrt((x * x) + (y * y))
		const angle = Math.atan2(y,x) // atan2 gives full circle
		return {radius:radius, angle:angle}
	}
	polar2cartesian(radius, angle) {
		// Convert polar coordinate to cartesian coordinate
		const x = radius * Math.sin(angle)
		const y = radius * Math.cos(angle)
		return {x:x, y:y}
	}
}