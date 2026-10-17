import {build} from 'esbuild';
await build({entryPoints:['client.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/webui.js',minify:true,sourcemap:false,logLevel:'warning'});
