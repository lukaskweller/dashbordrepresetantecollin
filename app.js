/* Collin Dashboard 4.3.1 Safe AutoSync */
var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
var SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDBHyfM0CoQuXfeiktYsO6omSL0055fqNxto_207DQb285VgL6eS90hpem9ftmMdt7BYFt7iqGrORL/pub?output=csv';
var DATA = null;
var page = 1;
var perPage = 16;
var currentPriority = 'todos';

function el(id){ return document.getElementById(id); }
function money(v){ return BRL.format(Number(v || 0)); }
function safeText(v){ return String(v == null ? '' : v); }

function normalizeHeader(h){
  return safeText(h).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function toNumber(v){
  if(typeof v === 'number') return v;
  var s = safeText(v).replace(/R\\$/gi,'').replace(/\\s/g,'');
  if(s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\\./g,'').replace(',','.');
  else if(s.indexOf(',') >= 0) s = s.replace(',','.');
  var n = parseFloat(s.replace(/[^\\d.-]/g,''));
  return isNaN(n) ? 0 : n;
}
function cleanStatus(s){
  var l = safeText(s).toLowerCase();
  if(l.indexOf('quit') >= 0) return 'Quitado';
  if(l.indexOf('prox') >= 0 || l.indexOf('próx') >= 0 || l.indexOf('cobrar') >= 0) return 'Cobrar próxima semana';
  if(l.indexOf('nao') >= 0 || l.indexOf('não') >= 0 || l.indexOf('atras') >= 0) return 'Não pago';
  if(l.indexOf('pago') >= 0) return 'Pago';
  return s ? safeText(s) : 'Em acompanhamento';
}
function bairroName(n){
  var txt = safeText(n).trim();
  var b = 'Não informado';
  if(txt.indexOf(' - ') >= 0) b = txt.split(' - ').pop();
  else if(txt.indexOf('-') >= 0) b = txt.split('-').pop();
  b = safeText(b).trim().replace(/\\s+/g, ' ');
  b = b.toLowerCase().replace(/\\b\\w/g, function(m){ return m.toUpperCase(); });
  var map = {'Forquilhinha':'Forquilinhas','Forquilhinhas':'Forquilinhas','Barra':'Barra Aririú','Barra Aririu':'Barra Aririú','Ponte Do Imaruim':'Ponte Imaruim'};
  return map[b] || b || 'Não informado';
}
function baseName(n){
  var t = safeText(n).trim();
  return t.indexOf(' - ') >= 0 ? t.split(' - ')[0].trim() : t;
}
function parseCSV(text){
  var rows = [], row = [], cell = '', quote = false;
  for(var i=0;i<text.length;i++){
    var ch = text[i], nx = text[i+1];
    if(ch === '"' && quote && nx === '"'){ cell += '"'; i++; continue; }
    if(ch === '"'){ quote = !quote; continue; }
    if(ch === ',' && !quote){ row.push(cell); cell = ''; continue; }
    if((ch === '\\n' || ch === '\\r') && !quote){
      if(cell || row.length){ row.push(cell); rows.push(row); row = []; cell = ''; }
      if(ch === '\\r' && nx === '\\n') i++;
      continue;
    }
    cell += ch;
  }
  if(cell || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
function pick(obj, names){
  for(var i=0;i<names.length;i++){
    var k = normalizeHeader(names[i]);
    if(obj[k] !== undefined) return obj[k];
  }
  return '';
}
function rowsToClients(rows){
  var headerIndex = 0;
  for(var i=0;i<Math.min(rows.length, 15);i++){
    var normalized = rows[i].map(normalizeHeader);
    var hasClient = normalized.some(function(h){ return h.indexOf('cliente') >= 0; });
    var hasStatusOrSaldo = normalized.some(function(h){ return h.indexOf('status') >= 0 || h.indexOf('saldo') >= 0; });
    if(hasClient && hasStatusOrSaldo){ headerIndex = i; break; }
  }
  var headers = rows[headerIndex].map(normalizeHeader);
  var clients = [];
  for(var r=headerIndex+1;r<rows.length;r++){
    var vals = rows[r];
    if(!vals || !vals.length) continue;
    var obj = {};
    for(var h=0;h<headers.length;h++) obj[headers[h]] = vals[h] || '';
    var raw = pick(obj, ['Cliente','Clientes','Nome']) || vals[1] || vals[0] || '';
    raw = safeText(raw).trim();
    if(!raw || raw.toLowerCase() === 'clientes:') continue;
    var status = cleanStatus(pick(obj, ['Status','Situação','Situacao']));
    var saldoCarteira = toNumber(pick(obj, ['Saldo Carteira','Carteira','Total Vendas','Vendas','Saldo']));
    var saldoDevedor = toNumber(pick(obj, ['Saldo Devedor','Devedor','Valor Devedor','Em Aberto']));
    var valorParcela = toNumber(pick(obj, ['Valor Parcela','Parcela','Valor da Parcela']));
    var prioridade = status === 'Não pago' || saldoDevedor >= 500 ? 'Alta' : (status === 'Cobrar próxima semana' || saldoDevedor >= 150 ? 'Média' : 'Baixa');
    clients.push({
      id: clients.length + 1,
      cliente: raw,
      nome: baseName(raw),
      bairro: bairroName(raw),
      vendedor: safeText(pick(obj, ['Vendedor','Representante'])),
      saldoCarteira: Number(saldoCarteira.toFixed(2)),
      saldoDevedor: Number(saldoDevedor.toFixed(2)),
      dataInicio: safeText(pick(obj, ['Data Início','Data Inicio','Inicio'])),
      vencimento: safeText(pick(obj, ['Vencimento','Data Vencimento'])),
      parcelas: safeText(pick(obj, ['Parcelas','Qtd Parcelas'])),
      valorParcela: Number(valorParcela.toFixed(2)),
      parcelasPagas: toNumber(pick(obj, ['Parcelas Pagas','Pagas'])),
      status: status,
      observacoes: safeText(pick(obj, ['Observações','Observacoes','Obs'])),
      telefone: safeText(pick(obj, ['Telefone','WhatsApp','Whatsapp','Celular'])),
      prioridade: prioridade
    });
  }
  if(!clients.length) throw new Error('Nenhum cliente encontrado.');
  return clients;
}
function buildData(clients, source){
  var statusCounts = {}, bairrosMap = {};
  clients.forEach(function(c){
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    if(!bairrosMap[c.bairro]) bairrosMap[c.bairro] = {bairro:c.bairro, clientes:0, vendas:0, devedor:0};
    bairrosMap[c.bairro].clientes++;
    bairrosMap[c.bairro].vendas += c.saldoCarteira;
    bairrosMap[c.bairro].devedor += c.saldoDevedor;
  });
  var total = clients.length;
  var ativos = clients.filter(function(c){ return ['Pago','Não pago','Cobrar próxima semana'].indexOf(c.status) >= 0; }).length;
  var inativos = total - ativos;
  var vendas = clients.reduce(function(a,c){ return a + c.saldoCarteira; },0);
  var devedor = clients.reduce(function(a,c){ return a + c.saldoDevedor; },0);
  var recebidoSemana = clients.filter(function(c){ return c.status === 'Pago'; }).reduce(function(a,c){ return a + c.valorParcela; },0);
  var bairros = Object.keys(bairrosMap).map(function(k){
    var b = bairrosMap[k];
    b.vendas = Number(b.vendas.toFixed(2));
    b.devedor = Number(b.devedor.toFixed(2));
    b.ticketMedio = b.clientes ? Number((b.vendas / b.clientes).toFixed(2)) : 0;
    return b;
  }).sort(function(a,b){ return b.vendas - a.vendas; });
  var topClientes = clients.slice().sort(function(a,b){ return b.saldoDevedor - a.saldoDevedor; });
  var maiorParcela = clients.slice().sort(function(a,b){ return b.valorParcela - a.valorParcela; })[0] || null;
  var forq = clients.filter(function(c){ return c.bairro === 'Forquilinhas'; }).sort(function(a,b){ return b.saldoCarteira - a.saldoCarteira; });
  var maiorClientePorBairro = forq[0] || clients.slice().sort(function(a,b){ return b.saldoCarteira - a.saldoCarteira; })[0] || null;
  var semana5 = Number((recebidoSemana * 0.10).toFixed(2));
  var salaryWeeks = [
    {semana:'Semana 1', comissao:991},
    {semana:'Semana 2', comissao:1073},
    {semana:'Semana 3', comissao:1105},
    {semana:'Semana 4', comissao:1215},
    {semana:'Semana 5', comissao:semana5}
  ];
  return {
    version:'4.3.1 Safe AutoSync',
    updatedAt:new Date().toISOString(),
    source:source,
    goals:{clientesMeta:40,clientesAbertos:16,clientesSemana:6,clientesProgresso:40,recebimentoMetaSemanal:6000,recebimentoMetaMensal:20000,salarioMetaMensal:4500,comissaoPercentual:10},
    kpis:{clientes:total,ativos:ativos,inativos:inativos,vendas:Number(vendas.toFixed(2)),devedor:Number(devedor.toFixed(2)),recebidoSemana:Number(recebidoSemana.toFixed(2)),ticketMedio:total?Number((vendas/total).toFixed(2)):0,maiorDevedor:topClientes[0]||null,maiorParcela:maiorParcela,maiorClientePorBairro:maiorClientePorBairro,atrasados:statusCounts['Não pago']||0,cobrar:statusCounts['Cobrar próxima semana']||0,quitados:statusCounts['Quitado']||0,pagos:statusCounts['Pago']||0,comissaoSemanaAtual:semana5,comissao4Semanas:4384,comissao5Semanas:Number((4384+semana5).toFixed(2))},
    statusCounts:statusCounts,
    bairros:bairros,
    topAtrasados:topClientes.filter(function(c){ return ['Não pago','Cobrar próxima semana'].indexOf(c.status) >= 0; }).slice(0,8),
    topClientes:topClientes.slice(0,20),
    visitas:clients.filter(function(c){ return c.saldoDevedor > 0 && c.saldoDevedor <= 150; }).sort(function(a,b){ return a.saldoDevedor-b.saldoDevedor; }).slice(0,10),
    salaryWeeks:salaryWeeks,
    weekly:[{semana:'Semana 1',clientes:4,recebido:9910,comissao:991},{semana:'Semana 2',clientes:6,recebido:10730,comissao:1073},{semana:'Semana 3',clientes:0,recebido:11050,comissao:1105},{semana:'Semana 4',clientes:6,recebido:12150,comissao:1215},{semana:'Semana 5',clientes:6,recebido:Number(recebidoSemana.toFixed(2)),comissao:semana5}],
    clientes:clients
  };
}
async function loadData(){
  var cache = localStorage.getItem('collinDash431');
  try{
    var res = await fetch(SHEET_URL + '&cacheBust=' + Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error('CSV indisponível');
    var txt = await res.text();
    var clients = rowsToClients(parseCSV(txt));
    var data = buildData(clients, 'Google Sheets CSV');
    localStorage.setItem('collinDash431', JSON.stringify(data));
    localStorage.setItem('collinLastSync', new Date().toISOString());
    return data;
  }catch(e){
    console.warn('Google Sheets falhou. Usando fallback.', e);
    if(cache) return JSON.parse(cache);
    var fallback = await fetch('data/clientes.json?ts=' + Date.now());
    return await fallback.json();
  }
}
function statusClass(s){ s = safeText(s).toLowerCase(); if(s.indexOf('quit')>=0)return'quitado'; if(s.indexOf('não')>=0||s.indexOf('nao')>=0)return'nao'; if(s.indexOf('cobrar')>=0)return'cobrar'; if(s.indexOf('pago')>=0)return'pago'; return'acomp';}
function getClient(id){ return DATA.clientes.filter(function(c){ return c.id === id; })[0]; }
function msg(c,t){ if(t==='reativacao') return 'Olá, '+c.nome+'! Tudo bem? Vi que sua conta Collin Professional está quase finalizando. Já consigo te passar novas opções para reposição. Quer que eu te envie algumas sugestões?'; return 'Olá, '+c.nome+'! Tudo bem? Passando para lembrar sobre o saldo em aberto da Collin Professional.\\n\\nCliente: '+c.nome+'\\nSaldo: '+money(c.saldoDevedor)+'\\nStatus: '+c.status+'\\n\\nConsegue me dar um retorno hoje?'; }
function whats(c,t){ var text = encodeURIComponent(msg(c,t)); var phone = safeText(c.telefone).replace(/\\D/g,''); return phone.length > 8 ? 'https://wa.me/55'+phone+'?text='+text : 'https://wa.me/?text='+text; }
function maps(c){ return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.bairro + ' Santa Catarina'); }
function copyText(t){ navigator.clipboard && navigator.clipboard.writeText(t); showToast('Copiado'); }
function showToast(t){ var toast = el('toast'); if(!toast) return; toast.textContent = t; toast.classList.add('show'); setTimeout(function(){ toast.classList.remove('show'); }, 1800); }
function updateNet(){ var online = navigator.onLine; if(el('netDot')) el('netDot').className = online ? 'online':'offline'; if(el('netText')) el('netText').textContent = online ? 'Online':'Offline'; var last = localStorage.getItem('collinLastSync'); if(el('syncText')) el('syncText').textContent = online ? (last ? 'Última sync: '+new Date(last).toLocaleString('pt-BR') : 'Conectado') : 'Usando dados salvos'; }
function setTab(tab){ document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')}); if(el(tab)) el(tab).classList.add('active'); document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-tab')===tab)}); if(el('pageTitle')) el('pageTitle').textContent = {alertas:'Alertas Executivos',bairros:'Análise por Bairros',clientes:'CRM de Clientes',visitas:'Visitas e Revisitas',cobranca:'Cobrança Inteligente',metas:'Metas Comerciais',relatorio:'Relatório Semanal',comissao:'Comissão'}[tab] || 'Dashboard'; setTimeout(drawAll,50); }
function actionBtns(c){ return '<div class="actions"><a class="btn whatsapp" target="_blank" href="'+whats(c)+'">Whats</a><button class="btn dark" onclick="copyText(msg(getClient('+c.id+')))">Copiar</button><button class="btn blue" onclick="openClient('+c.id+')">Ver</button></div>'; }
function renderKPIs(){ var k=DATA.kpis,g=DATA.goals; var arr=[['Clientes',k.clientes,'Todos cadastrados'],['Ativos',k.ativos,'Pagos + a pagar'],['Inativos',k.inativos,'Quitados/outros'],['Recebido R$',money(k.recebidoSemana),'Parcelas pagas'],['Vendas',money(k.vendas),'Carteira'],['Devedor',money(k.devedor),'Em aberto'],['Ticket médio',money(k.ticketMedio),'Média compras'],['Atrasados',k.atrasados,'Não pagos']]; el('alertKpis').innerHTML = arr.map(function(x){return '<article class="kpi"><small>'+x[0]+'</small><b>'+x[1]+'</b><span>'+x[2]+'</span></article>'}).join(''); el('heroGoal').textContent = g.clientesAbertos+'/'+g.clientesMeta; el('heroProgress').style.width = Math.min(g.clientesProgresso,100)+'%'; }
function renderSmart(){ var k=DATA.kpis; var cards=[['Maior devedor',(k.maiorDevedor?k.maiorDevedor.nome:'-')+' — '+money(k.maiorDevedor?k.maiorDevedor.saldoDevedor:0)],['Média de compras',money(k.ticketMedio)],['Maior parcela',(k.maiorParcela?k.maiorParcela.nome:'-')+' — '+money(k.maiorParcela?k.maiorParcela.valorParcela:0)],['Maior cliente por bairro',(k.maiorClientePorBairro?k.maiorClientePorBairro.bairro:'Forquilinhas')+': '+(k.maiorClientePorBairro?k.maiorClientePorBairro.nome:'-')+' — '+money(k.maiorClientePorBairro?k.maiorClientePorBairro.saldoCarteira:0)]]; el('smartCards').innerHTML = cards.map(function(c){return '<div class="smart-card"><small>'+c[0]+'</small><b>'+c[1]+'</b></div>'}).join(''); }
function renderLate(){ var list = DATA.topAtrasados.length ? DATA.topAtrasados : DATA.topClientes.slice(0,8); el('lateRows').innerHTML = list.map(function(c){return '<tr><td><b>'+c.nome+'</b></td><td>'+c.bairro+'</td><td><b>'+money(c.saldoDevedor)+'</b></td><td><span class="status '+statusClass(c.status)+'">'+c.status+'</span></td><td>'+actionBtns(c)+'</td></tr>'}).join(''); }
function renderBairros(){ el('bairroCards').innerHTML = DATA.bairros.slice(0,15).map(function(b){return '<article class="card"><h4>'+b.bairro+'</h4><p>'+b.clientes+' clientes</p><div class="amount">'+money(b.vendas)+'</div><p>Devedor: <b>'+money(b.devedor)+'</b> • Ticket: <b>'+money(b.ticketMedio)+'</b></p></article>'}).join(''); }
function filteredClients(){ var q = (el('clientSearch') ? el('clientSearch').value : '').toLowerCase(); var st = (el('statusFilter') ? el('statusFilter').value : 'todos'); return DATA.clientes.filter(function(c){ return (c.cliente+' '+c.bairro+' '+c.status).toLowerCase().indexOf(q)>=0 && (st==='todos'||c.status===st); }); }
function renderClients(){ var list=filteredClients(), pages=Math.max(Math.ceil(list.length/perPage),1); if(page>pages) page=pages; var items=list.slice((page-1)*perPage,page*perPage); el('clientRows').innerHTML = items.map(function(c){return '<tr><td onclick="openClient('+c.id+')"><b>'+c.nome+'</b><br><small>'+c.cliente+'</small></td><td>'+c.bairro+'</td><td>'+money(c.saldoCarteira)+'</td><td><b>'+money(c.saldoDevedor)+'</b></td><td><span class="status '+statusClass(c.status)+'">'+c.status+'</span></td><td>'+actionBtns(c)+'</td></tr>'}).join(''); el('pageInfo').textContent = 'Página '+page+' de '+pages+' • '+list.length+' clientes'; }
function renderVisits(){ el('visitCards').innerHTML = DATA.visitas.map(function(c){return '<article class="card"><h4>'+c.nome+'</h4><p>'+c.bairro+' • Saldo '+money(c.saldoDevedor)+'</p><div class="amount">Revisita</div><p>Conta próxima de finalizar ou cliente com potencial para nova compra.</p><div class="actions"><a class="btn whatsapp" target="_blank" href="'+whats(c,'reativacao')+'">Whats</a><button class="btn dark" onclick="copyText(msg(getClient('+c.id+'),\\'reativacao\\'))">Copiar</button><a class="btn blue" target="_blank" href="'+maps(c)+'">Mapa</a></div></article>'}).join(''); }
function renderCharge(){ var list = DATA.clientes.filter(function(c){return c.saldoDevedor>0}).sort(function(a,b){return b.saldoDevedor-a.saldoDevedor}); if(currentPriority !== 'todos') list = list.filter(function(c){return c.prioridade===currentPriority}); el('chargeCards').innerHTML = list.slice(0,24).map(function(c){return '<article class="card"><h4>'+c.nome+'</h4><p>'+c.bairro+' • '+c.status+'</p><div class="amount">'+money(c.saldoDevedor)+'</div><span class="status '+(c.prioridade==='Alta'?'nao':c.prioridade==='Média'?'cobrar':'pago')+'">'+c.prioridade+' prioridade</span><div class="actions" style="margin-top:12px">'+actionBtns(c)+'</div></article>'}).join(''); }
function renderGoals(){ var g=DATA.goals,k=DATA.kpis; el('clientGoalBadge').textContent = g.clientesProgresso+'%'; el('clientGoalText').textContent = g.clientesAbertos+'/'+g.clientesMeta; var circ=2*Math.PI*68; el('clientRing').style.strokeDasharray=circ; el('clientRing').style.strokeDashoffset=circ-(circ*Math.min(g.clientesProgresso,100)/100); el('goalInsights').innerHTML='<div class="goal-list"><div class="goal-item"><div class="goal-row"><span>Esta semana</span><b>+'+g.clientesSemana+' clientes</b></div></div><div class="goal-item"><div class="goal-row"><span>Faltam</span><b>'+Math.max(g.clientesMeta-g.clientesAbertos,0)+' clientes</b></div></div></div>'; var pSem=(k.recebidoSemana/g.recebimentoMetaSemanal*100).toFixed(1), pMes=(k.recebidoSemana/g.recebimentoMetaMensal*100).toFixed(1); el('revenueGoals').innerHTML=goalItem('Meta recebimento semanal', money(g.recebimentoMetaSemanal), money(k.recebidoSemana), pSem)+goalItem('Meta recebimento mensal', money(g.recebimentoMetaMensal), money(k.recebidoSemana), pMes); var p4=(k.comissao4Semanas/g.salarioMetaMensal*100).toFixed(1), p5=(k.comissao5Semanas/g.salarioMetaMensal*100).toFixed(1); el('salaryGoals').innerHTML=goalItem('Últimas 4 semanas', money(g.salarioMetaMensal), money(k.comissao4Semanas), p4)+goalItem('Com semana 5 atual', money(g.salarioMetaMensal), money(k.comissao5Semanas), p5); }
function goalItem(title, meta, atual, pct){ var color=pct>=70?'var(--green)':pct>=30?'var(--yellow)':'var(--red)'; return '<div class="goal-item"><div class="goal-row"><span>'+title+'</span><b>'+pct+'%</b></div><small>'+atual+' de '+meta+'</small><div class="progress"><span style="width:'+Math.min(pct,100)+'%;background:'+color+'"></span></div></div>'; }
function buildReports(){ var k=DATA.kpis,g=DATA.goals; var short='Relatório semanal Collin Professional\\n\\nClientes cadastrados: '+k.clientes+'\\nClientes ativos: '+k.ativos+'\\nClientes abertos no mês: '+g.clientesAbertos+'/'+g.clientesMeta+'\\nNovos clientes na semana: +'+g.clientesSemana+'\\nRecebido na semana: '+money(k.recebidoSemana)+'\\nMeta semanal: '+money(g.recebimentoMetaSemanal)+'\\nSaldo em aberto: '+money(k.devedor)+'\\nComissão 4 semanas: '+money(k.comissao4Semanas)+'\\nSemana 5 até agora: '+money(k.comissaoSemanaAtual); var full='RELATÓRIO EXECUTIVO — COLLIN PROFESSIONAL\\n\\nClientes cadastrados: '+k.clientes+'\\nClientes ativos: '+k.ativos+'\\nClientes inativos: '+k.inativos+'\\nCarteira total: '+money(k.vendas)+'\\nSaldo devedor: '+money(k.devedor)+'\\nRecebido na semana: '+money(k.recebidoSemana)+'\\n\\nComissão\\nSemana 1: R$ 991,00\\nSemana 2: R$ 1.073,00\\nSemana 3: R$ 1.105,00\\nSemana 4: R$ 1.215,00\\nTotal 4 semanas: '+money(k.comissao4Semanas)+'\\nSemana 5: '+money(k.comissaoSemanaAtual)+'\\nMeta salário: '+money(g.salarioMetaMensal); el('shortReport').textContent=short; el('fullReport').textContent=full; el('reportWhatsapp').href='https://wa.me/?text='+encodeURIComponent(short); }
function copyReport(type){ copyText(type==='short'?el('shortReport').textContent:el('fullReport').textContent); }
function renderCommission(){ var k=DATA.kpis; var arr=[['Semana 1',money(991),'Histórico'],['Semana 2',money(1073),'Histórico'],['Semana 3',money(1105),'Histórico'],['Semana 4',money(1215),'Histórico'],['Semana 5',money(k.comissaoSemanaAtual),'Até agora'],['Total 4 semanas',money(k.comissao4Semanas),'Fechamento'],['Total + semana 5',money(k.comissao5Semanas),'Projeção'],['Meta salário',money(DATA.goals.salarioMetaMensal),'Mês']]; el('commissionKpis').innerHTML=arr.map(function(x){return '<article class="kpi"><small>'+x[0]+'</small><b>'+x[1]+'</b><span>'+x[2]+'</span></article>'}).join(''); }
function openClient(id){ var c=getClient(id); el('modalContent').innerHTML='<span class="eyebrow">Ficha do cliente</span><h2>'+c.nome+'</h2><p>'+c.cliente+'</p><div class="modal-grid"><div class="info"><small>Bairro</small><b>'+c.bairro+'</b></div><div class="info"><small>Status</small><b>'+c.status+'</b></div><div class="info"><small>Carteira</small><b>'+money(c.saldoCarteira)+'</b></div><div class="info"><small>Devedor</small><b>'+money(c.saldoDevedor)+'</b></div><div class="info"><small>Parcela</small><b>'+money(c.valorParcela)+'</b></div><div class="info"><small>Vencimento</small><b>'+safeText(c.vencimento)+'</b></div></div><pre>'+(c.observacoes||'Sem observações cadastradas.')+'</pre><div class="actions"><a class="btn whatsapp" target="_blank" href="'+whats(c)+'">Abrir WhatsApp</a><button class="btn dark" onclick="copyText(msg(getClient('+c.id+')))">Copiar cobrança</button><a class="btn blue" target="_blank" href="'+maps(c)+'">Google Maps</a></div>'; el('modalBackdrop').classList.add('show'); }
function closeModal(){ el('modalBackdrop').classList.remove('show'); }
function renderStatusOptions(){ var cur=el('statusFilter').value||'todos'; el('statusFilter').innerHTML='<option value="todos">Todos status</option>'; Object.keys(DATA.statusCounts).forEach(function(s){ el('statusFilter').insertAdjacentHTML('beforeend','<option value="'+s+'">'+s+'</option>'); }); el('statusFilter').value=cur; }
function renderAll(){ updateNet(); renderKPIs(); renderSmart(); renderLate(); renderBairros(); renderStatusOptions(); renderClients(); renderVisits(); renderCharge(); renderGoals(); buildReports(); renderCommission(); drawAll(); el('footerUpdate').textContent='Atualizado em '+new Date(DATA.updatedAt).toLocaleString('pt-BR'); }
function drawAll(){ drawDoughnut('statusChart', DATA.statusCounts); drawBar('bairroBarChart', DATA.bairros.slice(0,15).map(function(b){return b.bairro}), DATA.bairros.slice(0,15).map(function(b){return b.vendas}), true, true); drawDoughnut('bairroPieChart', objectFromPairs(DATA.bairros.slice(0,8).map(function(b){return [b.bairro,b.clientes]}))); drawBar('weeklyChart', DATA.weekly.map(function(w){return w.semana}), DATA.weekly.map(function(w){return w.clientes}), false, false); drawBar('commissionChart', DATA.salaryWeeks.map(function(w){return w.semana}), DATA.salaryWeeks.map(function(w){return w.comissao}), false, true); drawBar('salaryChart', DATA.salaryWeeks.map(function(w){return w.semana}), DATA.salaryWeeks.map(function(w){return w.comissao}), false, true); drawBar('receivedChart', DATA.weekly.map(function(w){return w.semana}), DATA.weekly.map(function(w){return w.recebido}), false, true); }
function objectFromPairs(pairs){ var o={}; pairs.forEach(function(p){o[p[0]]=p[1]}); return o; }
function drawDoughnut(id,obj){ var canvas=el(id); if(!canvas)return; var ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect(); canvas.width=rect.width*dpr; canvas.height=Number(canvas.getAttribute('height')||260)*dpr; ctx.scale(dpr,dpr); var w=rect.width,h=Number(canvas.getAttribute('height')||260),cx=w/2,cy=h/2,r=Math.min(w,h)*.34,total=Object.keys(obj).reduce(function(a,k){return a+obj[k]},0)||1,colors=['#C89080','#10B981','#F59E0B','#EF4444','#2563EB','#999']; var start=-Math.PI/2; ctx.clearRect(0,0,w,h); Object.keys(obj).forEach(function(k,i){var v=obj[k],a=v/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+a);ctx.arc(cx,cy,r*.58,start+a,start,true);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start+=a}); ctx.fillStyle='#111827';ctx.font='900 28px Arial';ctx.textAlign='center';ctx.fillText(total,cx,cy+4);ctx.fillStyle='#777';ctx.font='12px Arial';ctx.fillText('clientes',cx,cy+26); }
function drawBar(id,labels,values,horizontal,moneyFormat){ var canvas=el(id); if(!canvas)return; var ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect(); var h=Number(canvas.getAttribute('height')||300),w=rect.width,max=Math.max.apply(null, values.concat([1])); canvas.width=w*dpr; canvas.height=h*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h); if(horizontal){ var row=h/labels.length; labels.forEach(function(l,i){var y=i*row+10,x=145,bw=(w-x-80)*(values[i]/max);ctx.fillStyle='#111827';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText(String(l).slice(0,18),10,y+13);ctx.fillStyle='#eadfdb';round(ctx,x,y,w-x-90,14,8);ctx.fill();ctx.fillStyle='#C89080';round(ctx,x,y,bw,14,8);ctx.fill();ctx.fillStyle='#777';ctx.fillText(moneyFormat?compact(values[i]):values[i],w-75,y+13)}); } else { var pad=38,step=(w-pad*2)/values.length,barW=step*.55; values.forEach(function(v,i){var bh=(h-pad*2)*(v/max),x=pad+i*step+(step-barW)/2,y=h-pad-bh;ctx.fillStyle='#C89080';round(ctx,x,y,barW,bh,8);ctx.fill();ctx.fillStyle='#111827';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(moneyFormat?compact(v):v,x+barW/2,y-7);ctx.fillStyle='#777';ctx.font='11px Arial';ctx.fillText(labels[i],x+barW/2,h-12)}); } }
function compact(v){ return v>=1000 ? 'R$ '+(v/1000).toFixed(1)+'k' : money(v); }
function round(ctx,x,y,w,h,r){ ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath(); }
function setup(){ document.querySelectorAll('#nav button').forEach(function(b){ b.onclick=function(){ setTab(b.getAttribute('data-tab')); }; }); el('syncBtn').onclick=async function(){ DATA=await loadData(); renderAll(); showToast('Dados sincronizados'); }; el('clientSearch').oninput=function(){page=1;renderClients();}; el('statusFilter').onchange=function(){page=1;renderClients();}; el('prevPage').onclick=function(){page=Math.max(1,page-1);renderClients();}; el('nextPage').onclick=function(){page++;renderClients();}; document.querySelectorAll('.chip').forEach(function(c){ c.onclick=function(){ document.querySelectorAll('.chip').forEach(function(x){x.classList.remove('active')}); c.classList.add('active'); currentPriority=c.getAttribute('data-priority'); renderCharge(); }; }); el('modalBackdrop').onclick=function(e){ if(e.target.id==='modalBackdrop') closeModal(); }; setInterval(async function(){ if(navigator.onLine){ DATA=await loadData(); renderAll(); } }, 5*60*1000); }
async function init(){ try{ DATA=await loadData(); setup(); renderAll(); updateNet(); }catch(e){ console.error(e); document.body.innerHTML='<main style="padding:24px;font-family:Arial"><h1>Erro ao carregar Dashboard</h1><p>Verifique se os arquivos foram enviados corretamente para o GitHub.</p></main>'; } }
window.addEventListener('online',updateNet); window.addEventListener('offline',updateNet); window.addEventListener('resize',function(){setTimeout(drawAll,100)}); if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); }
init();
