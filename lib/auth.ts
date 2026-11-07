import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Account } from './catalog.ts'

const derive = promisify(scrypt)
const digest = (token:string) => createHash('sha256').update(token).digest('hex')
export const lifetime = 7 * 24 * 60 * 60

export class AuthError extends Error {
  status:number
  constructor(message:string,status:number) {super(message);this.status=status}
}
export class Accounts {
  db:DatabaseSync
  constructor(db:DatabaseSync) {
    this.db=db
    db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','seller')),
      salt TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);`)
  }
  async create(email:string,password:string,role:Account['role']='customer'):Promise<Account> {
    if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim()))
      throw new AuthError('กรุณาระบุอีเมลให้ถูกต้อง',400)
    if(typeof password!=='string'||password.length<10||password.length>128)
      throw new AuthError('ใช้รหัสผ่าน 10–128 ตัวอักษร',400)
    const account={id:randomUUID(), email:email.trim().toLowerCase(),role}
    const salt=randomBytes(16).toString('hex')
    const hash=await derive(password,salt,64) as Buffer
    const result=this.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING').run(account.id,account.email,role,salt,hash.toString('hex'))
    if(!result.changes) throw new AuthError('อีเมลนี้ใช้สมัครบัญชีไม่ได้',409)
    return account
  }
  async login(email:string,password:string):Promise<Account> {
    const denied=new AuthError('อีเมลหรือรหัสผ่านไม่ถูกต้อง',401)
    if(typeof email!=='string'||typeof password!=='string'||password.length>128) throw denied
    const row=this.db.prepare('SELECT * FROM accounts WHERE email=?').get(email.trim().toLowerCase())
    const hash=await derive(password,String(row?.salt??'invalid-account'),64) as Buffer
    if(!row||!timingSafeEqual(hash,Buffer.from(String(row.password_hash),'hex'))) throw denied
    return {id:String(row.id),email:String(row.email),role:row.role as Account['role']}
  }
  issue(id:string) {
    const token=randomBytes(32).toString('hex')
    this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now())
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),id,Date.now()+lifetime*1000)
    return token
  }
  current(token:string):Account|null {
    if(!token) return null
    const row=this.db.prepare('SELECT a.id,a.email,a.role FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.digest=? AND s.expires>?').get(digest(token),Date.now())
    return row ? {id:String(row.id),email:String(row.email),role:row.role as Account['role']} : null
  }
  revoke(token:string) {this.db.prepare('DELETE FROM sessions WHERE digest=?').run(digest(token))}
}
export function requireRole(account:Account|null,role:Account['role']):Account {
  if(!account) throw new AuthError('กรุณาเข้าสู่ระบบ',401)
  if(account.role!==role) throw new AuthError('บัญชีนี้ไม่มีสิทธิ์ทำรายการ',403)
  return account
}
