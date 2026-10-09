export const FLOOR_PLAN_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'] as const;
export const REFERENCE_DOCUMENT_EXTENSIONS = ['pdf', 'docx'] as const;

export const FLOOR_PLAN_ACCEPT = '.pdf,.png,.jpg,.jpeg';
export const REFERENCE_DOCUMENT_ACCEPT = '.pdf,.docx';

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isFloorPlanFile(file: File): boolean {
  return FLOOR_PLAN_EXTENSIONS.some(extension => extension === getFileExtension(file.name));
}

export function isReferenceDocument(file: File): boolean {
  return REFERENCE_DOCUMENT_EXTENSIONS.some(
    extension => extension === getFileExtension(file.name)
  );
}
