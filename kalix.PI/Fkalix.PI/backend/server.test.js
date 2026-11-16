const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("./server");

test("API cadastra usuário, autentica e permite criar e cancelar agendamento", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kalix-api-"));
  const server = createServer({ dataFile: path.join(directory, "db.json") });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${baseUrl}/api/health`).then(response => response.json());
  assert.equal(health.status, "ok");
  const preflight = await fetch(`${baseUrl}/api/appointments`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.equal(await preflight.text(), "");

  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Maria Silva", email: "MARIA@example.com", password: "senha-segura-123" })
  });
  assert.equal(registration.status, 201);
  const { token, user } = await registration.json();
  assert.equal(user.email, "maria@example.com");
  assert.equal("passwordHash" in user, false);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "maria@example.com", password: "senha-segura-123" })
  });
  assert.equal(login.status, 200);

  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const date = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, "0"), String(start.getDate()).padStart(2, "0")].join("-");
  const availability = await fetch(
    `${baseUrl}/api/establishments/kalon-estetica/availability?date=${date}&serviceId=limpeza-pele`
  );
  assert.equal(availability.status, 200);
  const availableSlots = (await availability.json()).professionals.find(item => item.id === "paula-costa").slots;
  assert.ok(availableSlots.includes(start.toISOString()));

  const bookingRequest = (scheduledStart = start) => fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      establishmentId: "kalon-estetica",
      serviceId: "limpeza-pele",
      professionalId: "paula-costa",
      startsAt: scheduledStart.toISOString(),
      paymentMethod: "pix"
    })
  });
  const earlyStart = new Date(start);
  earlyStart.setHours(8, 30, 0, 0);
  assert.equal((await bookingRequest(earlyStart)).status, 400);
  const bookingResponses = await Promise.all([bookingRequest(), bookingRequest()]);
  assert.deepEqual(bookingResponses.map(response => response.status).sort(), [201, 409]);
  const successfulBooking = bookingResponses.find(response => response.status === 201);
  const { appointment } = await successfulBooking.json();
  assert.equal(appointment.service.name, "Limpeza de Pele Profunda");
  assert.equal(appointment.paymentStatus, "not_processed");

  const cancellation = await fetch(`${baseUrl}/api/appointments/${appointment.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(cancellation.status, 200);
  assert.equal((await cancellation.json()).appointment.status, "cancelled");
});

test("API rejeita cadastro duplicado", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kalix-api-"));
  const server = createServer({ dataFile: path.join(directory, "db.json") });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  });

  const url = `http://127.0.0.1:${server.address().port}/api/auth/register`;
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Maria Silva", email: "maria@example.com", password: "senha-segura-123" })
  };
  const responses = await Promise.all([fetch(url, options), fetch(url, options)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
});