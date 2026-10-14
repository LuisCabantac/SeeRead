import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { inTauri } from "../services/env";

const REPO = "https://github.com/clintgalendez/SeeRead";

const COMPONENTS: [string, string][] = [
  ["Tauri", "MIT or Apache-2.0"],
  ["React", "MIT"],
  ["CodeMirror", "MIT"],
  ["sherpa-onnx speech engine", "Apache-2.0"],
  ["ONNX Runtime", "MIT"],
  ["cpal audio library", "Apache-2.0"],
  ["Streaming Zipformer English model (k2-fsa)", "Apache-2.0"],
];

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!inTauri) return;
        e.preventDefault();
        void openUrl(href);
      }}
    >
      {children}
    </a>
  );
}

export function About() {
  const [inventory, setInventory] = useState<string | null>(null);
  useEffect(() => {
    fetch("third-party-licenses.txt")
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => setInventory(t && !t.trimStart().startsWith("<") ? t : null))
      .catch(() => setInventory(null));
  }, []);

  return (
    <div className="about">
      <h2>About SeeRead</h2>
      <p>
        Version {__APP_VERSION__}. A free, open-source teleprompter licensed under the Apache
        License 2.0.
      </p>
      <p className="row">
        <Link href={REPO}>Source code</Link>
        <Link href={`${REPO}/issues`}>Report a problem</Link>
        <Link href={`${REPO}/blob/main/docs/PRIVACY.md`}>Privacy</Link>
        <Link href={`${REPO}/blob/main/SECURITY.md`}>Security</Link>
      </p>

      <h3>Open-source components</h3>
      <table className="platform-table">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">License</th>
          </tr>
        </thead>
        <tbody>
          {COMPONENTS.map(([name, license]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inventory ? (
        <details>
          <summary>Full third-party license inventory</summary>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>
            {inventory}
          </pre>
        </details>
      ) : (
        <p className="muted">
          The complete license inventory is generated for release builds and published with each
          release.
        </p>
      )}
    </div>
  );
}
