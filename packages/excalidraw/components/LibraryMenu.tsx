import React, { useCallback, memo } from "react";

import { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { atom } from "../editor-jotai";

import { useApp } from "./App";
import { DiagramLibrary } from "./DiagramLibrary/DiagramLibrary";

import "./LibraryMenu.scss";

import type { LibraryItems } from "../types";

export const isLibraryMenuOpenAtom = atom(false);

/**
 * This component is meant to be rendered inside <Sidebar.Tab/> inside our
 * <DefaultSidebar/> or host apps Sidebar components.
 *
 * En este fork el panel muestra la "Biblioteca de diagramas" de la cátedra
 * (DiagramLibrary) en lugar de la biblioteca personal y las publicadas en
 * libraries.excalidraw.com.
 */
export const LibraryMenu = memo(() => {
  const app = useApp();
  const { onInsertElements } = app;

  const onInsertLibraryItems = useCallback(
    (libraryItems: LibraryItems) => {
      onInsertElements(distributeLibraryItemsOnSquareGrid(libraryItems));
      app.focusContainer();
    },
    [onInsertElements, app],
  );

  return (
    <div className="layer-ui__library">
      <DiagramLibrary onInsertLibraryItems={onInsertLibraryItems} />
    </div>
  );
});
