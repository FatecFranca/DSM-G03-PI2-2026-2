const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const DEFAULT_DATA_FILE = path.join(__dirname, "data", "db.json");
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = new Set(["pix", "card", "on_site"]);

const seed = {
  users: [],
  sessions: [],
  appointments: [],
  establishments: [
    {
      id: "kalon-estetica",
      name: "Clínica Kalon Estética",
      address: "Rua Augusta, 1200 · Consolação, São Paulo",
      services: [
        { id: "limpeza-pele", name: "Limpeza de Pele Profunda", durationMinutes: 75, price: 130 },
        { id: "design-sobrancelha", name: "Design de Sobrancelha", durationMinutes: 30, price: 45 },
        { id: "drenagem", name: "Drenagem Linfática Corporal", durationMinutes: 60, price: 150 },
        { id: "microagulhamento", name: "Microagulhamento Facial", durationMinutes: 60, price: 220 }
      ],
      professionals: [
        { id: "paula-costa", name: "Dra. Paula Costa", specialty: "Esteticista" },
        { id: "renan-souza", name: "Renan Souza", specialty: "Fisioterapeuta" }
      ]
    }
  ]
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function publicUser(user) {
  const { passwordHash, ...result } = user;
  return result;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  });
  response.end(status === 204 ? undefined : JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) {
      throw new HttpError(413, "Corpo da requisição excede 1 MB.");
    }
  }

  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "O corpo da requisição deve ser um objeto JSON.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "JSON inválido.");
  }
}

function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new HttpError(400, `${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return normalized;
}

function makeAppointmentView(appointment, state) {
  const establishment = state.establishments.find(item => item.id === appointment.establishmentId);
  const service = establishment?.services.find(item => item.id === appointment.serviceId);
  const professional = establishment?.professionals.find(item => item.id === appointment.professionalId);
  return {
    ...appointment,
    establishment: establishment ? { id: establishment.id, name: establishment.name } : null,
    service: service ? { id: service.id, name: service.name, durationMinutes: service.durationMinutes, price: service.price } : null,
    professional: professional ? { id: professional.id, name: professional.name } : null
  };
}

function createServer({ dataFile = process.env.KALIX_DATA_FILE || DEFAULT_DATA_FILE } = {}) {
  let state;
  let writeQueue = Promise.resolve();

  const ready = (async () => {
    try {
      state = JSON.parse(await fs.readFile(dataFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = structuredClone(seed);
      await fs.mkdir(path.dirname(dataFile), { recursive: true });
      await fs.writeFile(dataFile, JSON.stringify(state, null, 2));
    }
    for (const key of Object.keys(seed)) state[key] ??= structuredClone(seed[key]);
  })();

  function mutate(operation) {
    const result = writeQueue.then(async () => {
      await ready;
      const value = await operation();
      const temporaryFile = `${dataFile}.${process.pid}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2));
      await fs.rename(temporaryFile, dataFile);
      return value;
    });
    writeQueue = result.catch(() => {});
    return result;
  }

  async function authenticate(request) {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, "Autenticação necessária.");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = state.sessions.find(item => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    const user = session && state.users.find(item => item.id === session.userId);
    if (!user) throw new HttpError(401, "Sessão inválida ou expirada.");
    return user;
  }

  async function handle(request, response) {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    await ready;
    const url = new URL(request.url, "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const method = request.method;

    if (method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok", service: "kalix-api" });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readJson(request);
      const name = requireString(body.name, "Nome", { max: 120 });
      const email = requireString(body.email, "E-mail", { max: 254 }).toLowerCase();
      const password = requireString(body.password, "Senha", { min: 8, max: 200 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, "E-mail inválido.");
      }
      if (state.users.some(user => user.email === email)) {
        throw new HttpError(409, "Já existe uma conta com este e-mail.");
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash,
        role: body.role === "business" ? "business" : "client",
        phone: typeof body.phone === "string" ? body.phone.trim() : "",
        zipCode: typeof body.zipCode === "string" ? body.zipCode.trim() : "",
        gender: typeof body.gender === "string" ? body.gender.trim() : "",
        preferences: Array.isArray(body.preferences) ? body.preferences.filter(item => typeof item === "string") : [],
        createdAt: new Date().toISOString()
      };
      const token = crypto.randomBytes(32).toString("base64url");
      await mutate(() => {
        if (state.users.some(item => item.email === email)) {
          throw new HttpError(409, "Já existe uma conta com este e-mail.");
        }
        state.users.push(user);
        state.sessions.push({
          tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          userId: user.id,
          expiresAt: Date.now() + SESSION_DURATION_MS
        });
      });
      sendJson(response, 201, { token, user: publicUser(user) });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJson(request);
      const email = requireString(body.email, "E-mail", { max: 254 }).toLowerCase();
      const password = requireString(body.password, "Senha", { max: 200 });
      const user = state.users.find(item => item.email === email);
      if (!user) throw new HttpError(401, "E-mail ou senha inválidos.");
      const [salt, expectedHash] = user.passwordHash.split(":");
      const actualHash = await scrypt(password, salt, 64);
      if (!crypto.timingSafeEqual(actualHash, Buffer.from(expectedHash, "hex"))) {
        throw new HttpError(401, "E-mail ou senha inválidos.");
      }
      const token = crypto.randomBytes(32).toString("base64url");
      await mutate(() => {
        state.sessions = state.sessions.filter(session => session.expiresAt > Date.now());
        state.sessions.push({
          tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          userId: user.id,
          expiresAt: Date.now() + SESSION_DURATION_MS
        });
      });
      sendJson(response, 200, { token, user: publicUser(user) });
      return;
    }

    if (method === "GET" && url.pathname === "/api/establishments") {
      const query = (url.searchParams.get("q") || "").toLocaleLowerCase("pt-BR");
      const establishments = state.establishments
        .filter(item => `${item.name} ${item.address}`.toLocaleLowerCase("pt-BR").includes(query))
        .map(({ id, name, address, services }) => ({ id, name, address, services }));
      sendJson(response, 200, { establishments });
      return;
    }

    if (segments[0] === "api" && segments[1] === "establishments" && segments[2]) {
      const establishment = state.establishments.find(item => item.id === segments[2]);
      if (!establishment) throw new HttpError(404, "Estabelecimento não encontrado.");

      if (method === "GET" && segments.length === 3) {
        sendJson(response, 200, { establishment });
        return;
      }

      if (method === "GET" && segments[3] === "availability") {
        const date = url.searchParams.get("date");
        const service = establishment.services.find(item => item.id === url.searchParams.get("serviceId"));
        const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? new Date(`${date}T00:00:00Z`)
          : null;
        if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
          throw new HttpError(400, "Informe uma data válida no formato AAAA-MM-DD.");
        }
        if (!service) throw new HttpError(404, "Serviço não encontrado.");
        const professionals = establishment.professionals.map(professional => {
          const slots = [];
          for (let minute = 9 * 60; minute + service.durationMinutes <= 18 * 60; minute += 30) {
            const startsAt = new Date(`${date}T00:00:00`);
            startsAt.setMinutes(minute);
            const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
            const isBooked = state.appointments.some(appointment => {
              if (appointment.status === "cancelled" || appointment.professionalId !== professional.id) return false;
              const currentStart = new Date(appointment.startsAt);
              const currentService = establishment.services.find(item => item.id === appointment.serviceId);
              const currentEnd = new Date(currentStart.getTime() + (currentService?.durationMinutes || 0) * 60_000);
              return startsAt < currentEnd && endsAt > currentStart;
            });
            if (!isBooked && startsAt > new Date()) slots.push(startsAt.toISOString());
          }
          return { ...professional, slots };
        });
        sendJson(response, 200, { date, serviceId: service.id, professionals });
        return;
      }
    }

    if (method === "GET" && url.pathname === "/api/me") {
      sendJson(response, 200, { user: publicUser(await authenticate(request)) });
      return;
    }

    if (method === "GET" && url.pathname === "/api/appointments") {
      const user = await authenticate(request);
      const appointments = state.appointments
        .filter(item => item.userId === user.id)
        .map(item => makeAppointmentView(item, state));
      sendJson(response, 200, { appointments });
      return;
    }

    if (method === "POST" && url.pathname === "/api/appointments") {
      const user = await authenticate(request);
      const body = await readJson(request);
      const establishment = state.establishments.find(item => item.id === body.establishmentId);
      if (!establishment) throw new HttpError(404, "Estabelecimento não encontrado.");
      const service = establishment.services.find(item => item.id === body.serviceId);
      if (!service) throw new HttpError(404, "Serviço não encontrado.");
      const startsAt = new Date(body.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
        throw new HttpError(400, "Informe uma data e horário futuros válidos.");
      }
      const startMinute = startsAt.getHours() * 60 + startsAt.getMinutes();
      if (startsAt.getMinutes() % 30 !== 0 || startsAt.getSeconds() !== 0 || startsAt.getMilliseconds() !== 0 ||
          startMinute < 9 * 60 || startMinute + service.durationMinutes > 18 * 60) {
        throw new HttpError(400, "O horário deve estar entre 09:00 e 18:00, em intervalos de 30 minutos.");
      }
      if (!PAYMENT_METHODS.has(body.paymentMethod)) {
        throw new HttpError(400, "Forma de pagamento inválida.");
      }
      const professional = establishment.professionals.find(item => item.id === body.professionalId);
      if (!professional) throw new HttpError(400, "Profissional inválido para este estabelecimento.");
      const appointment = {
        id: crypto.randomUUID(),
        userId: user.id,
        establishmentId: establishment.id,
        serviceId: service.id,
        professionalId: professional.id,
        startsAt: startsAt.toISOString(),
        price: service.price,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentMethod === "on_site" ? "due_at_establishment" : "not_processed",
        status: "confirmed",
        createdAt: new Date().toISOString()
      };
      await mutate(() => {
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
        const conflicts = state.appointments.some(item => {
          if (item.status === "cancelled" || item.professionalId !== professional.id) return false;
          const currentStart = new Date(item.startsAt);
          const currentService = state.establishments
            .find(entry => entry.id === item.establishmentId)?.services
            .find(entry => entry.id === item.serviceId);
          const currentEnd = new Date(currentStart.getTime() + (currentService?.durationMinutes || 0) * 60_000);
          return startsAt < currentEnd && endsAt > currentStart;
        });
        if (conflicts) throw new HttpError(409, "Este horário acabou de ser reservado. Escolha outro.");
        state.appointments.push(appointment);
      });
      sendJson(response, 201, { appointment: makeAppointmentView(appointment, state) });
      return;
    }

    if (method === "DELETE" && segments[0] === "api" && segments[1] === "appointments" && segments[2]) {
      const user = await authenticate(request);
      const appointment = state.appointments.find(item => item.id === segments[2] && item.userId === user.id);
      if (!appointment) throw new HttpError(404, "Agendamento não encontrado.");
      if (appointment.status === "cancelled") throw new HttpError(409, "O agendamento já foi cancelado.");
      if (new Date(appointment.startsAt) <= new Date()) throw new HttpError(400, "Não é possível cancelar um horário que já começou.");
      await mutate(() => {
        appointment.status = "cancelled";
        appointment.cancelledAt = new Date().toISOString();
      });
      sendJson(response, 200, { appointment: makeAppointmentView(appointment, state) });
      return;
    }

    throw new HttpError(404, "Rota não encontrada.");
  }

  return http.createServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      sendJson(response, status, { error: status === 500 ? "Erro interno do servidor." : error.message });
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, () => console.log(`Kalix API disponível em http://localhost:${port}`));
}

module.exports = { createServer };