import { exportToSvg } from "@excalidraw/excalidraw";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  copyIcon,
  LinkIcon,
  PlusIcon,
  searchIcon,
  TrashIcon,
  pencilIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { isTextElement } from "@excalidraw/element";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { atom, useAtom } from "../../app-jotai";
import { getCollaborationLink } from "../../data";
import {
  RecentFiles,
  getMeaningfulName,
  subscribeToRecentFiles,
} from "../../data/recentFiles";

import "./RecentFilesDialog.scss";

import type { RecentFile, RoomRecentFile } from "../../data/recentFiles";

export const recentFilesDialogOpenAtom = atom(false);

type Filter = "all" | "local" | "room";

export type RecentFilesDialogProps = {
  /** id of the entry shown on the canvas right now (local or room) */
  getCurrentFileId: () => string | null;
  onOpenFile: (file: RecentFile) => void;
  onNewDrawing: () => void;
  onRenameFile: (file: RecentFile, name: string) => void;
};

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

const firstText = (file: RecentFile) => {
  const text = file.elements.find(
    (element): element is NonDeleted<ExcalidrawTextElement> =>
      isTextElement(element) && !!element.text.trim(),
  );
  const line = text?.text.trim().split("\n")[0] ?? "";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
};

export const getRecentFileDisplayName = (
  file: RecentFile,
  t: ReturnType<typeof useI18n>["t"],
) =>
  getMeaningfulName(file.name) ||
  firstText(file) ||
  (file.kind === "room"
    ? t("recentFiles.untitledRoom")
    : t("recentFiles.untitled"));

const getRoomLink = (file: RoomRecentFile) =>
  getCollaborationLink({ roomId: file.roomId, roomKey: file.roomKey });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const useFormatDate = () => {
  const { t, langCode } = useI18n();
  return useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const time = date.toLocaleTimeString(langCode, {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (isSameDay(date, now)) {
        return `${t("recentFiles.today")} ${time}`;
      }
      if (isSameDay(date, yesterday)) {
        return `${t("recentFiles.yesterday")} ${time}`;
      }
      return `${date.toLocaleDateString(langCode, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} ${time}`;
    },
    [t, langCode],
  );
};

const AVATAR_COLORS = [
  "#cba6f7",
  "#89b4fa",
  "#a6e3a1",
  "#fab387",
  "#f38ba8",
  "#94e2d5",
  "#f9e2af",
];

const avatarColor = (username: string) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const initials = (username: string) =>
  username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("") || "?";

const Avatar = ({ username }: { username: string }) => (
  <span
    className="RecentFiles__avatar"
    style={{ background: avatarColor(username) }}
    title={username}
  >
    {initials(username)}
  </span>
);

const AvatarStack = ({ file }: { file: RecentFile }) => {
  if (file.kind !== "room" || !file.participants.length) {
    return <span className="RecentFiles__muted">—</span>;
  }
  const byRecent = [...file.participants].sort(
    (a, b) => b.lastSeen - a.lastSeen,
  );
  const shown = byRecent.slice(0, 3);
  const rest = byRecent.length - shown.length;
  return (
    <span
      className="RecentFiles__avatars"
      title={byRecent.map((p) => p.username).join(", ")}
    >
      {shown.map((participant) => (
        <Avatar key={participant.username} username={participant.username} />
      ))}
      {rest > 0 && (
        <span className="RecentFiles__avatar RecentFiles__avatar--more">
          +{rest}
        </span>
      )}
    </span>
  );
};

// thumbnails are cheap-ish SVG exports, cached per scene version
const thumbnailCache = new Map<string, string>();

const Thumbnail = ({ file }: { file: RecentFile }) => {
  const cacheKey = `${file.id}@${file.sceneVersion}`;
  const [src, setSrc] = useState(() => thumbnailCache.get(cacheKey) ?? null);

  useEffect(() => {
    if (thumbnailCache.has(cacheKey)) {
      setSrc(thumbnailCache.get(cacheKey)!);
      return;
    }
    if (!file.elements.length) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    exportToSvg({
      elements: file.elements,
      appState: {
        exportBackground: false,
        viewBackgroundColor: "transparent",
      },
      files: null,
      exportPadding: 8,
      skipInliningFonts: true,
    })
      .then((svg) => {
        const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          svg.outerHTML,
        )}`;
        thumbnailCache.set(cacheKey, url);
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch((error) => console.warn(error));
    return () => {
      cancelled = true;
    };
  }, [cacheKey, file.elements]);

  return (
    <span
      className={clsx("RecentFiles__thumb", {
        "RecentFiles__thumb--room": file.kind === "room",
      })}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" draggable={false} /> : null}
      {file.kind === "room" && (
        <span className="RecentFiles__thumbBadge">{usersIcon}</span>
      )}
    </span>
  );
};

// -----------------------------------------------------------------------------
// details panel
// -----------------------------------------------------------------------------

const FileDetails = ({
  file,
  isCurrent,
  onOpen,
  onRename,
}: {
  file: RecentFile;
  isCurrent: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
}) => {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsRenaming(false);
    setConfirmingRemove(false);
    setCopied(false);
  }, [file.id]);

  const displayName = getRecentFileDisplayName(file, t);

  const commitRename = () => {
    setIsRenaming(false);
    if (draftName.trim() && draftName.trim() !== displayName) {
      onRename(draftName.trim());
    }
  };

  const facts: [string, string][] = [
    [t("recentFiles.modified"), formatDate(file.updatedAt)],
    [t("recentFiles.created"), formatDate(file.createdAt)],
    [t("recentFiles.opened"), formatDate(file.openedAt)],
    [t("recentFiles.elements"), String(file.elementCount)],
  ];
  if (file.fileIds.length) {
    facts.push([t("recentFiles.images"), String(file.fileIds.length)]);
  }
  if (file.kind === "room") {
    facts.push([
      t("recentFiles.role"),
      file.role === "owner"
        ? t("recentFiles.roleOwner")
        : t("recentFiles.roleGuest"),
    ]);
  }

  const participants =
    file.kind === "room"
      ? [...file.participants].sort((a, b) => b.lastSeen - a.lastSeen)
      : [];

  return (
    <div className="RecentFiles__details">
      <div className="RecentFiles__detailsPreview">
        <Thumbnail file={file} />
      </div>

      <div className="RecentFiles__detailsHeader">
        {isRenaming ? (
          <input
            className="RecentFiles__renameInput"
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                commitRename();
              } else if (event.key === "Escape") {
                setIsRenaming(false);
              }
            }}
          />
        ) : (
          <h3 className="RecentFiles__detailsTitle" title={displayName}>
            {displayName}
          </h3>
        )}
        <span className="RecentFiles__location">
          {file.kind === "room"
            ? t("recentFiles.locationRoom")
            : t("recentFiles.locationLocal")}
          {isCurrent && (
            <span className="RecentFiles__currentBadge">
              {t("recentFiles.current")}
            </span>
          )}
        </span>
      </div>

      <div className="RecentFiles__actions">
        <FilledButton
          size="large"
          label={t("recentFiles.open")}
          onClick={onOpen}
          disabled={isCurrent}
        />
        <button
          type="button"
          className="RecentFiles__iconButton"
          title={t("recentFiles.rename")}
          aria-label={t("recentFiles.rename")}
          onClick={() => {
            setDraftName(displayName);
            setIsRenaming(true);
          }}
        >
          {pencilIcon}
        </button>
        {file.kind === "room" && (
          <button
            type="button"
            className="RecentFiles__iconButton"
            title={copied ? t("recentFiles.copied") : t("recentFiles.copyLink")}
            aria-label={t("recentFiles.copyLink")}
            onClick={async () => {
              await copyTextToSystemClipboard(getRoomLink(file));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? LinkIcon : copyIcon}
          </button>
        )}
        <button
          type="button"
          className="RecentFiles__iconButton RecentFiles__iconButton--danger"
          title={
            isCurrent
              ? t("recentFiles.cannotRemoveCurrent")
              : t("recentFiles.remove")
          }
          aria-label={t("recentFiles.remove")}
          disabled={isCurrent}
          onClick={() => setConfirmingRemove(true)}
        >
          {TrashIcon}
        </button>
      </div>

      {confirmingRemove && (
        <div className="RecentFiles__confirm" role="alert">
          <span>
            {file.kind === "room"
              ? t("recentFiles.confirmRemoveRoom")
              : t("recentFiles.confirmRemove")}
          </span>
          <div className="RecentFiles__confirmActions">
            <FilledButton
              variant="outlined"
              color="muted"
              label={t("recentFiles.cancel")}
              onClick={() => setConfirmingRemove(false)}
            />
            <FilledButton
              color="danger"
              label={t("recentFiles.confirmYes")}
              onClick={() => RecentFiles.remove(file.id)}
            />
          </div>
        </div>
      )}

      <dl className="RecentFiles__facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {file.kind === "room" && (
        <>
          <div className="RecentFiles__sectionTitle">
            {t("recentFiles.link")}
          </div>
          <code className="RecentFiles__link" title={getRoomLink(file)}>
            {getRoomLink(file)}
          </code>

          <div className="RecentFiles__sectionTitle">
            {t("recentFiles.people")} ({participants.length})
          </div>
          {participants.length ? (
            <ul className="RecentFiles__people">
              {participants.map((participant) => (
                <li key={participant.username}>
                  <Avatar username={participant.username} />
                  <div>
                    <div className="RecentFiles__personName">
                      {participant.username}
                    </div>
                    <div className="RecentFiles__muted">
                      {t("recentFiles.firstSeen")}:{" "}
                      {formatDate(participant.firstSeen)}
                      {" · "}
                      {t("recentFiles.lastSeen")}:{" "}
                      {formatDate(participant.lastSeen)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="RecentFiles__muted">{t("recentFiles.noPeople")}</p>
          )}
          <p className="RecentFiles__note">{t("recentFiles.peopleNote")}</p>
        </>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// dialog
// -----------------------------------------------------------------------------

export const RecentFilesDialog = (props: RecentFilesDialogProps) => {
  const [isOpen, setIsOpen] = useAtom(recentFilesDialogOpenAtom);
  if (!isOpen) {
    return null;
  }
  return <RecentFilesDialogInner {...props} onClose={() => setIsOpen(false)} />;
};

const RecentFilesDialogInner = ({
  getCurrentFileId,
  onOpenFile,
  onNewDrawing,
  onRenameFile,
  onClose,
}: RecentFilesDialogProps & { onClose: () => void }) => {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const [currentFileId] = useState(getCurrentFileId);
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      RecentFiles.list().then((list) => {
        if (!cancelled) {
          setFiles(list);
        }
      });
    load();
    const unsubscribe = subscribeToRecentFiles(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (files ?? []).filter((file) => {
      if (filter !== "all" && file.kind !== filter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [
        getRecentFileDisplayName(file, t),
        ...(file.kind === "room"
          ? file.participants.map((participant) => participant.username)
          : []),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [files, filter, query, t]);

  // keep a sensible selection as the list changes
  useEffect(() => {
    if (!visibleFiles.length) {
      setSelectedId(null);
    } else if (!visibleFiles.some((file) => file.id === selectedId)) {
      setSelectedId(visibleFiles[0].id);
    }
  }, [visibleFiles, selectedId]);

  const selectedFile = visibleFiles.find((file) => file.id === selectedId);

  const open = (file: RecentFile) => {
    onClose();
    if (file.id !== currentFileId) {
      onOpenFile(file);
    }
  };

  const counts = useMemo(() => {
    const all = files ?? [];
    return {
      all: all.length,
      local: all.filter((file) => file.kind === "local").length,
      room: all.filter((file) => file.kind === "room").length,
    };
  }, [files]);

  const filters: [Filter, string][] = [
    ["all", t("recentFiles.filterAll")],
    ["local", t("recentFiles.filterLocal")],
    ["room", t("recentFiles.filterRooms")],
  ];

  return (
    <Dialog
      size="wide"
      title={t("recentFiles.title")}
      onCloseRequest={onClose}
      className="RecentFilesDialog"
    >
      <div className="RecentFiles">
        <div className="RecentFiles__toolbar">
          <div className="RecentFiles__search">
            <TextField
              type="search"
              icon={searchIcon}
              placeholder={t("recentFiles.search")}
              value={query}
              onChange={setQuery}
              fullWidth
            />
          </div>
          <FilledButton
            size="large"
            icon={PlusIcon}
            label={t("recentFiles.newDrawing")}
            onClick={() => {
              onClose();
              onNewDrawing();
            }}
          />
        </div>

        <div className="RecentFiles__filters" role="tablist">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={clsx("RecentFiles__filter", {
                "RecentFiles__filter--active": filter === value,
              })}
              onClick={() => setFilter(value)}
            >
              {label}
              <span className="RecentFiles__count">{counts[value]}</span>
            </button>
          ))}
        </div>

        <div className="RecentFiles__body">
          <div className="RecentFiles__table">
            <div className="RecentFiles__row RecentFiles__row--head" role="row">
              <span />
              <span>{t("recentFiles.colName")}</span>
              <span className="RecentFiles__colLocation">
                {t("recentFiles.colLocation")}
              </span>
              <span className="RecentFiles__colPeople">
                {t("recentFiles.colPeople")}
              </span>
              <span className="RecentFiles__colModified">
                {t("recentFiles.colModified")}
              </span>
            </div>

            {files && !files.length && (
              <p className="RecentFiles__empty">{t("recentFiles.empty")}</p>
            )}
            {files && !!files.length && !visibleFiles.length && (
              <p className="RecentFiles__empty">{t("recentFiles.noResults")}</p>
            )}

            {visibleFiles.map((file) => {
              const isCurrent = file.id === currentFileId;
              return (
                <div
                  key={file.id}
                  role="row"
                  tabIndex={0}
                  className={clsx("RecentFiles__row", {
                    "RecentFiles__row--selected": file.id === selectedId,
                  })}
                  onClick={() => setSelectedId(file.id)}
                  onDoubleClick={() => open(file)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      open(file);
                    }
                  }}
                >
                  <Thumbnail file={file} />
                  <span className="RecentFiles__name">
                    <span className="RecentFiles__nameText">
                      {getRecentFileDisplayName(file, t)}
                    </span>
                    {isCurrent && (
                      <span className="RecentFiles__currentBadge">
                        {t("recentFiles.current")}
                      </span>
                    )}
                    <span className="RecentFiles__nameMeta">
                      {file.kind === "room"
                        ? t("recentFiles.locationRoom")
                        : t("recentFiles.locationLocal")}
                      {" · "}
                      {formatDate(file.updatedAt)}
                    </span>
                  </span>
                  <span className="RecentFiles__colLocation RecentFiles__muted">
                    {file.kind === "room"
                      ? t("recentFiles.locationRoom")
                      : t("recentFiles.locationLocal")}
                  </span>
                  <span className="RecentFiles__colPeople">
                    <AvatarStack file={file} />
                  </span>
                  <span className="RecentFiles__colModified">
                    {formatDate(file.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>

          {selectedFile && (
            <FileDetails
              file={selectedFile}
              isCurrent={selectedFile.id === currentFileId}
              onOpen={() => open(selectedFile)}
              onRename={(name) => onRenameFile(selectedFile, name)}
            />
          )}
        </div>

        <p className="RecentFiles__note">{t("recentFiles.storageNote")}</p>
      </div>
    </Dialog>
  );
};
