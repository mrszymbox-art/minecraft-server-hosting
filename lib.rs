use serde::{Deserialize,Serialize};
use std::{path::{Path,PathBuf},collections::HashMap,sync::Arc};
use tokio::{process::{Child,Command},io::{AsyncBufReadExt,BufReader},sync::Mutex};
use uuid::Uuid;

#[derive(Clone,Serialize,Deserialize)]
pub struct ServerInfo{
 pub id:String,pub name:String,pub version:String,pub engine:String,pub ram_mb:u32,
 pub max_players:u32,pub motd:String,pub port:u16,pub dir:String,pub running:bool
}
#[derive(Clone,Deserialize)]
struct CreateArgs{name:String,engine:String,version:String,ram_mb:u32,max_players:u32,motd:String,port:u16}

struct Running{child:Child,logs:Arc<Mutex<Vec<String>>>}
type State=Arc<Mutex<HashMap<String,Running>>>;

fn base_dir()->PathBuf{dirs_fallback().join("HOSTINGG").join("servers")}
fn dirs_fallback()->PathBuf{std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(||PathBuf::from("."))}
fn safe(s:&str)->String{s.chars().filter(|c|c.is_ascii_alphanumeric()||*c=='-'||*c=='_').collect()}

async fn json_files()->Result<Vec<ServerInfo>,String>{
 let base=base_dir();tokio::fs::create_dir_all(&base).await.map_err(|e|e.to_string())?;
 let mut out=vec![];let mut rd=tokio::fs::read_dir(&base).await.map_err(|e|e.to_string())?;
 while let Some(e)=rd.next_entry().await.map_err(|e|e.to_string())?{
  if !e.file_type().await.map_err(|e|e.to_string())?.is_dir(){continue}
  let p=e.path().join("hostingg.json");if let Ok(b)=tokio::fs::read(&p).await{
   if let Ok(mut s)=serde_json::from_slice::<ServerInfo>(&b){s.running=false;out.push(s)}
  }
 } Ok(out)
}
async fn save(s:&ServerInfo)->Result<(),String>{
 let p=PathBuf::from(&s.dir).join("hostingg.json");tokio::fs::write(p,serde_json::to_vec_pretty(s).unwrap()).await.map_err(|e|e.to_string())
}

#[tauri::command]
async fn list_servers(state:tauri::State<'_,State>)->Result<Vec<ServerInfo>,String>{
 let mut list=json_files().await?;let running=state.lock().await;
 for s in &mut list{s.running=running.contains_key(&s.id);}Ok(list)
}

#[tauri::command]
async fn create_server(args:CreateArgs)->Result<ServerInfo,String>{
 if args.name.trim().is_empty(){return Err("Nazwa serwera jest pusta".into())}
 if !(1024..=65535).contains(&args.port){return Err("Nieprawidłowy port".into())}
 let id=Uuid::new_v4().to_string();let dir=base_dir().join(format!("{}-{}",safe(&args.name),&id[..8]));
 tokio::fs::create_dir_all(dir.join("plugins")).await.map_err(|e|e.to_string())?;
 tokio::fs::create_dir_all(dir.join("mods")).await.map_err(|e|e.to_string())?;
 let s=ServerInfo{id,name:args.name,version:args.version,engine:args.engine,ram_mb:args.ram_mb,max_players:args.max_players,motd:args.motd,port:args.port,dir:dir.to_string_lossy().into(),running:false};
 save(&s).await?;download_engine(&s).await?;Ok(s)
}

async fn download_engine(s:&ServerInfo)->Result<(),String>{
 let dir=PathBuf::from(&s.dir);let jar=dir.join("server.jar");
 if jar.exists(){return Ok(())}
 let url=match s.engine.as_str(){
  "Paper"=>format!("https://api.papermc.io/v2/projects/paper/versions/{}/builds",s.version),
  "Purpur"=>format!("https://api.purpurmc.org/v2/purpur/{}/latest",s.version),
  "Vanilla"=>format!("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"),
  "Fabric"=>format!("https://meta.fabricmc.net/v2/versions/loader/{}/{}",s.version,"0.16.10"),
  _=>return Err("Nieobsługiwany silnik".into())
 };
 let client=reqwest::Client::new();
 if s.engine=="Paper"{
  let v:serde_json::Value=client.get(url).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
  let build=v["builds"].as_array().and_then(|a|a.last()).ok_or("Brak buildów Paper")?;
  let n=build["build"].as_u64().ok_or("Brak numeru builda")?;
  let u=format!("https://api.papermc.io/v2/projects/paper/versions/{}/builds/{}/downloads/paper-{}-{}.jar",s.version,n,s.version,n);
  download(&client,&u,&jar).await?;
 }else if s.engine=="Purpur"{
  let v:serde_json::Value=client.get(url).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
  let b=v["build"].as_str().unwrap_or("");
  let u=format!("https://api.purpurmc.org/v2/purpur/{}/{}/download",s.version,b);
  download(&client,&u,&jar).await?;
 }else if s.engine=="Vanilla"{
  let m:serde_json::Value=client.get(url).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
  let a=m["versions"].as_array().ok_or("Brak manifestu")?;
  let x=a.iter().find(|x|x["id"].as_str()==Some(&s.version)).ok_or("Nie znaleziono wersji")?;
  let u=x["url"].as_str().ok_or("Brak URL")?;
  let meta:serde_json::Value=client.get(u).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
  let d=meta["downloads"]["server"]["url"].as_str().ok_or("Ta wersja nie ma server.jar")?;
  download(&client,d,&jar).await?;
 }else{
  return Err("Fabric wymaga dodatkowego wyboru wersji loadera; użyj Paper/Vanilla w tej wersji MVP.".into())
 }
 Ok(())
}
async fn download(c:&reqwest::Client,url:&str,path:&Path)->Result<(),String>{
 let mut r=c.get(url).send().await.map_err(|e|e.to_string())?;if !r.status().is_success(){return Err(format!("HTTP {}",r.status()))}
 let mut f=tokio::fs::File::create(path).await.map_err(|e|e.to_string())?;
 while let Some(chunk)=r.chunk().await.map_err(|e|e.to_string())?{tokio::io::AsyncWriteExt::write_all(&mut f,&chunk).await.map_err(|e|e.to_string())?}
 Ok(())
}

#[tauri::command]
async fn start_server(id:String,state:tauri::State<'_,State>)->Result<(),String>{
 let all=json_files().await?;let s=all.into_iter().find(|x|x.id==id).ok_or("Nie znaleziono serwera")?;
 if state.lock().await.contains_key(&id){return Ok(())}
 let dir=PathBuf::from(&s.dir);tokio::fs::write(dir.join("eula.txt"),"eula=true\n").await.map_err(|e|e.to_string())?;
 let props=format!("motd={}\nmax-players={}\nserver-port={}\nonline-mode=true\n",s.motd,s.max_players,s.port);
 tokio::fs::write(dir.join("server.properties"),props).await.map_err(|e|e.to_string())?;
 let java=which_java().await?;
 let mut cmd=Command::new(java);cmd.current_dir(&dir).arg(format!("-Xms{}M",s.ram_mb.min(1024))).arg(format!("-Xmx{}M",s.ram_mb)).arg("-jar").arg("server.jar").arg("nogui").stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
 let mut child=cmd.spawn().map_err(|e|format!("Nie można uruchomić Java: {}",e))?;let out=child.stdout.take().ok_or("Brak stdout")?;let logs=Arc::new(Mutex::new(vec![]));let l=logs.clone();
 tokio::spawn(async move{let mut r=BufReader::new(out).lines();while let Ok(Some(x))=r.next_line().await{let mut a=l.lock().await;a.push(x);if a.len()>500{a.remove(0)}}});
 state.lock().await.insert(id,Running{child,logs});Ok(())
}
async fn which_java()->Result<String,String>{
 for x in ["java","/usr/bin/java","/usr/lib/jvm/default/bin/java"]{if Command::new(x).arg("-version").output().await.is_ok(){return Ok(x.into())}}
 Err("Nie znaleziono Java. Zainstaluj Java 21.".into())
}
#[tauri::command]
async fn stop_server(id:String,state:tauri::State<'_,State>)->Result<(),String>{if let Some(mut r)=state.lock().await.remove(&id){let _=r.child.kill().await;}Ok(())}
#[tauri::command]
async fn restart_server(id:String,state:tauri::State<'_,State>)->Result<(),String>{
    if let Some(mut r)=state.lock().await.remove(&id){let _=r.child.kill().await;}
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    start_server(id,state).await
}
#[tauri::command]
async fn get_logs(id:String,state:tauri::State<'_,State>)->Result<Vec<String>,String>{if let Some(r)=state.lock().await.get(&id){return Ok(r.logs.lock().await.clone())}Ok(vec![])}

#[tauri::command]
async fn search_hangar(query:String)->Result<Vec<serde_json::Value>,String>{
 let u=format!("https://hangar.papermc.io/api/v1/projects?query={}&limit=20",urlencoding::encode(&query));
 let v:serde_json::Value=reqwest::get(u).await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
 Ok(v["result"].as_array().cloned().unwrap_or_default())
}
#[tauri::command]
async fn install_hangar_plugin(id:String,project_id:String)->Result<(),String>{
 let s=json_files().await?.into_iter().find(|x|x.id==id).ok_or("Serwer nie istnieje")?;
 let parts:Vec<&str>=project_id.split('/').collect();if parts.len()!=2{return Err("Nieprawidłowy projekt".into())}
 let u=format!("https://hangar.papermc.io/api/v1/projects/{}/{}",parts[0],parts[1]);
 let v:serde_json::Value=reqwest::get(u).await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
 let vers=v["versions"].as_array().and_then(|a|a.first()).ok_or("Brak wersji")?;
 let url=vers["downloads"]["PAPER"]["downloadUrl"].as_str().or_else(||vers["downloads"]["PAPER"]["externalUrl"].as_str()).ok_or("Brak pliku pluginu")?;
 let name=format!("{}.jar",parts[1]);download(&reqwest::Client::new(),url,&PathBuf::from(&s.dir).join("plugins").join(name)).await
}
#[tauri::command]
async fn search_modrinth(query:String)->Result<Vec<serde_json::Value>,String>{
 let u=format!("https://api.modrinth.com/v2/search?query={}&limit=20&facets=%5B%5B%22project_type%3Amod%22%5D%5D",urlencoding::encode(&query));
 let v:serde_json::Value=reqwest::get(u).await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
 Ok(v["hits"].as_array().cloned().unwrap_or_default())
}
#[tauri::command]
async fn install_modrinth_mod(id:Option<String>,project_id:String)->Result<(),String>{
 let sid=id.ok_or("Wybierz serwer")?;let s=json_files().await?.into_iter().find(|x|x.id==sid).ok_or("Serwer nie istnieje")?;
 let u=format!("https://api.modrinth.com/v2/project/{}/version",project_id);
 let v:Vec<serde_json::Value>=reqwest::get(u).await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
 let file=v.first().and_then(|x|x["files"].as_array()).and_then(|a|a.first()).ok_or("Brak pliku")?;
 let url=file["url"].as_str().ok_or("Brak URL")?;let name=file["filename"].as_str().unwrap_or("mod.jar");
 download(&reqwest::Client::new(),url,&PathBuf::from(&s.dir).join("mods").join(name)).await
}

#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){let state:State=Arc::new(Mutex::new(HashMap::new()));tauri::Builder::default()
 .plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init()).manage(state)
 .invoke_handler(tauri::generate_handler![list_servers,create_server,start_server,stop_server,restart_server,get_logs,search_hangar,install_hangar_plugin,search_modrinth,install_modrinth_mod])
 .run(tauri::generate_context!()).expect("error while running HOSTINGG");}
