import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9365;
const BASE = `http://127.0.0.1:${PORT}`;
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_shot_tuner3");
const OUT = "C:\\xampp\\htdocs\\Proyecto_ClubPingui\\docs\\presentacion_avances\\img";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new","--no-proxy-server","--no-first-run","--no-default-browser-check","--mute-audio","--hide-scrollbars","--force-device-scale-factor=1","--user-data-dir="+PROFILE,"--remote-debugging-port="+PORT,"--window-size=1600,900","about:blank"], { stdio: "ignore" });
let ws, nextId = 0; const pending = new Map(); const logs = [];
const cdp = (method, params) => new Promise((res, rej) => { const id=++nextId; pending.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params:params||{}})); });
const ev = async (expression) => { const r = await cdp("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true}); return r.exceptionDetails ? {exc:r.exceptionDetails.exception?.description||r.exceptionDetails.text} : r.result?.value; };
const waitFor = async (expr,t=20000)=>{const t0=Date.now();while(Date.now()-t0<t){if(await ev(expr)===true)return true;await sleep(250);}return false;};
async function main(){
  let v=null; for(let i=0;i<50&&!v;i++){try{v=await(await fetch(BASE+"/json/version")).json();}catch{await sleep(250);}}
  const target=await(await fetch(BASE+"/json/new?"+encodeURIComponent("about:blank"),{method:"PUT"})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener("open",res,{once:true});ws.addEventListener("error",rej,{once:true});});
  ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result);return;}if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")logs.push((m.params.args||[]).map(a=>a.value??a.description??"").join(" ").slice(0,200));if(m.method==="Runtime.exceptionThrown")logs.push("EXC "+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text||"").slice(0,200));});
  await cdp("Page.enable");await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride",{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
  await cdp("Page.navigate",{url:"http://localhost:3000/debug/weapontune.html"});
  await waitFor("!!window.__tuner",20000);
  for (const id of ["escudo","maza","minigun","espada"]) {
    await ev(`(()=>{const s=document.getElementById('weapon');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));return 1;})()`);
    await sleep(1200);
    await ev(`(()=>{document.getElementById('autoRotate').checked=false;const st=document.getElementById('stage');const o={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:600,clientY:450,button:0,buttons:1};st.dispatchEvent(new PointerEvent('pointerdown',o));st.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:505,clientY:450}));st.dispatchEvent(new PointerEvent('pointerup',{...o,clientX:505,clientY:450,buttons:0}));return 1;})()`);
    await sleep(900);
    const state = await ev("window.__tuner.state()");
    const r = await cdp("Page.captureScreenshot",{format:"png",fromSurface:true});
    writeFileSync(join(OUT,`20-tuner-${id}.png`),Buffer.from(r.data,"base64"));
    console.log("SHOT 20-tuner-"+id+" "+JSON.stringify(state));
  }
  console.log("logs="+JSON.stringify([...new Set(logs)]));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
