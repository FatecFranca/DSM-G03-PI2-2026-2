import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Crown,
  DoorOpen,
  Instagram,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { api, formatDate, formatMoney } from "./api.js";

const emptySession = { token: "", user: null };
const categories = ["Todos", "Barbearia", "Salão", "Unhas", "Estética"];

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("kalix-session"));
    const token = saved?.token || saved?.access_token;
    if (token && saved?.user) return { token, user: saved.user };
  } catch {
    localStorage.removeItem("kalix-session");
  }
  return emptySession;
}

function Logo({ dark = false }) {
  return (
    <a className={`brand ${dark ? "brand-dark" : ""}`} href="#inicio" aria-label="Kalix, início">
      <span className="brand-mark"><Scissors size={19} strokeWidth={2.2} /></span>
      <span>kalix<span className="brand-dot">.</span></span>
    </a>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.type || "error"}`} role="status">
      {notice.type === "success" ? <Check size={17} /> : <CircleHelp size={17} />}
      <span>{notice.message}</span>
      <button className="icon-button notice-close" onClick={onClose} aria-label="Fechar aviso">
        <X size={16} />
      </button>
    </div>
  );
}

function AuthModal({ onClose, onAuthenticated }) {
  const [accountType, setAccountType] = useState("cliente");
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const account = accountType === "cliente" ? "clientes" : "estabelecimentos";
    const action = registering ? "register" : "login";
    const payload = {
      email: values.email,
      senha: values.senha,
    };
    if (registering && accountType === "cliente") {
      payload.nome_completo = values.nome_completo;
      payload.preferencia_publico = values.preferencia_publico;
    } else if (registering) {
      Object.assign(payload, {
        nome_fantasia: values.nome_fantasia,
        categoria: values.categoria,
        publico_alvo: values.publico_alvo,
        endereco_completo: values.endereco_completo,
        responsavel_nome: values.responsavel_nome,
        responsavel_cpf: values.responsavel_cpf.replace(/\D/g, ""),
        ...(values.cnpj ? { cnpj: values.cnpj.replace(/\D/g, "") } : {}),
      });
    }
    try {
      const session = await api(`/auth/${account}/${action}`, { method: "POST", body: payload });
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`auth-modal ${registering && accountType === "estabelecimento" ? "auth-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <Logo dark />
        <div className="auth-heading">
          <span className="eyebrow">BOM TER VOCÊ AQUI</span>
          <h2 id="auth-title">{registering ? "Crie sua conta." : "Entre no seu mundo."}</h2>
          <p>Um bom momento de cuidado está a poucos passos.</p>
        </div>
        <div className="segmented auth-segmented">
          <button type="button" className={accountType === "cliente" ? "active" : ""} onClick={() => { setAccountType("cliente"); setError(""); }}>
            <UserRound size={16} /> Sou cliente
          </button>
          <button type="button" className={accountType === "estabelecimento" ? "active" : ""} onClick={() => { setAccountType("estabelecimento"); setError(""); }}>
            <Store size={16} /> Tenho um espaço
          </button>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          {registering && accountType === "cliente" && (
            <>
              <label>Seu nome completo<input name="nome_completo" autoComplete="name" minLength="3" maxLength="150" placeholder="Como podemos te chamar?" required /></label>
              <label>O que você está buscando?
                <select name="preferencia_publico" defaultValue="AMBOS">
                  <option value="AMBOS">Todos os estilos</option><option value="MASCULINO">Masculino</option><option value="FEMININO">Feminino</option>
                </select>
              </label>
            </>
          )}
          {registering && accountType === "estabelecimento" && (
            <>
              <label>Nome do estabelecimento<input name="nome_fantasia" minLength="3" maxLength="150" placeholder="Ex.: Estúdio Vértice" required /></label>
              <div className="form-row">
                <label>Categoria<select name="categoria"><option>Barbearia</option><option>Salão</option><option>Unhas</option><option>Estética</option><option>Outro</option></select></label>
                <label>Público<select name="publico_alvo"><option value="AMBOS">Todos</option><option value="MASCULINO">Masculino</option><option value="FEMININO">Feminino</option></select></label>
              </div>
              <label>Endereço<input name="endereco_completo" minLength="10" maxLength="500" placeholder="Rua, número, cidade e estado" required /></label>
              <label>CNPJ <span className="field-hint">opcional, somente números</span><input name="cnpj" inputMode="numeric" minLength="14" maxLength="14" pattern="\d{14}" placeholder="00.000.000/0001-00" /></label>
              <div className="form-divider"><span>Responsável pelo espaço</span></div>
              <div className="form-row">
                <label>Nome do responsável<input name="responsavel_nome" minLength="3" maxLength="150" placeholder="Nome completo" required /></label>
                <label>CPF <span className="field-hint">somente números</span><input name="responsavel_cpf" inputMode="numeric" minLength="11" maxLength="11" pattern="\d{11}" placeholder="00000000000" required /></label>
              </div>
            </>
          )}
          <label>E-mail<input name="email" type="email" autoComplete="email" maxLength="254" placeholder="voce@email.com" required /></label>
          <label>Senha<input name="senha" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength="8" maxLength="128" placeholder="Mínimo de 8 caracteres" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark button-full auth-submit" disabled={busy}>
            {busy ? "Aguarde..." : registering ? "Criar minha conta" : "Entrar"}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>
        <p className="auth-switch">
          {registering ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
          <button onClick={() => { setRegistering(!registering); setError(""); }}>
            {registering ? "Fazer login" : "Criar conta"}
          </button>
        </p>
        <p className="auth-foot"><LockKeyhole size={12} /> Seus dados são protegidos e nunca serão publicados.</p>
      </section>
    </div>
  );
}

function BookingModal({ service, onClose, onSuccess, session, onAuth }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cashback, setCashback] = useState("0");
  const [method, setMethod] = useState("PIX");
  const [dateTime, setDateTime] = useState("");
  const cashbackBalance = Number(session?.user?.saldo_cashback || 0);
  const maxCashback = Math.min(Number(service.preco) * 0.3, cashbackBalance);

  async function submit(event) {
    event.preventDefault();
    if (!session?.token) {
      onClose();
      onAuth();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/agendamentos", {
        method: "POST",
        token: session.token,
        body: {
          id_profissional_servico: service.id_profissional_servico,
          data_hora_inicio: dateTime,
          metodo_pagamento: method,
          cashback_utilizado: Number(cashback || 0).toFixed(2),
        },
      });
      onSuccess();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <span className="eyebrow">UM TEMPO SÓ SEU</span>
        <h2 id="booking-title">Faça sua reserva.</h2>
        <div className="booking-summary">
          <div className="service-icon"><Scissors size={21} /></div>
          <div><strong>{service.nome_servico}</strong><span>{service.nome_estabelecimento} · {service.profissional}</span></div>
          <strong className="booking-price">{formatMoney(service.preco)}</strong>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>Data e horário<input type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required /></label>
          <p className="field-hint availability-note">O espaço confirmará a disponibilidade. O horário fica reservado ao concluir a solicitação.</p>
          <label>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="PIX">PIX</option><option value="CARTAO_CREDITO">Cartão de crédito</option><option value="DINHEIRO">Dinheiro</option></select></label>
          {cashbackBalance > 0 && (
            <label>Usar saldo de cashback <span className="field-hint">Disponível: {formatMoney(cashbackBalance)} · até {formatMoney(maxCashback)}</span>
              <input type="number" min="0" max={maxCashback} step="0.01" value={cashback} onChange={(event) => setCashback(event.target.value)} />
            </label>
          )}
          <div className="booking-total"><span>Você paga</span><strong>{formatMoney(Number(service.preco) - Number(cashback || 0))}</strong></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark button-full" disabled={busy}>{busy ? "Reservando..." : session?.token ? "Confirmar reserva" : "Entre para reservar"}<ArrowRight size={17} /></button>
        </form>
      </section>
    </div>
  );
}

function ServiceCard({ service, index, onBook }) {
  return (
    <article className={`service-card service-card-${index % 3}`}>
      <div className="service-art">
        <div className="art-glow" />
        <Scissors className="art-scissors" size={48} strokeWidth={1.2} />
        <span className="art-number">K.0{index + 1}</span>
        <span className="art-duration"><Clock3 size={13} /> {service.duracao_estimada_minutos} min</span>
      </div>
      <div className="service-card-body">
        <p className="card-kicker">{service.nome_estabelecimento}</p>
        <h3>{service.nome_servico}</h3>
        <p className="service-person"><span className="avatar-dot">{service.profissional.slice(0, 1).toUpperCase()}</span> com {service.profissional}</p>
        <div className="service-card-bottom">
          <span className="service-price">{formatMoney(service.preco)}</span>
          <button className="book-button" onClick={() => onBook(service)} aria-label={`Reservar ${service.nome_servico}`}><ArrowUpRight size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={22} /></span>
      <h3>{title}</h3><p>{description}</p>{action}
    </div>
  );
}

function CustomerBookings({ session, onNotice }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setBookings(await api("/minha-conta/agendamentos", { token: session.token }));
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [onNotice, session.token]);

  useEffect(() => { load(); }, [load]);

  async function cancelBooking(id) {
    setBusyId(id);
    try {
      await api(`/minha-conta/agendamentos/${id}/cancelar`, { method: "PATCH", token: session.token });
      onNotice({ type: "success", message: "Reserva cancelada. O saldo de cashback foi devolvido." });
      await load();
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    } finally {
      setBusyId(null);
    }
  }

  const active = bookings.filter((booking) => booking.status_agendamento === "AGENDADO");
  const past = bookings.filter((booking) => booking.status_agendamento !== "AGENDADO");

  return (
    <section className="account-page" id="minhas-reservas">
      <div className="page-title-row"><div><span className="eyebrow">SEU ESPAÇO, SEMPRE</span><h2>Minhas reservas<span className="brand-dot">.</span></h2><p>Acompanhe tudo com um pouco mais de calma.</p></div><div className="account-chip"><span className="profile-avatar"><UserRound size={18} /></span>{session.user?.nome?.split(" ")[0]}</div></div>
      {loading ? <div className="skeleton-list"><div /><div /></div> : (
        <div className="account-content">
          <section className="booking-list-section"><div className="section-inline-title"><CalendarDays size={17} /><h3>Próximas reservas</h3><span>{active.length}</span></div>
            {active.length ? active.map((item) => <BookingRow key={item.id_agendamento} booking={item} cancellable busy={busyId === item.id_agendamento} onCancel={() => cancelBooking(item.id_agendamento)} />) : <EmptyState icon={CalendarDays} title="Sua agenda ainda está livre." description="Encontre seu próximo momento de cuidado e ele aparece por aqui." />}
          </section>
          {past.length > 0 && <section className="booking-list-section"><div className="section-inline-title"><CheckCheck size={17} /><h3>Histórico</h3><span>{past.length}</span></div>{past.map((item) => <BookingRow key={item.id_agendamento} booking={item} />)}</section>}
        </div>
      )}
    </section>
  );
}

function BookingRow({ booking, cancellable = false, busy = false, onCancel }) {
  const statusNames = { AGENDADO: "Confirmada", CANCELADO: "Cancelada", CONCLUIDO: "Concluída", NO_SHOW: "Não compareceu", BLOQUEIO_MANUAL: "Bloqueio" };
  return (
    <article className="booking-row">
      <div className="booking-date-box"><span>{formatDate(booking.data_hora_inicio, { month: "short" }).replace(".", "")}</span><strong>{formatDate(booking.data_hora_inicio, { day: "2-digit" })}</strong></div>
      <div className="booking-row-main"><strong>{booking.nome_servico || "Atendimento"}</strong><span>{formatDate(booking.data_hora_inicio, { weekday: "long", hour: "2-digit", minute: "2-digit" })}{booking.profissional ? ` · ${booking.profissional}` : ""}</span></div>
      <div className="booking-row-end"><span className={`status-pill status-${booking.status_agendamento.toLowerCase()}`}><span />{statusNames[booking.status_agendamento] || booking.status_agendamento}</span><strong>{booking.valor_final_cobrado == null ? "—" : formatMoney(booking.valor_final_cobrado)}</strong></div>
      {cancellable && <button className="text-button cancel-booking" onClick={onCancel} disabled={busy}>{busy ? "Cancelando..." : "Cancelar"}</button>}
    </article>
  );
}

function Dashboard({ session, onNotice, onLogout }) {
  const [tab, setTab] = useState("visao");
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextStaff, nextServices, nextBookings] = await Promise.all([
        api("/painel/resumo", { token: session.token }),
        api("/painel/profissionais", { token: session.token }),
        api("/painel/servicos", { token: session.token }),
        api("/painel/agendamentos", { token: session.token }),
      ]);
      setSummary(nextSummary);
      setStaff(nextStaff);
      setServices(nextServices);
      setBookings(nextBookings);
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [onNotice, session.token]);

  useEffect(() => { load(); }, [load]);

  async function handleForm(event, path, transform = (data) => data, successMessage = "Alterações salvas.") {
    event.preventDefault();
    setSaving(true);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(path, { method: "POST", token: session.token, body: transform(data) });
      form.reset();
      onNotice({ type: "success", message: successMessage });
      await load();
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/painel/agendamentos/${id}`, { method: "PATCH", token: session.token, body: { status_agendamento: status } });
      onNotice({ type: "success", message: "Status da reserva atualizado." });
      await load();
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    }
  }

  async function toggleStaff(member) {
    try {
      await api(`/painel/profissionais/${member.id_profissional}`, { method: "PATCH", token: session.token, body: { status_ativo: !member.status_ativo } });
      onNotice({ type: "success", message: `Profissional ${member.status_ativo ? "desativado" : "ativado"}.` });
      await load();
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    }
  }

  async function deleteService(item) {
    if (!window.confirm(`Excluir o serviço "${item.nome_servico}"?`)) return;
    try {
      await api(`/painel/servicos/${item.id_profissional_servico}`, { method: "DELETE", token: session.token });
      onNotice({ type: "success", message: "Serviço excluído." });
      await load();
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    }
  }

  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const todayBookings = bookings.filter((item) => item.data_hora_inicio.slice(0, 10) === today && item.status_agendamento !== "CANCELADO");
  const tabs = [
    { id: "visao", label: "Visão geral", icon: LayoutDashboard },
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "equipe", label: "Equipe", icon: UsersRound },
    { id: "servicos", label: "Serviços", icon: Scissors },
  ];

  if (loading) return <section className="account-page"><div className="page-title-row"><div><span className="eyebrow">ÁREA DO ESTABELECIMENTO</span><h2>Seu espaço<span className="brand-dot">.</span></h2></div></div><div className="skeleton-list"><div /><div /><div /></div></section>;

  return (
    <section className="dashboard-wrap">
      <div className="dashboard-heading">
        <div><span className="eyebrow">ÁREA DO ESTABELECIMENTO</span><h2>Bom dia, {session.user?.nome?.split(" ")[0]}<span className="brand-dot">.</span></h2><p>Uma visão clara do que acontece no seu espaço.</p></div>
        <button className="button button-dark" onClick={onLogout}><DoorOpen size={16} /> Sair da conta</button>
      </div>
      <div className="dashboard-shell">
        <aside className="dashboard-nav">
          <div className="dashboard-space"><span className="dashboard-space-icon"><Store size={19} /></span><div><strong>{summary?.estabelecimento?.nome_fantasia}</strong><span>Estabelecimento</span></div><ChevronDown size={16} /></div>
          <span className="dashboard-nav-label">MENU PRINCIPAL</span>
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`dashboard-tab ${tab === id ? "selected" : ""}`} onClick={() => setTab(id)}><Icon size={17} />{label}{id === "agenda" && todayBookings.length > 0 && <span className="nav-count">{todayBookings.length}</span>}</button>)}
          <div className="dashboard-nav-bottom"><div className="nav-tip"><Sparkles size={16} /><strong>Seu próximo nível</strong><span>Um bom atendimento começa com uma agenda organizada.</span></div><button className="dashboard-tab nav-exit" onClick={onLogout}><DoorOpen size={17} />Sair da conta</button></div>
        </aside>
        <div className="dashboard-content">
          {tab === "visao" && <>
            <div className="dashboard-content-title"><div><span className="eyebrow">VISÃO GERAL</span><h3>Seu espaço, em números</h3></div><span className="today-label"><span /> HOJE · {formatDate(new Date(), { day: "2-digit", month: "long" })}</span></div>
            <div className="metric-grid">
              <MetricCard icon={CalendarDays} label="Agendamentos hoje" value={summary?.agendamentos_hoje ?? 0} hint={todayBookings.length ? `${todayBookings.length} atendimento(s) na agenda` : "Sua agenda está livre"} color="purple" />
              <MetricCard icon={UsersRound} label="Profissionais ativos" value={summary?.profissionais_ativos ?? 0} hint="No seu time" color="blue" />
              <MetricCard icon={Wallet} label="Receita do mês" value={formatMoney(summary?.receita_mes)} hint="Atendimentos concluídos" color="green" />
            </div>
            <div className="dashboard-lower-grid">
              <section className="panel-card"><div className="panel-card-heading"><div><span className="eyebrow">AGENDA</span><h3>Próximos atendimentos</h3></div><button className="text-button" onClick={() => setTab("agenda")}>Ver agenda <ArrowRight size={14} /></button></div>
                {bookings.filter((item) => item.status_agendamento === "AGENDADO").slice(0, 4).map((item) => <BookingRow key={item.id_agendamento} booking={item} />)}
                {!bookings.some((item) => item.status_agendamento === "AGENDADO") && <p className="panel-empty">Nenhum atendimento futuro por enquanto.</p>}
              </section>
              <section className="panel-card team-panel"><div className="panel-card-heading"><div><span className="eyebrow">SUA EQUIPE</span><h3>Profissionais</h3></div><span className="mini-count">{staff.length}</span></div>{staff.slice(0, 5).map((member) => <div className="mini-team-row" key={member.id_profissional}><span className="mini-avatar">{member.nome.slice(0, 1)}</span><div><strong>{member.nome}</strong><span>{member.eh_dono ? "Responsável" : "Profissional"}</span></div><span className={`staff-dot ${member.status_ativo ? "active" : ""}`} /></div>)}<button className="button button-outline button-full team-add" onClick={() => setTab("equipe")}><Plus size={15} /> Adicionar profissional</button></section>
            </div>
          </>}
          {tab === "agenda" && <>
            <div className="dashboard-content-title"><div><span className="eyebrow">AGENDA</span><h3>Atendimentos do seu espaço</h3></div></div>
            <div className="panel-card agenda-panel">
              <div className="panel-card-heading"><div><span className="eyebrow">RESERVAS</span><h3>Todos os horários</h3></div><span className="mini-count">{bookings.length}</span></div>
              {!bookings.length && <p className="panel-empty">Ainda não há reservas na agenda.</p>}
              {bookings.map((item) => <div className="dashboard-booking" key={item.id_agendamento}><BookingRow booking={item} />{item.status_agendamento === "AGENDADO" && <div className="booking-actions"><button onClick={() => updateStatus(item.id_agendamento, "CONCLUIDO")}><Check size={14} /> Concluir</button><button className="booking-action-muted" onClick={() => updateStatus(item.id_agendamento, "CANCELADO")}><X size={14} /> Cancelar</button><button className="booking-action-muted" onClick={() => updateStatus(item.id_agendamento, "NO_SHOW")}>Não compareceu</button></div>}</div>)}
            </div>
            <form className="panel-card dashboard-form" onSubmit={(event) => handleForm(event, "/painel/bloqueios", (data) => ({ id_profissional: Number(data.id_profissional), data_hora_inicio: data.data_hora_inicio, data_hora_fim: data.data_hora_fim }), "Horário bloqueado na agenda.")}>
              <div className="panel-card-heading"><div><span className="eyebrow">DISPONIBILIDADE</span><h3>Bloquear horário</h3></div><LockKeyhole size={18} /></div>
              <div className="form-row">
                <label>Profissional<select name="id_profissional" required>{staff.filter((person) => person.status_ativo).map((person) => <option key={person.id_profissional} value={person.id_profissional}>{person.nome}</option>)}</select></label>
                <label>Começa em<input name="data_hora_inicio" type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required /></label>
                <label>Termina em<input name="data_hora_fim" type="datetime-local" required /></label>
              </div>
              <button className="button button-dark" disabled={saving}><Plus size={15} />{saving ? "Salvando..." : "Criar bloqueio"}</button>
            </form>
          </>}
          {tab === "equipe" && <>
            <div className="dashboard-content-title"><div><span className="eyebrow">SUA EQUIPE</span><h3>As pessoas por trás do cuidado</h3></div><span className="mini-count">{staff.length} profissionais</span></div>
            <div className="team-grid">{staff.map((member) => <article className="team-card" key={member.id_profissional}><span className="team-avatar">{member.nome.slice(0, 1)}</span><div><h4>{member.nome}</h4><p>{member.eh_dono ? "Responsável pelo espaço" : "Profissional"}</p></div><span className={`team-status ${member.status_ativo ? "" : "inactive"}`}>{member.status_ativo ? "Ativo" : "Inativo"}</span><button className="text-button" onClick={() => toggleStaff(member)}>{member.status_ativo ? "Desativar" : "Ativar"}</button></article>)}</div>
            <form className="panel-card dashboard-form" onSubmit={(event) => handleForm(event, "/painel/profissionais", (data) => ({ nome: data.nome, cpf: data.cpf.replace(/\D/g, "") }), "Profissional adicionado à sua equipe.")}><div className="panel-card-heading"><div><span className="eyebrow">CRESCER JUNTO</span><h3>Adicionar profissional</h3></div><Plus size={18} /></div><div className="form-row"><label>Nome completo<input name="nome" minLength="3" maxLength="150" placeholder="Nome do profissional" required /></label><label>CPF <span className="field-hint">somente números</span><input name="cpf" inputMode="numeric" minLength="11" maxLength="11" pattern="\d{11}" placeholder="00000000000" required /></label></div><button className="button button-dark" disabled={saving}><Plus size={15} />{saving ? "Salvando..." : "Adicionar à equipe"}</button></form>
          </>}
          {tab === "servicos" && <>
            <div className="dashboard-content-title"><div><span className="eyebrow">CARDÁPIO DE CUIDADOS</span><h3>Serviços do seu espaço</h3></div><span className="mini-count">{services.length} serviços</span></div>
            <div className="dashboard-service-list">{services.map((item) => <div className="dashboard-service-row" key={item.id_profissional_servico}><span className="service-icon"><Scissors size={18} /></span><div><strong>{item.nome_servico}</strong><span>{item.profissional} · {item.duracao_estimada_minutos} min</span></div><strong>{formatMoney(item.preco)}</strong><button type="button" className="icon-button" aria-label={`Excluir ${item.nome_servico}`} title="Excluir serviço" onClick={() => deleteService(item)}><Trash2 size={16} /></button></div>)}{!services.length && <p className="panel-empty">Seus serviços publicados aparecerão aqui.</p>}</div>
            <form className="panel-card dashboard-form" onSubmit={(event) => handleForm(event, "/painel/servicos", (data) => ({ nome_servico: data.nome_servico, descricao: data.descricao || null, duracao_estimada_minutos: Number(data.duracao_estimada_minutos), id_profissional: Number(data.id_profissional), preco: Number(data.preco).toFixed(2) }), "Serviço cadastrado e publicado no catálogo.")}><div className="panel-card-heading"><div><span className="eyebrow">NOVO NO CARDÁPIO</span><h3>Adicionar serviço</h3></div><Plus size={18} /></div><div className="form-row"><label>Nome do serviço<input name="nome_servico" minLength="2" maxLength="100" placeholder="Ex.: Corte clássico" required /></label><label>Profissional<select name="id_profissional" required>{staff.filter((person) => person.status_ativo).map((person) => <option key={person.id_profissional} value={person.id_profissional}>{person.nome}</option>)}</select></label></div><label>Descrição <span className="field-hint">opcional</span><input name="descricao" maxLength="2000" placeholder="Conte um pouco sobre o serviço" /></label><div className="form-row"><label>Duração <span className="field-hint">em minutos, até 480</span><input name="duracao_estimada_minutos" type="number" min="1" max="480" placeholder="30" required /></label><label>Preço <span className="field-hint">em reais</span><input name="preco" type="number" min="0.01" step="0.01" placeholder="45,00" required /></label></div><button className="button button-dark" disabled={saving || !staff.some((person) => person.status_ativo)}><Plus size={15} />{saving ? "Salvando..." : "Cadastrar serviço"}</button>{!staff.some((person) => person.status_ativo) && <p className="field-hint">Adicione um profissional ativo antes de cadastrar serviços.</p>}</form>
          </>}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, hint, color }) {
  return <article className="metric-card"><span className={`metric-icon metric-${color}`}><Icon size={19} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-hint">{hint}</span></article>;
}

function App() {
  const [session, setSession] = useState(readSession);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [view, setView] = useState("discover");
  const [mobileTab, setMobileTab] = useState("home");
  const [services, setServices] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showNotice = useCallback((nextNotice) => {
    setNotice(nextNotice);
    window.clearTimeout(showNotice.timeout);
    showNotice.timeout = window.setTimeout(() => setNotice(null), 5500);
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [catalog, spaces] = await Promise.all([api("/catalogo"), api("/estabelecimentos")]);
      setServices(catalog);
      setEstablishments(spaces);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "discover") return undefined;

    loadCatalog();
    const refreshVisibleCatalog = () => {
      if (document.visibilityState === "visible") loadCatalog();
    };
    document.addEventListener("visibilitychange", refreshVisibleCatalog);
    return () => document.removeEventListener("visibilitychange", refreshVisibleCatalog);
  }, [loadCatalog, view]);

  useEffect(() => {
    if (!session.token) return;
    api("/me", { token: session.token }).then((user) => {
      const refreshed = { ...session, user: { ...session.user, ...user } };
      setSession(refreshed);
      localStorage.setItem("kalix-session", JSON.stringify(refreshed));
    }).catch(() => {
      setSession(emptySession);
      localStorage.removeItem("kalix-session");
      showNotice({ type: "error", message: "Sua sessão expirou. Entre novamente para continuar." });
    });
  // Revalidate only when the token changes; the user object is refreshed from /me.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, showNotice]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return services.filter((service) => {
      const space = establishments.find((item) => item.id_estabelecimento === service.id_estabelecimento);
      const categoryMatch = category === "Todos" || space?.categoria.toLocaleLowerCase("pt-BR") === category.toLocaleLowerCase("pt-BR");
      const termMatch = !term || [service.nome_servico, service.nome_estabelecimento, service.profissional, service.endereco_completo].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
      return categoryMatch && termMatch;
    });
  }, [category, establishments, search, services]);

  function authenticate(nextSession) {
    const normalizedSession = {
      token: nextSession.token || nextSession.access_token,
      user: nextSession.user,
    };
    setSession(normalizedSession);
    localStorage.setItem("kalix-session", JSON.stringify(normalizedSession));
    setAuthOpen(false);
    setView(normalizedSession.user.perfil === "estabelecimento" ? "dashboard" : "discover");
    setMobileTab("home");
    showNotice({ type: "success", message: `Que bom ter você de volta, ${normalizedSession.user.nome.split(" ")[0]}.` });
  }

  function logout() {
    localStorage.removeItem("kalix-session");
    setSession(emptySession);
    setView("discover");
    setMobileTab("home");
    showNotice({ type: "success", message: "Você saiu da sua conta com segurança." });
  }

  function onBookingSuccess() {
    setSelectedService(null);
    setView("bookings");
    setMobileTab("bookings");
    showNotice({ type: "success", message: "Reserva criada! Você já pode acompanhar os detalhes em Minhas reservas." });
  }

  function goToDiscovery(target = "inicio", tab = "home") {
    setView("discover");
    setMobileTab(tab);
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function goToBookings() {
    if (session.user?.perfil === "cliente") {
      setMobileTab("bookings");
      setView("bookings");
    } else {
      setAuthOpen(true);
    }
  }

  const isBusiness = session.user?.perfil === "estabelecimento";

  return (
    <div className="app-shell" id="inicio">
      <header className="site-header">
        <div className="header-inner"><Logo />
          <nav className={`main-nav ${mobileOpen ? "mobile-open" : ""}`} aria-label="Navegação principal">
            <a className={view === "discover" ? "nav-active" : ""} href="#descobrir" onClick={(event) => { event.preventDefault(); setMobileOpen(false); goToDiscovery("descobrir", "explore"); }}>Descobrir</a>
            <a href="#como-funciona" onClick={(event) => { event.preventDefault(); setMobileOpen(false); goToDiscovery("como-funciona"); }}>Como funciona</a>
            {session.user?.perfil === "cliente" && <button className={`nav-link-button ${view === "bookings" ? "nav-active" : ""}`} onClick={() => { setView("bookings"); setMobileTab("bookings"); setMobileOpen(false); }}>Minhas reservas</button>}
            {isBusiness && <button className={`nav-link-button ${view === "dashboard" ? "nav-active" : ""}`} onClick={() => { setView("dashboard"); setMobileOpen(false); }}>Painel do espaço</button>}
          </nav>
          <div className="header-actions">
            {session.user ? <button className="account-chip header-account" onClick={isBusiness ? () => setView("dashboard") : logout}><span className="profile-avatar">{isBusiness ? <Store size={16} /> : <UserRound size={16} />}</span><span>{session.user.nome?.split(" ")[0]}</span><ChevronDown size={14} /></button> : <><button className="login-link" onClick={() => setAuthOpen(true)}>Entrar</button><button className="button button-dark header-cta" onClick={() => setAuthOpen(true)}>Começar agora <ArrowUpRight size={15} /></button></>}
          </div>
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </header>

      <main>
        {view === "discover" && <>
          <section className="hero">
            <div className="hero-main">
              <div className="hero-copy"><span className="hero-badge"><span /> O SEU TEMPO, DO SEU JEITO</span><h1>Não é só sobre<br />ficar bem. É sobre<br /><span>se sentir você.</span></h1><p>Os lugares e profissionais que combinam com você — sem complicar, sem perder tempo.</p><div className="hero-actions"><a className="button button-lime" href="#descobrir">Descobrir meu lugar <ArrowDown size={16} /></a><span className="hero-note"><ShieldCheck size={15} /> Profissionais perto de você</span></div><div className="hero-social-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><div><span className="proof-stars"><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /></span><span className="proof-label">Um novo jeito de se cuidar.</span></div></div></div>
              <div className="hero-visual" aria-label="Ilustração de um profissional no salão">
                <div className="hero-photo-frame"><div className="hero-photo-grain" /><div className="hero-photo-orb" /><div className="hero-person"><div className="person-hair" /><div className="person-face"><div className="person-eye eye-left" /><div className="person-eye eye-right" /><div className="person-nose" /><div className="person-beard" /></div><div className="person-neck" /><div className="person-body" /><div className="person-shirt" /></div><div className="hero-visual-label"><span>ESSÊNCIA, EM CADA DETALHE</span><span>01 / 04</span></div></div>
                <div className="floating-card floating-card-top"><span className="floating-card-icon"><Sparkles size={16} /></span><div><strong>O seu próximo favorito</strong><span>pode estar logo ali</span></div><ArrowUpRight size={15} /></div>
                <div className="floating-card floating-card-bottom"><span className="floating-star"><Star size={17} fill="currentColor" /></span><div><strong>Feito para você</strong><span>Um cuidado por vez.</span></div></div><span className="hero-orbit hero-orbit-one" /><span className="hero-orbit hero-orbit-two" /><span className="hero-visual-coordinate">23°33'01.2"S&nbsp; 46°38'02.3"W</span>
              </div>
              <span className="hero-index">KALIX® · 2026</span>
            </div>
            <div className="hero-ticker"><span>ENCONTRE O SEU LUGAR</span><span className="ticker-star">✳</span><span>VALORIZE O SEU TEMPO</span><span className="ticker-star">✳</span><span>ESCOLHA COM INTENÇÃO</span><span className="ticker-star">✳</span><span className="ticker-ticker-last">ENCONTRE O SEU LUGAR</span></div>
          </section>

          <section className="discovery-section" id="descobrir">
            <div className="discovery-heading"><div><span className="eyebrow">UM UNIVERSO DE CUIDADO</span><h2>Escolha o que faz<br />bem <span>para você.</span></h2></div><p>Não importa o dia, a fase ou o estilo.<br />Tem um lugar esperando por você.</p></div>
            <form className="search-bar" onSubmit={(event) => event.preventDefault()}><Search size={19} /><input aria-label="Buscar serviços ou locais" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Um corte, um lugar, alguém especial..." /><span className="search-divider" /><select aria-label="Categoria de atendimento" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><button type="submit" aria-label="Buscar"><ArrowRight size={19} /></button></form>
            <div className="category-chips">{categories.map((item, index) => <button className={`category-chip ${category === item ? "selected" : ""}`} key={item} onClick={() => setCategory(item)}>{index === 0 ? <Compass size={15} /> : index === 1 ? <Scissors size={15} /> : index === 2 ? <Sparkles size={15} /> : index === 3 ? <Star size={15} /> : <BadgeCheck size={15} />}{item}{category === item && <span className="chip-dot" />}</button>)}</div>
            <div className="results-topline"><div><h3>{search || category !== "Todos" ? "O que encontramos" : "Em destaque"}<span className="results-count">{filteredServices.length.toString().padStart(2, "0")}</span></h3><span>Experiências escolhidas para o seu próximo momento.</span></div><a className="results-sort" href="#descobrir">Explorar tudo <ArrowRight size={15} /></a></div>
            {loadError ? <div className="catalog-error"><div><CircleHelp size={20} /><strong>Ainda não conseguimos carregar os espaços.</strong><p>{loadError}</p></div><button className="button button-dark" onClick={loadCatalog}>Tentar novamente <ArrowRight size={15} /></button></div> : loading ? <div className="service-grid">{[0, 1, 2].map((item) => <div className="service-skeleton" key={item}><div /><span /><span /></div>)}</div> : filteredServices.length ? <div className="service-grid">{filteredServices.slice(0, 9).map((service, index) => <ServiceCard key={service.id_profissional_servico} service={service} index={index} onBook={setSelectedService} />)}</div> : <EmptyState icon={Search} title="Ainda não encontramos esse cuidado." description="Tente outra busca ou escolha uma categoria diferente." action={<button className="text-button" onClick={() => { setSearch(""); setCategory("Todos"); }}>Limpar filtros <ArrowRight size={15} /></button>} />}
            {establishments.length > 0 && !search && category === "Todos" && <div className="spaces-note"><span className="spaces-note-icon"><Store size={16} /></span><span><strong>{establishments.length} {establishments.length === 1 ? "espaço" : "espaços"} pronto{establishments.length === 1 ? "" : "s"} para te receber.</strong> Procure por nome para encontrar o seu próximo lugar.</span><ArrowRight size={17} /></div>}
          </section>

          <section className="manifesto" id="como-funciona"><div className="manifesto-top"><span className="eyebrow">UM BOM MOMENTO MUDA TUDO</span><span className="manifesto-count">02 — 03</span></div><div className="manifesto-copy"><h2>O cuidado não é um luxo.<br /><span>É parte de quem você é.</span></h2><p>A gente acredita que escolher com cuidado é uma forma de se encontrar. Por isso, aproximamos você de quem entende que cada detalhe importa.</p><a href="#descobrir">Comece por você <ArrowRight size={15} /></a></div><div className="manifesto-footer"><span><Sparkles size={14} /> FEITO PARA A SUA MELHOR VERSÃO</span><span>UM POUCO MAIS DE VOCÊ. TODO DIA.</span></div></section>

          <section className="steps-section"><div className="steps-intro"><span className="eyebrow">SIMPLES COMO DEVE SER</span><h2>Três passos.<br /><span>Um momento seu.</span></h2><p>Cuidar de você começa com uma escolha. O resto é com a gente.</p><a href="#descobrir">Encontrar meu lugar <ArrowRight size={15} /></a></div><div className="steps-list"><article><span className="step-num">01</span><span className="step-icon"><Search size={19} /></span><div><h3>Descubra</h3><p>Encontre espaços e profissionais que têm tudo a ver com você.</p></div><ChevronRight size={17} /></article><article><span className="step-num">02</span><span className="step-icon"><CalendarDays size={19} /></span><div><h3>Escolha seu momento</h3><p>Selecione o serviço, combine seu horário e deixe o resto com o espaço.</p></div><ChevronRight size={17} /></article><article><span className="step-num">03</span><span className="step-icon"><Sparkles size={19} /></span><div><h3>Viva a experiência</h3><p>Chegue, respire e aproveite. Esse tempo é seu.</p></div><ChevronRight size={17} /></article></div></section>

          <section className="partner-banner"><div className="partner-orbit" /><div className="partner-graphic"><span className="partner-graphic-mark"><Store size={31} /></span><span className="partner-graphic-ring ring-a" /><span className="partner-graphic-ring ring-b" /><span className="partner-graphic-star">✳</span></div><div className="partner-copy"><span className="eyebrow">VOCÊ TEM UM ESPAÇO?</span><h2>Seu talento merece<br />ser <span>encontrado.</span></h2><p>Apresente seu trabalho para quem está buscando exatamente o que você faz de melhor.</p><button className="button button-lime" onClick={() => setAuthOpen(true)}>Conhecer o painel <ArrowRight size={16} /></button></div><div className="partner-corner">PARA QUEM<br />FAZ ACONTECER ↗</div></section>

          <section className="join-strip"><span className="join-icon"><Crown size={20} /></span><p>Para cada fase. Para cada versão de você. <strong>Kalix encontra o seu lugar.</strong></p><a href="#descobrir">Começar a explorar <ArrowUpRight size={17} /></a></section>
        </>}
        {view === "bookings" && session.user?.perfil === "cliente" && <CustomerBookings session={session} onNotice={showNotice} />}
        {view === "bookings" && !session.user && <section className="account-page"><EmptyState icon={LockKeyhole} title="Entre para ver suas reservas." description="A sua agenda e o seu próximo momento estão te esperando." action={<button className="button button-dark" onClick={() => setAuthOpen(true)}>Entrar na minha conta <ArrowRight size={15} /></button>} /></section>}
        {view === "dashboard" && isBusiness && <Dashboard session={session} onNotice={showNotice} onLogout={logout} />}
      </main>

      {!isBusiness && <nav className="mobile-tab-bar" aria-label="Navegação do aplicativo">
        <button className={mobileTab === "home" ? "active" : ""} onClick={() => goToDiscovery()} aria-current={mobileTab === "home" ? "page" : undefined}>
          <Compass size={20} /><span>Início</span>
        </button>
        <button className={mobileTab === "explore" ? "active" : ""} onClick={() => goToDiscovery("descobrir", "explore")} aria-current={mobileTab === "explore" ? "page" : undefined}>
          <Search size={20} /><span>Explorar</span>
        </button>
        <button className={mobileTab === "bookings" ? "active" : ""} onClick={goToBookings} aria-current={mobileTab === "bookings" ? "page" : undefined}>
          <CalendarDays size={20} /><span>Reservas</span>
        </button>
      </nav>}

      <footer className="site-footer"><div className="footer-top"><div><Logo /><p>Um pouco mais de você.<br />Todo dia.</p></div><div className="footer-links"><div><span>EXPLORE</span><a href="#descobrir" onClick={(event) => { event.preventDefault(); goToDiscovery("descobrir", "explore"); }}>Descobrir</a><a href="#como-funciona" onClick={(event) => { event.preventDefault(); goToDiscovery("como-funciona"); }}>Como funciona</a></div><div><span>FAÇA PARTE</span><button onClick={() => setAuthOpen(true)}>Criar conta</button><button onClick={() => setAuthOpen(true)}>Sou um estabelecimento</button></div><div><span>ENCONTRE A GENTE</span><a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={15} /> Instagram <ArrowUpRight size={12} /></a><a href="mailto:oi@kalix.com.br">Fale com a gente <ArrowUpRight size={12} /></a></div></div></div><div className="footer-bottom"><span>© 2026 KALIX. FEITO COM INTENÇÃO.</span><span><ShieldCheck size={13} /> SUA PRIVACIDADE É PRIORIDADE</span><a href="#inicio">DE VOLTA AO TOPO ↑</a></div></footer>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={authenticate} />}
      {selectedService && <BookingModal service={selectedService} session={session} onClose={() => setSelectedService(null)} onSuccess={onBookingSuccess} onAuth={() => setAuthOpen(true)} />}
    </div>
  );
}

export default App;
