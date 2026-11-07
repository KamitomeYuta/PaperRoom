export const prints = [
  { id:'01', name:'Slow Bloom', category:'Botanical', subtitle:'ดอกไม้ในแจกัน', base:390, bg:'#dadbc8' },
  { id:'02', name:'Sunday Market', category:'Still Life', subtitle:'ส้มบนโต๊ะอาหาร', base:350, bg:'#e6d5bb' },
  { id:'03', name:'Blue Hour', category:'Abstract', subtitle:'จังหวะของเส้นสีน้ำเงิน', base:420, bg:'#d2dce0' },
  { id:'04', name:'Garden Notes', category:'Botanical', subtitle:'บันทึกจากสวน', base:390, bg:'#d9d9b9' },
  { id:'05', name:'Soft Geometry', category:'Abstract', subtitle:'รูปทรงในแสงบ่าย', base:350, bg:'#e9cfc5' },
  { id:'06', name:'Morning Ritual', category:'Still Life', subtitle:'กาแฟยามเช้า', base:390, bg:'#d2c7b6' },
]
export const sizes = ['A4','A3'] as const
export type Line = { sku:string; qty:number }
export const statusLabels = {received:'รับออเดอร์แล้ว', preparing:'กำลังเตรียม', shipped:'จัดส่งแล้ว'} as const
export type OrderStatus = keyof typeof statusLabels
export const nextStatus: Record<OrderStatus, OrderStatus|null> = {
  received:'preparing', preparing:'shipped', shipped:null,
}
export type Order = { status:OrderStatus; id:string; name:string; total:number; lines:Line[] }
export type Account = { id:string; email:string; role:"customer"|"seller" }
export type Snapshot = { account:Account|null; stock:Record<string,number>; orders:Order[] }
export const price = (base:number,size:string) => base + (size === 'A3' ? 200 : 0)
export const money = (value:number) => '฿' + value.toLocaleString('th-TH')
