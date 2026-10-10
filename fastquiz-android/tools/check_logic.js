const fs=require("fs"),vm=require("vm"),assert=require("assert");
const src=fs.readFileSync("fastquiz-android/app/main.js","utf8");
const start=src.indexOf("function normalized(s){");
const end=src.indexOf("function recognize(img,box){");
if(start<0||end<start)throw Error("Lexical logic not found");
const rows=[
 ["grandparent","n. 祖父母"],
 ["grandparental","a. 祖父母的"],
 ["grandparents","n. 外祖父母；祖父母（grandparent的复数）"]
];
const db={
 rawQuery:(sql,args)=>{
  let i=0;
  const candidates=rows.filter(x=>x[0].includes(args[0].replace(/%/g,"")));
  return {moveToNext:()=>i<candidates.length,getString:(k)=>{const v=candidates[i][k];if(k===1)i++;return v;},close:()=>{}};
 }
};
const context={db:db};vm.createContext(context);
vm.runInContext(src.slice(start,end),context);
assert.strictEqual(context.match("pron. 哪一个, 那一个",["我","谁,无论谁","哪个,哪几个","你的,你们的"]),2,"which synonym resolution");
assert.strictEqual(context.match("n. 祖父母",["柔和,温柔","祖父或祖母","暴动,叛乱","法兰绒"]),1,"grandparent paraphrase");
assert.strictEqual(context.match("n. 老虎, 虎, 凶暴的人",["老虎","狮子","大象","猩猩"]),0,"tiger single translation");
assert.strictEqual(context.match("n. 更多\na. 多的, 程度较大的, 更大的\nadv. 多, 更多, 进一步",["更多的,更","不好看的","协调的,协定的","令人捧腹的"]),0,"more partial expression");
const fix=context.findNearWord("randparer",["柔和,温柔","祖父或祖母","暴动,叛乱","法兰绒"]);
assert.strictEqual(fix?.word,"grandparent","OCR typo candidate");
assert.strictEqual(fix?.index,1,"OCR typo selected answer");
assert.strictEqual(context.findNearWord("random",["柔和,温柔","祖父或祖母","暴动,叛乱","法兰绒"]),null,"unknown unrelated OCR");
console.log("6 regression cases passed");
