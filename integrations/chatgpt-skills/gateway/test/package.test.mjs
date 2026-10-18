import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repo = resolve(root, "../..");
const five = ["taste","agent_reach","archify","voicestudio","mirofish"];

test("portable and compatibility manifests declare all five skills", () => {
 const portable=JSON.parse(readFileSync(resolve(root,"plugin.json"),"utf8"));
 const compat=JSON.parse(readFileSync(resolve(root,".codex-plugin/plugin.json"),"utf8"));
 assert.equal(portable.name,"engineering-five-skills");
 assert.equal(compat.skills,"./skills/");
 assert.equal(portable.version,compat.version);
 for(const name of five){
  const location=resolve(root,"skills",name,"SKILL.md");
  assert.equal(existsSync(location),true,location);
  const content=readFileSync(location,"utf8");
  assert.match(content,/^---\nname:\s+[^\n]+\ndescription:\s+[^\n]+\n---/);
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
