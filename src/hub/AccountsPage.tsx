import { useEffect, useRef, useState } from "react";
import {
  DialogBody, DialogButton, DialogControlsSection, Field, Focusable,
  NavEntryPositionPreferences
} from "@decky/ui";
import { GamepadScrollArea } from "./GamepadScrollArea";
import {
  epicStatus, startEpicLogin, epicDownloadQueue
} from "./epicTestBridge";
import type { EpicQueueItem } from "./epicTestBridge";

export function AccountsPage({ installed }: {
  installed: { name: string; disabled: boolean }[];
}) {
  const engine = installed.find(item=>item.name.toLowerCase()==="unifideck");
  const available = !!engine && !engine.disabled;
  const [connected,setConnected] = useState<boolean|null>(null);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [queue,setQueue] = useState<EpicQueueItem[]|null>(null);
  const mounted=useRef(true);
  const working=useRef(false);

  async function refresh() {
    if(!available||working.current)return;
    working.current=true;setBusy(true);setError("");
    try{
      const state=await epicStatus();
      if(mounted.current)setConnected(state.available?state.connected:null);
    }catch {
      if(mounted.current){setConnected(null);setError("Nie można odczytać stanu Epic.");}
    }finally{working.current=false;if(mounted.current)setBusy(false);}
  }
  useEffect(()=>{
    mounted.current=true;
    if(available)void refresh();
    else{setConnected(null);setQueue(null);setError("");}
    return ()=>{mounted.current=false;};
  },[available]);

  async function login() {
    if(!available||working.current)return;
    working.current=true;setBusy(true);setError("");setMessage("");
    try {
      const result=await startEpicLogin();
      if(!mounted.current)return;
      if(result==="connected"){
        setConnected(true);
        setMessage("Epic jest już połączony. Odśwież stan, aby potwierdzić.");
      }else {
        setMessage("Uruchomiono okno Epic. Dokończ logowanie w SteamOS i wróć tutaj. Następnie wybierz Odśwież stan.");
      }
    }catch{
      if(mounted.current)setError("Nie udało się uruchomić logowania Epic. Sprawdź Unifideck, SteamOS i dostępność przeglądarki.");
    }finally{working.current=false;if(mounted.current)setBusy(false);}
  }
  async function downloads() {
    if(!available||working.current)return;
    working.current=true;setBusy(true);setError("");
    try{
      const items=await epicDownloadQueue();
      if(mounted.current)setQueue(items);
    }catch{
      if(mounted.current){setQueue(null);setError("Nie udało się odczytać pobrań Epic.");}
    }finally{working.current=false;if(mounted.current)setBusy(false);}
  }

  return <DialogBody><GamepadScrollArea><DialogControlsSection>
    <Field label="Epic Games" description={!available
      ? "Silnik Epic jest niedostępny. W tej wersji testowej wymagany jest włączony Unifideck, ale nie pojawia się jako osobne konto."
      : connected===true?"Połączono z Epic Games."
      : connected===false?"Nie zalogowano do Epic Games."
      : "Nie udało się ustalić stanu konta."} />
    <Focusable flow-children="column"
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      style={{display:"flex",flexDirection:"column",gap:7}}>
      <Focusable flow-children="row"
        navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
        style={{display:"flex",flexDirection:"row",flexWrap:"wrap",gap:8}}>
        <DialogButton disabled={!available||busy||connected===true}
          onClick={()=>{void login();}}>
          {busy?"Trwa operacja…":"Zaloguj do Epic"}
        </DialogButton>
        <DialogButton disabled={!available||busy}
          onClick={()=>{void refresh();}}>Odśwież stan</DialogButton>
      </Focusable>
      <Field label="Pobieranie Epic"
        description="Pokaż stan kolejki obsługiwanej przez istniejący silnik Unifideck. Nie uruchamia instalacji i nie kopiuje żadnych danych konta.">
        <DialogButton disabled={!available||busy}
          onClick={()=>{void downloads();}}>Sprawdź pobieranie</DialogButton>
      </Field>
    </Focusable>
    {queue!==null && (queue.length ?
      queue.map((item,i)=><Field key={i} label={item.game}
        description={item.state+(item.progress?" · "+item.progress:"")}/>) :
      <Field label="Kolejka Epic" description="Brak aktualnie zgłaszanych pobrań Epic." />)}
    {!!message&&<Field label="Logowanie" description={message}/>}
    {!!error&&<Field label="Błąd" description={error}/>}
    <Field label="Tryb testowy"
      description="Tylko Epic. Logowanie i pobieranie wykonuje Unifideck/Legendary, nie Hub. Bez haseł, tokenów i roota. Samodzielny silnik Epic i wybór gier do instalacji wymagają osobnej implementacji." />
  </DialogControlsSection></GamepadScrollArea></DialogBody>;
}
