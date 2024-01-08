/*	
	Visualizer, now as class for multiple instances
*/
import {Analyzer} from './analyzer.js'

const defaultSettings = {
	fps: 0,
	fft: 0, // 11 pow 2 = 2048
	minDB: -100,
	maxDB: -30,
	smooth: 0,
	scale: 1,
}

export class Visualizer {
	constructor(source, canvas, settings) {
		// Canvas offscreen worker
		//this.canvasWorker = new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'}) // import.meta.url: https://stackoverflow.com/questions/12417216/javascript-not-resolving-worker-path-relative-to-current-script
		this.canvasWorker = new Worker(URL.createObjectURL( new Blob([`