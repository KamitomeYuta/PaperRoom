import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, symlink, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as delay } from 'node:timers/promises'
import { Accounts } from '../lib/auth.ts'

// Use an isolated database and process, including when executed inside the image.
const project = resolve(import.meta.dirname, '..')
const directory = await mkdtemp(join(tmpdir(), 'paper-http-'))
let server
let serverExit
try {
  for (const name of ['.next', 'node_modules', 'package.json', 'public']) {
    await symlink(join(project, name), join(directory, name))
  }
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  const base = 'http://127.0.0.1:' + port
  server = spawn(process.execPath, [
    join(project, 'node_modules/next/dist/bin/next'), 'start',
    '--hostname', '127.0.0.1', '--port', String(port),
  ], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] })
  serverExit = once(server, 'exit')
  let logs = ''
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', chunk => { logs = (logs + chunk).slice(-8000) })
  }
  let started = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Test server exited: ' + logs)
    try {
      const response = await fetch(base + '/api/shop', { signal: AbortSignal.timeout(1000) })
      if (response.ok) { started = true; break }
    } catch {}
    await delay(100)
  }
  assert.ok(started, 'Test server did not become ready: ' + logs)

  function client() {
    let cookie = ''
    return {
      async request(body, query = '', extraHeaders = {}) {
        const response = await fetch(base + '/api/shop' + query, {
          method: body ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...extraHeaders },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(5000),
        })
        const setCookie = response.headers.get('set-cookie')
        if (setCookie) cookie = setCookie.split(';')[0]
        return { status: response.status, data: await response.json() }
      },
      get cookie() { return cookie },
    }
  }
  async function ok(client, body) {
    const result = await client.request(body)
    assert.equal(result.status, 200, 'Expected successful API request')
    return result.data
  }
  async function unchangedAfterDenied(client, body, status, observer) {
    const before = await ok(observer)
    const result = await client.request(body)
    assert.equal(result.status, status, 'Expected permission denial for ' + body.action)
    assert.deepEqual(await ok(observer), before, 'Denied request changed persisted shop data')
  }

  const anonymous = client()
  const alice = client()
  const bob = client()
  const seller = client()
  const password = randomUUID()
  const aliceState = await ok(alice, {
    action: 'register', email: 'alice@example.test', password, role: 'seller',
  })
  assert.equal(aliceState.state.account.role, 'customer', 'Registration must ignore client-supplied role')
  const bobState = await ok(bob, { action: 'register', email: 'bob@example.test', password })
  const db = new DatabaseSync(join(directory, 'data/prints.sqlite'))
  try {
    db.exec('PRAGMA busy_timeout=5000')
    await new Accounts(db).create('seller@example.test', password, 'seller')
  } finally { db.close() }
  await ok(seller, { action: 'login', email: 'seller@example.test', password })
  const order = (await ok(alice, {
    action: 'buy', token: randomUUID(), name: 'Alice',
    lines: [{ sku: '01-A4', qty: 1 }],
  })).order

  for (const body of [
    { action: 'stock', sku: '01-A4', qty: 999, role: 'seller' },
    { action: 'advance', id: order.id, status: 'preparing', role: 'seller' },
  ]) {
    await unchangedAfterDenied(anonymous, body, 401, seller)
    await unchangedAfterDenied(alice, body, 403, seller)
  }
  await unchangedAfterDenied(anonymous, {
    action: 'buy', token: randomUUID(), name: 'Guest', lines: [{sku:'01-A4',qty:1}],
  }, 401, seller)
  await unchangedAfterDenied(seller, {action:'advance',id:order.id,status:'shipped'}, 400, seller)

  const spoofed = await bob.request(undefined,
    '?accountId=' + aliceState.state.account.id + '&role=seller&id=' + order.id)
  assert.equal(spoofed.status, 200)
  assert.deepEqual(spoofed.data.orders, [])
  assert.equal(spoofed.data.account.id, bobState.state.account.id)
  assert.deepEqual((await ok(anonymous)).orders, [])
  assert.equal((await ok(alice)).orders[0].id, order.id)

  await ok(seller, {action:'stock',sku:'01-A4',qty:5})
  await ok(seller, {action:'advance',id:order.id,status:'preparing'})
  const updated = await ok(alice)
  assert.equal(updated.stock['01-A4'], 5)
  assert.equal(updated.orders[0].status, 'preparing')
  assert.deepEqual((await ok(bob)).orders, [])

  const beforeOriginAttack = await ok(seller)
  assert.equal((await seller.request(
    {action:'stock',sku:'01-A4',qty:999}, '', {Origin:'https://attacker.example'},
  )).status, 403)
  assert.deepEqual(await ok(seller), beforeOriginAttack)

  const previousCookie = seller.cookie
  await ok(seller, {action:'logout'})
  const replay = await anonymous.request(
    {action:'stock',sku:'01-A4',qty:999}, '', {Cookie:previousCookie},
  )
  assert.equal(replay.status, 401)
  assert.equal((await ok(alice)).stock['01-A4'], 5)
  console.log('PASS: HTTP role checks, registration role forgery, order isolation, rejected writes, valid seller actions, origin checks and revoked sessions')
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
    const forceStop = setTimeout(() => server.kill('SIGKILL'), 5000)
    await serverExit
    clearTimeout(forceStop)
  }
  await rm(directory, {recursive:true,force:true})
}
