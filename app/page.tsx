'use client'
import {AccountForm} from './account-form'
import {useEffect,useRef,useState} from 'react'
import {prints,sizes,price,money,nextStatus,statusLabels,type Line,type Order,type Snapshot} from '../lib/catalog'

const styles=['ทั้งหมด','Botanical','Still Life','Abstract']
type Print=typeof prints[number]
type Panel='product'|'cart'|'admin'|'receipt'|'account'|null
function Icon({name,size=18}:{name:string;size?:number}){
 const paths:Record<string,string>={bag:'M5 8h14l1 13H4L5 8zm4 1V6a3 3 0 016 0v3',arrow:'M4 12h15m-6-6 6 6-6 6',grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',close:'m6 6 12 12M18 6 6 18',up:'M6 18 18 6M6 6h12v12',plus:'M5 12h14M12 5v14',chev:'m8 10 4 4 4-4'}
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>
}
function Flower(){return <svg aria-hidden="true" viewBox="0 0 42 42" width="37" height="37"><g transform="translate(21 21)" fill="currentColor">{[0,45,90,135].map(n=><ellipse key={n} rx="5.4" ry="19" transform={'rotate('+n+')'}/>)}</g><circle cx="21" cy="21" r="4" fill="#faf8f1"/></svg>}
function Art({id,className=''}:{id:string;className?:string}){return <img className={'art '+className} src={'/art/'+id+'.svg'} alt={prints.find(p=>p.id===id)?.subtitle}/>}
function cartToken(){ return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('') }
const first=prints[0]
function Hero({open}:{open:()=>void}){
 return <section className="hero"><div className="intro"><span className="eyebrow"><i/> INDEPENDENT PRINT STUDIO</span><h1>Art for<br/><em>slow living.</em></h1><p>ภาพพิมพ์สำหรับมุมโปรดของคุณ<br/>เติมสีสันให้วันธรรมดาด้วยงานศิลปะที่เลือกเอง</p><a className="primary" href="#collection">เลือกชมภาพพิมพ์ <Icon name="arrow"/></a></div><button className="scene" onClick={open} aria-label="ดูภาพพิมพ์ Slow Bloom"><span className="scene-grid"/><span className="frame back"><Art id="03"/></span><span className="frame front"><Art id="01"/></span><span className="caption"><i/> FEATURED PRINT <b>Slow Bloom</b></span><span className="scene-open"><Icon name="up"/></span></button></section>
}
export default function Home(){
 const [state,setState]=useState<Snapshot|null>(null),[err,error]=useState(''),[panel,setPanel]=useState<Panel>(null),[selected,select]=useState<Print>(first),[size,setSize]=useState('A4'),[category,filter]=useState(styles[0]),[sort,setSort]=useState('featured'),[cart,setCart]=useState<Line[]>([]),[ready,setReady]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[order,setOrder]=useState<Order|null>(null),[tab,setTab]=useState('stock'),[token,setToken]=useState(''),[notice,setNotice]=useState('')
 const [checkoutLogin,setCheckoutLogin]=useState(false)
 const account=state?.account
 const seller=account?.role==='seller'
 const dialog=useRef<HTMLDialogElement>(null)
 async function refresh(){const r=await fetch('/api/shop',{cache:'no-store'});if(!r.ok)throw Error('โหลดข้อมูลไม่สำเร็จ');setState(await r.json())}
 useEffect(()=>{refresh().catch(()=>error('โหลดข้อมูลร้านไม่สำเร็จ กรุณารีเฟรชหน้า'));try{const data=JSON.parse(localStorage.getItem('pr-cart')||'{}');if(Array.isArray(data.cart))setCart(data.cart.filter((l:Line)=>l&&prints.some(p=>sizes.some(s=>p.id+'-'+s===l.sku))&&Number.isInteger(l.qty)&&l.qty>0));setToken(data.token||cartToken())}catch{setToken(cartToken())}setReady(true)},[])
 useEffect(()=>{if(ready)localStorage.setItem('pr-cart',JSON.stringify({cart,token}))},[cart,token,ready])
 useEffect(()=>{if(panel&&!dialog.current?.open)dialog.current?.showModal();if(!panel&&dialog.current?.open)dialog.current.close()},[panel])
 function show(next:Panel){error('');setNotice('');setPanel(next)}
 function openOrders(nextPanel:'account'|'admin'){
   show(nextPanel)
   refresh().catch(()=>error('โหลดสถานะล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง'))
 }
 function product(p:Print){select(p);setSize('A4');show('product')}
 function change(sku:string,qty:number){setCart(old=>[...old.filter(l=>l.sku!==sku),...(qty>0?[{sku,qty}]:[])]);setToken(cartToken());error('')}
 const count=cart.reduce((n,l)=>n+l.qty,0)
 function lineInfo(sku:string){const [id,s]=sku.split('-');const p=prints.find(p=>p.id===id)!;return {p,s,cost:price(p.base,s)}}
 const total=cart.reduce((n,l)=>n+lineInfo(l.sku).cost*l.qty,0)
 async function mutate(body:{action:string;[key:string]:unknown}){
   setBusy(true);error('');setNotice('')
   try{const res=await fetch('/api/shop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Error(data.error||'บันทึกไม่สำเร็จ');setState(data.state);if(data.order){setOrder(data.order);setCart([]);setToken(cartToken());setPanel('receipt')}else if(body.action==='advance') setNotice('อัปเดตสถานะคำสั่งซื้อแล้ว');else if(body.action==='stock') setNotice('บันทึกสต็อกแล้ว');else if(body.action==='logout'){setOrder(null);setName('');setCart([]);setToken(cartToken());setPanel(null)}else{setPanel(checkoutLogin&&data.state.account.role==='customer'?'cart':data.state.account.role==='seller'?'admin':'account');setCheckoutLogin(false);setTab('stock')}}
   catch(e){error(e instanceof Error?e.message:'เชื่อมต่อไม่สำเร็จ');await refresh().catch(()=>{})}finally{setBusy(false)}
 }
 function orderCard(o:Order){
   const next=nextStatus[o.status]
   return <article key={o.id}>
     <div className="order-heading"><b>{o.id}{seller?' · '+o.name:''}</b><span className={'order-status '+o.status}>{statusLabels[o.status]}</span></div>
     {o.lines.map((l,i)=><p key={i}>{lineInfo(l.sku).p.name} · {lineInfo(l.sku).s} × {l.qty}</p>)}
     <strong>{money(o.total)}</strong>
     {seller&&next&&<button className="order-action" disabled={busy} onClick={()=>mutate({action:'advance',id:o.id,status:next})}>
       {next==='preparing'?'เริ่มเตรียมสินค้า':'ยืนยันว่าจัดส่งแล้ว'}
     </button>}
   </article>
 }
 const visible=prints.filter(p=>category===styles[0]||p.category===category).sort((a,b)=>sort==='low'?a.base-b.base:sort==='high'?b.base-a.base:0)
 const sku=selected.id+'-'+size,available=state?.stock[sku]??0,already=cart.find(l=>l.sku===sku)?.qty??0
 return <><header><div className="nav"><a className="brand" href="#" aria-label="Paper Room หน้าร้าน"><Flower/>Paper Room<span>®</span></a><nav><a className="active" href="#collection">หน้าร้าน</a>{seller&&<button onClick={()=>{setTab('stock');show('admin')}}><Icon name="grid" size={15}/> หลังร้าน</button>}<button onClick={()=>{setCheckoutLogin(false);openOrders('account')}}>{account?'บัญชีของฉัน':'เข้าสู่ระบบ'}</button></nav><button className="bag" onClick={()=>show('cart')}><Icon name="bag"/>ตะกร้า <b>{count}</b></button></div></header>
 <main><Hero open={()=>product(first)}/>{err&&!panel&&<p role="alert">{err}</p>}<section id="collection"><div className="section-top"><div><span className="eyebrow"><i/> THE COLLECTION</span><h2>ภาพพิมพ์ทั้งหมด<span>({String(visible.length).padStart(2,'0')})</span></h2></div><label className="sort">เรียงตาม <select aria-label="เรียงลำดับ" value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">แนะนำ</option><option value="low">ราคาต่ำไปสูง</option><option value="high">ราคาสูงไปต่ำ</option></select></label></div><div className="filters">{styles.map(c=><button aria-pressed={category===c} key={c} onClick={()=>filter(c)}>{c}</button>)}</div><div className="cards">{visible.map(p=><button className="card" key={p.id} onClick={()=>product(p)}><div className="mount" style={{backgroundColor:p.bg}}><span className="index">Nº {p.id}</span><Art id={p.id}/><span className="add"><Icon name="plus" size={15}/></span></div><div className="meta">{p.category} <span>•</span> ART PRINT</div><div className="details"><h3>{p.name}</h3><strong>{money(p.base)}</strong></div></button>)}</div></section></main><footer><span>Paper Room®</span> Art Print Studio</footer>
 <dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else setPanel(null)}} onClick={e=>{if(e.target===dialog.current&&!busy)setPanel(null)}}><div className="sheet"><button className="close" aria-label="ปิด" disabled={busy} onClick={()=>setPanel(null)}><Icon name="close"/></button>
 {panel==='account'&&(!account?<AccountForm busy={busy} submit={mutate}/>:<><small>{seller?'SELLER':'CUSTOMER'}</small><h2>บัญชีของฉัน</h2><p>{account.email} · {seller?'คนขาย':'ลูกค้า'}</p>{!seller&&<><h3>คำสั่งซื้อของฉัน</h3>{state?.orders.length?state.orders.map(orderCard):<p>ยังไม่มีคำสั่งซื้อ</p>}</>}<button className="primary" disabled={busy} onClick={()=>mutate({action:'logout'})}>ออกจากระบบ</button></>)}
 {panel==='product'&&<><div className="preview" style={{background:selected.bg}}><Art id={selected.id}/></div><small>{selected.category} · ART PRINT</small><h2>{selected.name}</h2><p>{selected.subtitle}</p><label>ขนาดภาพพิมพ์</label><div className="filters">{sizes.map(s=><button key={s} aria-pressed={size===s} onClick={()=>setSize(s)}>{s}</button>)}</div><p>{money(price(selected.base,size))} · {state?'เหลือ '+available+' ชิ้น':'กำลังโหลดสต็อก'}</p><button className="primary wide" disabled={available<=already} onClick={()=>{change(sku,already+1);show('cart')}}>เพิ่มลงตะกร้า <Icon name="bag"/></button></>}
 {panel==='cart'&&<><small>SHOPPING BAG</small><h2>ตะกร้าของคุณ</h2>{!cart.length?<><p>ตะกร้ายังว่างอยู่</p><button className="primary" onClick={()=>{setPanel(null);location.hash='collection'}}>เลือกชมภาพพิมพ์</button></>:<><div>{cart.map(l=>{const {p,s,cost}=lineInfo(l.sku);return <div className="row" key={l.sku}><Art id={p.id}/><div><b>{p.name}</b><small>{s} · {money(cost)}</small><div className="quantity"><button disabled={busy} aria-label="ลดจำนวน" onClick={()=>change(l.sku,l.qty-1)}>−</button>{l.qty}<button disabled={busy||l.qty>=(state?.stock[l.sku]??0)} aria-label="เพิ่มจำนวน" onClick={()=>change(l.sku,l.qty+1)}>+</button></div></div><button className="remove" disabled={busy} onClick={()=>change(l.sku,0)}>ลบ</button></div>})}</div><p className="sum">ยอดรวม <b>{money(total)}</b></p>{!account?<button className="primary wide" onClick={()=>{setCheckoutLogin(true);show('account')}}>เข้าสู่ระบบเพื่อสั่งซื้อ</button>:seller?<p>กรุณาใช้บัญชีลูกค้าเพื่อสั่งซื้อ</p>:<form onSubmit={e=>{e.preventDefault();mutate({action:'buy',token,name,lines:cart})}}><label>ชื่อเล่นสำหรับคำสั่งซื้อ<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อเล่นของคุณ"/></label><button className="primary wide" disabled={busy||!state}>{busy?'กำลังบันทึก…':'ยืนยันคำสั่งซื้อจำลอง'} <Icon name="arrow"/></button></form>}</>}</>}
 {panel==='receipt'&&order&&<><small>ORDER CONFIRMED</small><h2>สั่งซื้อสำเร็จ</h2><p>ขอบคุณ คุณ{order.name}</p><span className="order-status">{statusLabels[order.status]}</span><p className="sum">{order.id}<b>{money(order.total)}</b></p><button className="primary" onClick={()=>openOrders('account')}>ดูคำสั่งซื้อของฉัน <Icon name="arrow"/></button></>}
 {panel==='admin'&&seller&&<><small>STUDIO MANAGEMENT</small><h2>หลังร้าน</h2><p>บัญชีคนขาย · จัดการสต็อกและคำสั่งซื้อของร้าน</p><div className="filters">{['stock','orders'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setNotice('');if(t==='orders')openOrders('admin')}}>{t==='stock'?'จัดการสต็อก':'คำสั่งซื้อ'}</button>)}</div>{!state?<p>กำลังโหลดข้อมูล</p>:tab==='orders'?state.orders.length?state.orders.map(orderCard):<p>ยังไม่มีคำสั่งซื้อ</p>:prints.map(p=><article key={p.id}><b>{p.name}</b>{sizes.map(s=>{const key=p.id+'-'+s;return <form className="stock" key={key+'-'+state.stock[key]} onSubmit={e=>{e.preventDefault();mutate({action:'stock',sku:key,qty:Number(new FormData(e.currentTarget).get('qty'))})}}><label>{s}<input aria-label={'สต็อก '+p.name+' '+s} type="number" min="0" max="999" required defaultValue={state.stock[key]} name="qty"/></label><button disabled={busy}>บันทึก</button></form>})}</article>)}</>}
 {err&&<p role="alert">{err}</p>}{notice&&<p role="status">{notice}</p>}</div></dialog></>
}
