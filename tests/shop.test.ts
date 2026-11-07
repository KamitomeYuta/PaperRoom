import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { Accounts, requireRole } from '../lib/auth.ts'
import { Shop } from '../lib/shop.ts'

test('checkout is atomic, retryable and scoped to a visitor', () => {
  const shop = new Shop(new DatabaseSync(':memory:'))
  const item = { sku: '01-A3', qty: 2 }
  const alice = {id:'alice',email:'alice@example.com',role:'customer'} as const
  const before = shop.read(alice).stock[item.sku]
  const bob = {id:'bob',email:'bob@example.com',role:'customer'} as const
  const order = shop.buy('alice', 'first', 'May', [item])
  assert.equal(order.total, 1180)
  assert.deepEqual(shop.buy('alice', 'first', 'May', [item]), order)
  assert.equal(shop.read(alice).stock[item.sku], before - 2)
  assert.deepEqual(shop.read(bob).orders, [])
  assert.equal(shop.read(bob).stock[item.sku], before - 2)
  assert.throws(() => shop.buy('alice','second','May',[item,{sku:'02-A3',qty:999}]))
  assert.equal(shop.read(alice).stock[item.sku], before - 2)
  assert.throws(() => shop.buy('alice','bad','May',[{...item,qty:-1}]))
  shop.edit(item.sku, 0)
  assert.equal(shop.read(alice).stock[item.sku], 0)
  assert.equal(shop.read(alice).orders.length, 1)
})

test('uses the stored SKU price at checkout', () => {
  const db = new DatabaseSync(':memory:')
  const shop = new Shop(db)
  db.prepare('UPDATE variants SET price = 500 WHERE sku = ?').run('01-A4')
  assert.equal(shop.buy('alice','price','May',[{sku:'01-A4',qty:1}]).total,500)
})

test('account sessions, role boundaries and order ownership', async () => {
  const db=new DatabaseSync(':memory:')
  const accounts=new Accounts(db)
  const shop=new Shop(db)
  const customer=await accounts.create('May@example.com','long-password')
  const seller=await accounts.create('owner@example.com','another-password','seller')
  await assert.rejects(accounts.login(customer.email,'incorrect'))
  assert.deepEqual(await accounts.login('MAY@example.com','long-password'),customer)
  const token=accounts.issue(customer.id)
  assert.deepEqual(accounts.current(token),customer)
  assert.throws(()=>requireRole(accounts.current(customer.id),'seller'),{status:401})
  assert.throws(()=>requireRole(accounts.current(token),'seller'),{status:403})
  assert.throws(()=>requireRole(seller,'customer'),{status:403})
  const receipt=shop.buy(customer.id,'demo','May',[{sku:'01-A4',qty:1}])
  assert.deepEqual(shop.read(seller).orders,[receipt])
  assert.deepEqual(shop.read(null).orders,[])
  accounts.revoke(token)
  assert.equal(accounts.current(token),null)
})

test('only sellers can advance an order one step and legacy orders start as received', async () => {
  const db = new DatabaseSync(':memory:')
  const shop = new Shop(db)
  const accounts = new Accounts(db)
  const buyer = await accounts.create('buyer@example.com','long-password')
  const seller = await accounts.create('seller@example.com','long-password','seller')
  const lines = [{sku:'01-A4',qty:1}]
  const created = shop.buy(buyer.id,'test','May',lines)
  assert.equal(created.status,'received')
  db.prepare("UPDATE orders SET receipt=json_remove(receipt,'$.status')").run()
  assert.equal(shop.read(buyer).orders[0].status,'received')
  assert.throws(()=>shop.advance(null,created.id,'preparing'),{status:401})
  assert.throws(()=>shop.advance(buyer,created.id,'preparing'),{status:403})
  assert.throws(()=>shop.advance(seller,created.id,'shipped'))
  shop.advance(seller,created.id,'preparing')
  assert.equal(shop.read(buyer).orders[0].status,'preparing')
  assert.throws(()=>shop.advance(seller,created.id,'preparing'))
  shop.advance(seller,created.id,'shipped')
  assert.throws(()=>shop.advance(seller,created.id,'received'))
  assert.equal(shop.buy(buyer.id,'test','May',lines).status,'shipped')
  assert.equal(shop.read(seller).stock['01-A4'],11)
  db.close()
})
