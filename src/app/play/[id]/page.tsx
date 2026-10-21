import { SavedLevel } from "./SavedLevel";

// Levels are created live during the pitch, so there is nothing to prerender.
export const instant = false;

export default async function PlaySavedPage({ params }: PageProps<"/play/[id]">) {
  const { id } = await params;
  return <SavedLevel id={id} />;
}
