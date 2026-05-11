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

// ----------------------------------------------------------------------
// 1. Inteligentna Konfiguracja Firebase 
// Dane pobrane z Twojego zrzutu ekranu projektu "forum-gap"
// ----------------------------------------------------------------------
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

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Błąd inicjalizacji Firebase:", e);
}

// ----------------------------------------------------------------------
// 2. Dynamiczne Ścieżki Bazy Danych
// ----------------------------------------------------------------------
const getPostsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'posts') 
  : collection(db, 'posts');

const getCommentsRef = () => isPreviewEnv 
  ? collection(db, 'artifacts', appId, 'public', 'data', 'comments') 
  : collection(db, 'comments');

const getPostDoc = (postId) => isPreviewEnv 
  ? doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId) 
  : doc(db, 'posts', postId);

// ----------------------------------------------------------------------
// 3. Stałe i pomocnicze
// ----------------------------------------------------------------------
const CATEGORIES = [
  'Wszystkie',
  'BHP i Bezpieczeństwo',
  'Narzędzia i Sprzęt',
  'Organizacja pracy',
  'Atmosfera i Zespół',
  'Inne'
];

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('pl-PL', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ----------------------------------------------------------------------
// 4. Główny Komponent Aplikacji
// ----------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [currentView, setCurrentView] = useState('list');
  const [activeCategory, setActiveCategory] = useState('Wszystkie');
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    if (!auth) {
      setErrorMsg("Brak konfiguracji bazy danych.");
      setAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (isPreviewEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Błąd logowania:", err);
        setErrorMsg(`Błąd autoryzacji: ${err.message}. Upewnij się, że logowanie anonimowe jest włączone w Firebase.`);
      }
    };
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const unsubPosts = onSnapshot(getPostsRef(), (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      postsData.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(postsData);
    }, (error) => {
      console.error("Błąd pobierania postów:", error);
      setErrorMsg(`Błąd bazy danych (Firestore): ${error.message}. Sprawdź zakładkę Rules.`);
    });

    const unsubComments = onSnapshot(getCommentsRef(), (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(commentsData);
    }, (error) => {
      console.error("Błąd pobierania komentarzy:", error);
    });

    return () => {
      unsubPosts();
      unsubComments();
    };
  }, [user]);

  const handleCreatePost = async (postData) => {
    if (!user || !db) return;
    try {
      await addDoc(getPostsRef(), {
        ...postData,
        authorId: user.uid,
        timestamp: Date.now(),
        likes: 0
      });
      setCurrentView('list');
    } catch (error) {
      console.error("Błąd dodawania posta:", error);
      alert(`Błąd podczas dodawania: ${error.message}`); 
    }
  };

  const handleAddComment = async (postId, content, authorName) => {
    if (!user || !db || !content.trim()) return;
    try {
      await addDoc(getCommentsRef(), {
        postId,
        content,
        authorName: authorName || 'Anonimowy',
        authorId: user.uid,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Błąd dodawania komentarza:", error);
    }
  };

  const handleLikePost = async (postId, currentLikes) => {
    if (!db) return;
    try {
      await updateDoc(getPostDoc(postId), {
        likes: currentLikes + 1
      });
    } catch (error) {
      console.error("Błąd podczas oceniania:", error);
    }
  };

  const filteredPosts = activeCategory === 'Wszystkie' 
    ? posts 
    : posts.filter(post => post.category === activeCategory);

  const getCommentCount = (postId) => {
    return comments.filter(c => c.postId === postId).length;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center text-slate-500">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="font-medium">Ładowanie forum GAP Entreprise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => { setCurrentView('list'); setSelectedPost(null); }}
          >
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">GAP Entreprise</h1>
              <p className="text-xs text-slate-400 font-medium">Głos Pracowników</p>
            </div>
          </div>
          
          {currentView === 'list' && (
            <button 
              onClick={() => setCurrentView('create')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center space-x-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Dodaj pomysł</span>
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center space-x-3 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {currentView === 'list' && (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-800 flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    <span>Kategorie</span>
                  </h2>
                </div>
                <div className="p-2">
                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                        activeCategory === category 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-sm text-indigo-900">
                <h3 className="font-semibold mb-2 flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Twoja opinia ma znaczenie</span>
                </h3>
                <p className="text-indigo-700/80 leading-relaxed">
                  Podziel się pomysłami na ulepszenia, zgłoś usterkę lub zaproponuj zmiany w organizacji pracy. Możesz to zrobić całkowicie anonimowo!
                </p>
              </div>
            </div>

            <div className="flex-1">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {activeCategory === 'Wszystkie' ? 'Ostatnie zgłoszenia' : `Kategoria: ${activeCategory}`}
                </h2>
                <span className="text-sm text-slate-500 font-medium">
                  {filteredPosts.length} wpisów
                </span>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Brak wpisów w tej kategorii.</p>
                  <button 
                    onClick={() => setCurrentView('create')}
                    className="mt-6 text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    Dodaj nowy wpis &rarr;
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPosts.map(post => (
                    <div 
                      key={post.id} 
                      className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-indigo-300 transition-colors cursor-pointer group"
                      onClick={() => { setSelectedPost(post); setCurrentView('detail'); }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {post.category}
                        </span>
                        <div className="flex items-center text-xs text-slate-400 space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(post.timestamp)}</span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">{post.title}</h3>
                      <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed">{post.content}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center text-sm text-slate-500 font-medium">
                          <User className="w-4 h-4 mr-1.5" /> {post.authorName || 'Anonim'}
                        </div>
                        <div className="flex space-x-4 text-sm text-slate-500">
                          <div className="flex items-center space-x-1.5"><ThumbsUp className="w-4 h-4" /><span>{post.likes || 0}</span></div>
                          <div className="flex items-center space-x-1.5"><MessageSquare className="w-4 h-4" /><span>{getCommentCount(post.id)}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'create' && (
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setCurrentView('list')} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
            </button>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-800">Dodaj nowy pomysł</h2>
              </div>
              <CreatePostForm onSubmit={handleCreatePost} onCancel={() => setCurrentView('list')} />
            </div>
          </div>
        )}

        {currentView === 'detail' && selectedPost && (
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setCurrentView('list')} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
            </button>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">{selectedPost.title}</h1>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed mb-8">{selectedPost.content}</p>
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-800">Autor: {selectedPost.authorName || 'Anonimowy'}</span>
                <button onClick={() => handleLikePost(selectedPost.id, selectedPost.likes || 0)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-sm hover:bg-indigo-700">
                  Lubię to ({selectedPost.likes || 0})
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <h3 className="text-xl font-bold mb-6">Komentarze ({getCommentCount(selectedPost.id)})</h3>
              <div className="space-y-4 mb-8">
                {comments.filter(c => c.postId === selectedPost.id).map(comment => (
                  <div key={comment.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="font-bold text-sm mb-1">{comment.authorName}</p>
                    <p className="text-slate-600 text-sm">{comment.content}</p>
                  </div>
                ))}
              </div>
              <CommentForm onSubmit={(content, author) => handleAddComment(selectedPost.id, content, author)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CreatePostForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Organizacja pracy');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    await onSubmit({ title, category, content, authorName: authorName.trim() || 'Anonimowy' });
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Tytuł..." className="w-full p-3 border rounded-lg" />
      <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
        {CATEGORIES.filter(c => c !== 'Wszystkie').map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      <textarea required value={content} onChange={e => setContent(e.target.value)} placeholder="Twoja sugestia..." rows="5" className="w-full p-3 border rounded-lg" />
      <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Podpis (opcjonalnie)" className="w-full p-3 border rounded-lg" />
      <div className="flex justify-end space-x-3 pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2 text-slate-600">Anuluj</button>
        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">Opublikuj</button>
      </div>
    </form>
  );
}

function CommentForm({ onSubmit }) {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onSubmit(content, authorName.trim() || 'Anonim');
    setContent('');
    setAuthorName('');
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea required value={content} onChange={e => setContent(e.target.value)} placeholder="Napisz komentarz..." className="w-full p-3 border rounded-lg bg-slate-50" />
      <div className="flex justify-between items-center">
        <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Twoje imię..." className="p-2 border rounded-lg text-sm" />
        <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm">Dodaj</button>
      </div>
    </form>
  );
}