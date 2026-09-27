'use strict';
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="studio-token"]').content;
const state = { config:{}, active:null, revision:null, rows:[], total:0, offset:0,
  dirty:false, busy:false, editVersion:0, loadVersion:0, draftPromise:null, timer:null, scene:'', saved:false };
const statuses = {unannotated:'未标注',saved:'已保存',review:'待检查',checked:'已核对'};
const noChange = ['There is no difference.', 'The two scenes seem identical.', 'The scene is the same as before.', 'No change has occurred.', 'Almost nothing has changed.'];

async function api(path, data, opts={}) {
  const options={...opts,headers:{'X-Studio-Token':token,...(opts.headers||{})}};
  if(data!==undefined){ options.method='POST';options.body=JSON.stringify(data);options.headers['Content-Type']='application/json'; }
  const r=await fetch('/api/'+path,options);
  if(!r.ok){let b;try{b=await r.json();}catch{b={error:`请求失败 (${r.status})`};}throw new Error(b.error);}
  return r.json();
}
function notice(message){$('notice').hidden=!message;$('notice').querySelector('span').textContent=message||'';}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6000);}
function icons(){if(window.lucide)window.lucide.createIcons();}
function setBusy(b){state.busy=b;$('editorFields').inert=b;for(const id of ['save','restore','previous','next','nextIncomplete','settingsButton','importButton','exportButton'])$(id).disabled=b;}
async function run(fn){if(state.busy)return;setBusy(true);try{await fn();}catch(e){notice(e.message);}finally{setBusy(false);}}
function values(){return [...document.querySelectorAll('.caption-input')].map(x=>x.value);}
function flag(){const v=document.querySelector('input[name=flag]:checked');return v?Number(v.value):null;}
function payload(){return {key:state.active.key,revision:state.revision,descriptions:values(),changeflag:flag(),scene:$('scene').value,reviewed:$('reviewed').checked};}
function problems(){const seen=new Set(),errors=[];values().forEach((v,i)=>{const norm=v.trim().toLowerCase().replace(/[\s.,!?;:]+/g,' ');let bad=false;if(!v.trim()){errors.push(`描述 ${i+1} 为空`);bad=true;}else if(seen.has(norm)){errors.push(`描述 ${i+1} 与其他描述重复`);bad=true;}seen.add(norm);$(`caption${i+1}`).closest('.caption-group').classList.toggle('invalid',bad);});if(flag()===null)errors.unshift('请选择变化状态');return errors;}
function updateFilled(){const v=values();$('filled').textContent=`${v.filter(x=>x.trim()).length} / 5`;v.forEach((s,i)=>$(`length${i+1}`).textContent=`${s.length} 字符`);}
function edited(){if(!state.active)return;state.dirty=true;state.editVersion++;$('reviewed').checked=false;$('saveState').textContent='尚未保存';$('validation').textContent='';updateFilled();}
for(let i=1;i<=5;i++){
  const div=document.createElement('div');div.className='caption-group';
  div.innerHTML=`<label class="caption-label" for="caption${i}"><span>描述 ${String(i).padStart(2,'0')}</span><small id="length${i}">0 字符</small></label><textarea id="caption${i}" class="caption-input" maxlength="6000" aria-label="描述 ${i}" spellcheck="true"></textarea>`;
  $('captions').append(div);$(`caption${i}`).addEventListener('input',edited);
}
document.querySelectorAll('input[name=flag]').forEach(x=>x.addEventListener('change',edited));
$('scene').addEventListener('change',edited);
$('reviewed').addEventListener('change',()=>{if(state.active){state.dirty=true;state.editVersion++;$('saveState').textContent='尚未保存';}});

async function flushDraft(){
  if(state.draftPromise)await state.draftPromise;
  if(!state.active||!state.dirty)return;
  const p=payload(), version=state.editVersion;
  state.draftPromise=api('draft',p);
  try{await state.draftPromise;if(version===state.editVersion){state.dirty=false;$('saveState').textContent='草稿已保存';}}
  finally{state.draftPromise=null;}
}
function fillForm(data){
  const descriptions=data.descriptions||[];values().forEach((_,i)=>$(`caption${i+1}`).value=descriptions[i]||'');
  document.querySelectorAll('input[name=flag]').forEach(x=>x.checked=Number(x.value)===data.changeflag);
  const scene=data.scene||state.config.scene;
  if(![...$('scene').options].some(x=>x.value===scene)){$('scene').add(new Option(scene,scene));}
  $('scene').value=scene;$('reviewed').checked=!!data.reviewed;
  $('validation').textContent='';document.querySelectorAll('.caption-group').forEach(x=>x.classList.remove('invalid'));updateFilled();
}
async function openSample(key){
  await flushDraft();
  const result=await api('sample?key='+encodeURIComponent(key));
  state.active=result.sample;state.revision=result.revision;state.dirty=false;state.saved=!!result.record;state.editVersion++;
  let data=result.record?{descriptions:result.record.sentences.map(x=>x.raw),changeflag:result.record.changeflag,...result.meta}:{};
  if(result.draft&&result.draft.revision===result.revision){data=result.draft;toast('已恢复此样本的草稿');}
  else if(result.draft){notice('检测到基于旧记录的草稿，未自动覆盖。请在工作区 recovery.sqlite3 中核查，或恢复正式记录后继续。');}
  fillForm(data);
  $('sampleName').textContent=result.sample.filename;
  $('sampleMeta').textContent=`${result.sample.split} · ${result.record?'ID '+result.record.imgid:'新样本'} · ${$('scene').value}`;
  $('saveState').textContent=result.draft?'待检查 / 已恢复草稿':result.record?'已保存':'未标注';
  if(result.sample.missing.length)notice('样本缺失：'+result.sample.missing.join('、')+'。请补齐文件后重新扫描。');
  else if(!result.draft)notice('');
  if(result.issues?.length)notice('原标注编号需核查：'+result.issues.join('；')+'。可在设置中明确确认修复。');
  document.querySelectorAll('.task').forEach(b=>b.classList.toggle('active',b.dataset.key===key));
  loadImages(key);
}
async function refreshList(){
  const q=new URLSearchParams({q:$('search').value,status:$('statusFilter').value,split:$('splitFilter').value,offset:state.offset,limit:100});
  const data=await api('samples?'+q);
  if(state.offset>=data.total&&state.offset>0){state.offset=Math.max(0,Math.floor((data.total-1)/100)*100);return refreshList();}
  state.rows=data.items;state.total=data.total;
  const c=data.counts;$('countSaved').textContent=(c.saved+c.checked).toLocaleString();$('countTotal').textContent=c.all.toLocaleString();
  $('progress').max=c.all||1;$('progress').value=c.saved+c.checked;
  $('counts').textContent=`未标注 ${c.unannotated} · 待检查 ${c.review} · 已核对 ${c.checked}`;
  $('taskList').replaceChildren();
  for(const item of data.items){
    const b=document.createElement('button');b.className='task'+(state.active?.key===item.key?' active':'');b.dataset.key=item.key;
    const group=document.createElement('span'),name=document.createElement('span'),sub=document.createElement('span'),dot=document.createElement('span');
    name.className='task-title';name.textContent=item.filename;
    sub.className='task-sub';sub.textContent=`${item.split} · ${statuses[item.status]}${item.missing.length?' · 缺失影像':''}`;
    dot.className='state-dot '+item.status;group.append(name,sub);b.append(group,dot);b.addEventListener('click',()=>run(()=>openSample(item.key)));$('taskList').append(b);
  }
  if(!data.items.length){const p=document.createElement('p');p.className='muted';p.style.padding='20px 10px';p.textContent=data.scanning?'正在扫描数据集…':'没有符合条件的样本';$('taskList').append(p);}
  $('pageLabel').textContent=`${data.total?state.offset+1:0}–${Math.min(state.offset+100,data.total)} / ${data.total}`;
  $('pagePrev').disabled=state.offset===0;$('pageNext').disabled=state.offset+100>=data.total;
  if(data.error)notice(data.error);
  if(data.scanning){clearTimeout(refreshList.timer);refreshList.timer=setTimeout(()=>refreshList().catch(e=>notice(e.message)),500);}
  return data;
}
async function move(delta){
  if(!state.active)return;
  const i=state.rows.findIndex(x=>x.key===state.active.key);
  if(i<0){await refreshList();return;}
  const next=i+delta;
  if(next>=0&&next<state.rows.length){await openSample(state.rows[next].key);return;}
  const offset=state.offset+(delta>0?100:-100);
  if(offset<0||offset>=state.total){toast('已到当前筛选范围的边界');return;}
  await flushDraft();state.offset=offset;await refreshList();
  if(state.rows.length)await openSample(state.rows[delta>0?0:state.rows.length-1].key);
}
async function save(){
  if(!state.active){notice('请先选择样本。');return false;}
  const errors=problems();if(errors.length){$('validation').textContent=errors.join('\n');await flushDraft();return false;}
  if(state.draftPromise)await state.draftPromise;
  const result=await api('save',payload());state.revision=result.revision;state.dirty=false;state.saved=true;
  $('saveState').textContent=$('reviewed').checked?'已保存 · 已核对':'已保存';
  $('validation').textContent='';toast('正式标注已保存，ID 保持稳定');await refreshList();return true;
}
$('save').onclick=()=>run(save);
$('previous').onclick=()=>run(()=>move(-1));$('next').onclick=()=>run(()=>move(1));
$('restore').onclick=()=>run(async()=>{if(!state.active)return;if(!confirm('放弃当前草稿，恢复最近一次正式保存？'))return;await api('discard-draft',{key:state.active.key});state.dirty=false;await openSample(state.active.key);await refreshList();});
$('noChange').onclick=()=>{if(values().some(x=>x.trim())&&!confirm('用五条无变化描述替换当前输入？'))return;document.querySelector('input[name=flag][value="0"]').checked=true;noChange.forEach((s,i)=>$(`caption${i+1}`).value=s);edited();};
$('nextIncomplete').onclick=()=>run(async()=>{await flushDraft();$('statusFilter').value='unannotated';$('search').value='';state.offset=0;await refreshList();if(state.rows.length)await openSample(state.rows[0].key);else{ $('statusFilter').value='review';await refreshList();if(state.rows.length)await openSample(state.rows[0].key);else toast('没有未完成样本');}});
for(const id of ['splitFilter','statusFilter'])$(id).onchange=()=>run(async()=>{state.offset=0;await refreshList();});
let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>run(async()=>{state.offset=0;await refreshList();}),250);};
$('pagePrev').onclick=()=>run(async()=>{state.offset=Math.max(0,state.offset-100);await refreshList();});
$('pageNext').onclick=()=>run(async()=>{state.offset+=100;await refreshList();});
$('notice').querySelector('button').onclick=()=>notice('');

const views={};let selectedView='A';
for(const kind of ['A','B','label']){views[kind]={canvas:$('canvas'+kind),image:null,zoom:1,panX:0,panY:0};}
function draw(v){
  const r=v.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const dpr=window.devicePixelRatio||1;v.canvas.width=Math.round(r.width*dpr);v.canvas.height=Math.round(r.height*dpr);
  const ctx=v.canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,r.width,r.height);
  if(!v.image)return;
  const fit=Math.min(r.width/v.image.width,r.height/v.image.height),w=v.image.width*fit*v.zoom,h=v.image.height*fit*v.zoom;
  v.drawWidth=w;v.drawHeight=h;
  ctx.imageSmoothingEnabled=v.zoom<3;
  ctx.drawImage(v.image,(r.width-w)/2+v.panX*w,(r.height-h)/2+v.panY*h,w,h);
}
function renderAll(){Object.values(views).forEach(draw);$('zoomLevel').textContent=Math.round(views[selectedView].zoom*100)+'%';}
function syncFrom(v){if($('sync').checked)Object.values(views).forEach(o=>{o.zoom=v.zoom;o.panX=v.panX;o.panY=v.panY;});renderAll();}
function zoom(factor){const v=views[selectedView];v.zoom=Math.max(.25,Math.min(20,v.zoom*factor));syncFrom(v);}
function fit(){Object.values(views).forEach(v=>{v.zoom=1;v.panX=v.panY=0;});renderAll();}
for(const [kind,v] of Object.entries(views)){
  new ResizeObserver(()=>draw(v)).observe(v.canvas.parentElement);
  v.canvas.onwheel=e=>{e.preventDefault();selectedView=kind;zoom(e.deltaY<0?1.15:1/1.15);};
  let pointer=null;
  v.canvas.onpointerdown=e=>{selectedView=kind;pointer={x:e.clientX,y:e.clientY};v.canvas.setPointerCapture(e.pointerId);};
  v.canvas.onpointermove=e=>{if(!pointer||!v.image)return;v.panX+=(e.clientX-pointer.x)/(v.drawWidth||1);v.panY+=(e.clientY-pointer.y)/(v.drawHeight||1);pointer={x:e.clientX,y:e.clientY};syncFrom(v);};
  v.canvas.onpointerup=()=>pointer=null;v.canvas.onpointercancel=()=>pointer=null;
}
async function loadImages(key){
  const generation=++state.loadVersion;fit();
  await Promise.all(Object.entries(views).map(async([kind,v])=>{
    v.image=null;draw(v);$('message'+kind).hidden=false;$('message'+kind).textContent='加载中…';
    try{
      const r=await fetch('/api/image?'+new URLSearchParams({key,kind}),{headers:{'X-Studio-Token':token}});
      if(!r.ok){const b=await r.json();throw Error(b.error);}
      const image=new Image(),url=URL.createObjectURL(await r.blob());
      try{image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
      if(generation!==state.loadVersion)return;
      v.image=image;$('message'+kind).hidden=true;draw(v);
      if(kind==='A')$('imageInfo').textContent=`预览 ${image.width} × ${image.height} px · 原始文件不变`;
    }catch(e){if(generation===state.loadVersion){$('message'+kind).textContent=e.message;$('message'+kind).hidden=false;}}
  }));
}
$('zoomIn').onclick=()=>zoom(1.25);$('zoomOut').onclick=()=>zoom(.8);$('fit').onclick=fit;
$('sync').onchange=()=>syncFrom(views[selectedView]);
$('showMask').onchange=()=>{$('imageGrid').classList.toggle('no-mask',!$('showMask').checked);renderAll();};

function applyConfig(){document.body.dataset.theme=state.config.theme;document.documentElement.style.fontSize=state.config.font_size+'px';$('sync').checked=state.config.sync;$('showMask').checked=state.config.show_mask;$('imageGrid').classList.toggle('no-mask',!state.config.show_mask);$('timeA').textContent=state.config.time_a;$('timeB').textContent=state.config.time_b;clearInterval(state.timer);state.timer=setInterval(()=>{if(!state.busy)flushDraft().catch(e=>{notice('自动保存失败：'+e.message);$('saveState').textContent='草稿未保存';});},state.config.autosave*1000);}
function settingsDialog(){const c=state.config;for(const [id,key] of Object.entries({cfgDataset:'dataset',cfgOutput:'output',cfgAutosave:'autosave',cfgFont:'font_size',cfgTheme:'theme',cfgExport:'export_format',cfgTimeA:'time_a',cfgTimeB:'time_b'}))$(id).value=c[key]??'';$('cfgSync').checked=c.sync;$('cfgMask').checked=c.show_mask;$('settingsError').textContent='';$('settingsDialog').showModal();}
function clearSelection(){
  state.active=null;state.revision=null;state.dirty=false;state.saved=false;state.loadVersion++;
  fillForm({});$('sampleName').textContent='请选择样本';$('sampleMeta').textContent='';
  $('saveState').textContent='未选择';$('imageInfo').textContent='';
  for(const [kind,v] of Object.entries(views)){v.image=null;$('message'+kind).textContent='请选择样本';$('message'+kind).hidden=false;}
  fit();notice('');
}
$('settingsButton').onclick=()=>run(async()=>{await flushDraft();settingsDialog();});
$('settingsForm').onsubmit=async e=>{e.preventDefault();const b={dataset:$('cfgDataset').value,output:$('cfgOutput').value,autosave:Number($('cfgAutosave').value),font_size:Number($('cfgFont').value),theme:$('cfgTheme').value,export_format:$('cfgExport').value,time_a:$('cfgTimeA').value,time_b:$('cfgTimeB').value,sync:$('cfgSync').checked,show_mask:$('cfgMask').checked};try{await flushDraft();await api('config',b);state.config=(await api('config')).settings;applyConfig();$('settingsDialog').close();clearSelection();state.offset=0;await refreshList();toast('设置已保存');}catch(err){$('settingsError').textContent=err.message;}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('[data-browse]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const result=await api('browse',{kind:b.dataset.kind||'folder'});if(result.path)$(b.dataset.browse).value=result.path;}catch(e){notice(e.message);}finally{b.disabled=false;}});
$('helpButton').onclick=()=>$('helpDialog').showModal();
$('importButton').onclick=()=>run(async()=>{await flushDraft();$('importDialog').showModal();});
$('doImport').onclick=()=>run(async()=>{const r=await api('import',{path:$('importPath').value});$('importDialog').close();await refreshList();if(state.active)await openSample(state.active.key);toast(`已导入 ${r.count.toLocaleString()} 条记录`);if(r.issues)notice(`${r.issues} 条记录存在历史编号问题，已标记待检查。导入内容未自动改写。`);});
$('exportButton').onclick=()=>run(async()=>{await flushDraft();const r=await api('export',{format:state.config.export_format});notice(`已导出 ${r.count.toLocaleString()} 条正式标注：\n${r.path}${r.drafts?'\n另有 '+r.drafts+' 条草稿未导出。':''}${r.issues?'\n注意：'+r.issues+' 条记录仍有编号问题，请修复后用于训练。':''}`);});
$('repairIds').onclick=async()=>{if(!confirm('将备份当前 JSON，只为重复出现的句子分配新编号，并同步 sentids。原始导入文件不变，映射记录另存。是否继续？'))return;try{const r=await api('repair-ids',{confirmed:true});toast(`修复完成：${r.changes} 项变更`);await refreshList();if(state.active)await openSample(state.active.key);}catch(e){$('settingsError').textContent=e.message;}};
$('rescan').onclick=()=>run(async()=>{await flushDraft();await api('rescan',{});await refreshList();});
$('historyButton').onclick=()=>run(async()=>{if(!state.active)return;const data=await api('history?key='+encodeURIComponent(state.active.key));$('historyList').replaceChildren();for(const item of data.items){const div=document.createElement('div');div.className='history-entry';const date=document.createElement('small');date.textContent=new Date(item.created*1000).toLocaleString();const p=document.createElement('p');p.textContent=item.record.sentences.map((s,i)=>`${i+1}. ${s.raw}`).join('\n');const b=document.createElement('button');b.textContent='恢复为草稿';b.onclick=()=>{fillForm({descriptions:item.record.sentences.map(s=>s.raw),changeflag:item.record.changeflag});edited();$('historyDialog').close();};div.append(date,p,b);$('historyList').append(div);}if(!data.items.length)$('historyList').textContent='尚无历史版本。修改已保存的记录后会自动保留旧版本。';$('historyDialog').showModal();});
$('uploadButton').onclick=()=>run(async()=>{await flushDraft();$('uploadDialog').showModal();});
$('uploadForm').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await fetch('/api/upload-pair',{method:'POST',headers:{'X-Studio-Token':token},body:new FormData($('uploadForm'))});const b=await r.json();if(!r.ok)throw Error(b.error);$('uploadDialog').close();await refreshList();toast('影像已添加，重新扫描完成后可选择标注');});};
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();run(save);}else if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run(async()=>{if(await save())await move(1);});}else if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();run(()=>move(e.key==='ArrowLeft'?-1:1));}else if(!typing&&e.key.toLowerCase()==='f'){e.preventDefault();fit();}});
window.addEventListener('beforeunload',e=>{if(state.dirty||state.draftPromise){e.preventDefault();e.returnValue='';}});
async function init(){icons();const config=await api('config');state.config=config.settings;applyConfig();if(config.error)notice(config.error);if(!state.config.dataset){settingsDialog();return;}const data=await refreshList();if(!data.scanning&&state.config.last_key){try{await openSample(state.config.last_key);}catch{}}else if(data.scanning){const wait=setInterval(async()=>{try{const d=await refreshList();if(!d.scanning){clearInterval(wait);if(state.config.last_key)await run(()=>openSample(state.config.last_key));}}catch(e){clearInterval(wait);notice(e.message);}},600);}}
init().catch(e=>notice(e.message));
