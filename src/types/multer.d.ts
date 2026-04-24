/**
 * Custom Multer type declarations
 * This file provides type definitions for multer when @types/multer is not available
 */

declare module 'multer' {
  import { Request } from 'express';

  namespace multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }

    interface Options {
      storage?: any;
      limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        parts?: number;
        headerPairs?: number;
      };
      fileFilter?: (
        req: Request,
        file: File,
        callback: (error: Error | null, acceptFile: boolean) => void
      ) => void;
    }

    interface Instance {
      single(fieldname: string): any;
      array(fieldname: string, maxCount?: number): any;
      fields(fields: any[]): any;
      none(): any;
      any(): any;
    }

    interface StorageEngine {
      _handleFile(req: Request, file: File, callback: (error?: any, info?: any) => void): void;
      _removeFile(req: Request, file: File, callback: (error: Error) => void): void;
    }

    function memoryStorage(): StorageEngine;
    function diskStorage(options: any): StorageEngine;
  }

  function multer(options?: multer.Options): multer.Instance;

  export = multer;
}

// Extend Express Request to include file and files from multer
declare global {
  namespace Express {
    interface Request {
      file?: multer.File;
      files?: multer.File[] | { [fieldname: string]: multer.File[] };
    }
  }
}

export {};
