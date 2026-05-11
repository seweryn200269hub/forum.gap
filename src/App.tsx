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
 * KONFIGURACJA FIREBASE
 * Dane pobrane z Twojego projektu "forum-gap".
 * Jeśli błąd 'api-key-not-valid' powróci, upewnij się, że klucz API w Firebase Console 
 * nie ma na końcu spacji ani ukrytych znaków.
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
      appId: "1:384946365494:web:a363450c98c3077ee22497"
    };

// Inicjalizacja usług Firebase
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Błąd startowy Firebase:", e);
}

// Funkcje pomocnicze do ścieżek w bazie danych (obsługa podglądu i wersji produkcyjnej)
const getPostsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'posts') 
  : collection(db, 'posts');

const getCommentsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'comments') 
  : collection(db, 'comments');

const getPostDoc = (postId) => isPreviewEnv 
  ? doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId) 
  : doc(db, 'posts', postId);

const CATEGORIES = [
  'Wszystkie', 
  'BHP i Bezpieczeństwo', 
  'Narzędzia i Sprzęt', 
  'Organizacja pracy', 
  'Atmosfera i Zespół', 
  'Inne'
];

const formatDate = (ts) => {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [view, setView] = useState('list');
  const [activeCat, setActiveCat] = useState('Wszystkie');
  const [selectedPost, setSelectedPost] = useState(null);

  // Logowanie
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
        console.error("Auth error:", err);
        setError(`Błąd autoryzacji: ${err.message}. Sprawdź klucz API oraz czy logowanie anonimowe jest włączone w Firebase.`);
      }
    };
    login();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Pobieranie danych na żywo
  useEffect(() => {
    if (!user || !db) return;
    
    const unsubP = onSnapshot(getPostsRef(), (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
    }, (e) => {
      console.error("Firestore error:", e);
      setError(`Błąd bazy danych: ${e.message}. Sprawdź zakładkę Rules w Firebase.`);
    });

    const unsubC = onSnapshot(getCommentsRef(), (s) => {
      setComments(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubP(); unsubC(); };
  }, [user]);

  const handleAddPost = async (data) => {
    try {
      await addDoc(getPostsRef(), { 
        ...data, 
        authorId: user.uid, 
        timestamp: Date.now(), 
        likes: 0 
      });
      setView('list');
    } catch (e) {
      alert("Błąd dodawania: " + e.message);
    }
  };

  const handleAddComment = async (pid, txt, name) => {
    try {
      await addDoc(getCommentsRef(), { 
        postId: pid, 
        content: txt, 
        authorName: name || 'Anonim', 
        timestamp: Date.now() 
      });
    } catch (e) {
      console.error("Comment error:", e);
    }
  };

  const handleLike = async (pid, current) => {
    try {
      await updateDoc(getPostDoc(pid), { likes: current + 1 });
    } catch (e) {
      console.error("Like error:", e);
    }
  };

  const filteredPosts = activeCat === 'Wszystkie' 
    ? posts 
    : posts.filter(p => p.category === activeCat);

  const getCommentCount = (pid) => comments.filter(c => c.postId === pid).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans text-slate-500">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="font-bold">Łączenie z GAP Entreprise...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* NAGŁÓWEK */}
      <header className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => { setView('list'); setSelectedPost(null); }}>
            <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-500 transition-colors">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase">GAP Entreprise</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Głos Pracownika</p>
            </div>
          </div>
          <button 
            onClick={() => setView('create')} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj wpis</span>
          </button>
        </div>
      </header>

      {/* POWIADOMIENIE O BŁĘDZIE */}
      {error && (
        <div className="max-w-5xl mx-auto m-4 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-black mb-1 text-red-800">Wymagana uwaga:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* TREŚĆ GŁÓWNA */}
      <main className="max-w-5xl mx-auto p-4 pt-8">
        
        {/* LISTA WPISÓW */}
        {view === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-6">
              <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 pb-2">Filtruj Kategorie</h3>
                <div className="space-y-1">
                  {CATEGORIES.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setActiveCat(c)} 
                      className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeCat === c ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl shadow-indigo-200/50">
                <h4 className="font-black text-sm mb-2 uppercase tracking-wide">Bezpieczeństwo</h4>
                <p className="text-xs text-indigo-200 leading-relaxed">Twoje zgłoszenia są domyślnie anonimowe. Wspólnie dbamy o lepsze standardy w GAP Entreprise.</p>
              </div>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{activeCat}</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{filteredPosts.length} wpisów</span>
              </div>
              
              {filteredPosts.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">Brak zgłoszeń w tej sekcji.</p>
                  <button onClick={() => setView('create')} className="text-indigo-600 text-sm font-black mt-2 hover:underline">Dodaj pierwsze zgłoszenie &rarr;</button>
                </div>
              ) : (
                filteredPosts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => { setSelectedPost(p); setView('detail'); }} 
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">{p.category}</span>
                      <div className="flex items-center text-[10px] text-slate-400 font-bold space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(p.timestamp)}</span>
                      </div>
                    </div>
                    <h2 className="text-xl font-black mb-2 leading-tight group-hover:text-indigo-700 transition-colors">{p.title}</h2>
                    <p className="text-slate-500 text-sm line-clamp-2 mb-6 leading-relaxed">{p.content}</p>
                    <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                      <div className="flex items-center text-xs font-bold text-slate-600">
                        <User className="w-4 h-4 mr-2 text-slate-300" />
                        <span>{p.authorName || 'Anonimowy Pracownik'}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1.5 text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-xs font-black">{p.likes || 0}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-400">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs font-black">{getCommentCount(p.id)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* FORMULARZ DODAWANIA */}
        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black tracking-tighter">Nowe zgłoszenie</h2>
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target;
              handleAddPost({ 
                title: f.t.value, 
                category: f.c.value, 
                content: f.tx.value, 
                authorName: f.n.value 
              });
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tytuł problemu/pomysłu</label>
                <input name="t" required placeholder="Czego dotyczy Twoja wiadomość?" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-bold border-none transition-all" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wybierz sekcję</label>
                  <select name="c" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-indigo-500 appearance-none">
                    {CATEGORIES.filter(c => c !== 'Wszystkie').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Podpis (opcjonalnie)</label>
                  <input name="n" placeholder="Anonimowo lub Imię" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-indigo-500" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opis szczegółowy</label>
                <textarea name="tx" required rows="6" placeholder="Napisz więcej o swojej sugestii..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 border-none transition-all resize-none"></textarea>
              </div>

              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setView('list')} className="flex-1 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase text-sm tracking-widest">Anuluj</button>
                <button className="flex-[2] bg-indigo-600 text-white p-5 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-500 transition-all uppercase text-sm tracking-widest">Opublikuj wiadomość</button>
              </div>
            </form>
          </div>
        )}

        {/* WIDOK SZCZEGÓŁÓW */}
        {view === 'detail' && selectedPost && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-sm border border-slate-200">
              <button onClick={() => setView('list')} className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-8 hover:translate-x-[-4px] transition-transform">
                <ArrowLeft className="w-3 h-3 mr-2" /> Wróć do listy
              </button>
              
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">{selectedPost.category}</span>
                <span className="text-[10px] text-slate-300 font-bold">• {formatDate(selectedPost.timestamp)}</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-black mb-8 leading-tight tracking-tighter">{selectedPost.title}</h1>
              
              <div className="prose prose-slate max-w-none text-slate-700 text-lg leading-relaxed whitespace-pre-wrap mb-12">
                {selectedPost.content}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Zgłoszone przez:</p>
                    <p className="font-bold text-slate-800">{selectedPost.authorName || 'Anonimowy Pracownik'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleLike(selectedPost.id, selectedPost.likes || 0)} 
                  className="w-full sm:w-auto bg-white px-8 py-3 rounded-2xl font-black text-sm border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                >
                  POPIERAM TO ({selectedPost.likes || 0})
                </button>
              </div>
            </div>

            <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-black mb-10 uppercase text-xs tracking-widest text-slate-400 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" /> Dyskusja ({getCommentCount(selectedPost.id)})
              </h3>
              
              <div className="space-y-6 mb-12">
                {comments.filter(c => c.postId === selectedPost.id).map(c => (
                  <div key={c.id} className="flex space-x-4 animate-in fade-in duration-300">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex-shrink-0 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-black text-[10px] text-indigo-600 uppercase">{c.authorName}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{formatDate(c.timestamp)}</p>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
                
                {getCommentCount(selectedPost.id) === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm italic">Brak komentarzy. Twoja opinia może być pierwsza.</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl shadow-slate-900/20">
                <h4 className="text-white font-black text-sm mb-4 uppercase tracking-widest">Dodaj swój komentarz</h4>
                <form onSubmit={e => {
                  e.preventDefault();
                  handleAddComment(selectedPost.id, e.target.c.value, e.target.n.value);
                  e.target.reset();
                }} className="space-y-4">
                  <textarea name="c" required placeholder="Twoja opinia..." className="w-full p-4 bg-slate-800 text-white rounded-xl text-sm border-none outline-none focus:ring-2 ring-indigo-500 placeholder-slate-500 transition-all"></textarea>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <input name="n" placeholder="Twoje imię..." className="w-full sm:w-auto p-3 bg-slate-800 text-white border-none rounded-xl text-xs outline-none focus:ring-2 ring-indigo-500" />
                    <button className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-indigo-500 transition-all shadow-lg">WYŚLIJ</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}