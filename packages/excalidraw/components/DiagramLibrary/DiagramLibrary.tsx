import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MIME_TYPES } from "@excalidraw/common";
import { duplicateElements } from "@excalidraw/element";

import { serializeLibraryAsJSON } from "../../data/json";
import { deburr } from "../../deburr";
import {
  useLibraryCache,
  useLibraryItemSvg,
} from "../../hooks/useLibraryItemSvg";
import { TextField } from "../TextField";

import {
  ALL_PIECES,
  DIAGRAM_SECTIONS,
  arePieceFontsLoaded,
  getPieceElements,
  loadPieceFonts,
} from "./pieces";

import "./DiagramLibrary.scss";

import type { DiagramPiece, DiagramSection } from "./pieces";
import type { LibraryItem, LibraryItems } from "../../types";
import type { SvgCache } from "../../hooks/useLibraryItemSvg";

const OPEN_SECTIONS_KEY = "excalidraw-diagram-library-open";

const loadOpenSections = (): string[] => {
  try {
    const stored = localStorage.getItem(OPEN_SECTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === "string");
      }
    }
  } catch {}
  return [DIAGRAM_SECTIONS[0].id];
};

const saveOpenSections = (ids: string[]) => {
  try {
    localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(ids));
  } catch {}
};

const toLibraryItem = (piece: DiagramPiece): LibraryItem => ({
  id: `diagram-${piece.id}`,
  status: "unpublished",
  name: piece.name,
  created: 0,
  elements: getPieceElements(piece),
});

const ICON_PROPS = {
  width: 28,
  height: 28,
  viewBox: "0 0 28 28",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const SectionIcon = ({ icon }: { icon: DiagramSection["icon"] }) => {
  switch (icon) {
    case "clases":
      return (
        <svg {...ICON_PROPS}>
          <rect x="6" y="4" width="16" height="20" rx="1.5" />
          <path d="M6 10h16M6 17h16" />
        </svg>
      );
    case "objetos":
      return (
        <svg {...ICON_PROPS}>
          <rect x="2" y="4" width="10" height="7" rx="1" />
          <rect x="16" y="17" width="10" height="7" rx="1" />
          <path d="M4 13h6M18 26h6M9 11l9 6" />
        </svg>
      );
    case "casos":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="6" cy="7" r="2.5" />
          <path d="M6 9.5v7M2 12.5h8M3 22l3-5.5 3 5.5" />
          <ellipse cx="19.5" cy="14" rx="7" ry="4" />
        </svg>
      );
    case "secuencia":
      return (
        <svg {...ICON_PROPS}>
          <rect x="2" y="2" width="9" height="5" rx="1" />
          <rect x="17" y="2" width="9" height="5" rx="1" />
          <path d="M6.5 7v19M21.5 7v19" strokeDasharray="2 2" />
          <path d="M7 13h13M17.5 11l2.5 2-2.5 2" />
        </svg>
      );
    case "estados":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="5" cy="14" r="2.5" fill="currentColor" />
          <path d="M7.5 14h4" />
          <rect x="12" y="9" width="14" height="10" rx="4" />
        </svg>
      );
    case "paquetes":
      return (
        <svg {...ICON_PROPS}>
          <path d="M3 7h9v3" />
          <rect x="3" y="10" width="22" height="14" rx="1" />
          <path d="M3 7V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" />
        </svg>
      );
    default:
      return (
        <svg {...ICON_PROPS}>
          <path d="M4 9l6-5h14v15l-5 5H4z" />
          <path d="M4 9h15v15M19 9l5-5" />
        </svg>
      );
  }
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={clsx("diagram-library__chevron", {
      "diagram-library__chevron--open": open,
    })}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

const PieceCard = memo(
  ({
    piece,
    svgCache,
    onInsert,
  }: {
    piece: DiagramPiece;
    svgCache: SvgCache;
    onInsert: (item: LibraryItem) => void;
  }) => {
    const item = useMemo(() => toLibraryItem(piece), [piece]);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const svg = useLibraryItemSvg(item.id, item.elements, svgCache, previewRef);

    return (
      <button
        type="button"
        className="diagram-library__piece"
        title={piece.hint ? `${piece.name}\n${piece.hint}` : piece.name}
        draggable
        onClick={() => onInsert(item)}
        onDragStart={(event) => {
          event.dataTransfer.setData(
            MIME_TYPES.excalidrawlib,
            serializeLibraryAsJSON([item]),
          );
        }}
      >
        <div
          ref={previewRef}
          className={clsx("diagram-library__preview", {
            "diagram-library__preview--loading": !svg,
          })}
        />
        <span className="diagram-library__piece-name">{piece.name}</span>
      </button>
    );
  },
);

const PieceGrid = ({
  pieces,
  svgCache,
  onInsert,
  ready,
}: {
  pieces: DiagramPiece[];
  svgCache: SvgCache;
  onInsert: (item: LibraryItem) => void;
  ready: boolean;
}) => (
  <div className="diagram-library__grid">
    {pieces.map((piece) =>
      ready ? (
        <PieceCard
          key={piece.id}
          piece={piece}
          svgCache={svgCache}
          onInsert={onInsert}
        />
      ) : (
        <div key={piece.id} className="diagram-library__piece">
          <div className="diagram-library__preview diagram-library__preview--loading" />
          <span className="diagram-library__piece-name">{piece.name}</span>
        </div>
      ),
    )}
  </div>
);

export const DiagramLibrary = ({
  onInsertLibraryItems,
}: {
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
}) => {
  const { svgCache } = useLibraryCache();
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState(loadOpenSections);
  const [fontsReady, setFontsReady] = useState(arePieceFontsLoaded);

  useEffect(() => {
    if (fontsReady) {
      return;
    }
    let mounted = true;
    loadPieceFonts().then(() => {
      if (mounted) {
        setFontsReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [fontsReady]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = prev.includes(id)
        ? prev.filter((openId) => openId !== id)
        : [...prev, id];
      saveOpenSections(next);
      return next;
    });
  }, []);

  const onInsert = useCallback(
    (item: LibraryItem) => {
      onInsertLibraryItems([
        {
          ...item,
          // ids nuevos en cada inserción, como la biblioteca original (#6465)
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
          }).duplicatedElements,
        },
      ]);
    },
    [onInsertLibraryItems],
  );

  const searchQuery = deburr(query.trim().toLowerCase());
  const results = useMemo(() => {
    if (!searchQuery) {
      return null;
    }
    return ALL_PIECES.filter(({ section, piece }) =>
      deburr(
        [piece.name, piece.keywords, piece.hint, section.title]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      ).includes(searchQuery),
    );
  }, [searchQuery]);

  return (
    <div className="diagram-library">
      <TextField
        type="search"
        className="diagram-library__search"
        placeholder="Buscar en la biblioteca..."
        value={query}
        onChange={setQuery}
        fullWidth
      />

      {results ? (
        results.length ? (
          <>
            <div className="diagram-library__results-title">
              {results.length === 1
                ? "1 resultado"
                : `${results.length} resultados`}
            </div>
            <PieceGrid
              pieces={results.map(({ piece }) => piece)}
              svgCache={svgCache}
              onInsert={onInsert}
              ready={fontsReady}
            />
          </>
        ) : (
          <div className="diagram-library__empty">
            No hay piezas que coincidan con «{query.trim()}».
          </div>
        )
      ) : (
        <>
          <div className="diagram-library__heading">
            <h2>Biblioteca de diagramas</h2>
            <p>Hacé clic o arrastrá una pieza al lienzo.</p>
          </div>
          {DIAGRAM_SECTIONS.map((section) => {
            const open = openSections.includes(section.id);
            return (
              <section
                key={section.id}
                className={clsx("diagram-library__section", {
                  "diagram-library__section--open": open,
                })}
              >
                <button
                  type="button"
                  className="diagram-library__section-header"
                  aria-expanded={open}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="diagram-library__section-icon">
                    <SectionIcon icon={section.icon} />
                  </span>
                  <span className="diagram-library__section-text">
                    <span className="diagram-library__section-title">
                      {section.title}
                    </span>
                    <span className="diagram-library__section-description">
                      {section.description}
                    </span>
                  </span>
                  <ChevronIcon open={open} />
                </button>
                {open && (
                  <div className="diagram-library__section-body">
                    {section.groups.map((group, i) => (
                      <div key={group.title ?? i}>
                        {group.title && (
                          <div className="diagram-library__group-title">
                            {group.title}
                          </div>
                        )}
                        <PieceGrid
                          pieces={group.pieces}
                          svgCache={svgCache}
                          onInsert={onInsert}
                          ready={fontsReady}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};
