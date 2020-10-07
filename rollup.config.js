import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import minify from 'rollup-plugin-minify-es';

export default [
    {
        input: './src/ConverterV1/ConverterV1.js',
        output: [
            {
                file: './build/ConverterV1.js',
                format: 'cjs',
                name: 'bundle2'
            }
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            // minify()
        ]
    },
    {
        input: './src/ConverterV3/ConverterV3.js',
        output: [
            {
                file: './build/ConverterV3.js',
                format: 'cjs',
                name: 'bundle2'
            }
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            // minify()
        ]
    },
    {
        input: './src/ConverterV6/ConverterV6.js',
        output: [
            {
                file: './build/ConverterV6.js',
                format: 'cjs',
                name: 'bundle2'
            }
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            // minify()
        ]
    }
]