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

import { files, Data, Item } from "./api";

const Files: FC = () => {
  const [requestPath, setRequestPath] = useState<string[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [data, setData] = useState<Data>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showError, setShowError] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    const next = requestPath.join("/");
    files(next)
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

  return (
    <Box>
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
      <Box>
        <List>
          {data?.items?.map((item) => (
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
                  href={`/api/files?path=${[...path, item.name].join("/")}`}
                >
                  <ListItemIcon>
                    <FileDownload />
                  </ListItemIcon>
                  <ListItemText primary={item.name} />
                </ListItemButton>
              )}
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default Files;
