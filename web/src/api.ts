import axios, { AxiosProgressEvent } from "axios";

export interface Item {
  name: string;
  isDir: boolean;
}

export interface Data {
  items: Item[];
}

export const files = async (path: string) => {
  const response = await axios.get("/api/files", {
    params: {
      path,
    },
    timeout: 16000,
  });

  return response.data as Data;
};

export const upload = async (
  file: File,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
) => {
  const data = new FormData();
  data.append("file", file);

  const response = await axios.post("/api/upload", data, {
    maxBodyLength: 4 * 1024 * 1024,
    onUploadProgress: onUploadProgress,
  });

  return response.data;
};
