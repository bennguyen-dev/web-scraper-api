export interface IResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface IGetInfo {
  url: string;
}

export interface IGetInfoResponse {
  url: string;
  screenshot?: Buffer;
  title?: string;
  description?: string;
  ogImage?: string;
}

export interface IGetInternalLinks {
  url: string;
  limit?: number;
}

export interface IGetInternalLinksResponse {
  links: string[];
}
