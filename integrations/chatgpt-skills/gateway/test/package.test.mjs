import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repo = resolve(root, "../..");
const five = ["design-taste-frontend","agent-reach-research","archify-system-diagrams","voicestudio-audio","mirofish-simulation"];

test("portable and compatibility manifests declare all five skills", () => {
 const portable=JSON.parse(readFileSync(resolve(root,"plugin.json"),"utf8"));
 const compat=JSON.parse(readFileSync(resolve(root,".codex-plugin/plugin.json"),"utf8"));
 assert.equal(portable.name,"engineering-five-skills");
 assert.equal(portable.$schema,"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
 assert.equal(compat.skills,"./skills/");
 assert.equal(portable.version,compat.version);
 assert.deepEqual(portable.extensions["com.openai"].interface,compat.interface);
 assert.equal(compat.interface.displayName,"Engineering Five Skills");
 assert.ok(compat.interface.shortDescription.length<=30);
 assert.deepEqual(compat.interface.capabilities,[]);
 for(const legacy of ["skills","mcpServers","apps","interface"]) assert.equal(legacy in portable,false);
 for(const name of five){
  const location=resolve(root,"skills",name,"SKILL.md");
  assert.equal(existsSync(location),true,location);
  const content=readFileSync(location,"utf8");
  assert.match(content,/^---\nname:\s+[^\n]+\ndescription:\s+[^\n]+\n---/);
  assert.ok(content.includes("name: "+name+"\n"));
 }
});

test("repository marketplace points to the integration branch", () => {
 const market=JSON.parse(readFileSync(resolve(repo,".agents/plugins/marketplace.json"),"utf8"));
 const item=market.plugins.find(p=>p.name==="engineering-five-skills");
 assert.ok(item);
 assert.equal(item.source.source,"git-subdir");
 assert.equal(item.source.path,"./integrations/chatgpt-skills");
 assert.equal(item.source.ref,"chatgpt-skills-integration");
});
