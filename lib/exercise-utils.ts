/** Shared exercise presentation helpers (pt-BR labels + media resolution). */

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  legs: "Pernas",
  glutes: "Glúteos",
  core: "Core / Abdômen",
  cardio: "Cardio",
  full_body: "Corpo Inteiro",
};

/**
 * Groups offered as filter chips. cardio/full_body are hidden: no imported
 * exercise maps to them yet (the importer doesn't store the exercise
 * category), so the chips would always return an empty list.
 */
export const FILTERABLE_MUSCLE_GROUPS = Object.entries(MUSCLE_GROUP_LABELS).filter(
  ([value]) => value !== "cardio" && value !== "full_body",
);

export function muscleGroupLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return MUSCLE_GROUP_LABELS[value] ?? value;
}

export type ExerciseMediaFields = {
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
};

export type ExerciseMedia =
  | { kind: "video"; url: string }
  | { kind: "youtube"; ytId: string; embedUrl: string; thumbUrl: string }
  | { kind: "none" };

const DIRECT_VIDEO_RE = /\.(webm|mp4)(\?.*)?$/i;
const YT_ID_RE = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/**
 * Resolves which media an exercise actually has. Importer quirk: some rows
 * carry a direct R2 .webm/.mp4 URL inside youtube_url — those must render as
 * <video>, never as a YouTube thumbnail/iframe.
 */
export function resolveExerciseMedia(ex: ExerciseMediaFields): ExerciseMedia {
  const direct = [ex.video_url, ex.webm_path, ex.youtube_url].find(
    (u): u is string => !!u && DIRECT_VIDEO_RE.test(u),
  );
  if (direct) return { kind: "video", url: direct };

  const ytId = ex.youtube_url?.match(YT_ID_RE)?.[1];
  if (ytId) {
    return {
      kind: "youtube",
      ytId,
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
      thumbUrl: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
    };
  }

  return { kind: "none" };
}
