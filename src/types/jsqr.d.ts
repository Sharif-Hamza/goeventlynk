declare module 'jsqr' {
  interface Point {
    x: number;
    y: number;
  }

  interface QRCode {
    binaryData: number[];
    data: string;
    location: {
      topLeftCorner: Point;
      topRightCorner: Point;
      bottomRightCorner: Point;
      bottomLeftCorner: Point;
    };
  }

  function jsQR(
    imageData: Uint8ClampedArray,
    width: number,
    height: number
  ): QRCode | null;

  export default jsQR;
}
