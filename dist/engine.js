// Browser port of the 2026-09-28 BattleTacticEngine + Arena rules.
// Rendering, CPU decisions and persistence are deliberately outside this module.
export const TACTICS=['なし','攻撃力1.5倍','リスク','反射','得意属性プラス','全得意属性','毒付与','復讐','睡眠','狂化','予告','体得'];
export const DESCRIPTIONS=['','勝った場合、攻撃力を1.5倍にする。','すべての属性の攻撃力を2倍にする。負けた場合は1.5倍のダメージを受ける。','負けた場合、受けたダメージをそのまま相手にも与える。','相手の得意属性に勝った場合、攻撃力に200を加える。','すべての属性を得意属性の攻撃力として扱う。','勝った場合、相手に［毒］を付与する。\n［毒］8ターンの間、25ダメージを追加で受ける。\n再付与で猛毒（75×8ターン）、さらに再付与で致死毒（1000×1ターン）になる。','負けた場合、自分に［復讐］を付与する。\n［復讐］1ターンの間、攻撃力に得意属性の数値を加える。','引き分けの場合、相手に［睡眠］を付与する。\n［睡眠］1ターンの間、攻撃力が0になり、1.5倍のダメージを受ける。','負けた場合、自分に［狂化］を付与する。\n［狂化］4ターンの間、攻撃力に100を加える。','勝った場合、ダメージの代わりに攻撃力の2倍の［予告］を相手に付与する。\n［予告］3ターン後に、付与された数値のダメージを受ける。','ダメージを受けた場合、100ダメージ軽減する。\n相手が戦術を使った場合、このカードをその戦術に置き換える。'];
export const ATTRS=['火','草','水'];
export function roundEven(n){const f=Math.floor(n),d=n-f;return d===.5?(f%2===0?f:f+1):Math.round(n);}
export function judge(a,b){return a===b?0:((a+1)%3===b?1:2);}
const winner=hp=>hp[0]<=0&&hp[1]<=0?0:hp[0]<=0?2:hp[1]<=0?1:-1;
export function compute(x,c){
 const {moves,types,hp}=x, w=judge(...moves), damage=x.poison.map((n,i)=>Math.max(0,n)+Math.max(0,x.due[i]));
 const r={roundWinner:w,damage,hp:[...hp],matchWinner:-1,poisonTarget:0,revengeMask:0,sleepMask:0,berserkMask:0,foretellTarget:0,foretellAmount:0};
 if(w===0){if(types[0]===8)r.sleepMask|=2;if(types[1]===8)r.sleepMask|=1;}
 else{
  const win=w-1,lose=1-win,wt=types[win],lt=types[lose];
  const attacks=x.attacks[win].map((v,k)=>{v+=x.growth[win][k];if(x.ssr[win][0]===101)v=Math.max(0,v+x.ssr[win][1]);return v;});
  let chosen=wt===5?Math.max(...attacks):attacks[moves[win]],attack=chosen;
  if(wt===4){const oa=x.attacks[lose].map((v,k)=>v+x.growth[lose][k]),max=Math.max(...oa);if(oa.some((v,k)=>v===max&&judge(moves[win],k)===1))attack+=c.strongBreak_Add;}
  const has=(side,bit)=>(x.mask&(bit<<(side*3)))!==0;
  if(has(win,1))attack+=Math.max(...attacks);
  if(x.berserk[win]>0)attack+=c.berserk_Add*x.berserk[win];
  const foretellAttack=has(win,2)?0:attack;
  let mult=wt===1?c.fire15_Mult:wt===2?c.risk20_WinMult:1;
  if(lt===2)mult*=c.risk20_LoseTakenMult;if(has(lose,2))mult*=c.sleep_TakenDamageMult;
  let hit=has(win,2)?0:attack*mult;
  if(wt===10){const amt=roundEven(foretellAttack*c.foretell_Mult);if(amt>0){r.foretellTarget=lose+1;r.foretellAmount=amt;}hit=0;}
  const reflect=lt===3?roundEven(hit*c.reflect_Mult):0;
  damage[win]+=reflect;damage[lose]+=Math.max(0,roundEven(hit));
  if(wt===6)r.poisonTarget=lose+1;if(lt===7)r.revengeMask=1<<lose;if(lt===9)r.berserkMask=1<<lose;
  r.hp=hp.map((v,i)=>Math.max(0,v-damage[i]));r.matchWinner=winner(r.hp);
  if(r.matchWinner===0&&reflect>0&&lt===3)r.matchWinner=win+1;
  return r;
 }
 r.hp=hp.map((v,i)=>Math.max(0,v-damage[i]));r.matchWinner=winner(r.hp);return r;
}
export function rng(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function createMatch(data,characters,decks){
 const cards=new Map(data.cards.map(c=>[c.id,c]));
 if(characters.some(id=>!cards.has(id)||cards.get(id).type!==0))throw Error('キャラカードを選んでください。');
 for(const ids of decks)if(ids.length!==3||new Set(ids).size!==3||ids.some(id=>!cards.get(id)?.type))throw Error('異なる戦術カードを3枚選んでください。');
 return {turn:0,ready:false,winner:-1,sides:characters.map((card,i)=>({card,hp:data.settings.baseHP,deck:decks[i].map(id=>({id,left:1})),growth:[0,0,0],transformed:false,poison:{amount:0,left:0},foretell:[],revenge:0,sleep:0,berserk:[]})),history:[]};
}
export function beginTurn(state,data){if(state.winner!==-1)throw Error('試合は終了しています。');if(state.ready)throw Error('ターンは開始済みです。');state.turn++;state.ready=true;for(const s of state.sides)if(data.cards[s.card].ssr&&state.turn>=data.settings.transformTurn)s.transformed=true;}
export function baseAttacks(s,data){return data.cards[s.card].atk.map((v,i)=>v+s.growth[i]+(s.transformed?50:0));}
export function displayAttacks(s,data){const a=baseAttacks(s,data);return a.map(v=>s.sleep>0?0:v+(s.revenge>0?Math.max(...a):0)+s.berserk.length*data.engine.berserk_Add);}
export function computeInput(state,data,moves,slots){const sides=state.sides;return {moves,types:sides.map((s,i)=>slots[i]<0?0:data.cards[s.deck[slots[i]].id].type),hp:sides.map(s=>s.hp),attacks:sides.map(s=>data.cards[s.card].atk.map(v=>v+(s.transformed?50:0))),growth:sides.map(s=>s.growth),poison:sides.map(s=>s.poison.left>0?s.poison.amount:0),due:sides.map(s=>s.foretell.filter(f=>f.left===1).reduce((a,f)=>a+f.amount,0)),mask:sides.reduce((m,s,i)=>m|(((s.revenge>0?1:0)|(s.sleep>0?2:0)|(s.berserk.length?4:0))<<(i*3)),0),berserk:sides.map(s=>s.berserk.length),ssr:[[0,0],[0,0]]};}
export function resolve(state,data,moves,slots,random=Math.random){
 if(!state.ready||state.winner!==-1)throw Error('このターンは決着済みです。');
 if(moves.length!==2||moves.some(m=>!Number.isInteger(m)||m<0||m>2))throw Error('属性が不正です。');
 if(slots.length!==2||slots.some((v,i)=>!Number.isInteger(v)||v< -1||v>2||(v>=0&&state.sides[i].deck[v].left<1)))throw Error('その戦術は使えません。');
 const c=data.engine,x=computeInput(state,data,moves,slots),used=state.sides.map((s,i)=>slots[i]<0?-1:s.deck[slots[i]].id),startHp=[...x.hp],r=compute(x,c);
 state.ready=false;for(let i=0;i<2;i++)if(slots[i]>=0)state.sides[i].deck[slots[i]].left--;
 const penalty=data.settings.attrDrawPenaltyHp+(state.turn>=data.settings.drawPenaltyBonusStartTurn?data.settings.drawPenaltyBonusHp:0);
 if(r.roundWinner===0){r.damage=r.damage.map(v=>v+penalty);r.hp=r.hp.map(v=>Math.max(0,v-penalty));r.matchWinner=winner(r.hp);}
 r.learnMask=0;r.used=used;r.moves=[...moves];r.startHp=startHp;r.types=x.types;r.copied=[-1,-1];r.turn=state.turn;
 for(let i=0;i<2;i++)if(x.types[i]===11&&r.damage[i]>0){r.learnMask|=1<<i;r.damage[i]=Math.max(0,r.damage[i]-c.learn_DamageReduction);r.hp[i]=Math.max(0,startHp[i]-r.damage[i]);}
 if(r.hp[0]>0||r.hp[1]>0)r.matchWinner=winner(r.hp);
 for(let i=0;i<2;i++)if(x.types[i]===11&&used[1-i]>=0){r.learnMask|=1<<i;state.sides[i].deck[slots[i]]={id:used[1-i],left:1};r.copied[i]=used[1-i];}
 state.winner=r.matchWinner;
 for(let i=0;i<2;i++){
  const s=state.sides[i];s.hp=r.hp[i];
  if(state.winner!==-1){s.poison={amount:0,left:0};s.foretell=[];s.revenge=0;s.sleep=0;s.berserk=[];}
  else{
   const oldPoison=s.poison.left>0?s.poison.amount:0;
   if(--s.poison.left<=0)s.poison={amount:0,left:0};
   s.foretell=s.foretell.map(f=>({...f,left:f.left-1})).filter(f=>f.left>0);
   s.revenge=Math.max(0,s.revenge-1);s.sleep=Math.max(0,s.sleep-1);s.berserk=s.berserk.map(n=>n-1).filter(n=>n>0);
   if(r.foretellTarget===i+1){if(s.foretell.length<3)s.foretell.push({amount:r.foretellAmount,left:c.foretell_Turns});else s.foretell.reduce((a,b)=>a.left>=b.left?a:b).amount+=r.foretellAmount;}
   if(r.poisonTarget===i+1)s.poison=oldPoison>=c.poison_ToxicPerTurn?{amount:c.poison_DeadlyPerTurn,left:c.poison_DeadlyTurns}:oldPoison>0?{amount:c.poison_ToxicPerTurn,left:c.poison_ToxicTurns}:{amount:c.poison_PerTurn,left:c.poison_Turns};
   if(r.revengeMask&(1<<i))s.revenge=Math.max(s.revenge,c.revenge_Turns);if(r.sleepMask&(1<<i))s.sleep=Math.max(s.sleep,c.sleep_Turns);
   if(r.berserkMask&(1<<i)){if(s.berserk.length<8)s.berserk.push(c.berserk_Turns);else s.berserk[7]=Math.max(s.berserk[7],c.berserk_Turns);}
  }
  if(data.cards[s.card].growth){s.growth[Math.floor(random()*3)]+=50;if(r.roundWinner===i+1)s.growth[moves[i]]+=50;}
 }
 state.history.push(r);return r;
}
export function statusLabels(s){const a=[];if(s.transformed)a.push('変身');if(s.poison.left)a.push(`${s.poison.amount>=1000?'致死毒':s.poison.amount>=75?'猛毒':'毒'} ${s.poison.amount} ×残り${s.poison.left}`);if(s.revenge)a.push(`復讐 残り${s.revenge}`);if(s.sleep)a.push(`睡眠 残り${s.sleep}`);if(s.berserk.length)a.push(`狂化 ×${s.berserk.length}（${Math.max(...s.berserk)}ターン）`);for(const f of s.foretell)a.push(`予告 ${f.amount} / ${f.left}ターン後`);return a;}
export function activated(r,i){const t=r.types[i],win=r.roundWinner===i+1,lose=r.roundWinner===2-i;return t===11?!!(r.learnMask&(1<<i)):t===8?r.roundWinner===0:[3,7,9].includes(t)?lose:t>0&&win;}
