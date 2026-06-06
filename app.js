const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const INT = new Intl.NumberFormat('pt-BR');
const $ = id => document.getElementById(id);
let DATA, page=1, perPage=16, currentPriority='todos';

const DEFAULT_CONFIG={
 metas:{faturamentoSemanal:2000,faturamentoMensal:20000,clientesAtivos:40,recebimentoTotal:20000,comissaoPercentual:10},
 tema:{corPrimaria:'#C89080',corSecundaria:'#999999',corSucesso:'#10B981',corAviso:'#F59E0B',corErro:'#EF4444',corInfo:'#2563EB'},
 sincronizacao:{intervaloMinutos:5,autoSincronizar:true}
};
let CONFIG=loadConfig();
function loadConfig(){
 try{return deepMerge(DEFAULT_CONFIG,JSON.parse(localStorage.getItem('collinConfig41')||'{}'))}catch(e){return DEFAULT_CONFIG}
}
function deepMerge(base, extra){
 const out={...base};
 for(const k in extra||{}){out[k]=typeof extra[k]==='object'&&!Array.isArray(extra[k])?deepMerge(base[k]||{},extra[k]):extra[k]}
 return out;
}
function applyConfig(){
 document.documentElement.style.setProperty('--collin',CONFIG.tema.corPrimaria);
 document.documentElement.style.setProperty('--secondary',CONFIG.tema.corSecundaria);
 document.documentElement.style.setProperty('--green',CONFIG.tema.corSucesso);
 document.documentElement.style.setProperty('--yellow',CONFIG.tema.corAviso);
 document.documentElement.style.setProperty('--red',CONFIG.tema.corErro);
 document.documentElement.style.setProperty('--blue',CONFIG.tema.corInfo);
 if(DATA){
  DATA.goals.clientesMeta=Number(CONFIG.metas.clientesAtivos||40);
  DATA.goals.faturamentoMetaMensal=Number(CONFIG.metas.faturamentoMensal||20000);
  DATA.goals.faturamentoMetaSemanal=Number(CONFIG.metas.faturamentoSemanal||2000);
  DATA.goals.clientesProgresso=Number(((DATA.goals.clientesAbertos/DATA.goals.clientesMeta)*100).toFixed(1));
  DATA.goals.recebimentoProgresso=Number(((DATA.kpis.recebido/Number(CONFIG.metas.recebimentoTotal||20000))*100).toFixed(1));
  DATA.kpis.comissaoEstimada=Number((DATA.kpis.recebido*(Number(CONFIG.metas.comissaoPercentual||10)/100)).toFixed(2));
 }
}
function fillConfigInputs(){
 if(!document.getElementById('cfgWeeklyRevenue'))return;
 $('cfgWeeklyRevenue').value=CONFIG.metas.faturamentoSemanal;
 $('cfgMonthlyRevenue').value=CONFIG.metas.faturamentoMensal;
 $('cfgClientGoal').value=CONFIG.metas.clientesAtivos;
 $('cfgReceiveGoal').value=CONFIG.metas.recebimentoTotal;
 $('cfgCommission').value=CONFIG.metas.comissaoPercentual;
 $('cfgSync').value=CONFIG.sincronizacao.intervaloMinutos;
 $('cfgPrimary').value=CONFIG.tema.corPrimaria;
 $('cfgSuccess').value=CONFIG.tema.corSucesso;
 $('cfgWarning').value=CONFIG.tema.corAviso;
 $('cfgError').value=CONFIG.tema.corErro;
 $('cfgInfo').value=CONFIG.tema.corInfo;
 $('cfgSecondary').value=CONFIG.tema.corSecundaria;
}
function saveConfig(){
 CONFIG={
  metas:{
   faturamentoSemanal:Number($('cfgWeeklyRevenue').value||2000),
   faturamentoMensal:Number($('cfgMonthlyRevenue').value||20000),
   clientesAtivos:Number($('cfgClientGoal').value||40),
   recebimentoTotal:Number($('cfgReceiveGoal').value||20000),
   comissaoPercentual:Number($('cfgCommission').value||10)
  },
  tema:{
   corPrimaria:$('cfgPrimary').value,
   corSecundaria:$('cfgSecondary').value,
   corSucesso:$('cfgSuccess').value,
   corAviso:$('cfgWarning').value,
   corErro:$('cfgError').value,
   corInfo:$('cfgInfo').value
  },
  sincronizacao:{intervaloMinutos:Number($('cfgSync').value||5),autoSincronizar:true}
 };
 localStorage.setItem('collinConfig41',JSON.stringify(CONFIG));
 applyConfig();
 renderKPIs();renderGoals();renderCommission();buildReports();drawAll();
 showToast('Configurações salvas');
}
function resetConfig(){
 localStorage.removeItem('collinConfig41');
 CONFIG=deepMerge(DEFAULT_CONFIG,{});
 fillConfigInputs();applyConfig();renderKPIs();renderGoals();renderCommission();buildReports();drawAll();
 showToast('Padrões restaurados');
}
function setupAutoSync(){
 const min=Number(CONFIG.sincronizacao.intervaloMinutos||5);
 setInterval(()=>{ if(navigator.onLine) location.reload(); }, min*60*1000);
}


function money(v){return BRL.format(Number(v||0))}
function statusClass(s){s=(s||'').toLowerCase(); if(s.includes('quit'))return'quitado'; if(s.includes('não')||s.includes('nao'))return'nao'; if(s.includes('cobrar'))return'cobrar'; if(s.includes('pago'))return'pago'; return'acomp'}
function showToast(t='Copiado'){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function copyText(txt){navigator.clipboard?.writeText(txt).then(()=>showToast()).catch(()=>alert(txt))}
function getClient(id){return DATA.clientes.find(c=>c.id===id)}
function whats(c,t='cobranca'){const msg=message(c,t); const phone=(c.telefone||'').replace(/\D/g,''); return phone.length>8?`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`}
function maps(c){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.bairro+' Santa Catarina')}`}
function message(c,t='cobranca'){
 if(t==='visita') return `Olá, ${c.nome}! Tudo bem? Estou organizando minha rota da Collin Professional pela região de ${c.bairro}. Posso passar aí para uma visita rápida?`;
 if(t==='reativacao') return `Olá, ${c.nome}! Tudo bem? Vi que sua conta Collin Professional está quase finalizando. Já consigo te passar novas opções para reposição e manter seus produtos sempre girando. Quer que eu te envie algumas sugestões?`;
 return `Olá, ${c.nome}! Tudo bem? Passando para lembrar sobre o saldo em aberto da Collin Professional.\n\nCliente: ${c.nome}\nSaldo: ${money(c.saldoDevedor)}\nStatus: ${c.status}\n\nConsegue me dar um retorno hoje?`;
}
async function loadData(){const cache=localStorage.getItem('collinDash4'); try{const r=await fetch('data/clientes.json?ts='+Date.now()); const j=await r.json(); localStorage.setItem('collinDash4',JSON.stringify(j)); return j}catch(e){if(cache)return JSON.parse(cache); throw e}}
function updateNet(){const online=navigator.onLine; $('netDot').className=online?'online':'offline'; $('netText').textContent=online?'Online':'Offline'; $('syncText').textContent=online?'Dados sincronizados/cache local':'Usando dados salvos no aparelho'}
function setTab(tab){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));$(tab).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('pageTitle').textContent={alertas:'Alertas Executivos',bairros:'Análise por Bairros',clientes:'CRM de Clientes',visitas:'Visitas e Revisitas',cobranca:'Cobrança Inteligente',metas:'Metas Comerciais',relatorio:'Relatório Semanal',comissao:'Comissão',configuracoes:'Configurações'}[tab]||'Dashboard'; setTimeout(drawAll,50)}
function renderKPIs(){
 const k=DATA.kpis,g=DATA.goals; const arr=[
 ['Clientes',k.clientes,'Base atual'],['Ativos',k.ativos,'Carteira ativa'],['Vendas',money(k.vendas),'Volume vendido'],['Devedor',money(k.devedor),'Saldo em aberto'],
 ['Recebido',money(k.recebido),'Pago/quitado'],['Ticket médio',money(k.ticketMedio),'Média compra'],['Atrasados',k.atrasados,'Não pagos'],['Cobrar',k.cobrar,'Próxima semana']
 ];
 $('alertKpis').innerHTML=arr.map(x=>`<article class="kpi"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></article>`).join('');
 $('heroGoal').textContent=`${g.clientesAbertos}/${g.clientesMeta}`;$('heroProgress').style.width=g.clientesProgresso+'%';
}
function renderSmart(){
 const k=DATA.kpis; const cards=[
 ['Maior carteira',`${k.maiorCarteira?.nome||'-'} — ${money(k.maiorCarteira?.saldoCarteira)}`],
 ['Maior parcela',`${k.maiorParcela?.nome||'-'} — ${money(k.maiorParcela?.valorParcela)}`],
 ['Maior devedor',`${k.maiorDevedor?.nome||'-'} — ${money(k.maiorDevedor?.saldoDevedor)}`],
 ['Média de compras',money(k.ticketMedio)]
 ];
 $('smartCards').innerHTML=cards.map(c=>`<div class="smart-card"><small>${c[0]}</small><b>${c[1]}</b></div>`).join('');
}
function actionBtns(c){return `<div class="actions"><a class="btn whatsapp" target="_blank" href="${whats(c)}">Whats</a><button class="btn dark" onclick="copyText(message(getClient(${c.id})))">Copiar</button><button class="btn blue" onclick="openClient(${c.id})">Ver</button></div>`}
function renderLate(){const list=DATA.topAtrasados.length?DATA.topAtrasados:DATA.topClientes.slice(0,8);$('lateRows').innerHTML=list.map(c=>`<tr><td><b>${c.nome}</b></td><td>${c.bairro}</td><td><b>${money(c.saldoDevedor)}</b></td><td><span class="status ${statusClass(c.status)}">${c.status}</span></td><td>${actionBtns(c)}</td></tr>`).join('')}
function renderBairros(){
 $('bairroCards').innerHTML=DATA.bairros.slice(0,15).map(b=>`<article class="card"><h4>${b.bairro}</h4><p>${b.clientes} clientes</p><div class="amount">${money(b.vendas)}</div><p>Devedor: <b>${money(b.devedor)}</b> • Ticket: <b>${money(b.ticketMedio)}</b></p></article>`).join('');
}
function filteredClients(){const q=($('clientSearch')?.value||'').toLowerCase(); const st=$('statusFilter')?.value||'todos'; return DATA.clientes.filter(c=>`${c.cliente} ${c.bairro} ${c.status}`.toLowerCase().includes(q)&&(st==='todos'||c.status===st))}
function renderClients(){const list=filteredClients(); const pages=Math.max(Math.ceil(list.length/perPage),1); page=Math.min(page,pages); const items=list.slice((page-1)*perPage,page*perPage); $('clientRows').innerHTML=items.map(c=>`<tr><td onclick="openClient(${c.id})"><b>${c.nome}</b><br><small>${c.cliente}</small></td><td>${c.bairro}</td><td>${money(c.saldoCarteira)}</td><td><b>${money(c.saldoDevedor)}</b></td><td><span class="status ${statusClass(c.status)}">${c.status}</span></td><td>${actionBtns(c)}</td></tr>`).join(''); $('pageInfo').textContent=`Página ${page} de ${pages} • ${list.length} clientes`}
function renderVisits(){
 $('visitCards').innerHTML=DATA.visitas.map(c=>`<article class="card"><h4>${c.nome}</h4><p>${c.bairro} • Saldo ${money(c.saldoDevedor)}</p><div class="amount">Revisita</div><p>Conta próxima de finalizar ou cliente com potencial para nova compra.</p><div class="actions"><a class="btn whatsapp" target="_blank" href="${whats(c,'reativacao')}">Whats</a><button class="btn dark" onclick="copyText(message(getClient(${c.id}),'reativacao'))">Copiar</button><a class="btn blue" target="_blank" href="${maps(c)}">Mapa</a></div></article>`).join('');
}
function renderCharge(){let list=DATA.clientes.filter(c=>c.saldoDevedor>0).sort((a,b)=>b.saldoDevedor-a.saldoDevedor); if(currentPriority!=='todos')list=list.filter(c=>c.prioridade===currentPriority); $('chargeCards').innerHTML=list.slice(0,24).map(c=>`<article class="card"><h4>${c.nome}</h4><p>${c.bairro} • ${c.status}</p><div class="amount">${money(c.saldoDevedor)}</div><span class="status ${c.prioridade==='Alta'?'nao':c.prioridade==='Média'?'cobrar':'pago'}">${c.prioridade} prioridade</span><div class="actions" style="margin-top:12px"><a class="btn whatsapp" target="_blank" href="${whats(c)}">Whats</a><button class="btn dark" onclick="copyText(message(getClient(${c.id})))">Copiar</button><button class="btn blue" onclick="openClient(${c.id})">Histórico</button></div></article>`).join('')}
function renderGoals(){
 const g=DATA.goals; $('clientGoalBadge').textContent=g.clientesProgresso+'%'; $('clientGoalText').textContent=`${g.clientesAbertos}/${g.clientesMeta}`; const circ=2*Math.PI*68; $('clientRing').style.strokeDasharray=circ; $('clientRing').style.strokeDashoffset=circ-(circ*g.clientesProgresso/100);
 $('goalInsights').innerHTML=`<div class="goal-list"><div class="goal-item"><div class="goal-row"><span>Esta semana</span><b>+${g.clientesSemana} clientes</b></div></div><div class="goal-item"><div class="goal-row"><span>Faltam</span><b>${g.clientesMeta-g.clientesAbertos} clientes</b></div></div></div>`;
 const mensal=g.recebimentoProgresso; const semanal=Math.min((DATA.weekly[DATA.weekly.length-1].recebido/g.faturamentoMetaSemanal)*100,100).toFixed(1);
 $('revenueGoals').innerHTML=[
  ['Meta mensal', money(g.faturamentoMetaMensal), money(g.recebimentoAtual), mensal],
  ['Meta semanal', money(g.faturamentoMetaSemanal), money(DATA.weekly[DATA.weekly.length-1].recebido), semanal]
 ].map(x=>`<div class="goal-item"><div class="goal-row"><span>${x[0]}</span><b>${x[3]}%</b></div><small>${x[2]} de ${x[1]}</small><div class="progress"><span style="width:${Math.min(x[3],100)}%;background:${x[3]>=70?'var(--green)':x[3]>=30?'var(--yellow)':'var(--red)'}"></span></div></div>`).join('');
}
function buildReports(){
 const k=DATA.kpis,g=DATA.goals; const short=`Relatório semanal Collin Professional\n\nClientes abertos na semana: +${g.clientesSemana}\nClientes abertos no período: ${g.clientesAbertos}/${g.clientesMeta}\nProgresso da meta: ${g.clientesProgresso}%\nCarteira total: ${money(k.vendas)}\nRecebido: ${money(k.recebido)}\nSaldo em aberto: ${money(k.devedor)}\nClientes pendentes: ${k.atrasados+k.cobrar}`;
 const full=`RELATÓRIO EXECUTIVO — COLLIN PROFESSIONAL\n\n1. Resumo comercial\n• Clientes ativos: ${k.clientes}\n• Novos clientes na semana: +${g.clientesSemana}\n• Meta de clientes: ${g.clientesAbertos}/${g.clientesMeta} (${g.clientesProgresso}%)\n\n2. Financeiro\n• Carteira total: ${money(k.vendas)}\n• Recebido/Pago: ${money(k.recebido)}\n• Saldo devedor: ${money(k.devedor)}\n• Ticket médio: ${money(k.ticketMedio)}\n\n3. Cobrança\n• Não pagos: ${k.atrasados}\n• Cobrar próxima semana: ${k.cobrar}\n• Quitados: ${k.quitados}\n\n4. Próximas ações\n• Priorizar cobrança dos maiores saldos.\n• Revisitar clientes com saldo menor ou igual a R$150.\n• Acompanhar bairros com maior concentração de carteira.`;
 $('shortReport').textContent=short; $('fullReport').textContent=full; $('reportWhatsapp').href='https://wa.me/?text='+encodeURIComponent(short);
}
function copyReport(type){copyText(type==='short' ? $('shortReport').textContent : $('fullReport').textContent)}
function renderCommission(){
 const total=DATA.weekly.reduce((a,b)=>a+b.comissao,0); const arr=[['Comissão estimada',money(DATA.kpis.comissaoEstimada),'Padrão 10%'],['4 semanas',money(total),'Acumulado semanal'],['Maior semana',money(Math.max(...DATA.weekly.map(w=>w.comissao))),'Melhor resultado'],['Recebido mês',money(DATA.kpis.recebido),'Base comissão']];
 $('commissionKpis').innerHTML=arr.map(x=>`<article class="kpi"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></article>`).join('');
}
function openClient(id){const c=getClient(id);$('modalContent').innerHTML=`<span class="eyebrow">Ficha do cliente</span><h2>${c.nome}</h2><p>${c.cliente}</p><div class="modal-grid"><div class="info"><small>Bairro</small><b>${c.bairro}</b></div><div class="info"><small>Status</small><b>${c.status}</b></div><div class="info"><small>Carteira</small><b>${money(c.saldoCarteira)}</b></div><div class="info"><small>Devedor</small><b>${money(c.saldoDevedor)}</b></div><div class="info"><small>Parcela</small><b>${money(c.valorParcela)}</b></div><div class="info"><small>Vencimento</small><b>${formatDate(c.vencimento)}</b></div></div><pre>${c.observacoes||'Sem observações cadastradas.'}</pre><div class="actions"><a class="btn whatsapp" target="_blank" href="${whats(c)}">Abrir WhatsApp</a><button class="btn dark" onclick="copyText(message(getClient(${c.id})))">Copiar cobrança</button><button class="btn" onclick="copyText(message(getClient(${c.id}),'reativacao'))">Copiar revisita</button><a class="btn blue" target="_blank" href="${maps(c)}">Google Maps</a></div>`;$('modalBackdrop').classList.add('show')}
function closeModal(){$('modalBackdrop').classList.remove('show')}
function formatDate(s){if(!s)return'-';const d=new Date(s);return isNaN(d)?'-':d.toLocaleDateString('pt-BR')}
function drawAll(){if(!DATA)return; drawDoughnut('statusChart',DATA.statusCounts); drawBar('bairroBarChart',DATA.bairros.slice(0,15).map(b=>b.bairro),DATA.bairros.slice(0,15).map(b=>b.vendas),true,true); drawDoughnut('bairroPieChart',Object.fromEntries(DATA.bairros.slice(0,8).map(b=>[b.bairro,b.clientes]))); drawBar('weeklyChart',DATA.weekly.map(w=>w.semana),DATA.weekly.map(w=>w.clientes)); drawBar('commissionChart',DATA.weekly.map(w=>w.semana),DATA.weekly.map(w=>w.comissao),false,true); drawBar('receivedChart',DATA.weekly.map(w=>w.semana),DATA.weekly.map(w=>w.recebido),false,true)}
function drawDoughnut(id,obj){const canvas=$(id); if(!canvas)return; const ctx=canvas.getContext('2d'),dpr=devicePixelRatio||1,rect=canvas.getBoundingClientRect(); canvas.width=rect.width*dpr; canvas.height=canvas.height*dpr; ctx.scale(dpr,dpr); const w=rect.width,h=canvas.height/dpr,cx=w/2,cy=h/2,r=Math.min(w,h)*.34,total=Object.values(obj).reduce((a,b)=>a+b,0)||1,colors=['#C89080','#10B981','#F59E0B','#EF4444','#2563EB','#999999']; let start=-Math.PI/2; ctx.clearRect(0,0,w,h); Object.values(obj).forEach((v,i)=>{const a=v/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+a);ctx.arc(cx,cy,r*.58,start+a,start,true);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start+=a}); ctx.fillStyle='#111827';ctx.font='900 28px Arial';ctx.textAlign='center';ctx.fillText(total,cx,cy+4);ctx.fillStyle='#777';ctx.font='12px Arial';ctx.fillText('clientes',cx,cy+26)}
function drawBar(id,labels,values,horizontal=false,moneyFormat=false){const canvas=$(id); if(!canvas)return; const ctx=canvas.getContext('2d'),dpr=devicePixelRatio||1,rect=canvas.getBoundingClientRect(); canvas.width=rect.width*dpr; canvas.height=canvas.height*dpr; ctx.scale(dpr,dpr); const w=rect.width,h=canvas.height/dpr,max=Math.max(...values,1); ctx.clearRect(0,0,w,h); if(horizontal){const row=h/labels.length; labels.forEach((lab,i)=>{const y=i*row+10,x=145,bw=(w-x-80)*(values[i]/max);ctx.fillStyle='#111827';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText(String(lab).slice(0,18),10,y+13);ctx.fillStyle='#eadfdb';round(ctx,x,y,w-x-90,14,8);ctx.fill();ctx.fillStyle='#C89080';round(ctx,x,y,bw,14,8);ctx.fill();ctx.fillStyle='#777';ctx.fillText(moneyFormat?compact(values[i]):values[i],w-75,y+13)})}else{const pad=38,step=(w-pad*2)/values.length,barW=step*.55; values.forEach((v,i)=>{const bh=(h-pad*2)*(v/max),x=pad+i*step+(step-barW)/2,y=h-pad-bh;ctx.fillStyle='#C89080';round(ctx,x,y,barW,bh,8);ctx.fill();ctx.fillStyle='#111827';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(moneyFormat?compact(v):v,x+barW/2,y-7);ctx.fillStyle='#777';ctx.font='11px Arial';ctx.fillText(labels[i],x+barW/2,h-12)})}}
function compact(v){return v>=1000?'R$ '+(v/1000).toFixed(1)+'k':money(v)}
function round(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function setup(){
 document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab)); $('syncBtn').onclick=()=>location.reload(); $('clientSearch').oninput=()=>{page=1;renderClients()}; $('statusFilter').onchange=()=>{page=1;renderClients()}; $('prevPage').onclick=()=>{page=Math.max(1,page-1);renderClients()}; $('nextPage').onclick=()=>{page++;renderClients()}; document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');currentPriority=c.dataset.priority;renderCharge()}); $('modalBackdrop').onclick=e=>{if(e.target.id==='modalBackdrop')closeModal()}
}
async function init(){DATA=await loadData(); applyConfig(); updateNet(); renderKPIs(); renderSmart(); renderLate(); renderBairros(); DATA.statusCounts&&Object.keys(DATA.statusCounts).forEach(s=>$('statusFilter').insertAdjacentHTML('beforeend',`<option value="${s}">${s}</option>`)); renderClients(); renderVisits(); renderCharge(); renderGoals(); buildReports(); renderCommission(); setup(); fillConfigInputs(); setupAutoSync(); drawAll(); $('footerUpdate').textContent='Atualizado em '+new Date(DATA.updatedAt).toLocaleString('pt-BR')}
window.addEventListener('online',updateNet);window.addEventListener('offline',updateNet);window.addEventListener('resize',()=>setTimeout(drawAll,100)); if('serviceWorker'in navigator) navigator.serviceWorker.register('service-worker.js'); init();
