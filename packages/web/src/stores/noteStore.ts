import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Note, NoteListItem, Folder, Attachment, User } from '@chuqing/shared';
import { ApiClient } from '../api/client';

export const useNoteStore = defineStore('notes', () => {
  const notes = ref<NoteListItem[]>([]);
  const activeNote = ref<(Note & { attachments: Attachment[] }) | null>(null);
  const draggedNoteId = ref<string | null>(null);
  const folders = ref<Folder[]>([]);
  const currentView = ref<'all' | 'pinned' | 'trash' | string>('all'); // 'all', 'pinned', 'trash', or folderId
  const searchQuery = ref('');
  const isLoading = ref(false);
  const isSaving = ref(false);
  const saveStatus = ref<'saved' | 'saving' | 'error' | 'offline'>('saved');
  const previewPdfAttachment = ref<Attachment | null>(null);
  const currentUser = ref<User | null>(null);
  const authStatus = ref<{ hasUsers: boolean; authenticated: boolean }>({ hasUsers: false, authenticated: false });

  let saveTimer: any = null;

  const currentFolder = computed(() => {
    if (['all', 'pinned', 'trash'].includes(currentView.value)) return null;
    return folders.value.find((f) => f.id === currentView.value) || null;
  });

  async function loadFolders() {
    try {
      folders.value = await ApiClient.getFolders();
    } catch (e) {
      console.error('Failed to load folders:', e);
    }
  }

  async function loadNotes() {
    isLoading.value = true;
    try {
      const filter: any = {};
      if (currentView.value === 'trash') {
        filter.isDeleted = true;
      } else {
        filter.isDeleted = false;
        if (currentView.value === 'pinned') {
          filter.isPinned = true;
        } else if (currentView.value !== 'all') {
          filter.folderId = currentView.value;
        }
      }
      if (searchQuery.value.trim()) {
        filter.search = searchQuery.value.trim();
      }

      notes.value = await ApiClient.getNotes(filter);

      // 如果当前没有选中的笔记，且列表有内容，默认选中第一篇
      if (!activeNote.value && notes.value.length > 0) {
        await selectNote(notes.value[0].id);
      } else if (activeNote.value && !notes.value.some((n) => n.id === activeNote.value?.id)) {
        // 当前选中的笔记不在列表中
        if (notes.value.length > 0) {
          await selectNote(notes.value[0].id);
        } else {
          activeNote.value = null;
        }
      }
    } catch (e) {
      console.error('Failed to load notes:', e);
    } finally {
      isLoading.value = false;
    }
  }

  async function selectNote(id: string) {
    try {
      const note = await ApiClient.getNote(id);
      activeNote.value = note;
    } catch (e) {
      console.error('Failed to select note:', e);
    }
  }

  async function createNewNote() {
    try {
      const folderId = ['all', 'pinned', 'trash'].includes(currentView.value) ? null : currentView.value;
      const newNote = await ApiClient.createNote({
        title: '新笔记',
        folderId,
        content: { type: 'doc', content: [] },
      });
      await loadNotes();
      await selectNote(newNote.id);
    } catch (e) {
      console.error('Failed to create note:', e);
    }
  }

  function queueSaveActiveNote() {
    if (!activeNote.value) return;
    saveStatus.value = 'saving';

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!activeNote.value) return;
      try {
        const updated = await ApiClient.updateNote(activeNote.value.id, {
          title: activeNote.value.title,
          content: activeNote.value.content,
          isPinned: activeNote.value.isPinned,
          folderId: activeNote.value.folderId,
        });
        saveStatus.value = 'saved';

        // 更新左侧列表项
        const item = notes.value.find((n) => n.id === updated.id);
        if (item) {
          item.title = updated.title;
          item.snippet = updated.snippet;
          item.updatedAt = updated.updatedAt;
          item.isPinned = updated.isPinned;
        }
      } catch (e) {
        console.error('Auto save failed:', e);
        saveStatus.value = 'error';
      }
    }, 800); // 800ms 防抖自动落库
  }

  async function deleteActiveNote() {
    if (!activeNote.value) return;
    await deleteNote(activeNote.value.id);
  }

  async function deleteNote(noteId: string) {
    try {
      await ApiClient.deleteNote(noteId);
      if (activeNote.value?.id === noteId) {
        activeNote.value = null;
      }
      await loadNotes();
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  }

  async function restoreActiveNote() {
    if (!activeNote.value) return;
    await restoreNote(activeNote.value.id);
  }

  async function restoreNote(noteId: string) {
    try {
      await ApiClient.restoreNote(noteId);
      await loadNotes();
      if (activeNote.value?.id === noteId) {
        await selectNote(noteId);
      }
    } catch (e) {
      console.error('Failed to restore note:', e);
    }
  }

  async function permanentDeleteNote(noteId: string) {
    try {
      await ApiClient.permanentDeleteNote(noteId);
      if (activeNote.value?.id === noteId) {
        activeNote.value = null;
      }
      await loadNotes();
    } catch (e) {
      console.error('Failed to permanently delete note:', e);
    }
  }

  async function emptyTrash() {
    try {
      await ApiClient.emptyTrash();
      activeNote.value = null;
      await loadNotes();
    } catch (e) {
      console.error('Failed to empty trash:', e);
    }
  }

  async function moveNoteToFolder(noteId: string, folderId: string | null) {
    try {
      await ApiClient.updateNote(noteId, { folderId });
      if (activeNote.value && activeNote.value.id === noteId) {
        activeNote.value.folderId = folderId;
      }
      const item = notes.value.find((n) => n.id === noteId);
      if (item) {
        item.folderId = folderId;
      }
      await loadNotes();
    } catch (e) {
      console.error('Failed to move note to folder:', e);
    }
  }

  async function togglePin(noteId: string) {
    const item = notes.value.find((n) => n.id === noteId);
    if (!item) return;
    const newPinned = !item.isPinned;
    try {
      await ApiClient.updateNote(noteId, { isPinned: newPinned });
      item.isPinned = newPinned;
      if (activeNote.value && activeNote.value.id === noteId) {
        activeNote.value.isPinned = newPinned;
      }
      await loadNotes();
    } catch (e) {
      console.error('Failed to toggle pin:', e);
    }
  }

  async function createFolder(name: string) {
    try {
      await ApiClient.createFolder(name);
      await loadFolders();
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  }

  async function renameFolder(id: string, name: string) {
    try {
      await ApiClient.updateFolder(id, { name });
      await loadFolders();
    } catch (e) {
      console.error('Failed to rename folder:', e);
    }
  }

  async function deleteFolder(id: string) {
    try {
      await ApiClient.deleteFolder(id);
      if (currentView.value === id) {
        currentView.value = 'all';
      }
      await loadFolders();
      await loadNotes();
    } catch (e) {
      console.error('Failed to delete folder:', e);
    }
  }

  async function checkAuth(): Promise<boolean> {
    try {
      const status = await ApiClient.getAuthStatus();
      authStatus.value = { hasUsers: status.hasUsers, authenticated: status.authenticated };
      currentUser.value = status.user || null;
      return status.authenticated;
    } catch {
      authStatus.value = { hasUsers: false, authenticated: false };
      currentUser.value = null;
      return false;
    }
  }

  async function register(data: { username: string; password: string; nickname?: string }) {
    const res = await ApiClient.register(data);
    currentUser.value = res.user;
    authStatus.value.hasUsers = true;
    authStatus.value.authenticated = true;
  }

  async function login(data: { username: string; password: string }) {
    const res = await ApiClient.login(data);
    currentUser.value = res.user;
    authStatus.value.authenticated = true;
  }

  function logout() {
    ApiClient.logout();
    authStatus.value.authenticated = false;
    currentUser.value = null;
    activeNote.value = null;
    notes.value = [];
    folders.value = [];
  }

  return {
    currentUser,
    authStatus,
    checkAuth,
    register,
    login,
    logout,
    notes,
    activeNote,
    draggedNoteId,
    folders,
    currentView,
    currentFolder,
    searchQuery,
    isLoading,
    isSaving,
    saveStatus,
    previewPdfAttachment,
    loadFolders,
    loadNotes,
    selectNote,
    createNewNote,
    queueSaveActiveNote,
    deleteActiveNote,
    deleteNote,
    restoreActiveNote,
    restoreNote,
    permanentDeleteNote,
    emptyTrash,
    moveNoteToFolder,
    togglePin,
    createFolder,
    renameFolder,
    deleteFolder,
  };
});
