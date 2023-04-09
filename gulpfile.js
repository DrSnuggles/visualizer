const gulp = require('gulp')
const rollup = require('gulp-better-rollup')
const concat = require('gulp-concat')
const terser = require('gulp-terser')
const brotli = require('gulp-brotli')

/*
	- Rollup + Terser canvas worker
	- Concat
	- Rollup + Terser visualizer
	- Brotli
*/

gulp.task('rollupWorker', () => {
	return gulp.src('canvas.worker.js')
		.pipe(rollup({ plugins: [] }, 'es'))
		.pipe(terser())
		.pipe(gulp.dest('_tmp'))
})

gulp.task('concat', () => {
	return gulp.src([
		'visualizer_part1.js',
		'_tmp/canvas.worker.js',
		'visualizer_part2.js',
	])
	.pipe(concat('visualizer.min.js'))
	.pipe(terser({
		ecma: 6,
		keep_fnames: false,
		mangle: {
			toplevel: true,
		},
	  }))
	.pipe(gulp.dest('.'))
})

gulp.task('rollupVisualizer', () => {
	return gulp.src('visualizer.min.js')
		.pipe(rollup({ plugins: [] }, 'es'))
		.pipe(terser({
			ecma: 6,
			keep_fnames: false,
			mangle: {
				toplevel: true,
			},
		  }))
		.pipe(gulp.dest('.'))
})

gulp.task('brotli', () => {
	return gulp.src(['visualizer.min.js'])
	.pipe(brotli.compress({
		quality: 11,
	}))
    .pipe(gulp.dest('.'))
})


gulp.task('default', gulp.series('rollupWorker','concat','rollupVisualizer','brotli'))
