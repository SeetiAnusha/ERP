/**
 * Custom Multer type declarations
 * This file provides type definitions for multer when @types/multer is not available
 */

import { Request } from 'express';

declare module 'multer' {
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
    storage?: StorageEngine;
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

  interface Multer {
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

  interface DiskStorageOptions {
    destination?: string | ((req: Request, file: File, callback: (error: Error | null, destination: string) => void) => void);
    filename?: (req: Request, file: File, callback: (error: Error | null, filename: string) => void) => void;
  }

  function memoryStorage(): StorageEngine;
  function diskStorage(options: DiskStorageOptions): StorageEngine;

  function multer(options?: Options): Multer;
  
  namespace multer {
    export { File, Options, Multer, StorageEngine, DiskStorageOptions };
    export function memoryStorage(): StorageEngine;
    export function diskStorage(options: DiskStorageOptions): StorageEngine;
  }

  export = multer;
}

// Extend Express Request to include file and files from multer
declare global {
  namespace Express {
    interface Request {
      file?: import('multer').File;
      files?: import('multer').File[] | { [fieldname: string]: import('multer').File[] };
    }
  }
}

export {};
