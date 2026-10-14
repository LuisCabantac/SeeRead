import { useMemo } from "react";
import { parseAnnotations, type Segment } from "../../core/annotations";
import { buildRenderModel, type Paragraph } from "../../core/render";
import type { Settings } from "../../core/settings";
import { speechTokens, type SpeechToken } from "../../core/tokens";

export interface ScriptModel {
  segments: Segment[];
  tokens: SpeechToken[];
  paragraphs: Paragraph[];
}

export function buildScriptModel(text: string, annotations: Settings["annotations"]): ScriptModel {
  const segments = parseAnnotations(text, annotations);
  const tokens = speechTokens(text, segments, annotations.ignoreInMatching);
  const paragraphs = buildRenderModel(text, segments, tokens, annotations.visible);
  return { segments, tokens, paragraphs };
}

export function useScriptModel(text: string, annotations: Settings["annotations"]): ScriptModel {
  // Settings objects are recreated on every change; rebuild only when annotation rules
  // actually change, so unrelated setting changes don't re-render the script mid-read.
  const rules = JSON.stringify(annotations);
  return useMemo(() => buildScriptModel(text, JSON.parse(rules)), [text, rules]);
}
