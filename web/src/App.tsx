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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from "@nextui-org/react";
import {
  ArrowDownAZ,
  ArrowUpZA,
  Download,
  File,
  FileCheck2,
  Folder,
  FolderPen,
  ListFilter,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";

interface Column {
  key: ColumnKey;
  name: string;
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
  },
  {
    key: "modifiedTime",
    name: "Modified Date",
  },
];

export const App = () => {
  const [theme, setTheme] = useState<"" | "dark">("");
  const [search, setSearch] = useState<string>();
  const [sortColumn, setSortColumn] = useState<Column | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [path, setPath] = useState<string[]>([]);
  const moveRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
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

  const data = useMemo(() => {
    if (!rawData) {
      return;
    }

    let { items } = rawData;
    if (search) {
      items = items.filter((item) => item.name.includes(search));
    }

    const sort = (key: ColumnKey) => {
      return (a: Item, b: Item) => {
        if (a[key] < b[key]) {
          return sortDirection === "asc" ? -1 : 1;
        }
        if (a[key] > b[key]) {
          return sortDirection === "asc" ? 1 : -1;
        }
        return 0;
      };
    };

    if (!sortColumn) {
      const directories = items.filter((item) => item.isDirectory);
      const files = items.filter((item) => !item.isDirectory);
      return {
        items: [...directories.sort(sort("name")), ...files.sort(sort("name"))],
      };
    }

    items = items.sort(sort(sortColumn.key));

    return { items };
  }, [rawData, search, sortDirection, sortColumn]);

  const sortable = useCallback(
    (column: Column) => {
      const { key, name } = column;
      return (
        <div className="flex flex-row items-center">
          {name}
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
    },
    [sortDirection, sortColumn]
  );

  const renderColumn = useCallback(
    (column: Column) => {
      switch (column.key) {
        case "name":
          return sortable(column);
        case "size":
          return sortable(column);
        case "modifiedTime":
          return sortable(column);
        default:
          return column.name;
      }
    },
    [sortable]
  );

  const renderCell = (item: Item, key: ColumnKey) => {
    switch (key) {
      case "name":
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
              <Button
                size="sm"
                variant="light"
                color="primary"
                isIconOnly
                onPress={() => {
                  // download file by browser
                  window.open(
                    `/file-server/api/file?${new URLSearchParams({
                      path: `${path.join("/")}/${item.name}`,
                      download: "true",
                    })}`
                  );
                }}
              >
                <Download width={16} />
              </Button>
              {/* Move */}
              <Popover size="lg" className="w-96">
                <PopoverTrigger>
                  <Button size="sm" variant="light" color="primary" isIconOnly>
                    <FolderPen width={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  {(titleProps) => (
                    <div className="px-1 py-2 w-full">
                      <p
                        className="text-small font-bold text-foreground"
                        {...titleProps}
                      >
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
      case "size": {
        if (item.isDirectory) {
          return "";
        }
        // size to human readable
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = item.size;
        let unit = 0;
        while (size >= 1024 && unit < units.length) {
          size /= 1024;
          unit++;
        }

        return `${size.toFixed(2)} ${units[unit]}`;
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
        "w-screen h-screen overflow-hidden text-foreground bg-background",
        theme
      )}
    >
      <Navbar maxWidth="2xl">
        <NavbarBrand>
          <NavbarMenuToggle className="mr-2 h-6 sm:hidden" />
          <FileCheck2 width={24} strokeWidth={2} className="mx-2" />
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
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                const formData = new FormData();
                formData.append("file", file);

                fetch(`/file-server/api/file`, {
                  method: "POST",
                  body: formData,
                })
                  .then((response) => {
                    if (!response.ok) {
                      throw new Error(
                        "Failed to upload file: " + response.statusText
                      );
                    }
                    refetch();
                  })
                  .catch((e) => {
                    alert(e);
                  });
              }}
            />
            <Button
              className="bg-default-100 text-default-600"
              startContent={<Upload size={20} className="text-default-600" />}
              radius="full"
              onPress={() => {
                uploadRef.current?.click();
              }}
            >
              Upload
            </Button>
          </NavbarItem>
          <NavbarItem className="mr-2 hidden sm:flex">
            <Dropdown>
              <DropdownTrigger>
                <Button
                  className="bg-default-100 text-default-600"
                  startContent={
                    <ListFilter size={20} className="text-default-600" />
                  }
                  radius="full"
                >
                  Sort
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Single selection example"
                selectedKeys={sortColumn ? [sortColumn.key] : []}
                selectionMode="single"
                variant="flat"
                onSelectionChange={(selection) => {
                  setSortColumn(
                    columns.find(
                      (column) => column.key === selection.currentKey
                    ) ?? null
                  );
                }}
                items={columns}
              >
                {(item) => (
                  <DropdownItem key={item.key}>{item.name}</DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
          <NavbarItem className="mr-2 hidden sm:flex">
            <Input
              aria-label="Search"
              labelPlacement="outside"
              placeholder="Search..."
              radius="full"
              startContent={<Search width={20} className="text-default-500" />}
              disableAnimation
              classNames={{
                input: "w-48 hover:w-56 focus:w-72 transition-width",
              }}
              onValueChange={(value) => setSearch(value)}
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
            <Button isIconOnly radius="full" variant="light">
              <Settings className="text-default-500" width={24} />
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <main className="flex flex-col w-full h-[calc(100%-4rem)] items-center">
        <div className="max-w-screen-2xl w-full overflow-auto h-auto">
          <Table shadow="none" isStriped aria-label="Files">
            <TableHeader>
              {columns.map((column) => (
                <TableColumn key={column.key}>
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
    </div>
  );
};
