import { ChangeEvent, FC, useCallback, useState } from "react";
import styled from "@mui/material/styles/styled";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import Card from "@mui/material/Card";
import Fab from "@mui/material/Fab";
import CardContent from "@mui/material/CardContent";
import Snackbar from "@mui/material/Snackbar";
import Upload from "@mui/icons-material/Upload";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import Files from "./Files";
import { upload } from "./api";
import { useMemo } from "react";
import { alpha } from "@mui/material";

const HiddenInput = styled("input")({
  display: "none",
});

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(1),
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("sm")]: {
      width: "16ch",
      "&:focus": {
        width: "24ch",
      },
    },
  },
}));

const App: FC = () => {
  const [uploadState, setUploadState] = useState<{
    loading: boolean;
    progress: number;
    show: boolean;
    file?: File;
    error?: any;
  }>({ loading: false, progress: 0, show: false });

  const onUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    if (!file) {
      return;
    }

    setUploadState((uploadState) => {
      return { ...uploadState, loading: true, progress: 0, show: true, file };
    });

    upload(file, (event) => {
      setUploadState((uploadState) => {
        if (!event.total) {
          return { ...uploadState, progress: 0 };
        }
        return { ...uploadState, progress: event.loaded / event.total };
      });
    })
      .catch((error) => {
        setUploadState((uploadState) => {
          return { ...uploadState, error };
        });
      })
      .finally(() => {
        setUploadState((uploadState) => {
          return { ...uploadState, loading: false };
        });
      });
  }, []);

  const hideSnackBar = useMemo(() => {
    if (uploadState.loading) {
      return undefined;
    }

    return () => {
      setUploadState((uploadState) => {
        return { ...uploadState, show: false };
      });
    };
  }, [uploadState.loading]);

  return (
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
            <Search>
              <SearchIconWrapper>
                <SearchIcon />
              </SearchIconWrapper>
              <StyledInputBase
                placeholder="假装是个搜索框"
                inputProps={{ "aria-label": "search" }}
              />
            </Search>
          </Toolbar>
        </AppBar>
        <Snackbar
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          open={uploadState.show}
          onClose={hideSnackBar}
        >
          <Alert
            onClose={hideSnackBar}
            severity={
              uploadState.error
                ? "error"
                : uploadState.loading
                ? "info"
                : "success"
            }
            icon={
              !uploadState.error && uploadState.loading ? (
                <CircularProgress size="1em" />
              ) : undefined
            }
            sx={{ width: "100%" }}
          >
            {uploadState.loading
              ? `Uploading ${uploadState.file?.name || ""} ${(
                  uploadState.progress * 100
                ).toFixed(2)}%`
              : `Uploaded ${uploadState.file?.name || ""}`}
          </Alert>
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
              pointerEvents: uploadState.loading ? "none" : "all",
            }}
            color="primary"
            aria-label="upload"
            component="span"
          >
            {uploadState.loading ? (
              <CircularProgress size="2em" color="inherit" />
            ) : (
              <Upload />
            )}
          </Fab>
        </label>
      </Box>
      <Box p={4} sx={{ flexGrow: 1 }}>
        <Card sx={{ minWidth: 275, minHeight: "100%" }}>
          <CardContent>
            <Files />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default App;
