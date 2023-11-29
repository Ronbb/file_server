import { ChangeEvent, FC, useCallback, useRef, useState } from "react";
import styled from "@mui/material/styles/styled";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import Card from "@mui/material/Card";
import Fab from "@mui/material/Fab";
import CardContent from "@mui/material/CardContent";
import Snackbar from "@mui/material/Snackbar";
import Upload from "@mui/icons-material/Upload";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import Files from "./Files";
import { upload } from "./api";
import { SearchBar, SearchProvider } from "./SearchBar";
import { List, ListItem, SnackbarContent, Stack } from "@mui/material";

const HiddenInput = styled("input")({
  display: "none",
});

const App: FC = () => {
  const [search, setSearch] = useState<string>("");
  const [uploadIds, setUploadIds] = useState<number[]>([]);
  const [uploadState, setUploadState] = useState<
    Record<
      number,
      {
        uploading: boolean;
        progress: number;
        file?: File;
        error?: any;
      }
    >
  >({});

  const nextId = useRef(0);

  const onUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    if (!file) {
      return;
    }

    const id = nextId.current++;

    setUploadIds((uploadIds) => {
      return [...uploadIds, id];
    });

    setUploadState((uploadState) => {
      return {
        ...uploadState,
        [id]: { uploading: true, progress: 0, file },
      };
    });

    upload(file, (event) => {
      setUploadState((uploadState) => {
        if (!event.total) {
          return { ...uploadState, [id]: { ...uploadState[id], progress: 0 } };
        }
        return {
          ...uploadState,
          [id]: { ...uploadState[id], progress: event.loaded / event.total },
        };
      });
    })
      .catch((error) => {
        setUploadState((uploadState) => {
          return {
            ...uploadState,
            [id]: { ...uploadState[id], error },
          };
        });
      })
      .finally(() => {
        setUploadState((uploadState) => {
          return {
            ...uploadState,
            [id]: { ...uploadState[id], uploading: false },
          };
        });
      });
  }, []);

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box>
        <AppBar position="sticky">
          <Toolbar>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="open drawer"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }}
            >
              FileServer
            </Typography>
            <SearchBar />
          </Toolbar>
        </AppBar>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          open={uploadIds.length > 0}
          sx={{ m: 8 }}
        >
          <List>
            {uploadIds.map((id) => {
              const item = uploadState[id];
              if (!item) {
                return null;
              }
              const hideSnackBar = item.uploading
                ? undefined
                : () => {
                    setUploadIds((uploadIds) => {
                      return uploadIds.filter((i) => id !== i);
                    });
                  };

              return (
                <ListItem>
                  <Alert
                    onClose={hideSnackBar}
                    severity={
                      item.error ? "error" : item.uploading ? "info" : "success"
                    }
                    icon={
                      !item.error && item.uploading ? (
                        <CircularProgress size="1em" />
                      ) : undefined
                    }
                    sx={{ marginLeft: "auto" }}
                  >
                    {item.uploading
                      ? `Uploading ${item.file?.name || ""} ${(
                          item.progress * 100
                        ).toFixed(2)}%`
                      : `Uploaded ${item.file?.name || ""}`}
                  </Alert>
                </ListItem>
              );
            })}
          </List>
        </Snackbar>

        <label htmlFor="contained-button-file">
          <HiddenInput
            accept="*"
            id="contained-button-file"
            type="file"
            value=""
            onChange={onUpload}
          />
          <Fab
            sx={{
              position: "fixed",
              bottom: 32,
              right: 32,
            }}
            color="primary"
            aria-label="upload"
            component="span"
          >
            <Upload />
          </Fab>
        </label>
      </Box>
      <Box p={4} sx={{ flexGrow: 1, overflow: "hidden" }}>
        <Card sx={{ minWidth: 275, height: "100%" }}>
          <CardContent sx={{ overflow: "auto", height: "100%" }}>
            <Files />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );

  return (
    <SearchProvider value={{ search, setSearch }}>{content}</SearchProvider>
  );
};

export default App;
