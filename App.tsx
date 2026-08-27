import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity, Box, ChevronRight, CircleStop, CloudDownload, Code2, Cpu,
  Database, FileArchive, Folder, Gamepad2, HardDrive, LayoutDashboard,
  Package, Play, Plus, RefreshCw, Search, Server, Settings, Square,
  Terminal, Trash2, Users, X
} from "lucide-react";

type ServerInfo = {
  id:string; name:string; version:string; engine:string; ram_mb:number;
  max_players:number; motd:string; port:number; dir:string; running:boolean;
};

const engines=["Vanilla","Paper","Purpur","Fabric"];
const versions=["1.21.8","1.21.7","1.21.6","1.21.5","1.21.4","1.21.1","1.20.6","1.20.4","1.19.4","1.18.2"];

function App(){
  const [servers,setServers]=useState<ServerInfo[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [page,setPage]=useState("dashboard");
  const [logs,setLogs]=useState<string[]>([]);
  const [showCreate,setShowCreate]=useState(false);
  const [toast,setToast]=useState("");
  const [query,setQuery]=useState("");
  const [catalog,setCatalog]=useState<any[]>([]);

  const load=async()=>{
    try{const s=await invoke<ServerInfo[]>("list_servers");setServers(s); if(!selected&&s[0])setSelected(s[0].id)}catch(e){setToast(String(e))}
  };
  useEffect(()=>{load()},[]);
  useEffect(()=>{ if(!selected)return; const t=setInterval(async()=>{try{
    const l=await invoke<string[]>("get_logs",{id:selected});setLogs(l.slice(-300));
    const s=await invoke<ServerInfo[]>("list_servers");setServers(s);
  }catch{}} ,1000); return()=>clearInterval(t)},[selected]);

  const current=servers.find(x=>x.id===selected)||null;
  const action=async(cmd:string)=>{
    if(!current)return;
    try{await invoke(cmd,{id:current.id}); await load(); setToast(cmd==="start_server"?"Serwer uruchomiony":cmd==="stop_server"?"Serwer zatrzymany":"Serwer zrestartowany")}
    catch(e){setToast(String(e))}
    setTimeout(()=>setToast(""),2500);
  };

  const installPlugin=async(item:any)=>{
    if(!current)return;
    try{await invoke("install_hangar_plugin",{id:current.id,project_id:item.namespace+"/"+item.slug});setToast("Plugin zainstalowany");}
    catch(e){setToast(String(e))}
    setTimeout(()=>setToast(""),2500);
  };
  const searchPlugins=async()=>{
    try{const r=await invoke<any[]>("search_hangar",{query});setCatalog(r)}catch(e){setToast(String(e))}
  };
  const searchMods=async()=>{
    try{const r=await invoke<any[]>("search_modrinth",{query});setCatalog(r)}catch(e){setToast(String(e))}
  };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon">S</div><div><b>HOSTINGG</b><small>LOCAL SERVER HOST</small></div></div>
      <nav>
        <button className={page==="dashboard"?"active":""} onClick={()=>setPage("dashboard")}><LayoutDashboard/> Dashboard</button>
        <button className={page==="servers"?"active":""} onClick={()=>setPage("servers")}><Server/> Serwery</button>
        <button className={page==="plugins"?"active":""} onClick={()=>setPage("plugins")}><Package/> Pluginy</button>
        <button className={page==="mods"?"active":""} onClick={()=>setPage("mods")}><Box/> Mody</button>
        <button className={page==="files"?"active":""} onClick={()=>setPage("files")}><Folder/> Pliki</button>
      </nav>
      <div className="sidebar-bottom">
        <button onClick={()=>setPage("settings")}><Settings/> Ustawienia</button>
        <div className="system-card"><div className="dot"></div><div><b>Local host</b><small>Gotowy</small></div></div>
      </div>
    </aside>

    <main>
      <header><div><span className="eyebrow">SERVER MANAGEMENT</span><h1>{page==="dashboard"?"Dashboard":page==="servers"?"Serwery":page==="plugins"?"Pluginy":page==="mods"?"Mody":page==="files"?"Pliki":"Ustawienia"}</h1></div>
      <div className="header-actions"><div className="pill"><Activity size={15}/> {servers.filter(s=>s.running).length} online</div><button className="primary" onClick={()=>setShowCreate(true)}><Plus/> Nowy serwer</button></div></header>

      {page==="dashboard" && <Dashboard servers={servers} onSelect={(id)=>{setSelected(id);setPage("servers")}} onCreate={()=>setShowCreate(true)}/>}
      {page==="servers" && <Servers servers={servers} selected={current} logs={logs} onSelect={setSelected} action={action}/>}
      {page==="plugins" && <Catalog kind="plugin" query={query} setQuery={setQuery} catalog={catalog} search={searchPlugins} install={installPlugin} current={current}/>}
      {page==="mods" && <Catalog kind="mod" query={query} setQuery={setQuery} catalog={catalog} search={searchMods} install={async(i)=>{try{await invoke("install_modrinth_mod",{id:current?.id,project_id:i.project_id});setToast("Mod zainstalowany")}catch(e){setToast(String(e))}}} current={current}/>}
      {page==="files" && <Files current={current}/>}
      {page==="settings" && <SettingsPage/>}

      {showCreate && <CreateModal close={()=>setShowCreate(false)} created={async()=>{setShowCreate(false);await load();setPage("servers")}}/>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  </div>
}

function Dashboard({servers,onSelect,onCreate}:{servers:ServerInfo[],onSelect:(id:string)=>void,onCreate:()=>void}){
  const running=servers.filter(s=>s.running).length;
  return <div className="content">
    <div className="hero"><div><span className="eyebrow">WITAJ W SERVERFORGE</span><h2>Twoje serwery.<br/><em>Twoja maszyna.</em></h2><p>Twórz i zarządzaj serwerami Minecraft lokalnie, bez panelu w przeglądarce.</p><button className="primary big" onClick={onCreate}><Plus/> Utwórz serwer</button></div><div className="hero-art"><Gamepad2 size={110}/></div></div>
    <div className="stats">
      <Stat icon={<Server/>} title="Serwery" value={servers.length}/>
      <Stat icon={<Play/>} title="Uruchomione" value={running}/>
      <Stat icon={<Users/>} title="Sloty" value={servers.reduce((a,s)=>a+s.max_players,0)}/>
      <Stat icon={<HardDrive/>} title="RAM" value={`${servers.reduce((a,s)=>a+s.ram_mb,0)/1024} GB`}/>
    </div>
    <div className="section-head"><h3>Twoje serwery</h3><span>{servers.length} projektów</span></div>
    <div className="server-grid">{servers.map(s=><ServerCard key={s.id} s={s} onClick={()=>onSelect(s.id)}/>)}</div>
  </div>
}
function Stat({icon,title,value}:{icon:any,title:string,value:any}){return <div className="stat"><div className="stat-icon">{icon}</div><div><small>{title}</small><strong>{value}</strong></div></div>}
function ServerCard({s,onClick}:{s:ServerInfo,onClick:()=>void}){return <button className="server-card" onClick={onClick}><div className="card-top"><div className="server-logo"><Server/></div><span className={s.running?"status online":"status"}>{s.running?"ONLINE":"OFFLINE"}</span></div><h3>{s.name}</h3><p>{s.engine} {s.version}</p><div className="card-bottom"><span><Users size={14}/> 0/{s.max_players}</span><span>{s.ram_mb/1024} GB RAM</span><ChevronRight/></div></button>}

function Servers({servers,selected,logs,onSelect,action}:{servers:ServerInfo[],selected:ServerInfo|null,logs:string[],onSelect:(id:string)=>void,action:(x:string)=>void}){
 return <div className="content two-col"><div className="server-list panel">{servers.map(s=><button className={selected?.id===s.id?"server-row selected":"server-row"} onClick={()=>onSelect(s.id)} key={s.id}><div className="mini-logo"><Server/></div><div><b>{s.name}</b><small>{s.engine} {s.version}</small></div><span className={s.running?"mini-dot online":"mini-dot"}></span></button>)}{!servers.length&&<div className="empty">Nie masz jeszcze serwerów.</div>}</div>
 {selected?<div className="server-detail"><div className="detail-head"><div><span className="eyebrow">{selected.engine.toUpperCase()} • {selected.version}</span><h2>{selected.name}</h2><p>{selected.motd}</p></div><div className="controls">{selected.running?<><button className="danger" onClick={()=>action("stop_server")}><Square/> Stop</button><button onClick={()=>action("restart_server")}><RefreshCw/> Restart</button></>:<button className="primary" onClick={()=>action("start_server")}><Play/> Start</button>}</div></div>
 <div className="quick-stats"><Stat icon={<Cpu/>} title="RAM" value={`${selected.ram_mb/1024} GB`}/><Stat icon={<Users/>} title="Max players" value={selected.max_players}/><Stat icon={<Terminal/>} title="Port" value={selected.port}/></div>
 <div className="console panel"><div className="panel-title"><span><Terminal/> Konsola</span><span className={selected.running?"status online":"status"}>{selected.running?"RUNNING":"STOPPED"}</span></div><pre>{logs.length?logs.join("\n"):"Serwer nie został jeszcze uruchomiony."}</pre></div></div>:<div className="empty large">Wybierz serwer.</div>}
 </div>
}

function Catalog({kind,query,setQuery,catalog,search,install,current}:{kind:string,query:string,setQuery:(s:string)=>void,catalog:any[],search:()=>void,install:(i:any)=>void,current:ServerInfo|null}){
 return <div className="content"><div className="searchbar"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder={kind==="plugin"?"Szukaj pluginów na Hangar...":"Szukaj modów na Modrinth..."}/><button className="primary" onClick={search}>Szukaj</button></div><div className="catalog">{catalog.map((x,i)=><div className="catalog-card" key={i}><div className="catalog-icon">{kind==="plugin"?<Package/>:<Box/>}</div><div className="catalog-info"><h3>{x.name||x.title}</h3><p>{x.description||"Brak opisu."}</p><small>{x.author||x.team||""}</small></div><button disabled={!current} onClick={()=>install(x)} className="install"><CloudDownload/> Zainstaluj</button></div>)}</div>{!catalog.length&&<div className="empty large">Wyszukaj {kind==="plugin"?"plugin":"mod"}.</div>}</div>
}

function Files({current}:{current:ServerInfo|null}){return <div className="content"><div className="panel file-panel"><div className="panel-title"><span><Folder/> Pliki serwera</span><code>{current?.dir||"Wybierz serwer"}</code></div><div className="file-placeholder"><FileArchive size={52}/><h3>Eksplorator plików</h3><p>Folder serwera jest dostępny lokalnie. Możesz edytować pliki bezpośrednio z menedżera plików systemu.</p></div></div></div>}
function SettingsPage(){return <div className="content"><div className="panel settings-page"><h2>Ustawienia</h2><label>Folder serwerów<input readOnly value="~/HOSTINGG/servers"/></label><label>Java<input readOnly value="Automatyczne wykrywanie systemowej Java"/></label><p className="muted">Konfiguracja jest zapisywana lokalnie. HOSTINGG nie wymaga konta ani zewnętrznego panelu.</p></div></div>}

function CreateModal({close,created}:{close:()=>void,created:()=>void}){
 const [name,setName]=useState("Mój serwer"); const [engine,setEngine]=useState("Paper"); const [version,setVersion]=useState("1.21.8"); const [ram,setRam]=useState(4096); const [players,setPlayers]=useState(20); const [motd,setMotd]=useState("§aWitaj na serwerze!"); const [port,setPort]=useState(25565); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
 const submit=async()=>{setBusy(true);setErr("");try{await invoke("create_server",{name,engine,version,ramMb:ram,maxPlayers:players,motd,port});created()}catch(e){setErr(String(e))}finally{setBusy(false)}};
 return <div className="modal-bg"><div className="modal"><div className="modal-head"><div><span className="eyebrow">NOWY PROJEKT</span><h2>Utwórz serwer</h2></div><button onClick={close}><X/></button></div><div className="form-grid"><label>Nazwa<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Silnik<select value={engine} onChange={e=>setEngine(e.target.value)}>{engines.map(x=><option key={x}>{x}</option>)}</select></label><label>Wersja<select value={version} onChange={e=>setVersion(e.target.value)}>{versions.map(x=><option key={x}>{x}</option>)}</select></label><label>RAM<select value={ram} onChange={e=>setRam(+e.target.value)}><option value="2048">2 GB</option><option value="4096">4 GB</option><option value="6144">6 GB</option><option value="8192">8 GB</option><option value="12288">12 GB</option><option value="16384">16 GB</option></select></label><label>Max graczy<input type="number" min="1" value={players} onChange={e=>setPlayers(+e.target.value)}/></label><label>Port<input type="number" min="1024" max="65535" value={port} onChange={e=>setPort(+e.target.value)}/></label><label className="wide">MOTD<input value={motd} onChange={e=>setMotd(e.target.value)}/></label></div>{err&&<div className="error">{err}</div>}<div className="modal-actions"><button onClick={close}>Anuluj</button><button className="primary" disabled={busy} onClick={submit}>{busy?"Tworzenie...":"Utwórz serwer"}</button></div></div></div>
}
