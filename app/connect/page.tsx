"use client";

import ConnectionStatus from "./components/ConnectionStatus";
import ConnectionForm from "./components/ConnectionForm";
import { useState } from "react";
import PMSSelector, {
  PMSProvider,
} from "./components/PMSSelector";

export default function ConnectPage() {
  const [provider, setProvider] =
    useState<PMSProvider>("opendental");

  const [connected, setConnected] = useState(false);

  return (
    <main className="mx-auto max-w-5xl p-10">

      <h1 className="mb-8 text-4xl font-bold">
        Connect Your Practice
      </h1>

      <PMSSelector
        selected={provider}
        onSelect={setProvider}
      />

      <ConnectionForm
  provider={provider}
  onConnected={() => setConnected(true)}
/>
<ConnectionStatus
  connected={connected}
/>

    </main>
  );
}