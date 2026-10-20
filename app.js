(function () {
  'use strict';
  var SCORE_KEY = 'qiqi-moe-total-v1';
  var SETTINGS_KEY = 'qiqi-interactions-v2';
  var COMBO_WINDOW = 1800;
  var IDLE_INTERVAL = 5000;
  var $ = function (id) { return document.getElementById(id); };
  var state = { total: 0n, combo: 0, lastReward: 1n };
  var settings = { pinned: null, idleEnabled: true };
  var stage = $('petStage');
  var sprite = document.querySelector('.sprite-art');
  var emotion = $('emotionArt');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var frameTimer = 0, poseTimer = 0, comboTimer = 0, toastTimer = 0, lookTimer = 0;
  var frameGeneration = 0, activeUntil = 0, lastTapAt = 0, tapSequence = 0;
  var nextIdleAt = Date.now() + IDLE_INTERVAL;
  var pendingIdle = 0n;
  var animations = {
    idle: { row: 0, frames: [280,110,110,140,140,320], label: '安静陪着你' },
    right: { row: 1, frames: [120,120,120,120,120,120,120,220], label: '往右溜达一下' },
    left: { row: 2, frames: [120,120,120,120,120,120,120,220], label: '往左走两步' },
    wave: { row: 3, frames: [140,140,140,280], label: '开心挥挥手' },
    jump: { row: 4, frames: [140,140,140,140,280], label: '开心蹦一下' },
    failed: { row: 5, frames: [140,140,140,140,140,140,140,240], label: '小小委屈一下' },
    wait: { row: 6, frames: [150,150,150,150,150,260], label: '乖乖等你' },
    busy: { row: 7, frames: [120,120,120,120,120,220], label: '认真攒萌值' },
    review: { row: 8, frames: [150,150,150,150,150,280], label: '歪头想一想' }
  };
  var moods = [
    { id:'shy', name:'抱手撒娇', col:0, row:5, at:0n, lines:['轻一点啦，脸颊都变热了。','这样看着我，会有一点害羞……'] },
    { id:'pout', name:'小小委屈', col:7, row:5, at:0n, lines:['哼，脑袋要被敲成小馒头啦。','才没有生气，只是在等你哄我。'] },
    { id:'wink', name:'笑眯眯', col:2, row:0, at:1000n, lines:['叮！给你一个专属笑容。','看到你，眼睛就忍不住笑弯了。'] },
    { id:'sleepy', name:'歪头想想', col:2, row:8, at:10000n, lines:['让我歪着脑袋，认真想一想。','想到了，今天也要陪着你。'] },
    { id:'heart', name:'伸手抱抱', col:5, row:6, at:100000000n, lines:['张开双手，给你一个小小拥抱。','萌值好多，但最喜欢的还是你来陪我。'] },
    { id:'cheer', name:'元气挥手', col:2, row:3, at:1000000000000n, lines:['好耶！可爱要从兔耳朵溢出来啦！','挥挥手，把今天的开心分给你。'] }
  ];
  var nativeLines = {
    wave:['你来啦，我的兔耳朵都精神了！','这一下我收到啦，挥挥手回应你。','嗨！今天也一起攒可爱吧。'],
    wait:['我站好啦，下一下也要轻轻的哦。','不用着急，我会乖乖等你。','嗯？是在叫我吗？'],
    review:['让我认真数数，又多了好多萌值。','歪歪脑袋，今天该怎么可爱呢？','我正在想，要给你什么样的回应。'],
    busy:['忙着把你的喜欢收进小口袋。','萌值好多，淇淇正在认真整理！','努力工作中……工作内容是变可爱。'],
    right:['我去右边看看，马上回来！','换个位置，也还是你的淇淇。'],
    left:['左边也有一点点可爱，去捡回来。','走两步，裙摆也跟着开心。'],
    failed:['哎呀，刚才没站稳。再夸我一句就好了。','小小委屈一下，摸摸头就能恢复。'],
    jump:['这一份开心，忍不住跳起来啦！','蹦一下，把可爱送得再高一点！']
  };
  var talkLines = [
    ['我叫淇淇，今天开始请多多陪我。','兔耳朵是发饰，但想你是真的。','你可以摸摸头，也可以陪我说说话。'],
    ['已经认得你的手啦，轻轻的就知道是你。','你来了以后，这里每天都亮一点。','一千点萌值，换来一位熟悉的朋友。'],
    ['我们是不是越来越有默契啦？','我的小拥抱，已经替你保管很久了。','今天的开心里，有很大一份是你。'],
    ['萌值再多，也装不下所有的喜欢。','只要你来，我就有好多可爱可以分享。','今天也一起，把平平常常过成可可爱爱。']
  ];
  var randomLine = function (lines) { return lines[Math.floor(Math.random()*lines.length)]; };
  function findMood(id) { return moods.find(function (m) { return m.id === id; }); }
  function unlocked(mood) { return mood && state.total >= mood.at; }
  function tier() { return state.total >= 1000000000000n ? 3 : state.total >= 100000000n ? 2 : state.total >= 1000n ? 1 : 0; }
  function readState() {
    try { var value=localStorage.getItem(SCORE_KEY); if(value && /^\d+$/.test(value)) state.total=BigInt(value); } catch (_) {}
    try { var saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); settings.idleEnabled=saved.idleEnabled!==false; settings.pinned=unlocked(findMood(saved.pinned))?saved.pinned:null; } catch (_) {}
  }
  function saveScore() { try { localStorage.setItem(SCORE_KEY,state.total.toString()); } catch (_) { showToast('浏览器暂时无法保存记录'); } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); } catch (_) {} }
  function superscript(value) { var map='⁰¹²³⁴⁵⁶⁷⁸⁹'; return String(value).split('').map(function(d){return map[Number(d)];}).join(''); }
  function formatValue(value) {
    var units=['','万','亿','兆','京','垓','秭','穰','沟','涧','正','载'];
    var digits=value.toString();
    if(digits.length<=4) return value.toLocaleString('zh-CN');
    var group=Math.floor((digits.length-1)/4);
    if(group<units.length) { var scale=10n**BigInt(group*4); var decimals=((value%scale)*100n/scale).toString().padStart(2,'0').replace(/0+$/,''); return (value/scale).toString()+(decimals?'.'+decimals:'')+units[group]; }
    var tail=digits.slice(1,3).replace(/0+$/,'');
    return digits[0]+(tail?'.'+tail:'')+'×10'+superscript(digits.length-1);
  }
  // Keep the existing tap reward rule and score storage when adding interactions.
  function rewardFor(combo) { if(combo===1)return 1n; if(combo===2)return 10n; return 10n**BigInt(combo); }
  function multiplierFor(combo) { return 10n**BigInt(Math.max(0,combo-1)); }
  function showToast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){$('toast').classList.remove('show');},2400); }
  function say(message) { $('speechText').textContent=message; $('speechBubble').classList.remove('pop'); void $('speechBubble').offsetWidth; $('speechBubble').classList.add('pop'); }
  function setFrame(row,col) { sprite.style.backgroundPosition=(col/7*100)+'% '+(row/10*100)+'%'; }
  function stopFrames() { clearTimeout(frameTimer); frameGeneration+=1; }
  function animateNative(key) {
    stopFrames(); var gen=frameGeneration; var anim=animations[key];
    var draw=function(index){ if(gen!==frameGeneration||document.hidden)return; setFrame(anim.row,index); if(reducedMotion.matches)return; frameTimer=setTimeout(function(){draw((index+1)%anim.frames.length);},anim.frames[index]); };
    draw(0);
  }
  function showNative(key,label,duration) {
    clearTimeout(poseTimer); clearTimeout(lookTimer); activeUntil=Date.now()+duration;
    emotion.classList.remove('visible'); sprite.classList.remove('is-hidden');
    stage.dataset.action=key; $('actionName').textContent=label||animations[key].label;
    animateNative(key); poseTimer=setTimeout(restorePose,duration);
  }
  function showMood(id,label,duration) {
    var mood=findMood(id); if(!unlocked(mood))return;
    clearTimeout(poseTimer); clearTimeout(lookTimer); stopFrames(); activeUntil=duration?Date.now()+duration:0;
    emotion.style.backgroundPosition=(mood.col/7*100)+'% '+(mood.row/10*100)+'%';
    sprite.classList.add('is-hidden'); emotion.classList.remove('visible'); void emotion.offsetWidth; emotion.classList.add('visible');
    stage.dataset.action=mood.id; $('actionName').textContent=label||mood.name;
    if(duration) poseTimer=setTimeout(restorePose,duration);
  }
  function restorePose() {
    clearTimeout(poseTimer); activeUntil=0; stage.removeAttribute('data-action');
    if(unlocked(findMood(settings.pinned))) { showMood(settings.pinned,null,0); return; }
    emotion.classList.remove('visible'); sprite.classList.remove('is-hidden'); $('actionName').textContent='安静陪着你'; animateNative('idle');
  }
  function nativeDuration(key) { return animations[key].frames.reduce(function(a,b){return a+b;},0); }
  function floatReward(value,idle) {
    var bubble=document.createElement('span'); bubble.className='float-reward'+(idle?' idle':state.combo>=3?' critical':'');
    bubble.textContent='+'+formatValue(value)+' 萌值'; bubble.style.left=(47+Math.random()*8)+'%'; stage.appendChild(bubble); setTimeout(function(){bubble.remove();},1000);
  }
  function newUnlocks(before) { return moods.filter(function(m){return m.at>before&&m.at<=state.total;}); }
  function renderAlbum() {
    moods.forEach(function(m){ var button=$('mood-'+m.id); var available=unlocked(m); button.disabled=!available; button.setAttribute('aria-pressed',String(settings.pinned===m.id)); button.querySelector('small').textContent=available?(settings.pinned===m.id?'正在陪你':'点击试试'):formatValue(m.at)+' 萌值解锁'; });
    $('autoMood').setAttribute('aria-pressed',String(!settings.pinned));
  }
  function render() {
    $('scoreTotal').textContent=formatValue(state.total);
    $('multiplier').textContent='×'+formatValue(multiplierFor(Math.max(1,state.combo)));
    $('rewardValue').textContent='+'+formatValue(state.lastReward)+' 萌值';
    $('tapRewardPreview').textContent='+'+formatValue(rewardFor(state.combo+1))+' 萌值';
    $('comboCount').textContent='连敲 '+state.combo+' 次';
    $('comboStatus').textContent=state.combo===0?'准备好就敲敲淇淇':state.combo===1?'第一下，淇淇收到啦':state.combo===2?'连起来了，倍率 ×10':state.combo===3?'萌值暴击！倍率 ×100':'连击不停，萌值飞涨';
    var names=['初见的小心动','熟悉的好朋友','默契的陪伴','满满的偏爱']; $('bondLevel').textContent=names[tier()];
    var next=moods.find(function(m){return !unlocked(m);});
    if(next) { $('bondNext').textContent='再攒 '+formatValue(next.at-state.total)+' 萌值，解锁「'+next.name+'」'; $('bondFill').style.width=Number(state.total*10000n/next.at)/100+'%'; }
    else { $('bondNext').textContent='六种小动作全部解锁，选一个让她陪着你。'; $('bondFill').style.width='100%'; }
    $('idleToggle').setAttribute('aria-pressed',String(settings.idleEnabled)); $('idleToggle').textContent=settings.idleEnabled?'已开启':'已暂停';
    renderAlbum(); renderCountdown();
  }
  function renderCountdown() { $('idleCountdown').textContent=settings.idleEnabled?'再 '+Math.max(1,Math.ceil((nextIdleAt-Date.now())/1000))+' 秒，悄悄 +1 萌值':'开启后，待机每 5 秒 +1 萌值'; }
  function resetIdleClock() { nextIdleAt=Date.now()+IDLE_INTERVAL; renderCountdown(); }
  function presentIdleGain(value) { say('哎呀不小心变萌了'); floatReward(value,true); showMood('shy','哎呀，悄悄变萌了',1600); }
  function collectIdle() {
    var now=Date.now();
    if(!settings.idleEnabled||now<nextIdleAt)return;
    var ticks=Math.floor((now-nextIdleAt)/IDLE_INTERVAL)+1;
    nextIdleAt+=ticks*IDLE_INTERVAL;
    var before=state.total, earned=BigInt(ticks); state.total+=earned; saveScore(); render();
    var unlockedNow=newUnlocks(before); if(unlockedNow.length&&!document.hidden)showToast('新表情解锁：'+unlockedNow.map(function(m){return m.name;}).join('、'));
    if(document.hidden)pendingIdle+=earned; else presentIdleGain(earned);
  }
  function hit() {
    resetIdleClock(); var now=Date.now(); if(now-lastTapAt>COMBO_WINDOW)state.combo=0;
    state.combo+=1; tapSequence+=1; lastTapAt=now;
    var before=state.total, reward=rewardFor(state.combo); state.lastReward=reward; state.total+=reward; saveScore(); render(); floatReward(reward,false);
    var newly=newUnlocks(before), available=moods.filter(unlocked);
    if(newly.length) { var newest=newly[newly.length-1]; showMood(newest.id,null,2500); say('新表情解锁啦！'+randomLine(newest.lines)); showToast('解锁「'+newest.name+'」'); }
    else if(state.combo===3) { showNative('jump',null,nativeDuration('jump')); say('哇！第三下 ×100，送你 1,000 萌值！'); }
    else if(tapSequence%3===0) { var m=available[Math.floor(Math.random()*available.length)]; showMood(m.id,null,2300); say(randomLine(m.lines)); }
    else { var cycle=['wave','wait','review','busy','right','left','failed']; var key=cycle[(tapSequence-1)%cycle.length]; showNative(key,null,nativeDuration(key)); say(randomLine(nativeLines[key])); }
    $('bonkMark').textContent=state.combo>=3?'叮！':'啵！'; stage.classList.remove('is-hit'); void stage.offsetWidth; stage.classList.add('is-hit'); setTimeout(function(){stage.classList.remove('is-hit');},650);
    clearTimeout(comboTimer); $('comboFill').style.transition='none'; $('comboFill').style.width='100%';
    requestAnimationFrame(function(){$('comboFill').style.transition='width '+COMBO_WINDOW+'ms linear'; $('comboFill').style.width='0%';});
    comboTimer=setTimeout(function(){state.combo=0;lastTapAt=0;render();},COMBO_WINDOW);
  }
  function interact(kind) {
    resetIdleClock();
    if(kind==='pet') { showMood('shy','被你摸摸头',2700); say(randomLine(['轻轻的，好舒服……再摸一下可以吗？','兔耳朵也想被你摸摸。','脸颊热热的，都是因为你。'])); }
    if(kind==='praise') { var key=unlocked(findMood('heart'))?'heart':unlocked(findMood('wink'))?'wink':'shy'; showMood(key,'收到你的夸夸',2600); say(randomLine(findMood(key).lines)); }
    if(kind==='play') { var play=['left','right','busy','jump']; var action=play[Math.floor(Math.random()*play.length)]; showNative(action,null,nativeDuration(action)); say(randomLine(nativeLines[action])); }
    if(kind==='talk') { showNative('review','认真听你说',nativeDuration('review')); say(randomLine(talkLines[tier()])); }
  }
  $('headHit').addEventListener('click',function(){if(suppressHeadClick){suppressHeadClick=false;return;}hit();});
  $('tapButton').addEventListener('click',hit);
  document.querySelectorAll('[data-interact]').forEach(function(button){button.addEventListener('click',function(){interact(button.dataset.interact);});});
  moods.forEach(function(m){ $('mood-'+m.id).addEventListener('click',function(){if(!unlocked(m))return;resetIdleClock();settings.pinned=m.id;saveSettings();showMood(m.id,null,0);say(randomLine(m.lines));renderAlbum();}); });
  $('autoMood').addEventListener('click',function(){resetIdleClock();settings.pinned=null;saveSettings();restorePose();say('好呀，让我的小心情自己变来变去。');renderAlbum();});
  $('idleToggle').addEventListener('click',function(){settings.idleEnabled=!settings.idleEnabled;resetIdleClock();saveSettings();render();say(settings.idleEnabled?'那我就乖乖待着，悄悄变萌。':'好呀，先专心陪你玩。');});
  var pressTimer=0,suppressHeadClick=false;
  $('headHit').addEventListener('pointerdown',function(event){if(event.pointerType==='mouse'&&event.button!==0)return;suppressHeadClick=false;pressTimer=setTimeout(function(){suppressHeadClick=true;interact('pet');},550);});
  function releasePress(){clearTimeout(pressTimer);}
  $('headHit').addEventListener('pointerup',releasePress); $('headHit').addEventListener('pointercancel',releasePress); $('headHit').addEventListener('pointerleave',releasePress);
  stage.parentElement.addEventListener('pointermove',function(event){
    if(event.pointerType!=='mouse'||settings.pinned||Date.now()<activeUntil||document.hidden)return;
    var rect=sprite.getBoundingClientRect(),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/3);
    if(Math.hypot(dx,dy)<45)return;
    stopFrames(); var angle=(Math.atan2(dx,-dy)*180/Math.PI+360)%360; var index=Math.round(angle/22.5)%16;
    setFrame(9+Math.floor(index/8),index%8); $('actionName').textContent='目光跟着你'; clearTimeout(lookTimer); lookTimer=setTimeout(restorePose,1200);
  });
  stage.parentElement.addEventListener('pointerleave',function(){if(!settings.pinned&&Date.now()>=activeUntil)restorePose();});
  $('resetButton').addEventListener('click',function(){
    if(!window.confirm('要把累计萌值清零吗？表情解锁也会从头开始。'))return;
    state.total=0n;state.combo=0;state.lastReward=1n;lastTapAt=0;pendingIdle=0n;clearTimeout(comboTimer);
    if(!unlocked(findMood(settings.pinned)))settings.pinned=null;
    $('comboFill').style.transition='none';$('comboFill').style.width='0%';saveSettings();saveScore();resetIdleClock();render();restorePose();say('从第一点可爱开始，我还是会陪着你。');
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden){stopFrames();}else{collectIdle();restorePose();if(pendingIdle>0n){presentIdleGain(pendingIdle);pendingIdle=0n;}}});
  reducedMotion.addEventListener('change',restorePose);
  readState();render();restorePose();
  setInterval(function(){collectIdle();renderCountdown();},250);
  setInterval(function(){if(!settings.idleEnabled&&!document.hidden&&Date.now()>=activeUntil)say(randomLine(talkLines[tier()]));},15000);
}());
