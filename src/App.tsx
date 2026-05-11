// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, ArrowLeft, Send, 
  ThumbsUp, User, Building, Clock, Tag, 
  AlertCircle, CheckCircle2 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';

/**
 * ----------------------------------------------------------------------
 * KONFIGURACJA FIREBASE - Zaktualizowana na podstawie Twojego screena
 * ----------------------------------------------------------------------
 */
const isPreviewEnv = typeof __firebase_config !== 'undefined';
const appId = typeof __app_id !== 'undefined' ? __app_id : 'gap-forum-app';

const firebaseConfig = isPreviewEnv 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyA-mX9G2lOrZ1lU3GTl2pxpwnC54lDJyXU",
      authDomain: "forum-gap.firebaseapp.com",
      projectId: "forum-gap",
      storageBucket: "forum-gap.firebasestorage.app",
      messagingSenderId: "384946365494",
      appId: "1:384946365494:web:a363450c98c3077ee22497",
      measurementId: "G-LP3DJB4X1M"
    };

// Initializing Firebase services
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

const getPostsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'posts') 
  : collection(db, 'posts');

const getCommentsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'comments') 
  : collection(db, 'comments');

const getPostDoc = (postId) => isPreviewEnv 
  ? doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId) 
  : doc(db, 'posts', postId);

const CATEGORIES = ['Wszystkie', 'BHP i Bezpieczeństwo', 'Narzędzia i Sprzęt', 'Organizacja pracy', 'Atmosfera i Zespół', 'Inne'];

const formatDate = (ts) => ts ? new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [view, setView] = useState('list');
  const [cat, setCat] = useState('Wszystkie');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!auth) return;
    const login = async () => {
      try {
        if (isPreviewEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Login error:", err);
        setError(`Błąd autoryzacji: ${err.message}`);
      }
    };
    login();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubP = onSnapshot(getPostsRef(), (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
    }, (e) => setError(`Błąd bazy: ${e.message}`));
    const unsubC = onSnapshot(getCommentsRef(), (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubP(); unsubC(); };
  }, [user]);

  const addPost = async (data) => {
    if (!user) {
      alert("Najpierw musisz się połączyć poprawnie z bazą danych.");
      return;
    }
    try {
      await addDoc(getPostsRef(), { ...data, authorId: user.uid, timestamp: Date.now(), likes: 0 });
      setView('list');
    } catch (e) {
      alert("Błąd dodawania: " + e.message);
    }
  };

  const addComment = async (pid, txt, name) => {
    if (!user) return;
    await addDoc(getCommentsRef(), { postId: pid, content: txt, authorName: name || 'Anonim', timestamp: Date.now() });
  };

  const filtered = cat === 'Wszystkie' ? posts : posts.filter(p => p.category === cat);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans text-slate-400">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold tracking-tight">Łączenie z serwerem GAP Entreprise...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setView('list'); setSelected(null); }}>
            <div className="bg-indigo-600 p-2 rounded-lg"><Building className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none">GAP Entreprise</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Platforma Pracownicza</p>
            </div>
          </div>
          <button 
            onClick={() => setView('create')} 
            className="bg-indigo-600 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all"
          >
            + Nowy wpis
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto m-4 p-5 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold mb-1">Problem z połączeniem:</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 py-8">
        {view === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Kategorie</h3>
              <div className="space-y-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCat(c)} className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${cat === c ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-white'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 space-y-4">
              {filtered.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center text-slate-300">
                  <p className="font-bold">Brak wpisów w tej kategorii.</p>
                </div>
              ) : (
                filtered.map(p => (
                  <div key={p.id} onClick={() => { setSelected(p); setView('detail'); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-400 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{p.category}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{formatDate(p.timestamp)}</span>
                    </div>
                    <h2 className="text-xl font-black mb-1">{p.title}</h2>
                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{p.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <h2 className="text-3xl font-black mb-8 flex items-center tracking-tighter"><Plus className="w-8 h-8 mr-2 text-indigo-600" /> Nowe zgłoszenie</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target;
              addPost({ title: f.t.value, category: f.c.value, content: f.tx.value, authorName: f.n.value || 'Anonim' });
            }} className="space-y-5">
              <input name="t" required placeholder="Tytuł zgłoszenia" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-bold text-lg" />
              <select name="c" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none appearance-none cursor-pointer">
                {CATEGORIES.filter(c => c !== 'Wszystkie').map(c => <option key={c}>{c}</option>)}
              </select>
              <textarea name="tx" required rows="6" placeholder="Opisz dokładnie sytuację lub pomysł..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 text-slate-700 leading-relaxed"></textarea>
              <input name="n" placeholder="Podpisz się (opcjonalnie)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" />
              <div className="flex space-x-4 pt-6">
                <button type="button" onClick={() => setView('list')} className="flex-1 font-bold text-slate-400">ANULUJ</button>
                <button disabled={!user} className="flex-[2] bg-indigo-600 text-white p-5 rounded-2xl font-black shadow-xl shadow-indigo-100 disabled:opacity-30 active:scale-95 transition-all">OPUBLIKUJ</button>
              </div>
            </form>
          </div>
        )}

        {view === 'detail' && selected && (
          <div className="max-w-3xl mx-auto space-y-6">
            <button onClick={() => setView('list')} className="text-xs font-black text-slate-400 flex items-center hover:text-indigo-600 transition-colors uppercase"><ArrowLeft className="w-4 h-4 mr-1" /> Powrót</button>
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
               <div className="flex items-center space-x-2 mb-6">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">{selected.category}</span>
                <span className="text-[10px] text-slate-300 font-bold uppercase">{formatDate(selected.timestamp)}</span>
              </div>
              <h1 className="text-4xl font-black mb-8 tracking-tighter leading-tight">{selected.title}</h1>
              <p className="text-slate-700 text-xl leading-relaxed whitespace-pre-wrap mb-12">{selected.content}</p>
              <div className="flex justify-between items-center pt-8 border-t border-slate-50">
                <div className="flex items-center space-x-3">
                   <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-slate-400" /></div>
                   <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">{selected.authorName}</span>
                </div>
                <button onClick={() => updateDoc(getPostDoc(selected.id), { likes: (selected.likes || 0) + 1 })} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center space-x-2 shadow-lg active:scale-95 transition-all"><ThumbsUp className="w-5 h-5" /> <span>{selected.likes || 0}</span></button>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center"><MessageSquare className="w-4 h-4 mr-2" /> Dyskusja ({comments.filter(c => c.postId === selected.id).length})</h3>
               <div className="space-y-4 mb-10">
                {comments.filter(c => c.postId === selected.id).map(c => (
                  <div key={c.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-black text-[10px] text-indigo-600 uppercase tracking-widest">{c.authorName}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{formatDate(c.timestamp)}</p>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={e => {
                e.preventDefault();
                addComment(selected.id, e.target.c.value, e.target.n.value);
                e.target.reset();
              }} className="bg-slate-900 p-6 rounded-3xl space-y-4">
                <textarea name="c" required placeholder="Dodaj swój komentarz..." className="w-full p-4 bg-slate-800 text-white rounded-2xl text-sm border-none outline-none focus:ring-1 ring-indigo-500"></textarea>
                <div className="flex justify-between items-center">
                  <input name="n" placeholder="Podpis..." className="p-3 bg-slate-800 text-white border-none rounded-xl text-xs outline-none" />
                  <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black">WYŚLIJ</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}