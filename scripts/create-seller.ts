import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { Accounts } from '../lib/auth.ts'

mkdirSync('data',{recursive:true})
const db=new DatabaseSync('data/prints.sqlite')
try {
  const email=process.argv[2]
  if(!email) throw Error('ระบุอีเมล เช่น npm run seller -- owner@example.com')
  const password=randomBytes(18).toString('base64url')
  const account=await new Accounts(db).create(email,password,'seller')
  console.log('บัญชีคนขาย',account.email,'\nรหัสผ่าน',password)
} catch(error) {
  console.error(error instanceof Error?error.message:'สร้างบัญชีไม่สำเร็จ')
  process.exitCode=1
} finally {db.close()}
