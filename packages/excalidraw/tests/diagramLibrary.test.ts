import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import {
  ALL_PIECES,
  DIAGRAM_SECTIONS,
  getPieceElements,
} from "../components/DiagramLibrary/pieces";

const piece = (id: string) => {
  const found = ALL_PIECES.find(({ piece }) => piece.id === id);
  if (!found) {
    throw new Error(`no existe la pieza ${id}`);
  }
  return getPieceElements(found.piece);
};

const arrowOf = (id: string) =>
  piece(id).find((el) => el.type === "arrow") as ExcalidrawArrowElement;

const textsOf = (id: string) =>
  piece(id)
    .filter((el) => el.type === "text")
    .map((el) => (el as any).text as string);

describe("biblioteca de diagramas", () => {
  it("arma todas las piezas sin errores y con ids únicos", () => {
    const ids = new Set<string>();
    for (const { piece: p } of ALL_PIECES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(getPieceElements(p).length).toBeGreaterThan(0);
    }
    expect(DIAGRAM_SECTIONS.map((s) => s.id)).toEqual([
      "clases",
      "objetos",
      "casos-de-uso",
      "secuencia",
      "estados",
      "paquetes",
      "fisicos",
    ]);
  });

  it("usa las puntas de la notación UML del libro", () => {
    expect(arrowOf("generalizacion").endArrowhead).toBe("triangle_outline");
    expect(arrowOf("agregacion").startArrowhead).toBe("diamond_outline");
    expect(arrowOf("composicion").startArrowhead).toBe("diamond");
    expect(arrowOf("dependencia").strokeStyle).toBe("dashed");
    expect(arrowOf("dependencia").endArrowhead).toBe("arrow");
    expect(arrowOf("cu-extend").strokeStyle).toBe("dashed");
    expect(arrowOf("mensaje").endArrowhead).toBe("triangle");
    expect(arrowOf("retorno").strokeStyle).toBe("dashed");
  });

  it("pone la multiplicidad de un solo lado (CLA-07) y dos flechas si hace falta (CLA-08)", () => {
    expect(textsOf("asociacion-navegable").filter((t) => t === "0..n")).toEqual(
      ["0..n"],
    );
    expect(textsOf("generalizacion")).toEqual([]);
    const doble = piece("asociacion-doble").filter((el) => el.type === "arrow");
    expect(doble).toHaveLength(2);
  });

  it("subraya los nombres de objetos", () => {
    const elements = piece("objeto");
    const name = elements.find((el) => el.type === "text")!;
    const underline = elements.find(
      (el) => el.type === "line" && el.width === name.width,
    );
    expect(underline).toBeTruthy();
    expect(underline!.y).toBeGreaterThan(name.y + name.height - 1);
  });
});
