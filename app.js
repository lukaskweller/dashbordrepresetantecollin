const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let DATA=null;let charts={};const $=id=>document.getElementById(id);const money=v=>BRL.format(Number(v||0));
const colors={collin:'#C89080',green:'#10B981',yellow:'#F59E0B',red:'#EF4444',blue:'#2563EB',dark:'#111827',muted:'#999999'};
function chart(id,type,data,options={}){const el=$(id);if(!el||typeof Chart==='undefined')return;if(charts[id])charts[id].destroy();charts[id]=new Chart(el,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8}},tooltip:{backgroundColor:'#111827',padding:12,titleFont:{weight:'bold'},callbacks:{label:(ctx)=>{let v=ctx.parsed.y??ctx.parsed.x??ctx.parsed??0;return `${ctx.dataset.label||ctx.label}: ${typeof v==='number'&&v>100?money(v):v}`}}}},scales: options.scales||{},...options}})}

const SHEET_URLS=[
  'https://docs.google.com/spreadsheets/d/1LfKj1DkDk2PDItrpmfImqdo9oGsvya1VdhV3ICzdpUU/gviz/tq?tqx=out:csv&gid=0',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDBHyfM0CoQuXfeiktYsO6omSL0055fqNxto_207DQb285VgL6eS90hpem9ftmMdt7BYFt7iqGrORL/pub?output=csv'
];
const CACHE_KEY='collinDashAutoSync53Valid';
const MIN_VALID_CLIENTS=80;

function safe(v){return String(v==null?'':v)}
function normalizeHeader(v){return safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function toNumber(v){
  if(typeof v==='number')return v;
  let s=safe(v).replace(/R\$/gi,'').replace(/\s/g,'').trim();
  if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(','))s=s.replace(',','.');
  const n=parseFloat(s.replace(/[^\d.-]/g,''));
  return Number.isFinite(n)?n:0;
}
function cleanStatus(v){
  const l=safe(v).toLowerCase();
  if(l.includes('quit'))return'Quitado';
  if(l.includes('prox')||l.includes('próx')||l.includes('cobrar'))return'Cobrar próxima semana';
  if(l.includes('nao')||l.includes('não')||l.includes('atras'))return'Não pago';
  if(l.includes('pago'))return'Pago';
  return v?safe(v):'Em acompanhamento';
}
function bairroFromCliente(nome){
  const raw=safe(nome).trim();
  let b='Não informado';
  if(raw.includes(' - '))b=raw.split(' - ').pop();
  else if(raw.includes('-'))b=raw.split('-').pop();
  b=safe(b).trim().replace(/\s+/g,' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  const map={
    'Forquilhinha':'Forquilinhas','Forquilhinhas':'Forquilinhas','Forquilinhas':'Forquilinhas',
    'Barra':'Barra Aririú','Barra Aririu':'Barra Aririú','Barra Aririú':'Barra Aririú',
    'Ponte Do Imaruim':'Ponte Imaruim','Ponte Imaruim':'Ponte Imaruim',
    'Bela Vista':'Bela Vista','Rio Grande':'Rio Grande'
  };
  return map[b]||b||'Não informado';
}
function baseName(nome){
  const raw=safe(nome).trim();
  return raw.includes(' - ')?raw.split(' - ')[0].trim():raw;
}
function parseCSV(csv){
  const rows=[];let row=[],cell='',quote=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i],nx=csv[i+1];
    if(ch==='"'&&quote&&nx==='"'){cell+='"';i++;continue}
    if(ch==='"'){quote=!quote;continue}
    if(ch===','&&!quote){row.push(cell);cell='';continue}
    if((ch==='\n'||ch==='\r')&&!quote){
      if(cell||row.length){row.push(cell);rows.push(row);row=[];cell=''}
      if(ch==='\r'&&nx==='\n')i++;
      continue
    }
    cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}
function pick(obj,names){
  for(const name of names){
    const key=normalizeHeader(name);
    if(obj[key]!==undefined)return obj[key];
  }
  return '';
}
function rowsToClients(rows){
  let headerIndex=0;
  for(let i=0;i<Math.min(rows.length,25);i++){
    const h=rows[i].map(normalizeHeader);
    const hasCliente=h.some(x=>x.includes('cliente'));
    const hasSaldoOrStatus=h.some(x=>x.includes('saldo')||x.includes('status')||x.includes('parcela'));
    if(hasCliente&&hasSaldoOrStatus){headerIndex=i;break}
  }
  const headers=rows[headerIndex].map(normalizeHeader);
  const clients=[];
  for(let r=headerIndex+1;r<rows.length;r++){
    const vals=rows[r];
    if(!vals||!vals.length)continue;
    const obj={};
    headers.forEach((h,i)=>obj[h]=vals[i]??'');
    const raw=(pick(obj,['Cliente','Clientes','Nome','Cliente:'])||vals[1]||vals[0]||'').trim();
    if(!raw||raw.toLowerCase()==='clientes:'||raw.toLowerCase()==='cliente')continue;
    const status=cleanStatus(pick(obj,['Status','Situação','Situacao']));
    const saldoCarteira=toNumber(pick(obj,['Saldo Carteira','Carteira','Total Vendas','Vendas','Saldo']));
    const saldoDevedor=toNumber(pick(obj,['Saldo Devedor','Devedor','Valor Devedor','Em Aberto']));
    const valorParcela=toNumber(pick(obj,['Valor Parcela','Parcela','Valor da Parcela']));
    const prioridade=status==='Não pago'||saldoDevedor>=500?'Alta':(status==='Cobrar próxima semana'||saldoDevedor>=150?'Média':'Baixa');
    clients.push({
      id:clients.length+1,cliente:raw,nome:baseName(raw),bairro:bairroFromCliente(raw),
      vendedor:safe(pick(obj,['Vendedor','Representante'])),
      saldoCarteira:Number(saldoCarteira.toFixed(2)),saldoDevedor:Number(saldoDevedor.toFixed(2)),
      dataInicio:safe(pick(obj,['Data Início','Data Inicio','Inicio'])),
      vencimento:safe(pick(obj,['Vencimento','Data Vencimento'])),
      parcelas:safe(pick(obj,['Parcelas','Qtd Parcelas'])),
      valorParcela:Number(valorParcela.toFixed(2)),
      parcelasPagas:toNumber(pick(obj,['Parcelas Pagas','Pagas'])),
      status,observacoes:safe(pick(obj,['Observações','Observacoes','Obs'])),
      telefone:safe(pick(obj,['Telefone','WhatsApp','Whatsapp','Celular'])),
      prioridade
    });
  }
  return clients;
}
function buildDataFromClients(clientes,source='Google Sheets AutoSync'){
  const statusCounts={};const bairroMap={};
  clientes.forEach(c=>{
    statusCounts[c.status]=(statusCounts[c.status]||0)+1;
    const b=c.bairro||'Não informado';
    if(!bairroMap[b])bairroMap[b]={bairro:b,clientes:0,vendas:0,devedor:0,ativos:0,visitas:0};
    bairroMap[b].clientes++;
    bairroMap[b].vendas+=Number(c.saldoCarteira||0);
    bairroMap[b].devedor+=Number(c.saldoDevedor||0);
    if(['Pago','Não pago','Cobrar próxima semana'].includes(c.status))bairroMap[b].ativos++;
    if(c.saldoCarteira>0&&c.saldoCarteira<150)bairroMap[b].visitas++;
  });
  const total=clientes.length;
  const ativos=clientes.filter(c=>['Pago','Não pago','Cobrar próxima semana'].includes(c.status)).length;
  const inativos=statusCounts['Quitado']||0;
  const carteira=Number(clientes.reduce((a,c)=>a+Number(c.saldoCarteira||0),0).toFixed(2));
  const devedor=Number(clientes.reduce((a,c)=>a+Number(c.saldoDevedor||0),0).toFixed(2));
  const recebidoSemana=Number(clientes.filter(c=>c.status==='Pago').reduce((a,c)=>a+Number(c.valorParcela||0),0).toFixed(2));
  const ticketMedio=total?Number((carteira/total).toFixed(2)):0;
  const ajudaCusto=375;
  const comissaoSemana=Number((recebidoSemana*0.15+ajudaCusto).toFixed(2));
  const salaryWeeks=[
    {semana:'Semana 1',comissao:991},
    {semana:'Semana 2',comissao:1073},
    {semana:'Semana 3',comissao:1105},
    {semana:'Semana 4',comissao:1215},
    {semana:'Semana 5',comissao:comissaoSemana}
  ];
  const last4SalaryWeeks=salaryWeeks.slice(-4);
  const comissaoUltimas4=Number(last4SalaryWeeks.reduce((a,w)=>a+w.comissao,0).toFixed(2));
  const mediaComissaoUltimas4=Number((comissaoUltimas4/4).toFixed(2));
  const projecaoSalarioMes=Number((mediaComissaoUltimas4*4).toFixed(2));
  const bairros=Object.values(bairroMap).map(b=>({
    ...b,
    vendas:Number(b.vendas.toFixed(2)),
    devedor:Number(b.devedor.toFixed(2)),
    ticketMedio:b.clientes?Number((b.vendas/b.clientes).toFixed(2)):0
  }));
  const rankVendasBairro=[...bairros].sort((a,b)=>b.vendas-a.vendas);
  const rankClientesBairro=[...bairros].sort((a,b)=>b.clientes-a.clientes);
  const topClientes=[...clientes].sort((a,b)=>b.saldoDevedor-a.saldoDevedor);
  const cobrancaPrioridade=clientes
    .filter(c=>['Não pago','Cobrar próxima semana'].includes(c.status))
    .sort((a,b)=>{
      const pa=a.status==='Não pago'?0:1;
      const pb=b.status==='Não pago'?0:1;
      if(pa!==pb)return pa-pb;
      return b.saldoDevedor-a.saldoDevedor;
    });
  const visitas=clientes
    .filter(c=>c.saldoCarteira>0&&c.saldoCarteira<150)
    .sort((a,b)=>a.saldoCarteira-b.saldoCarteira);
  return{
    version:'5.3 AutoSync',
    updatedAt:new Date().toISOString(),
    source,
    goals:{
      clientesMeta:40,clientesAbertos:16,clientesSemana:6,clientesProgresso:40,
      recebimentoMetaSemanal:6000,recebimentoMetaMensal:20000,
      salarioMetaMensal:4500,ajudaCusto,comissaoPercentual:15
    },
    kpis:{
      clientes:total,ativos,inativos,carteira,devedor,recebidoSemana,ticketMedio,
      maiorDevedor:topClientes[0]||null,
      maiorParcela:[...clientes].sort((a,b)=>b.valorParcela-a.valorParcela)[0]||null,
      atrasados:statusCounts['Não pago']||0,
      cobrar:statusCounts['Cobrar próxima semana']||0,
      pagos:statusCounts['Pago']||0,
      quitados:statusCounts['Quitado']||0,
      comissaoSemana,ajudaCusto,comissaoUltimas4,mediaComissaoUltimas4,
      projecaoSalarioMes,visitasCarteiraBaixa:visitas.length
    },
    statusCounts,bairros:rankVendasBairro,rankClientesBairro,rankVendasBairro,
    topClientes:topClientes.slice(0,30),
    cobrancaPrioridade:cobrancaPrioridade.slice(0,60),
    visitas:visitas.slice(0,60),
    salaryWeeks,last4SalaryWeeks,
    weekly:[
      {semana:'Semana 1',clientes:4,recebido:Number(((991-ajudaCusto)/0.15).toFixed(2)),comissao:991},
      {semana:'Semana 2',clientes:6,recebido:Number(((1073-ajudaCusto)/0.15).toFixed(2)),comissao:1073},
      {semana:'Semana 3',clientes:0,recebido:Number(((1105-ajudaCusto)/0.15).toFixed(2)),comissao:1105},
      {semana:'Semana 4',clientes:6,recebido:Number(((1215-ajudaCusto)/0.15).toFixed(2)),comissao:1215},
      {semana:'Semana 5',clientes:6,recebido:recebidoSemana,comissao:comissaoSemana}
    ],
    clientes
  };
}
async function fetchSheetData(){
  for(const url of SHEET_URLS){
    try{
      const res=await fetch(url+'&cacheBust='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('CSV indisponível');
      const csv=await res.text();
      const clients=rowsToClients(parseCSV(csv));
      if(clients.length<MIN_VALID_CLIENTS)throw new Error('Leitura ignorada: somente '+clients.length+' clientes');
      const data=buildDataFromClients(clients,'Google Sheets AutoSync');
      localStorage.setItem(CACHE_KEY,JSON.stringify(data));
      return data;
    }catch(err){
      console.warn('Falha ao sincronizar planilha:',url,err);
    }
  }
  return null;
}
async function loadLocalFallback(){
  const res=await fetch('data/clientes.json?v=53-fallback-'+Date.now(),{cache:'no-store'});
  if(!res.ok)throw new Error('Fallback data/clientes.json indisponível');
  return await res.json();
}
async function load(){
  try{
    const sheetData=await fetchSheetData();
    if(sheetData){
      DATA=sheetData;
      renderAll();
      return;
    }
    const cache=localStorage.getItem(CACHE_KEY);
    if(cache){
      DATA=JSON.parse(cache);
      renderAll();
      return;
    }
    DATA=await loadLocalFallback();
    renderAll();
  }catch(err){
    console.error('Erro final ao carregar dashboard:',err);
    document.body.innerHTML='<main style="padding:24px;font-family:Arial"><h1>Erro ao carregar Dashboard</h1><p>Não consegui ler o Google Sheets nem data/clientes.json.</p></main>';
  }
}

function cls(s){s=String(s||'').toLowerCase();if(s.includes('não')||s.includes('nao'))return'nao';if(s.includes('cobrar'))return'cobrar';return'pago'}
function msg(c,t='cobranca'){if(t==='visita')return`Olá, ${c.nome}! Tudo bem? Sua carteira Collin está próxima de finalizar. Posso te enviar opções para reposição e manter seus produtos girando?`;return`Olá, ${c.nome}! Tudo bem? Passando para lembrar sobre o saldo em aberto da Collin Professional.\n\nCliente: ${c.nome}\nSaldo: ${money(c.saldoDevedor)}\nStatus: ${c.status}\n\nConsegue me dar um retorno hoje?`}
function whats(c,t){return 'https://wa.me/?text='+encodeURIComponent(msg(c,t))}
function maps(c){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.bairro+' Santa Catarina')}
function actions(c,t){return`<div class="actions"><a class="btn whatsapp" target="_blank" href="${whats(c,t)}">Whats</a><button class="btn dark" onclick="copyText(msg(DATA.clientes.find(x=>x.id===${c.id}),'${t||'cobranca'}'))">Copiar</button><a class="btn blue" target="_blank" href="${maps(c)}">Mapa</a></div>`}
function copyText(t){navigator.clipboard?.writeText(t);const toast=$('toast');toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1600)}
function tab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));$('pageTitle').textContent={home:'Visão Geral',clientes:'Clientes',bairros:'Bairros',cobranca:'Cobrança',visitas:'Visitas',metas:'Metas',comissao:'Comissão',performance:'Performance',relatorio:'Relatório'}[id];setTimeout(drawCharts,120)}
function renderKpis(){const k=DATA.kpis,g=DATA.goals;const cards=[['Clientes',k.clientes,'Todos cadastrados'],['Ativos',k.ativos,'Pago + Não pago + Cobrar'],['Inativos',k.inativos,'Quitados'],['Recebido semana',money(k.recebidoSemana),'Parcelas pagas'],['Carteira',money(k.carteira),'Total carteira'],['Devedor',money(k.devedor),'Saldo aberto'],['Comissão semana',money(k.comissaoSemana),'15% + ajuda custo'],['Visitas',k.visitasCarteiraBaixa,'Carteira entre R$0 e R$150']];$('homeKpis').innerHTML=cards.map(c=>`<article class="kpi"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('');$('heroGoal').textContent=`${g.clientesAbertos}/${g.clientesMeta}`;$('heroProgress').style.width=g.clientesProgresso+'%'}
function renderSmart(){const k=DATA.kpis;const cards=[['Maior devedor',`${k.maiorDevedor?.nome||'-'} — ${money(k.maiorDevedor?.saldoDevedor)}`],['Maior parcela',`${k.maiorParcela?.nome||'-'} — ${money(k.maiorParcela?.valorParcela)}`],['Ticket médio',money(k.ticketMedio)],['Projeção salário mês',money(k.projecaoSalarioMes)]];$('smartCards').innerHTML=cards.map(c=>`<article class="card"><small>${c[0]}</small><b>${c[1]}</b></article>`).join('')}
function renderClientes(){const q=($('searchInput').value||'').toLowerCase();const list=DATA.clientes.filter(c=>(c.cliente+' '+c.bairro+' '+c.status).toLowerCase().includes(q));$('clientRows').innerHTML=list.map(c=>`<tr><td><b>${c.nome}</b><br><small>${c.cliente}</small></td><td>${c.bairro}</td><td>${money(c.saldoCarteira)}</td><td>${money(c.saldoDevedor)}</td><td>${money(c.valorParcela)}</td><td><span class="status ${cls(c.status)}">${c.status}</span></td><td>${actions(c)}</td></tr>`).join('')}
function renderBairros(){$('bairroCards').innerHTML=DATA.bairros.slice(0,18).map((b,i)=>`<div class="rank-item"><span class="rank-num">${i+1}</span><strong>${b.bairro}</strong><span>${b.clientes} clientes</span><span>${money(b.vendas)}</span><span>Dev. ${money(b.devedor)}</span></div>`).join('')}
function renderCobranca(){$('cobrancaCards').innerHTML=DATA.cobrancaPrioridade.map(c=>`<article class="client-card"><h4>${c.nome}</h4><p>${c.bairro} • ${c.status}</p><div class="amount">${money(c.saldoDevedor)}</div><span class="priority ${c.prioridade==='Alta'?'high':c.prioridade==='Média'?'medium':'low'}">${c.prioridade} prioridade</span><div style="margin-top:12px">${actions(c)}</div></article>`).join('')}
function renderVisitas(){$('visitaCards').innerHTML=DATA.visitas.map(c=>`<article class="client-card"><h4>${c.nome}</h4><p>${c.bairro} • ${c.status}</p><div class="amount">${money(c.saldoCarteira)}</div><span class="priority medium">Carteira entre R$0 e R$150</span><div style="margin-top:12px">${actions(c,'visita')}</div></article>`).join('')}
function renderMetas(){const k=DATA.kpis,g=DATA.goals;const sem=(k.recebidoSemana/g.recebimentoMetaSemanal*100).toFixed(1);const mes=(k.recebidoSemana/g.recebimentoMetaMensal*100).toFixed(1);const sal=(k.comissaoUltimas4/g.salarioMetaMensal*100).toFixed(1);const cards=[['Clientes abertos',`${g.clientesAbertos}/${g.clientesMeta}`,`${g.clientesProgresso}%`],['Meta semanal',`${money(k.recebidoSemana)} / ${money(g.recebimentoMetaSemanal)}`,`${sem}%`],['Meta mensal',`${money(k.recebidoSemana)} / ${money(g.recebimentoMetaMensal)}`,`${mes}%`],['Salário últimas 4',`${money(k.comissaoUltimas4)} / ${money(g.salarioMetaMensal)}`,`${sal}%`]];$('metaCards').innerHTML=cards.map(c=>`<article class="kpi"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('')}
function renderComissao(){const k=DATA.kpis,g=DATA.goals;const cards=[['Comissão semana',money(k.comissaoSemana),'15% das parcelas + R$375'],['Ajuda custo',money(g.ajudaCusto),'Fixo'],['Últimas 4 semanas',money(k.comissaoUltimas4),'Conta com a atual'],['Média últimas 4',money(k.mediaComissaoUltimas4),'Base projeção'],['Projeção mês',money(k.projecaoSalarioMes),'Média × 4'],['Meta salário',money(g.salarioMetaMensal),'Objetivo'],['Faltante',money(Math.max(g.salarioMetaMensal-k.comissaoUltimas4,0)),'Para meta'],['% Meta',((k.comissaoUltimas4/g.salarioMetaMensal)*100).toFixed(1)+'%','Últimas 4']];$('comissaoKpis').innerHTML=cards.map(c=>`<article class="kpi"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('')}
function renderPerformance(){const k=DATA.kpis,g=DATA.goals;const cards=[['Evolução semanal','5 semanas','Histórico'],['Projeção final',money(k.projecaoSalarioMes),'Média últimas 4'],['Salário atual',money(k.comissaoUltimas4),'Últimas 4 semanas'],['Meta salário',money(g.salarioMetaMensal),'Objetivo']];$('performanceKpis').innerHTML=cards.map(c=>`<article class="kpi"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('')}
function renderReport(){const k=DATA.kpis,g=DATA.goals;const text=`Relatório Collin Professional 5.3\n\nClientes: ${k.clientes}\nAtivos: ${k.ativos}\nInativos/quitados: ${k.inativos}\n\nCarteira: ${money(k.carteira)}\nDevedor: ${money(k.devedor)}\nRecebido semana: ${money(k.recebidoSemana)}\n\nComissão semana: ${money(k.comissaoSemana)}\nRegra: 15% das parcelas pagas + ${money(g.ajudaCusto)} ajuda custo\nÚltimas 4 semanas: ${money(k.comissaoUltimas4)}\nProjeção mês: ${money(k.projecaoSalarioMes)}\n\nCobrança: ${k.atrasados} não pagos / ${k.cobrar} cobrar próxima semana\nVisitas: ${k.visitasCarteiraBaixa} clientes com carteira entre R$0 e R$150`; $('reportText').textContent=text;$('reportWhats').href='https://wa.me/?text='+encodeURIComponent(text)}
function copyReport(){copyText($('reportText').textContent)}
function renderAll(){renderKpis();renderSmart();renderClientes();renderBairros();renderCobranca();renderVisitas();renderMetas();renderComissao();renderPerformance();renderReport();drawCharts();$('footerUpdate').textContent='Atualizado em '+new Date(DATA.updatedAt).toLocaleString('pt-BR');$('syncText').textContent=DATA.clientes.length+' clientes na base'}
function drawCharts(){if(!DATA||typeof Chart==='undefined')return;const labelsStatus=Object.keys(DATA.statusCounts);const valsStatus=Object.values(DATA.statusCounts);chart('statusChart','doughnut',{labels:labelsStatus,datasets:[{data:valsStatus,backgroundColor:[colors.green,colors.yellow,colors.red,colors.blue,colors.muted],borderWidth:0,hoverOffset:10}]},{cutout:'64%'});chart('financeChart','bar',{labels:['Carteira','Devedor','Recebido'],datasets:[{type:'bar',label:'Valores',data:[DATA.kpis.carteira,DATA.kpis.devedor,DATA.kpis.recebidoSemana],backgroundColor:[colors.collin,colors.red,colors.green],borderRadius:12},{type:'line',label:'Linha de leitura',data:[DATA.kpis.carteira,DATA.kpis.devedor,DATA.kpis.recebidoSemana],borderColor:colors.dark,tension:.35,pointRadius:5}]});const rb=DATA.rankClientesBairro.slice(0,10);chart('rankClientesBairroChart','bar',{labels:rb.map(b=>b.bairro),datasets:[{label:'Clientes cadastrados',data:rb.map(b=>b.clientes),backgroundColor:colors.collin,borderRadius:10}]},{indexAxis:'y'});const rv=DATA.rankVendasBairro.slice(0,10);chart('rankVendasBairroChart','bar',{labels:rv.map(b=>b.bairro),datasets:[{label:'Total vendas',data:rv.map(b=>b.vendas),backgroundColor:colors.green,borderRadius:10}]},{indexAxis:'y'});const b=DATA.bairros.slice(0,12);chart('bairroBubbleChart','bubble',{datasets:b.map(x=>({label:x.bairro,data:[{x:x.clientes,y:x.vendas,r:Math.max(5,Math.min(24,x.devedor/250))}],backgroundColor:'rgba(200,144,128,.55)',borderColor:colors.collin}))},{scales:{x:{title:{display:true,text:'Clientes'}},y:{title:{display:true,text:'Carteira'}}}});chart('bairroCompareChart','bar',{labels:b.map(x=>x.bairro),datasets:[{label:'Vendas',data:b.map(x=>x.vendas),backgroundColor:colors.collin,borderRadius:8},{label:'Devedor',data:b.map(x=>x.devedor),backgroundColor:colors.red,borderRadius:8}]});chart('metasProgressChart','radar',{labels:['Clientes','Receb. semanal','Receb. mensal','Salário'],datasets:[{label:'Progresso %',data:[DATA.goals.clientesProgresso,DATA.kpis.recebidoSemana/DATA.goals.recebimentoMetaSemanal*100,DATA.kpis.recebidoSemana/DATA.goals.recebimentoMetaMensal*100,DATA.kpis.comissaoUltimas4/DATA.goals.salarioMetaMensal*100],backgroundColor:'rgba(200,144,128,.22)',borderColor:colors.collin,pointBackgroundColor:colors.collin}]},{scales:{r:{beginAtZero:true,suggestedMax:100}}});chart('metasRecebimentoChart','bar',{labels:['Recebido Semana','Meta Semana','Meta Mês'],datasets:[{label:'Valor',data:[DATA.kpis.recebidoSemana,DATA.goals.recebimentoMetaSemanal,DATA.goals.recebimentoMetaMensal],backgroundColor:[colors.green,colors.yellow,colors.collin],borderRadius:12}]});chart('comissaoLast4Chart','line',{labels:DATA.last4SalaryWeeks.map(w=>w.semana),datasets:[{label:'Comissão',data:DATA.last4SalaryWeeks.map(w=>w.comissao),borderColor:colors.collin,backgroundColor:'rgba(200,144,128,.18)',fill:true,tension:.42,pointRadius:6},{label:'Meta média',data:DATA.last4SalaryWeeks.map(()=>DATA.goals.salarioMetaMensal/4),borderColor:colors.green,borderDash:[6,6],pointRadius:0}]});chart('comissaoRuleChart','doughnut',{labels:['15% Parcelas','Ajuda custo'],datasets:[{data:[DATA.kpis.recebidoSemana*.15,DATA.goals.ajudaCusto],backgroundColor:[colors.collin,colors.green],borderWidth:0}]},{cutout:'58%'});chart('performanceWeeklyChart','line',{labels:DATA.salaryWeeks.map(w=>w.semana),datasets:[{label:'Comissão semanal',data:DATA.salaryWeeks.map(w=>w.comissao),borderColor:colors.collin,backgroundColor:'rgba(200,144,128,.20)',fill:true,tension:.38,pointRadius:6},{label:'Tendência',data:DATA.salaryWeeks.map((w,i,arr)=>arr.slice(0,i+1).reduce((a,b)=>a+b.comissao,0)/(i+1)),borderColor:colors.blue,tension:.4,pointRadius:3}]});chart('projectionChart','bar',{labels:['Atual 4 sem.','Projeção mês','Meta'],datasets:[{label:'Salário/Comissão',data:[DATA.kpis.comissaoUltimas4,DATA.kpis.projecaoSalarioMes,DATA.goals.salarioMetaMensal],backgroundColor:[colors.collin,colors.blue,colors.green],borderRadius:14}]})}
document.querySelectorAll('#nav button').forEach(btn=>btn.onclick=()=>tab(btn.dataset.tab));$('searchInput').oninput=renderClientes;$('reloadBtn').onclick=load;window.addEventListener('resize',()=>setTimeout(drawCharts,150));load();
