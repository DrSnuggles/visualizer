export function makeColorMap(gradientColors) {
	/* todo: should also be called on resize
		dep less solution is canvas.createLinearGradient and add gradient.addColorStop
		return new chroma.scale(arr).domain([0, 255])
		https://stackoverflow.com/questions/30143082/how-to-get-color-value-from-gradient-by-percentage-with-javascript
	*/
	const steps = 256
	const oCanv = new OffscreenCanvas(256, 1)
	//offscreen.width = width
	//offscreen.height = height
	const oCtx = oCanv.getContext('2d', {alpha: false, willReadFrequently: true}) // https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
	
	// Gradient
	const gradient = oCtx.createLinearGradient(0, 0, steps, 0) // x0, y0, x1, y1
	
	const step = 1 / (gradientColors.length - 1) // need to validate at least two colors in gradientColors
	let val = 0
	gradientColors.forEach(color => {
		gradient.addColorStop(val, color)
		val += step
	})

	// Fill with gradient
	oCtx.fillStyle = gradient
	oCtx.fillRect(0, 0, steps, 1)

	let ret = []
	for (let i = 0; i < steps; i++) {
		ret[i] = getColor(i)
	}
	return ret

	// helper
	function getColor(ind) {
		const rgba = oCtx.getImageData(ind, 0, 1, 1).data // x, y, width, height
		// no literals here i need them for inline worker ;) return `rgb(${ rgba[0] }, ${ rgba[1] }, ${ rgba[2] })`
		return 'rgb('+ rgba[0] +','+rgba[1]+','+rgba[2]+')'
	}
}