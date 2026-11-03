/** A rectangle on a PDF page, in PDF points (origin bottom-left), so it matches what the server draws into. */
export interface Box { id: string; label: string; page: number; x: number; y: number; w: number; h: number }
