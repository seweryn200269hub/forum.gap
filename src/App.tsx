// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, ArrowLeft, Send, 
  ThumbsUp, User, Building, Clock, Tag, 
  AlertCircle, CheckCircle2, Settings 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';

/**
 * KONFIGURACJA FIREBASE
 * Dane zweryfikowane na podstawie Twojego zrzutu ekranu.
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

// Inicjalizacja Firebase
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Błąd inicjalizacji Firebase:", e);
}

// Funkcje pomocnicze do obsługi bazy danych
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

const formatDate = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('pl-PL', { 
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
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

  // Autoryzacja użytkownika (Anonimowa)
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
        console.error("Błąd logowania:", err);
        setError(`Problem z połączeniem: ${err.message}. Sprawdź, czy logowanie anonimowe jest włączone w Firebase.`);
      }
    };
    login();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Pobieranie danych w czasie rzeczywistym
  useEffect(() => {
    if (!user || !db) return;
    
    const unsubPosts = onSnapshot(getPostsRef(), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => {
      console.error("Błąd Firestore (Posty):", err);
      setError(`Błąd bazy danych: ${err.message}. Sprawdź 'Rules' w Firebase.`);
    });

    const unsubComments = onSnapshot(getCommentsRef(), (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubPosts(); unsubComments(); };
  }, [user]);

  const handleCreatePost = async (formData) => {
    if (!user) return alert("Błąd: Nie połączono z bazą danych.");
    try {
      await addDoc(getPostsRef(), {
        ...formData,
        authorId: user.uid,
        timestamp: Date.now(),
        likes: 0
      });
      setView('list');
    } catch (e) {
      alert("Nie udało się dodać wpisu: " + e.message);
    }
  };

  const handleAddComment = async (postId, text, name) => {
    if (!user) return;
    try {
      await addDoc(getCommentsRef(), {
        postId,
        content: text,
        authorName: name || 'Anonim',
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Błąd komentarza:", e);
    }
  };

  const handleLike = async (postId, currentLikes) => {
    try {
      await updateDoc(getPostDoc(postId), { likes: (currentLikes || 0) + 1 });
    } catch (e) {
      console.error("Błąd polubienia:", e);
    }
  };

  const filteredPosts = activeCat === 'Wszystkie' 
    ? posts 
    : posts.filter(p => p.category === activeCat);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="flex flex-col items-center animate-pulse">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Ładowanie GAP Entreprise...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* HEADER */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => { setView('list'); setSelectedPost(null); }}>
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none">GAP Entreprise</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Platforma Pracowników</p>
            </div>
          </div>
          <button 
            onClick={() => setView('create')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj pomysł</span>
          </button>
        </div>
      </header>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="max-w-5xl mx-auto mt-6 px-4">
          <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex items-start space-x-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-red-800 text-sm uppercase tracking-wide">Wystąpił problem techniczny</p>
              <p className="text-red-700/80 text-xs mt-1 leading-relaxed">{error}</p>
              <p className="text-[10px] text-red-400 mt-3 font-bold uppercase tracking-widest">Wskazówka: Sprawdź klucz API i domenę Vercel w Firebase.</p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 pb-2">Kategorie</h3>
                <div className="space-y-1">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveCat(c)}
                      className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeCat === c ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 opacity-50"></div>
                <h4 className="text-sm font-black text-slate-800 mb-2 relative z-10">Anonimowość</h4>
                <p className="text-xs text-slate-500 leading-relaxed relative z-10">Pamiętaj, że wszystkie zgłoszenia bez podpisu są całkowicie anonimowe. Twoja opinia buduje naszą firmę.</p>
              </div>
            </div>

            {/* List */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{activeCat}</h2>
                <div className="bg-white px-3 py-1 rounded-full border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {filteredPosts.length} wpisów
                </div>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">Brak wpisów w tej sekcji.</p>
                  <button onClick={() => setView('create')} className="text-indigo-600 text-sm font-black mt-2 hover:underline">Dodaj pierwszy pomysł &rarr;</button>
                </div>
              ) : (
                filteredPosts.map(post => (
                  <div 
                    key={post.id} 
                    onClick={() => { setSelectedPost(post); setView('detail'); }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">{post.category}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(post.timestamp)}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors leading-tight">{post.title}</h3>
                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed mb-6">{post.content}</p>
                    <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center text-xs font-bold text-slate-600">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mr-2"><User className="w-3 h-3" /></div>
                        {post.authorName || 'Anonim'}
                      </div>
                      <div className="flex space-x-4 text-slate-400">
                        <div className="flex items-center space-x-1.5"><ThumbsUp className="w-4 h-4" /> <span className="text-xs font-black">{post.likes || 0}</span></div>
                        <div className="flex items-center space-x-1.5"><MessageSquare className="w-4 h-4" /> <span className="text-xs font-black">{comments.filter(c => c.postId === post.id).length}</span></div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CREATE VIEW */}
        {view === 'create' && (
          <div className="max-w-2xl mx-auto bg-white p-10 sm:p-14 rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">Nowy pomysł</h2>
              <button onClick={() => setView('list')} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft className="w-6 h-6" /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target;
              handleCreatePost({ 
                title: f.t.value, 
                category: f.c.value, 
                content: f.tx.value, 
                authorName: f.n.value 
              });
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Temat zgłoszenia</label>
                <input name="t" required placeholder="Czego dotyczy Twoja wiadomość?" className="w-full p-5 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 font-bold border-none transition-all text-lg" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Wybierz sekcję</label>
                  <select name="c" className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none appearance-none cursor-pointer focus:ring-2 ring-indigo-500">
                    {CATEGORIES.filter(c => c !== 'Wszystkie').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Podpis (opcjonalnie)</label>
                  <input name="n" placeholder="Anonimowo lub Imię" className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-indigo-500" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Opisz szczegóły</label>
                <textarea name="tx" required rows="6" placeholder="Napisz więcej o swojej sugestii..." className="w-full p-5 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-500 border-none transition-all resize-none leading-relaxed"></textarea>
              </div>
              <div className="flex space-x-4 pt-6">
                <button type="button" onClick={() => setView('list')} className="flex-1 font-bold text-slate-400 uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Anuluj</button>
                <button className="flex-[2] bg-indigo-600 text-white p-5 rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-500 transition-all uppercase text-sm tracking-widest active:scale-95">Opublikuj na forum</button>
              </div>
            </form>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && selectedPost && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-10 sm:p-14 rounded-[3rem] shadow-sm border border-slate-200">
              <button onClick={() => setView('list')} className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-10 hover:translate-x-[-4px] transition-transform">
                <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
              </button>
              <div className="flex items-center space-x-3 mb-6">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">{selectedPost.category}</span>
                <span className="text-[10px] text-slate-300 font-bold tracking-widest uppercase">/ {formatDate(selectedPost.timestamp)}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black mb-10 leading-tight tracking-tighter text-slate-900">{selectedPost.title}</h1>
              <div className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap mb-14 font-medium">
                {selectedPost.content}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"><User className="w-6 h-6 text-indigo-600" /></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Autor zgłoszenia</p>
                    <p className="font-bold text-slate-800">{selectedPost.authorName || 'Anonimowy Pracownik'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleLike(selectedPost.id, selectedPost.likes)}
                  className="w-full sm:w-auto bg-white px-8 py-4 rounded-2xl font-black text-sm border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                >
                  POPIERAM ({selectedPost.likes || 0})
                </button>
              </div>
            </div>

            <div className="bg-white p-10 sm:p-14 rounded-[3rem] border border-slate-200 shadow-sm">
              <h3 className="font-black mb-10 uppercase text-xs tracking-widest text-slate-400 flex items-center">
                <MessageSquare className="w-5 h-5 mr-3 text-indigo-600" /> Dyskusja ({comments.filter(c => c.postId === selectedPost.id).length})
              </h3>
              <div className="space-y-6 mb-12">
                {comments.filter(c => c.postId === selectedPost.id).map(c => (
                  <div key={c.id} className="flex space-x-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400 mt-1"><User className="w-5 h-5" /></div>
                    <div className="flex-1 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-black text-[10px] text-indigo-600 uppercase tracking-widest">{c.authorName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(c.timestamp)}</p>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 p-8 sm:p-10 rounded-[2rem] shadow-2xl shadow-slate-900/30">
                <h4 className="text-white font-black text-sm mb-6 uppercase tracking-widest text-center sm:text-left">Napisz co o tym sądzisz</h4>
                <form onSubmit={e => {
                  e.preventDefault();
                  handleAddComment(selectedPost.id, e.target.c.value, e.target.n.value);
                  e.target.reset();
                }} className="space-y-5">
                  <textarea name="c" required placeholder="Twoja opinia..." className="w-full p-5 bg-slate-800 text-white rounded-2xl text-sm border-none outline-none focus:ring-1 ring-indigo-500 placeholder-slate-500 transition-all resize-none h-32"></textarea>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <input name="n" placeholder="Twój podpis..." className="w-full sm:w-auto p-4 bg-slate-800 text-white border-none rounded-xl text-xs outline-none focus:ring-1 ring-indigo-500 font-bold" />
                    <button className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-4 rounded-xl text-xs font-black hover:bg-indigo-500 transition-all shadow-lg active:scale-95">DODAJ KOMENTARZ</button>
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