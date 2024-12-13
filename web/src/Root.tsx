import { NextUIProvider } from "@nextui-org/react";
import { useHref, useNavigate } from "react-router";
import { App } from "./App";

export const Root = () => {
  const navigate = useNavigate();

  return (
    <NextUIProvider navigate={navigate} useHref={useHref}>
      <App />
    </NextUIProvider>
  );
};
