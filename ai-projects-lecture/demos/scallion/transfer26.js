// mm. Candidate local geometry; full-line profile permit remains nominal until all interfaces are checked.
export const T26=Object.freeze({radius:45.5,coreRadius:2.5,linerRadius:3.5,arc:170,stroke:25,hardStroke:27,minPad:2,maxPad:22,backXmin:-16,backXmax:22,guideR:2,boreR:3.5,wire:.45,meanCoil:5.5,activeCoils:20,totalCoils:22,freeCoil:50,G:70000});
export const stiffness26=T26.G*T26.wire**4/(8*T26.meanCoil**3*T26.activeCoils);
export function transfer26(diameter=28,cx=0,cz=0,opening=0){
 const r=diameter/2,s=T26.stroke*opening,qR=Math.max(2,r+cz-s),qL=Math.max(2,r-cz-s),rearMouth=2*T26.radius*Math.sin(T26.arc*Math.PI/180),outerFood=Math.hypot(cx,cz)+r;
 const valid=[diameter,cx,cz,opening].every(Number.isFinite)&&diameter>=18&&diameter<=34&&Math.abs(cz)<=4&&opening>=0&&opening<=1&&qR<=22&&qL<=22&&cx>=-14&&cx<=20;
 const lengths=[39-qL,39-qR],forces=lengths.map(L=>stiffness26*(50-L));
 return{diameter,cx,cz,opening,r,qL,qR,lengths,forces,rearMouth,retentionMargin:diameter-rearMouth,cageGap:T26.radius-T26.linerRadius-outerFood,padXmargin:Math.min(cx-T26.backXmin,T26.backXmax-cx),openPadClearance:s+2-(r+Math.abs(cz)),rodEndGap:110-(Math.max(qL,qR)+80),bushRetainGap:Math.min(qL,qR)-2,allowed:valid&&outerFood<T26.radius-T26.linerRadius&&diameter>rearMouth,wholeLineAllowed:false};
}
export function permit26(profile,signals={}){const missing=['root_supported','both_pads_contact','source_stopped'].filter(k=>signals[k]!==true);if(!profile.allowed)missing.push('local_profile_out_of_range');missing.push('positive_transverse_support_not_completed','candidate_interfaces_not_approved','whole_line_profile_not_verified');return{release:false,missing};}
