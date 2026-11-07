'use client'
import {useState} from 'react'
export function AccountForm({busy,submit}:{busy:boolean;submit:(data:{action:string;email:string;password:string})=>void}){
  const [register,setRegister]=useState(false)
  return <><small>PAPER ROOM</small><h2>{register?'สมัครบัญชีลูกค้า':'เข้าสู่ระบบ'}</h2>
    <form onSubmit={e=>{
      e.preventDefault()
      const data=new FormData(e.currentTarget)
      submit({action:register?'register':'login',email:String(data.get('email')),password:String(data.get('password'))})
    }}>
      <label>อีเมล<input required type="email" name="email" autoComplete="username" maxLength={254}/></label>
      <label>รหัสผ่าน<input required type="password" name="password" minLength={register?10:1} maxLength={128} autoComplete={register?'new-password':'current-password'}/></label>
      {register&&<p>ใช้รหัสผ่านอย่างน้อย 10 ตัวอักษร</p>}
      <button className="primary wide" disabled={busy}>{register?'สร้างบัญชีลูกค้า':'เข้าสู่ระบบ'}</button>
    </form><button className="auth-switch" disabled={busy} onClick={()=>setRegister(!register)}>{register?'มีบัญชีแล้ว · เข้าสู่ระบบ':'ยังไม่มีบัญชี · สมัครเป็นลูกค้า'}</button></>
}
