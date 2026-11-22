import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { LANGS, detectInitialLang, t } from './i18n.js';
import { load, save } from './storage.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = load('ac_lang');
    return LANGS.some((l) => l.code === saved) ? saved : detectInitialLang();
  });
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [chats, setChats] = useState([]);
  const [modal, setModal] = useState(null); // { name, props }

  useEffect(() => {
    document.documentElement.lang = lang;
    save('ac_lang', lang);
  }, [lang]);

  const refreshChats = useCallback(async () => {
    try {
      setChats((await api.conversations()).conversations);
    } catch {
      /* keep the list we have */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser((await api.me()).user);
    } catch {
      setUser(null);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) refreshChats();
    else setChats([]);
  }, [user, refreshChats]);

  const signedIn = useCallback(
    (u) => {
      setUser(u);
      setModal(null);
      refreshChats(); // chats made as a guest now belong to the account
    },
    [refreshChats],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      refreshChats();
    }
  }, [refreshChats]);

  const upsertChat = useCallback((chat) => {
    setChats((list) => [chat, ...list.filter((c) => c.id !== chat.id)]);
  }, []);

  const removeChat = useCallback(async (id) => {
    setChats((list) => list.filter((c) => c.id !== id));
    try {
      await api.deleteConversation(id);
    } catch {
      /* already gone */
    }
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      L: t(lang),
      user,
      userLoaded,
      refreshUser,
      signedIn,
      signOut,
      chats,
      refreshChats,
      upsertChat,
      removeChat,
      modal,
      openModal: (name, props = {}) => setModal({ name, props }),
      closeModal: () => setModal(null),
    }),
    [lang, user, userLoaded, refreshUser, signedIn, signOut, chats, refreshChats, upsertChat, removeChat, modal],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
