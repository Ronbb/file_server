import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  Button,
  Breadcrumbs,
  BreadcrumbItem,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  Listbox,
  ListboxItem,
} from "@nextui-org/react";
import {
  ArrowDownAZ,
  ArrowUpToLine,
  ArrowUpZA,
  Download,
  File,
  FileCheck2,
  Folder,
  FolderPen,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface Column {
  key: ColumnKey;
  name: string;
  align?: "center" | "start" | "end";
}

type ColumnKey = keyof Item;

interface Item {
  name: string;
  size: number;
  modifiedTime: string;
  isDirectory: boolean;
}

const columns: Column[] = [
  {
    key: "name",
    name: "Name",
  },
  {
    key: "size",
    name: "Size",
    align: "end",
  },
  {
    key: "modifiedTime",
    name: "Modified Date",
    align: "end",
  },
];

let nextId = 0;

const splitPath = (path: string) => {
  if (path === "") {
    return [];
  }
  return path.split("/");
};

export const App = () => {
  const [params, setParams] = useSearchParams();
  const [theme, setTheme] = useLocalStorage<"" | "dark">("theme", "");
  const [search, setSearch] = useLocalStorage<string>("search", "");
  const [sortColumn, setSortColumn] = useLocalStorage<Column | null>(
    "sort-column",
    null
  );
  const [sortDirection, setSortDirection] = useLocalStorage<"asc" | "desc">(
    "sort-direction",
    "asc"
  );
  const [isDragging, setIsDragging] = useDebounceValue(false, 160, {
    leading: true,
    trailing: true,
  });
  const [uploadFiles, setUploadFiles] = useState<
    {
      name: string;
      state: "uploading" | "done" | "error";
      error?: unknown;
      id: number;
      file: File;
    }[]
  >([]);
  const [showUpload, setShowUpload] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const moveRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const path = useMemo(() => {
    return splitPath(params.get("path") ?? "");
  }, [params]);

  const setPath = useCallback(
    (path: string[] | ((path: string[]) => string[])) => {
      if (typeof path === "function") {
        setParams((params) => {
          const old = splitPath(params.get("path") ?? "");
          return { path: path(old).join("/") };
        });
      } else {
        setParams({ path: path.join("/") });
      }

      setSearch("");
    },
    [setParams, setSearch]
  );

  useLayoutEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  useLayoutEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== "INPUT" &&
        event.target.tagName !== "TEXTAREA"
      ) {
        searchRef.current?.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const {
    isPending: isLoading,
    error,
    data: rawData,
    refetch,
  } = useQuery<{ items: Item[] }>({
    queryKey: ["files", path],
    queryFn: ({ queryKey }) =>
      fetch(
        `/file-server/api/file?${new URLSearchParams({
          path: ((queryKey[1] as string[]) ?? []).join("/"),
        })}`
      ).then((res) => res.json()),
  });

  const download = useCallback(
    (name: string) => {
      downloadRef.current?.setAttribute(
        "href",
        `/file-server/api/file?${new URLSearchParams({
          path: `${path.join("/")}/${name}`,
          download: "true",
        })}`
      );

      downloadRef.current?.click();
    },
    [path]
  );

  const addUploadFiles = useCallback(
    (files: FileList) => {
      const newFiles = Array.from(files).map(
        (file) =>
          ({
            id: nextId++,
            name: file.name,
            state: "uploading",
            file,
          } as const)
      );

      setUploadFiles((oldFiles) => [...oldFiles, ...newFiles]);

      setShowUpload(true);

      newFiles.forEach((newFile) => {
        const formData = new FormData();
        formData.append("file", newFile.file);

        fetch(`/file-server/api/file`, {
          method: "POST",
          body: formData,
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Failed to upload file: " + response.statusText);
            }
            refetch();
            setUploadFiles((files) => {
              return files.map((file) => {
                if (file.id === newFile.id) {
                  return {
                    ...file,
                    state: "done",
                  };
                }
                return file;
              });
            });
          })
          .catch((e) => {
            setUploadFiles((files) => {
              return files.map((file) => {
                if (file.id === newFile.id) {
                  return {
                    ...file,
                    state: "error",
                    error: e,
                  };
                }
                return file;
              });
            });
            alert(e);
          });
      });
    },
    [refetch]
  );

  const data = useMemo(() => {
    if (!rawData) {
      return;
    }

    let { items } = rawData;
    if (search) {
      items = items.filter((item) => item.name.includes(search));
    }

    const key = sortColumn?.key ?? "name";

    const sort = (a: Item, b: Item) => {
      if (a[key] < b[key]) {
        return -1;
      }
      if (a[key] > b[key]) {
        return 1;
      }
      return 0;
    };

    const directories = items.filter((item) => item.isDirectory);
    const files = items.filter((item) => !item.isDirectory);
    items = [...directories.sort(sort), ...files.sort(sort)];

    if (sortDirection === "desc") {
      items = items.reverse();
    }

    return {
      items,
    };
  }, [rawData, search, sortColumn?.key, sortDirection]);

  const renderColumn = useCallback(
    (column: Column) => {
      const sortable = () => {
        const { key, name } = column;
        return (
          <div
            className={clsx("flex flex-row items-center", {
              "justify-end": column.align === "end",
            })}
          >
            <Button
              variant="light"
              onPress={() => {
                setSortColumn(column);
              }}
              className="min-w-min pr-0"
            >
              {name}
            </Button>
            {sortColumn?.key === key && (
              <Button
                variant="light"
                color="primary"
                isIconOnly
                radius="full"
                onPress={() => {
                  setSortDirection((sortDirection) =>
                    sortDirection === "asc" ? "desc" : "asc"
                  );
                }}
              >
                {sortDirection === "asc" && <ArrowDownAZ width={16} />}
                {sortDirection === "desc" && <ArrowUpZA width={16} />}
                {/* PLACEHOLDER */}
                {sortDirection !== "asc" && sortDirection !== "desc" && (
                  <ArrowUpZA width={16} className="opacity-0" />
                )}
              </Button>
            )}
          </div>
        );
      };

      switch (column.key) {
        case "name":
          return sortable();
        case "size":
          return sortable();
        case "modifiedTime":
          return sortable();
        default:
          return column.name;
      }
    },
    [setSortColumn, setSortDirection, sortColumn?.key, sortDirection]
  );

  const renderCell = (item: Item, key: ColumnKey) => {
    switch (key) {
      case "name": {
        let downloadButton;

        if (item.isDirectory) {
          downloadButton = (
            <Popover shouldCloseOnScroll>
              <PopoverTrigger>
                <Button size="sm" variant="light" color="primary" isIconOnly>
                  <Download width={16} />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                {(titleProps) => (
                  <div className="px-1 py-2 w-full flex flex-col gap-2 text-foreground">
                    <p {...titleProps} className="font-bold">
                      Make sure to download the folder, it may be large.
                    </p>
                    <p>
                      Path:{" "}
                      <span>
                        {path.join("/")}/{item.name}
                      </span>
                    </p>
                    <Button
                      onPress={() => {
                        download(item.name);
                      }}
                      className="w-full"
                    >
                      Download
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          );
        } else {
          downloadButton = (
            <Button
              size="sm"
              variant="light"
              color="primary"
              isIconOnly
              onPress={() => {
                if (item.isDirectory) {
                  return;
                }

                download(item.name);
              }}
            >
              <Download width={16} />
            </Button>
          );
        }

        return (
          <div className="flex flex-row gap-2 items-center">
            <Button
              variant="light"
              className="text-inherit"
              startContent={
                item.isDirectory ? <Folder width={16} /> : <File width={16} />
              }
              onPress={() => {
                if (item.isDirectory) {
                  setPath((path) => [...path, item.name]);
                  refetch();
                }
              }}
            >
              <span>{item.name}</span>
            </Button>
            <div className="inline opacity-0 group-hover/row:opacity-100">
              <a ref={downloadRef} className="hidden" />
              {downloadButton}
              {/* Move */}
              <Popover size="lg" className="w-96">
                <PopoverTrigger>
                  <Button size="sm" variant="light" color="primary" isIconOnly>
                    <FolderPen width={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  {(titleProps) => (
                    <div className="px-1 py-2 w-full text-foreground">
                      <p className="text-small font-bold" {...titleProps}>
                        Move to:
                      </p>
                      <div className="mt-2 flex flex-col gap-2 w-full">
                        <Textarea
                          defaultValue={`${path.join("/")}/${item.name}`}
                          ref={moveRef}
                          label="Path"
                          size="sm"
                          variant="bordered"
                        />
                        <Button
                          onPress={() => {
                            if (!moveRef.current?.value) {
                              return;
                            }

                            fetch(
                              `/file-server/api/file?${new URLSearchParams({
                                path: `${path.join("/")}/${item.name}`,
                                dest: `${moveRef.current?.value}`,
                              })}`,
                              {
                                method: "PUT",
                              }
                            )
                              .then((response) => {
                                if (!response.ok) {
                                  throw new Error(
                                    "Failed to move file: " +
                                      response.statusText
                                  );
                                }
                                refetch();
                              })
                              .catch((e) => {
                                alert(e);
                              });
                          }}
                        >
                          Move
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {/* Remove */}
              <Button
                size="sm"
                variant="light"
                color="danger"
                isIconOnly
                onPress={() => {
                  // remove file
                  fetch(
                    `/file-server/api/file?${new URLSearchParams({
                      path: `${path.join("/")}/${item.name}`,
                    })}`,
                    {
                      method: "DELETE",
                    }
                  )
                    .then((response) => {
                      if (!response.ok) {
                        throw new Error(
                          "Failed to remove file: " + response.statusText
                        );
                      }
                      refetch();
                    })
                    .catch((e) => {
                      alert(e);
                    });
                }}
              >
                <Trash2 width={16} />
              </Button>
            </div>
          </div>
        );
      }
      case "size": {
        if (item.isDirectory) {
          return "";
        }

        let size = (item.size / 1024).toFixed(0);
        size = size.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        return `${size} KB`;
      }
      case "modifiedTime": {
        // format date
        const date = new Date(item.modifiedTime);
        return date.toLocaleString(undefined, {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
      default:
        return item[key];
    }
  };

  return (
    <div
      className={clsx(
        "w-screen h-screen overflow-hidden text-foreground bg-background relative"
      )}
      onDragOver={(event) => {
        setIsDragging(true);
        event.preventDefault();
      }}
      onDragEnter={() => {
        setIsDragging(true);
      }}
      onDragLeave={() => {
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        addUploadFiles(event.dataTransfer.files);
      }}
    >
      <Navbar maxWidth="2xl" position="static">
        <NavbarBrand
          className="cursor-pointer"
          onClick={() => {
            setPath([]);
          }}
        >
          <NavbarMenuToggle className="mr-2 h-6 sm:hidden" />
          <FileCheck2 width={24} strokeWidth={2} className="mr-2" />
          <p className="font-bold text-inherit">Files</p>
        </NavbarBrand>
        <Breadcrumbs className="flex flex-row w-full min-w-12" radius="full">
          {path.length > 0 && (
            <BreadcrumbItem
              key="root"
              onPress={() => {
                setPath([]);
              }}
            >
              /
            </BreadcrumbItem>
          )}
          {path.map((item, index) => (
            <BreadcrumbItem
              key={index}
              onPress={() => {
                setPath((path) => path.slice(0, index + 1));
              }}
            >
              {item}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>
        <NavbarContent
          className="h-12 max-w-fit items-center gap-0"
          justify="end"
        >
          <NavbarItem className="mr-2 hidden sm:flex">
            <Button
              className="bg-default-100 text-default-600"
              startContent={
                <RefreshCw size={20} className="text-default-600" />
              }
              radius="full"
              onPress={() => {
                refetch();
              }}
            >
              Refresh
            </Button>
          </NavbarItem>
          <NavbarItem className="mr-2 hidden sm:flex">
            <input
              ref={uploadRef}
              className="hidden"
              type="file"
              onChange={(event) => {
                if (event.target.files?.length) {
                  addUploadFiles(event.target.files);
                }
              }}
            />
            <Popover isOpen={showUpload} onOpenChange={setShowUpload}>
              <PopoverTrigger>
                <Button
                  className="bg-default-100 text-default-600"
                  startContent={
                    <Upload size={20} className="text-default-600" />
                  }
                  radius="full"
                  onPress={() => {
                    uploadRef.current?.click();
                  }}
                >
                  Upload
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                {() => (
                  <div>
                    <Button
                      className="w-full"
                      variant="flat"
                      onPress={() => {
                        uploadRef.current?.click();
                      }}
                    >
                      Select
                    </Button>
                    <Listbox items={uploadFiles} aria-label="Upload">
                      {(item) => (
                        <ListboxItem
                          key={item.id}
                          textValue={item.name}
                          startContent={
                            item.state === "uploading" ? (
                              <div className="animate-spin h-4 w-4 rounded-full bg-primary-600" />
                            ) : item.state === "done" ? (
                              <div className="h-4 w-4 rounded-full bg-success-600" />
                            ) : (
                              <div className="h-4 w-4 rounded-full bg-danger-600" />
                            )
                          }
                        >
                          <span className="text-default-500">{item.name}</span>
                        </ListboxItem>
                      )}
                    </Listbox>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </NavbarItem>
          <NavbarItem className="mr-2 hidden sm:flex">
            <Input
              aria-label="Search"
              ref={searchRef}
              labelPlacement="outside"
              placeholder="Search..."
              radius="full"
              startContent={<Search width={20} className="text-default-500" />}
              disableAnimation
              classNames={{
                input: "w-48 hover:w-56 focus:w-72 transition-width",
              }}
              isClearable
              onValueChange={(value) => setSearch(value)}
              value={search}
            />
          </NavbarItem>
          <NavbarItem className="hidden sm:flex">
            <Button
              isIconOnly
              radius="full"
              variant="light"
              onPress={() => {
                setTheme(theme === "dark" ? "" : "dark");
              }}
            >
              {theme === "" && <Sun className="text-default-500" width={24} />}
              {theme === "dark" && (
                <Moon className="text-default-500" width={24} />
              )}
            </Button>
          </NavbarItem>
          <NavbarItem className="hidden sm:flex">
            <Button
              isIconOnly
              radius="full"
              variant="light"
              onPress={() => {
                fetch("/file-server/api/logout").then((response) => {
                  if (response.status === 401) {
                    alert("logout");
                  } else {
                    alert("Failed to logout");
                  }
                });
              }}
            >
              <LogOut className="text-default-500" width={24} />
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <main className="flex flex-col w-full h-[calc(100%-4rem)] items-center pb-4 overflow-auto">
        <div
          ref={mainRef}
          className="max-w-screen-2xl w-full h-full overflow-auto"
        >
          <Table
            shadow="none"
            isStriped
            aria-label="Files"
            isHeaderSticky
            classNames={{
              base: "overflow-auto h-full",
            }}
          >
            <TableHeader className="shadow-lg">
              {columns.map((column) => (
                <TableColumn key={column.key} align={column.align}>
                  {renderColumn(column)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody
              emptyContent={error ? `${error}` : "No files"}
              isLoading={isLoading}
              loadingContent="Loading files..."
              items={data?.items ?? []}
            >
              {(item) => (
                <TableRow
                  key={item.name}
                  className={clsx("group/row", {
                    "text-primary-600": item.isDirectory,
                  })}
                >
                  {(key) => (
                    <TableCell className="group/cell">
                      {renderCell(item, key as ColumnKey)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
      <div className="absolute right-16 bottom-16">
        <Button
          onPress={() => {
            mainRef.current?.scrollTo({ top: 0 });
          }}
          isIconOnly
          size="lg"
          radius="full"
        >
          <ArrowUpToLine />
        </Button>
      </div>
      {isDragging &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute w-full h-full z-10000 left-0 top-0 bg-gray-500 text-foreground text-4xl flex items-center justify-center pointer-events-none"
          >
            Drop files to upload
          </motion.div>,
          document.body
        )}
    </div>
  );
};
