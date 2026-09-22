import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  RecentFiles,
  getCurrentLocalFileId,
  setCurrentLocalFileId,
} from "../data/recentFiles";

const appState = (name: string | null = null) =>
  ({ ...getDefaultAppState(), name } as AppState);

const clear = async () => {
  for (const file of await RecentFiles.list()) {
    await RecentFiles.remove(file.id);
  }
  setCurrentLocalFileId(null);
};

describe("RecentFiles", () => {
  beforeEach(clear);

  it("doesn't create an entry for an empty canvas", async () => {
    await RecentFiles.saveCurrentLocal([], appState());
    expect(await RecentFiles.list()).toEqual([]);
    expect(getCurrentLocalFileId()).toBe(null);
  });

  it("mirrors the current drawing and only bumps updatedAt on changes", async () => {
    const rect = API.createElement({ type: "rectangle" });
    await RecentFiles.saveCurrentLocal([rect], appState("Plano"));

    const [file] = await RecentFiles.list();
    expect(file.kind).toBe("local");
    expect(file.id).toBe(getCurrentLocalFileId());
    expect(file.name).toBe("Plano");
    expect(file.elementCount).toBe(1);

    // same content (e.g. only the viewport moved) keeps updatedAt
    await new Promise((resolve) => setTimeout(resolve, 5));
    await RecentFiles.saveCurrentLocal([rect], appState("Plano"));
    expect((await RecentFiles.get(file.id))!.updatedAt).toBe(file.updatedAt);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const moved = API.createElement({ type: "rectangle", id: rect.id });
    await RecentFiles.saveCurrentLocal(
      [{ ...moved, version: rect.version + 1 }],
      appState("Plano"),
    );
    expect((await RecentFiles.get(file.id))!.updatedAt).toBeGreaterThan(
      file.updatedAt,
    );
  });

  it("keeps the room role and merges participants", async () => {
    await RecentFiles.openRoom({ roomId: "r1", roomKey: "k", role: "owner" });
    // reload with the room link looks like joining; the role must stick
    await RecentFiles.openRoom({ roomId: "r1", roomKey: "k", role: "guest" });

    await RecentFiles.recordParticipants("r1", ["Ana", "Yo"], "Yo");
    await RecentFiles.mergeRoomParticipants(
      "r1",
      [
        { username: "Ana", firstSeen: 1, lastSeen: 2 },
        { username: "Beto", firstSeen: 10, lastSeen: 20 },
      ],
      "Yo",
    );

    const room = await RecentFiles.getRoom("r1");
    expect(room!.role).toBe("owner");
    const names = room!.participants.map((p) => p.username).sort();
    // own user is never listed as a visitor
    expect(names).toEqual(["Ana", "Beto"]);
    const ana = room!.participants.find((p) => p.username === "Ana")!;
    expect(ana.firstSeen).toBe(1);
    expect(ana.lastSeen).toBeGreaterThan(2);
  });

  it("room snapshots only bump updatedAt when content changes", async () => {
    await RecentFiles.openRoom({ roomId: "r2", roomKey: "k", role: "guest" });
    const before = (await RecentFiles.getRoom("r2"))!;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await RecentFiles.saveRoomSnapshot("r2", []);
    expect((await RecentFiles.getRoom("r2"))!.updatedAt).toBe(before.updatedAt);

    const text = API.createElement({ type: "text", text: "Hola" });
    await RecentFiles.saveRoomSnapshot("r2", [text]);
    const after = (await RecentFiles.getRoom("r2"))!;
    expect(after.elementCount).toBe(1);
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });

  it("lists most recently modified first", async () => {
    await RecentFiles.openRoom({ roomId: "old", roomKey: "k", role: "guest" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await RecentFiles.saveCurrentLocal(
      [API.createElement({ type: "ellipse" })],
      appState(),
    );
    const list = await RecentFiles.list();
    expect(list.map((file) => file.kind)).toEqual(["local", "room"]);
  });
});
