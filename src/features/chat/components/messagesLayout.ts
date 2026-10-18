/**
 * Geometry the messages page and its skeleton share, so the skeleton cannot
 * drift a pixel from the page it stands in for.
 *
 * The frame is a bordered card from `sm` up (a naked `bg-background` strip
 * shows a seam against the textured page background) and edge to edge on a
 * phone, where every pixel of width belongs to the conversation.
 */
export const MESSAGES_FRAME_CLASS =
  "flex flex-1 min-h-0 overflow-clip bg-background border-t sm:mx-6 sm:mb-6 sm:rounded-lg sm:border";

/**
 * Both column headers are the same fixed height - the thread's carries a
 * second line (presence), the inbox's does not, and they sit side by side.
 */
export const MESSAGES_HEADER_CLASS =
  "flex h-16 shrink-0 items-center gap-2 border-b px-4";
