/* Collin Dashboard 4.3.2 CLEAN - sem markdown corrompido */
const SHEET_URLS = [
  "https://docs.google.com/spreadsheets/d/1LfKj1DkDk2PDItrpmfImqdo9oGsvya1VdhV3ICzdpUU/gviz/tq?tqx=out:csv&gid=0",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTDBHyfM0CoQuXfeiktYsO6omSL0055fqNxto_207DQb285VgL6eS90hpem9ftmMdt7BYFt7iqGrORL/pub?output=csv"
];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let DATA = null;
let page = 1;
let currentPriority = "todos";
const perPage = 16;

function $(id) { return document.getElementById(id); }
function money(v) { return BRL.format(Number(v || 0)); }
function text(v) { return String(v == null ? "" : v); }

function normalizeHeader(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toNumber(value) {
  if (typeof value === "number") return value;
  let s = text(value).replace(/R\$/gi, "").replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && insideQuote && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (char === "," && !insideQuote) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuote) {
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
      if (char === "\r" && next === "\n") i++;
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function cleanStatus(value) {
  const s = text(value).toLowerCase();
  if (s.includes("quit")) return "Quitado";
  if (s.includes("prox") || s.includes("próx") || s.includes("cobrar")) return "Cobrar próxima semana";
  if (s.includes("nao") || s.includes("não") || s.includes("atras")) return "Não pago";
  if (s.includes("pago")) return "Pago";
  return value ? text(value) : "Em acompanhamento";
}

function bairroFromCliente(name) {
  const raw = text(name).trim();
  let bairro = "Não informado";

  if (raw.includes(" - ")) bairro = raw.split(" - ").pop();
  else if (raw.includes("-")) bairro = raw.split("-").pop();

  bairro = text(bairro).trim().replace(/\s+/g, " ");
  bairro = bairro.toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

  const map = {
    "Forquilhinha": "Forquilinhas",
    "Forquilhinhas": "Forquilinhas",
    "Barra": "Barra Aririú",
    "Barra Aririu": "Barra Aririú",
    "Ponte Do Imaruim": "Ponte Imaruim"
  };

  return map[bairro] || bairro || "Não informado";
}

function baseName(name) {
  const raw = text(name).trim();
  return raw.includes(" - ") ? raw.split(" - ")[0].trim() : raw;
}

function pick(obj, names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    if (obj[key] !== undefined) return obj[key];
  }
  return "";
}

function rowsToClients(rows) {
  let headerIndex = 0;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const normalized = rows[i].map(normalizeHeader);
    const hasCliente = normalized.some(h => h.includes("cliente"));
    const hasSaldoOrStatus = normalized.some(h => h.includes("saldo") || h.includes("status"));
    if (hasCliente && hasSaldoOrStatus) {
      headerIndex = i;
      break;
    }
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const clients = [];

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const values = rows[r];
    if (!values || values.length === 0) continue;

    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || "");

    const rawCliente = (pick(obj, ["Cliente", "Clientes", "Nome"]) || values[1] || values[0] || "").trim();
    if (!rawCliente || rawCliente.toLowerCase() === "clientes:") continue;

    const status = cleanStatus(pick(obj, ["Status", "Situação", "Situacao"]));
    const saldoCarteira = toNumber(pick(obj, ["Saldo Carteira", "Carteira", "Total Vendas", "Vendas", "Saldo"]));
    const saldoDevedor = toNumber(pick(obj, ["Saldo Devedor", "Devedor", "Valor Devedor", "Em Aberto"]));
    const valorParcela = toNumber(pick(obj, ["Valor Parcela", "Parcela", "Valor da Parcela"]));

    let prioridade = "Baixa";
    if (status === "Não pago" || saldoDevedor >= 500) prioridade = "Alta";
    else if (status === "Cobrar próxima semana" || saldoDevedor >= 150) prioridade = "Média";

    clients.push({
      id: clients.length + 1,
      cliente: rawCliente,
      nome: baseName(rawCliente),
      bairro: bairroFromCliente(rawCliente),
      vendedor: text(pick(obj, ["Vendedor", "Representante"])),
      saldoCarteira: Number(saldoCarteira.toFixed(2)),
      saldoDevedor: Number(saldoDevedor.toFixed(2)),
      dataInicio: text(pick(obj, ["Data Início", "Data Inicio", "Inicio"])),
      vencimento: text(pick(obj, ["Vencimento", "Data Vencimento"])),
      parcelas: text(pick(obj, ["Parcelas", "Qtd Parcelas"])),
      valorParcela: Number(valorParcela.toFixed(2)),
      parcelasPagas: toNumber(pick(obj, ["Parcelas Pagas", "Pagas"])),
      status,
      observacoes: text(pick(obj, ["Observações", "Observacoes", "Obs"])),
      telefone: text(pick(obj, ["Telefone", "WhatsApp", "Whatsapp", "Celular"])),
      prioridade
    });
  }

  if (!clients.length) throw new Error("Nenhum cliente encontrado no CSV.");
  return clients;
}

function buildData(clients, source) {
  const statusCounts = {};
  const bairroMap = {};

  clients.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;

    if (!bairroMap[c.bairro]) {
      bairroMap[c.bairro] = { bairro: c.bairro, clientes: 0, vendas: 0, devedor: 0 };
    }

    bairroMap[c.bairro].clientes++;
    bairroMap[c.bairro].vendas += c.saldoCarteira;
    bairroMap[c.bairro].devedor += c.saldoDevedor;
  });

  const totalClientes = clients.length;
  const ativos = clients.filter(c => ["Pago", "Não pago", "Cobrar próxima semana"].includes(c.status)).length;
  const inativos = totalClientes - ativos;
  const vendas = clients.reduce((s, c) => s + c.saldoCarteira, 0);
  const devedor = clients.reduce((s, c) => s + c.saldoDevedor, 0);
  const recebidoSemana = clients.filter(c => c.status === "Pago").reduce((s, c) => s + c.valorParcela, 0);
  const ticketMedio = totalClientes ? vendas / totalClientes : 0;

  const bairros = Object.values(bairroMap).map(b => ({
    ...b,
    vendas: Number(b.vendas.toFixed(2)),
    devedor: Number(b.devedor.toFixed(2)),
    ticketMedio: b.clientes ? Number((b.vendas / b.clientes).toFixed(2)) : 0
  })).sort((a, b) => b.vendas - a.vendas);

  const topClientes = [...clients].sort((a, b) => b.saldoDevedor - a.saldoDevedor);
  const maiorParcela = [...clients].sort((a, b) => b.valorParcela - a.valorParcela)[0] || null;
  const maiorForquilinhas = clients
    .filter(c => c.bairro === "Forquilinhas")
    .sort((a, b) => b.saldoCarteira - a.saldoCarteira)[0];

  const maiorClientePorBairro = maiorForquilinhas || [...clients].sort((a, b) => b.saldoCarteira - a.saldoCarteira)[0] || null;
  const semana5 = Number((recebidoSemana * 0.10).toFixed(2));

  const salaryWeeks = [
    { semana: "Semana 1", comissao: 991 },
    { semana: "Semana 2", comissao: 1073 },
    { semana: "Semana 3", comissao: 1105 },
    { semana: "Semana 4", comissao: 1215 },
    { semana: "Semana 5", comissao: semana5 }
  ];

  return {
    version: "4.3.2 CLEAN",
    updatedAt: new Date().toISOString(),
    source,
    goals: {
      clientesMeta: 40,
      clientesAbertos: 16,
      clientesSemana: 6,
      clientesProgresso: 40,
      recebimentoMetaSemanal: 6000,
      recebimentoMetaMensal: 20000,
      salarioMetaMensal: 4500
    },
    kpis: {
      clientes: totalClientes,
      ativos,
      inativos,
      vendas: Number(vendas.toFixed(2)),
      devedor: Number(devedor.toFixed(2)),
      recebidoSemana: Number(recebidoSemana.toFixed(2)),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      maiorDevedor: topClientes[0] || null,
      maiorParcela,
      maiorClientePorBairro,
      atrasados: statusCounts["Não pago"] || 0,
      cobrar: statusCounts["Cobrar próxima semana"] || 0,
      quitados: statusCounts["Quitado"] || 0,
      pagos: statusCounts["Pago"] || 0,
      comissaoSemanaAtual: semana5,
      comissao4Semanas: 4384,
      comissao5Semanas: Number((4384 + semana5).toFixed(2))
    },
    statusCounts,
    bairros,
    topAtrasados: topClientes.filter(c => ["Não pago", "Cobrar próxima semana"].includes(c.status)).slice(0, 8),
    topClientes: topClientes.slice(0, 20),
    visitas: clients.filter(c => c.saldoDevedor > 0 && c.saldoDevedor <= 150).sort((a, b) => a.saldoDevedor - b.saldoDevedor).slice(0, 10),
    salaryWeeks,
    weekly: [
      { semana: "Semana 1", clientes: 4, recebido: 9910, comissao: 991 },
      { semana: "Semana 2", clientes: 6, recebido: 10730, comissao: 1073 },
      { semana: "Semana 3", clientes: 0, recebido: 11050, comissao: 1105 },
      { semana: "Semana 4", clientes: 6, recebido: 12150, comissao: 1215 },
      { semana: "Semana 5", clientes: 6, recebido: Number(recebidoSemana.toFixed(2)), comissao: semana5 }
    ],
    clientes: clients
  };
}

async function loadData() {
  const cache = localStorage.getItem("collinDashClean432");

  for (const url of SHEET_URLS) {
    try {
      const res = await fetch(url + "&cacheBust=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("Falha CSV");
      const csv = await res.text();
      const clients = rowsToClients(parseCSV(csv));
      const data = buildData(clients, "Google Sheets");
      localStorage.setItem("collinDashClean432", JSON.stringify(data));
      localStorage.setItem("collinLastSync", new Date().toISOString());
      return data;
    } catch (e) {
      console.warn("Falha ao ler URL:", url, e);
    }
  }

  if (cache) return JSON.parse(cache);

  const fallback = await fetch("data/clientes.json?ts=" + Date.now());
  return await fallback.json();
}

function statusClass(status) {
  const s = text(status).toLowerCase();
  if (s.includes("quit")) return "quitado";
  if (s.includes("não") || s.includes("nao")) return "nao";
  if (s.includes("cobrar")) return "cobrar";
  if (s.includes("pago")) return "pago";
  return "acomp";
}

function getClient(id) {
  return DATA.clientes.find(c => c.id === id);
}

function clientMessage(c, type = "cobranca") {
  if (type === "reativacao") {
    return `Olá, ${c.nome}! Tudo bem? Vi que sua conta Collin Professional está quase finalizando. Já consigo te passar novas opções para reposição. Quer que eu te envie algumas sugestões?`;
  }

  return `Olá, ${c.nome}! Tudo bem? Passando para lembrar sobre o saldo em aberto da Collin Professional.\n\nCliente: ${c.nome}\nSaldo: ${money(c.saldoDevedor)}\nStatus: ${c.status}\n\nConsegue me dar um retorno hoje?`;
}

function whatsappLink(c, type = "cobranca") {
  const message = encodeURIComponent(clientMessage(c, type));
  const phone = text(c.telefone).replace(/\D/g, "");
  return phone.length > 8 ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`;
}

function mapsLink(c) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.bairro + " Santa Catarina");
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message || "Copiado";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function copyText(value) {
  navigator.clipboard?.writeText(value);
  showToast("Copiado");
}

function updateNetwork() {
  const online = navigator.onLine;

  if ($("netDot")) $("netDot").className = online ? "online" : "offline";
  if ($("netText")) $("netText").textContent = online ? "Online" : "Offline";

  const last = localStorage.getItem("collinLastSync");
  if ($("syncText")) {
    $("syncText").textContent = online
      ? (last ? "Última sync: " + new Date(last).toLocaleString("pt-BR") : "Conectado")
      : "Usando dados salvos";
  }
}

function setTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  if ($(tab)) $(tab).classList.add("active");

  document.querySelectorAll("#nav button").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  const titles = {
    alertas: "Alertas Executivos",
    bairros: "Análise por Bairros",
    clientes: "CRM de Clientes",
    visitas: "Visitas e Revisitas",
    cobranca: "Cobrança Inteligente",
    metas: "Metas Comerciais",
    relatorio: "Relatório Semanal",
    comissao: "Comissão"
  };

  if ($("pageTitle")) $("pageTitle").textContent = titles[tab] || "Dashboard";
  setTimeout(drawAll, 80);
}

function actionButtons(c) {
  return `
    <div class="actions">
      <a class="btn whatsapp" target="_blank" href="${whatsappLink(c)}">Whats</a>
      <button class="btn dark" onclick="copyText(clientMessage(getClient(${c.id})))">Copiar</button>
      <button class="btn blue" onclick="openClient(${c.id})">Ver</button>
    </div>
  `;
}

function renderKPIs() {
  const k = DATA.kpis;
  const g = DATA.goals;

  const cards = [
    ["Clientes", k.clientes, "Todos cadastrados"],
    ["Ativos", k.ativos, "Pagos + a pagar"],
    ["Inativos", k.inativos, "Quitados/outros"],
    ["Recebido R$", money(k.recebidoSemana), "Parcelas pagas"],
    ["Vendas", money(k.vendas), "Carteira"],
    ["Devedor", money(k.devedor), "Em aberto"],
    ["Ticket médio", money(k.ticketMedio), "Média compras"],
    ["Atrasados", k.atrasados, "Não pagos"]
  ];

  $("alertKpis").innerHTML = cards.map(c => `
    <article class="kpi">
      <small>${c[0]}</small>
      <b>${c[1]}</b>
      <span>${c[2]}</span>
    </article>
  `).join("");

  $("heroGoal").textContent = `${g.clientesAbertos}/${g.clientesMeta}`;
  $("heroProgress").style.width = Math.min(g.clientesProgresso, 100) + "%";
}

function renderSmart() {
  const k = DATA.kpis;

  const cards = [
    ["Maior devedor", `${k.maiorDevedor?.nome || "-"} — ${money(k.maiorDevedor?.saldoDevedor || 0)}`],
    ["Média de compras", money(k.ticketMedio)],
    ["Maior parcela", `${k.maiorParcela?.nome || "-"} — ${money(k.maiorParcela?.valorParcela || 0)}`],
    ["Maior cliente por bairro", `${k.maiorClientePorBairro?.bairro || "Forquilinhas"}: ${k.maiorClientePorBairro?.nome || "-"} — ${money(k.maiorClientePorBairro?.saldoCarteira || 0)}`]
  ];

  $("smartCards").innerHTML = cards.map(c => `
    <div class="smart-card">
      <small>${c[0]}</small>
      <b>${c[1]}</b>
    </div>
  `).join("");
}

function renderLate() {
  const list = DATA.topAtrasados.length ? DATA.topAtrasados : DATA.topClientes.slice(0, 8);

  $("lateRows").innerHTML = list.map(c => `
    <tr>
      <td><b>${c.nome}</b></td>
      <td>${c.bairro}</td>
      <td><b>${money(c.saldoDevedor)}</b></td>
      <td><span class="status ${statusClass(c.status)}">${c.status}</span></td>
      <td>${actionButtons(c)}</td>
    </tr>
  `).join("");
}

function renderBairros() {
  $("bairroCards").innerHTML = DATA.bairros.slice(0, 15).map(b => `
    <article class="card">
      <h4>${b.bairro}</h4>
      <p>${b.clientes} clientes</p>
      <div class="amount">${money(b.vendas)}</div>
      <p>Devedor: <b>${money(b.devedor)}</b> • Ticket: <b>${money(b.ticketMedio)}</b></p>
    </article>
  `).join("");
}

function filteredClients() {
  const q = ($("clientSearch")?.value || "").toLowerCase();
  const st = $("statusFilter")?.value || "todos";

  return DATA.clientes.filter(c => {
    const searchable = `${c.cliente} ${c.bairro} ${c.status}`.toLowerCase();
    return searchable.includes(q) && (st === "todos" || c.status === st);
  });
}

function renderClients() {
  const list = filteredClients();
  const pages = Math.max(Math.ceil(list.length / perPage), 1);

  if (page > pages) page = pages;

  const items = list.slice((page - 1) * perPage, page * perPage);

  $("clientRows").innerHTML = items.map(c => `
    <tr>
      <td onclick="openClient(${c.id})"><b>${c.nome}</b><br><small>${c.cliente}</small></td>
      <td>${c.bairro}</td>
      <td>${money(c.saldoCarteira)}</td>
      <td><b>${money(c.saldoDevedor)}</b></td>
      <td><span class="status ${statusClass(c.status)}">${c.status}</span></td>
      <td>${actionButtons(c)}</td>
    </tr>
  `).join("");

  $("pageInfo").textContent = `Página ${page} de ${pages} • ${list.length} clientes`;
}

function renderVisits() {
  $("visitCards").innerHTML = DATA.visitas.map(c => `
    <article class="card">
      <h4>${c.nome}</h4>
      <p>${c.bairro} • Saldo ${money(c.saldoDevedor)}</p>
      <div class="amount">Revisita</div>
      <p>Conta próxima de finalizar ou cliente com potencial para nova compra.</p>
      <div class="actions">
        <a class="btn whatsapp" target="_blank" href="${whatsappLink(c, "reativacao")}">Whats</a>
        <button class="btn dark" onclick="copyText(clientMessage(getClient(${c.id}), 'reativacao'))">Copiar</button>
        <a class="btn blue" target="_blank" href="${mapsLink(c)}">Mapa</a>
      </div>
    </article>
  `).join("");
}

function renderCharge() {
  let list = DATA.clientes
    .filter(c => c.saldoDevedor > 0)
    .sort((a, b) => b.saldoDevedor - a.saldoDevedor);

  if (currentPriority !== "todos") {
    list = list.filter(c => c.prioridade === currentPriority);
  }

  $("chargeCards").innerHTML = list.slice(0, 24).map(c => `
    <article class="card">
      <h4>${c.nome}</h4>
      <p>${c.bairro} • ${c.status}</p>
      <div class="amount">${money(c.saldoDevedor)}</div>
      <span class="status ${c.prioridade === "Alta" ? "nao" : c.prioridade === "Média" ? "cobrar" : "pago"}">${c.prioridade} prioridade</span>
      <div style="margin-top:12px">${actionButtons(c)}</div>
    </article>
  `).join("");
}

function goalItem(title, meta, actual, pct) {
  const color = pct >= 70 ? "var(--green)" : pct >= 30 ? "var(--yellow)" : "var(--red)";
  return `
    <div class="goal-item">
      <div class="goal-row"><span>${title}</span><b>${pct}%</b></div>
      <small>${actual} de ${meta}</small>
      <div class="progress"><span style="width:${Math.min(pct, 100)}%;background:${color}"></span></div>
    </div>
  `;
}

function renderGoals() {
  const g = DATA.goals;
  const k = DATA.kpis;

  $("clientGoalBadge").textContent = g.clientesProgresso + "%";
  $("clientGoalText").textContent = `${g.clientesAbertos}/${g.clientesMeta}`;

  const circ = 2 * Math.PI * 68;
  $("clientRing").style.strokeDasharray = circ;
  $("clientRing").style.strokeDashoffset = circ - (circ * Math.min(g.clientesProgresso, 100) / 100);

  $("goalInsights").innerHTML = `
    <div class="goal-list">
      <div class="goal-item"><div class="goal-row"><span>Esta semana</span><b>+${g.clientesSemana} clientes</b></div></div>
      <div class="goal-item"><div class="goal-row"><span>Faltam</span><b>${Math.max(g.clientesMeta - g.clientesAbertos, 0)} clientes</b></div></div>
    </div>
  `;

  const pSem = Number((k.recebidoSemana / g.recebimentoMetaSemanal * 100).toFixed(1));
  const pMes = Number((k.recebidoSemana / g.recebimentoMetaMensal * 100).toFixed(1));

  $("revenueGoals").innerHTML =
    goalItem("Meta recebimento semanal", money(g.recebimentoMetaSemanal), money(k.recebidoSemana), pSem) +
    goalItem("Meta recebimento mensal", money(g.recebimentoMetaMensal), money(k.recebidoSemana), pMes);

  const p4 = Number((k.comissao4Semanas / g.salarioMetaMensal * 100).toFixed(1));
  const p5 = Number((k.comissao5Semanas / g.salarioMetaMensal * 100).toFixed(1));

  $("salaryGoals").innerHTML =
    goalItem("Últimas 4 semanas", money(g.salarioMetaMensal), money(k.comissao4Semanas), p4) +
    goalItem("Com semana 5 atual", money(g.salarioMetaMensal), money(k.comissao5Semanas), p5);
}

function buildReports() {
  const k = DATA.kpis;
  const g = DATA.goals;

  const short = `Relatório semanal Collin Professional

Clientes cadastrados: ${k.clientes}
Clientes ativos: ${k.ativos}
Clientes abertos no mês: ${g.clientesAbertos}/${g.clientesMeta}
Novos clientes na semana: +${g.clientesSemana}
Recebido na semana: ${money(k.recebidoSemana)}
Meta semanal: ${money(g.recebimentoMetaSemanal)}
Saldo em aberto: ${money(k.devedor)}
Comissão 4 semanas: ${money(k.comissao4Semanas)}
Semana 5 até agora: ${money(k.comissaoSemanaAtual)}`;

  const full = `RELATÓRIO EXECUTIVO — COLLIN PROFESSIONAL

Clientes cadastrados: ${k.clientes}
Clientes ativos: ${k.ativos}
Clientes inativos: ${k.inativos}

Carteira total: ${money(k.vendas)}
Saldo devedor: ${money(k.devedor)}
Recebido na semana: ${money(k.recebidoSemana)}

Comissão
Semana 1: R$ 991,00
Semana 2: R$ 1.073,00
Semana 3: R$ 1.105,00
Semana 4: R$ 1.215,00
Total 4 semanas: ${money(k.comissao4Semanas)}
Semana 5: ${money(k.comissaoSemanaAtual)}
Meta salário: ${money(g.salarioMetaMensal)}`;

  $("shortReport").textContent = short;
  $("fullReport").textContent = full;
  $("reportWhatsapp").href = "https://wa.me/?text=" + encodeURIComponent(short);
}

function copyReport(type) {
  copyText(type === "short" ? $("shortReport").textContent : $("fullReport").textContent);
}

function renderCommission() {
  const k = DATA.kpis;

  const cards = [
    ["Semana 1", money(991), "Histórico"],
    ["Semana 2", money(1073), "Histórico"],
    ["Semana 3", money(1105), "Histórico"],
    ["Semana 4", money(1215), "Histórico"],
    ["Semana 5", money(k.comissaoSemanaAtual), "Até agora"],
    ["Total 4 semanas", money(k.comissao4Semanas), "Fechamento"],
    ["Total + semana 5", money(k.comissao5Semanas), "Projeção"],
    ["Meta salário", money(DATA.goals.salarioMetaMensal), "Mês"]
  ];

  $("commissionKpis").innerHTML = cards.map(c => `
    <article class="kpi">
      <small>${c[0]}</small>
      <b>${c[1]}</b>
      <span>${c[2]}</span>
    </article>
  `).join("");
}

function openClient(id) {
  const c = getClient(id);

  $("modalContent").innerHTML = `
    <span class="eyebrow">Ficha do cliente</span>
    <h2>${c.nome}</h2>
    <p>${c.cliente}</p>

    <div class="modal-grid">
      <div class="info"><small>Bairro</small><b>${c.bairro}</b></div>
      <div class="info"><small>Status</small><b>${c.status}</b></div>
      <div class="info"><small>Carteira</small><b>${money(c.saldoCarteira)}</b></div>
      <div class="info"><small>Devedor</small><b>${money(c.saldoDevedor)}</b></div>
      <div class="info"><small>Parcela</small><b>${money(c.valorParcela)}</b></div>
      <div class="info"><small>Vencimento</small><b>${c.vencimento || "-"}</b></div>
    </div>

    <pre>${c.observacoes || "Sem observações cadastradas."}</pre>

    <div class="actions">
      <a class="btn whatsapp" target="_blank" href="${whatsappLink(c)}">Abrir WhatsApp</a>
      <button class="btn dark" onclick="copyText(clientMessage(getClient(${c.id})))">Copiar cobrança</button>
      <a class="btn blue" target="_blank" href="${mapsLink(c)}">Google Maps</a>
    </div>
  `;

  $("modalBackdrop").classList.add("show");
}

function closeModal() {
  $("modalBackdrop").classList.remove("show");
}

function renderStatusOptions() {
  const current = $("statusFilter").value || "todos";
  $("statusFilter").innerHTML = '<option value="todos">Todos status</option>';

  Object.keys(DATA.statusCounts).forEach(s => {
    $("statusFilter").insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`);
  });

  $("statusFilter").value = current;
}

function renderAll() {
  updateNetwork();
  renderKPIs();
  renderSmart();
  renderLate();
  renderBairros();
  renderStatusOptions();
  renderClients();
  renderVisits();
  renderCharge();
  renderGoals();
  buildReports();
  renderCommission();
  drawAll();

  $("footerUpdate").textContent = "Atualizado em " + new Date(DATA.updatedAt).toLocaleString("pt-BR");
}

function drawAll() {
  if (!DATA) return;

  drawDoughnut("statusChart", DATA.statusCounts);
  drawBar("bairroBarChart", DATA.bairros.slice(0, 15).map(b => b.bairro), DATA.bairros.slice(0, 15).map(b => b.vendas), true, true);
  drawDoughnut("bairroPieChart", Object.fromEntries(DATA.bairros.slice(0, 8).map(b => [b.bairro, b.clientes])));
  drawBar("weeklyChart", DATA.weekly.map(w => w.semana), DATA.weekly.map(w => w.clientes), false, false);
  drawBar("commissionChart", DATA.salaryWeeks.map(w => w.semana), DATA.salaryWeeks.map(w => w.comissao), false, true);
  drawBar("salaryChart", DATA.salaryWeeks.map(w => w.semana), DATA.salaryWeeks.map(w => w.comissao), false, true);
  drawBar("receivedChart", DATA.weekly.map(w => w.semana), DATA.weekly.map(w => w.recebido), false, true);
}

function drawDoughnut(id, obj) {
  const canvas = $(id);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const h = Number(canvas.getAttribute("height") || 260);
  const w = rect.width || 400;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const values = Object.values(obj);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = ["#C89080", "#10B981", "#F59E0B", "#EF4444", "#2563EB", "#999999"];

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.34;
  let start = -Math.PI / 2;

  values.forEach((v, i) => {
    const angle = v / total * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.arc(cx, cy, r * 0.58, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start += angle;
  });

  ctx.fillStyle = "#111827";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(total, cx, cy + 4);
  ctx.fillStyle = "#777";
  ctx.font = "12px Arial";
  ctx.fillText("clientes", cx, cy + 26);
}

function drawBar(id, labels, values, horizontal = false, moneyFormat = false) {
  const canvas = $(id);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const h = Number(canvas.getAttribute("height") || 300);
  const w = rect.width || 600;
  const max = Math.max(...values, 1);

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (horizontal) {
    const row = h / labels.length;
    labels.forEach((label, i) => {
      const y = i * row + 10;
      const x = 145;
      const bw = (w - x - 80) * (values[i] / max);

      ctx.fillStyle = "#111827";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText(String(label).slice(0, 18), 10, y + 13);

      ctx.fillStyle = "#eadfdb";
      roundRect(ctx, x, y, w - x - 90, 14, 8);
      ctx.fill();

      ctx.fillStyle = "#C89080";
      roundRect(ctx, x, y, bw, 14, 8);
      ctx.fill();

      ctx.fillStyle = "#777";
      ctx.fillText(moneyFormat ? compact(values[i]) : values[i], w - 75, y + 13);
    });
  } else {
    const pad = 38;
    const step = (w - pad * 2) / values.length;
    const barW = step * 0.55;

    values.forEach((v, i) => {
      const bh = (h - pad * 2) * (v / max);
      const x = pad + i * step + (step - barW) / 2;
      const y = h - pad - bh;

      ctx.fillStyle = "#C89080";
      roundRect(ctx, x, y, barW, bh, 8);
      ctx.fill();

      ctx.fillStyle = "#111827";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(moneyFormat ? compact(v) : v, x + barW / 2, y - 7);

      ctx.fillStyle = "#777";
      ctx.font = "11px Arial";
      ctx.fillText(labels[i], x + barW / 2, h - 12);
    });
  }
}

function compact(v) {
  return v >= 1000 ? "R$ " + (v / 1000).toFixed(1) + "k" : money(v);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setup() {
  document.querySelectorAll("#nav button").forEach(btn => {
    btn.onclick = () => setTab(btn.dataset.tab);
  });

  $("syncBtn").onclick = async () => {
    DATA = await loadData();
    renderAll();
    showToast("Dados sincronizados");
  };

  $("clientSearch").oninput = () => {
    page = 1;
    renderClients();
  };

  $("statusFilter").onchange = () => {
    page = 1;
    renderClients();
  };

  $("prevPage").onclick = () => {
    page = Math.max(1, page - 1);
    renderClients();
  };

  $("nextPage").onclick = () => {
    page++;
    renderClients();
  };

  document.querySelectorAll(".chip").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
      chip.classList.add("active");
      currentPriority = chip.dataset.priority;
      renderCharge();
    };
  });

  $("modalBackdrop").onclick = e => {
    if (e.target.id === "modalBackdrop") closeModal();
  };

  setInterval(async () => {
    if (!navigator.onLine) return;
    DATA = await loadData();
    renderAll();
  }, 5 * 60 * 1000);
}

async function init() {
  try {
    DATA = await loadData();
    setup();
    renderAll();
    updateNetwork();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <main style="padding:24px;font-family:Arial">
        <h1>Erro ao carregar Dashboard</h1>
        <p>O app.js agora está limpo, mas não conseguiu ler a planilha nem o fallback JSON.</p>
      </main>
    `;
  }
}

window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);
window.addEventListener("resize", () => setTimeout(drawAll, 100));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

init();
