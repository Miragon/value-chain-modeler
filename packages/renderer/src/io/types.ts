export const ROOT_ID = 'vc-root';

export interface ImportWarning {
  message: string;
  connectionId?: string;
}

/** Document-level metadata kept on the root element while editing. */
export interface RootBusinessObject {
  name: string;
}
