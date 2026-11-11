import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community'
import { supabase } from '@/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

ModuleRegistry.registerModules([AllCommunityModule])
const statuses = ['待联系', '沟通中', '已报价', '已成交', '已关闭']
const pageSize = 10
const gridTheme = themeQuartz.withParams({
  backgroundColor: '#fffefa', foregroundColor: '#1e302b', headerBackgroundColor: '#edf1e5',
  headerTextColor: '#435a4b', borderColor: '#d7dfd2', rowHoverColor: '#edf3e5',
  selectedRowBackgroundColor: '#e4eccf', accentColor: '#527044', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: 14, spacing: 8, wrapperBorder: false, headerFontWeight: 600,
})
type Lead = { id:number; created_at:string; name:string; contact:string; project_type:string; description:string; budget:string; timeline:string; source:string; status:string; quote:string; notes:string }
function Header(){return <header className="border-b"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><a href={import.meta.env.BASE_URL} className="text-xl font-bold tracking-wide">✳ 项目来信</a><a href={import.meta.env.BASE_URL} className="text-sm underline">客户页面 ↗</a></div></header>}
function useMobile(){const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 639px)').matches);useEffect(()=>{const query=window.matchMedia('(max-width: 639px)');const change=()=>setMobile(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);return mobile}

export default function Admin(){
  const [authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState('')
  const [rows,setRows]=useState<Lead[]>([]),[selected,setSelected]=useState<Lead|null>(null),[search,setSearch]=useState(''),[searchTerm,setSearchTerm]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(0),[total,setTotal]=useState(0),[saved,setSaved]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0)
  const mobile=useMobile(), requestId=useRef(0)
  const checkAuth=useCallback(async()=>{try{if(!supabase)throw Error();const {data:allowed,error:authError}=await supabase.rpc('lead_studio_is_admin');if(authError||!allowed){setAuthorized(false);setRows([]);return false}setAuthorized(true);return true}catch{setError('加载失败，请检查云端配置。');return false}finally{setChecking(false)}},[])
  useEffect(()=>{void checkAuth();const listener=supabase?.auth.onAuthStateChange(()=>{setTimeout(()=>void checkAuth(),0)});return()=>listener?.data.subscription.unsubscribe()},[checkAuth])
  useEffect(()=>{const timer=setTimeout(()=>{setPage(0);setSearchTerm(search.trim())},300);return()=>clearTimeout(timer)},[search])
  useEffect(()=>{if(!authorized||!supabase)return;const db=supabase;const id=++requestId.current;setLoading(true);setError('');async function fetchPage(){let query=db!.from('lead_studio_leads').select('*',{count:'exact'}).order('id',{ascending:false}).range(page*pageSize,(page+1)*pageSize-1)
    if(status)query=query.eq('status',status)
    if(searchTerm){const escaped=searchTerm.replace(/[\\%_]/g,'\\$&').replace(/"/g,'\\"');const pattern=`"%${escaped}%"`;query=query.or(['name','contact','description','project_type','source'].map(field=>`${field}.ilike.${pattern}`).join(','))}
    const {data,error:queryError,count}=await query;if(id!==requestId.current)return;if(queryError){setError('加载需求失败，请稍后重试。');setRows([])}else{const countValue=count??0;setTotal(countValue);if(page>0&&page*pageSize>=countValue){setPage(Math.max(0,Math.ceil(countValue/pageSize)-1))}else setRows(data??[])}setLoading(false)}void fetchPage();return()=>{requestId.current++}},[authorized,page,status,searchTerm,revision])
  const columnDefs=useMemo<ColDef<Lead>[]>(()=>[
    {field:'name',headerName:'联系称呼',minWidth:110,flex:1},
    {field:'project_type',headerName:'项目类型',minWidth:110,flex:1,hide:mobile},
    {field:'source',headerName:'来源',minWidth:90,flex:.8,hide:mobile},
    {field:'status',headerName:'状态',minWidth:100,flex:1},
    {field:'created_at',headerName:'提交时间',minWidth:160,flex:1.3,hide:mobile,valueFormatter:params=>params.value?new Date(params.value).toLocaleString('zh-CN'):''},
  ],[mobile])
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected||!supabase)return;setSaved('');const values=Object.fromEntries(new FormData(e.currentTarget));const {error:updateError}=await supabase.from('lead_studio_leads').update(values).eq('id',selected.id);if(updateError){setSaved('保存失败，请重试。');return}setSelected({...selected,status:String(values.status),quote:String(values.quote),notes:String(values.notes)});setRevision(x=>x+1);setSaved('已保存')}
  if(!authorized)return <><Header/><main className="mx-auto max-w-md px-6 py-24"><Card><CardHeader><CardTitle>管理员登录</CardTitle><CardDescription>{checking?'正在检查登录状态…':'请使用已授权的 Supabase 账号登录。'}</CardDescription></CardHeader><CardContent><form onSubmit={async e=>{e.preventDefault();setError('');if(!supabase){setError('尚未配置 Supabase');return}const data=new FormData(e.currentTarget);const {error:loginError}=await supabase.auth.signInWithPassword({email:String(data.get('email')),password:String(data.get('password'))});if(loginError)setError('登录失败，请检查邮箱和密码。');else if(!await checkAuth())setError('登录成功后仍无法进入，请确认此账号已获管理员授权。')}}><FieldGroup><Field><FieldLabel htmlFor="email">邮箱</FieldLabel><Input id="email" name="email" type="email" required autoComplete="username"/></Field><Field><FieldLabel htmlFor="password">密码</FieldLabel><Input id="password" name="password" type="password" required autoComplete="current-password"/></Field><Button disabled={checking}>登录</Button>{error&&<p role="alert">{error}</p>}</FieldGroup></form></CardContent></Card></main></>
  const pageCount=Math.max(1,Math.ceil(total/pageSize))
  return <><Header/><main className="mx-auto max-w-6xl px-6 py-16"><div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm tracking-widest text-muted-foreground">YOUR INBOX</p><h1 className="mt-3 text-4xl font-semibold">需求收件箱.</h1><p className="mt-3 text-muted-foreground">每一个想法，都值得一次认真回应。</p></div><div className="flex items-center gap-3"><Badge variant="secondary">{total} 条{searchTerm||status?'匹配':'项目'}来信</Badge><Button variant="outline" onClick={()=>void supabase?.auth.signOut({scope:'local'})}>退出登录</Button></div></div>
  <div className="mb-4 flex flex-col gap-3 sm:flex-row"><Input aria-label="搜索需求" placeholder="搜索称呼、联系方式或需求" value={search} onChange={e=>setSearch(e.target.value)}/><div className="sm:w-44 sm:shrink-0"><NativeSelect aria-label="按状态筛选" value={status} onChange={e=>{setPage(0);setStatus(e.target.value)}}><NativeSelectOption value="">全部状态</NativeSelectOption>{statuses.map(s=><NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></div></div>
  {error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><Card className="min-w-0"><CardHeader><CardTitle>需求列表</CardTitle><CardDescription>点击一行查看和跟进需求</CardDescription></CardHeader><CardContent className="min-w-0"><div className="lead-grid" style={{height: Math.max(190, Math.min(rows.length, pageSize)*48+54)}}><AgGridReact<Lead> theme={gridTheme} rowData={rows} columnDefs={columnDefs} defaultColDef={{sortable:false,resizable:false}} rowHeight={48} headerHeight={48} loading={loading} localeText={{loadingOoo:'正在加载…',noRowsToShow:'暂无符合条件的来信'}} overlayNoRowsTemplate="暂无符合条件的来信" getRowId={params=>String(params.data.id)} onRowClicked={event=>{if(event.data){setSelected(event.data);setSaved('');if(mobile)requestAnimationFrame(()=>document.getElementById('lead-details')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}))}}} getRowClass={params=>params.data?.id===selected?.id?'lead-row-selected':''}/></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="分页"><span className="text-sm text-muted-foreground" aria-live="polite">共 {total} 条 · 第 {page+1} / {pageCount} 页</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page===0||loading} onClick={()=>setPage(x=>x-1)}>上一页</Button><Button variant="outline" size="sm" disabled={page+1>=pageCount||loading} onClick={()=>setPage(x=>x+1)}>下一页</Button></div></div></CardContent></Card>
  <Card id="lead-details" className="min-w-0"><CardHeader><CardTitle>{selected?`${selected.name} 的项目`:'选择一条来信查看详情'}</CardTitle></CardHeader>{selected&&<CardContent><div className="grid gap-4 sm:grid-cols-2">{[['联系方式',selected.contact],['项目类型',selected.project_type],['预算',selected.budget],['期望时间',selected.timeline],['来源',selected.source],['通知状态','未配置']].map(([a,b])=><div key={a}><p className="text-sm text-muted-foreground">{a}</p><p className="break-words">{b}</p></div>)}</div><div className="my-6 whitespace-pre-wrap break-words border-y py-4">{selected.description}</div><form key={selected.id} onSubmit={save}><FieldGroup><Field><FieldLabel htmlFor="status">跟进状态</FieldLabel><NativeSelect id="status" name="status" defaultValue={selected.status}>{statuses.map(s=><NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="quote">报价</FieldLabel><Input id="quote" name="quote" defaultValue={selected.quote} maxLength={200}/></Field><Field><FieldLabel htmlFor="notes">跟进备注</FieldLabel><Textarea id="notes" name="notes" defaultValue={selected.notes} maxLength={5000}/></Field><Button type="submit">保存跟进</Button><span role="status">{saved}</span></FieldGroup></form></CardContent>}</Card></div></main></>
}
