"use strict";
const nav = document.getElementById("nav");
const content = document.getElementById("content");
const systemMeta = document.getElementById("systemMeta");
const state = { page:"home", info:null, files:null, busy:false };
const pages = [
  {id:"home", icon:"⌂", name:"Pulpit"},
  {id:"files",icon:"▣",name:"Pliki"},
  {id:"terminal",icon:">_",name:"Terminal"},
  {id:"streaming",icon:"◉",name:"Streaming"},
  {id:"library",icon:"▤",name:"Biblioteki"},
  {id:"apps",icon:"▦",name:"Aplikacje"},
  {separator:true},
  {id:"settings",icon:"⚙",name:"Ustawienia"},
  {id:"updates",icon:"⟳",name:"Aktualizacje"},
  {id:"credits",icon:"♥",name:"Podziękowania"}
];
function el(tag, className="", label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
}
function addText(parent, tag, text, className="") {
  const node = el(tag,className,text);
  parent.append(node);
  return node;
}
function button(label, callback, options={}) {
  const b=el("button", options.className||"action",label);
  b.type="button";
  b.disabled=!!options.disabled;
  b.addEventListener("click",callback);
  if (options.aria) b.setAttribute("aria-label",options.aria);
  return b;
}
function section(name) {
  const group=el("section","section");
  addText(group,"h2",name);
  content.append(group);
  return group;
}
function field(group,title,description,right) {
  const row=el("div","field");
  const left=el("div");
  addText(left,"div",title,"label");
  if(description)addText(left,"div",description,"subtitle");
  row.append(left);
  if(right) row.append(right);
  group.append(row);
  return row;
}
function notice(text,warning=false) {
  content.append(el("div",warning?"status alert":"status",text));
}
function renderNav() {
  nav.replaceChildren();
  pages.forEach(item=>{
    if(item.separator){nav.append(el("div","separator"));return;}
    const row=button(item.name,()=>navigate(item.id),{className:"navrow"});
    const icon=el("span","symbol",item.icon);icon.setAttribute("aria-hidden","true");
    row.prepend(icon);
    row.dataset.page=item.id;
    row.classList.toggle("active",state.page===item.id);
    row.setAttribute("aria-current",state.page===item.id?"page":"false");
    nav.append(row);
  });
}
function navigate(page,{focus=false}={}){
  const candidate=pages.find(p=>p.id===page);
  if(!candidate)return;
  state.page=page;
  renderNav();
  renderPage();
  if(focus || document.activeElement===document.body) nav.querySelector('.active')?.focus();
}
function fileItem(item) {
  return button((item.directory?"▣  ":"·  ")+item.name,()=>{
    if(item.directory){void loadFiles(item.path);}
    else {notice("Podgląd plików zostanie dodany później. Teraz przeglądanie jest tylko do odczytu.");}
  },{className:"fileitem"});
}
async function loadFiles(path) {
  state.busy=true;
  state.fileError="";
  renderPage();
  try {
    state.files=await window.steamHub.listFiles(path);
  } catch (error) {
    state.files=null;
    state.fileError=String(error.message||error);
  } finally {
    state.busy=false;
    if(state.page==="files")renderPage();
  }
}
function renderFiles() {
  if(state.fileError) notice(state.fileError,true);
  if(state.busy){notice("Wczytywanie folderu…");return;}
  const files=state.files;
  if(!files){notice("Wczytywanie katalogu domowego.");void loadFiles();return;}
  const group=section("Katalog domowy");
  field(group,"Lokalizacja",files.path);
  if(files.parent)group.append(button("← Wstecz",()=>{void loadFiles(files.parent);}));
  else group.append(button("↻ Odśwież",()=>{void loadFiles(files.path);}));
  const list=el("div","filelist");
  files.items.forEach(item=>list.append(fileItem(item)));
  group.append(list);
  if(!files.items.length) field(group,"Pusty katalog","Brak widocznych plików i podkatalogów.");
  notice("Bezpieczny menedżer plików: obecnie tylko odczyt w katalogu domowym.");
}
function renderHome() {
  notice("SteamHub działa jako samodzielna aplikacja Linux. Nie wymaga Steam ani Decky Loader.");
  const group=section("Stan systemu");
  const info=state.info;
  field(group,"System",info?.platform?.name||"Rozpoznawanie systemu…");
  field(group,"Tryb",info?.platform?.flatpak?"Flatpak":info?.platform?.appImage?"AppImage":"Aplikacja Linux");
  field(group,"Wersja",info?.version||"—");
  field(group,"Terminal","Tymczasowo wyłączony do czasu wyjaśnienia restartów Gaming Mode.");
  const main=section("Funkcje");
  field(main,"Pliki","Przeglądanie katalogu domowego, bez zmian i usuwania.",button("Otwórz",()=>navigate("files")));
  field(main,"Dodatki i integracje","Samodzielne moduły i opcjonalny adapter Decky — rozwijane etapami.",button("Informacje",()=>navigate("apps")));
}
function renderTerminal() {
  notice("Tryb bezpieczny: uruchamianie powłoki jest wyłączone.",true);
  const group=section("Sesje terminala");
  field(group,"Sesje 1, 2, 3","Zaplanowany niezależny moduł PTY. Bez uruchamiania procesów do czasu zakończenia diagnostyki.");
  field(group,"Dlaczego?","W poprzedniej wersji Decky wykryto restarty Steam Gaming Mode. Nowa aplikacja nie dziedziczy tego ryzyka przez automatyczne uruchamianie terminala.");
}
function renderPlaceholder(title,desc){
  notice(desc);
  const group=section(title);
  field(group,"Integracja nieaktywna","Moduł zostanie dodany jako niezależna funkcja. Nie instalujemy innych programów bez Twojej zgody.");
}
async function startInstall() {
  if(state.busy)return;
  state.busy=true;
  renderPage();
  try {
    await window.steamHub.install();
    state.info=await window.steamHub.info();
    notice("SteamHub zainstalowany w menu aplikacji KDE. Dodanie skrótu do Steam będzie osobnym krokiem.");
  } catch(error) {
    notice("Nie udało się zainstalować: "+String(error.message||error),true);
  } finally {
    state.busy=false;
  }
}
function renderSettings() {
  const group=section("Instalacja");
  const info=state.info;
  if(info?.platform?.flatpak){
    notice("SteamHub uruchomiony z Flatpak. Instalację pakietu obsługuje systemowy instalator Discover.");
    field(group,"Wersja",info.version);
  } else if(info?.platform?.appImage){
    field(group,"Instalacja AppImage",
      info.installed?"Skrót aplikacji został utworzony.":"Zapisz aplikację w katalogu użytkownika i dodaj skrót do menu KDE.",
      button(info.installed?"Zainstaluj ponownie":"Zainstaluj SteamHub",()=>{void startInstall();},{disabled:state.busy}));
  } else {
    field(group,"Instalator","Otwórz pakiet SteamHub.flatpak w KDE Discover lub uruchom AppImage.");
  }
  const section2=section("Architektura");
  field(section2,"Niezależny Linux","Podstawowy interfejs i usługi nie importują Decky ani bibliotek Steam.");
  field(section2,"SteamOS / Gaming Mode","Opcjonalne dodanie aplikacji spoza Steam. Adapter nie jest wymagany do pracy Huba.");
  field(section2,"Tryb bezpieczny","Terminal i wykonywanie poleceń systemowych pozostają wyłączone.");
}
function renderUpdates() {
  const group=section("Aktualizacje");
  field(group,"Wydania GitHub","Pobieraj zweryfikowane pliki z oficjalnego repozytorium.",
    button("Otwórz GitHub",()=>{void window.steamHub.releases();}));
  field(group,"Aktualna wersja",state.info?.version||"—");
  field(group,"Instalacja","Dla Flatpak aktualizacje będą dostarczane przez pakiety / docelowe repozytorium; AppImage może być instalowany ponownie jednym kliknięciem.");
}
function renderCredits() {
  const group=section("Podziękowania");
  const entries=[
    ["Electron i Chromium","Fundament samodzielnego interfejsu desktopowego — Electron contributors; licencja MIT/BSD i pozostałe upstream notices."],
    ["Decky Loader","Inspiracja integracją SteamOS i kontrolerów — SteamDeckHomebrew; licencja GPL-2.0. Samodzielna aplikacja nie wymaga Decky."],
    ["xterm.js","Planowany niezależny emulator terminala — xterm.js contributors; MIT. Terminal aktualnie wyłączony."],
    ["TabMaster","Wcześniejsze eksperymenty z integracją biblioteki Steam — Tormak9970 i współtwórcy; GPL-3.0."],
    ["Decky Manager","Wtyczka menedżera plików — Ciphay; BSD-3-Clause. Jej kod nie jest kopiowany do samodzielnej aplikacji."]
  ];
  entries.forEach(([name,desc])=>field(group,name,desc));
  notice("Pełne informacje licencyjne dla wtyczki Decky znajdują się w THIRD_PARTY_NOTICES.md.");
}
function renderPage() {
  content.replaceChildren();
  const item=pages.find(p=>p.id===state.page);
  addText(content,"h1",item?.name||"SteamHub");
  switch(state.page){
    case "home":renderHome();break;
    case "files":renderFiles();break;
    case "terminal":renderTerminal();break;
    case "streaming":renderPlaceholder("Streaming","Decky Sunshine pozostaje osobną integracją. Nie został jeszcze podłączony do samodzielnego Huba.");break;
    case "library":renderPlaceholder("Biblioteki","Unifideck / Heroic pozostają opcjonalnymi źródłami bibliotek. Integracji jeszcze nie uruchomiono.");break;
    case "apps":renderPlaceholder("Aplikacje","Desktop App i pozostałe integracje zostaną połączone przez adaptery bez Decky.");break;
    case "settings":renderSettings();break;
    case "updates":renderUpdates();break;
    case "credits":renderCredits();break;
  }
}
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){event.preventDefault();navigate("home",{focus:true});return;}
  if(event.target instanceof HTMLInputElement)return;
  if(["ArrowDown","ArrowUp"].includes(event.key) && document.activeElement?.classList.contains("navrow")){
    event.preventDefault();
    const items=[...nav.querySelectorAll(".navrow")];
    const current=items.indexOf(document.activeElement);
    items[(current+(event.key==="ArrowDown"?1:items.length-1))%items.length]?.focus();
  }
});
// Controller mapping without depending on SteamInput / Decky. Repeats are
// throttled and D-pad navigation goes through native DOM focus.
let gamepadLastKey="",gamepadLastAt=0;
function tickGamepad(){
  const gp=navigator.getGamepads?.()?.find(Boolean);
  if(gp){
    const pressed=n=>!!gp.buttons[n]?.pressed;
    const vertical=pressed(12)?"ArrowUp":pressed(13)?"ArrowDown":"";
    const horizontal=pressed(14)?"ArrowLeft":pressed(15)?"ArrowRight":"";
    const direction=vertical||horizontal||(pressed(0)?"Enter":pressed(1)?"Escape":"");
    const now=performance.now();
    if(direction && (direction!==gamepadLastKey||now-gamepadLastAt>230)){
      const active=document.activeElement;
      if(direction==="Escape")navigate("home",{focus:true});
      else if(direction==="Enter")active?.click?.();
      else if(active?.classList.contains("navrow")||direction==="ArrowLeft"){
        const items=[...nav.querySelectorAll(".navrow")];
        let at=items.indexOf(active);
        if(at<0)at=items.findIndex(node=>node.classList.contains("active"));
        const delta=direction==="ArrowUp"?-1:1;
        if(direction==="ArrowLeft")items[Math.max(0,at)]?.focus();
        else items[(at+delta+items.length)%items.length]?.focus();
      }else{
        const focusable=[...content.querySelectorAll("button:not(:disabled)")];
        const at=focusable.indexOf(active);
        if(direction==="ArrowRight")focusable[Math.max(0,at)]?.focus();
        else if(focusable.length) focusable[(at+(direction==="ArrowUp"?-1:1)+focusable.length)%focusable.length]?.focus();
      }
      gamepadLastAt=now;
    }
    gamepadLastKey=direction;
  }
  requestAnimationFrame(tickGamepad);
}
(async()=>{
  renderNav();renderPage();
  try{
    state.info=await window.steamHub.info();
    systemMeta.textContent=state.info.platform.name+" · "+state.info.version;
  }catch(err){systemMeta.textContent="Linux · tryb ograniczony";notice(String(err.message||err),true);}
  renderPage();
  nav.querySelector(".active")?.focus();
  requestAnimationFrame(tickGamepad);
})();
