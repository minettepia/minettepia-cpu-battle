import {baseAttacks,compute,computeInput} from './engine.js';
const choose=(weights,random)=>{let u=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){u-=weights[i];if(u<0)return i;}return weights.length-1;};
// Called at turn start, before any player input. Opponent private deck is never read.
export function chooseCpu(state,data,random=Math.random){
 const me=state.sides[1],enemy=state.sides[0],own=baseAttacks(me,data),opp=baseAttacks(enemy,data),sum=opp.reduce((a,b)=>a+b,0);
 const probability=opp.map(a=>.2/3+.8*a/sum),slots=[-1,...me.deck.map((d,i)=>d.left>0?i:-1).filter(i=>i>=0)];
 const values=slots.map(slot=>[0,1,2].map(move=>[0,1,2].reduce((total,opMove)=>{
  const input=computeInput(state,data,[opMove,move],[-1,slot]),r=compute(input,data.engine),type=input.types[1];
  let taken=r.damage[1],dealt=r.damage[0];if(r.roundWinner===0){const pen=data.settings.attrDrawPenaltyHp+(state.turn>=data.settings.drawPenaltyBonusStartTurn?data.settings.drawPenaltyBonusHp:0);taken+=pen;dealt+=pen;}
  if(type===11)taken=Math.max(0,taken-data.engine.learn_DamageReduction);
  let v=Math.min(enemy.hp,dealt)-Math.min(me.hp,taken);if(dealt>=enemy.hp)v+=900;if(taken>=me.hp)v-=900;
  const horizon=Math.min(6,Math.max(1,Math.min(me.hp,enemy.hp)/110));
  if(r.poisonTarget===1)v+=(enemy.poison.amount===0?25:enemy.poison.amount<75?75:1000)*Math.min(enemy.poison.amount>=75?1:8,horizon)*.7;
  if(r.berserkMask===2)v+=100*Math.min(4,horizon)/3*.8;
  if(r.revengeMask===2)v+=Math.max(...own)/3*.8;
  if(r.sleepMask===1)v+=(opp.reduce((a,b)=>a+b)/3+.5*own.reduce((a,b)=>a+b)/3)/3*.8;
  if(r.foretellTarget===1)v+=r.foretellAmount*.82**3*Math.min(1,horizon/3);
  if(type===11)v+=70*(state.turn<=3?.65:state.turn<=6?.3:.1);
  return total+probability[opMove]*v;
 },0)));
 const moveWeights=values.map(v=>{const max=Math.max(...v),w=v.map(x=>Math.exp((x-max)/100)),s=w.reduce((a,b)=>a+b);return w.map(x=>.2/3+.8*x/s);});
 const totals=values.map((v,i)=>v.reduce((n,x,j)=>n+x*moveWeights[i][j],0)-(slots[i]<0?0:Math.min(me.hp,enemy.hp)<300?5:30));
 const best=Math.max(...totals),index=choose(totals.map(v=>Math.exp((v-best)/30)),random);
 return {slot:slots[index],move:choose(moveWeights[index],random)};
}
