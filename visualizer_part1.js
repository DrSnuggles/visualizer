/*	
	Visualizer, now as class for multiple instances
*/
import {Analyzer, defaultSettings} from './analyzer.js' // single source of truth for defaults

export class Visualizer {
	constructor(source, canvas, settings) {
		// Canvas offscreen worker
		//this.canvasWorker = new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'}) // import.meta.url: https://stackoverflow.com/questions/12417216/javascript-not-resolving-worker-path-relative-to-current-script
		this.canvasWorker = new Worker(URL.createObjectURL( new Blob([`