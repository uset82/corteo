// sharp 0.35 publishes its declaration file outside the package exports map, so
// bundler module resolution cannot find it. The picture renderer only needs PNG
// bytes out of an SVG buffer, so the ambient module declares exactly that.
declare module 'sharp' {
  export interface SharpPngOptions {
    readonly compressionLevel?: number;
  }
  export interface SharpPipeline {
    png(options?: SharpPngOptions): SharpPipeline;
    toBuffer(): Promise<Buffer>;
  }
  export default function sharp(input: Buffer): SharpPipeline;
}
