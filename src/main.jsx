import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity, ArrowLeft, BarChart3, CalendarDays, Check, ChevronRight, Copy, Dumbbell, History, Home, LogOut, Save, Settings, Timer, TrendingUp, Trophy, Users, X, HeartHandshake} from 'lucide-react';
import {programs} from './program';
import {exerciseDemos} from './exerciseDemos';
import {cloudEnabled, supabase} from './supabase';
import './styles.css';
import './exercise-demos.css';
import couplePhoto from './couple-photo.png';

// Get today's workout based on the current weekday
function getTodayWorkout(workouts) {
  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta'
  }).format(new Date());

  return workouts.find(workout => workout.day === today) || null;
}

const STORE='ironlog-v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{sessions:[]}}catch{return {sessions:[]}}};
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Math.random().toString(36).slice(2,10);
const emptyProfile={display_name:'Athlete',goal:'Chest & arms'};
const DRAFT='ironlog-active-workout-v1';
const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT))||null}catch{return null}};

function LocalMovementDemo({exerciseName}) {
  const demo = exerciseDemos[exerciseName];
  const [failed, setFailed] = useState(false);

  if (!demo) {
    return <div className="exercise-demo no-demo-card">
      <div className="no-demo-icon"><Dumbbell size={25}/></div>
      <b>No suitable demo available</b>
      <span>No ExerciseDB GIF was selected for this exercise.</span>
    </div>;
  }

  return <div className="exercise-demo exercisedb-demo">
    {!failed ? <img
      className="exercise-gif"
      src={demo.url}
      alt={`${exerciseName} exercise demonstration`}
      loading="lazy"
      onError={() => setFailed(true)}
    /> : <div className="gif-error">GIF could not be loaded. Check your internet connection and try again.</div>}
    <div className="gif-caption">
      <b>{exerciseName}</b>
      <span>ExerciseDB: {demo.name}</span>
      {demo.status === 'Acceptable alternative' && <small>Selected alternative movement</small>}
    </div>
  </div>;
}

function App(){
 const [data,setData]=useState(load),[tab,setTab]=useState(loadDraft()?'workout':'home'),[active,setActive]=useState(()=>loadDraft()?.active||null),[sets,setSets]=useState(()=>loadDraft()?.sets||[]),[exerciseIndex,setExerciseIndex]=useState(()=>loadDraft()?.exerciseIndex||0),[timer,setTimer]=useState(()=>loadDraft()?.timer??90),[timerOn,setTimerOn]=useState(false),[auth,setAuth]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authMode,setAuthMode]=useState('login'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [cloudDraftId,setCloudDraftId]=useState(()=>loadDraft()?.cloudDraftId||null);
 const cloudDraftIdRef=useRef(loadDraft()?.cloudDraftId||null);
 const [profile,setProfile]=useState(emptyProfile),[profileName,setProfileName]=useState(''),[profileGoal,setProfileGoal]=useState('Chest & arms'),[couple,setCouple]=useState(null),[coupleStats,setCoupleStats]=useState([]),[inviteCode,setInviteCode]=useState(''),[joinCode,setJoinCode]=useState('');
 const selectedProgram=profile.goal==='Glutes & core'?'female':'male';
 const program=programs[selectedProgram];
 useEffect(()=>{localStorage.setItem(STORE,JSON.stringify(data))},[data]);
 useEffect(()=>{if(active){localStorage.setItem(DRAFT,JSON.stringify({active,sets,exerciseIndex,timer,cloudDraftId}))}else{localStorage.removeItem(DRAFT)}},[active,sets,exerciseIndex,timer,cloudDraftId]);
 useEffect(()=>{if(!cloudEnabled)return;supabase.auth.getSession().then(({data:{session}})=>setAuth(session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setAuth(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!timerOn)return;const id=setInterval(()=>setTimer(t=>{if(t<=1){setTimerOn(false);return 0}return t-1}),1000);return()=>clearInterval(id)},[timerOn]);
 useEffect(()=>{if(auth?.user)loadAccount();else{setCouple(null);setCoupleStats([])}},[auth?.user?.id]);
 async function loadAccount(){
   const user=auth?.user;if(!user)return;
   const [{data:pr,error:pe},{data:rows,error:se}]=await Promise.all([
     supabase.from('ironlog_profiles').select('*').eq('user_id',user.id).maybeSingle(),
     supabase.from('workout_sessions').select('*, workout_sets(*)').order('started_at',{ascending:false})
   ]);
   if(pe)setNotice(`Profile: ${pe.message}. Run couple-migration.sql if you haven't yet.`);
   if(pr){setProfile({display_name:pr.display_name,goal:pr.goal});setProfileName(pr.display_name);setProfileGoal(pr.goal)}else{setProfileName(user.email?.split('@')[0]||'Athlete');}
   if(se)setNotice(`Workout sync: ${se.message}`);
   else if(rows){
     const toSession=r=>({id:r.id,programId:r.program_id,workoutName:r.workout_name,date:r.started_at?.slice(0,10),startedAt:r.started_at,finishedAt:r.finished_at,sets:(r.workout_sets||[]).map(s=>({exercise:s.exercise_name,setNo:s.set_number,weight:s.weight_kg,reps:s.reps,done:s.completed}))});
     setData(d=>({...d,sessions:rows.filter(r=>r.finished_at).map(toSession)}));
     // Restore the latest unfinished cloud workout if this browser has no local draft.
     const cloudDraft=rows.find(r=>!r.finished_at);
     if(cloudDraft&&!loadDraft()){
       const allPrograms=[...programs.male,...programs.female];
       const matchingProgram=allPrograms.find(p=>p.id===cloudDraft.program_id);
       if(matchingProgram){
         const saved=(cloudDraft.workout_sets||[]).map(s=>({id:uid(),exercise:s.exercise_name,setNo:s.set_number,weight:String(s.weight_kg??''),reps:String(s.reps??''),done:Boolean(s.completed)}));
         const restored=matchingProgram.groups.flatMap(([exercise,count])=>Array.from({length:count},(_,i)=>saved.find(x=>x.exercise===exercise&&x.setNo===i+1)||({id:uid(),exercise,setNo:i+1,weight:'',reps:'',done:false})));
         cloudDraftIdRef.current=cloudDraft.id;setCloudDraftId(cloudDraft.id);setActive(matchingProgram);setSets(restored);setExerciseIndex(0);setTab('workout');setNotice('Your unfinished workout was restored from the cloud.');
       }
     }
   }
   await loadCouple();
 }
 async function loadCouple(){
   const {data:c,error}=await supabase.rpc('get_my_ironlog_couple');
   if(error){setCouple(null);return;}
   const item=Array.isArray(c)?c[0]:c;
   setCouple(item||null);
   if(item){const {data:stats,error:de}=await supabase.rpc('get_ironlog_couple_dashboard');if(!de)setCoupleStats(stats||[]);else setNotice(de.message)}else setCoupleStats([]);
 }
 const completed=data.sessions.filter(s=>s.finishedAt);const totalVolume=completed.reduce((a,s)=>a+s.sets.filter(x=>x.done).reduce((v,x)=>v+(+x.weight||0)*(+x.reps||0),0),0);
 const startWorkout=p=>{cloudDraftIdRef.current=null;setCloudDraftId(null);setActive(p);setExerciseIndex(0);setTimer(90);setTimerOn(false);setSets(p.groups.flatMap(([exercise,count])=>Array.from({length:count},(_,i)=>({id:uid(),exercise,setNo:i+1,weight:'',reps:'',done:false}))));setTab('workout')};
 const updateSet=(id,key,value)=>setSets(old=>old.map(s=>s.id===id?{...s,[key]:value}:s));
 const persistCloudDraft=async(snapshotSets=sets)=>{
   if(!active||!cloudEnabled||!auth?.user)return {ok:false,skipped:true};
   const doneCount=snapshotSets.filter(s=>s.done).length;
   let sessionId=cloudDraftIdRef.current;
   if(doneCount===0){
     if(sessionId){const {error}=await supabase.from('workout_sets').delete().eq('session_id',sessionId);if(error)setNotice(`Cloud draft cleanup failed: ${error.message}`);}
     return {ok:false,skipped:true};
   }
   if(!sessionId){
     const {data:row,error}=await supabase.from('workout_sessions').insert({user_id:auth.user.id,program_id:active.id,workout_name:active.name,started_at:new Date().toISOString(),finished_at:null}).select('id').single();
     if(error){setNotice(`Cloud draft save failed: ${error.message}. Your progress is still saved on this device.`);return {ok:false,error};}
     sessionId=row.id;cloudDraftIdRef.current=sessionId;setCloudDraftId(sessionId);
   }
   const {error:deleteError}=await supabase.from('workout_sets').delete().eq('session_id',sessionId);
   if(deleteError){setNotice(`Cloud progress update failed: ${deleteError.message}. Your local draft is safe.`);return {ok:false,error:deleteError};}
   const rows=snapshotSets.map(s=>({session_id:sessionId,user_id:auth.user.id,exercise_name:s.exercise,set_number:s.setNo,weight_kg:Number(s.weight)||0,reps:Number(s.reps)||0,completed:Boolean(s.done)}));
   const {error}=await supabase.from('workout_sets').insert(rows);
   if(error){setNotice(`Cloud progress update failed: ${error.message}. Your local draft is safe.`);return {ok:false,error};}
   return {ok:true};
 };
 const toggleSet=async id=>{
   const next=sets.map(s=>s.id===id?{...s,done:!s.done}:s);const changed=next.find(s=>s.id===id);
   setSets(next);
   if(changed?.done){setTimer(90);setTimerOn(true);await persistCloudDraft(next);}
 };
 const finishWorkout=async()=>{
   if(!active)return;
   const completedSets=sets.filter(s=>s.done);
   if(completedSets.length===0){
     if(cloudDraftIdRef.current&&cloudEnabled&&auth?.user){await supabase.from('workout_sets').delete().eq('session_id',cloudDraftIdRef.current);await supabase.from('workout_sessions').delete().eq('id',cloudDraftIdRef.current);}
     cloudDraftIdRef.current=null;setCloudDraftId(null);setActive(null);setTimerOn(false);setExerciseIndex(0);setTab('home');localStorage.removeItem(DRAFT);setNotice('No completed sets. Workout was not saved.');return;
   }
   const now=new Date().toISOString();const session={id:cloudDraftIdRef.current||uid(),programId:active.id,workoutName:active.name,date:today(),startedAt:now,finishedAt:now,sets:sets.map(s=>({...s,done:Boolean(s.done)}))};
   let cloudOk=false;
   if(cloudEnabled&&auth?.user){
     const draftSave=await persistCloudDraft(sets);
     let sessionId=cloudDraftIdRef.current;
     if(sessionId&&draftSave.ok){const {error}=await supabase.from('workout_sessions').update({finished_at:now}).eq('id',sessionId);if(error)setNotice(`Could not finish cloud session: ${error.message}`);else cloudOk=true;}
     else if(!sessionId){const {data:row,error}=await supabase.from('workout_sessions').insert({user_id:auth.user.id,program_id:session.programId,workout_name:session.workoutName,started_at:now,finished_at:now}).select().single();if(error)setNotice(`Cloud save failed: ${error.message}`);else{sessionId=row.id;const rows=sets.map(s=>({session_id:sessionId,user_id:auth.user.id,exercise_name:s.exercise,set_number:s.setNo,weight_kg:Number(s.weight)||0,reps:Number(s.reps)||0,completed:Boolean(s.done)}));const {error:setError}=await supabase.from('workout_sets').insert(rows);if(setError)setNotice(`Session saved, but sets failed: ${setError.message}`);else cloudOk=true;}}
   }
   setData(d=>({...d,sessions:[session,...d.sessions]}));cloudDraftIdRef.current=null;setCloudDraftId(null);setActive(null);setTimerOn(false);setExerciseIndex(0);setTab('home');localStorage.removeItem(DRAFT);
   if(cloudOk){setNotice('Workout completed and synced to your account.');if(couple)loadCouple()}else if(!cloudEnabled||!auth?.user)setNotice('Workout completed and saved on this device. Sign in to sync to the cloud.');
 };
 //const signIn=async e=>{e.preventDefault();setBusy(true);const result=authMode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});setNotice(result.error?.message||(authMode==='signup'?'Account created. Check your email if confirmation is required.':'Signed in.'));setBusy(false)};
 const signIn = async e => {
  e.preventDefault();
  setBusy(true);

  const result = authMode === 'signup'
    ? await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      })
    : await supabase.auth.signInWithPassword({
        email,
        password
      });

  setNotice(
    result.error?.message ||
    (authMode === 'signup'
      ? 'Account created. Check your email to confirm your account.'
      : 'Signed in.')
  );

  setBusy(false);
};

 const saveProfile=async e=>{e.preventDefault();if(!auth?.user)return;setBusy(true);const payload={user_id:auth.user.id,display_name:profileName.trim()||'Athlete',goal:profileGoal,updated_at:new Date().toISOString()};const {error}=await supabase.from('ironlog_profiles').upsert(payload,{onConflict:'user_id'});if(error)setNotice(error.message);else{setProfile({display_name:payload.display_name,goal:payload.goal});setNotice('Your profile and training goal are saved.')}setBusy(false)};
 const createCouple=async()=>{setBusy(true);const {data:r,error}=await supabase.rpc('create_ironlog_couple',{p_name:'Our training team'});if(error)setNotice(error.message);else{const x=Array.isArray(r)?r[0]:r;setInviteCode(x?.invite_code||'');setNotice('Couple dashboard created. Share the invite code with your partner.');await loadCouple()}setBusy(false)};
 const joinCouple=async e=>{e.preventDefault();setBusy(true);const {error}=await supabase.rpc('join_ironlog_couple',{p_invite_code:joinCode});if(error)setNotice(error.message);else{setJoinCode('');setNotice('You joined the couple dashboard!');await loadCouple()}setBusy(false)};
 const previous=name=>{for(const s of data.sessions){const x=s.sets?.filter(v=>v.exercise===name&&v.done);if(x?.length)return x.map(v=>`${v.weight||0}kg × ${v.reps||0}`).join(' · ')}return 'No previous sets yet'};
 const lastWorkout=completed[0];
 const todayWorkout=getTodayWorkout(program);
 const todayName=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date());
 const currentExercise=active?.groups?.[exerciseIndex]||null;
 const currentExerciseSets=currentExercise?sets.filter(s=>s.exercise===currentExercise[0]):[];
 const completedExerciseSets=currentExerciseSets.filter(s=>s.done).length;
 const completedExerciseCount=active?active.groups.filter(([name])=>sets.some(s=>s.exercise===name&&s.done)).length:0;
 const goToExercise=async next=>{if(!active)return;await persistCloudDraft(sets);setExerciseIndex(Math.max(0,Math.min(active.groups.length-1,next)));setTimerOn(false);};
 return <div className="app-shell"><header className="topbar"><div className="brand"><div className="brand-icon"><Dumbbell size={19}/></div><span>ironlog</span></div><div className="top-actions"><span className={`cloud-pill ${cloudEnabled?'cloud-on':''}`}><i/>{cloudEnabled?(auth?'Cloud synced':'Cloud ready'):'Local mode'}</span><button className="icon-btn" onClick={()=>setTab('settings')} aria-label="Settings"><Settings size={19}/></button></div></header>
 {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}<X size={15}/></div>}
 <main className="main">
 {tab==='home'&&<><section className="welcome"><div><p className="eyebrow">YOUR TRAINING SPACE</p><h1>Build strength.<br/><em>Track progress.</em></h1><p className="muted">{profile.display_name} · {profile.goal}. Small improvements add up.</p></div><div className="welcome-mark"><Activity size={34}/></div></section>
 <section className="stats-grid"><Stat icon={<Dumbbell/>} label="Workouts" value={completed.length}/><Stat icon={<TrendingUp/>} label="Volume lifted" value={`${Math.round(totalVolume).toLocaleString()} kg`}/><Stat icon={<Trophy/>} label="Latest session" value={lastWorkout?lastWorkout.workoutName:'—'}/></section>{active&&<section className="resume-workout-card"><div><p className="eyebrow">WORKOUT IN PROGRESS</p><h3>{active.name}</h3><p>{active.groups.length} exercises · Exercise {exerciseIndex+1} of {active.groups.length}</p></div><button className="primary-btn" onClick={()=>setTab('workout')}>Resume workout <ChevronRight size={16}/></button></section>}
 <section className="section-head"><div><p className="eyebrow">YOUR PROGRAM</p><h2>Weekly split</h2></div><span className="subtle">4 days / week</span></section>
 <div className="program-list">{program.map(p=>{
   const isToday=p.day===todayName;
   return <button className="program-card" key={p.id} onClick={()=>startWorkout(p)} style={isToday?{border:'2px solid var(--accent, #7187e8)',background:'var(--card-highlight, #f3f5ff)',boxShadow:'0 0 0 2px rgba(113,135,232,.10)'}:undefined}>
    <div className={`day-icon ${p.id.includes('upper')?'blue':'green'}`}>{p.id.includes('upper')?'U':'L'}</div>
    <div className="program-info"><div className="program-top"><b>{p.name}</b><span>{p.day}{isToday?' · TODAY':''}</span></div><p>{p.focus} · {p.groups.length} exercises</p></div>
    {isToday&&<span style={{fontSize:10,fontWeight:800,letterSpacing:'.06em',color:'var(--accent, #596fce)',marginRight:6}}>TODAY</span>}
    <ChevronRight size={18} className="chevron"/>
   </button>;
 })}</div>
 <section className="start-card"><div><p className="eyebrow light">{todayWorkout?'TODAY’S WORKOUT':'RECOVERY DAY'}</p><h3>{todayWorkout?`Today: ${todayWorkout.name}`:'Today is a rest day'}</h3><p>{todayWorkout?`${todayWorkout.focus} · ${todayWorkout.groups.length} exercises. Log your sets and track your progress.`:'No workout is scheduled today. Recovery is part of your progress.'}</p></div>{todayWorkout?<button className="primary-btn" onClick={()=>startWorkout(todayWorkout)}>Start {todayWorkout.name} <ChevronRight size={17}/></button>:<span className="muted">Enjoy your recovery day.</span>}</section>
 <section className="section-head history-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest workouts</h2></div><button className="text-btn" onClick={()=>setTab('history')}>See all</button></section>{completed.length?<div className="recent-list">{completed.slice(0,3).map(s=><div className="recent-row" key={s.id}><div className="recent-icon"><Check size={17}/></div><div><b>{s.workoutName}</b><p>{new Date(s.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · {s.sets.filter(x=>x.done).length} sets</p></div><span className="done-tag">Completed</span></div>)}</div>:<div className="empty"><CalendarDays size={22}/><b>Your training history starts here</b><span>Complete your first workout to see it here.</span></div>}</>}
 {tab==='workout'&&active&&<>
 <div className="guided-top">
   <button className="back-btn" onClick={()=>{if(confirm('Leave this workout? Your current sets will stay saved as a draft on this device.')){setTimerOn(false);setTab('home')}}}><ArrowLeft size={17}/> Workout overview</button>
   <div className="guided-title-row"><div><p className="eyebrow">LIVE WORKOUT · {active.day.toUpperCase()}</p><h1>{active.name}</h1><p className="muted">{active.focus}</p></div><span className="guided-complete-pill">{completedExerciseCount}/{active.groups.length} done</span></div>
   <div className="guided-progress">{active.groups.map(([name],i)=><button key={name} aria-label={`Go to exercise ${i+1}`} className={`${i===exerciseIndex?'current':''} ${sets.some(s=>s.exercise===name&&s.done)?'completed':''}`} onClick={()=>goToExercise(i)}/>)}</div>
   <div className="guided-counter">EXERCISE {String(exerciseIndex+1).padStart(2,'0')} OF {String(active.groups.length).padStart(2,'0')} <span>· {currentExercise?.[3]?.toUpperCase()}</span></div>
 </div>
 {currentExercise&&<>
 <section className="guided-exercise-card">
   <div className="guided-exercise-heading"><div><h2>{currentExercise[0]}</h2><p>Target: {currentExercise[1]} sets × {currentExercise[2]} reps</p></div><span className="set-count">{completedExerciseSets}/{currentExercise[1]} sets</span></div>
   <LocalMovementDemo exerciseName={currentExercise[0]} />
   <p className="previous-line">Previous: <b>{previous(currentExercise[0])}</b></p>
   <div className="guided-set-table">
     <div className="set-labels"><span>SET</span><span>WEIGHT (KG)</span><span>REPS</span><span>DONE</span></div>
     {currentExerciseSets.map(s=><div className={`set-row ${s.done?'set-complete':''}`} key={s.id}><span className="set-index">{s.setNo}</span><input aria-label={`Set ${s.setNo} weight in kilograms`} type="number" inputMode="decimal" placeholder="0" value={s.weight} onChange={e=>updateSet(s.id,'weight',e.target.value)}/><input aria-label={`Set ${s.setNo} reps`} type="number" inputMode="numeric" placeholder="0" value={s.reps} onChange={e=>updateSet(s.id,'reps',e.target.value)}/><button className={`check-btn ${s.done?'checked':''}`} aria-label={s.done?'Mark set incomplete':'Complete set'} onClick={()=>toggleSet(s.id)}>{s.done?<Check size={17}/>:<span/>}</button></div>)}
   </div>
 </section>
 <section className="guided-timer-card">
   <div className="guided-timer-heading"><div><Timer size={18}/><div><b>Rest timer</b><span>{timerOn?'Rest in progress':'Start your rest between sets'}</span></div></div><strong>{String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}</strong></div>
   <div className="guided-timer-controls"><button onClick={()=>setTimer(t=>Math.max(0,t-15))}>−15s</button><button className={timerOn?'timer-active':''} onClick={()=>setTimerOn(v=>!v)}>{timerOn?'Pause':'Start'}</button><button onClick={()=>setTimer(t=>t+15)}>+15s</button><button onClick={()=>{setTimer(90);setTimerOn(false)}}>Reset</button></div>
   {timer===0&&<p className="timer-finished">Rest complete. You're ready for the next set!</p>}
 </section>
 <div className="guided-navigation"><button className="secondary-btn" disabled={exerciseIndex===0} onClick={()=>goToExercise(exerciseIndex-1)}><ArrowLeft size={16}/> Previous</button>{exerciseIndex<active.groups.length-1?<button className="primary-btn" onClick={()=>goToExercise(exerciseIndex+1)}>Next exercise <ChevronRight size={17}/></button>:<button className="primary-btn" onClick={finishWorkout}><Save size={17}/> Finish workout</button>}</div>
 <p className="guided-footnote">Progress saves automatically on this device and syncs to your account after each completed set and when you move between exercises. Workouts with zero completed sets are not recorded.</p>
 </>}
 </>}

 {tab==='couple'&&<><div className="page-heading"><p className="eyebrow">TRAIN TOGETHER</p><h1>Couple dashboard</h1><p className="muted">Celebrate consistency together while keeping individual workout logs private.</p></div>{!auth?<div className="panel"><h3>Sign in to use your couple dashboard</h3><p className="muted small">Each partner needs their own IronLog account.</p><button className="primary-btn full" onClick={()=>setTab('settings')}>Go to account settings</button></div>:!couple?<><div className="panel"><div className="couple-icon"><HeartHandshake/></div><h3>Create your shared dashboard</h3><p className="muted small">Create a couple space, then share its one-time-use-style invite code with your partner. The code can be used by one other account.</p><button className="primary-btn full" disabled={busy} onClick={createCouple}>{busy?'Creating…':'Create couple dashboard'}</button></div><form className="panel auth-form" onSubmit={joinCouple}><h3>Join with an invite code</h3><label>Partner's invite code<input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="e.g. A1B2C3D4E5" required/></label><button className="secondary-btn full" disabled={busy||!joinCode.trim()}>Join couple dashboard</button></form></>:<><section className="couple-photo-card">
  <img src={couplePhoto} alt="Awal and Ana together after a workout" />
  <div className="couple-photo-shade">
    <p>OUR FITNESS JOURNEY</p>
    <h2>Stronger, together.</h2>
    <span>Made with love by Awal · for Awal &amp; Ana</span>
  </div>
</section><div className="panel couple-banner"><div className="couple-icon"><HeartHandshake/></div><div><p className="eyebrow">SHARED SPACE</p><h3>{couple.couple_name}</h3><p className="muted small">{couple.member_count}/2 accounts connected</p></div></div>{Number(couple.member_count)<2&&<div className="panel invite-panel"><h3>Invite your partner</h3><p className="muted small">Ask them to create their own account, then enter this code under Couple dashboard → Join.</p><div className="invite-code">{couple.invite_code}<button className="secondary-btn" onClick={()=>{navigator.clipboard?.writeText(couple.invite_code);setNotice('Invite code copied.')}}><Copy size={15}/> Copy</button></div></div>}<div className="section-head"><div><p className="eyebrow">TOGETHER, NOT COMPETING</p><h2>Your shared progress</h2></div></div><div className="couple-members">{coupleStats.map(m=><div className="panel member-card" key={m.member_id}><div className="member-head"><div className="member-avatar">{(m.display_name||'A').slice(0,1).toUpperCase()}</div><div><h3>{m.display_name}</h3><p className="muted small">{m.goal}</p></div></div><div className="member-stats"><div><b>{m.workout_count}</b><span>Workouts</span></div><div><b>{Math.round(Number(m.total_volume)||0).toLocaleString()} kg</b><span>Total volume</span></div><div><b>{m.last_workout_at?new Date(m.last_workout_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—'}</b><span>Last workout</span></div></div></div>)}</div></>}</>}
 {tab==='progress'&&<><div className="page-heading"><p className="eyebrow">YOUR DEVELOPMENT</p><h1>Progress</h1><p className="muted">A simple view of consistency and training volume.</p></div><section className="stats-grid"><Stat icon={<Dumbbell/>} label="Sessions" value={completed.length}/><Stat icon={<Activity/>} label="Logged sets" value={completed.reduce((a,s)=>a+s.sets.filter(x=>x.done).length,0)}/><Stat icon={<BarChart3/>} label="Total volume" value={`${Math.round(totalVolume).toLocaleString()} kg`}/></section><div className="panel"><h3>Recent training volume</h3><p className="muted small">Working weight × reps from completed sets</p>{completed.length?<div className="bars">{completed.slice(0,8).reverse().map(s=>{const vol=s.sets.filter(x=>x.done).reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0);const max=Math.max(1,...completed.map(z=>z.sets.filter(x=>x.done).reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0)));return <div className="bar-col" key={s.id}><div className="bar-value">{Math.round(vol)}</div><div className="bar-track"><div className="bar-fill" style={{height:`${Math.max(3,vol/max*100)}%`}}/></div><span>{new Date(s.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div>})}</div>:<div className="empty"><BarChart3 size={23}/><b>No progress data yet</b><span>Log a workout to start building your chart.</span></div>}</div><div className="panel"><h3>Training focus</h3><p className="muted small">{profile.goal==='Glutes & core'?'Your plan prioritizes glute development and core strength while maintaining balanced upper-body training.':'Your plan prioritizes chest and arms while keeping the rest of your physique balanced.'}</p><div className="focus-chips">{(profile.goal==='Glutes & core'?['Glutes','Hamstrings','Quads','Core','Back','Shoulders','Arms']:['Chest','Biceps','Triceps','Back','Legs']).map(x=><span key={x}>{x}</span>)}</div></div></>}
 {tab==='history'&&<><div className="page-heading"><p className="eyebrow">YOUR TRAINING LOG</p><h1>History</h1><p className="muted">Your individual completed sessions.</p></div>{completed.length?<div className="history-list">{completed.map(s=><div className="history-card" key={s.id}><div className="history-card-top"><div><span className="eyebrow">{new Date(s.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</span><h3>{s.workoutName}</h3></div><span className="done-tag">Completed</span></div><div className="history-meta"><span><Check size={14}/>{s.sets.filter(x=>x.done).length} sets logged</span><span><Activity size={14}/>{Math.round(s.sets.filter(x=>x.done).reduce((a,x)=>a+(+x.weight||0)*(+x.reps||0),0)).toLocaleString()} kg volume</span></div></div>)}</div>:<div className="empty"><History size={24}/><b>No workouts recorded</b><span>Your completed sessions will appear here.</span><button className="primary-btn" onClick={()=>setTab('home')}>Go to program</button></div>}</>}
 {tab==='settings'&&<><div className="page-heading"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Manage your account, training goal and cloud data.</p></div><div className="panel account-panel"><div className="account-icon"><Settings/></div><div><h3>Cloud synchronization</h3><p className="muted small">{cloudEnabled?'Supabase is configured. Your workout log syncs to your own account.':'Supabase is not configured yet. IronLog is saving data locally.'}</p></div><span className={`status-dot ${cloudEnabled?'online':''}`}/></div>{cloudEnabled?(auth?<><div className="panel"><p className="eyebrow">SIGNED IN AS</p><b>{auth.user.email}</b><button className="secondary-btn full" onClick={async()=>{await supabase.auth.signOut();setAuth(null);setNotice('Signed out.')}}><LogOut size={16}/> Sign out</button></div><form className="panel auth-form" onSubmit={saveProfile}><h3>Your training profile</h3><label>Display name<input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Your name" required/></label><label>Training goal<select value={profileGoal} onChange={e=>setProfileGoal(e.target.value)}><option>Chest & arms</option><option>Glutes & core</option><option>General fitness</option></select></label><p className="muted small">Your goal selects your own Upper / Lower program. You can change it anytime.</p><button className="primary-btn full" disabled={busy}>{busy?'Saving…':'Save profile'}</button></form></>:<form className="panel auth-form" onSubmit={signIn}><h3>{authMode==='login'?'Sign in to IronLog':'Create your account'}</h3><p className="muted small">Each partner should have a separate account and password.</p><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="primary-btn full" disabled={busy}>{busy?'Please wait…':authMode==='signup'?'Create account':'Sign in'}</button><button type="button" className="text-btn" onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'New here? Create an account':'Already registered? Sign in'}</button></form>):<div className="panel setup-panel"><h3>Connect Supabase</h3><ol><li>Set the Vite Supabase URL and publishable key in <code>.env</code>.</li><li>Run <code>schema.sql</code> and then <code>couple-migration.sql</code> in Supabase SQL Editor.</li><li>Restart the app and sign in.</li></ol></div>}<div className="panel"><h3>Local data</h3><p className="muted small">This browser has {data.sessions.length} locally cached workout session(s). Cloud sessions are private to the signed-in account.</p><button className="secondary-btn danger full" onClick={()=>{if(confirm('Delete all locally cached IronLog data? This cannot be undone.')){setData({sessions:[]});setNotice('Local workout cache cleared.')}}}>Clear local workout data</button></div></>}
 </main>
 {tab!=='workout'&&<nav className="bottom-nav">{[['home',Home,'Home'],['couple',Users,'Couple'],['progress',BarChart3,'Progress'],['history',History,'History'],['settings',Settings,'Settings']].map(([id,Icon,label])=><button key={id} className={tab===id?'nav-active':''} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span></button>)}</nav>}
 </div>
}
function Stat({icon,label,value}){return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><b>{value}</b></div>}
createRoot(document.getElementById('root')).render(<App/>);
