import { NextRequest, NextResponse } from 'next/server'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { Shop, InputError } from '../../../lib/shop'
import { Accounts, AuthError, lifetime, requireRole } from '../../../lib/auth'
export const runtime='nodejs'
const cookie='paper_account'
function connect(){
  mkdirSync('data',{recursive:true})
  const db=new DatabaseSync('data/prints.sqlite')
  return {shop:new Shop(db),accounts:new Accounts(db)}
}
let store:ReturnType<typeof connect>
function database(){return store??=connect()}
function reply(data:unknown,status=200){
  return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
}
export function GET(req:NextRequest){
  const {shop,accounts}=database()
  return reply(shop.read(accounts.current(req.cookies.get(cookie)?.value??'')))
}
export async function POST(req:NextRequest){
  if(!req.headers.get('content-type')?.startsWith('application/json')) return reply({error:'รูปแบบข้อมูลไม่ถูกต้อง'},415)
  const origin=req.headers.get('origin')
  if(origin && origin!==req.nextUrl.protocol+'//'+req.headers.get('host')) return reply({error:'ต้นทางไม่ถูกต้อง'},403)
  const {shop,accounts}=database()
  const token=req.cookies.get(cookie)?.value??''
  try{
    const body=await req.json()
    const options={httpOnly:true,sameSite:'lax' as const,path:'/',secure:req.nextUrl.protocol==='https:'}
    if(body?.action==='register'||body?.action==='login'){
      const account=body.action==='login' ? await accounts.login(body.email,body.password) : await accounts.create(body.email,body.password)
      const response=reply({state:shop.read(account)})
      accounts.revoke(token)
      response.cookies.set(cookie,accounts.issue(account.id),{...options,maxAge:lifetime})
      return response
    }
    if(body?.action==='logout'){
      accounts.revoke(token)
      const response=reply({state:shop.read(null)})
      response.cookies.set(cookie,'',{...options,maxAge:0})
      return response
    }
    const account=accounts.current(token)
    if(body?.action==='stock'){
      requireRole(account,'seller')
      shop.edit(body.sku,body.qty)
    }else if(body?.action==='advance'){
      shop.advance(account,body.id,body.status)
    }else if(body?.action==='buy'){
      const customer=requireRole(account,'customer')
      const order=shop.buy(customer.id,body.token,body.name,body.lines)
      return reply({order,state:shop.read(customer)})
    }else throw new InputError('ไม่พบคำสั่ง')
    return reply({state:shop.read(account)})
  }catch(err){
    if(err instanceof AuthError) return reply({error:err.message},err.status)
    if(err instanceof InputError||err instanceof SyntaxError) return reply({error:err instanceof InputError?err.message:'ข้อมูลไม่ถูกต้อง'},400)
    throw err
  }
}
