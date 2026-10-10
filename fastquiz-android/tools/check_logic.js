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

assert.strictEqual(context.match("a. 向下的\nadv. 下, 下去, 降下\nprep. 往下, 沿着\nn. 丘陵\n[计] 向下, 退下命令",["向下,在下面","到处,处处","同时,当时","永远,总是"]),0,"down and option-synonym score");
assert.strictEqual(context.match("adv. 在那里",["在那里","无意中","都分地,偏祖地","千倍地"]),0,"there exact match");
assert.strictEqual(context.match("n. 日本\n[化] 天然漆; 大漆; 漆器",["围巾,消音器","魅力,魔力","篮球,篮球运动","日本"]),3,"japan multiple senses exact");
assert.strictEqual(context.match("n. 动物园",["动物园","动物","食物","花园"]),0,"zoo exact match");
assert.strictEqual(context.match("n. 门",["门口","门","鱼","屋"]),1,"door UI choice");
assert.strictEqual(context.match("n. 片刻, 瞬间, 重要, 阶段, 力矩",["动物园","朋友","行话,术语","片刻,瞬间"]),3,"moment choice");
const vsrc=src.slice(src.indexOf("function isWhite(pixel){"),src.indexOf("var cachedCards=null;"));
vm.runInContext(vsrc,context);
const h=2800,w=1264,expected=[1616,1912,2208,2504];
const mock=(x,y)=>expected.some(c=>y>=c-77&&y<=c+77)?0xffffff:0x2277aa;
const found=context.detectCardCenters(w,h,mock);
assert.ok(found && found.length===4,"four white cards detected");
assert.ok(found.every((c,i)=>Math.abs(c.center-expected[i])<12),"four card centers mapped");

// The entries below are taken from the bundled ECDICT dataset, not fabricated demonstration meanings.
assert.strictEqual(context.match("n. 柑橘, 桔子, 橘色\na. 橘色的",["太阳","橙子","苹果","鸭子"]),1,"orange fruit equivalent");
assert.strictEqual(context.match("n. 柑橘, 桔子, 橘色\na. 橘色的",["黄色","橙色","绿色","蓝色"]),1,"orange color equivalent");
assert.strictEqual(context.match("a. 快速的, 紧的\nadv. 很快地, 紧紧地, 彻底地\nn. 绝食, 斋戒\nvi. 绝食, 斋戒",["慢的","快的","懒惰的","温柔的"]),1,"fast adjective equivalent");
assert.strictEqual(context.match("a. 快速的, 紧的\nadv. 很快地, 紧紧地, 彻底地\nn. 绝食, 斋戒\nvi. 绝食, 斋戒",["缓慢地","迅速地","不情愿地","总是"]),1,"fast adverb equivalent");
assert.strictEqual(context.match("n. 柑橘, 桔子, 橘色\na. 橘色的",["橙子","橙色","香蕉","黑色"]),-1,"two orange senses: must not guess");

console.log("19 regression checks passed");

