/**
 * Campaign moodboard guard — post image generation requires a non-placeholder URL.
 */
export function hasUsableMoodboard(moodboardImages: unknown): boolean {
  if (!Array.isArray(moodboardImages)) return false;
  const first = (moodboardImages as unknown[])[0];
  return (
    typeof first === "string" &&
    first.trim() !== "" &&
    !first.startsWith("data:")
  );
}
