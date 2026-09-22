// Piezas de la "Biblioteca de diagramas": notación de la cátedra de
// Paradigmas, sacada de los dos libros (Booch, "Análisis y diseño orientado a
// objetos", y Jacobson/Booch/Rumbaugh, "El Proceso Unificado"). La base es la
// notación UML del libro del Proceso Unificado; las piezas propias de Booch van
// en su propio grupo. Los códigos entre paréntesis (CLA-07, CU-05...) son los
// de ~/reglas-diagramas-catedra.md.

import { FONT_FAMILY } from "@excalidraw/common";
import { convertToExcalidrawElements } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type {
  Arrowhead,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { Fonts } from "../../fonts";

export type DiagramPiece = {
  id: string;
  name: string;
  /** regla o aclaración que se muestra al pasar el mouse */
  hint?: string;
  /** palabras extra para el buscador */
  keywords?: string;
  build: () => Skeleton[];
};

export type DiagramPieceGroup = {
  title?: string;
  pieces: DiagramPiece[];
};

export type DiagramSection = {
  id: string;
  title: string;
  description: string;
  icon: string;
  groups: DiagramPieceGroup[];
};

// ---------------------------------------------------------------------------
// primitivas
// ---------------------------------------------------------------------------

type Skeleton = ExcalidrawElementSkeleton & {
  customData?: Record<string, unknown>;
};

const INK = "#1e1e1e";
const FONT = FONT_FAMILY.Nunito;
const FONT_SIZE = 16;
const SMALL = 14;
const LINE_HEIGHT = 1.25;

const STROKE = {
  strokeColor: INK,
  strokeWidth: 1,
  roughness: 0,
  opacity: 100,
} as const;

type XY = [number, number];

const points = (pts: XY[]) => pts.map(([x, y]) => pointFrom<LocalPoint>(x, y));

const bounds = (pts: XY[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const text = (
  x: number,
  y: number,
  value: string,
  opts: {
    size?: number;
    /** centra el texto horizontalmente alrededor de x */
    center?: boolean;
    /** alinea el borde derecho del texto con x */
    right?: boolean;
    id?: string;
  } = {},
): Skeleton => ({
  type: "text",
  id: opts.id,
  x,
  y,
  text: value,
  fontSize: opts.size ?? FONT_SIZE,
  fontFamily: FONT,
  lineHeight: LINE_HEIGHT as any,
  textAlign: opts.center ? "center" : opts.right ? "right" : "left",
  strokeColor: INK,
});

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  opts: {
    rounded?: boolean;
    dashed?: boolean;
    strokeWidth?: number;
    fill?: string;
    label?: string;
  } = {},
): Skeleton => ({
  type: "rectangle",
  x,
  y,
  width,
  height,
  ...STROKE,
  strokeWidth: opts.strokeWidth ?? STROKE.strokeWidth,
  strokeStyle: opts.dashed ? "dashed" : "solid",
  backgroundColor: opts.fill ?? "transparent",
  fillStyle: "solid",
  roundness: opts.rounded ? { type: 3 } : null,
  ...(opts.label
    ? {
        label: {
          text: opts.label,
          fontSize: FONT_SIZE,
          fontFamily: FONT,
          strokeColor: INK,
        },
      }
    : {}),
});

const ellipse = (
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { dashed?: boolean; fill?: string; label?: string } = {},
): Skeleton => ({
  type: "ellipse",
  x,
  y,
  width,
  height,
  ...STROKE,
  strokeStyle: opts.dashed ? "dashed" : "solid",
  backgroundColor: opts.fill ?? "transparent",
  fillStyle: "solid",
  ...(opts.label
    ? {
        label: {
          text: opts.label,
          fontSize: FONT_SIZE,
          fontFamily: FONT,
          strokeColor: INK,
        },
      }
    : {}),
});

const line = (
  x: number,
  y: number,
  pts: XY[],
  opts: { dashed?: boolean; strokeWidth?: number; id?: string } = {},
): Skeleton => ({
  type: "line",
  id: opts.id,
  x,
  y,
  ...bounds(pts),
  points: points(pts),
  ...STROKE,
  strokeWidth: opts.strokeWidth ?? STROKE.strokeWidth,
  strokeStyle: opts.dashed ? "dashed" : "solid",
  roundness: null,
});

const arrow = (
  x: number,
  y: number,
  pts: XY[],
  opts: {
    start?: Arrowhead | null;
    end?: Arrowhead | null;
    dashed?: boolean;
  } = {},
): Skeleton => ({
  type: "arrow",
  x,
  y,
  ...bounds(pts),
  points: points(pts),
  ...STROKE,
  strokeStyle: opts.dashed ? "dashed" : "solid",
  startArrowhead: opts.start ?? null,
  endArrowhead: opts.end === undefined ? "arrow" : opts.end,
  roundness: null,
});

/** subraya el texto con ese id (nombres de objetos, UML) */
const underline = (textId: string): Skeleton => ({
  ...line(0, 0, [
    [0, 0],
    [10, 0],
  ]),
  customData: { underline: textId },
});

const textHeight = (lines: number, size = FONT_SIZE) =>
  Math.round(lines * size * LINE_HEIGHT);

// ---------------------------------------------------------------------------
// bloques reutilizables
// ---------------------------------------------------------------------------

/** caja de clase con compartimentos: nombre / atributos / operaciones */
const classBox = (
  x: number,
  y: number,
  name: string,
  opts: {
    width?: number;
    stereotype?: string;
    attributes?: string[];
    operations?: string[];
    strokeWidth?: number;
    /** texto bajo el nombre, ej. {abstract} */
    nameNote?: string;
  } = {},
): Skeleton[] => {
  const width = opts.width ?? 220;
  const pad = 8;
  const els: Skeleton[] = [];
  const header = [
    ...(opts.stereotype ? [opts.stereotype] : []),
    name,
    ...(opts.nameNote ? [opts.nameNote] : []),
  ];
  const headerHeight = textHeight(header.length) + pad * 2;
  let cursor = y + headerHeight;
  const compartments = [opts.attributes, opts.operations].filter(
    (c): c is string[] => !!c,
  );
  const compartmentHeights = compartments.map(
    (c) => textHeight(Math.max(c.length, 1)) + pad * 2,
  );
  const height =
    headerHeight + compartmentHeights.reduce((sum, h) => sum + h, 0);

  els.push(rect(x, y, width, height, { strokeWidth: opts.strokeWidth }));
  els.push(text(x + width / 2, y + pad, header.join("\n"), { center: true }));
  compartments.forEach((lines, i) => {
    els.push(
      line(x, cursor, [
        [0, 0],
        [width, 0],
      ]),
    );
    els.push(text(x + pad, cursor + pad, lines.join("\n")));
    cursor += compartmentHeights[i];
  });
  return els;
};

/** caja de objeto: nombre subrayado y, opcional, atributos con valor */
const objectBox = (
  x: number,
  y: number,
  name: string,
  key: string,
  opts: { width?: number; attributes?: string[] } = {},
): Skeleton[] => {
  const width = opts.width ?? 200;
  const pad = 8;
  const nameId = `${key}-name`;
  const headerHeight = textHeight(1) + pad * 2 + 2;
  const els: Skeleton[] = [];
  const attrHeight = opts.attributes
    ? textHeight(opts.attributes.length) + pad * 2
    : 0;
  els.push(rect(x, y, width, headerHeight + attrHeight));
  els.push(text(x + width / 2, y + pad, name, { center: true, id: nameId }));
  els.push(underline(nameId));
  if (opts.attributes) {
    els.push(
      line(x, y + headerHeight, [
        [0, 0],
        [width, 0],
      ]),
    );
    els.push(text(x + pad, y + headerHeight + pad, opts.attributes.join("\n")));
  }
  return els;
};

/** monigote de actor con el nombre debajo */
const stickFigure = (
  x: number,
  y: number,
  name: string,
  opts: { underlineKey?: string } = {},
): Skeleton[] => {
  const cx = x + 20;
  const nameId = opts.underlineKey ? `${opts.underlineKey}-name` : undefined;
  const els: Skeleton[] = [
    ellipse(cx - 9, y, 18, 18),
    line(cx, y + 18, [
      [0, 0],
      [0, 26],
    ]),
    line(cx - 16, y + 26, [
      [0, 0],
      [32, 0],
    ]),
    line(cx - 14, y + 44, [
      [0, 20],
      [14, 0],
      [28, 20],
    ]),
    text(cx, y + 70, name, { center: true, id: nameId }),
  ];
  if (nameId) {
    els.push(underline(nameId));
  }
  return els;
};

/** nota: rectángulo con la esquina superior derecha doblada */
const noteShape = (x: number, y: number, value: string): Skeleton[] => {
  const w = 170;
  const h = 70;
  const fold = 16;
  return [
    line(x, y, [
      [0, 0],
      [w - fold, 0],
      [w, fold],
      [w, h],
      [0, h],
      [0, 0],
    ]),
    line(x + w - fold, y, [
      [0, 0],
      [0, fold],
      [fold, fold],
    ]),
    text(x + 10, y + 12, value, { size: SMALL }),
  ];
};

/** íconos de las clases de análisis (Proceso Unificado, fig. 8.5) */
const analysisIcon = (
  x: number,
  y: number,
  kind: "boundary" | "entity" | "control",
): Skeleton[] => {
  const r = 20;
  const cx = x + 30;
  const cy = y + r;
  const els: Skeleton[] = [ellipse(cx - r, y, r * 2, r * 2)];
  if (kind === "boundary") {
    els.push(
      line(cx - r - 10, cy - 14, [
        [0, 0],
        [0, 28],
      ]),
      line(cx - r - 10, cy, [
        [0, 0],
        [10, 0],
      ]),
    );
  } else if (kind === "entity") {
    els.push(
      line(cx - r, y + r * 2 + 3, [
        [0, 0],
        [r * 2, 0],
      ]),
    );
  } else {
    els.push(
      line(cx - 1, y, [
        [7, -5],
        [0, 0],
        [7, 5],
      ]),
    );
  }
  return els;
};

// relaciones horizontales: el origen está a la izquierda y el destino a la
// derecha, así la multiplicidad y el rol quedan pegados al destino (CLA-07)
const REL = 200;

const relation = (opts: {
  start?: Arrowhead | null;
  end?: Arrowhead | null;
  dashed?: boolean;
  name?: string;
  /** multiplicidad junto al destino (debajo de la línea) */
  multiplicity?: string;
  /** rol junto al destino (arriba de la línea) */
  role?: string;
  y?: number;
  reverse?: boolean;
}): Skeleton[] => {
  const y = opts.y ?? 0;
  // al revés, la flecha nace a la derecha y el destino queda a la izquierda
  const els: Skeleton[] = [
    arrow(
      opts.reverse ? REL : 0,
      y,
      [
        [0, 0],
        [opts.reverse ? -REL : REL, 0],
      ],
      opts,
    ),
  ];
  // con punta en el destino, los textos se corren para no pisarla
  const inset = opts.end ? 22 : 6;
  const targetX = opts.reverse ? inset : REL - inset;
  if (opts.name) {
    els.push(text(REL / 2, y - 24, opts.name, { center: true }));
  }
  if (opts.role) {
    els.push(
      text(targetX, y - 22, opts.role, {
        size: SMALL,
        right: !opts.reverse,
      }),
    );
  }
  if (opts.multiplicity) {
    els.push(
      text(targetX, y + 4, opts.multiplicity, {
        size: SMALL,
        right: !opts.reverse,
      }),
    );
  }
  return els;
};

/** relación vertical de abajo (hijo) hacia arriba (padre) */
const upward = (opts: {
  end: Arrowhead;
  dashed?: boolean;
  label?: string;
}): Skeleton[] => {
  const els: Skeleton[] = [
    arrow(
      40,
      130,
      [
        [0, 0],
        [0, -130],
      ],
      { end: opts.end, dashed: opts.dashed },
    ),
  ];
  if (opts.label) {
    els.push(text(50, 55, opts.label, { size: SMALL }));
  }
  return els;
};

const lifeline = (x: number, y: number, length = 240) =>
  line(
    x,
    y,
    [
      [0, 0],
      [0, length],
    ],
    { dashed: true },
  );

const tabbedFolder = (
  x: number,
  y: number,
  opts: { name?: string; tabName?: string; body?: string; footer?: string },
): Skeleton[] => {
  const els: Skeleton[] = [rect(x, y, 70, 20), rect(x, y + 20, 220, 110)];
  if (opts.tabName) {
    els.push(text(x + 8, y + 1, opts.tabName, { size: SMALL }));
  }
  if (opts.name) {
    els.push(text(x + 110, y + 60, opts.name, { center: true }));
  }
  if (opts.body) {
    els.push(text(x + 12, y + 32, opts.body, { size: SMALL }));
  }
  if (opts.footer) {
    els.push(text(x + 8, y + 106, opts.footer, { size: SMALL }));
  }
  return els;
};

const MULTIPLICITIES: { value: string; hint: string }[] = [
  { value: "1", hint: "Exactamente uno" },
  { value: "0..1", hint: "Cero o uno" },
  { value: "n", hint: "Muchos (cero o más). Booch escribe N; UML, *" },
  { value: "0..n", hint: "Cero o más" },
  { value: "1..n", hint: "Uno o más" },
  { value: "n..m", hint: "Rango" },
  { value: "*", hint: "Muchos, notación UML (libro del Proceso Unificado)" },
  { value: "1..*", hint: "Uno o más, notación UML" },
];

const note = (id: string): DiagramPiece => ({
  id,
  name: "Nota",
  hint: "Esquina doblada; se une al elemento con línea discontinua sin puntas. Sin unir, comenta todo el diagrama.",
  keywords: "comentario",
  build: () => [
    ...noteShape(0, 0, "Comentario"),
    line(
      -70,
      35,
      [
        [0, 0],
        [70, 0],
      ],
      { dashed: true },
    ),
  ],
});

// ---------------------------------------------------------------------------
// secciones
// ---------------------------------------------------------------------------

export const DIAGRAM_SECTIONS: DiagramSection[] = [
  {
    id: "clases",
    title: "Diagrama de clases",
    description: "Clases, atributos, operaciones y sus relaciones.",
    icon: "clases",
    groups: [
      {
        title: "Clases",
        pieces: [
          {
            id: "clase",
            name: "Clase",
            hint: "Nombre / atributos / operaciones. Operaciones con (), atributos sin (CLA-03).",
            build: () =>
              classBox(0, 0, "Clase", {
                attributes: ["- atributo : Tipo"],
                operations: ["+ operacion() : Tipo"],
              }),
          },
          {
            id: "clase-simple",
            name: "Clase (solo nombre)",
            hint: "Sin miembros se elimina la línea de separación.",
            build: () => [rect(0, 0, 180, 50, { label: "Clase" })],
          },
          {
            id: "clase-abstracta",
            name: "Clase abstracta",
            hint: "Nombre en cursiva (UML). Excalidraw no tiene cursiva: se marca con {abstract} (CLA-02).",
            keywords: "abstract",
            build: () =>
              classBox(0, 0, "ClaseAbstracta", {
                nameNote: "{abstract}",
                attributes: ["# atributo : Tipo"],
                operations: ["+ operacion() : Tipo"],
              }),
          },
          {
            id: "interfaz",
            name: "Interfaz",
            hint: "Círculo pequeño («piruleta») con el nombre debajo.",
            keywords: "interface piruleta",
            build: () => [
              ellipse(0, 0, 26, 26),
              text(13, 32, "IInterfaz", { center: true }),
            ],
          },
          {
            id: "clase-activa",
            name: "Clase activa",
            hint: "Borde grueso: sus instancias tienen hilo de control propio.",
            build: () => classBox(0, 0, "ClaseActiva", { strokeWidth: 4 }),
          },
        ],
      },
      {
        title: "Relaciones",
        pieces: [
          {
            id: "asociacion",
            name: "Asociación",
            hint: "Línea continua sin puntas. Multiplicidad en UN solo extremo: el de destino (CLA-07).",
            build: () =>
              relation({ end: null, name: "nombre", multiplicity: "1" }),
          },
          {
            id: "asociacion-navegable",
            name: "Asociación navegable",
            hint: "Flecha abierta hacia la clase conocida. Rol arriba y multiplicidad abajo, solo en el destino (CLA-07).",
            keywords: "dirigida",
            build: () =>
              relation({
                end: "arrow",
                name: "nombre",
                role: "rol",
                multiplicity: "0..n",
              }),
          },
          {
            id: "asociacion-doble",
            name: "Asociación en ambos sentidos",
            hint: "Si hace falta multiplicidad de los dos lados: DOS flechas, cada una con su multiplicidad en su destino (CLA-08).",
            keywords: "bidireccional dos flechas",
            build: () => [
              ...relation({ end: "arrow", name: "nombre", multiplicity: "1" }),
              ...relation({
                end: "arrow",
                name: "nombre inverso",
                multiplicity: "0..n",
                y: 60,
                reverse: true,
              }),
            ],
          },
          {
            id: "generalizacion",
            name: "Generalización",
            hint: "Triángulo hueco en la superclase, sin multiplicidad (CLA-05, CLA-06). Superclase arriba.",
            keywords: "herencia es un",
            build: () => upward({ end: "triangle_outline" }),
          },
          {
            id: "agregacion",
            name: "Agregación",
            hint: "Rombo vacío del lado del TODO; multiplicidad del lado de la parte (CLA-09).",
            keywords: "todo parte tiene",
            build: () =>
              relation({
                start: "diamond_outline",
                end: null,
                multiplicity: "1..n",
              }),
          },
          {
            id: "composicion",
            name: "Composición",
            hint: "Rombo relleno del lado del TODO; la parte vive y muere con él (CLA-09, CLA-10).",
            keywords: "todo parte",
            build: () =>
              relation({ start: "diamond", end: null, multiplicity: "1..n" }),
          },
          {
            id: "dependencia",
            name: "Dependencia (uso)",
            hint: "Discontinua con flecha abierta hacia el proveedor: parámetro, retorno o variable local (CLA-15).",
            keywords: "uso usa",
            build: () => relation({ end: "arrow", dashed: true }),
          },
          {
            id: "realizacion",
            name: "Realización",
            hint: "Clase → interfaz. Discontinua con triángulo hueco. No está dibujada en los libros (UML general).",
            keywords: "implementa interfaz",
            build: () => upward({ end: "triangle_outline", dashed: true }),
          },
          {
            id: "clase-asociacion",
            name: "Clase de asociación",
            hint: "Cuelga de la asociación con línea discontinua. Máximo una por asociación (CLA-11).",
            keywords: "asociacion atribuida",
            build: () => [
              line(0, 0, [
                [0, 0],
                [REL, 0],
              ]),
              line(
                REL / 2,
                0,
                [
                  [0, 0],
                  [0, 50],
                ],
                { dashed: true },
              ),
              rect(REL / 2 - 80, 50, 160, 44, { label: "ClaseAsociacion" }),
            ],
          },
        ],
      },
      {
        title: "Multiplicidad, roles y restricciones",
        pieces: [
          ...MULTIPLICITIES.map(
            (m): DiagramPiece => ({
              id: `mult-${m.value}`,
              name: m.value,
              hint: `${m.hint}. Va junto al extremo de destino (CLA-07).`,
              keywords: "multiplicidad cardinalidad",
              build: () => [text(0, 0, m.value)],
            }),
          ),
          {
            id: "rol",
            name: "Rol",
            hint: "Junto a la clase que cumple el papel, arriba de la línea.",
            build: () => [text(0, 0, "rol", { size: SMALL })],
          },
          {
            id: "restriccion",
            name: "Restricción",
            hint: "Entre llaves, junto a la clase o la relación (CLA-20).",
            build: () => [text(0, 0, "{restricción}", { size: SMALL })],
          },
          note("clases-nota"),
        ],
      },
      {
        title: "Clases de análisis",
        pieces: (
          [
            [
              "boundary",
              "Clase de interfaz",
              "«boundary». Asociada al menos a un actor (CLA-19).",
            ],
            [
              "entity",
              "Clase de entidad",
              "«entity». Información de vida larga, persistente.",
            ],
            [
              "control",
              "Clase de control",
              "«control». Coordina un caso de uso.",
            ],
          ] as const
        ).map(
          ([kind, name, hint]): DiagramPiece => ({
            id: `analisis-${kind}`,
            name,
            hint,
            keywords: `${kind} analisis`,
            build: () => [
              ...analysisIcon(0, 0, kind),
              text(30, 50, name.replace("Clase de ", ""), { center: true }),
            ],
          }),
        ),
      },
      {
        title: "Notación Booch (libro A)",
        pieces: [
          {
            id: "booch-posesion",
            name: "Posesión (Booch)",
            hint: "Agregación de Booch: círculo relleno del lado del todo.",
            keywords: "agregacion has tiene booch",
            build: () =>
              relation({ start: "circle", end: null, multiplicity: "N" }),
          },
          {
            id: "booch-uso",
            name: "Uso (Booch)",
            hint: "Circunferencia hueca del lado del CLIENTE (al revés que la dependencia UML).",
            keywords: "using booch",
            build: () => relation({ start: "circle_outline", end: null }),
          },
          {
            id: "booch-herencia",
            name: "Herencia (Booch)",
            hint: "Punta rellena hacia la superclase. En UML se usa el triángulo hueco.",
            keywords: "generalizacion booch",
            build: () => upward({ end: "triangle" }),
          },
          {
            id: "booch-abstracta",
            name: "Clase abstracta (Booch)",
            hint: "Triángulo con una A dentro del ícono de la clase.",
            keywords: "abstract booch",
            build: () => [
              ...classBox(0, 0, "Actuador", {
                operations: ["activar()", "desactivar()"],
              }),
              line(8, 88, [
                [0, 18],
                [10, 0],
                [20, 18],
                [0, 18],
              ]),
              text(18, 94, "A", { size: 10, center: true }),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "objetos",
    title: "Diagrama de objetos",
    description: "Instancias, enlaces y mensajes numerados (colaboración).",
    icon: "objetos",
    groups: [
      {
        pieces: [
          {
            id: "objeto",
            name: "Objeto",
            hint: "Nombre subrayado: nombre : Clase (OBJ-03).",
            keywords: "instancia",
            build: () => objectBox(0, 0, "nombre : Clase", "o"),
          },
          {
            id: "objeto-anonimo",
            name: "Objeto anónimo",
            hint: ":Clase subrayado. Cada objeto anónimo es un objeto distinto.",
            build: () => objectBox(0, 0, ":Clase", "o", { width: 150 }),
          },
          {
            id: "objeto-atributos",
            name: "Objeto con atributos",
            hint: "Atributos con su valor.",
            build: () =>
              objectBox(0, 0, "nombre : Clase", "o", {
                attributes: ["atributo = valor"],
              }),
          },
          {
            id: "enlace",
            name: "Enlace",
            hint: "Línea continua. Solo si existe una asociación entre las clases (OBJ-01).",
            build: () => [
              line(0, 0, [
                [0, 0],
                [REL, 0],
              ]),
            ],
          },
          {
            id: "mensaje-enlace",
            name: "Mensaje numerado",
            hint: "Flecha corta paralela al enlace, hacia el receptor. Numerado desde 1 (OBJ-04, OBJ-05).",
            keywords: "colaboracion secuencia",
            build: () => [
              line(0, 0, [
                [0, 0],
                [REL, 0],
              ]),
              arrow(70, -12, [
                [0, 0],
                [60, 0],
              ]),
              text(REL / 2, -38, "1: operacion()", {
                center: true,
                size: SMALL,
              }),
            ],
          },
          {
            id: "actor-objeto",
            name: "Actor",
            hint: "En colaboración, el actor lleva :Nombre subrayado.",
            build: () => stickFigure(0, 0, ":Actor", { underlineKey: "a" }),
          },
          ...(
            [
              ["boundary", ":Interfaz"],
              ["entity", ":Entidad"],
              ["control", ":Control"],
            ] as const
          ).map(
            ([kind, name]): DiagramPiece => ({
              id: `objeto-${kind}`,
              name: `Objeto de ${
                kind === "boundary"
                  ? "interfaz"
                  : kind === "entity"
                  ? "entidad"
                  : "control"
              }`,
              hint: "En análisis, el objeto se dibuja con el ícono de su estereotipo.",
              keywords: `${kind} analisis colaboracion`,
              build: () => [
                ...analysisIcon(0, 0, kind),
                text(30, 50, name, { center: true, id: `${kind}-name` }),
                underline(`${kind}-name`),
              ],
            }),
          ),
          note("objetos-nota"),
        ],
      },
    ],
  },
  {
    id: "casos-de-uso",
    title: "Diagrama de casos de uso",
    description: "Actores y las funcionalidades que usan.",
    icon: "casos",
    groups: [
      {
        pieces: [
          {
            id: "actor",
            name: "Actor",
            hint: "Un rol externo al sistema (persona, sistema, dispositivo) (CU-03).",
            build: () => stickFigure(0, 0, "Actor"),
          },
          {
            id: "caso-de-uso",
            name: "Caso de uso",
            hint: "Elipse; verbo + objeto. Debe dar un resultado de valor a un actor (CU-01).",
            build: () => [ellipse(0, 0, 190, 70, { label: "Caso de uso" })],
          },
          {
            id: "asociacion-actor",
            name: "Asociación actor–caso",
            hint: "Línea continua sin flechas (CU-02).",
            keywords: "comunicacion",
            build: () => [
              line(0, 0, [
                [0, 0],
                [160, 0],
              ]),
            ],
          },
          {
            id: "cu-generalizacion",
            name: "Generalización",
            hint: "Triángulo hueco del lado del caso general (abstracto) (CU-06).",
            keywords: "herencia uses",
            build: () => relation({ end: "triangle_outline" }),
          },
          {
            id: "cu-extend",
            name: "«extend»",
            hint: "Discontinua, apunta al caso de uso BASE (el extendido) (CU-05).",
            keywords: "extension",
            build: () =>
              relation({ end: "arrow", dashed: true, name: "«extend»" }),
          },
          {
            id: "cu-include",
            name: "«include»",
            hint: "Discontinua, del caso base al incluido. El libro casi no lo dibuja (UML general).",
            keywords: "inclusion",
            build: () =>
              relation({ end: "arrow", dashed: true, name: "«include»" }),
          },
          {
            id: "limite-sistema",
            name: "Límite del sistema",
            hint: "Los libros no lo dibujan (UML general). Actores afuera, casos adentro.",
            keywords: "sistema frontera",
            build: () => [
              rect(0, 0, 340, 240),
              text(170, 10, "Sistema", { center: true }),
            ],
          },
          {
            id: "realizacion-cu",
            name: "Realización de caso de uso",
            hint: "Elipse discontinua; se une al caso de uso con «trace».",
            keywords: "colaboracion trace",
            build: () => [
              ellipse(0, 0, 190, 70, { dashed: true, label: "Realización" }),
            ],
          },
          {
            id: "actor-generalizacion",
            name: "Generalización de actores",
            hint: "Triángulo hueco hacia el actor general. No está en los libros (UML general).",
            build: () => upward({ end: "triangle_outline" }),
          },
        ],
      },
    ],
  },
  {
    id: "secuencia",
    title: "Diagrama de secuencia",
    description: "Interacción entre objetos a lo largo del tiempo.",
    icon: "secuencia",
    groups: [
      {
        pieces: [
          {
            id: "linea-de-vida",
            name: "Objeto con línea de vida",
            hint: "Cabecera con el objeto subrayado y línea vertical discontinua (SEC-02, SEC-04).",
            keywords: "lifeline participante",
            build: () => [
              ...objectBox(0, 0, ":Clase", "o", { width: 140 }),
              lifeline(70, 38),
            ],
          },
          {
            id: "actor-linea-de-vida",
            name: "Actor con línea de vida",
            hint: "El actor que inicia va a la izquierda (SEC-06).",
            build: () => [
              ...stickFigure(0, 0, ":Actor", { underlineKey: "a" }),
              lifeline(20, 96, 200),
            ],
          },
          {
            id: "activacion",
            name: "Foco de control",
            hint: "Rectángulo angosto sobre la línea de vida mientras el objeto tiene el control.",
            keywords: "activacion",
            build: () => [rect(0, 0, 14, 110, { fill: "#ffffff" })],
          },
          {
            id: "mensaje",
            name: "Mensaje",
            hint: "Línea continua con punta rellena, del emisor al receptor (SEC-03).",
            keywords: "llamada sincrono",
            build: () => [
              arrow(
                0,
                0,
                [
                  [0, 0],
                  [REL, 0],
                ],
                { end: "triangle" },
              ),
              text(REL / 2, -24, "operacion()", { center: true }),
            ],
          },
          {
            id: "retorno",
            name: "Retorno",
            hint: "Línea discontinua con punta abierta hacia el llamador (SEC-07).",
            build: () => [
              arrow(
                REL,
                0,
                [
                  [0, 0],
                  [-REL, 0],
                ],
                { dashed: true },
              ),
              text(REL / 2, -24, "resultado", { center: true, size: SMALL }),
            ],
          },
          {
            id: "mensaje-a-si-mismo",
            name: "Mensaje a sí mismo",
            hint: "Sale y vuelve a la misma línea de vida.",
            keywords: "recursion",
            build: () => [
              arrow(
                0,
                0,
                [
                  [0, 0],
                  [50, 0],
                  [50, 36],
                  [0, 36],
                ],
                { end: "triangle" },
              ),
              text(58, 8, "operacion()", { size: SMALL }),
            ],
          },
          {
            id: "creacion",
            name: "Creación «create»",
            hint: "La flecha termina en la cabecera del objeto nuevo, más abajo que las demás.",
            keywords: "crear create",
            build: () => [
              arrow(
                0,
                20,
                [
                  [0, 0],
                  [160, 0],
                ],
                { end: "triangle" },
              ),
              text(80, -4, "«create»", { center: true, size: SMALL }),
              ...objectBox(164, 0, "p : Clase", "o", { width: 130 }),
              lifeline(229, 38, 140),
            ],
          },
          {
            id: "destruccion",
            name: "Destrucción «destroy»",
            hint: "Mensaje «destroy» y una X al final de la línea de vida.",
            keywords: "destruir destroy",
            build: () => [
              lifeline(200, -80, 80),
              arrow(
                0,
                0,
                [
                  [0, 0],
                  [188, 0],
                ],
                { end: "triangle" },
              ),
              text(94, -24, "«destroy»", { center: true, size: SMALL }),
              line(
                188,
                -12,
                [
                  [0, 0],
                  [24, 24],
                ],
                { strokeWidth: 2 },
              ),
              line(
                188,
                -12,
                [
                  [0, 24],
                  [24, 0],
                ],
                { strokeWidth: 2 },
              ),
            ],
          },
          {
            id: "guion",
            name: "Guión (Booch)",
            hint: "Condiciones e iteraciones escritas a la izquierda, alineadas con los mensajes.",
            keywords: "condicion script booch",
            build: () => [
              text(
                0,
                0,
                "Si condición entonces\n  mensaje\nsino\n  otro mensaje",
                {
                  size: SMALL,
                },
              ),
            ],
          },
          {
            id: "fragmento",
            name: "Fragmento alt / loop",
            hint: "No está en los libros (UML 2). Los libros usan el guión de la izquierda.",
            keywords: "alt loop opt condicion",
            build: () => [
              rect(0, 0, 320, 170),
              line(0, 0, [
                [0, 0],
                [0, 24],
                [44, 24],
                [54, 14],
                [54, 0],
              ]),
              text(8, 3, "alt", { size: SMALL }),
              text(64, 30, "[condición]", { size: SMALL }),
              line(
                0,
                90,
                [
                  [0, 0],
                  [320, 0],
                ],
                { dashed: true },
              ),
              text(64, 96, "[sino]", { size: SMALL }),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "estados",
    title: "Diagrama de estados",
    description: "Estados de un objeto y sus transiciones.",
    icon: "estados",
    groups: [
      {
        pieces: [
          {
            id: "estado",
            name: "Estado",
            hint: "Rectángulo redondeado. Nombre único en su ámbito (EST-03).",
            build: () => [
              rect(0, 0, 150, 54, { rounded: true, label: "Estado" }),
            ],
          },
          {
            id: "estado-acciones",
            name: "Estado con acciones",
            hint: "Nombre, línea y acciones: entrada / salida / hacer.",
            keywords: "entry exit do",
            build: () => [
              rect(0, 0, 210, 100, { rounded: true }),
              text(105, 8, "Estado", { center: true }),
              line(0, 36, [
                [0, 0],
                [210, 0],
              ]),
              text(10, 44, "entrada acción\nsalida acción\nhacer actividad", {
                size: SMALL,
              }),
            ],
          },
          {
            id: "estado-inicial",
            name: "Estado inicial",
            hint: "Círculo relleno. Exactamente uno, con transición sin etiqueta (EST-01).",
            build: () => [ellipse(0, 0, 22, 22, { fill: INK })],
          },
          {
            id: "estado-final",
            name: "Estado final",
            hint: "Círculo relleno dentro de otro hueco.",
            keywords: "parada",
            build: () => [
              ellipse(0, 0, 28, 28),
              ellipse(6, 6, 16, 16, { fill: INK }),
            ],
          },
          {
            id: "transicion",
            name: "Transición",
            hint: "Flecha abierta. Etiqueta: evento [condición] / acción (EST-06).",
            keywords: "evento guarda",
            build: () => [
              arrow(0, 0, [
                [0, 0],
                [240, 0],
              ]),
              text(120, -24, "evento [condición] / acción", {
                center: true,
                size: SMALL,
              }),
            ],
          },
          {
            id: "superestado",
            name: "Superestado",
            hint: "Estado compuesto: está en exactamente uno de sus subestados.",
            keywords: "compuesto subestado anidado",
            build: () => [
              rect(0, 0, 380, 190, { rounded: true }),
              text(14, 8, "Superestado"),
              ellipse(24, 92, 18, 18, { fill: INK }),
              arrow(44, 101, [
                [0, 0],
                [36, 0],
              ]),
              rect(82, 74, 110, 54, { rounded: true, label: "Subestado A" }),
              arrow(194, 101, [
                [0, 0],
                [58, 0],
              ]),
              rect(254, 74, 110, 54, { rounded: true, label: "Subestado B" }),
            ],
          },
          {
            id: "historia",
            name: "Historia",
            hint: "H dentro de un círculo, dentro del superestado. H* para todos los niveles.",
            build: () => [ellipse(0, 0, 30, 30, { label: "H" })],
          },
          note("estados-nota"),
        ],
      },
    ],
  },
  {
    id: "paquetes",
    title: "Diagrama de paquetes",
    description: "Categorías de clases y sus dependencias.",
    icon: "paquetes",
    groups: [
      {
        pieces: [
          {
            id: "paquete",
            name: "Paquete",
            hint: "Carpeta con pestaña. Nombre único y distinto al de cualquier clase (PAQ-02).",
            keywords: "categoria",
            build: () => tabbedFolder(0, 0, { name: "Paquete" }),
          },
          {
            id: "paquete-clases",
            name: "Paquete con clases",
            hint: "Nombre en la pestaña y las clases «interesantes» adentro.",
            keywords: "categoria",
            build: () =>
              tabbedFolder(0, 0, {
                tabName: "Paquete",
                body: "ClaseA\nClaseB",
              }),
          },
          {
            id: "paquete-global",
            name: "Paquete global (Booch)",
            hint: "global abajo a la izquierda: lo usan todas las demás categorías.",
            build: () =>
              tabbedFolder(0, 0, { name: "Paquete", footer: "global" }),
          },
          {
            id: "paquete-dependencia",
            name: "Dependencia",
            hint: "Entre paquetes solo hay «utiliza»: discontinua con flecha abierta.",
            keywords: "utiliza uso",
            build: () => relation({ end: "arrow", dashed: true }),
          },
        ],
      },
    ],
  },
  {
    id: "fisicos",
    title: "Componentes y despliegue",
    description: "Componentes, nodos y sus dependencias.",
    icon: "fisicos",
    groups: [
      {
        pieces: [
          {
            id: "componente",
            name: "Componente",
            hint: "Rectángulo con dos rectángulos chicos a la izquierda.",
            build: () => [
              rect(0, 0, 170, 80, { label: "componente" }),
              rect(-14, 14, 28, 14, { fill: "#ffffff" }),
              rect(-14, 44, 28, 14, { fill: "#ffffff" }),
            ],
          },
          {
            id: "nodo",
            name: "Nodo",
            hint: "Cubo 3D: un recurso de cómputo (servidor, dispositivo).",
            keywords: "servidor despliegue",
            build: () => [
              rect(0, 18, 170, 90, { label: "Nodo" }),
              line(0, 0, [
                [0, 18],
                [18, 0],
                [188, 0],
                [170, 18],
              ]),
              line(170, 0, [
                [18, 0],
                [18, 90],
                [0, 108],
              ]),
            ],
          },
          {
            id: "fisico-dependencia",
            name: "Dependencia",
            hint: "Hacia el elemento del que se depende. Sin ciclos (MOD-01).",
            keywords: "compilacion",
            build: () => relation({ end: "arrow", dashed: true }),
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// conversión a elementos de Excalidraw
// ---------------------------------------------------------------------------

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const finishPiece = (
  pieceId: string,
  skeleton: Skeleton[],
): NonDeleted<ExcalidrawElement>[] => {
  // ids fijos para poder referenciar textos (subrayados); se prefijan con la
  // pieza para que no choquen entre piezas
  const prefixed = skeleton.map((el, i) => ({
    ...el,
    id: `${pieceId}-${el.id ?? i}`,
    customData: el.customData
      ? {
          ...el.customData,
          ...(typeof el.customData.underline === "string"
            ? { underline: `${pieceId}-${el.customData.underline}` }
            : {}),
        }
      : undefined,
  }));
  const elements = convertToExcalidrawElements(
    prefixed as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  ) as Mutable<ExcalidrawElement>[];

  // el anclaje centro/derecha de los textos ya lo aplica newTextElement según
  // textAlign; acá solo queda ajustar los subrayados al ancho real del texto
  const byId = new Map(elements.map((el) => [el.id, el]));
  for (const el of elements) {
    const data = el.customData as Record<string, unknown> | undefined;
    if (data && typeof data.underline === "string") {
      const target = byId.get(data.underline);
      if (target && el.type === "line") {
        Object.assign(el, {
          x: target.x,
          y: target.y + target.height + 1,
          width: target.width,
          height: 0,
          points: points([
            [0, 0],
            [target.width, 0],
          ]),
        });
      }
    }
    delete el.customData;
  }

  // todo lo de una pieza de varios elementos queda agrupado para moverlo
  // junto, salvo las relaciones (hay que poder arrastrar sus extremos)
  const isRelation = elements.some((el) => el.type === "arrow");
  if (elements.length > 1 && !isRelation) {
    for (const el of elements) {
      el.groupIds = [...el.groupIds, `${pieceId}-group`];
    }
  }
  return elements as NonDeleted<ExcalidrawElement>[];
};

const cache = new Map<string, NonDeleted<ExcalidrawElement>[]>();

export const getPieceElements = (piece: DiagramPiece) => {
  let elements = cache.get(piece.id);
  if (!elements) {
    elements = finishPiece(piece.id, piece.build());
    cache.set(piece.id, elements);
  }
  return elements;
};

export const ALL_PIECES = DIAGRAM_SECTIONS.flatMap((section) =>
  section.groups.flatMap((group) =>
    group.pieces.map((piece) => ({ section, piece })),
  ),
);

// Los textos se miden al armar la pieza: si Nunito todavía no cargó, se mide
// con la fuente de reemplazo y los centrados y subrayados quedan corridos.
// Por eso primero se cargan las fuentes y recién después se arman las piezas.
let fontsLoaded = false;
let fontsLoading: Promise<void> | null = null;

export const arePieceFontsLoaded = () => fontsLoaded;

export const loadPieceFonts = () => {
  fontsLoading ??= Fonts.loadElementsFonts(
    ALL_PIECES.flatMap(({ piece }) => getPieceElements(piece)),
  )
    .catch(() => {})
    .then(() => {
      cache.clear();
      fontsLoaded = true;
    });
  return fontsLoading;
};
