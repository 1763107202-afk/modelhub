import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {cp,readdir} from 'node:fs/promises';
import path from 'node:path';
const source=fileURLToPath(new URL('.',import.meta.url));
await build({root:source,configFile:path.join(source,'vite.config.ts')});
for(const name of await readdir(path.join(source,'.build'))){
 if(!['index.html','assets','references','examples','favicon.svg'].includes(name))throw new Error('Unexpected build output: '+name);
 await cp(path.join(source,'.build',name),path.join(source,'..',name),{recursive:true});
}
console.log('Static export updated inside linearm-simulator/.');
