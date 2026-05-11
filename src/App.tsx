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
// Kod automatycznie wykrywa czy jest w podglądzie (Canvas), 
// czy na prawdziwym serwerze.
// Zostaw ciągi "TWÓJ_API_KEY" do czasu wrzucenia na swój hosting!
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
  // Stan autoryzacji
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Stan danych
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  
  // Stan nawigacji i UI
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'detail'
  const [activeCategory, setActiveCategory] = useState('Wszystkie');
  const [selectedPost, setSelectedPost] = useState(null);

  // ----------------------------------------------------------------------
  // Autoryzacja Firebase
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!auth) {
      setErrorMsg("Brak konfiguracji bazy danych.");
      setAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // Jeśli jesteśmy w podglądzie, używamy tokenu środowiska, w przeciwnym razie logowania anonimowego
        if (isPreviewEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Błąd logowania:", err);
        setErrorMsg("Nie udało się połączyć z systemem autoryzacji. Uzupełnij API Key.");
      }
    };
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------------------------
  // Pobieranie danych z Firestore
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!user || !db) return;

    // Nasłuchiwanie wpisów
    const unsubPosts = onSnapshot(getPostsRef(), (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      postsData.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(postsData);
    }, (error) => {
      console.error("Błąd pobierania postów:", error);
      setErrorMsg("Błąd podczas ładowania wpisów.");
    });

    // Nasłuchiwanie komentarzy
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

  // ----------------------------------------------------------------------
  // Funkcje obsługi danych
  // ----------------------------------------------------------------------
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
      alert("Nie udało się dodać wpisu."); 
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

  // ----------------------------------------------------------------------
  // Filtrowanie i obliczenia
  // ----------------------------------------------------------------------
  const filteredPosts = activeCategory === 'Wszystkie' 
    ? posts 
    : posts.filter(post => post.category === activeCategory);

  const getCommentCount = (postId) => {
    return comments.filter(c => c.postId === postId).length;
  };

  // ----------------------------------------------------------------------
  // Renderowanie UI
  // ----------------------------------------------------------------------
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
      {/* HEADER */}
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

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* WIDOK LISTY */}
        {currentView === 'list' && (
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Sidebar z kategoriami */}
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

            {/* Lista postów */}
            <div className="flex-1">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {activeCategory === 'Wszystkie' ? 'Ostatnie zgłoszenia' : `Kategoria: ${activeCategory}`}
                </h2>
                <span className="text-sm text-slate-500 font-medium">
                  {filteredPosts.length} {filteredPosts.length === 1 ? 'wpis' : filteredPosts.length >= 2 && filteredPosts.length <= 4 ? 'wpisy' : 'wpisów'}
                </span>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Brak wpisów w tej kategorii.</p>
                  <p className="text-sm mt-1">Bądź pierwszą osobą, która doda pomysł!</p>
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
                      
                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed">
                        {post.content}
                      </p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center text-sm text-slate-500">
                          <User className="w-4 h-4 mr-1.5 text-slate-400" />
                          <span className="font-medium">{post.authorName || 'Anonim'}</span>
                        </div>
                        <div className="flex space-x-4 text-sm text-slate-500">
                          <div className="flex items-center space-x-1.5">
                            <ThumbsUp className="w-4 h-4" />
                            <span className="font-medium">{post.likes || 0}</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <MessageSquare className="w-4 h-4" />
                            <span className="font-medium">{getCommentCount(post.id)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WIDOK DODAWANIA POSTA */}
        {currentView === 'create' && (
          <div className="max-w-2xl mx-auto">
            <button 
              onClick={() => setCurrentView('list')}
              className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Wróć do listy
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-800">Dodaj nowy pomysł</h2>
                <p className="text-slate-500 text-sm mt-1">Podziel się swoimi spostrzeżeniami z firmą.</p>
              </div>
              
              <CreatePostForm 
                onSubmit={handleCreatePost} 
                onCancel={() => setCurrentView('list')} 
              />
            </div>
          </div>
        )}

        {/* WIDOK SZCZEGÓŁÓW POSTA I KOMENTARZY */}
        {currentView === 'detail' && selectedPost && (
          <div className="max-w-3xl mx-auto">
            <button 
              onClick={() => setCurrentView('list')}
              className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Wróć do listy
            </button>

            {/* Post details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-start mb-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {selectedPost.category}
                  </span>
                  <div className="flex items-center text-sm text-slate-400">
                    <Clock className="w-4 h-4 mr-1.5" />
                    {formatDate(selectedPost.timestamp)}
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
                  {selectedPost.title}
                </h1>
                
                <div className="prose max-w-none text-slate-700 leading-relaxed mb-8 whitespace-pre-wrap">
                  {selectedPost.content}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-slate-100 gap-4">
                  <div className="flex items-center bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Autor</p>
                      <p className="text-sm font-bold text-slate-800">{selectedPost.authorName || 'Anonimowy Pracownik'}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleLikePost(selectedPost.id, selectedPost.likes || 0)}
                    className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 text-slate-700 rounded-lg font-medium transition-all shadow-sm"
                  >
                    <ThumbsUp className="w-4 h-4 text-indigo-600" />
                    <span>Popieram ten pomysł ({selectedPost.likes || 0})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-indigo-600" />
                Dyskusja ({getCommentCount(selectedPost.id)})
              </h3>

              <div className="space-y-6 mb-8">
                {comments
                  .filter(c => c.postId === selectedPost.id)
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map(comment => (
                    <div key={comment.id} className="flex space-x-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center mt-1">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-bold text-slate-800 text-sm">{comment.authorName}</span>
                          <span className="text-xs text-slate-400 font-medium">{formatDate(comment.timestamp)}</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                {getCommentCount(selectedPost.id) === 0 && (
                  <p className="text-slate-500 text-center py-6 text-sm italic">
                    Brak komentarzy. Bądź pierwszą osobą, która wyrazi opinię!
                  </p>
                )}
              </div>

              {/* Add Comment Form */}
              <div className="border-t border-slate-100 pt-6">
                <CommentForm 
                  onSubmit={(content, author) => handleAddComment(selectedPost.id, content, author)} 
                />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// Komponent: Formularz tworzenia posta
// ----------------------------------------------------------------------
function CreatePostForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Organizacja pracy'); // Default
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit({
      title,
      category,
      content,
      authorName: authorName.trim() || 'Anonimowy pracownik'
    });
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tytuł wpisu *</label>
        <input 
          type="text" 
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Krótki i zwięzły tytuł problemu/pomysłu..."
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategoria *</label>
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 bg-white"
        >
          {CATEGORIES.filter(c => c !== 'Wszystkie').map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Opis pomysłu / problemu *</label>
        <textarea 
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Opisz dokładnie swój pomysł lub problem, z jakim się spotykasz na budowie/w biurze..."
          rows="6"
          className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 resize-y"
        ></textarea>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Twój podpis (opcjonalnie)</label>
        <input 
          type="text" 
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Np. Jan K. (zostaw puste, by zachować anonimowość)"
          className="w-full px-4 py-2 rounded-md border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 text-sm"
        />
        <p className="text-xs text-slate-500 mt-2 flex items-center">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-500" />
          Forum wspiera całkowitą anonimowość, jeśli nie wpiszesz swoich danych.
        </p>
      </div>

      <div className="pt-4 flex items-center justify-end space-x-3">
        <button 
          type="button" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          Anuluj
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center shadow-sm disabled:opacity-70"
        >
          {isSubmitting ? 'Wysyłanie...' : 'Opublikuj na forum'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------------
// Komponent: Formularz komentarza
// ----------------------------------------------------------------------
function CommentForm({ onSubmit }) {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    await onSubmit(content, authorName.trim() || 'Anonim');
    setContent('');
    setAuthorName('');
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
      <textarea
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Napisz co myślisz o tym pomyśle..."
        rows="3"
        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm text-slate-800 resize-none bg-slate-50"
      ></textarea>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <input 
          type="text" 
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Twój podpis (opcjonalnie)"
          className="w-full sm:w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-800 bg-white"
        />
        <button 
          type="submit" 
          disabled={isSubmitting || !content.trim()}
          className="flex-shrink-0 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50 shadow-sm"
        >
          <Send className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Wysyłanie...' : 'Wyślij komentarz'}
        </button>
      </div>
    </form>
  );
}
