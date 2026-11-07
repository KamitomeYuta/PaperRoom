import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { requireRole } from './auth.ts'
import { prints, sizes, price, nextStatus, type Account, type Line, type Order, type Snapshot } from './catalog.ts'

const prices = new Map(prints.flatMap(p => sizes.map(s => [p.id+'-'+s, price(p.base,s)] as const)))
export class InputError extends Error {}
function requireInput(ok:unknown, message:string):asserts ok {
  if (!ok) throw new InputError(message)
}
function readReceipt(value:unknown):Order {
  return {status:'received', ...JSON.parse(String(value))}
}
export class Shop {
  db:DatabaseSync
  constructor(db:DatabaseSync) {
    this.db=db
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS variants(sku TEXT PRIMARY KEY, price INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS inventory(visitor TEXT, sku TEXT, qty INTEGER, PRIMARY KEY(visitor,sku));
      CREATE TABLE IF NOT EXISTS orders(visitor TEXT, token TEXT, receipt TEXT, PRIMARY KEY(visitor,token));`)
    const seed=db.prepare('INSERT OR IGNORE INTO variants VALUES (?,?)')
    for(const [sku,amount] of prices) seed.run(sku,amount)
  }
  read(account:Account|null):Snapshot {
    const stock:Record<string,number> = Object.fromEntries([...prices.keys()].map(k=>[k,12]))
    for(const r of this.db.prepare('SELECT sku,qty FROM inventory WHERE visitor=?').all('shared-shop')) stock[String(r.sku)]=Number(r.qty)
    const orders = account?.role==='seller'
      ? this.db.prepare('SELECT receipt FROM orders JOIN accounts ON accounts.id=orders.visitor ORDER BY orders.rowid DESC').all()
      : account ? this.db.prepare('SELECT receipt FROM orders WHERE visitor=? ORDER BY rowid DESC').all(account.id) : []
    return {account,stock,orders:orders.map(r=>readReceipt(r.receipt))}
  }
  advance(account:Account|null,id:unknown,target:unknown) {
    requireRole(account,'seller')
    requireInput(typeof id==='string','เลขคำสั่งซื้อไม่ถูกต้อง')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const matches=this.db.prepare(`SELECT orders.rowid AS key, receipt FROM orders
        JOIN accounts ON accounts.id=orders.visitor
        WHERE json_extract(receipt,'$.id')=? LIMIT 2`).all(id)
      requireInput(matches.length===1,'ไม่พบคำสั่งซื้อที่ระบุได้ชัดเจน')
      const order=readReceipt(matches[0].receipt)
      const next=nextStatus[order.status]
      requireInput(next && target===next,'สถานะเปลี่ยนไปแล้ว หรือเลือกขั้นตอนไม่ถูกต้อง')
      this.db.prepare("UPDATE orders SET receipt=json_set(receipt,'$.status',?) WHERE rowid=?").run(next,matches[0].key)
      this.db.exec('COMMIT')
    } catch(err) { this.db.exec('ROLLBACK'); throw err }
  }
  edit(sku:string,qty:number) {
    requireInput(prices.has(sku) && Number.isInteger(qty) && qty>=0 && qty<=999,'ระบุจำนวนสต็อก 0–999')
    this.db.prepare('INSERT INTO inventory VALUES (?,?,?) ON CONFLICT(visitor,sku) DO UPDATE SET qty=excluded.qty').run('shared-shop',sku,qty)
  }
  buy(visitor:string,token:string,name:string,lines:Line[]):Order {
    requireInput(typeof token==='string' && token.length>0 && token.length<=80,'รหัสการสั่งซื้อไม่ถูกต้อง')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const saved=this.db.prepare('SELECT receipt FROM orders WHERE visitor=? AND token=?').get(visitor,token)
      if(saved) { this.db.exec('COMMIT'); return readReceipt(saved.receipt) }
      requireInput(typeof name==='string' && name.trim() && name.trim().length<=60,'กรุณาระบุชื่อเล่น')
      requireInput(Array.isArray(lines) && lines.length>0 && lines.length<=12,'ตรวจสอบรายการในตะกร้า')
      const {stock}=this.read(null)
      let total=0
      for(const line of lines) {
        requireInput(line && prices.has(line.sku) && Number.isInteger(line.qty) && line.qty>0,'รายการสินค้าไม่ถูกต้อง')
        requireInput(stock[line.sku]>=line.qty,'สินค้าในสต็อกไม่พอ กรุณาปรับจำนวนในตะกร้า')
        stock[line.sku]-=line.qty
        this.edit(line.sku,stock[line.sku])
        const variant=this.db.prepare('SELECT price FROM variants WHERE sku=?').get(line.sku)!
        total+=Number(variant.price)*line.qty
      }
      const order:Order={status:'received',id:'PR-'+randomUUID().slice(0,8).toUpperCase(), name:name.trim(), lines:lines.map(({sku,qty})=>({sku,qty})),total}
      this.db.prepare('INSERT INTO orders VALUES (?,?,?)').run(visitor,token,JSON.stringify(order))
      this.db.exec('COMMIT')
      return order
    } catch(err) { this.db.exec('ROLLBACK'); throw err }
  }
}
