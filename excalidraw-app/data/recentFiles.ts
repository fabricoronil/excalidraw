/**
 * "Archivos recientes": a browser-local index of every drawing the user has
 * worked on, so they can reopen them without going through the file picker.
 *
 * Two kinds of entries, both stored in IndexedDB:
 *
 * - `local`: drawings that live only in this browser. The canvas currently
 *   open is still persisted to localStorage by `LocalData` (unchanged upstream
 *   behavior); we mirror it here under `currentLocalFileId` so that several
 *   drawings can coexist and be switched between.
 * - `room`: live-collaboration rooms the user created or joined via a link.
 *   We keep the link (id + key), a snapshot of the scene for previews, and the
 *   people seen in the room. The room server never sees any of this: names
 *   only exist decrypted on clients, and peers share what they know through
 *   an encrypted `ROOM_VISITORS` message.
 */

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { randomId } from "@excalidraw/common";
import { getNonDeletedElements, getSceneVersion } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import { createStore, del, get, set, values } from "idb-keyval";

import type {
  ExcalidrawElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

export type RecentFileParticipant = {
  username: string;
  firstSeen: number;
  lastSeen: number;
};

type RecentFileBase = {
  id: string;
  /** user-given name; empty means "derive one for display" */
  name: string;
  createdAt: number;
  /** last time the drawing's content changed (by anyone) */
  updatedAt: number;
  /** last time this browser opened it */
  openedAt: number;
  sceneVersion: number;
  elementCount: number;
  elements: readonly NonDeletedExcalidrawElement[];
  fileIds: FileId[];
};

export type LocalRecentFile = RecentFileBase & {
  kind: "local";
  appState: Partial<AppState>;
};

export type RoomRecentFile = RecentFileBase & {
  kind: "room";
  roomId: string;
  roomKey: string;
  /** whether this browser created the room or joined through a link */
  role: "owner" | "guest";
  /** everyone seen in the room except this browser's user */
  participants: RecentFileParticipant[];
};

export type RecentFile = LocalRecentFile | RoomRecentFile;

const store = createStore(
  `${STORAGE_KEYS.IDB_RECENT_FILES}-db`,
  `${STORAGE_KEYS.IDB_RECENT_FILES}-store`,
);

const roomFileId = (roomId: string) => `room:${roomId}`;

/** don't rewrite a participant's `lastSeen` more often than this */
const PARTICIPANT_WRITE_INTERVAL = 60 * 1000;

// -----------------------------------------------------------------------------
// change subscription (so an open dialog refreshes itself)
// -----------------------------------------------------------------------------

const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeToRecentFiles = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

const getFileIds = (elements: readonly ExcalidrawElement[]) =>
  elements.reduce((acc, element) => {
    if (isInitializedImageElement(element)) {
      acc.push(element.fileId);
    }
    return acc;
  }, [] as FileId[]);

const toSnapshot = (elements: readonly ExcalidrawElement[]) => {
  const nonDeleted = getNonDeletedElements(elements);
  return {
    elements: nonDeleted,
    elementCount: nonDeleted.length,
    sceneVersion: getSceneVersion(nonDeleted),
    fileIds: getFileIds(nonDeleted),
  };
};

/**
 * Excalidraw auto-names every canvas "Untitled-2026-09-22-1308" (localized).
 * That's noise in a list, so we keep it empty and let the UI derive a name
 * from the drawing's first text instead.
 */
const AUTO_NAME_RE = /^.+-\d{4}-\d{2}-\d{2}-\d{4}$/;

export const getMeaningfulName = (name: string | null | undefined) =>
  name && !AUTO_NAME_RE.test(name) ? name : null;

/** serializes writes so read-modify-write updates don't clobber each other */
let writeQueue: Promise<unknown> = Promise.resolve();

const update = <T extends RecentFile>(
  id: string,
  updater: (prev: T | undefined) => T | null,
) => {
  const run = writeQueue.then(async () => {
    const prev = await get<T>(id, store);
    const next = updater(prev);
    if (next) {
      await set(id, next, store);
      emitChange();
    }
    return next;
  });
  writeQueue = run.catch((error) => {
    console.error(error);
  });
  return run;
};

const mergeParticipants = (
  existing: readonly RecentFileParticipant[],
  incoming: readonly RecentFileParticipant[],
  ownUsername: string,
) => {
  const byName = new Map<string, RecentFileParticipant>();
  for (const participant of existing) {
    byName.set(participant.username, participant);
  }
  let changed = false;
  for (const participant of incoming) {
    const username = participant.username?.trim();
    if (!username || username === ownUsername) {
      continue;
    }
    const prev = byName.get(username);
    if (!prev) {
      byName.set(username, { ...participant, username });
      changed = true;
    } else if (
      participant.firstSeen < prev.firstSeen ||
      participant.lastSeen > prev.lastSeen
    ) {
      byName.set(username, {
        username,
        firstSeen: Math.min(prev.firstSeen, participant.firstSeen),
        lastSeen: Math.max(prev.lastSeen, participant.lastSeen),
      });
      changed = true;
    }
  }
  return { participants: [...byName.values()], changed };
};

// -----------------------------------------------------------------------------
// current local drawing
// -----------------------------------------------------------------------------

export const getCurrentLocalFileId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_FILE_ID);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const setCurrentLocalFileId = (id: string | null) => {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_FILE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_FILE_ID);
    }
  } catch (error: any) {
    console.error(error);
  }
};

export const newLocalFileId = () => `local:${randomId()}`;

// -----------------------------------------------------------------------------
// public API
// -----------------------------------------------------------------------------

export class RecentFiles {
  /** all entries, most recently modified first */
  static list = async (): Promise<RecentFile[]> => {
    const files = await values<RecentFile>(store);
    return files.sort((a, b) => b.updatedAt - a.updatedAt);
  };

  static get = (id: string) => get<RecentFile>(id, store);

  /**
   * Mirrors the canvas currently persisted to localStorage. Called from
   * `LocalData` on every (debounced) save. Empty canvases don't create an
   * entry, so opening the app doesn't litter the list.
   */
  static saveCurrentLocal = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => {
    const snapshot = toSnapshot(elements);
    let id = getCurrentLocalFileId();
    if (!id) {
      if (!snapshot.elementCount) {
        return;
      }
      id = newLocalFileId();
      setCurrentLocalFileId(id);
    }
    const fileId = id;
    const now = Date.now();
    return update<LocalRecentFile>(fileId, (prev) => {
      if (!prev && !snapshot.elementCount) {
        return null;
      }
      const contentChanged = prev?.sceneVersion !== snapshot.sceneVersion;
      return {
        kind: "local",
        id: fileId,
        createdAt: prev?.createdAt ?? now,
        openedAt: prev?.openedAt ?? now,
        ...snapshot,
        updatedAt: contentChanged || !prev ? now : prev.updatedAt,
        name: getMeaningfulName(appState.name) ?? prev?.name ?? "",
        appState: clearAppStateForLocalStorage(appState),
      };
    });
  };

  static markLocalOpened = (id: string) =>
    update<LocalRecentFile>(id, (prev) =>
      prev ? { ...prev, openedAt: Date.now() } : null,
    );

  /** registers (or refreshes) a room when this browser joins it */
  static openRoom = (opts: {
    roomId: string;
    roomKey: string;
    role: "owner" | "guest";
  }) => {
    const id = roomFileId(opts.roomId);
    const now = Date.now();
    return update<RoomRecentFile>(id, (prev) => ({
      kind: "room",
      id,
      name: prev?.name ?? "",
      createdAt: prev?.createdAt ?? now,
      updatedAt: prev?.updatedAt ?? now,
      openedAt: now,
      sceneVersion: prev?.sceneVersion ?? 0,
      elementCount: prev?.elementCount ?? 0,
      elements: prev?.elements ?? [],
      fileIds: prev?.fileIds ?? [],
      roomId: opts.roomId,
      roomKey: opts.roomKey,
      // keep the original role: after creating a room the page may reload
      // with the room link, which would otherwise look like joining
      role: prev?.role ?? opts.role,
      participants: prev?.participants ?? [],
    }));
  };

  /**
   * Stores the latest room scene (for previews and element counts).
   * `updatedAt` only moves when the content actually changed. Callers
   * throttle this — see `Collab.queueRoomSnapshot`.
   */
  static saveRoomSnapshot = (
    roomId: string,
    elements: readonly ExcalidrawElement[],
  ) => {
    const snapshot = toSnapshot(elements);
    return update<RoomRecentFile>(roomFileId(roomId), (prev) => {
      if (!prev || prev.sceneVersion === snapshot.sceneVersion) {
        return null;
      }
      return { ...prev, ...snapshot, updatedAt: Date.now() };
    });
  };

  /** in-memory throttle so 30fps cursor updates don't hammer IndexedDB */
  private static participantWrites = new Map<string, number>();

  static recordParticipants = (
    roomId: string,
    usernames: readonly string[],
    ownUsername: string,
  ) => {
    const now = Date.now();
    const fresh = usernames.filter((username) => {
      const key = `${roomId}\u0000${username}`;
      const last = RecentFiles.participantWrites.get(key);
      if (last && now - last < PARTICIPANT_WRITE_INTERVAL) {
        return false;
      }
      RecentFiles.participantWrites.set(key, now);
      return true;
    });
    if (!fresh.length) {
      return;
    }
    return RecentFiles.mergeRoomParticipants(
      roomId,
      fresh.map((username) => ({ username, firstSeen: now, lastSeen: now })),
      ownUsername,
    );
  };

  static mergeRoomParticipants = (
    roomId: string,
    incoming: readonly RecentFileParticipant[],
    ownUsername: string,
  ) =>
    update<RoomRecentFile>(roomFileId(roomId), (prev) => {
      if (!prev) {
        return null;
      }
      const { participants, changed } = mergeParticipants(
        prev.participants,
        incoming,
        ownUsername,
      );
      return changed ? { ...prev, participants } : null;
    });

  static getRoom = (roomId: string) =>
    get<RoomRecentFile>(roomFileId(roomId), store);

  static rename = (id: string, name: string) =>
    update<RecentFile>(id, (prev) =>
      prev ? { ...prev, name: name.trim() } : null,
    );

  static remove = async (id: string) => {
    await writeQueue;
    await del(id, store);
    emitChange();
  };

  /** image files referenced by any saved drawing (so they aren't purged) */
  static getAllFileIds = async (): Promise<FileId[]> => {
    try {
      const files = await values<RecentFile>(store);
      return files.flatMap((file) => file.fileIds ?? []);
    } catch (error: any) {
      console.error(error);
      return [];
    }
  };
}
