import { FC, useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FileDownload from "@mui/icons-material/FileDownload";
import Folder from "@mui/icons-material/Folder";

import { file, Data, Item } from "./api";
import { useSearch } from "./SearchBar";

const File: FC<{
  item: Item;
  onClickItem: (item: Item) => void;
  path: string[];
}> = ({ item, onClickItem, path }) => {
  return (
    <ListItem key={item.name}>
      {item.isDir ? (
        <ListItemButton onClick={() => onClickItem(item)}>
          <ListItemIcon>
            <Folder />
          </ListItemIcon>
          <ListItemText primary={item.name} />
        </ListItemButton>
      ) : (
        <ListItemButton
          component="a"
          download
          href={`/file-server/api/file?path=${[...path, item.name].join("/")}`}
        >
          <ListItemIcon>
            <FileDownload />
          </ListItemIcon>
          <ListItemText primary={item.name} />
        </ListItemButton>
      )}
    </ListItem>
  );
};

const Files: FC = () => {
  const [requestPath, setRequestPath] = useState<string[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [data, setData] = useState<Data>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showError, setShowError] = useState<boolean>(false);
  const { search } = useSearch();

  useEffect(() => {
    setLoading(true);
    const next = requestPath.join("/");
    file(next)
      .then((data) => {
        data.items = data.items.sort((item) => (item.isDir ? -1 : 1));
        return data;
      })
      .then((data) => {
        setData(data);
        setPath(requestPath);
      })
      .catch((e) => {
        setError(e.toString());
        setShowError(true);
      })
      .finally(() => setLoading(false));
  }, [requestPath]);

  const onClickItem = useCallback(
    (item: Item) => {
      const next = [...path, item.name];
      if (!item.isDir) {
        return;
      }
      setRequestPath(next);
    },
    [path]
  );

  const onClickBreadcrumbs = useCallback((path: string[]) => {
    setRequestPath(path);
  }, []);

  const tester =
    search.length > 2 && search.endsWith("/") && search.startsWith("/")
      ? RegExp(search.substring(1, search.length - 1))
      : search;
  let ignored = 0;
  let items =
    data?.items?.filter((item) => {
      if (search) {
        if (
          (tester instanceof RegExp && tester.test(item.name)) ||
          (typeof tester == "string" && item.name.includes(tester))
        ) {
          return true;
        } else {
          ignored++;
          return false;
        }
      }

      return true;
    }) ?? [];

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Backdrop
        sx={{
          color: "primary",
          backgroundColor: "transparent",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Snackbar open={showError} onClose={() => setShowError(false)}>
        <Alert
          severity="error"
          sx={{ width: "100%" }}
          elevation={6}
          variant="filled"
          onClose={() => setShowError(false)}
        >
          {error}
        </Alert>
      </Snackbar>
      <Box px={[4]} py={[2]}>
        <Breadcrumbs aria-label="breadcrumb" separator="›">
          <Link
            underline="hover"
            color="inherit"
            onClick={() => onClickBreadcrumbs([])}
          >
            /
          </Link>
          {path.length > 1 &&
            path.slice(0, path.length - 1).map((p, index) => (
              <Link
                underline="hover"
                color="inherit"
                onClick={() => onClickBreadcrumbs(path.slice(0, index))}
              >
                {p}
              </Link>
            ))}
          {path.length && (
            <Typography color="text.primary">
              {path[path.length - 1]}
            </Typography>
          )}
        </Breadcrumbs>
      </Box>
      <Divider />
      <Box sx={{ flexGrow: 1, height: "100%", overflow: "auto" }}>
        <List>
          {search && (
            <ListItem>
              <Alert severity="info" sx={{ width: "100%" }}>
                search: {tester.toString()}, ignored: {ignored}
              </Alert>
            </ListItem>
          )}
          {items.map((item) => (
            <File item={item} onClickItem={onClickItem} path={path}></File>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default Files;
