declare module 'html5-qrcode' {
  export class Html5Qrcode {
    constructor(elementId: string, config?: any);
    start(
      cameraIdOrConfig: any,
      configuration: any,
      qrCodeSuccessCallback: (decodedText: string, result: any) => void,
      qrCodeErrorCallback?: (errorMessage: string) => void
    ): Promise<null>;
    stop(): Promise<void>;
    clear(): Promise<void>;
    getState(): number;
    static getCameras(): Promise<Array<{ id: string; label: string }>>;
  }
}
