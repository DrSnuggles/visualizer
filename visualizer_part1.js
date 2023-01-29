/*	
	Analyzer
*/
import {analyzer} from './analyzer.js'

export const visualizer = {
	//canvasWorker: new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'}), // import.meta.url: https://stackoverflow.com/questions/12417216/javascript-not-resolving-worker-path-relative-to-current-script
	canvasWorker: new Worker(URL.createObjectURL( new Blob([`