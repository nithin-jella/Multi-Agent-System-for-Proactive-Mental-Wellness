"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import SessionSync from "./SessionSync";

type Props = {
  children: React.ReactNode;
};

const ClientProvider = ({ children }: Props) => {
  return (
    <SessionProvider refetchInterval={300} refetchOnWindowFocus>
      <SessionSync />
      {children}
    </SessionProvider>
  );
};

export default ClientProvider;