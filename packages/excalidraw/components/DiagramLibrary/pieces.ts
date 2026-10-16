// Referencias exclusivas: Booch 2.ª edición y Patrones de diseño.
// Las piezas son adaptaciones editables; cada hint identifica la fuente.

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

const cloud = (
  name: string,
  opts: { abstract?: boolean; object?: boolean; members?: string[] } = {},
): Skeleton[] => {
  const w = 270;
  const h = opts.members?.length ? 170 : 125;
  const pts: XY[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = (2 * Math.PI * i) / 160;
    const r = 0.91 + 0.09 * Math.cos(10 * t);
    pts.push([
      w / 2 + (w / 2) * r * Math.cos(t),
      h / 2 + (h / 2) * r * Math.sin(t),
    ]);
  }
  // Rough.js reinicia el patrón de guiones en cada segmento corto. Dibujar
  // los huecos explícitamente evita que una nube muestre contorno continuo.
  const outline = opts.object
    ? [line(0, 0, pts)]
    : pts.flatMap((start, i) =>
        i % 4 === 0 && i < pts.length - 1
          ? [
              line(
                start[0],
                start[1],
                pts
                  .slice(i, i + 3)
                  .map(([x, y]) => [x - start[0], y - start[1]]),
              ),
            ]
          : [],
      );
  const els: Skeleton[] = [...outline, text(w / 2, 26, name, { center: true })];
  if (opts.members?.length) {
    els.push(
      line(48, 51, [
        [0, 0],
        [w - 96, 0],
      ]),
      text(50, 59, opts.members.join("\n"), { size: SMALL }),
    );
  }
  if (opts.abstract) {
    els.push(
      line(81, h - 52, [
        [0, 18],
        [10, 0],
        [20, 18],
        [0, 18],
      ]),
      text(91, h - 45, "A", { size: 10, center: true }),
    );
  }
  return els;
};

const piece = (
  id: string,
  name: string,
  hint: string,
  build: DiagramPiece["build"],
): DiagramPiece => ({ id, name, hint, build });

export const DIAGRAM_SECTIONS: DiagramSection[] = [
  {
    id: "booch-clases",
    title: "Booch · clases",
    icon: "clases",
    description: "2.ª edición · capítulo 5 · nubes, posesión y uso",
    groups: [
      {
        title: "Clases y objetos",
        pieces: [
          piece(
            "booch-clase",
            "Clase",
            "Booch, figura 5.2, p. 205. Nube discontinua; adaptación editable.",
            () =>
              cloud("Clase", { members: ["atributo : Tipo", "operacion()"] }),
          ),
          piece(
            "booch-simple",
            "Clase solo nombre",
            "Booch, p. 206: omitir miembros y separador cuando no son necesarios.",
            () => cloud("Clase"),
          ),
          piece(
            "booch-abstracta",
            "Clase abstracta",
            "Booch, figura 5.3, p. 207. Triángulo A dentro de la nube.",
            () =>
              cloud("Actuador", {
                abstract: true,
                members: ["activar()", "desactivar()"],
              }),
          ),
          piece(
            "booch-objeto",
            "Objeto",
            "Booch, capítulo 5.4, pp. 239-248. Nube continua, no rectángulo UML.",
            () => cloud("unSensor", { object: true, members: ["valor = 20"] }),
          ),
          piece(
            "booch-visibilidad",
            "Visibilidad",
            "Booch, figura 5.12, p. 218. Público sin marca; protegido |, privado ||, implementación |||.",
            () =>
              cloud("Cosecha", {
                members: [
                  "nombreCientifico",
                  "| produccion",
                  "|| valorNutritivo",
                ],
              }),
          ),
        ],
      },
      {
        title: "Relaciones",
        pieces: [
          piece(
            "booch-asociacion",
            "Asociación",
            "Booch, pp. 125-126 y 208. Línea continua; sin flechas implica bidireccionalidad.",
            () => relation({ end: null, name: "relación" }),
          ),
          piece(
            "booch-herencia",
            "Herencia",
            "Booch, figura 5.4, p. 207. Punta rellena hacia la superclase.",
            () => upward({ end: "triangle" }),
          ),
          piece(
            "booch-posesion",
            "Posesión",
            "Booch, figura 5.4, p. 207. Círculo relleno del lado del TODO.",
            () => relation({ start: "circle", end: null, multiplicity: "N" }),
          ),
          piece(
            "booch-uso",
            "Uso",
            "Booch, figura 5.4, p. 207. Circunferencia hueca del lado del CLIENTE.",
            () => relation({ start: "circle_outline", end: null }),
          ),
        ],
      },
      {
        title: "Cardinalidad",
        pieces: ["1", "N", "0..N", "1..N", "0..1", "3..7", "1..3, 7"].map((v) =>
          piece(
            `booch-mult-${v}`,
            v,
            "Booch, p. 208. Cardinalidad junto al extremo que describe; no trasladar el número de partes al todo.",
            () => [text(0, 0, v)],
          ),
        ),
      },
    ],
  },
  {
    id: "patrones-clases",
    title: "Patrones de diseño · OMT",
    icon: "clases",
    description: "Apéndice B · figura B.1 · PDF 411 a 414",
    groups: [
      {
        title: "Clases y objetos",
        pieces: [
          piece(
            "omt-clase",
            "Clase concreta",
            "Figura B.1a. Nombre, operaciones y variables. Adaptación editable: Excalidraw no conserva la negrita del original.",
            () =>
              classBox(0, 0, "ClaseConcreta", {
                attributes: ["Operacion()"],
                operations: ["Tipo variable"],
              }),
          ),
          piece(
            "omt-abstracta",
            "Clase abstracta",
            "Figura B.1a: el nombre y las operaciones abstractas van en cursiva. Para fidelidad tipográfica usar la figura original con consultar_libro.",
            () =>
              classBox(0, 0, "ClaseAbstracta", {
                attributes: ["OperacionAbstracta()"],
              }),
          ),
          piece(
            "omt-cliente",
            "Cliente implícito",
            "Figura B.1b. Cliente gris: participa solo para explicar la interacción.",
            () => [
              { ...rect(0, 0, 160, 48), strokeColor: "#999999" },
              {
                ...text(80, 12, "Cliente", { center: true }),
                strokeColor: "#999999",
              },
            ],
          ),
          piece(
            "omt-objeto",
            "Objeto",
            "Apéndice B.2. Rectángulo redondeado, nombre unAlgo, sin subrayado UML.",
            () => [
              rect(0, 0, 210, 90, { rounded: true }),
              text(105, 12, "unAlgo", { center: true }),
              line(0, 39, [
                [0, 0],
                [210, 0],
              ]),
              text(10, 50, "referencia"),
            ],
          ),
        ],
      },
      {
        title: "Relaciones",
        pieces: [
          piece(
            "omt-herencia",
            "Herencia",
            "Figura B.1c. Triángulo hueco hacia la clase padre.",
            () => upward({ end: "triangle_outline" }),
          ),
          piece(
            "omt-asociacion",
            "Referencia",
            "Figura B.1c. Flecha hacia la clase referenciada.",
            () => relation({ end: "arrow" }),
          ),
          piece(
            "omt-agregacion",
            "Agregación",
            "Figura B.1c. Rombo hueco en la base, flecha hacia la parte referenciada.",
            () => relation({ start: "diamond_outline", end: "arrow" }),
          ),
          piece(
            "omt-muchos",
            "Muchos objetos",
            "Figura B.1c y PDF 414. Círculo relleno junto al objeto referenciado, después de la flecha; no es posesión de Booch.",
            () => [
              arrow(
                0,
                0,
                [
                  [0, 0],
                  [184, 0],
                ],
                { start: "diamond_outline", end: "arrow" },
              ),
              ellipse(190, -4, 8, 8, { fill: INK }),
            ],
          ),
          piece(
            "omt-crea",
            "Crea instancia",
            "Apéndice B.1, PDF 414. Flecha discontinua hacia la clase creada.",
            () => relation({ end: "arrow", dashed: true }),
          ),
        ],
      },
    ],
  },
];
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
