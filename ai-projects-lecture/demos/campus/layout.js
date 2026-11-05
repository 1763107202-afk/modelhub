// Photo-based layout; +Z faces the main gate. Dimensions are estimates.
export const teachingWingCenters=[32,-10,-52],teachingWingDepth=12;
export const adminOffsetZ=-30,rearOffsetZ=-40,sportsOffsetZ=-60;
export const frontRoad={x:0,z:-62.5,w:324,d:9};
export const rearRoad={x:0,z:-123,w:308,d:8};
export const sideGates={west:{x:-162,z:-203,fenceGap:23,roadWidth:14},east:{x:162,z:-62.5,fenceGap:20,roadWidth:9}};
export const roadRects=[frontRoad,rearRoad,
 {x:-31.2,z:-31.25,w:6,d:183.5},{x:31.2,z:-31.25,w:6,d:183.5},
 {x:-154,z:-142.5,w:8,d:405},{x:154,z:-142.5,w:8,d:405},
 {x:0,z:-338,w:308,d:8},
 {x:-103,z:-203,w:182,d:14},{x:-162,z:-203,w:38,d:34},
 {x:182.5,z:-62.5,w:45,d:9},{x:162,z:-62.5,w:40,d:24}
];
export function containsRect(x,z,r,margin=0){return Math.abs(x-r.x)<r.w/2+margin&&Math.abs(z-r.z)<r.d/2+margin;}
export function inSideEntranceRoad(x,z,margin=0){return roadRects.some(r=>containsRect(x,z,r,margin));}
export const buildingFootprints=[];
for(const sign of [-1,1]){
 for(const z of teachingWingCenters)buildingFootprints.push({x:sign*70,z,w:62,d:12});
 buildingFootprints.push({x:sign*45,z:-10,w:12,d:96});
 for(const z of [-77,-105])buildingFootprints.push({x:sign*70,z,w:62,d:12});
 buildingFootprints.push({x:sign*95.5,z:-91,w:11,d:40});
}
buildingFootprints.push({x:0,z:-92.5,w:47,d:21},{x:0,z:-74.6,w:18,d:10},{x:0,z:-112,w:18,d:10},
 {x:-93,z:-152,w:65,d:44},{x:-96,z:-243,w:64,d:43});
for(const x of [-27,27])for(const z of [-225,-273])buildingFootprints.push({x,z,w:20,d:16});
for(const z of [-221,-279])buildingFootprints.push({x:0,z,w:29,d:12});
for(const x of [-32,32])buildingFootprints.push({x,z:-250,w:11,d:40});
for(const side of [-1,1])buildingFootprints.push({x:-162,z:-203+side*18.3,w:6.2,d:6.8},{x:162,z:-62.5+side*14.4,w:5.2,d:6.5});
export function pointInPolygon(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [ax,az]=points[i],[bx,bz]=points[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;}
export const lakeControl=[[-34,-102],[-12,-99],[12,-101],[33,-108],[40,-119],[36,-132],[24,-145],[5,-151],[-17,-145],[-35,-134],[-42,-119],[-41,-108]];
export function inReservedGround(x,z,margin=0){return inSideEntranceRoad(x,z,margin)||buildingFootprints.some(r=>containsRect(x,z,r,margin))||pointInPolygon(x,z,lakeControl.map(([a,b])=>[a,b+rearOffsetZ]))||containsRect(x,z,{x:98,z:-226,w:104,d:193},margin);}
