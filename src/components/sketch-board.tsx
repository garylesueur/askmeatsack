"use client";

import { useEffect, useId, useRef, useState } from "react";
import type Konva from "konva";
import { Arrow, Ellipse, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import { Button } from "@/components/ui/button";
import type { SketchScene, SketchShape } from "@/lib/schema";

const BOARD_HEIGHT = 360;
type Tool = SketchShape["type"];

function newId(): string {
  return crypto.randomUUID();
}

function toBoard(scene: SketchScene | undefined): SketchScene {
  return { shapes: scene?.shapes ?? [] };
}

export function SketchBoard({
  scene,
  disabled,
  backgroundUrl,
  onChange,
}: {
  scene: SketchScene | undefined;
  disabled?: boolean;
  backgroundUrl?: string;
  onChange: (next: SketchScene, snapshotPng?: string) => void;
}) {
  const [tool, setTool] = useState<Tool>("pen");
  const [width, setWidth] = useState(640);
  const [draft, setDraft] = useState<SketchShape | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const history = useRef<SketchScene[]>([toBoard(scene)]);
  const labelId = useId();

  useEffect(() => {
    if (!backgroundUrl) {
      setBackgroundImage(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => {
      setBackgroundImage(image);
    });
    image.src = backgroundUrl;
  }, [backgroundUrl]);

  function emit(next: SketchScene) {
    onChange(next);
    requestAnimationFrame(() => {
      const dataUrl = stageRef.current?.toDataURL({ mimeType: "image/png", pixelRatio: 2 });
      if (dataUrl) {
        onChange(next, dataUrl);
      }
    });
  }

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) {
      return;
    }
    const update = () => {
      setWidth(Math.max(240, node.clientWidth));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const current = toBoard(scene);
  const shapes = draft ? [...current.shapes, draft] : current.shapes;

  function commit(next: SketchScene) {
    history.current = [...history.current, next];
    emit(next);
  }

  function onPointerDown(event: {
    target: {
      getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null;
    };
  }) {
    if (disabled) {
      return;
    }
    const point = event.target.getStage()?.getPointerPosition();
    if (!point) {
      return;
    }
    const x = point.x / width;
    const y = point.y / BOARD_HEIGHT;
    if (tool === "pen") {
      setDraft({ id: newId(), type: "pen", points: [{ x, y }] });
      return;
    }
    if (tool === "text") {
      const words = labelDraft.trim();
      if (!words) {
        return;
      }
      commit({
        shapes: [...current.shapes, { id: newId(), type: "text", x, y, label: words }],
      });
      return;
    }
    if (tool === "line" || tool === "arrow") {
      setDraft({ id: newId(), type: tool, from: { x, y }, to: { x, y } });
      return;
    }
    setDraft({ id: newId(), type: tool, x, y, width: 0, height: 0 });
  }

  function onPointerMove(event: {
    target: {
      getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null;
    };
  }) {
    if (!draft || disabled) {
      return;
    }
    const point = event.target.getStage()?.getPointerPosition();
    if (!point) {
      return;
    }
    const x = Math.min(1, Math.max(0, point.x / width));
    const y = Math.min(1, Math.max(0, point.y / BOARD_HEIGHT));
    if (draft.type === "pen") {
      setDraft({ ...draft, points: [...draft.points, { x, y }] });
      return;
    }
    if (draft.type === "line" || draft.type === "arrow") {
      setDraft({ ...draft, to: { x, y } });
      return;
    }
    if (draft.type === "text") {
      return;
    }
    setDraft({
      ...draft,
      width: Math.max(0, x - draft.x),
      height: Math.max(0, y - draft.y),
    });
  }

  function onPointerUp() {
    if (!draft || disabled) {
      return;
    }
    commit({ shapes: [...current.shapes, draft] });
    setDraft(null);
  }

  function undo() {
    if (history.current.length < 2) {
      return;
    }
    history.current = history.current.slice(0, -1);
    const previous = history.current[history.current.length - 1];
    if (previous) {
      emit(previous);
    }
  }

  function clearBoard() {
    commit({ shapes: [] });
  }

  return (
    <div className="flex flex-col gap-3" ref={wrapRef}>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["pen", "Pen"],
            ["line", "Line"],
            ["rectangle", "Box"],
            ["ellipse", "Ellipse"],
            ["arrow", "Arrow"],
            ["text", "Label"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tool === id ? "default" : "outline"}
            disabled={disabled}
            onClick={() => {
              setTool(id);
            }}
          >
            {label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={undo}>
          Undo
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={clearBoard}>
          Clear
        </Button>
      </div>
      {tool === "text" ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor={labelId}>
          Label text
          <input
            id={labelId}
            className="rounded-md border border-input bg-background px-2 py-1"
            value={labelDraft}
            disabled={disabled}
            maxLength={100}
            onChange={(event) => {
              setLabelDraft(event.target.value);
            }}
          />
        </label>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <Stage
          ref={stageRef}
          width={width}
          height={BOARD_HEIGHT}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          <Layer>
            <Rect width={width} height={BOARD_HEIGHT} fill="#ffffff" listening={false} />
            {backgroundImage ? (
              <KonvaImage
                image={backgroundImage}
                width={width}
                height={BOARD_HEIGHT}
                listening={false}
              />
            ) : null}
            {shapes.map((shape) => (
              <DrawnShape key={shape.id} shape={shape} width={width} height={BOARD_HEIGHT} />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

function DrawnShape({
  shape,
  width,
  height,
}: {
  shape: SketchShape;
  width: number;
  height: number;
}) {
  const stroke = "#1a1a1a";
  if (shape.type === "pen") {
    return (
      <Line
        points={shape.points.flatMap((point) => [point.x * width, point.y * height])}
        stroke={stroke}
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
      />
    );
  }
  if (shape.type === "line") {
    return (
      <Line
        points={[
          shape.from.x * width,
          shape.from.y * height,
          shape.to.x * width,
          shape.to.y * height,
        ]}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }
  if (shape.type === "arrow") {
    return (
      <Arrow
        points={[
          shape.from.x * width,
          shape.from.y * height,
          shape.to.x * width,
          shape.to.y * height,
        ]}
        stroke={stroke}
        fill="#1a1a1a"
        strokeWidth={2}
        pointerLength={10}
        pointerWidth={10}
      />
    );
  }
  if (shape.type === "rectangle") {
    return (
      <Rect
        x={shape.x * width}
        y={shape.y * height}
        width={shape.width * width}
        height={shape.height * height}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }
  if (shape.type === "ellipse") {
    return (
      <Ellipse
        x={(shape.x + shape.width / 2) * width}
        y={(shape.y + shape.height / 2) * height}
        radiusX={(shape.width / 2) * width}
        radiusY={(shape.height / 2) * height}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }
  return (
    <Text x={shape.x * width} y={shape.y * height} text={shape.label} fill={stroke} fontSize={16} />
  );
}
