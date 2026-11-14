import { readFile, writeFile } from "node:fs/promises"
import { brotliCompressSync, constants } from "node:zlib"

const workerResult = await Bun.build({
	entrypoints: ["canvas.worker.js"],
	target: "browser",
	minify: true,
	write: false
})

if (!workerResult.success) {
	for (const message of workerResult.logs) console.error(message)
	throw new Error("Bun failed to bundle canvas.worker.js")
}

const worker = await workerResult.outputs[0].text()
const devFile = "visualizer.js"
const devSource = await readFile(devFile, "utf8")
const workerRef = "new Worker(new URL('./canvas.worker.js', import.meta.url), {type: 'module'})"

if (!devSource.includes(workerRef)) throw new Error(`No canvas worker reference found in ${devFile}`)

const workerBlob = `new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], {type: "text/javascript"})), {type: "module"})`
const source = devSource.replace(workerRef, workerBlob)

const appResult = await Bun.build({
	entrypoints: [devFile],
	target: "browser",
	minify: true,
	write: false,
	plugins: [{
		name: "visualizer-dev-source",
		setup(build) {
			build.onLoad({ filter: /visualizer_dev\.js$/ }, () => ({
				contents: source,
				loader: "js",
				resolveDir: process.cwd()
			}))
		}
	}]
})

if (!appResult.success) {
	for (const message of appResult.logs) console.error(message)
	throw new Error(`Bun failed to bundle ${devFile}`)
}

const bundle = Buffer.from(await appResult.outputs[0].arrayBuffer())
const compressed = brotliCompressSync(bundle, {
	params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
})

await Promise.all([
	writeFile("visualizer.min.js", bundle),
	writeFile("visualizer.min.js.br", compressed)
])

console.log(`Built visualizer.min.js (${bundle.length} bytes)`)
console.log(`Built visualizer.min.js.br (${compressed.length} bytes)`)
