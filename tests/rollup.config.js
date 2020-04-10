import nodeResolve from 'rollup-plugin-node-resolve';

export default {
    input: './index.js',
    output: {
        file: './build/main.js',
        format: 'es',
        name: 'bundle'
    },
    plugins: [
        nodeResolve()
    ]
}