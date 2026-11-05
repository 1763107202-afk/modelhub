export async function decodeModelBytes(bytes){
 if(bytes[0]===0x1f&&bytes[1]===0x8b)return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
