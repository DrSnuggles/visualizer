/*
	Goniometer by DrSnuggles
*/

export class Goniometer {
	constructor(ctx, x, y, w, h, decimate = 1, step = 1) {
		this.ctx = ctx
		this.x = x ? x : 0
		this.y = y ? y : 0
		this.width = w ? w : ctx.canvas.width
		this.height = h ? h : ctx.canvas.height
		this.strokeBG = 'rgba(208, 130, 34, 255)' // 30, 200, 10, 255
		this.strokeFG = 'rgba(230, 200, 32, 255)' // 30, 255, 10, 255
		// adaptive decimation tolerance in device px: 1 = ~1px (default), 0 = off (draw all), >1 = coarser/faster
		this.decimate = decimate
		// fixed stride: draw only every step-th sample. 1 = all (default), 2 = half, ...
		this.step = Math.max(1, step | 0)
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
	drawFG(dat) {
		//console.time('drawFG goniometer')
		const data = dat
		// old SAB fallback allocated a new TypedArray view for every draw:
		// const data = dat ? dat : new Float32Array(this.sab)
		const ctx = this.ctx
		const width = this.width/2
		const height = this.height/2
		//console.time('uint8array')
		//const dataL = new Uint8Array( this.sab.slice(0 * 32768, 32768) )//data.time[0]
		//const dataR = new Uint8Array( this.sab.slice(1 * 32768, 32768) )//data.time[1]
		//const dataL = new Uint8Array( data.slice(0 * this.fftSize*1.5, this.fftSize) )//data.time[0]
		//const dataR = new Uint8Array( data.slice(1 * this.fftSize*1.5, this.fftSize+this.fftSize/2) )//data.time[1]
		//console.timeEnd('uint8array')

		// Let the canvas rasterizer do the -45° rotation via a single affine transform.
		// This replaces the whole rotate45deg()-per-sample (math + object allocation).
		// Equivalent mapping of raw (R, L) to screen (same result as before):
		//   screenX = (this.x + width)  + (width/2)  * (L - R)
		//   screenY = (this.y + height) + (height/2) * (R + L)
		// setTransform(a,b,c,d,e,f) maps (x,y) -> (a*x + c*y + e, b*x + d*y + f),
		// here x = R = data[fftSize+i], y = L = data[i].
		const sx = width / 2, sy = height / 2
		ctx.save()
		ctx.setTransform(-sx, sy, sx, sy, this.x + width, this.y + height)
		ctx.lineWidth = 1 / sx // counter the transform scale -> ~1 device px (goniometer is square)
		ctx.lineJoin = 'bevel' // cheaper than default 'miter' for the many sharp angles of a noisy lissajous
		ctx.strokeStyle = this.strokeFG
		ctx.beginPath()
		// adaptive decimation: skip points that move < ~1 device px from the last drawn one
		// (lots of them near the center during quiet passages); busy/loud signal is unaffected.
		const fftSize = this.fftSize
		const step = this.step // fixed stride: only iterate every step-th sample
		const eps = 0.5 * this.decimate / sx // adaptive per-axis threshold; this.decimate scales the px tolerance (0 = off)
		let lastR = data[fftSize], lastL = data[0]
		ctx.moveTo(lastR, lastL) // start point: (R0, L0) always drawn
		for (let i = step; i < fftSize; i += step) {
			const R = data[fftSize + i], L = data[i]
			// adaptive skip: |R-lastR|<eps && |L-lastL|<eps (no Math.abs); always keep the last iterated sample
			if (i + step < fftSize && R - lastR < eps && lastR - R < eps && L - lastL < eps && lastL - L < eps) continue
			ctx.lineTo(R, L) // (Ri, Li), rotation handled by the transform
			lastR = R; lastL = L
		}
		ctx.stroke()
		/* non-decimated version, kept for reference:
		ctx.moveTo(data[this.fftSize], data[0]) // start point: (R0, L0)
		for (let i = 1; i < this.fftSize; i++) {
			ctx.lineTo(data[this.fftSize + i], data[i]) // (Ri, Li), rotation handled by the transform
		}
		ctx.stroke()
		*/
		ctx.restore() // back to identity transform for the other visualizers sharing this ctx

		/* old per-sample version (rotate45deg + {x,y} allocation per sample), kept for reference:
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
			rotated = this.rotate45deg(data[this.fftSize+i], data[i])
			ctx.lineTo(this.x+rotated.x * width + width, this.y+rotated.y* height + height)
		}

		ctx.stroke()
		*/
		//console.timeEnd('drawFG goniometer')
	}
	setAudio(info) {
		this.fftSize = info.fftSize
		this.sab = info.sab32
		this.sabData = new Float32Array(info.sab32) // one reusable SAB view for renderLoopSAB
	}
		
	// Helpers
	/*
	toFloat(uint8) {
		return (uint8-128.0)/256.0/1.414213
	}
	rotate45deg(x, y) {
		// Fast path: a -45° rotation combined with the 1/sqrt(2) scaling used in
		// cartesian2polar/polar2cartesian simplifies algebraically to:
		//   x' = (y - x) / 2 ,  y' = (x + y) / 2
		// (same result, but without sqrt/atan2/sin/cos per sample)
		return {x: (y - x) * 0.5, y: (x + y) * 0.5}
		/* old (slow) version, kept for reference:
		const tmp = this.cartesian2polar(x, y)
		tmp.angle -= 0.78539816 // Rotate coordinate by 45 degrees
		//if (tmp.angle < -2.0*Math.PI || tmp.angle > 2.0*Math.PI) console.log('rotate 45deg tmp.angle', tmp.angle)// ^^ thats my guess
		const tmp2 = this.polar2cartesian(tmp.radius, tmp.angle)
		return {x:tmp2.x, y:tmp2.y}
		*/
//	}
	/*
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
	*/
}
