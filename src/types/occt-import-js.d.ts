declare module "occt-import-js" {
  interface OcctMesh {
    name: string;
    color: number[] | null;
    face_position: Float32Array;
    face_normal: Float32Array;
    face_index: Uint32Array | null;
  }

  interface OcctResult {
    meshes: OcctMesh[];
  }

  interface OcctInstance {
    ReadStepFile(buffer: Uint8Array, params: null): OcctResult;
  }

  interface OcctOptions {
    locateFile?: (name: string) => string;
  }

  export default function occtImportJs(options?: OcctOptions): Promise<OcctInstance>;
}
